window.FLATWISE_CONFIG = {
  defaultMapCenter: [-41.29484, 174.77885],
  defaultZoom: 17,
  minBoundaryZoom: 16,
  maxBoundaryZoom: 19,
  mapBounds: [[-47.8, 165.5], [-33.8, 179.5]],
  osmTileUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",

  // Public LINZ ArcGIS REST services used directly by this static GitHub Pages prototype.
  linzParcelsEndpoint: "https://services.arcgis.com/xdsHIIxuCWByZiCB/arcgis/rest/services/LINZ_NZ_Primary_Parcels/FeatureServer/0/query",
  linzBuildingsEndpoint: "https://services.arcgis.com/xdsHIIxuCWByZiCB/arcgis/rest/services/LINZ_NZ_Building_Outlines/FeatureServer/0/query",

  // Optional image support. Keep false unless you add a restricted browser key for your own domain.
  enableGoogleStreetView: false,
  googleStreetViewApiKey: "",

  // Keep false for privacy. If true, parcel appellation/address-like fields may be shown when LINZ returns them.
  showExactAddress: false
};
