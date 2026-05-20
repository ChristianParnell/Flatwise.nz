(() => {
  "use strict";

  const config = window.FLATWISE_CONFIG || {};
  const ratingScale = config.reviews?.ratingScale || 10;
  const defaultRating = Math.ceil(ratingScale / 2);

  const reviewFields = [
    {
      key: "rentValue",
      label: "Rent value",
      hint: "Does the rent feel fair for the space, condition, and location?"
    },
    {
      key: "warmthInsulation",
      label: "Warmth & insulation",
      hint: "Does the flat hold heat without needing constant power use?"
    },
    {
      key: "drynessMould",
      label: "Dryness & mould control",
      hint: "Are dampness, condensation, and mould properly under control?"
    },
    {
      key: "repairsResponse",
      label: "Repairs response",
      hint: "Are maintenance issues handled quickly and properly?"
    },
    {
      key: "noisePrivacy",
      label: "Noise & privacy",
      hint: "Can tenants sleep, study, and live without constant disturbance?"
    },
    {
      key: "safetySecurity",
      label: "Safety & security",
      hint: "Do locks, lighting, access, and the surrounding area feel safe?"
    },
    {
      key: "sunlightVentilation",
      label: "Sunlight & ventilation",
      hint: "Does the flat get useful natural light and fresh airflow?"
    },
    {
      key: "waterPowerReliability",
      label: "Water & power reliability",
      hint: "Are hot water, pressure, heating, sockets, and utilities dependable?"
    },
    {
      key: "landlordCommunication",
      label: "Landlord communication",
      hint: "Is communication clear, respectful, and not unnecessarily stressful?"
    },
    {
      key: "overallLiveability",
      label: "Overall liveability",
      hint: "Would you recommend this flat to someone you care about?"
    }
  ];

  const state = {
    map: null,
    tileLayer: null,
    parcelLayer: null,
    buildingLayer: null,
    selectedBoundaryLayer: null,
    selectedMarker: null,
    activeParcelLayer: null,
    selected: null,
    rentData: null,
    demoMarkers: new Map(),
    parcelCache: new Map(),
    buildingCache: new Map(),
    pendingBoundaryTimer: 0,
    parcelAbortController: null,
    buildingAbortController: null,
    tileLoadingCount: 0,
    showPropertyLines: true,
    highlightSelectedBoundary: true,
    elements: {}
  };

  document.addEventListener("DOMContentLoaded", () => {
    init().catch((error) => {
      console.error("Flatwise failed to initialise:", error);
      setStatus("Flatwise could not finish loading. Check the browser console for the exact error.");
    });
  });

  async function init() {
    bindElements();
    createRatingInputs();

    if (!window.L) {
      setStatus("Leaflet did not load. Check the CDN integrity hash or your network connection.");
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
      "propertyLinesToggle", "selectedBoundaryToggle", "detailsEmpty", "detailsContent", "photoFrame",
      "selectedType", "selectedTitle", "selectedSuburb", "selectedScore", "rentBenchmark", "rentDescription",
      "boundarySource", "boundaryDescription", "reviewCount", "ratingBreakdown", "reviewList", "reviewDialog",
      "reviewForm", "reviewDialogSuburb", "ratingInputs", "reviewNote", "reviewNickname", "reviewTenancyPeriod",
      "reviewWeeklyRent", "reviewRecommend", "cancelReview", "closeDialog"
    ];

    ids.forEach((id) => {
      state.elements[id] = document.getElementById(id);
    });

    state.showPropertyLines = state.elements.propertyLinesToggle ? state.elements.propertyLinesToggle.checked : true;
    state.highlightSelectedBoundary = state.elements.selectedBoundaryToggle ? state.elements.selectedBoundaryToggle.checked : true;
  }

  async function loadRentData() {
    try {
      state.rentData = await fetchJson(config.urls.rentData || "data/rent-data.json", 6000);
    } catch (error) {
      console.warn("Rent and demo-flat data could not be loaded:", error);
      state.rentData = { areas: [], demoFlats: [] };
    }
  }

  function createMap() {
    const mapSettings = config.map || {};
    const startCenter = mapSettings.startCenter || [-41.2924, 174.7787];
    const startZoom = Number.isFinite(mapSettings.startZoom) ? mapSettings.startZoom : 17;

    state.map = L.map("map", {
      center: startCenter,
      zoom: startZoom,
      minZoom: mapSettings.minZoom || 6,
      maxZoom: mapSettings.maxZoom || 20,
      zoomSnap: 1,
      zoomDelta: 1,
      wheelPxPerZoomLevel: 120,
      worldCopyJump: true,
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

    state.tileLayer = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 20,
      maxNativeZoom: 19,
      tileSize: 256,
      zoomOffset: 0,
      detectRetina: false,
      crossOrigin: true,
      keepBuffer: 5,
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

    state.parcelLayer = L.geoJSON(null, {
      pane: "propertyPane",
      style: () => parcelStyle("normal"),
      onEachFeature: onEachParcel
    }).addTo(state.map);

    state.selectedBoundaryLayer = L.geoJSON(null, {
      pane: "selectedPane",
      interactive: false,
      style: () => parcelStyle("selected")
    }).addTo(state.map);

    addDemoMarkers();

    state.map.whenReady(() => {
      stableInvalidate();
      setTimeout(stableInvalidate, 120);
      setTimeout(scheduleBoundaryLoad, 260);
      setStatus("Map ready. Click a demo flat marker, or zoom closer and click a parcel boundary.");
    });

    state.map.on("movestart zoomstart", () => setTileLoading(true));
    state.map.on("moveend zoomend", () => {
      stableInvalidate();
      scheduleBoundaryLoad();
      window.setTimeout(() => setTileLoading(false), 480);
    });
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
        setStatus("A map tile failed to load. Try a small pan or zoom to request it again.");
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
    badge.innerHTML = "<span></span> Loading map tiles";
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
    state.elements.reviewButton?.addEventListener("click", openReviewDialog);
    state.elements.topReviewButton?.addEventListener("click", openReviewDialog);
    state.elements.inlineReviewButton?.addEventListener("click", openReviewDialog);
    state.elements.cancelReview?.addEventListener("click", closeReviewDialog);
    state.elements.closeDialog?.addEventListener("click", closeReviewDialog);
    state.elements.clearSearch?.addEventListener("click", clearSearch);

    state.elements.propertyLinesToggle?.addEventListener("change", () => {
      state.showPropertyLines = state.elements.propertyLinesToggle.checked;
      if (!state.showPropertyLines) {
        state.parcelLayer?.clearLayers();
        state.buildingLayer?.clearLayers();
        state.selectedBoundaryLayer?.clearLayers();
        setStatus("Property-line overlay turned off. Demo flat reviews still work normally.");
        return;
      }
      setStatus("Property-line overlay turned on. Zoom closer if boundaries do not appear yet.");
      scheduleBoundaryLoad();
      refreshSelectedBoundary();
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
    state.map.flyTo([-41.2924, 174.7787], 17, { duration: 0.9 });
  }

  function scrollToMap() {
    document.getElementById("mapArea")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function focusSelected() {
    if (!state.selected) {
      setStatus("Select a demo flat marker or property boundary first, then the focus button will centre it.");
      return;
    }

    const feature = state.selected.feature || state.selected.boundaryFeature;
    if (feature) {
      const bounds = getFeatureBounds(feature);
      if (bounds?.isValid()) {
        state.map.fitBounds(bounds.pad(0.28), { maxZoom: 19, animate: true, duration: 0.7 });
        return;
      }
    }

    if (state.selected.centre) {
      state.map.flyTo(state.selected.centre, Math.max(state.map.getZoom(), 18), { duration: 0.7 });
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
      const url = new URL(config.urls.nominatim || "https://nominatim.openstreetmap.org/search");
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
      state.map.flyTo([lat, lon], Math.max(state.map.getZoom(), 18), { duration: 0.9 });
      setStatus(`Moved to ${place.display_name || query}. Zoom in if parcel lines have not loaded yet.`);
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
      { id: "te-aro-demo", title: "Te Aro demo flat", lat: -41.2944, lng: 174.7769, score: 6.3, note: "Demo review marker only." },
      { id: "kelburn-demo", title: "Kelburn demo flat", lat: -41.2891, lng: 174.7667, score: 8.0, note: "Demo review marker only." }
    ];

    (flats.length ? flats : fallback).forEach(addDemoMarker);
  }

  function addDemoMarker(flat) {
    if (!state.map || !Number.isFinite(flat.lat) || !Number.isFinite(flat.lng)) return;
    const safeFlat = normaliseDemoFlat(flat);
    const marker = L.marker([safeFlat.lat, safeFlat.lng], {
      title: safeFlat.title,
      icon: demoMarkerIcon(safeFlat)
    }).addTo(state.map);

    marker.bindPopup(demoPopupHtml(safeFlat));
    marker.on("click", () => selectDemoFlat(safeFlat, marker));
    state.demoMarkers.set(safeFlat.id, marker);
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
      seedReviews: Array.isArray(flat.seedReviews) ? flat.seedReviews : []
    };
  }

  function demoMarkerIcon(flat) {
    const reviews = getReviewsForTarget({ type: "demo", id: `demo:${flat.id}`, demoFlat: flat });
    const average = calculateOverall(reviews);
    const value = Number.isFinite(average) ? average : Number(flat.score || defaultRating);
    const display = Number.isFinite(value) ? value.toFixed(1) : "—";

    return L.divIcon({
      className: `demo-marker ${ratingClass(value)}`,
      html: `<span>${escapeHtml(display)}</span>`,
      iconSize: [48, 48],
      iconAnchor: [24, 44],
      popupAnchor: [0, -38]
    });
  }

  function demoPopupHtml(flat) {
    const target = { type: "demo", id: `demo:${flat.id}`, demoFlat: flat };
    const reviews = getReviewsForTarget(target);
    const average = calculateOverall(reviews);
    const score = Number.isFinite(average) ? average.toFixed(1) : Number(flat.score || 0).toFixed(1);

    return `
      <div class="flat-popup">
        <strong>${escapeHtml(flat.title)}</strong>
        <div class="popup-meta">${escapeHtml(flat.note)}</div>
        <div class="popup-score">${escapeHtml(score)} / ${ratingScale}</div>
      </div>
    `;
  }

  function updateDemoMarker(flat) {
    const marker = state.demoMarkers.get(flat.id);
    if (!marker) return;
    marker.setIcon(demoMarkerIcon(flat));
    marker.setPopupContent(demoPopupHtml(flat));
  }

  function scheduleBoundaryLoad() {
    window.clearTimeout(state.pendingBoundaryTimer);
    state.pendingBoundaryTimer = window.setTimeout(loadBoundariesForView, config.map?.boundaryDebounceMs || 320);
  }

  async function loadBoundariesForView() {
    if (!state.map) return;

    if (!state.showPropertyLines) {
      state.parcelLayer.clearLayers();
      state.buildingLayer.clearLayers();
      return;
    }

    const zoom = state.map.getZoom();
    const parcelZoom = config.map?.parcelLoadZoom || 16;
    const buildingZoom = config.map?.buildingLoadZoom || 18;

    if (zoom < parcelZoom) {
      state.parcelLayer.clearLayers();
      state.buildingLayer.clearLayers();
      setStatus(`Zoom to level ${parcelZoom} or closer to load property boundaries.`);
      return;
    }

    const bounds = state.map.getBounds().pad(0.08);
    if (isQueryTooLarge(bounds)) {
      state.parcelLayer.clearLayers();
      state.buildingLayer.clearLayers();
      setStatus("Move closer before loading property boundaries. This keeps the map fast and prevents huge LINZ requests.");
      return;
    }

    await loadArcGisGeoJson({
      layerName: "parcel",
      url: config.urls.parcels,
      bounds,
      targetLayer: state.parcelLayer,
      cache: state.parcelCache,
      abortKey: "parcelAbortController",
      outFields: "id,appellation,purpose,shape_area,parcel_intent,topology_type,survey_reference"
    });

    if (zoom >= buildingZoom) {
      await loadArcGisGeoJson({
        layerName: "building",
        url: config.urls.buildings,
        bounds,
        targetLayer: state.buildingLayer,
        cache: state.buildingCache,
        abortKey: "buildingAbortController",
        outFields: "id,name,use,shape_area,capture_source_id"
      });
    } else {
      state.buildingLayer.clearLayers();
    }

    if (state.selected?.type === "demo" && state.selected.centre && !state.selected.boundaryFeature) {
      const match = findBestParcelLayer(state.selected.centre);
      if (match) {
        state.selected.boundaryFeature = match.feature;
        refreshSelectedBoundary();
      }
    }
  }

  async function loadArcGisGeoJson(options) {
    const { layerName, url, bounds, targetLayer, cache, abortKey, outFields } = options;
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
      const requestUrl = buildArcGisQueryUrl(url, bounds, outFields, layerName);
      const response = await fetch(requestUrl, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`${layerName} request failed with ${response.status}`);
      }

      const geoJson = await response.json();
      if (!geoJson || !Array.isArray(geoJson.features)) {
        throw new Error(`${layerName} response was not GeoJSON`);
      }

      cache.set(cacheKey, geoJson);
      trimCache(cache);
      applyGeoJsonToLayer(targetLayer, geoJson);
      updateBoundaryStatus(layerName, geoJson);
      return geoJson;
    } catch (error) {
      if (error.name === "AbortError") return null;
      console.warn(`Flatwise ${layerName} boundary load failed:`, error);
      if (layerName === "parcel") {
        setStatus("LINZ parcel boundaries could not load right now. Demo flat reviews still work.");
      }
      return null;
    }
  }

  function buildArcGisQueryUrl(baseUrl, bounds, outFields, layerName) {
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
    url.searchParams.set("resultRecordCount", layerName === "building" ? "700" : "900");
    url.searchParams.set("geometryPrecision", "6");
    url.searchParams.set("maxAllowableOffset", layerName === "building" ? "0.0000025" : "0.000004");
    return url.toString();
  }

  function applyGeoJsonToLayer(layer, geoJson) {
    layer.clearLayers();
    layer.addData(geoJson);
  }

  function updateBoundaryStatus(layerName, geoJson) {
    if (layerName !== "parcel") return;

    const count = geoJson.features.length;
    if (count === 0) {
      setStatus("No parcel polygons returned for this view. Try panning slightly or zooming closer.");
      return;
    }

    setStatus(`${count} LINZ parcel boundaries loaded. Click a property outline to select it.`);
  }

  function isQueryTooLarge(bounds) {
    const max = config.map?.maxQueryAreaDegrees || 0.018;
    const width = Math.abs(bounds.getEast() - bounds.getWest());
    const height = Math.abs(bounds.getNorth() - bounds.getSouth());
    return width * height > max;
  }

  function makeBoundsCacheKey(bounds, layerName) {
    const precision = layerName === "building" ? 4 : 3;
    const parts = [
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth()
    ].map((value) => Number(value).toFixed(precision));
    return `${layerName}:${state.map.getZoom()}:${parts.join(":")}`;
  }

  function trimCache(cache) {
    const maxEntries = 18;
    while (cache.size > maxEntries) {
      const oldestKey = cache.keys().next().value;
      cache.delete(oldestKey);
    }
  }

  function onEachParcel(feature, layer) {
    layer.on({
      mouseover: () => handleParcelHover(layer),
      mouseout: () => handleParcelOut(layer),
      click: () => selectParcel(feature, layer)
    });

    const label = parcelTitle(feature);
    layer.bindTooltip(label, {
      direction: "top",
      sticky: true,
      className: "property-tooltip"
    });
  }

  function handleParcelHover(layer) {
    if (!state.showPropertyLines) return;

    if (state.activeParcelLayer && state.activeParcelLayer !== layer) {
      handleParcelOut(state.activeParcelLayer);
    }

    state.activeParcelLayer = layer;
    layer.setStyle(parcelStyle("hover"));
    layer.bringToFront();
    state.elements.map?.classList.add("is-hovering-property");
    setStatus("Property boundary highlighted. Click it to select this parcel.");
  }

  function handleParcelOut(layer) {
    if (!layer) return;
    const selectedFeature = state.selected?.feature || state.selected?.boundaryFeature;
    if (selectedFeature && sameFeature(layer.feature, selectedFeature)) {
      layer.setStyle(parcelStyle("muted"));
    } else {
      layer.setStyle(parcelStyle("normal"));
    }

    if (state.activeParcelLayer === layer) {
      state.activeParcelLayer = null;
    }

    state.elements.map?.classList.remove("is-hovering-property");
  }

  function selectParcel(feature, layer) {
    const id = `parcel:${propertyId(feature)}`;
    const bounds = layer.getBounds ? layer.getBounds() : getFeatureBounds(feature);
    const centre = bounds?.isValid() ? bounds.getCenter() : getFeatureCentre(feature);

    state.selected = {
      type: "parcel",
      id,
      title: parcelTitle(feature),
      centre,
      feature,
      boundaryFeature: feature,
      demoFlat: null
    };

    refreshSelectedBoundary();

    if (bounds?.isValid()) {
      state.map.fitBounds(bounds.pad(0.36), { maxZoom: 19, animate: true, duration: 0.65 });
      setSelectedMarker(bounds.getCenter());
    }

    layer.setStyle(parcelStyle("muted"));
    renderSelectedDetails();
    document.querySelector(".details-panel")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    setStatus("Property selected. Review panel is ready, and the outline is highlighted if the toggle is enabled.");
  }

  async function selectDemoFlat(flat, marker) {
    const centre = L.latLng(flat.lat, flat.lng);

    state.selected = {
      type: "demo",
      id: `demo:${flat.id}`,
      title: flat.title,
      centre,
      feature: null,
      boundaryFeature: null,
      demoFlat: flat
    };

    setSelectedMarker(centre);
    marker?.openPopup();
    state.map.flyTo(centre, Math.max(state.map.getZoom(), 18), { duration: 0.75 });
    renderSelectedDetails();
    document.querySelector(".details-panel")?.scrollIntoView({ behavior: "smooth", block: "nearest" });

    if (state.showPropertyLines && state.highlightSelectedBoundary) {
      setStatus("Demo flat selected. Loading nearby parcel lines so the clicked property can be outlined if LINZ returns a match.");
      await loadParcelsAroundPoint(centre);
      const match = findBestParcelLayer(centre);
      if (match) {
        state.selected.boundaryFeature = match.feature;
        refreshSelectedBoundary();
        renderSelectedDetails();
        setStatus("Demo flat selected. Nearest LINZ parcel outline has been highlighted.");
        return;
      }
    }

    setStatus("Demo flat selected. Review sliders are ready below.");
  }

  async function loadParcelsAroundPoint(latLng) {
    const delta = config.map?.pointParcelLookupDegrees || 0.0014;
    const bounds = L.latLngBounds(
      [latLng.lat - delta, latLng.lng - delta],
      [latLng.lat + delta, latLng.lng + delta]
    );

    await loadArcGisGeoJson({
      layerName: "parcel",
      url: config.urls.parcels,
      bounds,
      targetLayer: state.parcelLayer,
      cache: state.parcelCache,
      abortKey: "parcelAbortController",
      outFields: "id,appellation,purpose,shape_area,parcel_intent,topology_type,survey_reference"
    });
  }

  function findBestParcelLayer(latLng) {
    if (!state.parcelLayer || !latLng) return null;

    let best = null;
    let bestDistance = Infinity;

    state.parcelLayer.eachLayer((layer) => {
      if (!layer.getBounds || !layer.feature) return;
      const bounds = layer.getBounds();
      if (!bounds?.isValid()) return;

      const contains = bounds.contains(latLng);
      const centre = bounds.getCenter();
      const distance = distanceMeters(latLng.lat, latLng.lng, centre.lat, centre.lng);

      if (contains && distance < bestDistance) {
        best = layer;
        bestDistance = distance;
      }
    });

    if (best) return best;

    state.parcelLayer.eachLayer((layer) => {
      if (!layer.getBounds || !layer.feature) return;
      const bounds = layer.getBounds();
      if (!bounds?.isValid()) return;

      const centre = bounds.getCenter();
      const distance = distanceMeters(latLng.lat, latLng.lng, centre.lat, centre.lng);
      if (distance < bestDistance) {
        best = layer;
        bestDistance = distance;
      }
    });

    return bestDistance < 95 ? best : null;
  }

  function refreshSelectedBoundary() {
    state.selectedBoundaryLayer?.clearLayers();
    if (!state.showPropertyLines || !state.highlightSelectedBoundary || !state.selected) return;

    const feature = state.selected.feature || state.selected.boundaryFeature;
    if (feature) {
      state.selectedBoundaryLayer.addData(feature);
    }
  }

  function setSelectedMarker(latLng) {
    if (state.selectedMarker) {
      state.selectedMarker.remove();
    }

    state.selectedMarker = L.marker(latLng, {
      icon: L.divIcon({
        className: "selected-marker",
        html: "",
        iconSize: [38, 38],
        iconAnchor: [19, 34]
      }),
      interactive: false
    }).addTo(state.map);
  }

  function renderEmptyDetails() {
    state.elements.detailsEmpty?.classList.remove("hidden");
    state.elements.detailsContent?.classList.add("hidden");
  }

  function renderSelectedDetails() {
    if (!state.selected) {
      renderEmptyDetails();
      return;
    }

    const target = state.selected;
    const centre = target.centre || getFeatureCentre(target.feature);
    const rent = findRentArea(centre);
    const reviews = getReviewsForTarget(target);
    const average = calculateOverall(reviews);

    state.elements.detailsEmpty?.classList.add("hidden");
    state.elements.detailsContent?.classList.remove("hidden");

    setText("selectedType", target.type === "demo" ? "Demo flat selected" : "Selected property parcel");
    setText("selectedTitle", target.title);
    setText("selectedSuburb", rent?.name || "Wellington area");
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

    if (state.elements.reviewDialogSuburb) {
      state.elements.reviewDialogSuburb.textContent = target.title;
    }
  }

  function boundarySourceText(target) {
    if (target.type === "parcel") return "LINZ NZ Primary Parcels";
    if (target.boundaryFeature) return "Demo flat + nearest LINZ parcel";
    if (!state.showPropertyLines) return "Property lines disabled";
    return "Demo flat marker";
  }

  function boundaryDescriptionText(target) {
    if (target.type === "parcel" && target.feature) return boundaryDescription(target.feature);
    if (target.boundaryFeature) return `Flatwise demo marker linked to nearby parcel: ${boundaryDescription(target.boundaryFeature)}`;
    if (!state.showPropertyLines) return "Turn on property lines to show the parcel overlay when selecting a demo flat.";
    return "Clicking a demo flat opens the review system. If nearby LINZ parcel geometry loads, Flatwise will outline the closest property boundary automatically.";
  }

  function renderPhoto(centre, title) {
    if (!state.elements.photoFrame) return;

    const streetView = config.streetView || {};
    const canUseStreetView = Boolean(streetView.enableGoogleStreetView && streetView.googleStreetViewApiKey && streetView.googleStreetViewApiKey !== "YOUR_RESTRICTED_KEY" && centre);

    if (canUseStreetView) {
      const url = new URL("https://maps.googleapis.com/maps/api/streetview");
      url.searchParams.set("size", "900x620");
      url.searchParams.set("location", `${centre.lat},${centre.lng}`);
      url.searchParams.set("fov", "82");
      url.searchParams.set("heading", "0");
      url.searchParams.set("pitch", "0");
      url.searchParams.set("key", streetView.googleStreetViewApiKey);

      state.elements.photoFrame.innerHTML = "";
      const img = document.createElement("img");
      img.src = url.toString();
      img.alt = `Street view near ${title}`;
      state.elements.photoFrame.appendChild(img);
      return;
    }

    state.elements.photoFrame.innerHTML = `
      <div class="photo-placeholder">
        <div>
          <span>⌂</span>
          <strong>${escapeHtml(title)}</strong>
          <small>Street imagery is disabled in this prototype. Add a restricted Google Street View Static API key in js/config.js if you want images here.</small>
        </div>
      </div>
    `;
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
        <div class="breakdown-label"><span>${escapeHtml(field.label)}</span><span>${display}</span></div>
        <div class="meter"><span style="--width:${width}"></span></div>
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
      const recommend = review.recommend ? `Recommend: ${escapeHtml(review.recommend)}` : "";
      const weeklyRent = review.weeklyRent ? `Rent: ${escapeHtml(review.weeklyRent)}` : "";
      const period = review.tenancyPeriod ? `Period: ${escapeHtml(review.tenancyPeriod)}` : "";
      const meta = [recommend, weeklyRent, period].filter(Boolean).join(" · ");

      card.innerHTML = `
        <header>
          <strong>${Number.isFinite(score) ? score.toFixed(1) : "—"} / ${ratingScale}</strong>
          <span>${escapeHtml(date)}${review.seed ? " · demo" : ""}</span>
        </header>
        ${meta ? `<div class="review-meta-line">${meta}</div>` : ""}
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
        <label for="rating-${field.key}">
          <span>${escapeHtml(field.label)}</span>
          <output id="output-${field.key}">${defaultRating}</output>
        </label>
        <input id="rating-${field.key}" name="${field.key}" type="range" min="1" max="${ratingScale}" step="1" value="${defaultRating}" />
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

  function openReviewDialog() {
    if (!state.selected) {
      setStatus("Select a demo flat marker or property boundary before adding a review.");
      scrollToMap();
      return;
    }

    if (!state.elements.reviewDialog) return;
    if (state.elements.reviewDialogSuburb) {
      state.elements.reviewDialogSuburb.textContent = state.selected.title;
    }

    if (typeof state.elements.reviewDialog.showModal === "function") {
      state.elements.reviewDialog.showModal();
    } else {
      state.elements.reviewDialog.setAttribute("open", "open");
    }
  }

  function closeReviewDialog() {
    if (!state.elements.reviewDialog) return;

    if (typeof state.elements.reviewDialog.close === "function") {
      state.elements.reviewDialog.close();
    } else {
      state.elements.reviewDialog.removeAttribute("open");
    }
  }

  function saveReview() {
    if (!state.selected) return;

    const review = {
      createdAt: new Date().toISOString(),
      nickname: state.elements.reviewNickname?.value.trim() || "",
      tenancyPeriod: state.elements.reviewTenancyPeriod?.value.trim() || "",
      weeklyRent: state.elements.reviewWeeklyRent?.value.trim() || "",
      recommend: state.elements.reviewRecommend?.value || "",
      note: state.elements.reviewNote?.value.trim() || "",
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
    closeReviewDialog();
    renderSelectedDetails();

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
    const seed = target.type === "demo" && target.demoFlat ? getSeedReviews(target.demoFlat) : [];
    const local = getLocalReviews(target.id);
    return [...seed, ...local];
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
    return `${config.reviews?.storagePrefix || "flatwise_reviews_v3:"}${id}`;
  }

  function parcelStyle(type) {
    if (type === "hover") {
      return {
        color: "#145c3a",
        weight: 3,
        opacity: 1,
        fillColor: "#1f7a4f",
        fillOpacity: 0.18
      };
    }

    if (type === "selected") {
      return {
        color: "#b23a2f",
        weight: 4.5,
        opacity: 1,
        fillColor: "#b23a2f",
        fillOpacity: 0.18
      };
    }

    if (type === "muted") {
      return {
        color: "#5e6965",
        weight: 1.3,
        opacity: 0.55,
        fillColor: "#fffaf0",
        fillOpacity: 0.04
      };
    }

    return {
      color: "#101312",
      weight: 1.2,
      opacity: 0.56,
      fillColor: "#fffaf0",
      fillOpacity: 0.08
    };
  }

  function buildingStyle() {
    return {
      color: "#1f7a4f",
      weight: 1,
      opacity: 0.42,
      fillColor: "#1f7a4f",
      fillOpacity: 0.08
    };
  }

  function parcelTitle(feature) {
    const p = feature?.properties || {};
    return firstMeaningful([
      p.appellation,
      p.address,
      p.name,
      p.parcel_intent,
      p.purpose,
      p.survey_reference ? `Parcel ${p.survey_reference}` : "",
      p.id ? `LINZ Parcel ${p.id}` : "Selected property"
    ]);
  }

  function propertyId(feature) {
    const p = feature?.properties || {};
    return String(firstMeaningful([p.id, p.objectid, p.OBJECTID, p.globalid, p.GLOBALID, parcelTitle(feature)]));
  }

  function boundaryDescription(feature) {
    const p = feature?.properties || {};
    const purpose = firstMeaningful([p.purpose, p.parcel_intent, p.topology_type]);
    const area = Number(p.shape_area || p.Shape__Area || p.SHAPE__Area);

    if (Number.isFinite(area) && area > 0) {
      return `${purpose || "Primary parcel"}. Approximate parcel area: ${Math.round(area).toLocaleString()} square metres.`;
    }

    return `${purpose || "Primary parcel"}. Geometry loaded from the LINZ ArcGIS FeatureServer.`;
  }

  function getFeatureBounds(feature) {
    const layer = L.geoJSON(feature);
    const bounds = layer.getBounds();
    layer.remove();
    return bounds;
  }

  function getFeatureCentre(feature) {
    if (!feature) return null;
    const bounds = getFeatureBounds(feature);
    if (!bounds?.isValid()) return null;
    return bounds.getCenter();
  }

  function sameFeature(a, b) {
    return propertyId(a) === propertyId(b);
  }

  function findRentArea(centre) {
    const areas = Array.isArray(state.rentData?.areas) ? state.rentData.areas : [];
    if (!centre || areas.length === 0) return null;

    let best = null;
    let bestDistance = Infinity;

    areas.forEach((area) => {
      if (!Number.isFinite(area.lat) || !Number.isFinite(area.lng)) return;
      const distance = distanceMeters(centre.lat, centre.lng, area.lat, area.lng);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = area;
      }
    });

    return bestDistance <= 4500 ? best : null;
  }

  function distanceMeters(lat1, lon1, lat2, lon2) {
    const radius = 6371000;
    const toRad = (degrees) => (degrees * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function calculateOverall(reviews) {
    if (!reviews.length) return NaN;
    const scores = reviews.map(calculateReviewScore).filter(Number.isFinite);
    if (!scores.length) return NaN;
    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }

  function calculateReviewScore(review) {
    const values = reviewFields
      .map((field) => Number(review.ratings?.[field.key]))
      .filter(Number.isFinite)
      .map(clampRating);

    if (!values.length) return NaN;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  function calculateFieldAverage(reviews, key) {
    const values = reviews.map((review) => Number(review.ratings?.[key])).filter(Number.isFinite).map(clampRating);
    if (!values.length) return NaN;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  function clampRating(value) {
    if (!Number.isFinite(value)) return defaultRating;
    return Math.max(1, Math.min(ratingScale, value));
  }

  function setRatingPill(element, value) {
    if (!element) return;
    element.classList.remove("good", "warning", "bad");

    if (!Number.isFinite(value)) {
      element.textContent = "No rating";
      return;
    }

    element.textContent = `${value.toFixed(1)} / ${ratingScale}`;
    element.classList.add(ratingClass(value));
  }

  function ratingClass(value) {
    if (!Number.isFinite(value)) return "warning";
    if (value >= ratingScale * 0.76) return "good";
    if (value <= ratingScale * 0.45) return "bad";
    return "warning";
  }

  function setStatus(message) {
    if (state.elements.mapStatus) {
      state.elements.mapStatus.textContent = message;
    }
  }

  function setText(id, value) {
    const element = document.getElementById(id) || state.elements[id];
    if (element) {
      element.textContent = value;
    }
  }

  async function fetchJson(url, timeoutMs) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs || 8000);

    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Request failed with ${response.status}`);
      }
      return await response.json();
    } finally {
      window.clearTimeout(timer);
    }
  }

  function firstMeaningful(values) {
    const found = values.find((value) => value !== undefined && value !== null && String(value).trim() !== "");
    return found === undefined ? "" : String(found).trim();
  }

  function slugify(value) {
    return String(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || `flat-${Date.now()}`;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
})();
