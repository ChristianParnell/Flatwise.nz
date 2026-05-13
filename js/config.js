window.FLATWISE_CONFIG = {
  defaultMapCenter: [-41.29484, 174.77885],
  defaultZoom: 17,
  minBoundaryZoom: 16,
  maxBoundaryZoom: 19,

  mapBounds: [[-47.8, 165.5], [-33.8, 179.5]],

  osmTileUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",

  // HUGE TILE MODE
  // 1024 + -2 makes each displayed Leaflet tile cover a much larger map area.
  // If it looks too blurry, change these to 512 and -1.
  mapTileSize: 512,
  mapTileZoomOffset: -1,
  mapMaxNativeZoom: 19,
  mapTileKeepBuffer: 6,
  mapUpdateWhenZooming: false,
  mapUpdateWhenIdle: true,
  mapUpdateInterval: 300,

  // LINZ boundary loading area.
  // This loads parcels/buildings well beyond the visible viewport so boundaries feel less patchy.
  boundaryLoadPadding: 0.65,
  boundaryLoadDelay: 420,
  parcelRecordCount: 2000,
  buildingRecordCount: 2000,

  linzParcelsEndpoint: "https://services.arcgis.com/xdsHIIxuCWByZiCB/arcgis/rest/services/LINZ_NZ_Primary_Parcels/FeatureServer/0/query",
  linzBuildingsEndpoint: "https://services.arcgis.com/xdsHIIxuCWByZiCB/arcgis/rest/services/LINZ_NZ_Building_Outlines/FeatureServer/0/query",

  // Optional: set to true and add a restricted browser key if you want Street View thumbnails.
  enableGoogleStreetView: false,
  googleStreetViewApiKey: "",
  showExactAddress: false
};
