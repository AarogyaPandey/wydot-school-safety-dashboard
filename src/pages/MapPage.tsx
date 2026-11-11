import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Circle, CircleMarker, MapContainer, Marker, Pane, Popup, Rectangle, ScaleControl, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import { divIcon, svg, type LatLngExpression, type Map as LeafletMap } from 'leaflet';
import { renderToStaticMarkup } from 'react-dom/server';
import { ArrowUpRight, ChevronDown, Crosshair, Expand, Layers, MapPin, Mountain, MousePointer2, Pause, Play, RotateCcw, School as SchoolIcon, Search, SlidersHorizontal, SquareDashed, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useDashboard } from '../app/DashboardContext';
import { FilterDrawer, FilterSummary } from '../components/Filters';
import { DatasetNotice } from '../components/Status';
import { formatClock, formatDate, serializeFilters } from '../domain/filters';
import { flagsUnknown, isPedBike, severityGroup } from '../domain/selectors';
import { SEVERITY_GROUPS, SEVERITY_LABELS, type Bounds, type School } from '../domain/types';
import RemoteLayer from '../features/map/RemoteLayer';
import { BASEMAPS, type BasemapId } from '../features/map/basemaps';
import type { SchoolBufferCenter, SpeedLimitCategory } from '../features/map/speed-limits';
import { DismissibleDetails } from '../components/DismissibleDetails';

type LayerState = { schools: boolean; zones: boolean; crashes: boolean; hotspots: boolean; crosswalks: boolean; sidewalks: boolean; signals: boolean; speed: boolean; aadt: boolean; roads: boolean };
const INITIAL_LAYERS: LayerState = { schools: true, zones: true, crashes: true, hotspots: false, crosswalks: false, sidewalks: false, signals: false, speed: false, aadt: false, roads: false };
const INFRA_LAYERS = [{ id: 'crosswalks', label: 'Crosswalks', color: '#664b9f' }, { id: 'sidewalks', label: 'Sidewalks', color: '#4b8b58' }, { id: 'signals', label: 'Pedestrian signals', color: '#79559c' }, { id: 'speed', label: 'Posted speed limits', color: '#aa6d24' }, { id: 'aadt', label: 'Traffic volume · AADT', color: '#3585aa' }, { id: 'roads', label: 'Road classification', color: '#c99b43' }] as const;
const HOTSETS = [{ key: 'hot-all-recent', label: 'All crashes · 2016–2025' }, { key: 'hot-all-history', label: 'All crashes · 1994–2025' }, { key: 'hot-serious', label: 'Fatal / serious · 1994–2025' }, { key: 'hot-ped-bike', label: 'Pedestrian / bicycle · 2016–2025' }, { key: 'hot-school-day', label: 'School days · 2016–2025' }];
const schoolIcons = [false, true].map(selected => divIcon({ className: `school-marker-wrapper${selected ? ' is-selected' : ''}`, html: renderToStaticMarkup(<span className="school-map-marker"><SchoolIcon size={14} strokeWidth={1.8} aria-hidden="true" /></span>), iconSize: [22, 22], iconAnchor: [11, 11] }));
const schoolIcon = (selected: boolean) => schoolIcons[Number(selected)];
const crashPointRenderer = svg({ pane: 'crash-points' });

