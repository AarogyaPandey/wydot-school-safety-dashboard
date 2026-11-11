import { useEffect, useState } from 'react';
import { GeoJSON } from 'react-leaflet';
import { circleMarker, type Layer, type PathOptions } from 'leaflet';
import type { Feature, FeatureCollection } from 'geojson';
import { fetchLayer } from '../../data/client';
import { applySchoolZoneSpeedAssumption, speedLimitCategories, speedLimitColor, type SchoolBufferCenter, type SpeedLimitCategory } from './speed-limits';

export const ROAD_CLASSES: Record<string, string> = { '1': 'Interstate', '2': 'Freeway / expressway', '3': 'Principal arterial', '4': 'Minor arterial', '5': 'Major collector', '6': 'Minor collector', '7': 'Local road' };
const numeric = (value: unknown) => typeof value === 'number' ? value.toLocaleString() : value === null || value === undefined ? 'Not recorded' : String(value);
function popup(feature: Feature, key: string) {
  const p = feature.properties || {};
  const node = document.createElement('div'), title = document.createElement('strong');
  title.textContent = key.startsWith('hot-') ? String(p.hotspot) : ({ crosswalks: 'Mapped crosswalk', sidewalks: 'Mapped sidewalk', signals: 'Pedestrian signal', speed: 'Posted Speed Limit', aadt: 'Traffic volume', roads: 'Road classification' }[key] || 'Map feature');
  node.appendChild(title);
  const values: [string, unknown][] = key.startsWith('hot-') ? [['Crashes in cell', p.n], ['Gi* z-score', p.gi_z], ['Adjusted p-value', p.p_adj], ['Nearest school', p.nearest_school], ['Distance from cell center (ft)', p.dist_school_ft]]
    : key === 'speed' ? [
      ...(p.school_zone_speed_override === true
        ? [['Analysis speed (assumed)', '20 mph'] as [string, unknown], ['Source speed limit', p.source_speed_limit === 0 ? 'Unspecified (0)' : p.source_speed_limit === null || p.source_speed_limit === undefined ? 'Unknown / not recorded' : `${numeric(p.source_speed_limit)} mph`] as [string, unknown]]
        : [[p.speed_limit === 0 || p.speed_limit === null || p.speed_limit === undefined ? 'Speed limit' : 'Speed limit (mph)', p.speed_limit === 0 ? 'Unspecified (0)' : p.speed_limit === null || p.speed_limit === undefined ? 'Unknown / not recorded' : numeric(p.speed_limit)] as [string, unknown]]),
      ['Source', p.speed_limit_source],
      ...(p.road_name ? [['Road', p.road_name] as [string, unknown]] : [['Type', p.speed_limit_type], ['Route', p.route]] as [string, unknown][]),
    ]
    : key === 'aadt' ? [['Vehicles / day', p.aadt_volume], ['Truck AADT', p.truck_aadt], ['Traffic year', p.traffic_year], ['Route', p.route]]
    : key === 'roads' ? [['Classification', ROAD_CLASSES[String(p.fsystemnumeric)] || p.fsystemtext], ['Route', p.routeid]]
    : key === 'crosswalks' ? [['Location', p.location], ['Marked', p.marked === 1 ? 'Yes' : p.marked === 0 ? 'No' : 'Not recorded'], ['Surveyed', p.recordedat]]
    : key === 'sidewalks' ? [['Location', p.location], ['Width (ft)', p.width_ft], ['Gap flagged', p.gaps === 1 ? 'Yes' : p.gaps === 0 ? 'No' : 'Not recorded']]
    : [['Location', p.location], ['Surveyed', p.recordedat]];
  for (const [label, value] of values) {
    const row = document.createElement('p'), labelNode = document.createElement('span');
    labelNode.textContent = `${label}: `; row.append(labelNode, document.createTextNode(numeric(value))); node.appendChild(row);
  }
  return node;
}
function style(feature: Feature | undefined, key: string, speedCategories: SpeedLimitCategory[]): PathOptions {
  const p = feature?.properties || {};
  if (key.startsWith('hot-')) return { color: Number(p.gi_z) > 0 ? '#b3533e' : '#4588b2', weight: 1, fillColor: Number(p.gi_z) > 0 ? '#cf725b' : '#76b2d2', fillOpacity: 0.28 };
  if (key === 'crosswalks') return { color: '#664b9f', weight: 1.4, fillOpacity: 0.6 };
  if (key === 'sidewalks') return { color: '#4b8b58', weight: 1.2, fillOpacity: 0.45 };
  if (key === 'speed') return p.school_zone_speed_override === true
    ? { color: speedLimitColor(p.speed_limit, speedCategories, true), weight: 5, opacity: 1, dashArray: '8 4' }
    : { color: speedLimitColor(p.speed_limit, speedCategories), weight: 4, opacity: 0.9 };
  if (key === 'aadt') { const volume = Number(p.aadt_volume); return { color: volume >= 20000 ? '#174c6a' : volume >= 10000 ? '#3585aa' : '#7db5c9', weight: volume >= 20000 ? 5 : volume >= 10000 ? 3.5 : 2, opacity: 0.8 }; }
  const cls = Number(p.fsystemnumeric);
  return { color: cls <= 2 ? '#a85253' : cls <= 4 ? '#c99b43' : cls <= 6 ? '#6b8b75' : '#8e9995', weight: cls <= 4 ? 3 : 1.5, opacity: 0.8 };
}
export default function RemoteLayer({ layerKey, trafficYear, onStatus, onSpeedCategories, schoolBufferCenters = [], schoolBufferFt = 1000 }: { layerKey: string; trafficYear: number; onStatus: (key: string, error: string | null) => void; onSpeedCategories?: (categories: SpeedLimitCategory[] | null) => void; schoolBufferCenters?: SchoolBufferCenter[]; schoolBufferFt?: number }) {
  const [data, setData] = useState<FeatureCollection | null>(null);
  useEffect(() => {
    let active = true; setData(null); onStatus(layerKey, null);
    if (layerKey === 'speed') onSpeedCategories?.(null);
    void fetchLayer(layerKey, trafficYear).then(collection => {
      if (!active) return;
      const displayedCollection = layerKey === 'speed'
        ? { ...collection, features: applySchoolZoneSpeedAssumption(collection.features, schoolBufferCenters, schoolBufferFt) }
        : layerKey.startsWith('hot-')
          ? { ...collection, features: collection.features.filter(f => Number(f.properties?.p_adj) < 0.05) }
          : collection;
      setData(displayedCollection);
      if (layerKey === 'speed') onSpeedCategories?.(speedLimitCategories(displayedCollection.features));
    }).catch(error => {
      if (active) {
        onStatus(layerKey, error instanceof Error ? error.message : 'Layer unavailable');
        if (layerKey === 'speed') onSpeedCategories?.([]);
      }
    });
    return () => { active = false; };
  }, [layerKey, trafficYear, onStatus, onSpeedCategories, schoolBufferCenters, schoolBufferFt]);
  if (!data) return null;
  const speedCategories = layerKey === 'speed' ? speedLimitCategories(data.features) : [];
  const popupOptions = layerKey === 'speed' ? { autoPanPaddingTopLeft: [16, 130] as [number, number], autoPanPaddingBottomRight: [270, 110] as [number, number] } : undefined;
  return <GeoJSON key={`${layerKey}:${trafficYear}`} data={data} style={feature => style(feature, layerKey, speedCategories)} pointToLayer={(_feature, ll) => circleMarker(ll, { radius: 4, color: '#79559c', weight: 2, fillColor: '#ffffff', fillOpacity: 1 })} onEachFeature={(feature: Feature, layer: Layer) => layer.bindPopup(popup(feature, layerKey), popupOptions)} />;
}
