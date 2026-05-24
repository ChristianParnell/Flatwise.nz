(() => {
  "use strict";

  const config = window.FLATWISE_CONFIG || {};
  const ratingScale = config.reviews?.ratingScale || 10;
  const defaultRating = Math.ceil(ratingScale / 2);

  const reviewFields = [
    { key: "rentValue", label: "Rent value", hint: "Does the rent feel fair for the space and condition?" },
    { key: "warmthInsulation", label: "Warmth & insulation", hint: "Does the flat hold heat without constant power use?" },
    { key: "drynessMould", label: "Dryness & mould control", hint: "Are dampness and condensation properly managed?" },
    { key: "repairsResponse", label: "Repairs response", hint: "Are maintenance issues handled properly?" },
    { key: "noisePrivacy", label: "Noise & privacy", hint: "Can tenants sleep and study without constant disturbance?" },
    { key: "safetySecurity", label: "Safety & security", hint: "Do locks, lighting, and access feel safe?" },
    { key: "sunlightVentilation", label: "Sunlight & ventilation", hint: "Does the flat get useful light and fresh airflow?" },
    { key: "waterPowerReliability", label: "Water & power reliability", hint: "Are hot water, pressure, heating, and sockets dependable?" },
    { key: "landlordCommunication", label: "Landlord communication", hint: "Is communication clear and respectful?" },
    { key: "overallLiveability", label: "Overall liveability", hint: "Would you recommend this flat to someone you care about?" }
  ];

  const state = {
    map: null,
    tileLayer: null,
    propertyLayer: null,
    buildingLayer: null,
    selectedBoundaryLayer: null,
    selectedMarker: null,
    activePropertyLayer: null,
    selected: null,
    rentData: { areas: [], demoFlats: [] },
    demoMarkers: new Map(),
    propertyCache: new Map(),
    buildingCache: new Map(),
    pointCache: new Map(),
    pendingBoundaryTimer: 0,
    propertyAbortController: null,
    buildingAbortController: null,
    clickAbortController: null,
    tileLoadingCount: 0,
    showPropertyLines: true,
    showBuildings: true,
    highlightSelectedBoundary: true,
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
  }

  function bindElements() {
    const ids = [
      "map", "mapStatus", "searchForm", "searchInput", "clearSearch", "wellingtonButton",
      "heroWellingtonButton", "focusButton", "reviewButton", "topReviewButton", "inlineReviewButton",
      "propertyLinesToggle", "buildingToggle", "selectedBoundaryToggle", "detailsEmpty",
      "detailsContent", "photoFrame", "selectedType", "selectedTitle", "selectedSuburb",
      "selectedScore", "rentBenchmark", "rentDescription", "boundarySource", "boundaryDescription",
      "reviewCount", "ratingBreakdown", "reviewList", "reviewComposer", "reviewForm",
      "reviewTargetLabel", "ratingInputs", "reviewNote", "reviewNickname", "reviewTenancyPeriod",
      "reviewWeeklyRent", "reviewRecommend", "cancelReview"
    ];

    ids.forEach((id) => {
      state.elements[id] = document.getElementById(id);
    });

    state.showPropertyLines = state.elements.propertyLinesToggle ? state.elements.propertyLinesToggle.checked : true;
    state.showBuildings = state.elements.buildingToggle ? state.elements.buildingToggle.checked : true;
    state.highlightSelectedBoundary = state.elements.selectedBoundaryToggle ? state.elements.selectedBoundaryToggle.checked : true;
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

    state.map.createPane("buildingPane");
    state.map.createPane("propertyPane");
    state.map.createPane("selectedPane");
    state.map.getPane("buildingPane").classList.add("leaflet-building-pane");
    state.map.getPane("propertyPane").classList.add("leaflet-property-pane");
    state.map.getPane("selectedPane").classList.add("leaflet-selected-pane");
    state.map.getPane("buildingPane").style.zIndex = 390;
    state.map.getPane("propertyPane").style.zIndex = 430;
    state.map.getPane("selectedPane").style.zIndex = 470;

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

    createTileLoadingBadge();
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

    L.control.zoom({ position: "bottomright" }).addTo(state.map);

    addDemoMarkers();

    state.map.whenReady(() => {
      stableInvalidate();
      setTimeout(stableInvalidate, 120);
      setTimeout(scheduleBoundaryLoad, 260);
      setStatus("Map ready. Loading official LINZ property boundaries for this view…");
      if (config.map?.lockDemoFlatsOnLoad !== false) {
        setTimeout(lockDemoFlatsToOfficialBoundaries, 500);
      }
    });

    state.map.on("movestart zoomstart", () => setTileLoading(true));
    state.map.on("moveend zoomend", () => {
      stableInvalidate();
      scheduleBoundaryLoad();
      window.setTimeout(() => setTileLoading(false), 480);
    });

    state.map.on("click", handleMapBackgroundClick);
  }

  function bindTileEvents() {
    state.tileLayer.on("tileloadstart", () => {
      state.tileLoadingCount += 1;
      setTileLoading(true);
    });

    state.tileLayer.on("tileload tileabort", () => {
      state.tileLoadingCount = Math.max(0, state.tileLoadingCount - 1);
      if (state.tileLoadingCount === 0) {
        setTimeout(() => setTileLoading(false), 220);
      }
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

  function createTileLoadingBadge() {
    const badge = document.createElement("div");
    badge.id = "tileLoading";
    badge.setAttribute("aria-hidden", "true");
    badge.textContent = "Loading map tiles";
    state.elements.map.appendChild(badge);
    state.elements.tileLoading = badge;
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
        state.buildingLayer?.clearLayers();
        setStatus("Building outlines hidden. Property boundaries are still selectable.");
        return;
      }
      scheduleBoundaryLoad();
    });

    state.elements.selectedBoundaryToggle?.addEventListener("change", () => {
      state.highlightSelectedBoundary = state.elements.selectedBoundaryToggle.checked;
      refreshSelectedBoundary();
      setStatus(state.highlightSelectedBoundary ? "Selected-property outline enabled." : "Selected-property outline hidden.");
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
      setStatus(`Moved to ${place.display_name || query}. Click the exact property to select it.`);
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
      className: `demo-marker ${ratingClass(value)} ${flat.lockedToLinz ? "is-locked" : ""}`,
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
      <strong>${escapeHtml(flat.title)}</strong>
      <p>${escapeHtml(flat.note)}</p>
      <p><strong>${escapeHtml(score)} / ${ratingScale}</strong></p>
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
      setStatus(`Zoom to level ${parcelZoom} or closer to load official LINZ property boundaries.`);
      return;
    }

    const bounds = state.map.getBounds().pad(0.08);
    if (isQueryTooLarge(bounds)) {
      state.propertyLayer.clearLayers();
      state.buildingLayer.clearLayers();
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
      await loadArcGisGeoJson({
        layerName: "building",
        url: config.urls?.buildingOutlines,
        bounds,
        targetLayer: state.buildingLayer,
        cache: state.buildingCache,
        abortKey: "buildingAbortController",
        outFields: config.linz?.buildingOutFields || "*",
        resultRecordCount: 1000
      });
    } else {
      state.buildingLayer.clearLayers();
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

    if (state[abortKey]) {
      state[abortKey].abort();
    }

    const controller = new AbortController();
    state[abortKey] = controller;

    try {
      const requestUrl = buildArcGisEnvelopeQueryUrl(url, bounds, outFields, layerName, resultRecordCount);
      const response = await fetch(requestUrl, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`${layerName} request failed with ${response.status}`);
      }

      const geoJson = await response.json();
      if (!geoJson || !Array.isArray(geoJson.features)) {
        throw new Error(`${layerName} response was not GeoJSON`);
      }

      cache.set(cacheKey, geoJson);
      trimCache(cache, 16);
      applyGeoJsonToLayer(targetLayer, geoJson);
      updateBoundaryStatus(layerName, geoJson);
      return geoJson;
    } catch (error) {
      if (error.name === "AbortError") return null;
      console.warn(`Flatwise ${layerName} load failed:`, error);
      if (layerName === "property") {
        setStatus("LINZ property boundaries could not load right now. Click the map again or try a smaller view.");
      }
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

    if (state.activePropertyLayer && state.activePropertyLayer !== layer) {
      handlePropertyOut(state.activePropertyLayer);
    }

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

    if (state.activePropertyLayer === layer) {
      state.activePropertyLayer = null;
    }

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

    if (layer) {
      layer.setStyle(propertyStyle("muted"));
    }

    renderSelectedDetails();

    if (options.scroll) scrollToReviewComposer({ focusNote: false });
    setStatus("Official LINZ property selected. The review form is ready below.");
  }

  async function selectDemoFlat(flat, marker) {
    marker?.openPopup();

    if (!flat.boundaryFeature && config.map?.lockDemoFlatsOnLoad !== false) {
      setStatus("Checking the official LINZ boundary for this demo flat…");
      const feature = await queryPropertyAtPoint(L.latLng(flat.lat, flat.lng), { allowTinyEnvelope: true });
      if (feature) {
        const centre = getFeatureCentre(feature) || L.latLng(flat.lat, flat.lng);
        flat.lockedToLinz = true;
        flat.lockedPropertyId = propertyId(feature);
        flat.boundaryFeature = feature;
        flat.lat = centre.lat;
        flat.lng = centre.lng;
        marker?.setLatLng(centre);
        updateDemoMarker(flat);
      }
    }

    state.selected = targetFromDemoFlat(flat);
    setSelectedMarker(state.selected.centre);
    refreshSelectedBoundary();
    renderSelectedDetails();

    const feature = state.selected.boundaryFeature;
    if (feature) {
      const bounds = getFeatureBounds(feature);
      if (bounds?.isValid()) {
        state.map.fitBounds(bounds.pad(0.34), { maxZoom: 19, animate: true, duration: 0.65 });
      } else {
        state.map.flyTo(state.selected.centre, Math.max(state.map.getZoom(), 18), { duration: 0.65 });
      }
      setStatus(flat.lockedToLinz ? "Demo flat selected and locked to its official LINZ property boundary." : "Demo flat selected with boundary geometry.");
    } else {
      state.map.flyTo(state.selected.centre, Math.max(state.map.getZoom(), 18), { duration: 0.65 });
      setStatus("Demo flat selected. LINZ did not return a boundary for this marker yet.");
    }

    scrollToReviewComposer({ focusNote: false });
  }

  async function handleMapBackgroundClick(event) {
    if (!event.latlng) return;
    await lookupAndSelectPropertyAt(event.latlng, { source: "map-click", focus: true });
  }

  async function lookupAndSelectPropertyAt(latLng, options = {}) {
    setStatus("Looking up the exact official LINZ property under your click…");

    const feature = await queryPropertyAtPoint(latLng, { allowTinyEnvelope: true });
    if (!feature) {
      setStatus("No LINZ property boundary was found exactly under that point. Try clicking inside the property shape or zooming closer.");
      return null;
    }

    selectPropertyFeature(feature, null, { focus: options.focus !== false, scroll: true });
    return feature;
  }

  async function queryPropertyAtPoint(latLng, options = {}) {
    if (!latLng || !Number.isFinite(latLng.lat) || !Number.isFinite(latLng.lng)) return null;

    const cacheKey = `${latLng.lat.toFixed(7)},${latLng.lng.toFixed(7)}`;
    if (state.pointCache.has(cacheKey)) return state.pointCache.get(cacheKey);

    if (state.clickAbortController) state.clickAbortController.abort();
    const controller = new AbortController();
    state.clickAbortController = controller;

    try {
      let geoJson = await runPointPropertyQuery(latLng, controller.signal);
      if ((!geoJson || !geoJson.features?.length) && options.allowTinyEnvelope) {
        geoJson = await runTinyEnvelopePropertyQuery(latLng, controller.signal);
      }

      const feature = chooseBestFeatureForPoint(geoJson?.features || [], latLng);
      state.pointCache.set(cacheKey, feature || null);
      trimCache(state.pointCache, 60);
      return feature || null;
    } catch (error) {
      if (error.name === "AbortError") return null;
      console.warn("LINZ point lookup failed:", error);
      setStatus("Could not complete the LINZ point lookup. Try again in a moment.");
      return null;
    }
  }

  async function runPointPropertyQuery(latLng, signal) {
    const geometry = {
      x: latLng.lng,
      y: latLng.lat,
      spatialReference: { wkid: 4326 }
    };

    const url = new URL(config.urls?.propertyBoundaries);
    url.searchParams.set("f", "geojson");
    url.searchParams.set("where", "1=1");
    url.searchParams.set("outFields", config.linz?.propertyOutFields || "*");
    url.searchParams.set("returnGeometry", "true");
    url.searchParams.set("spatialRel", "esriSpatialRelIntersects");
    url.searchParams.set("geometryType", "esriGeometryPoint");
    url.searchParams.set("inSR", "4326");
    url.searchParams.set("outSR", "4326");
    url.searchParams.set("geometry", JSON.stringify(geometry));
    url.searchParams.set("resultRecordCount", "12");
    url.searchParams.set("geometryPrecision", "7");

    return fetchJson(url.toString(), 9000, signal);
  }

  async function runTinyEnvelopePropertyQuery(latLng, signal) {
    const radius = config.map?.pointLookupRadiusDegrees || 0.00028;
    const bounds = L.latLngBounds(
      [latLng.lat - radius, latLng.lng - radius],
      [latLng.lat + radius, latLng.lng + radius]
    );

    const url = buildArcGisEnvelopeQueryUrl(
      config.urls?.propertyBoundaries,
      bounds,
      config.linz?.propertyOutFields || "*",
      "property",
      24
    );

    return fetchJson(url, 9000, signal);
  }

  function chooseBestFeatureForPoint(features, latLng) {
    if (!Array.isArray(features) || features.length === 0) return null;

    const containing = features.filter((feature) => featureContainsLatLng(feature, latLng));
    const candidates = containing.length ? containing : features;

    return candidates.slice().sort((a, b) => {
      const areaA = propertyArea(a) || Infinity;
      const areaB = propertyArea(b) || Infinity;
      if (areaA !== areaB) return areaA - areaB;
      const centreA = getFeatureCentre(a);
      const centreB = getFeatureCentre(b);
      const distA = centreA ? distanceMeters(latLng.lat, latLng.lng, centreA.lat, centreA.lng) : Infinity;
      const distB = centreB ? distanceMeters(latLng.lat, latLng.lng, centreB.lat, centreB.lng) : Infinity;
      return distA - distB;
    })[0];
  }

  function findDemoFlatForProperty(propertyIdValue) {
    for (const entry of state.demoMarkers.values()) {
      if (entry.flat?.lockedPropertyId && entry.flat.lockedPropertyId === propertyIdValue) {
        return entry.flat;
      }
    }
    return null;
  }

  function refreshSelectedBoundary() {
    state.selectedBoundaryLayer?.clearLayers();
    if (!state.highlightSelectedBoundary || !state.selected) return;

    const feature = state.selected.boundaryFeature || state.selected.feature;
    if (feature) {
      state.selectedBoundaryLayer.addData(feature);
    }
  }

  function setSelectedMarker(latLng) {
    if (!latLng) return;
    if (state.selectedMarker) state.selectedMarker.remove();

    state.selectedMarker = L.marker(latLng, {
      icon: L.divIcon({
        className: "selected-marker",
        html: "",
        iconSize: [40, 40],
        iconAnchor: [20, 35]
      }),
      interactive: false,
      zIndexOffset: 1000
    }).addTo(state.map);
  }

  function renderEmptyDetails() {
    state.elements.detailsEmpty?.classList.remove("hidden");
    state.elements.detailsContent?.classList.add("hidden");
    if (state.elements.reviewTargetLabel) {
      state.elements.reviewTargetLabel.textContent = "No property selected";
    }
  }

  function renderSelectedDetails() {
    if (!state.selected) {
      renderEmptyDetails();
      return;
    }

    const target = state.selected;
    const centre = target.centre || getFeatureCentre(target.boundaryFeature || target.feature);
    const rent = findRentArea(centre);
    const reviews = getReviewsForTarget(target);
    const average = calculateOverall(reviews);

    state.elements.detailsEmpty?.classList.add("hidden");
    state.elements.detailsContent?.classList.remove("hidden");

    setText("selectedType", target.type === "demo" ? "Demo flat locked to LINZ" : "Official LINZ property");
    setText("selectedTitle", target.title || "Selected property boundary");
    setText("selectedSuburb", rent?.name || target.feature?.properties?.territorial_authority || "Wellington area");
    setText("boundarySource", boundarySourceText(target));
    setText("boundaryDescription", boundaryDescriptionText(target));
    setRatingPill(state.elements.selectedScore, average);

    if (rent) {
      setText("rentBenchmark", rent.weeklyRent || "Local guide");
      setText("rentDescription", rent.description || "Area-based rent guidance loaded from the local demo data file.");
    } else {
      setText("rentBenchmark", "No local data");
      setText("rentDescription", "No demo rent guide is currently available for this selected area.");
    }

    renderPhoto(centre, target.title);
    renderRatingBreakdown(reviews);
    renderReviewList(reviews);

    if (state.elements.reviewTargetLabel) {
      state.elements.reviewTargetLabel.textContent = target.title || "Selected property boundary";
    }
  }

  function boundarySourceText(target) {
    if (target.type === "demo" && target.boundaryFeature) return "LINZ NZ Property Boundaries + demo review";
    if (target.boundaryFeature || target.feature) return "LINZ NZ Property Boundaries";
    return "Map location";
  }

  function boundaryDescriptionText(target) {
    const feature = target.boundaryFeature || target.feature;
    if (!feature) return "No official boundary is attached yet. Click the map again or zoom closer.";

    const description = boundaryDescription(feature);
    if (target.type === "demo") {
      return `This demo flat is snapped to the official LINZ property polygon. ${description}`;
    }
    return description;
  }

  async function renderPhoto(centre, title) {
    if (!state.elements.photoFrame) return;

    const requestId = ++state.streetViewRequestId;
    const streetViewSettings = getStreetViewSettings();

    if (!centre) {
      renderStreetViewPlaceholder(title, "Select a property first so Flatwise can look for nearby Street View imagery.");
      return;
    }

    if (!streetViewSettings.enabled) {
      renderStreetViewPlaceholder(title, "Street imagery is disabled. Enable Street View and add a restricted Google key in js/config.js.");
      return;
    }

    if (!streetViewSettings.key || streetViewSettings.key === "YOUR_RESTRICTED_KEY" || streetViewSettings.key.includes("PASTE_")) {
      renderStreetViewPlaceholder(title, "Street imagery needs a restricted Google Street View Static API key in js/config.js.");
      return;
    }

    renderStreetViewLoading(title);

    try {
      const metadata = await getStreetViewMetadata(centre.lat, centre.lng);
      if (requestId !== state.streetViewRequestId) return;

      if (!metadata || metadata.status !== "OK" || !metadata.pano_id) {
        const message = metadata?.status
          ? `Google Street View returned ${metadata.status} for this selected property.`
          : "Google Street View did not return imagery for this selected property.";
        renderStreetViewPlaceholder(title, message);
        return;
      }

      const panoLocation = metadata.location || {};
      const heading = Number.isFinite(panoLocation.lat) && Number.isFinite(panoLocation.lng)
        ? calculateHeading(panoLocation.lat, panoLocation.lng, centre.lat, centre.lng)
        : streetViewSettings.placeholderHeading;
      const imageUrl = buildStreetViewImageUrl(metadata.pano_id, heading);

      state.elements.photoFrame.innerHTML = "";
      const img = document.createElement("img");
      img.src = imageUrl;
      img.alt = `Google Street View near ${title || "selected property"}`;
      img.loading = "lazy";
      img.decoding = "async";
      img.addEventListener("error", () => {
        if (requestId === state.streetViewRequestId) {
          renderStreetViewPlaceholder(title, "Street View metadata exists, but the image could not load. Check the API key restrictions and quota.");
        }
      });

      const caption = document.createElement("div");
      caption.className = "streetview-meta";
      const date = metadata.date ? ` · ${escapeHtml(metadata.date)}` : "";
      caption.innerHTML = `Google Street View${date}<br>${escapeHtml(metadata.copyright || "© Google")}`;

      state.elements.photoFrame.appendChild(img);
      state.elements.photoFrame.appendChild(caption);
    } catch (error) {
      if (requestId !== state.streetViewRequestId) return;
      console.warn("Street View metadata lookup failed:", error);
      renderStreetViewPlaceholder(title, "Street View could not be checked. Confirm the key allows Street View Static API and this website referrer.");
    }
  }

  function getStreetViewSettings() {
    const streetView = config.streetView || {};
    return {
      enabled: Boolean(config.enableStreetView || streetView.enableStreetView || streetView.enableGoogleStreetView),
      key: config.googleStreetViewApiKey || streetView.googleStreetViewApiKey || "",
      radius: Number.isFinite(streetView.searchRadiusMeters) ? streetView.searchRadiusMeters : 80,
      imageSize: streetView.imageSize || "640x360",
      fov: Number.isFinite(streetView.fov) ? streetView.fov : 75,
      pitch: Number.isFinite(streetView.pitch) ? streetView.pitch : 0,
      placeholderHeading: Number.isFinite(streetView.placeholderHeading) ? streetView.placeholderHeading : 0
    };
  }

  async function getStreetViewMetadata(lat, lng) {
    const streetViewSettings = getStreetViewSettings();
    const url = new URL("https://maps.googleapis.com/maps/api/streetview/metadata");
    url.searchParams.set("location", `${lat},${lng}`);
    url.searchParams.set("radius", String(streetViewSettings.radius));
    url.searchParams.set("key", streetViewSettings.key);

    const response = await fetch(url.toString(), { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Street View metadata request failed with HTTP ${response.status}`);
    }
    return await response.json();
  }

  function buildStreetViewImageUrl(panoId, heading) {
    const streetViewSettings = getStreetViewSettings();
    const url = new URL("https://maps.googleapis.com/maps/api/streetview");
    url.searchParams.set("size", streetViewSettings.imageSize);
    url.searchParams.set("pano", panoId);
    url.searchParams.set("heading", Number(heading || 0).toFixed(0));
    url.searchParams.set("pitch", String(streetViewSettings.pitch));
    url.searchParams.set("fov", String(streetViewSettings.fov));
    url.searchParams.set("key", streetViewSettings.key);
    return url.toString();
  }

  function renderStreetViewLoading(title) {
    state.elements.photoFrame.innerHTML = `
      <div class="photo-placeholder loading">
        <span>⌕</span>
        <strong>${escapeHtml(title || "Selected property")}</strong>
        <small>Checking Google Street View metadata before loading an image…</small>
      </div>
    `;
  }

  function renderStreetViewPlaceholder(title, message) {
    state.elements.photoFrame.innerHTML = `
      <div class="photo-placeholder">
        <span>⌂</span>
        <strong>${escapeHtml(title || "Selected property")}</strong>
        <small>${escapeHtml(message)}</small>
      </div>
    `;
  }

  function calculateHeading(fromLat, fromLng, toLat, toLng) {
    const fromLatRad = degreesToRadians(fromLat);
    const toLatRad = degreesToRadians(toLat);
    const deltaLngRad = degreesToRadians(toLng - fromLng);
    const y = Math.sin(deltaLngRad) * Math.cos(toLatRad);
    const x = Math.cos(fromLatRad) * Math.sin(toLatRad) - Math.sin(fromLatRad) * Math.cos(toLatRad) * Math.cos(deltaLngRad);
    return (radiansToDegrees(Math.atan2(y, x)) + 360) % 360;
  }

  function degreesToRadians(degrees) {
    return (Number(degrees) * Math.PI) / 180;
  }

  function radiansToDegrees(radians) {
    return (Number(radians) * 180) / Math.PI;
  }

  function renderRatingBreakdown(reviews) {
    if (!state.elements.ratingBreakdown) return;
    state.elements.ratingBreakdown.innerHTML = "";

    reviewFields.forEach((field) => {
      const value = calculateFieldAverage(reviews, field.key);
      const display = Number.isFinite(value) ? value.toFixed(1) : "—";
      const width = Number.isFinite(value) ? `${Math.max(3, (value / ratingScale) * 100)}%` : "0%";
      const row = document.createElement("div");
      row.className = "breakdown-row";
      row.innerHTML = `
        <div><span>${escapeHtml(field.label)}</span><strong>${display}</strong></div>
        <i><b style="width:${width}"></b></i>
      `;
      state.elements.ratingBreakdown.appendChild(row);
    });
  }

  function renderReviewList(reviews) {
    if (!state.elements.reviewList) return;
    state.elements.reviewList.innerHTML = "";
    setText("reviewCount", String(reviews.length));

    if (reviews.length === 0) {
      const empty = document.createElement("article");
      empty.className = "review-card";
      empty.innerHTML = `<p>No tenant notes saved yet. Add a local review to test the prototype flow.</p>`;
      state.elements.reviewList.appendChild(empty);
      return;
    }

    reviews.slice().reverse().forEach((review) => {
      const card = document.createElement("article");
      card.className = `review-card ${review.seed ? "seed-review" : ""}`;
      const score = calculateReviewScore(review);
      const date = review.createdAt ? new Date(review.createdAt).toLocaleDateString() : "Demo review";
      const metaParts = [];
      if (review.recommend) metaParts.push(`Recommend: ${escapeHtml(review.recommend)}`);
      if (review.weeklyRent) metaParts.push(`Rent: ${escapeHtml(review.weeklyRent)}`);
      if (review.tenancyPeriod) metaParts.push(`Period: ${escapeHtml(review.tenancyPeriod)}`);
      const meta = metaParts.join(" · ");

      card.innerHTML = `
        <header>
          <strong>${Number.isFinite(score) ? score.toFixed(1) : "—"} / ${ratingScale}</strong>
          <span>${escapeHtml(date)}${review.seed ? " · demo" : ""}</span>
        </header>
        ${meta ? `<p class="review-meta">${meta}</p>` : ""}
        <p>${escapeHtml(review.note || "No note added.")}</p>
      `;
      state.elements.reviewList.appendChild(card);
    });
  }

  function createRatingInputs() {
    if (!state.elements.ratingInputs) return;
    state.elements.ratingInputs.innerHTML = "";

    reviewFields.forEach((field) => {
      const wrapper = document.createElement("div");
      wrapper.className = "rating-field";
      wrapper.innerHTML = `
        <label for="rating-${escapeHtml(field.key)}">
          <span>${escapeHtml(field.label)}</span>
          <output id="output-${escapeHtml(field.key)}">${defaultRating}</output>
        </label>
        <input id="rating-${escapeHtml(field.key)}" type="range" min="1" max="${ratingScale}" step="1" value="${defaultRating}" />
        <small>${escapeHtml(field.hint)}</small>
      `;

      const input = wrapper.querySelector("input");
      const output = wrapper.querySelector("output");
      input.addEventListener("input", () => {
        output.textContent = input.value;
      });

      state.elements.ratingInputs.appendChild(wrapper);
    });
  }

  function openReviewComposer() {
    if (!state.selected) {
      setStatus("Select a demo flat marker or property boundary before writing a review.");
      scrollToMap();
      return;
    }

    scrollToReviewComposer({ focusNote: true, delay: 80 });
    setStatus("Review form ready. Your rating will be saved locally for the selected property.");
  }

  function saveReview() {
    if (!state.selected) {
      setStatus("Select a property on the map before saving a review.");
      scrollToMap();
      return;
    }

    const review = {
      createdAt: new Date().toISOString(),
      nickname: state.elements.reviewNickname?.value.trim() || "",
      tenancyPeriod: state.elements.reviewTenancyPeriod?.value.trim() || "",
      weeklyRent: state.elements.reviewWeeklyRent?.value.trim() || "",
      recommend: state.elements.reviewRecommend?.value || "",
      note: state.elements.reviewNote?.value.trim() || "",
      propertyTitle: state.selected.title,
      propertyId: state.selected.id,
      ratings: {}
    };

    reviewFields.forEach((field) => {
      const input = document.getElementById(`rating-${field.key}`);
      review.ratings[field.key] = clampRating(Number(input?.value || defaultRating));
    });

    const localReviews = getLocalReviews(state.selected.id);
    localReviews.push(review);
    localStorage.setItem(storageKey(state.selected.id), JSON.stringify(localReviews));

    resetReviewForm();
    renderSelectedDetails();
    scrollToReviewComposer({ delay: 80 });

    if (state.selected.type === "demo" && state.selected.demoFlat) {
      updateDemoMarker(state.selected.demoFlat);
    }

    setStatus("Review saved locally in this browser.");
  }

  function resetReviewForm() {
    state.elements.reviewForm?.reset();
    reviewFields.forEach((field) => setText(`output-${field.key}`, String(defaultRating)));
  }

  function getReviewsForTarget(target) {
    if (!target) return [];
    const seed = getSeedReviewsForTarget(target);
    const local = getLocalReviews(target.id);
    return [...seed, ...local];
  }

  function getSeedReviewsForTarget(target) {
    if (target.type === "demo" && target.demoFlat) {
      return getSeedReviews(target.demoFlat);
    }

    if (target.id?.startsWith("property:")) {
      const propertyIdValue = target.id.replace("property:", "");
      const demo = findDemoFlatForProperty(propertyIdValue);
      if (demo) return getSeedReviews(demo);
    }

    return [];
  }

  function getSeedReviews(flat) {
    return (flat.seedReviews || []).map((review) => ({ ...review, seed: true }));
  }

  function getLocalReviews(id) {
    try {
      const raw = localStorage.getItem(storageKey(id));
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn("Could not read Flatwise reviews:", error);
      return [];
    }
  }

  function storageKey(id) {
    return `${config.reviews?.storagePrefix || "flatwise_linz_reviews_v1:"}${id}`;
  }

  function propertyStyle(type) {
    if (type === "hover") {
      return { color: "#0a6b44", weight: 3, opacity: 1, fillColor: "#1f7a4f", fillOpacity: 0.2 };
    }
    if (type === "selected") {
      return { color: "#d13d2f", weight: 4.5, opacity: 1, fillColor: "#d13d2f", fillOpacity: 0.22 };
    }
    if (type === "muted") {
      return { color: "#5e6965", weight: 1.35, opacity: 0.65, fillColor: "#fffaf0", fillOpacity: 0.05 };
    }
    return { color: "#16211c", weight: 1.15, opacity: 0.58, fillColor: "#fffaf0", fillOpacity: 0.09 };
  }

  function buildingStyle() {
    return { color: "#2f6fb2", weight: 1, opacity: 0.42, fillColor: "#2f6fb2", fillOpacity: 0.08 };
  }

  function propertyTitle(feature) {
    const p = feature?.properties || {};
    const legal = firstMeaningful([p.legal_description, p.title_no ? `Title ${p.title_no}` : ""]);
    const source = firstMeaningful([p.source, p.title_type, "Property boundary"]);
    return firstMeaningful([legal, source, p.valuation_reference ? `Valuation ${p.valuation_reference}` : "", `LINZ property ${propertyId(feature)}`]);
  }

  function propertyId(feature) {
    const p = feature?.properties || {};
    return String(firstMeaningful([
      p.unit_of_property_id,
      p.source_id,
      p.valuation_reference_ascii,
      p.valuation_reference,
      p.title_no,
      p.parcel_id,
      p.untitled_land_id,
      p.OBJECTID,
      p.objectid,
      stableGeometryKey(feature),
      "unknown-property"
    ]));
  }

  function sameProperty(a, b) {
    return propertyId(a) === propertyId(b);
  }

  function propertyArea(feature) {
    const p = feature?.properties || {};
    const area = Number(p.area || p.Shape__Area || p.SHAPE__Area);
    return Number.isFinite(area) && area > 0 ? area : 0;
  }

  function boundaryDescription(feature) {
    const p = feature?.properties || {};
    const source = firstMeaningful([p.source, p.title_type, "property boundary"]);
    const legal = firstMeaningful([p.legal_description, p.title_no ? `Title ${p.title_no}` : ""]);
    const authority = firstMeaningful([p.territorial_authority, p.territorial_authority_ascii]);
    const area = propertyArea(feature);
    const fragments = [];

    fragments.push(`Official LINZ ${source} polygon.`);
    if (legal) fragments.push(`Legal reference: ${legal}.`);
    if (authority) fragments.push(`Territorial authority: ${authority}.`);
    if (area) fragments.push(`Approximate area: ${Math.round(area).toLocaleString()} square metres.`);
    fragments.push("Use this for map review selection only, not for legal boundary definition.");

    return fragments.join(" ");
  }

  function stableGeometryKey(feature) {
    try {
      return btoa(JSON.stringify(feature?.geometry || {}).slice(0, 96)).replace(/=+$/, "");
    } catch {
      return "";
    }
  }

  function featureContainsLatLng(feature, latLng) {
    const geometry = feature?.geometry;
    if (!geometry || !latLng) return false;

    const x = latLng.lng;
    const y = latLng.lat;

    if (geometry.type === "Polygon") {
      return polygonContainsPoint(geometry.coordinates, x, y);
    }

    if (geometry.type === "MultiPolygon") {
      return geometry.coordinates.some((polygon) => polygonContainsPoint(polygon, x, y));
    }

    return false;
  }

  function polygonContainsPoint(rings, x, y) {
    if (!Array.isArray(rings) || rings.length === 0) return false;
    const outer = rings[0];
    if (!ringContainsPoint(outer, x, y)) return false;

    for (let i = 1; i < rings.length; i += 1) {
      if (ringContainsPoint(rings[i], x, y)) return false;
    }

    return true;
  }

  function ringContainsPoint(ring, x, y) {
    let inside = false;
    if (!Array.isArray(ring)) return false;

    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const xi = Number(ring[i][0]);
      const yi = Number(ring[i][1]);
      const xj = Number(ring[j][0]);
      const yj = Number(ring[j][1]);
      const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi;
      if (intersects) inside = !inside;
    }

    return inside;
  }

  function getFeatureBounds(feature) {
    try {
      const layer = L.geoJSON(feature);
      return layer.getBounds();
    } catch {
      return null;
    }
  }

  function getFeatureCentre(feature) {
    const bounds = getFeatureBounds(feature);
    return bounds?.isValid() ? bounds.getCenter() : null;
  }

  function findRentArea(centre) {
    if (!centre || !Array.isArray(state.rentData?.areas)) return null;

    let best = null;
    let bestDistance = Infinity;
    state.rentData.areas.forEach((area) => {
      if (!Number.isFinite(Number(area.lat)) || !Number.isFinite(Number(area.lng))) return;
      const distance = distanceMeters(centre.lat, centre.lng, Number(area.lat), Number(area.lng));
      if (distance < bestDistance) {
        best = area;
        bestDistance = distance;
      }
    });

    return bestDistance <= 2600 ? best : null;
  }

  function calculateOverall(reviews) {
    if (!reviews.length) return NaN;
    const scores = reviews.map(calculateReviewScore).filter(Number.isFinite);
    if (!scores.length) return NaN;
    return scores.reduce((sum, value) => sum + value, 0) / scores.length;
  }

  function calculateReviewScore(review) {
    const ratings = review?.ratings || {};
    const values = reviewFields.map((field) => Number(ratings[field.key])).filter(Number.isFinite);
    if (!values.length) return NaN;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  function calculateFieldAverage(reviews, key) {
    const values = reviews.map((review) => Number(review?.ratings?.[key])).filter(Number.isFinite);
    if (!values.length) return NaN;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  function setRatingPill(el, value) {
    if (!el) return;
    if (!Number.isFinite(value)) {
      el.textContent = "No rating";
      el.className = "rating-pill";
      return;
    }

    el.textContent = `${value.toFixed(1)} / ${ratingScale}`;
    el.className = `rating-pill ${ratingClass(value)}`;
  }

  function ratingClass(value) {
    if (!Number.isFinite(value)) return "";
    if (value >= 7.5) return "good";
    if (value >= 5) return "warning";
    return "bad";
  }

  function clampRating(value) {
    if (!Number.isFinite(value)) return defaultRating;
    return Math.max(1, Math.min(ratingScale, Math.round(value)));
  }

  function distanceMeters(lat1, lon1, lat2, lon2) {
    const earthRadius = 6371000;
    const toRad = (degrees) => (degrees * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  async function fetchJson(url, timeoutMs = 8000, signal = null) {
    const controller = signal ? null : new AbortController();
    const activeSignal = signal || controller.signal;
    const timeout = controller ? window.setTimeout(() => controller.abort(), timeoutMs) : 0;

    try {
      const response = await fetch(url, {
        signal: activeSignal,
        headers: { Accept: "application/json, application/geo+json" }
      });
      if (!response.ok) throw new Error(`Request failed with ${response.status}`);
      return await response.json();
    } finally {
      if (timeout) window.clearTimeout(timeout);
    }
  }

  function setStatus(message) {
    if (state.elements.mapStatus) {
      state.elements.mapStatus.textContent = message;
    }
  }

  function setText(id, text) {
    const element = state.elements[id] || document.getElementById(id);
    if (element) element.textContent = text ?? "";
  }

  function firstMeaningful(values) {
    for (const value of values) {
      if (value === null || value === undefined) continue;
      const text = String(value).trim();
      if (text && text.toLowerCase() !== "null" && text.toLowerCase() !== "undefined") return text;
    }
    return "";
  }

  function slugify(value) {
    return String(value || "flatwise")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "flatwise";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function structuredCloneSafe(value) {
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }
})();
