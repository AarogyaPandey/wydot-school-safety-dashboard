import { useEffect, useRef } from 'react';
import { ChevronDown, SlidersHorizontal, X } from 'lucide-react';
import { useDashboard } from '../app/DashboardContext';
import { SCHOOL_LEVELS, SEVERITY_GROUPS, TIME_LABELS, type Filters as FilterValues } from '../domain/types';

export function FilterPanel({ onClose }: { onClose?: () => void }) {
  const { state, filters, updateFilters } = useDashboard();
  const unavailable = state.status !== 'ready';
  return <aside className="filter-panel" aria-label="Shared dashboard filters">
    <div className="filter-header"><h2><SlidersHorizontal size={15} />Filters</h2>{onClose && <button className="icon-button" onClick={onClose} aria-label="Close filters"><X size={16} /></button>}</div>
    <fieldset disabled={unavailable} className="filter-fields">
      <div className="filter-section"><span className="field-eyebrow">Location</span>
        <label className="field-label" htmlFor="school-filter">School</label>
        <div className="select-wrap"><select id="school-filter" value={filters.schoolId} onChange={e => updateFilters({ schoolId: e.target.value, level: 'all' })}><option value="all">All schools</option>{state.data?.schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select><ChevronDown size={15} /></div>
        <label className="field-label" htmlFor="level-filter">School level</label>
        <div className="select-wrap"><select id="level-filter" value={filters.level} onChange={e => updateFilters({ level: e.target.value as FilterValues['level'], schoolId: 'all' })}><option value="all">All levels</option>{SCHOOL_LEVELS.map(level => <option key={level}>{level}</option>)}</select><ChevronDown size={15} /></div>
        <span className="field-label" id="buffer-label">Distance from school</span>
        <div className="segmented" role="group" aria-labelledby="buffer-label">{([500, 1000, 1320] as const).map(buffer => <button type="button" key={buffer} aria-pressed={filters.bufferFt === buffer} className={filters.bufferFt === buffer ? 'selected' : ''} onClick={() => updateFilters({ bufferFt: buffer })}>{buffer === 1320 ? '¼ mile' : `${buffer.toLocaleString()} ft`}</button>)}</div>
        <p className="field-note">Proximity buffers; not regulatory zone boundaries.</p>
      </div>
      <div className="filter-section"><span className="field-eyebrow">Time</span>
        <div className="year-inputs"><label className="field-label" htmlFor="start-year">From<select aria-label="From year" id="start-year" value={filters.startYear} onChange={e => updateFilters(current => ({ startYear: Number(e.target.value), endYear: Math.max(Number(e.target.value), current.endYear) }))}>{Array.from({ length: 33 }, (_, i) => 1994 + i).map(y => <option key={y} value={y}>{y}{y === 2026 ? ' · partial' : ''}</option>)}</select></label>
          <span aria-hidden="true">—</span><label className="field-label" htmlFor="end-year">Through<select aria-label="Through year" id="end-year" value={filters.endYear} onChange={e => updateFilters(current => ({ endYear: Number(e.target.value), startYear: Math.min(Number(e.target.value), current.startYear) }))}>{Array.from({ length: 33 }, (_, i) => 1994 + i).map(y => <option key={y} value={y}>{y}{y === 2026 ? ' · partial' : ''}</option>)}</select></label></div>
        <label className="field-label" htmlFor="time-filter">Time of day</label><div className="select-wrap"><select id="time-filter" value={filters.time} onChange={e => updateFilters({ time: e.target.value as FilterValues['time'] })}>{Object.entries(TIME_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><ChevronDown size={15} /></div>
        <label className="checkbox-row"><input type="checkbox" checked={filters.schoolDays} onChange={e => updateFilters({ schoolDays: e.target.checked })} /><span>School days only<span className="checkbox-detail">Mon–Fri · Aug 20–May 25*</span></span></label>
        <p className="field-note">*Assumed schedule; holidays not excluded.</p>
      </div>
      <div className="filter-section"><span className="field-eyebrow">Crashes</span>
        <span className="field-label">Severity</span>{SEVERITY_GROUPS.map(s => <label className="checkbox-row severity-row" key={s.id}><input type="checkbox" checked={filters.severities.includes(s.id)} onChange={e => updateFilters(current => ({ severities: e.target.checked ? [...new Set([...current.severities, s.id])] : current.severities.filter(v => v !== s.id) }))} /><i style={{ background: s.color }} /><span>{s.label}</span></label>)}
        <label className="field-label" htmlFor="involvement-filter">Road user involvement</label><div className="select-wrap"><select id="involvement-filter" value={filters.involvement} onChange={e => updateFilters({ involvement: e.target.value as FilterValues['involvement'] })}><option value="all">All crashes</option><option value="ped-bike">Pedestrian or bicycle</option><option value="pedestrian">Pedestrian</option><option value="cyclist">Bicycle</option><option value="unknown">Unknown involvement</option></select><ChevronDown size={15} /></div>
      </div>
    </fieldset>
  </aside>;
}
export function FilterDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    panel.current?.focus({ preventScroll: true });
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); onClose(); } };
    window.addEventListener('keydown', escape);
    return () => { window.removeEventListener('keydown', escape); if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true }); };
  }, [open, onClose]);
  if (!open) return null;
  return <div id="dashboard-filters" ref={panel} className="filter-drawer" role="dialog" aria-label="Filters" tabIndex={-1}><FilterPanel onClose={onClose} /></div>;
}
export function FilterSummary() {
  const { filters, selectedSchool, updateFilters } = useDashboard();
  return <div className="filter-summary" aria-label="Active filters"><span className="scope-chip"><span className="status-dot" />{selectedSchool?.name || (filters.schoolId === 'all' ? 'All schools' : 'School unavailable')}</span><span>{filters.startYear}–{filters.endYear}{filters.endYear === 2026 ? '*' : ''}</span><span>{filters.bufferFt.toLocaleString()} ft</span>{filters.schoolDays && <span>School days*</span>}{filters.time !== 'all' && <span>{TIME_LABELS[filters.time]}</span>}{filters.bounds && <button className="removable-chip" onClick={() => updateFilters({ bounds: null })}>Selected map area<X size={12} /></button>}</div>;
}
