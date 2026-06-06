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

    // Wellington City Council has useful approximate building-height fields.
    // The 3D shadow plug-in prefers this source while the map is inside Wellington.
    wccBuildingFootprints: "https://gis.wcc.govt.nz/arcgis/rest/services/PropertyAndBoundaries/BuildingFootprints/MapServer/0/query",
    wccBuildingFootprintsOutline: "https://gis.wcc.govt.nz/arcgis/rest/services/PropertyAndBoundaries/BuildingFootprints/MapServer/1/query",

    // Kept for future use, but the current interface no longer exposes terrain shade.
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

  // The old 2D sunlight layer is intentionally disabled in the UI.
  // app.js may still create its hidden canvas, so CSS/config cleanup keeps it invisible.
  sunlight: {
    defaultMode: "off",
    disabled: true,
    resolutionScale: 0.38,
    fastGridStepPixels: 18,
    maxSunSamples: 1,
    maxBuildingFeatures: 0,
    maxShadowPolygons: 0,
    shadowSearchPaddingPixels: 0,
    redrawWhileMoving: false,
    skipDuplicateDraws: true,
    defaultBuildingHeightMeters: 8,
    maxShadowLengthMeters: 0,
    propertyPaddingPixels: 0,
    shadowOpacity: 0,
    shadowWashOpacity: 0,
    heatOpacity: 0,
    heatUsesShadows: false
  },

  threeD: {
    enabled: true,
    autoInjectPlugin: true,
    pluginPath: "js/flatwise-3d-buildings.js",
    sunlightModeSelectId: "sunlightMode",
    sunlightModeValue: "threeDShadow",
    sunlightModeLabel: "3D shadow cast",

    // The 3D layer is kept fairly tight so the browser does not try to draw a whole city at once.
    minZoom: 17,
    refreshDebounceMs: 300,
    maxQueryAreaDegrees: 0.016,
    maxBuildingFeatures: 240,
    resultRecordCount: 450,
    geometryPrecision: 6,
    cacheEntries: 18,

    // A neutral basemap is swapped in only while 3D shadow cast is active.
    // It makes the extruded roofs and shadow layer easier to read than the busy default OSM view.
    shadowBaseTiles: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
    shadowBaseAttribution: "&copy; OpenStreetMap contributors &copy; CARTO",

    // Height handling. Wellington uses WCC height fields where available; other cities use estimates.
    defaultBuildingHeightMeters: 7.5,
    fallbackHouseHeightMeters: 6.5,
    minHeightMeters: 3,
    maxHeightMeters: 85,
    heightPixelScale: 0.48,
    minExtrudePixels: 2,
    maxExtrudePixels: 38,

    cityBounds: {
      wellington: { south: -41.37, west: 174.57, north: -41.12, east: 175.02 },
      auckland: { south: -37.10, west: 174.45, north: -36.55, east: 175.05 },
      christchurch: { south: -43.72, west: 172.35, north: -43.35, east: 172.85 }
    },

    // Shadow + occlusion settings.
    shadowDateTime: "",
    shadowOpacity: 0.23,
    shadowStrokeOpacity: 0.08,
    maxShadowLengthMeters: 125,
    maxShadowPixels: 170,
    roofOpacity: 0.94,
    wallOpacityMin: 0.72,
    wallOpacityMax: 0.88,
    shadowBlurPixels: 0.25,
    roofOccludesShadows: true
  }
};

window.FLATWISE_CONFIG = FLATWISE_CONFIG;

// Capture the Leaflet map that app.js creates without editing app.js itself.
// Optional plug-ins can then attach layers safely while the main Flatwise code stays unchanged.
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

// Remove the old sunlight choices and hide the beige sunlight readout/canvas even if an older HTML file is cached.
(function installFlatwiseSunlightModeCleanup() {
  const THREE_D_VALUE = FLATWISE_CONFIG.threeD.sunlightModeValue;
  const THREE_D_LABEL = FLATWISE_CONFIG.threeD.sunlightModeLabel;

  const styleId = "flatwise-old-sunlight-cleanup-style";
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      #sunlightReadout,
      .sunlight-readout,
      .leaflet-sunlight-pane {
        display: none !important;
        opacity: 0 !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  const cleanup = () => {
    const select = document.getElementById(FLATWISE_CONFIG.threeD.sunlightModeSelectId || "sunlightMode");
    if (select) {
      const currentValue = select.value === THREE_D_VALUE ? THREE_D_VALUE : "off";
      select.innerHTML = "";

      const offOption = document.createElement("option");
      offOption.value = "off";
      offOption.textContent = "Off";
      select.appendChild(offOption);

      const threeDOption = document.createElement("option");
      threeDOption.value = THREE_D_VALUE;
      threeDOption.textContent = THREE_D_LABEL;
      select.appendChild(threeDOption);

      select.value = currentValue;
    }

    const readout = document.getElementById("sunlightReadout");
    if (readout) {
      readout.classList.add("hidden");
      readout.setAttribute("aria-hidden", "true");
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", cleanup, { once: true });
  } else {
    cleanup();
  }
})();

// Auto-load the 3D/shadow plug-in.
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
