import { useId, useRef, useState } from 'react';
import { Layers, Trash2, Upload, X } from 'lucide-react';
import { useDashboard } from '../../app/DashboardContext';
import { DismissibleDetails } from '../../components/DismissibleDetails';
import { MAX_FEATURES, MAX_FILE_BYTES, MAX_LAYERS, MAX_TOTAL_BYTES, parseGeoJson, UPLOAD_COLORS, type UploadedLayer } from './data';

export function UploadedLayerList() {
  const { uploads, usingUploads, setDataSource, toggleUpload, removeUpload, clearUploads } = useDashboard();
  const sourceId = useId();
  if (!uploads.length) return null;
  return <section className="uploaded-layer-list" aria-label="Uploaded layers">
    <div className="upload-source" role="group" aria-label="Data source">
      <label><input type="radio" name={sourceId} checked={!usingUploads} onChange={() => setDataSource('project')} />Project data</label>
      <label><input type="radio" name={sourceId} checked={usingUploads} onChange={() => setDataSource('uploads')} />Uploaded files</label>
    </div>
    <div className="upload-list-heading"><strong>Uploaded layers</strong><button className="text-button" onClick={clearUploads}>Clear all</button></div>
    {uploads.map(layer => <div className="upload-layer-row" key={layer.id}>
      <i className="upload-layer-color" style={{ background: layer.color }} />
      <span className="upload-layer-name"><strong title={layer.name}>{layer.name}</strong><small>{layer.data.features.length.toLocaleString()} features</small></span>
      <button className="layer-switch" role="switch" aria-checked={layer.enabled} aria-label={`Use ${layer.name}`} title={layer.enabled ? 'Turn layer off' : 'Turn layer on'} onClick={() => { toggleUpload(layer.id); setDataSource('uploads'); }}><span /></button>
      <button className="icon-button" aria-label={`Remove ${layer.name}`} title="Remove layer" onClick={() => removeUpload(layer.id)}><Trash2 size={13} /></button>
    </div>)}
    <p className="field-note">Switches update the map and charts. Files stay in this tab and clear on refresh.</p>
  </section>;
}

export default function UploadControl() {
  const { uploads, addUploads, updateFilters } = useDashboard();
  const input = useRef<HTMLInputElement>(null), busyRef = useRef(false);
  const [busy, setBusy] = useState(false), [errors, setErrors] = useState<string[]>([]);
  const readFiles = async (files: File[]) => {
    if (!files.length || busyRef.current) return;
    busyRef.current = true; setBusy(true); setErrors([]);
    const accepted: UploadedLayer[] = [], messages: string[] = [];
    const names = new Set(uploads.map(l => l.name));
    let bytes = uploads.reduce((n, l) => n + l.bytes, 0), features = uploads.reduce((n, l) => n + l.data.features.length, 0);
    try {
      for (const file of files) {
        try {
          if (uploads.length + accepted.length >= MAX_LAYERS) throw new Error(`Use up to ${MAX_LAYERS} layers at a time.`);
          if (!/\.(geojson|json)$/i.test(file.name)) throw new Error('Choose a .geojson or .json file.');
          if (file.size > MAX_FILE_BYTES) throw new Error('This file exceeds the 10 MB limit.');
          if (bytes + file.size > MAX_TOTAL_BYTES) throw new Error('The workspace limit is 30 MB. Remove a layer first.');
          const data = parseGeoJson(await file.text());
          if (features + data.features.length > MAX_FEATURES) throw new Error(`The workspace limit is ${MAX_FEATURES.toLocaleString()} features. Remove a layer first.`);
          let name = file.name, suffix = 2;
          while (names.has(name)) name = file.name.replace(/(\.(?:geojson|json))$/i, ` (${suffix++})$1`);
          names.add(name);
          const usedColors = [...uploads, ...accepted].map(l => l.color);
          const color = UPLOAD_COLORS.find(c => !usedColors.includes(c)) || UPLOAD_COLORS[(uploads.length + accepted.length) % UPLOAD_COLORS.length];
          accepted.push({ id: crypto.randomUUID(), name, bytes: file.size, color, enabled: true, data });
          bytes += file.size; features += data.features.length;
        } catch (error) { messages.push(`${file.name}: ${error instanceof Error ? error.message : 'Could not read this file.'}`); }
      }
      if (accepted.length) {
        addUploads(accepted);
        // A previous map-area query may be unrelated to the incoming files.
        updateFilters({ bounds: null });
      }
      setErrors(messages);
    } finally { busyRef.current = false; setBusy(false); if (input.current) input.current.value = ''; }
  };
  return <div className="upload-control">
    <input ref={input} type="file" accept=".geojson,.json,application/geo+json,application/json" multiple className="sr-only" tabIndex={-1} aria-label="GeoJSON files" onChange={event => void readFiles(Array.from(event.target.files || []))} />
    <button className="button" onClick={() => input.current?.click()} disabled={busy} aria-label="Upload GeoJSON" title="Upload GeoJSON · up to 10 MB per file">{busy ? <span className="spinner" /> : <Upload size={14} />}<span>{busy ? 'Reading…' : 'Upload'}</span></button>
    {uploads.length > 0 && <DismissibleDetails className="upload-menu"><summary className="button" aria-label="Manage uploaded layers"><Layers size={14} /><span>Data</span><small>{uploads.length}</small></summary><div className="upload-menu-panel"><UploadedLayerList /></div></DismissibleDetails>}
    {errors.length > 0 && <div className="upload-message" role="alert"><button className="icon-button" aria-label="Dismiss upload errors" onClick={() => setErrors([])}><X size={14} /></button>{errors.map((error, i) => <p key={i}>{error}</p>)}</div>}
  </div>;
}
