// Use USGS for the muted default, including file:// standalone dashboards.
// OSM's public tile service requires an HTTP Referer that local files cannot send.
// Keep the 'streets' ID so saved selections still select the muted default.
const osmUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const usgsTopoUrl = 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}';
const osmAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const usgsAttribution = '<a href="https://www.usgs.gov/programs/national-geospatial-program/national-map">USGS The National Map</a>';
export const BASEMAPS = {
  streets: {
    label: 'Light Gray', description: 'USGS · grayscale',
    url: usgsTopoUrl, attribution: usgsAttribution,
    maxNativeZoom: 16,
  },
  osm: {
    label: 'OpenStreetMap', description: 'Standard colors',
    url: osmUrl, attribution: osmAttribution,
    maxNativeZoom: 19,
  },
  topographic: {
    label: 'Topographic', description: 'USGS · terrain and contours',
    url: usgsTopoUrl,
    attribution: usgsAttribution,
    maxNativeZoom: 16,
  },
  aerial: {
    label: 'Aerial', description: 'USGS · imagery dates vary',
    url: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}',
    attribution: `USDA, ${usgsAttribution}`,
    maxNativeZoom: 16,
  },
} as const;
export type BasemapId = keyof typeof BASEMAPS;

export function basemapAvailable(id: BasemapId, protocol: string): boolean {
  return id !== 'osm' || protocol === 'http:' || protocol === 'https:';
}

export function initialBasemap(saved: string | null, protocol: string): BasemapId {
  return saved && Object.hasOwn(BASEMAPS, saved) && basemapAvailable(saved as BasemapId, protocol) ? saved as BasemapId : 'streets';
}
