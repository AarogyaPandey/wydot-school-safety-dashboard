import { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import { Files, Layers, MapPin, Shapes } from 'lucide-react';
import { useDashboard } from '../../app/DashboardContext';
import ChartCard from '../analytics/ChartCard';
import { categoryCounts, dateCounts, numericBins } from './data';

const countNote = 'Features are counted in each enabled file. Overlapping files may contain the same records.';
function bars(rows: [string, number][], horizontal = false): EChartsOption {
  const categories = { type: 'category' as const, data: rows.map(r => r[0]), axisTick: { show: false }, axisLabel: { fontSize: 11, width: horizontal ? 150 : 70, overflow: 'truncate' as const }, axisLine: { lineStyle: { color: '#e3ded6' } } };
  const counts = { type: 'value' as const, minInterval: 1, splitLine: { lineStyle: { color: '#eeeae3' } } };
  return { grid: { left: horizontal ? 150 : 40, right: 25, bottom: 38, top: 16 }, xAxis: horizontal ? counts : categories, yAxis: horizontal ? { ...categories, inverse: true } : counts,
    series: [{ name: 'Features', type: 'bar', barMaxWidth: 28, data: rows.map(r => r[1]), itemStyle: { color: '#806345', borderRadius: 3 } }] };
}

export default function UploadedAnalytics() {
  const { uploadedRows: rows, uploads, uploadSettings: settings, filters } = useDashboard();
  const enabled = uploads.filter(l => l.enabled);
  const mapped = rows.filter(r => r.feature.geometry !== null).length;
  const geometries = new Set(rows.map(r => r.feature.geometry?.type).filter(Boolean)).size;
  const category = useMemo(() => {
    const counts = categoryCounts(rows, settings.categoryField);
    return counts.length > 15 ? [...counts.slice(0, 15), [`Remaining ${counts.length - 15} categories`, counts.slice(15).reduce((n, r) => n + r[1], 0)] as [string, number]] : counts;
  }, [rows, settings.categoryField]);
  const months = useMemo(() => dateCounts(rows, settings.dateField), [rows, settings.dateField]);
  const histogram = useMemo(() => numericBins(rows, settings.valueField), [rows, settings.valueField]);
  const perLayer = enabled.map(l => [l.name, rows.filter(r => r.layer.id === l.id).length] as [string, number]);
  const context = `${rows.length.toLocaleString()} features · ${enabled.map(l => l.name).join(', ') || 'No enabled layers'}${settings.categoryValue ? ` · ${settings.categoryField}: ${settings.categoryValue}` : ''}${settings.fromDate || settings.toDate ? ` · ${settings.dateField}: ${settings.fromDate || 'any'} to ${settings.toDate || 'any'}` : ''}${filters.bounds ? ' · Selected map area (bounding-box query)' : ''}`;
  const cards = [
    { label: 'Features', value: rows.length, Icon: Files }, { label: 'Active layers', value: enabled.length, Icon: Layers },
    { label: 'Mapped features', value: mapped, Icon: MapPin }, { label: 'Geometry types', value: geometries, Icon: Shapes },
  ];
  return <section aria-label="Uploaded data analytics">
    <div className="kpi-grid">{cards.map(({ label, value, Icon }) => <article className="kpi-card" key={label}><div className="kpi-title"><span>{label}</span><Icon size={14} /></div><strong data-testid={label === 'Features' ? 'uploaded-feature-count' : undefined}>{value.toLocaleString()}</strong></article>)}</div>
    {!enabled.length && <p className="upload-empty" role="status">All uploaded layers are off. Enable a layer in Data.</p>}
    <div className="chart-grid">
      <ChartCard title="Features by layer" note={countNote} option={bars(perLayer, true)} context={context} countNote={countNote} />
      <ChartCard title="Categories" note={`${settings.categoryField || 'No category field selected'}. Counts use available values; missing values are listed separately. Up to 15 categories plus the remaining total.`} option={bars(category, true)} context={`${context} · Category: ${settings.categoryField || 'none'}`} countNote={countNote} available={Boolean(settings.categoryField)} emptyText="Choose a category field in Filters." />
      <ChartCard title="Features by month" note={`${settings.dateField || 'No date field selected'}. Counts use recorded ISO calendar dates without timezone conversion. Missing/invalid dates are omitted; months without records are not inferred.`} option={bars(months)} context={`${context} · Date: ${settings.dateField || 'none'}`} countNote={countNote} available={Boolean(settings.dateField)} emptyText="No date field selected. Choose an available date field in Filters." />
      <ChartCard title="Numeric distribution" note={`${settings.valueField || 'No numeric field selected'}. Equal-width bins; last bin includes the maximum. Missing values and numeric strings are excluded.`} option={bars(histogram)} context={`${context} · Numeric field: ${settings.valueField || 'none'}`} countNote={countNote} available={Boolean(settings.valueField)} emptyText="No numeric field selected. Choose an available numeric field in Filters." />
    </div>
    <p className="chart-note">{countNote}{mapped !== rows.length ? ` ${rows.length - mapped} ${rows.length - mapped === 1 ? 'feature has' : 'features have'} no geometry.` : ''} Fields and date ranges can be changed in Filters.</p>
  </section>;
}
