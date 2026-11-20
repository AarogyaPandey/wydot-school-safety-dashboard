import type { FeatureCollection } from 'geojson';
import type { ResearchDataset, TableRow } from '../domain/types';

export const STANDALONE_MODE = import.meta.env.MODE === 'standalone';
type LocalSnapshot = {
  schemaVersion: 1;
  dataset: ResearchDataset;
  layers: Record<string, FeatureCollection>;
  analysis: Record<string, TableRow[]>;
};
let snapshot: LocalSnapshot | undefined;
export function localSnapshot(): LocalSnapshot {
  if (!snapshot) {
    const content = document.getElementById('school-safety-local-snapshot')?.textContent;
    if (!content) throw new Error('The local research snapshot is missing. Rebuild the standalone HTML.');
    const parsed = JSON.parse(content) as LocalSnapshot;
    if (parsed.schemaVersion !== 1 || !parsed.dataset || !parsed.layers || !parsed.analysis) throw new Error('Invalid local research snapshot.');
    snapshot = parsed;
  }
  return snapshot;
}
