const FLATWISE_CONFIG = {
  googleStreetViewApiKey: "API CODE GOES HERE",
  enableStreetView: true,
  map: {
    startCenter: [-41.29435, 174.7769],
    startZoom: 18,
    minZoom: 6,
    maxZoom: 20,
    parcelLoadZoom: 16,
    buildingLoadZoom: 18,
    boundaryDebounceMs: 280,
    maxQueryAreaDegrees: 0.012,
    pointLookupRadiusDegrees: 0.00028,
    lockDemoFlatsOnLoad: true,
    maxNativeTileZoom: 19,
    tileKeepBuffer: 6,
    nzBounds: [[-48.2, 165.1], [-33.0, 179.9]]
  },
  urls: {
    rentData: "data/rent-data.json",
    nominatim: "https://nominatim.openstreetmap.org/search",
    osmTiles: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    propertyBoundaries: "https://services.arcgis.com/xdsHIIxuCWByZiCB/ArcGIS/rest/services/LINZ_NZ_Property_Boundaries/FeatureServer/0/query",
    primaryParcelsFallback: "https://services.arcgis.com/xdsHIIxuCWByZiCB/ArcGIS/rest/services/LINZ_NZ_Primary_Parcels/FeatureServer/0/query",
    buildingOutlines: "https://services.arcgis.com/xdsHIIxuCWByZiCB/ArcGIS/rest/services/LINZ_NZ_Building_Outlines/FeatureServer/0/query"
  },
  linz: {
    propertyOutFields: [
      "OBJECTID",
      "source",
      "source_id",
      "valuation_reference",
      "legal_description",
      "title_no",
      "title_type",
      "territorial_authority",
      "area",
      "unit_of_property_id",
      "parcel_id",
      "untitled_land_id",
      "territorial_authority_id",
      "Shape__Area",
      "Shape__Length"
    ].join(","),
    buildingOutFields: "OBJECTID,id,name,use,Shape__Area,Shape__Length",
    attribution: "Sourced from the LINZ Data Service and licensed for reuse under CC BY 4.0. Not for legal boundary definition."
  },
  reviews: {
    ratingScale: 10,
    storagePrefix: "flatwise_linz_reviews_v1:"
  },
  streetView: {
    enableGoogleStreetView: true,
    searchRadiusMeters: 80,
    imageSize: "640x360",
    fov: 75,
    pitch: 0,
    placeholderHeading: 0
  }
};

window.FLATWISE_CONFIG = FLATWISE_CONFIG;
