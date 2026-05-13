window.FLATWISE_CONFIG = {
    defaultMapCenter: [-41.29484, 174.77885],
    defaultZoom: 17,
    minBoundaryZoom: 16,
    maxBoundaryZoom: 19,

    mapBounds: [[-47.8, 165.5], [-33.8, 179.5]],

    osmTileUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",

    // HUGE TILE MODE
    // 1024 + -2 makes each visual tile cover a massive area.
    // If it becomes too blurry, use mapTileSize: 512 and mapTileZoomOffset: -1.
    mapTileSize: 1024,
    mapTileZoomOffset: -2,
    mapTileKeepBuffer: 4,

    // Load parcel/building boundaries far beyond the visible viewport.
    boundaryLoadPadding: 0.65,
    parcelRecordCount: 2000,
    buildingRecordCount: 2000,

    linzParcelsEndpoint: "https://services.arcgis.com/xdsHIIxuCWByZiCB/arcgis/rest/services/LINZ_NZ_Primary_Parcels/FeatureServer/0/query",
    linzBuildingsEndpoint: "https://services.arcgis.com/xdsHIIxuCWByZiCB/arcgis/rest/services/LINZ_NZ_Building_Outlines/FeatureServer/0/query",

    enableGoogleStreetView: false,
    googleStreetViewApiKey: "",
    showExactAddress: false
};
