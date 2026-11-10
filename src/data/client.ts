import type { FeatureCollection } from 'geojson';
import { researchDatasetSchema, type ResearchDataset, type TableRow } from '../domain/types';

export const RESEARCH_MODE = import.meta.env.DEV && import.meta.env.MODE === 'research';
export type DatasetState = { status: 'loading' | 'ready' | 'withheld' | 'error'; data: ResearchDataset | null; message: string };
export async function fetchDataset(signal?: AbortSignal): Promise<DatasetState> {
  if (!RESEARCH_MODE) {
    const response = await fetch(`${import.meta.env.BASE_URL}data/manifest.json`, { signal });
    if (!response.ok) throw new Error('The data release manifest could not be loaded.');
    const manifest = await response.json();
    return { status: 'withheld', data: null, message: typeof manifest.message === 'string' ? manifest.message : 'Data publication review is pending.' };
  }
  const response = await fetch('/__research/dataset', { signal, cache: 'no-store' });
  if (!response.ok) { const error = await response.json(); throw new Error(error.error || 'The local research dataset could not be loaded.'); }
  return { status: 'ready', data: researchDatasetSchema.parse(await response.json()), message: '' };
}
const layerCache = new Map<string, Promise<FeatureCollection>>();
export function fetchLayer(key: string, year = 2025): Promise<FeatureCollection> {
  if (!RESEARCH_MODE) return Promise.reject(new Error('This layer is awaiting publication review.'));
  const cacheKey = `${key}:${year}`;
  if (!layerCache.has(cacheKey)) layerCache.set(cacheKey, fetch(`/__research/layers/${encodeURIComponent(key)}?year=${year}`, { cache: 'no-store' }).then(async r => {
    if (!r.ok) throw new Error('The selected layer could not be loaded.');
    const data = await r.json();
    if (data.type !== 'FeatureCollection' || !Array.isArray(data.features)) throw new Error('Invalid layer format.');
    return data as FeatureCollection;
  }).catch(error => { layerCache.delete(cacheKey); throw error; }));
  return layerCache.get(cacheKey)!;
}
export async function fetchAnalysis(): Promise<Record<string, TableRow[]>> {
  if (!RESEARCH_MODE) throw new Error('The analytical outputs are awaiting publication review.');
  const response = await fetch('/__research/analysis', { cache: 'no-store' });
  if (!response.ok) throw new Error('The Phase 2 analysis tables could not be loaded.');
  return response.json();
}