function MapBridge({ onMap }: { onMap: (map: LeafletMap) => void }) {
  const map = useMap(); const { selectedSchool, filters } = useDashboard();
  useEffect(() => { onMap(map); const observer = new ResizeObserver(() => map.invalidateSize()); observer.observe(map.getContainer()); return () => observer.disconnect(); }, [map, onMap]);
  useEffect(() => { if (selectedSchool) map.flyTo([selectedSchool.lat, selectedSchool.lon], filters.bufferFt === 1320 ? 14 : 15, { duration: 0.6 }); }, [selectedSchool, filters.bufferFt, map]);
  return null;
}
function BoxSelection({ active, onFinish, onCancel }: { active: boolean; onFinish: (b: Bounds) => void; onCancel: () => void }) {
  const [first, setFirst] = useState<{ lat: number; lng: number } | null>(null), [last, setLast] = useState<{ lat: number; lng: number } | null>(null);
  const map = useMapEvents({
    click(e) {
      if (!active) return;
      if (!first) { setFirst(e.latlng); setLast(e.latlng); }
      else { onFinish({ south: Math.min(first.lat, e.latlng.lat), north: Math.max(first.lat, e.latlng.lat), west: Math.min(first.lng, e.latlng.lng), east: Math.max(first.lng, e.latlng.lng) }); setFirst(null); setLast(null); }
    },
    mousemove(e) { if (active && first) setLast(e.latlng); },
  });
  useEffect(() => {
    const container = map.getContainer(); container.classList.toggle('selecting-area', active);
    if (!active) { setFirst(null); setLast(null); }
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') { onCancel(); setFirst(null); setLast(null); } };
    window.addEventListener('keydown', escape); return () => { container.classList.remove('selecting-area'); window.removeEventListener('keydown', escape); };
  }, [active, map, onCancel]);
  return first && last ? <Rectangle bounds={[[first.lat, first.lng], [last.lat, last.lng]]} pathOptions={{ color: '#493321', dashArray: '6 4', weight: 2, fillOpacity: 0.12 }} interactive={false} /> : null;
}
function SchoolPopup({ school }: { school: School }) {
  const { schoolCounts, state, selectSchool } = useDashboard();
  const counts = schoolCounts.find(r => r.school.id === school.id);
  const infra = state.data?.infrastructure.find(r => r.School === school.name);
  return <div className="feature-popup"><span className="eyebrow">{school.level}</span><h3>{school.name}</h3><p>{school.address}</p>{!school.hasLinkedRecords ? <p className="popup-warning">No linked records; study-area coverage needs verification.</p> : counts ? <p><strong>{counts.crashes.toLocaleString()}</strong> unique crashes under current filters</p> : <p>This school is outside the current school/level filter.</p>}{infra && <p className="muted">Mapped crosswalks: {String(infra.crosswalks ?? 'Unknown')} · pedestrian signals: {String(infra.pedestrian_signals ?? 'Unknown')}<br />State-route inventory; zero does not confirm absence.</p>}<button className="text-button" onClick={() => selectSchool(school.id)}>Select school <ArrowUpRight size={13} /></button></div>;
}
function SearchSchools() {
  const { state, selectSchool } = useDashboard();
  const [query, setQuery] = useState(''), [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const results = useMemo(() => query.trim().length < 2 ? [] : (state.data?.schools || []).filter(s => `${s.name} ${s.address}`.toLowerCase().includes(query.toLowerCase())).slice(0, 7), [query, state.data]);
  useEffect(() => { const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); }; document.addEventListener('mousedown', close); return () => document.removeEventListener('mousedown', close); }, []);
  const choose = (school: School) => { selectSchool(school.id); setQuery(''); setOpen(false); };
  return <div className="map-search" ref={ref}><Search size={17} /><input aria-label="Search schools or school addresses" placeholder="Search schools" value={query} disabled={state.status !== 'ready'} onFocus={() => setOpen(true)} onChange={e => { setQuery(e.target.value); setOpen(true); }} onKeyDown={e => { if (e.key === 'Escape') setOpen(false); if (e.key === 'Enter' && results.length) choose(results[0]); }} />{query && <button className="icon-button" onClick={() => { setQuery(''); setOpen(false); }} aria-label="Clear school search"><X size={14} /></button>}{open && query.trim().length >= 2 && <div className="search-results" aria-label="School search results">{results.length ? results.map(s => <button key={s.id} onClick={() => choose(s)}><MapPin size={15} /><span><strong>{s.name}</strong><small>{s.address}</small></span><ArrowUpRight size={13} /></button>) : <p>No matching school. Search uses the supplied school list.</p>}</div>}</div>;
}

