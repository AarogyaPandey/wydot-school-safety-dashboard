import { SlidersHorizontal, X } from 'lucide-react';
import { useMemo } from 'react';
import { useDashboard } from '../../app/DashboardContext';
import { propertyValue, scalarValue } from './data';

export default function UploadedFilters({ onClose }: { onClose?: () => void }) {
  const { uploads, uploadFields, uploadSettings: settings, updateUploadSettings: update } = useDashboard();
  const values = useMemo(() => [...new Set(uploads.flatMap(l => l.data.features.map(f => scalarValue(propertyValue(f, settings.categoryField)))).filter((v): v is string => v !== null))].sort(), [uploads, settings.categoryField]);
  const visibleValues = values.filter(v => v !== '').slice(0, 500);
  if (settings.categoryValue && !visibleValues.includes(settings.categoryValue)) visibleValues.unshift(settings.categoryValue);
  return <aside className="filter-panel" aria-label="Uploaded data filters"><div className="filter-header"><h2><SlidersHorizontal size={15} />Filters</h2>{onClose && <button className="icon-button" onClick={onClose} aria-label="Close filters"><X size={16} /></button>}</div>
    <div className="filter-section"><span className="field-eyebrow">Attributes</span>
      <label className="field-label" htmlFor="upload-category">Category field</label><select id="upload-category" value={settings.categoryField} onChange={e => update({ categoryField: e.target.value, categoryValue: '' })}><option value="">None</option>{uploadFields.category.map(f => <option key={f}>{f}</option>)}</select>
      <label className="field-label" htmlFor="upload-category-value">Category value</label><select id="upload-category-value" disabled={!settings.categoryField} value={settings.categoryValue} onChange={e => update({ categoryValue: e.target.value })}><option value="">All values</option>{visibleValues.map(v => <option key={v}>{v}</option>)}</select>
      {values.length > 500 && <p className="field-note">First 500 values listed. Choose a field with fewer distinct values.</p>}
      <label className="field-label" htmlFor="upload-number">Numeric field</label><select id="upload-number" value={settings.valueField} onChange={e => update({ valueField: e.target.value })}><option value="">None</option>{uploadFields.numeric.map(f => <option key={f}>{f}</option>)}</select>
    </div>
    <div className="filter-section"><span className="field-eyebrow">Dates</span>
      <label className="field-label" htmlFor="upload-date-field">Date field</label><select id="upload-date-field" value={settings.dateField} onChange={e => update({ dateField: e.target.value, fromDate: '', toDate: '' })}><option value="">None</option>{uploadFields.date.map(f => <option key={f}>{f}</option>)}</select>
      <label className="field-label" htmlFor="upload-date-from">From date</label><input id="upload-date-from" type="date" disabled={!settings.dateField} max={settings.toDate || undefined} value={settings.fromDate} onChange={e => update({ fromDate: e.target.value })} />
      <label className="field-label" htmlFor="upload-date-to">Through date</label><input id="upload-date-to" type="date" disabled={!settings.dateField} min={settings.fromDate || undefined} value={settings.toDate} onChange={e => update({ toDate: e.target.value })} />
      <p className="field-note">ISO dates (YYYY-MM-DD). Stored calendar dates are preserved without timezone conversion.</p>
    </div>
    <p className="field-note">The map-area tool also filters uploaded features. Lines and polygons use bounding-box overlap.</p>
  </aside>;
}
