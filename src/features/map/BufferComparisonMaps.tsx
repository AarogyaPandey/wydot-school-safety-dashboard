import { useCallback, useEffect, useMemo, useState } from 'react';
import { Circle, CircleMarker, MapContainer, ScaleControl, TileLayer, Tooltip, useMapEvents } from 'react-leaflet';
import { SEVERITY_LABELS, type ResearchDataset, type School } from '../../domain/types';
import { selectStoryCompleteYears, selectStorySchoolCrashes } from '../../domain/selectors';
import { BASEMAPS } from './basemaps';

const BUFFER_OPTIONS = [
  { feet: 500, label: '500 ft' },
  { feet: 1000, label: '1,000 ft' },
  { feet: 1320, label: '¼ mile · 1,320 ft' },
];
type MapView = { center: [number, number]; zoom: number };

function SynchronizedView({ view, onViewChange }: { view: MapView; onViewChange: (view: MapView) => void }) {
  const map = useMapEvents({
    moveend: () => {
      const center = map.getCenter();
      onViewChange({ center: [center.lat, center.lng], zoom: map.getZoom() });
    },
    zoomend: () => {
      const center = map.getCenter();
      onViewChange({ center: [center.lat, center.lng], zoom: map.getZoom() });
    },
  });
  useEffect(() => {
    const center = map.getCenter();
    if (Math.abs(center.lat - view.center[0]) > 0.00001
      || Math.abs(center.lng - view.center[1]) > 0.00001
      || Math.abs(map.getZoom() - view.zoom) > 0.01) {
      map.setView(view.center, view.zoom, { animate: false });
    }
  }, [map, view]);
  return null;
}

export default function BufferComparisonMaps({ data }: { data: ResearchDataset }) {
  const { schools } = data;
  const initialSchool = schools.find(school => school.hasLinkedRecords) || schools[0];
  const [schoolId, setSchoolId] = useState(initialSchool?.id || '');
  const [year, setYear] = useState<number | 'all'>('all');
  const [view, setView] = useState<MapView>(() => ({ center: initialSchool ? [initialSchool.lat, initialSchool.lon] : [41.145, -104.8], zoom: 15 }));
  const selectedSchool = schools.find(school => school.id === schoolId) || initialSchool;
  const years = useMemo(() => selectStoryCompleteYears(data), [data]);
  const crashesByBuffer = useMemo(
    () => selectedSchool ? BUFFER_OPTIONS.map(({ feet }) => selectStorySchoolCrashes(data, year, feet, selectedSchool.id)) : [],
    [data, year, selectedSchool?.id],
  );
  const updateView = useCallback((next: MapView) => setView(current => {
    if (Math.abs(current.center[0] - next.center[0]) < 0.00001
      && Math.abs(current.center[1] - next.center[1]) < 0.00001
      && Math.abs(current.zoom - next.zoom) < 0.01) return current;
    return next;
  }), []);

  useEffect(() => {
    if (selectedSchool) setView({ center: [selectedSchool.lat, selectedSchool.lon], zoom: 15 });
  }, [selectedSchool?.id]);

  return <div className="buffer-comparison">
    <div className="buffer-comparison-controls">
      <div className="buffer-map-control-group">
        <label htmlFor="buffer-comparison-school">Compare buffers around</label>
        <select id="buffer-comparison-school" value={selectedSchool?.id || ''} onChange={event => setSchoolId(event.target.value)}>
          {schools.map(school => <option key={school.id} value={school.id}>{school.name}{school.hasLinkedRecords ? '' : ' · coverage unverified'}</option>)}
        </select>
      </div>
      <div className="buffer-map-control-group">
        <label htmlFor="buffer-comparison-year">Crash year on maps</label>
        <select id="buffer-comparison-year" value={year} onChange={event => setYear(event.target.value === 'all' ? 'all' : Number(event.target.value))}>
          <option value="all">All complete years ({data.metadata.firstYear}–{data.metadata.completeThrough})</option>
          {years.map(value => <option key={value} value={value}>{value}</option>)}
        </select>
      </div>
      {selectedSchool && !selectedSchool.hasLinkedRecords && <span className="buffer-coverage-note">Crash-link coverage for this school is unverified.</span>}
    </div>
    <div className="buffer-map-grid">
      {BUFFER_OPTIONS.map(({ feet, label }, index) => <article className="buffer-map-card" key={feet}>
        <header><h3>{label} buffer</h3><span>{(crashesByBuffer[index] || []).length.toLocaleString()} crash points</span></header>
        <MapContainer center={view.center} zoom={view.zoom} zoomControl={true} scrollWheelZoom={false} preferCanvas={true} className="buffer-comparison-map" aria-label={`${label} school proximity buffer map`}>
          <TileLayer url={BASEMAPS.streets.url} attribution={BASEMAPS.streets.attribution} className="subdued-basemap" opacity={0.7} maxNativeZoom={BASEMAPS.streets.maxNativeZoom} maxZoom={19} />
          <ScaleControl position="bottomleft" imperial={true} metric={false} />
          <SynchronizedView view={view} onViewChange={updateView} />
          {selectedSchool && <>
            <Circle center={[selectedSchool.lat, selectedSchool.lon]} radius={feet * 0.3048006096012192} pathOptions={{ color: '#b08a38', weight: 2, opacity: 0.9, dashArray: '5 4', fillColor: '#dfb956', fillOpacity: 0.12 }} interactive={false} />
            {(crashesByBuffer[index] || []).map(crash => <CircleMarker key={crash.id} center={[crash.lat, crash.lon]} radius={3.5} pathOptions={{ color: '#ffffff', weight: 1, fillColor: '#b3533e', fillOpacity: 0.9 }}>
              <Tooltip>{crash.year} · {SEVERITY_LABELS[crash.severity]}</Tooltip>
            </CircleMarker>)}
            <CircleMarker center={[selectedSchool.lat, selectedSchool.lon]} radius={7} pathOptions={{ color: '#ffffff', weight: 2, fillColor: '#554530', fillOpacity: 1 }}>
              <Tooltip direction="top">{selectedSchool.name}</Tooltip>
            </CircleMarker>
          </>}
        </MapContainer>
        <div className="buffer-map-legend"><span><i className="buffer-map-school-key" />Selected school</span><span><i className="buffer-map-zone-key" />Buffer boundary</span><span><i className="buffer-map-crash-key" />Crash location</span></div>
      </article>)}
    </div>
    <p className="buffer-comparison-note">Each map uses the same school location, zoom, and basemap; pan or zoom any map to move all three together. Crash points are distinct school-linked records for the map year selected above, shown only inside that map’s selected radius. This map year filter is independent of the crash chart. The dashed circle is a straight-line proximity radius, not a legal school-zone boundary.</p>
  </div>;
}
