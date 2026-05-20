window.FLATWISE_CONFIG = {
  map: {
    startCenter: [-41.2924, 174.7787],
    startZoom: 17,
    minZoom: 6,
    maxZoom: 20,
    parcelLoadZoom: 16,
    buildingLoadZoom: 18,
    maxQueryAreaDegrees: 0.018,
    boundaryDebounceMs: 320
  },

  urls: {
    parcels: "https://services.arcgis.com/xdsHIIxuCWByZiCB/arcgis/rest/services/LINZ_NZ_Primary_Parcels/FeatureServer/0/query",
    buildings: "https://services.arcgis.com/xdsHIIxuCWByZiCB/ArcGIS/rest/services/LINZ_NZ_Building_Outlines/FeatureServer/0/query",
    nominatim: "https://nominatim.openstreetmap.org/search",
    rentData: "data/rent-data.json"
  },

  reviews: {
    storagePrefix: "flatwise_reviews_v2:"
  },

  streetView: {
    enableGoogleStreetView: false,
    googleStreetViewApiKey: "YOUR_RESTRICTED_KEY"
  }
};
