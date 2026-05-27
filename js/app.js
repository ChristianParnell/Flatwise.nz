(() => {
  "use strict";

  const config = window.FLATWISE_CONFIG || {};
  const ratingScale = config.reviews?.ratingScale || 10;
  const defaultRating = Math.ceil(ratingScale / 2);

  const reviewFields = [
    { key: "rentValue", label: "Rent value", hint: "Does the rent feel fair for the space, condition, and location?" },
    { key: "warmthInsulation", label: "Warmth & insulation", hint: "Does the flat hold heat without needing constant power use?" },
    { key: "drynessMould", label: "Dryness & mould control", hint: "Are dampness, condensation, and mould properly under control?" },
    { key: "repairsResponse", label: "Repairs response", hint: "Are maintenance issues handled quickly and properly?" },
    { key: "noisePrivacy", label: "Noise & privacy", hint: "Can tenants sleep, study, and live without constant disturbance?" },
    { key: "safetySecurity", label: "Safety & security", hint: "Do locks, lighting, access, and the surrounding area feel safe?" },
    { key: "sunlightVentilation", label: "Sunlight & ventilation", hint: "Does the flat get useful natural light and fresh airflow?" },
    { key: "waterPowerReliability", label: "Water & power reliability", hint: "Are hot water, pressure, heating, sockets, and utilities dependable?" },
    { key: "landlordCommunication", label: "Landlord communication", hint: "Is communication clear, respectful, and not unnecessarily stressful?" },
    { key: "overallLiveability", label: "Overall liveability", hint: "Would you recommend this flat to someone you care about?" }
  ];

  const state = {
    map: null,
    tileLayer: null,
    propertyLayer: null,
    buildingLayer: null,
    selectedBoundaryLayer: null,
    sunlightLayer: null,
    selectedMarker: null,
    activePropertyLayer: null,
    selected: null,
    rentData: { areas: [], demoFlats: [] },
    demoMarkers: new Map(),
    propertyCache: new Map(),
    buildingCache: new Map(),
    pointCache: new Map(),
    currentBuildingFeatures: [],
    pendingBoundaryTimer: 0,
    propertyAbortController: null,
    buildingAbortController: null,
    clickAbortController: null,
    tileLoadingCount: 0,
    showPropertyLines: true,
    showBuildings: true,
    highlightSelectedBoundary: true,
    sunlightMode: config.sunlight?.defaultMode || "off",
    streetViewRequestId: 0,
    elements: {}
  };

  document.addEventListener("DOMContentLoaded", () => {
    init().catch((error) => {
      console.error("Flatwise failed to initialise:", error);
      setStatus("Flatwise could not finish loading. Check the browser console for details.");
    });
  });

  async function init() {
    bindElements();
    createRatingInputs();

    if (!window.L) {
      setStatus("Leaflet did not load. Check the CDN link or network connection.");
      return;
    }

    await loadRentData();
    createMap();
    bindUIEvents();
    renderEmptyDetails();
    updateSunlightReadout();
  }

  function bindElements() {
    const ids = [
      "map", "mapStatus", "searchForm", "searchInput", "clearSearch", "wellingtonButton",
      "heroWellingtonButton", "focusButton", "reviewButton", "topReviewButton", "inlineReviewButton",
      "propertyLinesToggle", "buildingToggle", "selectedBoundaryToggle", "sunlightMode",
      "detailsEmpty", "detailsContent", "photoFrame", "selectedType", "selectedTitle", "selectedSuburb",
      "selectedScore", "rentBenchmark", "rentDescription", "boundarySource", "boundaryDescription",
      "reviewCount", "ratingBreakdown", "reviewList", "reviewComposer", "reviewForm",
      "reviewTargetLabel", "ratingInputs", "reviewNote", "reviewNickname", "reviewTenancyPeriod",
      "reviewWeeklyRent", "reviewRecommend", "cancelReview", "sunlightReadout", "sunlightTitle", "sunlightText",
      "tileLoading"
    ];

    ids.forEach((id) => {
      state.elements[id] = document.getElementById(id);
    });

    state.showPropertyLines = state.elements.propertyLinesToggle ? state.elements.propertyLinesToggle.checked : true;
    state.showBuildings = state.elements.buildingToggle ? state.elements.buildingToggle.checked : true;
    state.highlightSelectedBoundary = state.elements.selectedBoundaryToggle ? state.elements.selectedBoundaryToggle.checked : true;
    state.sunlightMode = state.elements.sunlightMode?.value || state.sunlightMode;
  }

  async function loadRentData() {
    try {
      const data = await fetchJson(config.urls?.rentData || "data/rent-data.json", 7000);
      state.rentData = {
        areas: Array.isArray(data.areas) ? data.areas : [],
        demoFlats: Array.isArray(data.demoFlats) ? data.demoFlats : []
      };
    } catch (error) {
      console.warn("Rent data could not be loaded:", error);
      state.rentData = { areas: [], demoFlats: [] };
    }
  }

  function createMap() {
    const mapSettings = config.map || {};
    const startCenter = mapSettings.startCenter || [-41.29435, 174.7769];
    const startZoom = Number.isFinite(mapSettings.startZoom) ? mapSettings.startZoom : 18;
    const nzBounds = mapSettings.nzBounds || [[-48.2, 165.1], [-33.0, 179.9]];

    state.map = L.map("map", {
      center: startCenter,
      zoom: startZoom,
      minZoom: mapSettings.minZoom || 6,
      maxZoom: mapSettings.maxZoom || 20,
      maxBounds: nzBounds,
      maxBoundsViscosity: 0.65,
      zoomSnap: 1,
      zoomDelta: 1,
      wheelPxPerZoomLevel: 120,
      worldCopyJump: false,
      preferCanvas: false,
      fadeAnimation: false,
      zoomAnimation: true,
      markerZoomAnimation: true,
      inertia: true
    });

    createMapPanes();

    state.tileLayer = L.tileLayer(config.urls?.osmTiles || "https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors · LINZ boundaries CC BY 4.0",
      maxZoom: mapSettings.maxZoom || 20,
      maxNativeZoom: mapSettings.maxNativeTileZoom || 19,
      tileSize: 256,
      zoomOffset: 0,
      detectRetina: false,
      crossOrigin: true,
      keepBuffer: mapSettings.tileKeepBuffer ?? 6,
      updateWhenIdle: false,
      updateWhenZooming: false
    }).addTo(state.map);

    bindTileEvents();

    state.buildingLayer = L.geoJSON(null, {
      pane: "buildingPane",
      interactive: false,
      style: buildingStyle
    }).addTo(state.map);

    state.propertyLayer = L.geoJSON(null, {
      pane: "propertyPane",
      style: () => propertyStyle("normal"),
      onEachFeature: onEachProperty
    }).addTo(state.map);

    state.selectedBoundaryLayer = L.geoJSON(null, {
      pane: "selectedPane",
      interactive: false,
      style: () => propertyStyle("selected")
    }).addTo(state.map);

    state.sunlightLayer = new SunlightCanvasLayer({
      mode: state.sunlightMode,
      selectedFeature: null,
      buildingFeatures: []
    }).addTo(state.map);

    L.control.zoom({ position: "bottomright" }).addTo(state.map);
    addDemoMarkers();

    state.map.whenReady(() => {
      stableInvalidate();
      setTimeout(stableInvalidate, 120);
      setTimeout(scheduleBoundaryLoad, 260);
      setStatus("Map ready. Loading official LINZ property boundaries for this view…");
      if (config.map?.lockDemoFlatsOnLoad !== false) {
        setTimeout(lockDemoFlatsToOfficialBoundaries, 650);
      }
    });

    state.map.on("movestart zoomstart", () => setTileLoading(true));
    state.map.on("moveend zoomend", () => {
      stableInvalidate();
      scheduleBoundaryLoad();
      state.sunlightLayer?.redrawSoon();
      window.setTimeout(() => setTileLoading(false), 480);
    });
    state.map.on("click", handleMapBackgroundClick);
  }

  function createMapPanes() {
    state.map.createPane("buildingPane");
    state.map.createPane("propertyPane");
    state.map.createPane("sunlightPane");
    state.map.createPane("selectedPane");

    state.map.getPane("buildingPane").classList.add("leaflet-building-pane");
    state.map.getPane("propertyPane").classList.add("leaflet-property-pane");
    state.map.getPane("sunlightPane").classList.add("leaflet-sunlight-pane");
    state.map.getPane("selectedPane").classList.add("leaflet-selected-pane");

    state.map.getPane("buildingPane").style.zIndex = 390;
    state.map.getPane("propertyPane").style.zIndex = 430;
    state.map.getPane("sunlightPane").style.zIndex = 455;
    state.map.getPane("selectedPane").style.zIndex = 500;
  }

  function bindTileEvents() {
    state.tileLayer.on("tileloadstart", () => {
      state.tileLoadingCount += 1;
      setTileLoading(true);
    });

    state.tileLayer.on("tileload tileabort", () => {
      state.tileLoadingCount = Math.max(0, state.tileLoadingCount - 1);
      if (state.tileLoadingCount === 0) setTimeout(() => setTileLoading(false), 220);
    });

    state.tileLayer.on("load", () => {
      state.tileLoadingCount = 0;
      setTimeout(() => setTileLoading(false), 220);
    });

    state.tileLayer.on("tileerror", (event) => {
      state.tileLoadingCount = Math.max(0, state.tileLoadingCount - 1);
      const tile = event.tile;
      if (!tile) return;

      const attempts = Number(tile.dataset.retryCount || "0");
      if (attempts >= 2) {
        setStatus("A map tile failed to load. Pan slightly to request it again.");
        return;
      }

      tile.dataset.retryCount = String(attempts + 1);
      const retrySrc = tile.src.split("?retry=")[0];
      window.setTimeout(() => {
        tile.src = `${retrySrc}?retry=${Date.now()}`;
      }, 450 + attempts * 650);
    });
  }

  function setTileLoading(isLoading) {
    const badge = state.elements.tileLoading;
    if (!badge) return;
    badge.classList.toggle("is-visible", Boolean(isLoading));
  }

  function stableInvalidate() {
    if (!state.map) return;
    state.map.invalidateSize({ animate: false, pan: false });
  }

  function bindUIEvents() {
    state.elements.wellingtonButton?.addEventListener("click", jumpToWellington);
    state.elements.heroWellingtonButton?.addEventListener("click", jumpToWellington);
    state.elements.focusButton?.addEventListener("click", focusSelected);
    state.elements.reviewButton?.addEventListener("click", openReviewComposer);
    state.elements.topReviewButton?.addEventListener("click", openReviewComposer);
    state.elements.inlineReviewButton?.addEventListener("click", openReviewComposer);

    state.elements.cancelReview?.addEventListener("click", () => {
      resetReviewForm();
      setStatus("Review form cleared. The selected property is still active.");
    });

    state.elements.clearSearch?.addEventListener("click", clearSearch);

    state.elements.propertyLinesToggle?.addEventListener("change", () => {
      state.showPropertyLines = state.elements.propertyLinesToggle.checked;
      if (!state.showPropertyLines) {
        state.propertyLayer?.clearLayers();
        refreshSelectedBoundary();
        setStatus("Property-line overlay turned off. Clicking the map can still look up the property underneath.");
        return;
      }
      setStatus("Property-line overlay turned on. Loading official LINZ boundaries…");
      scheduleBoundaryLoad();
      refreshSelectedBoundary();
    });

    state.elements.buildingToggle?.addEventListener("change", () => {
      state.showBuildings = state.elements.buildingToggle.checked;
      if (!state.showBuildings) {
        state.currentBuildingFeatures = [];
        state.buildingLayer?.clearLayers();
        state.sunlightLayer?.setBuildingFeatures([]);
        setStatus("Building outlines hidden. The sunlight heatmap still works, but shadows will be less informed.");
        return;
      }
      scheduleBoundaryLoad();
    });

    state.elements.selectedBoundaryToggle?.addEventListener("change", () => {
      state.highlightSelectedBoundary = state.elements.selectedBoundaryToggle.checked;
      refreshSelectedBoundary();
      setStatus(state.highlightSelectedBoundary ? "Selected-property outline enabled." : "Selected-property outline hidden.");
    });

    state.elements.sunlightMode?.addEventListener("change", () => {
      state.sunlightMode = state.elements.sunlightMode.value;
      state.sunlightLayer?.setMode(state.sunlightMode);
      updateSunlightReadout();
      if (state.sunlightMode !== "off" && !state.selected) {
        setStatus("Sunlight mode selected. Click a property first so Flatwise knows where to draw the estimate.");
      } else if (state.sunlightMode !== "off") {
        setStatus(`${sunlightModeLabel(state.sunlightMode)} enabled for the selected property.`);
      } else {
        setStatus("Sunlight overlay turned off.");
      }
    });

    state.elements.searchForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      runSearch();
    });

    state.elements.reviewForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      saveReview();
    });
  }

  function jumpToWellington() {
    if (!state.map) return;
    scrollToMap();
    state.map.flyTo(config.map?.startCenter || [-41.29435, 174.7769], config.map?.startZoom || 18, { duration: 0.85 });
  }

  function scrollToMap() {
    document.getElementById("mapArea")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function scrollToReviewComposer(options = {}) {
    const target = state.elements.reviewComposer || state.elements.detailsContent || document.querySelector(".details-panel");
    if (!target) return;

    const delay = Number.isFinite(options.delay) ? options.delay : 160;
    window.setTimeout(() => {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      if (options.focusNote && state.elements.reviewNote) {
        window.setTimeout(() => state.elements.reviewNote.focus({ preventScroll: true }), 280);
      }
    }, delay);
  }

  function focusSelected() {
    if (!state.selected) {
      setStatus("Select a demo flat marker or property boundary first, then the focus button will centre it.");
      return;
    }

    const feature = state.selected.boundaryFeature || state.selected.feature;
    if (feature) {
      const bounds = getFeatureBounds(feature);
      if (bounds?.isValid()) {
        state.map.fitBounds(bounds.pad(0.32), { maxZoom: 19, animate: true, duration: 0.65 });
        return;
      }
    }

    if (state.selected.centre) {
      state.map.flyTo(state.selected.centre, Math.max(state.map.getZoom(), 18), { duration: 0.65 });
    }
  }

  async function runSearch() {
    const query = state.elements.searchInput?.value.trim();
    if (!query) {
      setStatus("Type an address, street, or suburb first.");
      return;
    }

    setStatus(`Searching for “${query}”…`);

    try {
      const url = new URL(config.urls?.nominatim || "https://nominatim.openstreetmap.org/search");
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("limit", "1");
      url.searchParams.set("countrycodes", "nz");
      url.searchParams.set("q", query);

      const results = await fetchJson(url.toString(), 9000);
      if (!Array.isArray(results) || results.length === 0) {
        setStatus("No matching NZ address found. Try a street and suburb together.");
        return;
      }

      const place = results[0];
      const lat = Number(place.lat);
      const lon = Number(place.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        setStatus("The search result did not include usable coordinates.");
        return;
      }

      scrollToMap();
      state.map.flyTo([lat, lon], Math.max(state.map.getZoom(), 18), { duration: 0.85 });
      setStatus(`Moved to ${place.display_name || query}. Looking up the property under that point…`);
      window.setTimeout(() => lookupAndSelectPropertyAt(L.latLng(lat, lon), { source: "search", focus: false }), 950);
    } catch (error) {
      console.warn("Flatwise search failed:", error);
      setStatus("Search failed. You can still pan and zoom manually on the map.");
    }
  }

  function clearSearch() {
    if (state.elements.searchInput) {
      state.elements.searchInput.value = "";
      state.elements.searchInput.focus();
    }
  }

  function addDemoMarkers() {
    const flats = Array.isArray(state.rentData?.demoFlats) ? state.rentData.demoFlats : [];
    const fallback = [
      { id: "te-aro-demo", title: "Te Aro demo flat", lat: -41.2944, lng: 174.7769, score: 6.2, note: "Demo review marker only." },
      { id: "kelburn-demo", title: "Kelburn demo flat", lat: -41.2891, lng: 174.7667, score: 8.1, note: "Demo review marker only." }
    ];

    (flats.length ? flats : fallback).forEach(addDemoMarker);
  }

  function addDemoMarker(flat) {
    if (!state.map || !Number.isFinite(Number(flat.lat)) || !Number.isFinite(Number(flat.lng))) return;

    const safeFlat = normaliseDemoFlat(flat);
    const marker = L.marker([safeFlat.lat, safeFlat.lng], {
      title: safeFlat.title,
      icon: demoMarkerIcon(safeFlat)
    }).addTo(state.map);

    marker.bindPopup(demoPopupHtml(safeFlat));
    marker.on("click", () => selectDemoFlat(safeFlat, marker));
    state.demoMarkers.set(safeFlat.id, { marker, flat: safeFlat });
  }

  function normaliseDemoFlat(flat) {
    const title = flat.title || "Flatwise demo flat";
    return {
      ...flat,
      id: flat.id || slugify(title),
      title,
      lat: Number(flat.lat),
      lng: Number(flat.lng),
      note: flat.note || "Demo marker showing where tenant reviews could appear.",
      seedReviews: Array.isArray(flat.seedReviews) ? flat.seedReviews : [],
      lockedToLinz: false,
      lockedPropertyId: flat.lockedPropertyId || "",
      boundaryFeature: flat.boundary?.type === "Feature" ? structuredCloneSafe(flat.boundary) : null
    };
  }

  async function lockDemoFlatsToOfficialBoundaries() {
    const entries = Array.from(state.demoMarkers.values());
    if (!entries.length) return;

    setStatus("Locking demo flats to official LINZ property polygons…");
    let locked = 0;

    for (const entry of entries) {
      const { marker, flat } = entry;
      try {
        const feature = await queryPropertyAtPoint(L.latLng(flat.lat, flat.lng), { allowTinyEnvelope: true });
        if (!feature) continue;

        const centre = getFeatureCentre(feature) || L.latLng(flat.lat, flat.lng);
        const propertyIdValue = propertyId(feature);
        flat.lockedToLinz = true;
        flat.lockedPropertyId = propertyIdValue;
        flat.boundaryFeature = feature;
        flat.lat = centre.lat;
        flat.lng = centre.lng;
        marker.setLatLng(centre);
        marker.setPopupContent(demoPopupHtml(flat));
        locked += 1;
      } catch (error) {
        console.warn(`Could not lock demo flat ${flat.title} to LINZ boundary:`, error);
      }
    }

    if (locked > 0) {
      setStatus(`${locked} demo flat marker${locked === 1 ? "" : "s"} locked to official LINZ property boundaries.`);
    } else {
      setStatus("Demo flats are still usable, but none could be auto-locked to LINZ right now.");
    }
  }

  function demoMarkerIcon(flat) {
    const target = targetFromDemoFlat(flat);
    const reviews = getReviewsForTarget(target);
    const average = calculateOverall(reviews);
    const value = Number.isFinite(average) ? average : Number(flat.score || defaultRating);
    const display = Number.isFinite(value) ? value.toFixed(1) : "—";

    return L.divIcon({
      className: `demo-marker ${ratingClass(value)}`,
      html: `<span>${escapeHtml(display)}</span>`,
      iconSize: [50, 50],
      iconAnchor: [25, 46],
      popupAnchor: [0, -40]
    });
  }

  function demoPopupHtml(flat) {
    const target = targetFromDemoFlat(flat);
    const reviews = getReviewsForTarget(target);
    const average = calculateOverall(reviews);
    const score = Number.isFinite(average) ? average.toFixed(1) : Number(flat.score || 0).toFixed(1);
    const lockText = flat.lockedToLinz ? "Official LINZ property boundary locked" : "Boundary lock pending";

    return `
      <strong>${escapeHtml(flat.title)}</strong><br />
      <span>${escapeHtml(flat.note)}</span><br />
      <strong>${escapeHtml(score)} / ${ratingScale}</strong><br />
      <small>${escapeHtml(lockText)}</small>
    `;
  }

  function updateDemoMarker(flat) {
    const entry = state.demoMarkers.get(flat.id);
    if (!entry) return;
    entry.marker.setIcon(demoMarkerIcon(flat));
    entry.marker.setPopupContent(demoPopupHtml(flat));
  }

  function targetFromDemoFlat(flat) {
    return {
      type: "demo",
      id: flat.lockedPropertyId ? `property:${flat.lockedPropertyId}` : `demo:${flat.id}`,
      title: flat.title,
      centre: L.latLng(flat.lat, flat.lng),
      boundaryFeature: flat.boundaryFeature || null,
      demoFlat: flat
    };
  }

  function scheduleBoundaryLoad() {
    window.clearTimeout(state.pendingBoundaryTimer);
    state.pendingBoundaryTimer = window.setTimeout(loadBoundariesForView, config.map?.boundaryDebounceMs || 280);
  }

  async function loadBoundariesForView() {
    if (!state.map) return;

    const zoom = state.map.getZoom();
    const parcelZoom = config.map?.parcelLoadZoom || 16;
    const buildingZoom = config.map?.buildingLoadZoom || 18;

    if (zoom < parcelZoom) {
      state.propertyLayer.clearLayers();
      state.buildingLayer.clearLayers();
      state.currentBuildingFeatures = [];
      state.sunlightLayer?.setBuildingFeatures([]);
      setStatus(`Zoom to level ${parcelZoom} or closer to load official LINZ property boundaries.`);
      return;
    }

    const bounds = state.map.getBounds().pad(0.08);
    if (isQueryTooLarge(bounds)) {
      state.propertyLayer.clearLayers();
      state.buildingLayer.clearLayers();
      state.currentBuildingFeatures = [];
      state.sunlightLayer?.setBuildingFeatures([]);
      setStatus("Move closer before loading property boundaries. This prevents oversized LINZ requests.");
      return;
    }

    if (state.showPropertyLines) {
      await loadArcGisGeoJson({
        layerName: "property",
        url: config.urls?.propertyBoundaries,
        bounds,
        targetLayer: state.propertyLayer,
        cache: state.propertyCache,
        abortKey: "propertyAbortController",
        outFields: config.linz?.propertyOutFields || "*",
        resultRecordCount: 2000
      });
    } else {
      state.propertyLayer.clearLayers();
    }

    if (state.showBuildings && zoom >= buildingZoom) {
      const buildings = await loadArcGisGeoJson({
        layerName: "building",
        url: config.urls?.buildingOutlines,
        bounds,
        targetLayer: state.buildingLayer,
        cache: state.buildingCache,
        abortKey: "buildingAbortController",
        outFields: config.linz?.buildingOutFields || "*",
        resultRecordCount: 1000
      });
      state.currentBuildingFeatures = buildings?.features || [];
      state.sunlightLayer?.setBuildingFeatures(state.currentBuildingFeatures);
    } else {
      state.buildingLayer.clearLayers();
      state.currentBuildingFeatures = [];
      state.sunlightLayer?.setBuildingFeatures([]);
    }
  }

  async function loadArcGisGeoJson(options) {
    const { layerName, url, bounds, targetLayer, cache, abortKey, outFields, resultRecordCount } = options;
    if (!url || !targetLayer) return null;

    const cacheKey = makeBoundsCacheKey(bounds, layerName);
    if (cache.has(cacheKey)) {
      const cached = cache.get(cacheKey);
      applyGeoJsonToLayer(targetLayer, cached);
      updateBoundaryStatus(layerName, cached);
      return cached;
    }

    if (state[abortKey]) state[abortKey].abort();
    const controller = new AbortController();
    state[abortKey] = controller;

    try {
      const requestUrl = buildArcGisEnvelopeQueryUrl(url, bounds, outFields, layerName, resultRecordCount);
      const response = await fetch(requestUrl, { signal: controller.signal });
      if (!response.ok) throw new Error(`${layerName} request failed with ${response.status}`);

      const geoJson = await response.json();
      if (!geoJson || !Array.isArray(geoJson.features)) throw new Error(`${layerName} response was not GeoJSON`);

      cache.set(cacheKey, geoJson);
      trimCache(cache, 16);
      applyGeoJsonToLayer(targetLayer, geoJson);
      updateBoundaryStatus(layerName, geoJson);
      return geoJson;
    } catch (error) {
      if (error.name === "AbortError") return null;
      console.warn(`Flatwise ${layerName} load failed:`, error);
      if (layerName === "property") setStatus("LINZ property boundaries could not load right now. Click the map again or try a smaller view.");
      return null;
    }
  }

  function buildArcGisEnvelopeQueryUrl(baseUrl, bounds, outFields, layerName, resultRecordCount) {
    const geometry = {
      xmin: bounds.getWest(),
      ymin: bounds.getSouth(),
      xmax: bounds.getEast(),
      ymax: bounds.getNorth(),
      spatialReference: { wkid: 4326 }
    };

    const url = new URL(baseUrl);
    url.searchParams.set("f", "geojson");
    url.searchParams.set("where", "1=1");
    url.searchParams.set("outFields", outFields || "*");
    url.searchParams.set("returnGeometry", "true");
    url.searchParams.set("spatialRel", "esriSpatialRelIntersects");
    url.searchParams.set("geometryType", "esriGeometryEnvelope");
    url.searchParams.set("inSR", "4326");
    url.searchParams.set("outSR", "4326");
    url.searchParams.set("geometry", JSON.stringify(geometry));
    url.searchParams.set("resultRecordCount", String(resultRecordCount || 1500));
    url.searchParams.set("geometryPrecision", layerName === "building" ? "6" : "7");
    return url.toString();
  }

  function applyGeoJsonToLayer(layer, geoJson) {
    layer.clearLayers();
    layer.addData(geoJson);
  }

  function updateBoundaryStatus(layerName, geoJson) {
    if (layerName !== "property") return;
    const count = geoJson.features.length;
    if (count === 0) {
      setStatus("No LINZ property polygons returned for this view. Pan slightly or zoom closer.");
      return;
    }
    setStatus(`${count} official LINZ property boundaries loaded. Click a property polygon to select it.`);
  }

  function isQueryTooLarge(bounds) {
    const max = config.map?.maxQueryAreaDegrees || 0.012;
    const width = Math.abs(bounds.getEast() - bounds.getWest());
    const height = Math.abs(bounds.getNorth() - bounds.getSouth());
    return width * height > max;
  }

  function makeBoundsCacheKey(bounds, layerName) {
    const precision = layerName === "building" ? 4 : 5;
    const parts = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()].map((value) => Number(value).toFixed(precision));
    return `${layerName}:${state.map.getZoom()}:${parts.join(":")}`;
  }

  function trimCache(cache, maxEntries) {
    while (cache.size > maxEntries) {
      const oldestKey = cache.keys().next().value;
      cache.delete(oldestKey);
    }
  }

  function onEachProperty(feature, layer) {
    layer.on({
      mouseover: () => handlePropertyHover(layer),
      mouseout: () => handlePropertyOut(layer),
      click: (event) => {
        if (event.originalEvent) L.DomEvent.stopPropagation(event.originalEvent);
        selectPropertyFeature(feature, layer, { focus: true, scroll: true });
      }
    });

    layer.bindTooltip(propertyTitle(feature), {
      direction: "top",
      sticky: true,
      className: "property-tooltip"
    });
  }

  function handlePropertyHover(layer) {
    if (!state.showPropertyLines) return;

    if (state.activePropertyLayer && state.activePropertyLayer !== layer) handlePropertyOut(state.activePropertyLayer);
    state.activePropertyLayer = layer;
    layer.setStyle(propertyStyle("hover"));
    layer.bringToFront();
    state.elements.map?.classList.add("is-hovering-property");
    setStatus("Property boundary highlighted. Click it to select the official LINZ property polygon.");
  }

  function handlePropertyOut(layer) {
    if (!layer) return;

    const selectedFeature = state.selected?.feature || state.selected?.boundaryFeature;
    if (selectedFeature && sameProperty(layer.feature, selectedFeature)) {
      layer.setStyle(propertyStyle("muted"));
    } else {
      layer.setStyle(propertyStyle("normal"));
    }

    if (state.activePropertyLayer === layer) state.activePropertyLayer = null;
    state.elements.map?.classList.remove("is-hovering-property");
  }

  function selectPropertyFeature(feature, layer = null, options = {}) {
    const idValue = propertyId(feature);
    const bounds = layer?.getBounds ? layer.getBounds() : getFeatureBounds(feature);
    const centre = bounds?.isValid() ? bounds.getCenter() : getFeatureCentre(feature);
    const matchingDemo = findDemoFlatForProperty(idValue);

    state.selected = {
      type: matchingDemo ? "demo" : "property",
      id: `property:${idValue}`,
      title: matchingDemo?.title || propertyTitle(feature),
      centre,
      feature,
      boundaryFeature: feature,
      demoFlat: matchingDemo || null
    };

    refreshSelectedBoundary();

    if (bounds?.isValid()) {
      state.map.fitBounds(bounds.pad(0.34), { maxZoom: 19, animate: true, duration: 0.65 });
      setSelectedMarker(bounds.getCenter());
    } else if (centre) {
      setSelectedMarker(centre);
    }

    if (layer) layer.setStyle(propertyStyle("muted"));

    renderSelectedDetails();
    state.sunlightLayer?.setSelectedFeature(feature);
    updateSunlightReadout();
    setStatus("Property selected. Sunlight modes now draw directly over this selected boundary.");

    if (options.scroll) scrollToReviewComposer({ delay: 520 });
  }

  async function handleMapBackgroundClick(event) {
    if (!event?.latlng) return;
    await lookupAndSelectPropertyAt(event.latlng, { source: "map", focus: true });
  }

  async function lookupAndSelectPropertyAt(latlng, options = {}) {
    if (!latlng) return;

    const cacheKey = `${latlng.lat.toFixed(6)},${latlng.lng.toFixed(6)}`;
    if (state.pointCache.has(cacheKey)) {
      const cached = state.pointCache.get(cacheKey);
      if (cached) selectPropertyFeature(cached, null, { focus: options.focus, scroll: options.source === "map" });
      return;
    }

    setStatus("Looking up the property under your cursor using LINZ boundaries…");

    try {
      const feature = await queryPropertyAtPoint(latlng, { allowTinyEnvelope: true });
      state.pointCache.set(cacheKey, feature || null);
      trimCache(state.pointCache, 40);

      if (!feature) {
        setStatus("No property boundary was returned for that point. Try a nearby point or zoom closer.");
        return;
      }

      selectPropertyFeature(feature, null, { focus: options.focus !== false, scroll: options.source === "map" });
    } catch (error) {
      console.warn("Point property lookup failed:", error);
      setStatus("Could not complete the property lookup. Try clicking the visible polygon outline instead.");
    }
  }

  async function queryPropertyAtPoint(latlng, options = {}) {
    const radius = options.allowTinyEnvelope ? config.map?.pointLookupRadiusDegrees || 0.00028 : 0.00015;
    const bounds = L.latLngBounds([
      [latlng.lat - radius, latlng.lng - radius],
      [latlng.lat + radius, latlng.lng + radius]
    ]);

    const primary = await queryFirstFeatureFromUrl(config.urls?.propertyBoundaries, bounds, "point-property");
    if (primary) return primary;

    return queryFirstFeatureFromUrl(config.urls?.primaryParcelsFallback, bounds, "point-parcel");
  }

  async function queryFirstFeatureFromUrl(url, bounds, layerName) {
    if (!url) return null;

    if (state.clickAbortController) state.clickAbortController.abort();
    const controller = new AbortController();
    state.clickAbortController = controller;

    const requestUrl = buildArcGisEnvelopeQueryUrl(url, bounds, config.linz?.propertyOutFields || "*", layerName, 8);
    const response = await fetch(requestUrl, { signal: controller.signal });
    if (!response.ok) throw new Error(`Point lookup failed with ${response.status}`);

    const geoJson = await response.json();
    return Array.isArray(geoJson.features) && geoJson.features.length ? geoJson.features[0] : null;
  }

  function selectDemoFlat(flat, marker) {
    const target = targetFromDemoFlat(flat);
    state.selected = {
      ...target,
      type: "demo",
      centre: marker.getLatLng(),
      feature: target.boundaryFeature,
      boundaryFeature: target.boundaryFeature,
      demoFlat: flat
    };

    setSelectedMarker(marker.getLatLng());
    refreshSelectedBoundary();
    if (target.boundaryFeature) {
      const bounds = getFeatureBounds(target.boundaryFeature);
      if (bounds?.isValid()) state.map.fitBounds(bounds.pad(0.34), { maxZoom: 19, animate: true, duration: 0.65 });
      state.sunlightLayer?.setSelectedFeature(target.boundaryFeature);
    } else {
      state.map.flyTo(marker.getLatLng(), Math.max(state.map.getZoom(), 18), { duration: 0.65 });
      state.sunlightLayer?.setSelectedFeature(null);
    }

    renderSelectedDetails();
    updateSunlightReadout();
    setStatus(`${flat.title} selected. Review form is ready.`);
    scrollToReviewComposer({ delay: 520 });
  }

  function refreshSelectedBoundary() {
    state.selectedBoundaryLayer.clearLayers();
    if (!state.highlightSelectedBoundary) return;

    const feature = state.selected?.boundaryFeature || state.selected?.feature;
    if (feature) state.selectedBoundaryLayer.addData(feature);
  }

  function setSelectedMarker(latlng) {
    if (!latlng) return;

    if (!state.selectedMarker) {
      state.selectedMarker = L.marker(latlng, {
        icon: L.divIcon({ className: "selected-marker", html: "", iconSize: [40, 40], iconAnchor: [20, 38] }),
        interactive: false
      }).addTo(state.map);
      return;
    }

    state.selectedMarker.setLatLng(latlng);
  }

  function renderEmptyDetails() {
    state.elements.detailsEmpty?.classList.remove("hidden");
    state.elements.detailsContent?.classList.add("hidden");
    if (state.elements.reviewTargetLabel) state.elements.reviewTargetLabel.textContent = "No property selected";
    renderPhotoPlaceholder("Select a property", "Street View preview will appear here when configured.");
  }

  function renderSelectedDetails() {
    const selected = state.selected;
    if (!selected) {
      renderEmptyDetails();
      return;
    }

    state.elements.detailsEmpty?.classList.add("hidden");
    state.elements.detailsContent?.classList.remove("hidden");

    const reviews = getReviewsForTarget(selected);
    const average = calculateOverall(reviews);
    const rentArea = findNearestRentArea(selected.centre);
    const boundaryFeature = selected.boundaryFeature || selected.feature;

    setText("selectedType", selected.type === "demo" ? "Demo flat" : "Selected property");
    setText("selectedTitle", selected.title || propertyTitle(boundaryFeature) || "Selected property");
    setText("selectedSuburb", rentArea?.name || selectedSuburbFromFeature(boundaryFeature) || "Wellington");

    const scoreText = Number.isFinite(average) ? `${average.toFixed(1)} / ${ratingScale}` : "No rating";
    state.elements.selectedScore.textContent = scoreText;
    state.elements.selectedScore.className = `rating-pill ${ratingClass(average)}`;

    setText("rentBenchmark", rentArea?.weeklyRent || "No local data");
    setText("rentDescription", rentArea?.description || "No local rent guide is connected for this exact area yet.");

    const official = Boolean(boundaryFeature && !boundaryFeature.properties?._flatwise_demo_boundary);
    setText("boundarySource", official ? "Official LINZ boundary" : "Demo boundary");
    setText("boundaryDescription", official ? "This property outline came from the LINZ boundary service and is used for the selected review target." : "This is fallback demo geometry used when the live boundary service is unavailable.");

    setText("reviewCount", String(reviews.length));
    setText("reviewTargetLabel", selected.title || propertyTitle(boundaryFeature) || "Selected property");

    renderRatingBreakdown(reviews);
    renderReviewList(reviews);
    renderStreetView(selected);
  }

  function renderRatingBreakdown(reviews) {
    const wrap = state.elements.ratingBreakdown;
    if (!wrap) return;

    if (!reviews.length) {
      wrap.innerHTML = `<p class="fine-print">No reviews yet. Your saved review will create the first rating breakdown for this property.</p>`;
      return;
    }

    const rows = reviewFields.map((field) => {
      const value = averageForField(reviews, field.key);
      const width = Number.isFinite(value) ? Math.max(0, Math.min(100, (value / ratingScale) * 100)) : 0;
      return `
        <div class="breakdown-row">
          <div><span>${escapeHtml(field.label)}</span><strong>${Number.isFinite(value) ? value.toFixed(1) : "—"}</strong></div>
          <i><b style="width:${width}%"></b></i>
        </div>
      `;
    }).join("");

    wrap.innerHTML = rows;
  }

  function renderReviewList(reviews) {
    const wrap = state.elements.reviewList;
    if (!wrap) return;

    if (!reviews.length) {
      wrap.innerHTML = `<p class="fine-print">No tenant notes saved for this property yet.</p>`;
      return;
    }

    wrap.innerHTML = reviews.slice().reverse().map((review) => {
      const created = review.createdAt ? new Date(review.createdAt) : null;
      const dateText = created && !Number.isNaN(created.valueOf()) ? created.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "Saved review";
      const overall = calculateOverall([review]);
      return `
        <article class="review-card">
          <header><strong>${escapeHtml(review.nickname || "Tenant review")}</strong><span>${Number.isFinite(overall) ? overall.toFixed(1) : "—"} / ${ratingScale}</span></header>
          <p class="review-meta">${escapeHtml(dateText)} · ${escapeHtml(review.tenancyPeriod || "Period not supplied")} · ${escapeHtml(review.weeklyRent || "Rent not supplied")} · Recommend: ${escapeHtml(review.recommend || "Prefer not to say")}</p>
          <p>${escapeHtml(review.note || "No written note added.")}</p>
        </article>
      `;
    }).join("");
  }

  function renderStreetView(selected) {
    const centre = selected?.centre;
    if (!centre) {
      renderPhotoPlaceholder("No location", "Select a property to show a location preview.");
      return;
    }

    const streetViewEnabled = Boolean(config.enableStreetView && config.googleStreetViewApiKey && config.streetView?.enableGoogleStreetView !== false);
    if (!streetViewEnabled) {
      renderPhotoPlaceholder("Street View not connected", "Add your Google Street View browser API key in js/config.js to enable road-view images.");
      return;
    }

    const requestId = ++state.streetViewRequestId;
    renderPhotoPlaceholder("Checking Street View", "Looking for a nearby panorama before loading an image.");

    const key = config.googleStreetViewApiKey;
    const radius = config.streetView?.searchRadiusMeters || 80;
    const metadataUrl = new URL("https://maps.googleapis.com/maps/api/streetview/metadata");
    metadataUrl.searchParams.set("location", `${centre.lat},${centre.lng}`);
    metadataUrl.searchParams.set("radius", String(radius));
    metadataUrl.searchParams.set("key", key);

    fetchJson(metadataUrl.toString(), 7000).then((metadata) => {
      if (requestId !== state.streetViewRequestId) return;
      if (!metadata || metadata.status !== "OK") {
        renderPhotoPlaceholder("No Street View found", "Google did not return a nearby road panorama for this selected point.");
        return;
      }

      const imageUrl = new URL("https://maps.googleapis.com/maps/api/streetview");
      imageUrl.searchParams.set("size", config.streetView?.imageSize || "640x360");
      imageUrl.searchParams.set("location", `${centre.lat},${centre.lng}`);
      imageUrl.searchParams.set("radius", String(radius));
      imageUrl.searchParams.set("fov", String(config.streetView?.fov || 75));
      imageUrl.searchParams.set("pitch", String(config.streetView?.pitch || 0));
      imageUrl.searchParams.set("heading", String(config.streetView?.placeholderHeading || 0));
      imageUrl.searchParams.set("key", key);

      state.elements.photoFrame.innerHTML = `
        <img src="${escapeAttribute(imageUrl.toString())}" alt="Google Street View preview near selected property" />
        <span class="streetview-meta">Street View metadata checked · ${escapeHtml(metadata.date || "date unknown")}</span>
      `;
    }).catch((error) => {
      if (requestId !== state.streetViewRequestId) return;
      console.warn("Street View metadata failed:", error);
      renderPhotoPlaceholder("Street View check failed", "The property review tools still work without the image preview.");
    });
  }

  function renderPhotoPlaceholder(title, text) {
    const frame = state.elements.photoFrame;
    if (!frame) return;
    frame.innerHTML = `
      <div class="photo-placeholder">
        <span>⌂</span>
        <strong>${escapeHtml(title)}</strong>
        <small>${escapeHtml(text)}</small>
      </div>
    `;
  }

  function createRatingInputs() {
    const wrap = state.elements.ratingInputs;
    if (!wrap) return;

    wrap.innerHTML = reviewFields.map((field) => `
      <div class="rating-field">
        <label for="rating-${escapeAttribute(field.key)}">
          <span>${escapeHtml(field.label)}</span>
          <output id="output-${escapeAttribute(field.key)}">${defaultRating}</output>
        </label>
        <input id="rating-${escapeAttribute(field.key)}" name="${escapeAttribute(field.key)}" type="range" min="1" max="${ratingScale}" value="${defaultRating}" step="1" />
        <small>${escapeHtml(field.hint)}</small>
      </div>
    `).join("");

    reviewFields.forEach((field) => {
      const input = document.getElementById(`rating-${field.key}`);
      const output = document.getElementById(`output-${field.key}`);
      input?.addEventListener("input", () => {
        if (output) output.textContent = input.value;
      });
    });
  }

  function openReviewComposer() {
    if (!state.selected) {
      setStatus("Select a property first, then you can write a review for the exact boundary.");
      scrollToMap();
      return;
    }
    scrollToReviewComposer({ delay: 80, focusNote: true });
  }

  function resetReviewForm() {
    state.elements.reviewForm?.reset();
    reviewFields.forEach((field) => {
      const input = document.getElementById(`rating-${field.key}`);
      const output = document.getElementById(`output-${field.key}`);
      if (input) input.value = String(defaultRating);
      if (output) output.textContent = String(defaultRating);
    });
  }

  function saveReview() {
    if (!state.selected) {
      setStatus("Select a property before saving a review.");
      return;
    }

    const ratings = {};
    reviewFields.forEach((field) => {
      const input = document.getElementById(`rating-${field.key}`);
      ratings[field.key] = clampNumber(Number(input?.value || defaultRating), 1, ratingScale);
    });

    const review = {
      createdAt: new Date().toISOString(),
      nickname: state.elements.reviewNickname?.value.trim() || "Tenant review",
      tenancyPeriod: state.elements.reviewTenancyPeriod?.value.trim() || "",
      weeklyRent: state.elements.reviewWeeklyRent?.value.trim() || "",
      recommend: state.elements.reviewRecommend?.value || "Prefer not to say",
      note: state.elements.reviewNote?.value.trim() || "",
      ratings
    };

    const existing = getReviewsForTarget(state.selected, { includeSeed: false });
    existing.push(review);
    localStorage.setItem(storageKeyForTarget(state.selected), JSON.stringify(existing));

    resetReviewForm();
    renderSelectedDetails();
    refreshDemoMarkersForSelected();
    setStatus("Review saved locally for the selected property.");
  }

  function refreshDemoMarkersForSelected() {
    state.demoMarkers.forEach(({ flat }) => updateDemoMarker(flat));
  }

  function getReviewsForTarget(target, options = {}) {
    if (!target) return [];
    const includeSeed = options.includeSeed !== false;
    const seed = includeSeed && target.demoFlat?.seedReviews ? target.demoFlat.seedReviews : [];

    let saved = [];
    try {
      saved = JSON.parse(localStorage.getItem(storageKeyForTarget(target)) || "[]");
    } catch {
      saved = [];
    }

    return [...seed, ...(Array.isArray(saved) ? saved : [])];
  }

  function storageKeyForTarget(target) {
    return `${config.reviews?.storagePrefix || "flatwise_reviews:"}${target.id || "unknown"}`;
  }

  function calculateOverall(reviews) {
    const values = reviews
      .map((review) => review?.ratings?.overallLiveability)
      .map(Number)
      .filter(Number.isFinite);

    if (!values.length) {
      const all = reviews.flatMap((review) => Object.values(review?.ratings || {}).map(Number).filter(Number.isFinite));
      return all.length ? average(all) : NaN;
    }

    return average(values);
  }

  function averageForField(reviews, key) {
    const values = reviews.map((review) => Number(review?.ratings?.[key])).filter(Number.isFinite);
    return values.length ? average(values) : NaN;
  }

  function average(values) {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  function findNearestRentArea(latlng) {
    if (!latlng || !Array.isArray(state.rentData.areas) || !state.rentData.areas.length) return null;

    let best = null;
    let bestDistance = Infinity;
    state.rentData.areas.forEach((area) => {
      const lat = Number(area.lat);
      const lng = Number(area.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const distance = state.map ? state.map.distance(latlng, L.latLng(lat, lng)) : Math.hypot(latlng.lat - lat, latlng.lng - lng);
      if (distance < bestDistance) {
        best = area;
        bestDistance = distance;
      }
    });

    return bestDistance < 4500 ? best : null;
  }

  function findDemoFlatForProperty(idValue) {
    if (!idValue) return null;
    for (const entry of state.demoMarkers.values()) {
      if (entry.flat.lockedPropertyId && entry.flat.lockedPropertyId === idValue) return entry.flat;
    }
    return null;
  }

  function selectedSuburbFromFeature(feature) {
    const props = feature?.properties || {};
    return props.territorial_authority || props.ta_name || props.suburb || "Wellington";
  }

  function propertyTitle(feature) {
    const props = feature?.properties || {};
    const readable = props.legal_description || props.title_no || props.valuation_reference || props.source_id || props.parcel_id || props.OBJECTID;
    return readable ? `Property ${propertyId(feature)}` : "Selected property";
  }

  function propertyId(feature) {
    const props = feature?.properties || {};
    return String(props.unit_of_property_id || props.source_id || props.parcel_id || props.OBJECTID || props.id || hashFeature(feature));
  }

  function sameProperty(a, b) {
    return propertyId(a) === propertyId(b);
  }

  function hashFeature(feature) {
    const text = JSON.stringify(feature?.geometry || {}).slice(0, 1200);
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    return Math.abs(hash).toString(36);
  }

  function getFeatureBounds(feature) {
    if (!feature?.geometry) return null;
    try {
      return L.geoJSON(feature).getBounds();
    } catch {
      return null;
    }
  }

  function getFeatureCentre(feature) {
    const bounds = getFeatureBounds(feature);
    return bounds?.isValid() ? bounds.getCenter() : null;
  }

  function propertyStyle(mode) {
    const styles = {
      normal: { color: "#101312", weight: 1.2, opacity: 0.48, fillColor: "#fffaf0", fillOpacity: 0.03 },
      hover: { color: "#1f7a4f", weight: 2.2, opacity: 0.92, fillColor: "#1f7a4f", fillOpacity: 0.12 },
      muted: { color: "#b23a2f", weight: 1.8, opacity: 0.7, fillColor: "#b23a2f", fillOpacity: 0.08 },
      selected: { color: "#b23a2f", weight: 3.2, opacity: 0.98, fillColor: "#b23a2f", fillOpacity: 0.07 }
    };
    return styles[mode] || styles.normal;
  }

  function buildingStyle() {
    return { color: "#2f6fb2", weight: 1, opacity: 0.36, fillColor: "#2f6fb2", fillOpacity: 0.08 };
  }

  function ratingClass(value) {
    if (!Number.isFinite(Number(value))) return "";
    if (value >= 7.2) return "good";
    if (value >= 5) return "warning";
    return "bad";
  }

  function setStatus(message) {
    if (state.elements.mapStatus) state.elements.mapStatus.textContent = message;
  }

  function setText(id, value) {
    if (state.elements[id]) state.elements[id].textContent = value;
  }

  function fetchJson(url, timeoutMs = 8000) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);

    return fetch(url, { signal: controller.signal }).then((response) => {
      if (!response.ok) throw new Error(`Request failed with ${response.status}`);
      return response.json();
    }).finally(() => window.clearTimeout(timer));
  }

  function slugify(text) {
    return String(text).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "flatwise-item";
  }

  function structuredCloneSafe(value) {
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function clampNumber(value, min, max) {
    if (!Number.isFinite(value)) return min;
    return Math.max(min, Math.min(max, value));
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#039;",
      '"': "&quot;"
    }[char]));
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, "&#096;");
  }

  function updateSunlightReadout() {
    const readout = state.elements.sunlightReadout;
    if (!readout) return;

    const mode = state.sunlightMode || "off";
    if (mode === "off") {
      readout.classList.add("hidden");
      return;
    }

    readout.classList.remove("hidden");
    setText("sunlightTitle", sunlightModeLabel(mode));

    if (!state.selected) {
      setText("sunlightText", "Select a property to draw this estimate over the parcel boundary.");
      return;
    }

    setText("sunlightText", sunlightModeText(mode));
  }

  function sunlightModeLabel(mode) {
    const labels = {
      off: "Off",
      heat: "Sun heatmap",
      shadow: "Shadow cast",
      winter: "Winter sunlight",
      summer: "Summer sunlight",
      daily: "Daily average estimate"
    };
    return labels[mode] || "Estimated sunlight";
  }

  function sunlightModeText(mode) {
    const text = {
      heat: "A smooth estimated sunlight score sampled across the selected property.",
      shadow: "Projected building shadows cast across the selected property from the estimated sun angle.",
      winter: "A harsher winter-focused sunlight estimate, useful for cold and damp Wellington flats.",
      summer: "A stronger summer exposure estimate with longer daylight and higher sun angles.",
      daily: "An estimated average from several daylight samples across the day."
    };
    return text[mode] || "Estimated sunlight is active for the selected property.";
  }

  class SunlightCanvasLayer extends L.Layer {
    constructor(options = {}) {
      super(options);
      this.options = options;
      this.mode = options.mode || "off";
      this.selectedFeature = options.selectedFeature || null;
      this.buildingFeatures = options.buildingFeatures || [];
      this.canvas = null;
      this._frame = 0;
    }

    onAdd(map) {
      this._map = map;
      this.canvas = L.DomUtil.create("canvas", "flatwise-sunlight-canvas leaflet-zoom-animated");
      map.getPane("sunlightPane").appendChild(this.canvas);
      map.on("moveend zoomend resize viewreset", this.redrawSoon, this);
      this.redrawSoon();
    }

    onRemove(map) {
      map.off("moveend zoomend resize viewreset", this.redrawSoon, this);
      if (this.canvas?.parentNode) this.canvas.parentNode.removeChild(this.canvas);
      this.canvas = null;
      if (this._frame) cancelAnimationFrame(this._frame);
    }

    setMode(mode) {
      this.mode = mode || "off";
      this.redrawSoon();
    }

    setSelectedFeature(feature) {
      this.selectedFeature = feature || null;
      this.redrawSoon();
    }

    setBuildingFeatures(features) {
      this.buildingFeatures = Array.isArray(features) ? features : [];
      this.redrawSoon();
    }

    redrawSoon() {
      if (this._frame) cancelAnimationFrame(this._frame);
      this._frame = requestAnimationFrame(() => this.redraw());
    }

    redraw() {
      this._frame = 0;
      if (!this._map || !this.canvas) return;

      const map = this._map;
      const size = map.getSize();
      const topLeft = map.containerPointToLayerPoint([0, 0]);
      L.DomUtil.setPosition(this.canvas, topLeft);
      this.canvas.width = size.x;
      this.canvas.height = size.y;

      const ctx = this.canvas.getContext("2d");
      ctx.clearRect(0, 0, size.x, size.y);

      if (this.mode === "off" || !this.selectedFeature) return;

      const rings = featureToCanvasRings(this.selectedFeature, map);
      if (!rings.length) return;

      const selectedBounds = pixelBoundsFromRings(rings).pad(config.sunlight?.propertyPaddingPixels ?? 18);
      const samples = buildSunSamples(this.mode, getFeatureCentre(this.selectedFeature) || map.getCenter());
      const shadowCollections = samples.map((sun) => buildShadowPolygons(this.buildingFeatures, sun, map, selectedBounds));

      ctx.save();
      clipToFeature(ctx, rings);

      if (this.mode === "shadow") {
        this.drawShadowMode(ctx, rings, shadowCollections[0] || [], selectedBounds);
      } else {
        this.drawHeatMode(ctx, rings, selectedBounds, samples, shadowCollections);
      }

      ctx.restore();
      this.drawPropertySoftEdge(ctx, rings);
    }

    drawHeatMode(ctx, rings, selectedBounds, samples, shadowCollections) {
      const step = config.sunlight?.gridStepPixels || 9;
      const heatOpacity = config.sunlight?.heatOpacity ?? 0.78;
      const centre = selectedBounds.getCenter();

      for (let y = Math.max(0, Math.floor(selectedBounds.min.y)); y <= selectedBounds.max.y; y += step) {
        for (let x = Math.max(0, Math.floor(selectedBounds.min.x)); x <= selectedBounds.max.x; x += step) {
          if (!pointInFeatureRings({ x, y }, rings)) continue;

          let score = 0;
          samples.forEach((sun, index) => {
            const shadowed = pointInAnyPolygon({ x, y }, shadowCollections[index] || []);
            score += scoreSunlightAtPoint({ x, y }, centre, sun, shadowed, this.mode);
          });
          score = clampNumber(score / Math.max(samples.length, 1), 0, 1);

          ctx.fillStyle = heatColor(score, heatOpacity);
          ctx.fillRect(x - step / 2, y - step / 2, step + 1, step + 1);
        }
      }

      const currentShadows = shadowCollections[0] || [];
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = "#24384a";
      currentShadows.forEach((poly) => fillPolygon(ctx, poly));
      ctx.globalAlpha = 1;
    }

    drawShadowMode(ctx, rings, shadows, selectedBounds) {
      ctx.fillStyle = "rgba(255, 250, 240, 0.42)";
      rings.forEach((polygon) => polygon.forEach((ring) => fillPolygon(ctx, ring)));

      const gradient = ctx.createLinearGradient(selectedBounds.min.x, selectedBounds.min.y, selectedBounds.max.x, selectedBounds.max.y);
      gradient.addColorStop(0, "rgba(255, 213, 103, 0.26)");
      gradient.addColorStop(1, "rgba(255, 250, 240, 0.06)");
      ctx.fillStyle = gradient;
      rings.forEach((polygon) => polygon.forEach((ring) => fillPolygon(ctx, ring)));

      ctx.fillStyle = `rgba(28, 43, 61, ${config.sunlight?.shadowOpacity ?? 0.28})`;
      shadows.forEach((poly) => fillPolygon(ctx, poly));
    }

    drawPropertySoftEdge(ctx, rings) {
      ctx.save();
      ctx.strokeStyle = "rgba(244, 182, 66, 0.72)";
      ctx.lineWidth = 2;
      rings.forEach((polygon) => polygon.forEach((ring) => strokePolygon(ctx, ring)));
      ctx.restore();
    }
  }

  function buildSunSamples(mode, centre) {
    const lat = centre?.lat ?? -41.29435;
    const lng = centre?.lng ?? 174.7769;
    const now = new Date();

    if (mode === "winter") return makeSeasonalSamples(now.getFullYear(), 5, 21, [9, 11, 13, 15], lat, lng);
    if (mode === "summer") return makeSeasonalSamples(now.getFullYear(), 11, 21, [8, 10, 12, 14, 16, 18], lat, lng);
    if (mode === "daily") return makeDailySamples(now, [8, 10, 12, 14, 16], lat, lng);

    const sampleDate = new Date(now);
    if (mode === "heat") sampleDate.setHours(12, 0, 0, 0);
    const sun = getSunPosition(sampleDate, lat, lng);
    if (sun.altitude <= 0.03) {
      const noon = new Date(now);
      noon.setHours(12, 0, 0, 0);
      return [getSunPosition(noon, lat, lng)];
    }
    return [sun];
  }

  function makeSeasonalSamples(year, monthIndex, day, hours, lat, lng) {
    return hours.map((hour) => {
      const date = new Date(year, monthIndex, day, hour, 0, 0, 0);
      return getSunPosition(date, lat, lng);
    }).filter((sun) => sun.altitude > 0.02);
  }

  function makeDailySamples(date, hours, lat, lng) {
    const samples = hours.map((hour) => {
      const sample = new Date(date);
      sample.setHours(hour, 0, 0, 0);
      return getSunPosition(sample, lat, lng);
    }).filter((sun) => sun.altitude > 0.02);
    return samples.length ? samples : [getSunPosition(new Date(date.setHours(12, 0, 0, 0)), lat, lng)];
  }

  function getSunPosition(date, lat, lng) {
    const rad = Math.PI / 180;
    const day = date.valueOf() / 86400000 - 10957.5;
    const eclipticObliquity = rad * 23.4397;
    const meanAnomaly = rad * (357.5291 + 0.98560028 * day);
    const equationOfCenter = rad * (1.9148 * Math.sin(meanAnomaly) + 0.0200 * Math.sin(2 * meanAnomaly) + 0.0003 * Math.sin(3 * meanAnomaly));
    const perihelion = rad * 102.9372;
    const eclipticLongitude = meanAnomaly + equationOfCenter + perihelion + Math.PI;
    const declination = Math.asin(Math.sin(eclipticLongitude) * Math.sin(eclipticObliquity));
    const rightAscension = Math.atan2(Math.sin(eclipticLongitude) * Math.cos(eclipticObliquity), Math.cos(eclipticLongitude));
    const lw = rad * -lng;
    const phi = rad * lat;
    const siderealTime = rad * (280.16 + 360.9856235 * day) - lw;
    const hourAngle = siderealTime - rightAscension;
    const altitude = Math.asin(Math.sin(phi) * Math.sin(declination) + Math.cos(phi) * Math.cos(declination) * Math.cos(hourAngle));
    const rawAzimuth = Math.atan2(Math.sin(hourAngle), Math.cos(hourAngle) * Math.sin(phi) - Math.tan(declination) * Math.cos(phi));
    const azimuth = positiveModulo(rawAzimuth + Math.PI, Math.PI * 2);
    return { altitude, azimuth, date };
  }

  function scoreSunlightAtPoint(point, centre, sun, shadowed, mode) {
    const altitudeScore = clampNumber((sun.altitude - 0.02) / 1.22, 0.04, 1);
    const dx = point.x - centre.x;
    const dy = point.y - centre.y;
    const angle = Math.atan2(dy, dx);
    const sunScreenAngle = Math.atan2(-Math.cos(sun.azimuth), Math.sin(sun.azimuth));
    const facing = 0.5 + 0.5 * Math.cos(angle - sunScreenAngle);
    const seasonalWeight = mode === "winter" ? 0.82 : mode === "summer" ? 1.12 : 1;
    const shadowPenalty = shadowed ? (mode === "winter" ? 0.34 : 0.52) : 1;
    return clampNumber((altitudeScore * 0.76 + facing * 0.24) * seasonalWeight * shadowPenalty, 0, 1);
  }

  function heatColor(score, alpha) {
    const stops = [
      { at: 0, color: [45, 85, 137] },
      { at: 0.42, color: [49, 151, 121] },
      { at: 0.72, color: [221, 165, 55] },
      { at: 1, color: [247, 222, 120] }
    ];

    let left = stops[0];
    let right = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i += 1) {
      if (score >= stops[i].at && score <= stops[i + 1].at) {
        left = stops[i];
        right = stops[i + 1];
        break;
      }
    }

    const amount = (score - left.at) / Math.max(0.001, right.at - left.at);
    const rgb = left.color.map((value, index) => Math.round(value + (right.color[index] - value) * amount));
    return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
  }

  function buildShadowPolygons(features, sun, map, selectedBounds) {
    if (!Array.isArray(features) || !features.length || sun.altitude <= 0.02) return [];

    const maxShadowMeters = config.sunlight?.maxShadowLengthMeters || 180;
    const defaultHeight = config.sunlight?.defaultBuildingHeightMeters || 8;
    const centre = map.getCenter();
    const metersPerPixel = getMetersPerPixel(centre.lat, map.getZoom());
    const shadowDirection = {
      x: -Math.sin(sun.azimuth),
      y: Math.cos(sun.azimuth)
    };

    const result = [];
    features.forEach((feature) => {
      const buildingRings = featureToCanvasRings(feature, map);
      if (!buildingRings.length) return;

      const featureBounds = pixelBoundsFromRings(buildingRings).pad(80);
      if (!featureBounds.intersects(selectedBounds.pad(260))) return;

      const height = estimateBuildingHeight(feature, defaultHeight);
      const lengthMeters = clampNumber(height / Math.tan(Math.max(sun.altitude, 0.08)), 8, maxShadowMeters);
      const lengthPixels = lengthMeters / Math.max(metersPerPixel, 0.01);
      const offset = { x: shadowDirection.x * lengthPixels, y: shadowDirection.y * lengthPixels };

      buildingRings.forEach((polygon) => {
        const outer = polygon[0];
        if (!outer || outer.length < 3) return;
        const shifted = outer.map((point) => ({ x: point.x + offset.x, y: point.y + offset.y })).reverse();
        result.push([...outer, ...shifted]);
      });
    });

    return result.slice(0, 80);
  }

  function estimateBuildingHeight(feature, fallback) {
    const props = feature?.properties || {};
    const direct = Number(props.height || props.building_height || props.render_height);
    if (Number.isFinite(direct) && direct > 0) return direct;

    const levels = Number(props.levels || props.building_levels || props["building:levels"]);
    if (Number.isFinite(levels) && levels > 0) return levels * 3.1;

    return fallback;
  }

  function getMetersPerPixel(lat, zoom) {
    return (156543.03392 * Math.cos(lat * Math.PI / 180)) / Math.pow(2, zoom);
  }

  function featureToCanvasRings(feature, map) {
    const geometry = feature?.geometry;
    if (!geometry) return [];

    const polygons = geometry.type === "Polygon"
      ? [geometry.coordinates]
      : geometry.type === "MultiPolygon"
        ? geometry.coordinates
        : [];

    return polygons.map((polygon) => polygon.map((ring) => ring.map(([lng, lat]) => map.latLngToContainerPoint([lat, lng]))));
  }

  function pixelBoundsFromRings(polygons) {
    const bounds = L.bounds([Infinity, Infinity], [-Infinity, -Infinity]);
    polygons.forEach((polygon) => polygon.forEach((ring) => ring.forEach((point) => bounds.extend(point))));
    return bounds;
  }

  function clipToFeature(ctx, polygons) {
    ctx.beginPath();
    polygons.forEach((polygon) => polygon.forEach((ring) => tracePolygon(ctx, ring)));
    ctx.clip("evenodd");
  }

  function pointInFeatureRings(point, polygons) {
    return polygons.some((polygon) => {
      if (!polygon.length || !pointInRing(point, polygon[0])) return false;
      for (let i = 1; i < polygon.length; i += 1) {
        if (pointInRing(point, polygon[i])) return false;
      }
      return true;
    });
  }

  function pointInAnyPolygon(point, polygons) {
    return polygons.some((polygon) => pointInRing(point, polygon));
  }

  function pointInRing(point, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const xi = ring[i].x;
      const yi = ring[i].y;
      const xj = ring[j].x;
      const yj = ring[j].y;
      const intersect = ((yi > point.y) !== (yj > point.y)) && (point.x < ((xj - xi) * (point.y - yi)) / ((yj - yi) || 0.000001) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  function tracePolygon(ctx, ring) {
    if (!ring || !ring.length) return;
    ctx.moveTo(ring[0].x, ring[0].y);
    for (let i = 1; i < ring.length; i += 1) ctx.lineTo(ring[i].x, ring[i].y);
    ctx.closePath();
  }

  function fillPolygon(ctx, ring) {
    if (!ring || ring.length < 3) return;
    ctx.beginPath();
    tracePolygon(ctx, ring);
    ctx.fill();
  }

  function strokePolygon(ctx, ring) {
    if (!ring || ring.length < 3) return;
    ctx.beginPath();
    tracePolygon(ctx, ring);
    ctx.stroke();
  }

  function positiveModulo(value, modulus) {
    return ((value % modulus) + modulus) % modulus;
  }
})();
