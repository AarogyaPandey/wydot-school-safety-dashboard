import type { FeatureCollection } from 'geojson';
import { researchDatasetSchema, type ResearchDataset, type TableRow } from '../domain/types';
import { localSnapshot, STANDALONE_MODE } from './standalone';

export const RESEARCH_MODE = import.meta.env.DEV && import.meta.env.MODE === 'research';
export type DatasetState = { status: 'loading' | 'ready' | 'withheld' | 'error'; data: ResearchDataset | null; message: string };
export async function fetchDataset(signal?: AbortSignal): Promise<DatasetState> {
  if (STANDALONE_MODE) return { status: 'ready', data: researchDatasetSchema.parse(localSnapshot().dataset), message: '' };
  // Try to load dataset.json first (for standalone/built versions)
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}data/dataset.json`, { signal });
    if (response.ok) {
      const data = await response.json();
      const result = researchDatasetSchema.safeParse(data);
      if (result.success) {
        return { status: 'ready', data: result.data, message: '' };
      } else {
        // Schema validation failed - this is an error in the data file itself
        console.error('Dataset schema validation failed:', result.error.toString());
        return { status: 'error', data: null, message: 'Dataset schema validation failed' };
      }
    }
  } catch (err) {
    console.error('Failed to fetch dataset.json:', err);
    // Fall through to check manifest
  }

  // If no local data found and not in research mode, try manifest but allow built app to still try
  if (!RESEARCH_MODE) {
    // For built/production apps: don't block on manifest, they may have embedded data
    // Just log that manifest wasn't available
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}data/manifest.json`, { signal });
      if (response.ok) {
        const manifest = await response.json();
        return { status: 'withheld', data: null, message: typeof manifest.message === 'string' ? manifest.message : 'Data publication review is pending.' };
      }
    } catch (err) {
      // No manifest found; in a built app this is fine - data might be embedded
    }
    // If we get here, we couldn't load data.json or manifest.json
    // This is expected in a built app without local data - return withheld but don't crash
    return { status: 'withheld', data: null, message: 'Data is not available in this build.' };
  }
  const response = await fetch('/__research/dataset', { signal, cache: 'no-store' });
  if (!response.ok) { const error = await response.json(); throw new Error(error.error || 'The local research dataset could not be loaded.'); }
  return { status: 'ready', data: researchDatasetSchema.parse(await response.json()), message: '' };
}
const layerCache = new Map<string, Promise<FeatureCollection>>();
export function fetchLayer(key: string, year = 2025): Promise<FeatureCollection> {
  if (STANDALONE_MODE) {
    const layer = localSnapshot().layers[`${key}:${year}`] || localSnapshot().layers[key];
    return layer ? Promise.resolve(layer) : Promise.reject(new Error('This layer is not included in the local snapshot.'));
  }
  const cacheKey = `${key}:${year}`;
  if (!layerCache.has(cacheKey)) {
    const fetchFn = async () => {
      // Try to load from built/standalone data first
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}data/layers/${key}.geojson`);
        if (response.ok) {
          const data = await response.json();
          if (data.type !== 'FeatureCollection' || !Array.isArray(data.features)) throw new Error('Invalid layer format.');
          return data as FeatureCollection;
        }
      } catch (err) {
        // Fall through to research mode
      }

      // Fall back to research mode
      if (!RESEARCH_MODE) return Promise.reject(new Error('This layer is awaiting publication review.'));
      const response = await fetch(`/__research/layers/${encodeURIComponent(key)}?year=${year}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('The selected layer could not be loaded.');
      const data = await response.json();
      if (data.type !== 'FeatureCollection' || !Array.isArray(data.features)) throw new Error('Invalid layer format.');
      return data as FeatureCollection;
    };
    layerCache.set(cacheKey, fetchFn().catch(error => { layerCache.delete(cacheKey); throw error; }));
  }
  return layerCache.get(cacheKey)!;
}
export async function fetchAnalysis(): Promise<Record<string, TableRow[]>> {
  if (STANDALONE_MODE) return localSnapshot().analysis;
  if (!RESEARCH_MODE) throw new Error('The analytical outputs are awaiting publication review.');
  const response = await fetch('/__research/analysis', { cache: 'no-store' });
  if (!response.ok) throw new Error('The Phase 2 analysis tables could not be loaded.');
  return response.json();
}
