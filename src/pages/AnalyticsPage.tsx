import { useCallback, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowDownToLine, ArrowRight, ArrowUpDown, Check, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { useDashboard } from '../app/DashboardContext';
import { FilterDrawer, FilterSummary } from '../components/Filters';
import { Kpis } from '../components/Kpis';
import { DatasetNotice } from '../components/Status';
import ChartCard from '../features/analytics/ChartCard';
import { hourOption, schoolOption, severityOption, weekdayHourOption, yearOption } from '../features/analytics/options';
import { buildAggregateCsv, downloadBlob } from '../features/exports/aggregates';
import Phase2Results from '../features/analytics/Phase2Results';
import { SEVERITY_GROUPS, TIME_LABELS } from '../domain/types';

export default function AnalyticsPage() {
  const { state, filters, matches, schoolCounts, selectedSchool, selectSchool, resetFilters, summary } = useDashboard();
  const location = useLocation();
  const [showFilters, setShowFilters] = useState(false), [tab, setTab] = useState('overview'), [search, setSearch] = useState(''), [sort, setSort] = useState<'name' | 'crashes'>('crashes'), [exported, setExported] = useState(false);
  const ready = state.status === 'ready';
  const closeFilters = useCallback(() => setShowFilters(false), []);
  const context = [
    `${summary.total.toLocaleString()} unique crashes`,
    selectedSchool?.name || (filters.level === 'all' ? 'All schools' : filters.level),
    `${filters.startYear}–${filters.endYear}${filters.endYear === 2026 ? ' (2026 incomplete)' : ''}`,
    `Within ${filters.bufferFt.toLocaleString()} ft`,
    filters.severities.length !== SEVERITY_GROUPS.length && `Severity: ${SEVERITY_GROUPS.filter(s => filters.severities.includes(s.id)).map(s => s.label).join(', ') || 'none'}`,
    filters.involvement !== 'all' && `Involvement: ${{ 'ped-bike': 'pedestrian or bicycle', pedestrian: 'pedestrian', cyclist: 'bicycle', unknown: 'unknown' }[filters.involvement]}`,
    filters.time !== 'all' && TIME_LABELS[filters.time],
    filters.schoolDays && 'Assumed school days',
    filters.bounds && `Selected map area (${Object.values(filters.bounds).map(n => n.toFixed(4)).join(', ')})`,
    selectedSchool && !selectedSchool.hasLinkedRecords && 'No linked records; coverage unverified',
  ].filter(Boolean).join(' · ');

  const year = useMemo(() => yearOption(matches, filters), [matches, filters]);
  const hour = useMemo(() => hourOption(matches), [matches]);
  const severity = useMemo(() => severityOption(matches), [matches]);
  const heatmap = useMemo(() => weekdayHourOption(matches), [matches]);
  const school = useMemo(() => schoolOption(schoolCounts), [schoolCounts]);
  const tableRows = useMemo(() => schoolCounts.filter(r => r.school.name.toLowerCase().includes(search.toLowerCase())).sort((a, b) => sort === 'name' ? a.school.name.localeCompare(b.school.name) : b.crashes - a.crashes || a.school.name.localeCompare(b.school.name)), [schoolCounts, search, sort]);
  const csvExport = () => { downloadBlob(new Blob([buildAggregateCsv(matches, schoolCounts, filters)], { type: 'text/csv;charset=utf-8;' }), `cheyenne-aggregate-research-${filters.startYear}-${filters.endYear}.csv`); setExported(true); window.setTimeout(() => setExported(false), 2500); };
  return <main id="main-content" className="analytics-page">
    <h1 className="sr-only">Analytics</h1>
    <FilterDrawer open={showFilters} onClose={closeFilters} />
    <div className="analytics-toolbar"><button className={`button filter-toggle${showFilters ? ' active' : ''}`} aria-label="Filters" aria-expanded={showFilters} aria-controls="dashboard-filters" onClick={() => setShowFilters(value => !value)}><SlidersHorizontal size={14} /><span>Filters</span></button><FilterSummary /><div className="analytics-toolbar-actions"><Link to={`/map${location.search}`} className="button quiet">Map<ArrowRight size={13} /></Link><button className="button quiet reset-control" aria-label="Reset analytics filters" title="Reset filters" onClick={resetFilters}><RotateCcw size={14} /><span>Reset</span></button><button className="button primary" aria-label="Export aggregate CSV" disabled={!ready} onClick={csvExport}>{exported ? <Check size={14} /> : <ArrowDownToLine size={14} />}<span>{exported ? 'Downloaded' : 'CSV'}</span></button></div></div>
    <div className="analytics-workspace">
      <DatasetNotice compact /><Kpis />
      <div className="analytics-tabs" role="group" aria-label="Analytics views">{[{ id: 'overview', label: 'Overview' }, { id: 'schools', label: 'Schools' }, { id: 'phase2', label: 'Statistical results' }].map(t => <button key={t.id} className={tab === t.id ? 'active' : ''} aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>)}</div>
      {tab === 'overview' && <><div className="chart-grid"><ChartCard title="Crashes by year" note="Unique crashes by year. 2026 is incomplete." option={year} context={context} available={ready} /><ChartCard title="Crashes by hour" note="Local clock hours. Gold bars approximate assumed arrival/dismissal hours; exact filters retain minute boundaries." option={hour} context={context} available={ready} /><ChartCard title="Severity" note="Most severe recorded crash outcome; not the number of people injured." option={severity} context={context} available={ready} /><ChartCard title="Weekday and hour" note="Unique crashes by weekday and local hour. Darker cells indicate more crashes." option={heatmap} context={context} available={ready} /></div></>}
      {tab === 'schools' && <><ChartCard title="Crashes by school" note="Up to ten schools with the most filtered records, for exploration—not a ranking of safety. Shared crashes count for each qualifying school." option={school} context={context} available={ready} wide /><section className="school-table-card"><div className="section-heading"><div><h2>Schools</h2></div><label className="school-table-search"><span className="sr-only">Find a school in the comparison table</span><input placeholder="Find a school…" value={search} onChange={e => setSearch(e.target.value)} /></label></div><div className="table-scroll"><table><thead><tr><th><button onClick={() => setSort('name')}>School <ArrowUpDown size={12} /></button></th><th>Level</th><th><button onClick={() => setSort('crashes')}>Unique crashes <ArrowUpDown size={12} /></button></th><th>Fatal / serious</th><th>Pedestrian / bicycle</th><th><span className="sr-only">Explore</span></th></tr></thead><tbody>{ready && tableRows.map(row => <tr key={row.school.id}><td><strong>{row.school.name}</strong>{!row.school.hasLinkedRecords && <small className="coverage-note">No linked records · coverage unverified</small>}</td><td>{row.school.level}</td><td>{row.school.hasLinkedRecords ? row.crashes.toLocaleString() : '—'}</td><td>{row.school.hasLinkedRecords ? row.fatalSerious.toLocaleString() : '—'}</td><td>{row.school.hasLinkedRecords ? row.pedBike.toLocaleString() : '—'}</td><td><button className="icon-button" onClick={() => selectSchool(row.school.id)} aria-label={`Filter to ${row.school.name}`}><ArrowRight size={15} /></button></td></tr>)}</tbody></table>{(!ready || tableRows.length === 0) && <p className="table-empty">{ready ? 'No schools match this search.' : 'School comparisons are unavailable in this release.'}</p>}</div><p className="chart-note">School counts overlap and must not be summed into a citywide total. A nearby crash does not establish school involvement. Enrollment and pedestrian exposure are unavailable.</p></section></>}
      {tab === 'phase2' && <Phase2Results />}
    </div>
  </main>;
}
