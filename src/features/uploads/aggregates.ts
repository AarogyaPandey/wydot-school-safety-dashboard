import { csvCell } from '../exports/aggregates';
import { categoryCounts, dateCounts, numericBins, type UploadedRow, type UploadSettings } from './data';
const countNote = 'Features are counted in each enabled file. Overlapping files may contain the same records.';

export function uploadedCsv(rows: UploadedRow[], settings: UploadSettings, layerNames: string[], areaSelected: boolean): string {
  const byLayer = new Map<string, number>(layerNames.map(name => [name, 0])); rows.forEach(row => byLayer.set(row.layer.name, (byLayer.get(row.layer.name) || 0) + 1));
  const output: (string | number)[][] = [
    ['scope', `${rows.length} features; files ${layerNames.join(' | ')}; category ${settings.categoryField || 'none'} = ${settings.categoryValue || 'all'}; dates ${settings.dateField || 'none'} ${settings.fromDate || 'any'} through ${settings.toDate || 'any'}; ${areaSelected ? 'selected map area (bounding-box query)' : 'all areas'}; ${countNote}`],
    ['dimension', 'category', 'feature_count'], ['all', 'Filtered features', rows.length],
    ...[...byLayer].map(([name, count]) => ['layer', name, count]),
    ...(settings.categoryField ? categoryCounts(rows, settings.categoryField).map(([name, count]) => [settings.categoryField, name, count]) : []),
    ...(settings.dateField ? dateCounts(rows, settings.dateField).map(([name, count]) => ['month', name, count]) : []),
    ...(settings.valueField ? numericBins(rows, settings.valueField).map(([name, count]) => [`${settings.valueField} bin`, name, count]) : []),
  ];
  return '\uFEFF' + output.map(row => row.map(csvCell).join(',')).join('\r\n');
}

