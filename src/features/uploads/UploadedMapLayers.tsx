import { useEffect, useMemo, useRef } from 'react';
import { GeoJSON } from 'react-leaflet';
import { circleMarker, type GeoJSON as LeafletGeoJSON, type Layer } from 'leaflet';
import { useDashboard } from '../../app/DashboardContext';
import type { UploadedLayer, UploadedFeature as Feature, UploadedCollection as FeatureCollection } from './data';

function bindPopup(feature: Feature, leafletLayer: Layer, filename: string) {
  const node = document.createElement('div'), title = document.createElement('strong'); title.textContent = filename; node.append(title);
  const entries = Object.entries(feature.properties || {});
  for (const [key, value] of entries.slice(0, 20)) {
    const row = document.createElement('p'), label = document.createElement('b'); label.textContent = `${key}: `;
    const text = value === null ? 'Not recorded' : typeof value === 'object' ? JSON.stringify(value) : String(value);
    row.append(label, document.createTextNode(text.length > 300 ? text.slice(0, 300) + '…' : text)); node.append(row);
  }
  if (!entries.length) { const row = document.createElement('p'); row.textContent = 'No attributes'; node.append(row); }
  leafletLayer.bindPopup(node, { maxHeight: 260, maxWidth: 330 });
}
function UploadedMapLayer({ layer, data }: { layer: UploadedLayer; data: FeatureCollection }) {
  const ref = useRef<LeafletGeoJSON>(null);
  useEffect(() => { ref.current?.clearLayers(); ref.current?.addData(data); }, [data]);
  return <GeoJSON ref={ref} data={data} style={{ color: layer.color, fillColor: layer.color, weight: 2, fillOpacity: 0.2 }} pointToLayer={(_feature, point) => circleMarker(point, { radius: 4, color: '#fff', weight: 1, fillColor: layer.color, fillOpacity: 0.9 })} onEachFeature={(feature, mapLayer) => bindPopup(feature, mapLayer, layer.name)} />;
}
export default function UploadedMapLayers() {
  const { uploadedRows, uploads } = useDashboard();
  const groups = useMemo(() => uploads.filter(l => l.enabled).map(layer => ({ layer, data: { type: 'FeatureCollection' as const, features: uploadedRows.filter(r => r.layer.id === layer.id && r.feature.geometry).map(r => r.feature) } })), [uploads, uploadedRows]);
  return <>{groups.map(({ layer, data }) => <UploadedMapLayer key={layer.id} layer={layer} data={data} />)}</>;
}