export default function MapPage() {
  const { state, filters, updateFilters, resetFilters, selectedSchool, matches, summary, selectSchool } = useDashboard();
  const [layers, setLayers] = useState(INITIAL_LAYERS), [showLayers, setShowLayers] = useState(false), [showFilters, setShowFilters] = useState(false);
  const [hotset, setHotset] = useState('hot-all-recent'), [trafficYear, setTrafficYear] = useState(2025), [selecting, setSelecting] = useState(false);
  const [playing, setPlaying] = useState(false), [layerErrors, setLayerErrors] = useState<Record<string, string>>({}), [tileError, setTileError] = useState(false);
  const [map, setMap] = useState<LeafletMap | null>(null), [fullscreen, setFullscreen] = useState(false);
  const [speedCategories, setSpeedCategories] = useState<SpeedLimitCategory[] | null>(null);
  const [basemapId, setBasemapId] = useState<BasemapId>(() => {
    try { const saved = sessionStorage.getItem('school-safety-basemap'); return saved && saved in BASEMAPS ? saved as BasemapId : 'streets'; } catch { return 'streets'; }
  });
  const basemap = BASEMAPS[basemapId];
  const layerPanel = useRef<HTMLDivElement>(null), layerButton = useRef<HTMLButtonElement>(null);
  const playbackRange = useRef({ start: filters.startYear, end: filters.endYear });
  const ready = state.status === 'ready';
  const setMapRef = useCallback((value: LeafletMap) => setMap(value), []);
  const closeFilters = useCallback(() => setShowFilters(false), []);
  const cancelSelection = useCallback(() => setSelecting(false), []);
  const finishSelection = useCallback((b: Bounds) => { updateFilters({ bounds: b }); setSelecting(false); }, [updateFilters]);
  const layerStatus = useCallback((key: string, error: string | null) => setLayerErrors(previous => { const next = { ...previous }; if (error) next[key] = error; else delete next[key]; return next; }), []);
  const toggleLayer = (key: keyof LayerState) => setLayers(previous => ({ ...previous, [key]: !previous[key] }));
  const changeBasemap = (id: BasemapId) => {
    setTileError(false); setBasemapId(id);
    try { sessionStorage.setItem('school-safety-basemap', id); } catch { /* Session storage is optional. */ }
  };
  useEffect(() => {
    if (!showLayers) return;
    const outside = (event: PointerEvent) => { if (!layerPanel.current?.contains(event.target as Node) && !layerButton.current?.contains(event.target as Node)) setShowLayers(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setShowLayers(false); layerButton.current?.focus(); } };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [showLayers]);
  useEffect(() => { document.body.classList.add('map-page-open'); return () => document.body.classList.remove('map-page-open'); }, []);
  useEffect(() => { if (!playing) return; const timer = window.setInterval(() => {
    const next = filters.endYear + 1;
    if (next > playbackRange.current.end) { setPlaying(false); updateFilters({ startYear: playbackRange.current.start, endYear: playbackRange.current.end }); }
    else updateFilters({ startYear: next, endYear: next });
  }, 1400); return () => window.clearInterval(timer); }, [playing, filters.endYear, updateFilters]);
  const startPlayback = () => {
    if (playing) { setPlaying(false); updateFilters({ startYear: playbackRange.current.start, endYear: playbackRange.current.end }); return; }
    const start = filters.startYear, end = filters.endYear;
    playbackRange.current = { start, end: start === end ? Math.max(start, state.data?.metadata.completeThrough || 2025) : end };
    updateFilters({ startYear: start, endYear: start }); setPlaying(true);
  };
  const fitSchools = () => { selectSchool('all'); const points = (state.data?.schools || []).map(s => [s.lat, s.lon] as [number, number]); if (points.length) map?.fitBounds(points, { padding: [50, 70] }); else map?.setView([41.14, -104.80], 13); };
  const resetMap = () => { setPlaying(false); setSelecting(false); map?.stop(); fitSchools(); resetFilters(); };
  const fullscreenMap = () => { setFullscreen(value => !value); window.setTimeout(() => map?.invalidateSize(), 30); };
  const visibleSchools = state.data?.schools.filter(s => filters.level === 'all' || filters.level === s.level) || [];
  const schoolBufferCenters = useMemo<SchoolBufferCenter[]>(
    () => (state.data?.schools || [])
      .filter(s => filters.level === 'all' || s.level === filters.level)
      .map(s => [s.lon, s.lat]),
    [state.data?.schools, filters.level],
  );
  const hasFilters = serializeFilters(filters) !== '';
  return <main id="main-content" className={`map-page${fullscreen ? ' map-expanded' : ''}`}>
    <h1 className="sr-only">Map</h1>
    <MapContainer center={[41.145, -104.80]} zoom={13} zoomControl={false} preferCanvas={true} className="leaflet-map" aria-label="Cheyenne school safety map">
      <TileLayer key={basemapId} url={basemap.url} attribution={basemap.attribution} maxNativeZoom={basemap.maxNativeZoom} maxZoom={19} eventHandlers={{ tileerror: () => setTileError(true), tileload: () => setTileError(false) }} />
      <ScaleControl position="bottomleft" imperial={true} metric={false} />
      <MapBridge onMap={setMapRef} />
      <BoxSelection active={selecting} onFinish={finishSelection} onCancel={cancelSelection} />
      {filters.bounds && <Rectangle bounds={[[filters.bounds.south, filters.bounds.west], [filters.bounds.north, filters.bounds.east]]} pathOptions={{ color: '#806345', weight: 2, dashArray: '5 4', fillOpacity: 0.025 }} interactive={false} />}
      {ready && <>
        <Pane name="school-zones" style={{ zIndex: 410 }}>{layers.zones && visibleSchools.map(s => <Circle key={s.id} center={[s.lat, s.lon]} radius={filters.bufferFt * 0.3048006096012192} pathOptions={{ color: selectedSchool?.id === s.id ? '#996d20' : '#9c824f', weight: selectedSchool?.id === s.id ? 2 : 1.2, dashArray: '5 5', fillOpacity: 0.055 }} interactive={false} />)}</Pane>
        {INFRA_LAYERS.filter(l => l.id !== 'speed' && layers[l.id]).map(l => <RemoteLayer key={l.id} layerKey={l.id} trafficYear={trafficYear} onStatus={layerStatus} />)}
        <Pane name="speed-limits" style={{ zIndex: 420 }}>{layers.speed && <RemoteLayer layerKey="speed" trafficYear={trafficYear} onStatus={layerStatus} onSpeedCategories={setSpeedCategories} schoolBufferCenters={schoolBufferCenters} schoolBufferFt={filters.bufferFt} />}</Pane>
        {layers.hotspots && <RemoteLayer layerKey={hotset} trafficYear={trafficYear} onStatus={layerStatus} />}
        <Pane name="crash-points" style={{ zIndex: 440 }}>{layers.crashes && [...matches].sort((a, b) => Number(severityGroup(a.crash.severity) === 'fatal-serious') - Number(severityGroup(b.crash.severity) === 'fatal-serious')).map(({ crash, links }) => {
          const serious = severityGroup(crash.severity) === 'fatal-serious', color = SEVERITY_GROUPS.find(s => s.id === severityGroup(crash.severity))!.color;
          const nearest = links.reduce((a, b) => a.distanceFt <= b.distanceFt ? a : b);
          const school = state.data!.schools.find(s => s.id === nearest.schoolId)!;
          return <CircleMarker key={crash.id} center={[crash.lat, crash.lon]} radius={serious ? 5.5 : 4} renderer={crashPointRenderer} pathOptions={{ color: '#352f29', weight: isPedBike(crash) ? 1.5 : 1.25, fillColor: color, fillOpacity: 0.95 }}><Tooltip>{SEVERITY_LABELS[crash.severity]} · {crash.year}</Tooltip><Popup><div className="feature-popup"><h3>{SEVERITY_LABELS[crash.severity]}</h3><p>{formatDate(crash.date)} · {formatClock(crash.hhmm)} local time</p><p>{nearest.distanceFt.toLocaleString()} ft from {school.name}</p><p>{isPedBike(crash) ? `Involvement: ${crash.pedestrian ? 'pedestrian' : ''}${crash.pedestrian && crash.cyclist ? ' and ' : ''}${crash.cyclist ? 'bicycle' : ''}` : flagsUnknown(crash) ? 'Pedestrian/bicycle involvement unknown' : 'No pedestrian/bicycle involvement recorded'}</p><p className="muted">{nearest.window} · Assumed calendar and bell times.</p></div></Popup></CircleMarker>;
        })}</Pane>
        {layers.schools && visibleSchools.map(s => <Marker key={s.id} position={[s.lat, s.lon] as LatLngExpression} icon={schoolIcon(selectedSchool?.id === s.id)} opacity={selectedSchool && selectedSchool.id !== s.id ? 0.55 : 1}><Tooltip direction="top" offset={[0, -12]}>{s.name}</Tooltip><Popup><SchoolPopup school={s} /></Popup></Marker>)}
      </>}
    </MapContainer>
    <div className="map-top-controls">
      <button className={`button filter-toggle${showFilters ? ' active' : ''}`} aria-label="Filters" aria-expanded={showFilters} aria-controls="dashboard-filters" onClick={() => { setShowFilters(value => !value); setShowLayers(false); }}><SlidersHorizontal size={14} /><span>Filters</span></button>
      <SearchSchools />
      <div className="map-count" title="Unique school-linked crashes under the current filters" aria-live="polite"><strong data-testid="unique-crash-count">{ready ? summary.total.toLocaleString() : '—'}</strong><span>crashes</span></div>
      <button className="button reset-control" aria-label="Reset map and filters" title="Reset map and filters" onClick={resetMap}><RotateCcw size={14} /><span>Reset</span></button>
      <button ref={layerButton} className={`button layer-button${showLayers ? ' active' : ''}`} aria-label="Layers" aria-expanded={showLayers} aria-controls="map-layers" onClick={() => { setShowLayers(value => !value); setShowFilters(false); }}><Layers size={14} /><span>Layers</span><ChevronDown size={12} /></button>
    </div>
    <FilterDrawer open={showFilters} onClose={closeFilters} />
    {hasFilters && !showFilters && <div className="map-filter-summary"><FilterSummary /></div>}
    <div className={`map-notice${hasFilters && !showFilters ? ' with-filters' : ''}`}><DatasetNotice compact /></div>
    {showLayers && <div ref={layerPanel} id="map-layers" className="layer-panel"><div className="layer-panel-title"><strong>Layers</strong><button className="icon-button" aria-label="Close map layers" onClick={() => setShowLayers(false)}><X size={15} /></button></div>
      <fieldset className="basemap-options"><legend className="field-eyebrow"><Mountain size={13} />Basemap</legend>{(Object.entries(BASEMAPS) as [BasemapId, typeof basemap][]).map(([id, item]) => <label className={`basemap-option${id === basemapId ? ' selected' : ''}`} key={id}><input type="radio" name="basemap" value={id} checked={id === basemapId} onChange={() => changeBasemap(id)} /><span><strong>{item.label}</strong><small>{item.description}</small></span></label>)}</fieldset>
      <fieldset disabled={!ready}>
      <span className="field-eyebrow">Schools and crashes</span>{([{ id: 'schools', label: 'School locations' }, { id: 'zones', label: 'Proximity buffers' }, { id: 'crashes', label: 'Crash points' }, { id: 'hotspots', label: 'Statistical hotspots · Gi*' }] as const).map(l => <label className="checkbox-row" key={l.id}><input type="checkbox" checked={layers[l.id]} onChange={() => toggleLayer(l.id)} /><span>{l.label}</span></label>)}
      {layers.hotspots && <><label className="sr-only" htmlFor="hotspot-set">Hotspot analysis population</label><select id="hotspot-set" value={hotset} onChange={e => setHotset(e.target.value)}>{HOTSETS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}</select><p className="field-note">Fixed analysis; crash filters do not apply.</p></>}
      <span className="field-eyebrow layer-section-title">Roads and facilities</span>{INFRA_LAYERS.map(l => <label className="checkbox-row" key={l.id}><input type="checkbox" checked={layers[l.id]} onChange={() => toggleLayer(l.id)} /><i className="layer-swatch" style={{ background: l.color }} /><span>{l.label}</span></label>)}
      {layers.aadt && <label className="field-label" htmlFor="traffic-year">AADT observation year<select aria-label="AADT observation year" id="traffic-year" value={trafficYear} onChange={e => setTrafficYear(Number(e.target.value))}>{[2021, 2022, 2023, 2024, 2025].map(y => <option key={y}>{y}</option>)}</select></label>}
    </fieldset><p className="field-note">Infrastructure coverage is incomplete.</p></div>}
    <div className="map-tools" role="group" aria-label="Map tools"><button className="icon-button" aria-label="Zoom in" title="Zoom in" onClick={() => map?.zoomIn()}><ZoomIn size={16} /></button><button className="icon-button" aria-label="Zoom out" title="Zoom out" onClick={() => map?.zoomOut()}><ZoomOut size={16} /></button><span className="tool-divider" /><button className="icon-button" aria-label="Fit all school locations" title="Fit schools" onClick={fitSchools}><Crosshair size={16} /></button><button className={`icon-button${selecting ? ' active' : ''}`} disabled={!ready} aria-label="Select a map area" title="Select area" aria-pressed={selecting} onClick={() => { setSelecting(value => !value); setShowFilters(false); setShowLayers(false); }}><SquareDashed size={16} /></button><button className="icon-button" aria-label={fullscreen ? 'Exit expanded map' : 'Expand map'} title={fullscreen ? 'Exit expanded map' : 'Expand map'} onClick={fullscreenMap}><Expand size={15} /></button></div>
    {selecting && <div className="selection-hint" role="status"><MousePointer2 size={13} />Select two corners · Esc to cancel<button className="icon-button" onClick={cancelSelection} aria-label="Cancel area selection"><X size={13} /></button></div>}
    <div className="map-legend-stack">
      <DismissibleDetails className="map-legend"><summary>Legend<ChevronDown size={12} /></summary><div>{layers.schools && <span><i className="legend-school" />School</span>}{layers.zones && <span><i className="legend-zone" />{filters.bufferFt.toLocaleString()} ft buffer</span>}{layers.crashes && SEVERITY_GROUPS.map(s => <span key={s.id}><i style={{ background: s.color }} />{s.label}</span>)}{layers.crashes && <span><i className="legend-ring" />Pedestrian / bicycle</span>}{layers.hotspots && <><span><i className="legend-hot" />Significant hot cell</span><span className="legend-note">Fixed population · adjusted p &lt; 0.05</span></>}{INFRA_LAYERS.filter(l => l.id !== 'speed' && layers[l.id]).map(l => <span key={l.id}><i style={{ background: l.color, borderRadius: 2 }} />{l.label}</span>)}{layers.aadt && <span className="legend-note">Darker / wider = higher AADT · {trafficYear}</span>}</div></DismissibleDetails>
      {layers.speed && <DismissibleDetails className="map-legend"><summary>Speed limits<ChevronDown size={12} /></summary><div>{speedCategories === null ? <span className="legend-note">Loading speed limits…</span> : speedCategories.length ? speedCategories.map(category => <span key={category.label}><i className={`legend-speed-limit${category.schoolZoneAssumption ? ' school-zone-assumption' : ''}`} style={category.schoolZoneAssumption ? { borderTop: `3px dashed ${category.color}` } : { background: category.color }} />{category.label}</span>) : <span className="legend-note">No speed-limit values available.</span>}<span className="legend-note">WYDOT and Laramie County GIS Cooperative inventories; coverage is incomplete. County value 0 is unspecified, not 0 mph.</span><span className="legend-note">20 mph is an analysis assumption within the selected-distance buffers around displayed schools, not verified posted signage. Popups retain the source value.</span></div></DismissibleDetails>}
    </div>
    {Object.keys(layerErrors).length > 0 && <div className="layer-error" role="alert">Layer unavailable. Toggle it to retry.</div>}
    {tileError && <div className="tile-error" role="status">Basemap unavailable.</div>}
    <div className="timeline"><button className={`play-button${playing ? ' playing' : ''}`} disabled={!ready} aria-label={playing ? 'Stop year playback' : 'Play years'} onClick={startPlayback}>{playing ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}</button><div className="timeline-label"><strong>{filters.startYear === filters.endYear ? filters.startYear : `${filters.startYear}–${filters.endYear}`}{filters.endYear === 2026 ? '*' : ''}</strong></div><div className="timeline-sliders"><label className="sr-only" htmlFor="timeline-start">Timeline start year</label><input id="timeline-start" type="range" min="1994" max="2026" value={filters.startYear} disabled={!ready || playing} onChange={e => updateFilters(current => ({ startYear: Math.min(Number(e.target.value), current.endYear) }))} /><label className="sr-only" htmlFor="timeline-end">Timeline end year</label><input id="timeline-end" type="range" min="1994" max="2026" value={filters.endYear} disabled={!ready || playing} onChange={e => updateFilters(current => ({ endYear: Math.max(Number(e.target.value), current.startYear) }))} /><div className="timeline-ticks"><span>1994</span><span>2026*</span></div></div></div>
  </main>;
}
