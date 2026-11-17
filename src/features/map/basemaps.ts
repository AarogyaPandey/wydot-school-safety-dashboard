// Light Gray is our presentation of OSM tiles, not a separate provider/product.
// Keep the 'streets' ID so existing saved selections retain their appearance.
const osmUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const osmAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const usgsAttribution = '<a href="https://www.usgs.gov/programs/national-geospatial-program/national-map">USGS The National Map</a>';
export const BASEMAPS = {
  streets: {
    label: 'Light Gray', description: 'OpenStreetMap',
    url: osmUrl, attribution: osmAttribution,
    maxNativeZoom: 19,
  },
  osm: {
    label: 'OpenStreetMap', description: 'Standard colors',
    url: osmUrl, attribution: osmAttribution,
    maxNativeZoom: 19,
  },
  topographic: {
    label: 'Topographic', description: 'USGS · terrain and contours',
    url: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}',
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
