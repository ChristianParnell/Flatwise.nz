const FLATWISE_CONFIG = {
  enableStreetView: false,
  googleStreetViewApiKey: "",

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
    buildingOutlines: "https://services.arcgis.com/xdsHIIxuCWByZiCB/ArcGIS/rest/services/LINZ_NZ_Building_Outlines/FeatureServer/0/query",

    // Wellington City Council has real approximate building-height fields.
    // Used automatically when the map is inside Wellington city.
    wccBuildingFootprints: "https://gis.wcc.govt.nz/arcgis/rest/services/PropertyAndBoundaries/BuildingFootprints/MapServer/0/query",
    wccBuildingFootprintsOutline: "https://gis.wcc.govt.nz/arcgis/rest/services/PropertyAndBoundaries/BuildingFootprints/MapServer/1/query",

    // Optional coarse terrain shade source. The public API is free but should be sampled lightly.
    terrainElevation: "https://api.opentopodata.org/v1/nzdem8m"
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
    buildingOutFields: "*",
    attribution: "Sourced from LINZ-compatible public boundary services. Not for legal boundary definition."
  },

  reviews: {
    ratingScale: 10,
    storagePrefix: "flatwise_linz_reviews_v2:"
  },

  streetView: {
    searchRadiusMeters: 80,
    imageSize: "640x360",
    fov: 75,
    pitch: 0,
    placeholderHeading: 0
  },

  sunlight: {
    defaultMode: "off",

    // Performance-first sunlight settings. These keep the daylight overlay live
    // without forcing the browser to calculate thousands of shadow intersections.
    resolutionScale: 0.46,
    fastGridStepPixels: 15,
    maxSunSamples: 3,
    maxBuildingFeatures: 55,
    maxShadowPolygons: 28,
    shadowSearchPaddingPixels: 170,
    redrawWhileMoving: false,
    skipDuplicateDraws: true,

    // Visual and estimation settings.
    defaultBuildingHeightMeters: 8,
    maxShadowLengthMeters: 120,
    propertyPaddingPixels: 16,
    shadowOpacity: 0.22,
    shadowWashOpacity: 0.12,
    heatOpacity: 0.62,
    heatUsesShadows: true
  },

  threeD: {
    enabled: true,
    autoInjectPlugin: true,
    pluginPath: "js/flatwise-3d-buildings.js",
    sunlightModeValue: "threeDShadow",
    sunlightModeLabel: "3D / shadow",

    // Keep this higher than the parcel layer so the browser does not try to draw a whole city at once.
    minZoom: 17,
    refreshDebounceMs: 340,
    maxQueryAreaDegrees: 0.018,
    maxBuildingFeatures: 260,
    resultRecordCount: 500,
    geometryPrecision: 6,
    cacheEntries: 16,

    // Height handling.
    defaultBuildingHeightMeters: 7.5,
    fallbackHouseHeightMeters: 6.5,
    minHeightMeters: 3,
    maxHeightMeters: 85,
    heightPixelScale: 0.42,
    minExtrudePixels: 2,
    maxExtrudePixels: 34,

    // Wellington gets real approx_hei from WCC. Other cities use LINZ footprints with estimated heights.
    cityBounds: {
      wellington: { south: -41.37, west: 174.57, north: -41.12, east: 175.02 },
      auckland: { south: -37.10, west: 174.45, north: -36.55, east: 175.05 },
      christchurch: { south: -43.72, west: 172.35, north: -43.35, east: 172.85 }
    },

    // Shadow settings. The control can override this with its date/time picker.
    shadowDateTime: "",
    winterPresetDateTime: "2026-06-21T12:00",
    summerPresetDateTime: "2026-12-21T13:00",
    shadowOpacity: 0.28,
    maxShadowLengthMeters: 180,
    maxShadowPixels: 240,

    // Coarse terrain relief. This samples a small grid only when the user turns terrain on.
    terrainEnabledDefault: false,
    terrainMinZoom: 16,
    terrainGridSize: 5,
    terrainMaxPoints: 36,
    terrainRefreshMinutes: 180,
    terrainOpacity: 0.26
  }
};

window.FLATWISE_CONFIG = FLATWISE_CONFIG;

// Capture the Leaflet map that app.js creates without editing app.js itself.
// This lets optional plug-ins attach layers safely while the main Flatwise code stays unchanged.
(function installFlatwiseMapHook() {
  if (window.__flatwiseMapHookInstalled) return;
  window.__flatwiseMapHookInstalled = true;
  window.FLATWISE_MAPS = window.FLATWISE_MAPS || [];

  const patchLeafletMapFactory = () => {
    if (!window.L || !window.L.map || window.L.map.__flatwiseHooked) return false;

    const originalMapFactory = window.L.map;

    window.L.map = function flatwiseCapturedLeafletMapFactory(...args) {
      const map = originalMapFactory.apply(this, args);
      if (!window.FLATWISE_MAPS.includes(map)) {
        window.FLATWISE_MAPS.push(map);
        window.FlatwiseMap = map;
        window.dispatchEvent(new CustomEvent("flatwise:map-ready", { detail: { map } }));
      }
      return map;
    };

    window.L.map.__flatwiseHooked = true;
    return true;
  };

  if (!patchLeafletMapFactory()) {
    document.addEventListener("DOMContentLoaded", patchLeafletMapFactory, { once: true });
    window.setTimeout(patchLeafletMapFactory, 0);
  }
})();



// Keep selected properties as boundary highlights only.
// The main app creates a small centre marker after selecting a property. It can look like
// a flashing square/pin during focus animations, so this hides that marker and removes
// browser focus outlines while preserving the actual selected parcel boundary layer.
(function installFlatwiseSelectionHighlightOnlyStyle() {
  if (document.getElementById("flatwise-selection-highlight-only-style")) return;

  const css = `
    .selected-marker,
    .leaflet-marker-icon.selected-marker,
    .leaflet-marker-shadow.selected-marker {
      display: none !important;
      opacity: 0 !important;
      visibility: hidden !important;
      pointer-events: none !important;
    }

    .leaflet-container:focus,
    .leaflet-container *:focus,
    .leaflet-interactive:focus,
    .leaflet-marker-icon:focus,
    .leaflet-pane:focus,
    .leaflet-overlay-pane svg:focus,
    .leaflet-overlay-pane path:focus {
      outline: none !important;
      box-shadow: none !important;
    }
  `;

  const style = document.createElement("style");
  style.id = "flatwise-selection-highlight-only-style";
  style.textContent = css;
  document.head.appendChild(style);
})();

// Auto-load the optional 3D/shadow plug-in. No index.html change is required as long as
// this config.js file is loaded before js/app.js, which the current Flatwise page already does.
(function autoLoadFlatwise3DPlugin() {
  const settings = window.FLATWISE_CONFIG?.threeD;
  if (!settings?.enabled || !settings?.autoInjectPlugin) return;
  if (document.querySelector("script[data-flatwise-3d-plugin]")) return;

  const script = document.createElement("script");
  script.src = settings.pluginPath || "js/flatwise-3d-buildings.js";
  script.async = false;
  script.defer = true;
  script.dataset.flatwise3dPlugin = "true";

  const currentScript = document.currentScript;
  if (currentScript?.parentNode) {
    currentScript.parentNode.insertBefore(script, currentScript.nextSibling);
  } else {
    document.head.appendChild(script);
  }
})();
