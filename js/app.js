(() => {
  "use strict";

  const config = window.FLATWISE_CONFIG || {};

  const reviewFields = [
    { key: "rentValue", label: "Rent value", hint: "Did the price feel fair for the condition of the flat?" },
    { key: "warmth", label: "Warmth", hint: "Did it stay warm and dry through winter?" },
    { key: "noise", label: "Noise", hint: "How liveable was the sound level day to day?" },
    { key: "safety", label: "Safety", hint: "Did the flat and surrounding area feel safe?" },
    { key: "communication", label: "Communication", hint: "Was the landlord or property manager clear and respectful?" },
    { key: "pressure", label: "Pressure", hint: "Were tenants pressured around inspections, rent, or repairs?" },
    { key: "liveability", label: "Liveability", hint: "Overall, would you recommend living here?" }
  ];

  const state = {
    map: null,
    tileLayer: null,
    parcelLayer: null,
    buildingLayer: null,
    selectedBoundaryLayer: null,
    selectedMarker: null,
    activeParcelLayer: null,
    selectedFeature: null,
    rentData: null,
    parcelCache: new Map(),
    buildingCache: new Map(),
    pendingBoundaryTimer: 0,
    parcelAbortController: null,
    buildingAbortController: null,
    tileLoadingCount: 0,
    elements: {}
  };

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    bindElements();
    createRatingInputs();

    if (!window.L) {
      setStatus("Leaflet did not load. Check the CDN integrity hash or your network connection.");
      return;
    }

    loadRentData();
    createMap();
    bindUIEvents();
    renderEmptyDetails();
  }

  function bindElements() {
    const ids = [
      "map", "mapStatus", "searchForm", "searchInput", "clearSearch", "wellingtonButton",
      "heroWellingtonButton", "focusButton", "reviewButton", "topReviewButton", "inlineReviewButton",
      "detailsEmpty", "detailsContent", "photoFrame", "selectedType", "selectedTitle", "selectedSuburb",
      "selectedScore", "rentBenchmark", "rentDescription", "boundarySource", "boundaryDescription",
      "reviewCount", "ratingBreakdown", "reviewList", "reviewDialog", "reviewForm", "reviewDialogSuburb",
      "ratingInputs", "reviewNote", "cancelReview", "closeDialog"
    ];

    ids.forEach((id) => {
      state.elements[id] = document.getElementById(id);
    });
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
    state.map.getPane("buildingPane").style.zIndex = 390;
    state.map.getPane("propertyPane").style.zIndex = 430;
    state.map.getPane("selectedPane").style.zIndex = 460;

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
      setStatus("Map ready. Zoom closer to load LINZ property boundaries.");
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
    if (!state.selectedFeature) {
      setStatus("Select a property boundary first, then the focus button will centre it.");
      return;
    }

    const bounds = getFeatureBounds(state.selectedFeature);
    if (bounds?.isValid()) {
      state.map.fitBounds(bounds.pad(0.28), { maxZoom: 19, animate: true, duration: 0.7 });
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

  async function loadRentData() {
    try {
      state.rentData = await fetchJson(config.urls.rentData || "data/rent-data.json", 6000);
    } catch (error) {
      console.warn("Rent data could not be loaded:", error);
      state.rentData = { areas: [], demoFlats: [] };
    }
  }

  function addDemoMarkers() {
    fetchJson(config.urls.rentData || "data/rent-data.json", 6000)
      .then((data) => {
        const flats = Array.isArray(data.demoFlats) ? data.demoFlats : [];
        flats.forEach(addDemoMarker);
      })
      .catch(() => {
        const fallback = [
          { title: "Te Aro demo flat", lat: -41.2944, lng: 174.7769, score: 3.1, note: "Demo review marker only." },
          { title: "Kelburn demo flat", lat: -41.2891, lng: 174.7667, score: 4.0, note: "Demo review marker only." }
        ];
        fallback.forEach(addDemoMarker);
      });
  }

  function addDemoMarker(flat) {
    if (!state.map || !Number.isFinite(flat.lat) || !Number.isFinite(flat.lng)) return;

    const scoreClass = ratingClass(flat.score);
    const marker = L.marker([flat.lat, flat.lng], {
      title: flat.title || "Flatwise demo review",
      icon: L.divIcon({
        className: `demo-marker ${scoreClass}`,
        html: `<span>${escapeHtml(String(Math.round((flat.score || 0) * 10) / 10))}</span>`,
        iconSize: [44, 44],
        iconAnchor: [22, 42],
        popupAnchor: [0, -38]
      })
    }).addTo(state.map);

    marker.bindPopup(`<div class="flat-popup"><strong>${escapeHtml(flat.title || "Flatwise demo review")}</strong><div class="popup-meta">${escapeHtml(flat.note || "Local demo marker.")}</div></div>`);
  }

  function scheduleBoundaryLoad() {
    window.clearTimeout(state.pendingBoundaryTimer);
    state.pendingBoundaryTimer = window.setTimeout(loadBoundariesForView, config.map?.boundaryDebounceMs || 320);
  }

  async function loadBoundariesForView() {
    if (!state.map) return;

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
  }

  async function loadArcGisGeoJson(options) {
    const { layerName, url, bounds, targetLayer, cache, abortKey, outFields } = options;
    if (!url || !targetLayer) return;

    const cacheKey = makeBoundsCacheKey(bounds, layerName);
    if (cache.has(cacheKey)) {
      applyGeoJsonToLayer(targetLayer, cache.get(cacheKey), layerName);
      updateBoundaryStatus(layerName, cache.get(cacheKey));
      return;
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
      applyGeoJsonToLayer(targetLayer, geoJson, layerName);
      updateBoundaryStatus(layerName, geoJson);
    } catch (error) {
      if (error.name === "AbortError") return;
      console.warn(`Flatwise ${layerName} boundary load failed:`, error);
      if (layerName === "parcel") {
        setStatus("LINZ parcel boundaries could not load right now. The base map still works, so try a small pan or zoom.");
      }
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

    setStatus(`${count} LINZ parcel boundaries loaded. Hover to highlight a property, then click to select it.`);
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
    if (state.activeParcelLayer && state.activeParcelLayer !== layer) {
      handleParcelOut(state.activeParcelLayer);
    }

    state.activeParcelLayer = layer;
    layer.setStyle(parcelStyle("hover"));
    layer.bringToFront();
    state.elements.map?.classList.add("is-hovering-property");
    setStatus("Property boundary highlighted. Click it to select and focus on this parcel.");
  }

  function handleParcelOut(layer) {
    if (!layer) return;
    if (state.selectedFeature && sameFeature(layer.feature, state.selectedFeature)) {
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
    state.selectedFeature = feature;
    state.selectedBoundaryLayer.clearLayers();
    state.selectedBoundaryLayer.addData(feature);

    const bounds = layer.getBounds ? layer.getBounds() : getFeatureBounds(feature);
    if (bounds?.isValid()) {
      state.map.fitBounds(bounds.pad(0.36), { maxZoom: 19, animate: true, duration: 0.65 });
      setSelectedMarker(bounds.getCenter());
    }

    layer.setStyle(parcelStyle("muted"));
    renderSelectedDetails(feature);
    document.querySelector(".details-panel")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    setStatus("Property selected. Boundary is outlined in red and the details panel is ready.");
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

  function renderSelectedDetails(feature) {
    const title = parcelTitle(feature);
    const id = propertyId(feature);
    const centre = getFeatureCentre(feature);
    const rent = findRentArea(centre);
    const reviews = getReviews(id);
    const average = calculateOverall(reviews);

    state.elements.detailsEmpty?.classList.add("hidden");
    state.elements.detailsContent?.classList.remove("hidden");

    setText("selectedType", "Selected property");
    setText("selectedTitle", title);
    setText("selectedSuburb", rent?.name || "Wellington area");
    setText("boundarySource", "LINZ NZ Primary Parcels");
    setText("boundaryDescription", boundaryDescription(feature));
    setRatingPill(state.elements.selectedScore, average);

    if (rent) {
      setText("rentBenchmark", rent.weeklyRent || "Local guide");
      setText("rentDescription", rent.description || "Area-based rent guidance loaded from the local demo data file.");
    } else {
      setText("rentBenchmark", "No local data");
      setText("rentDescription", "No demo rent guide is currently available for this selected area.");
    }

    renderPhoto(centre, title);
    renderRatingBreakdown(reviews);
    renderReviewList(reviews);

    if (state.elements.reviewDialogSuburb) {
      state.elements.reviewDialogSuburb.textContent = title;
    }
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
      const width = Number.isFinite(value) ? `${Math.max(4, (value / 5) * 100)}%` : "0%";

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
      card.className = "review-card";
      const score = calculateReviewScore(review);
      const date = review.createdAt ? new Date(review.createdAt).toLocaleDateString() : "Saved locally";
      card.innerHTML = `
        <header><strong>${Number.isFinite(score) ? score.toFixed(1) : "—"} / 5</strong><span>${escapeHtml(date)}</span></header>
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
          <output id="output-${field.key}">3</output>
        </label>
        <input id="rating-${field.key}" name="${field.key}" type="range" min="1" max="5" step="1" value="3" />
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
    if (!state.selectedFeature) {
      setStatus("Select a property boundary before adding a review.");
      scrollToMap();
      return;
    }

    if (!state.elements.reviewDialog) return;

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
    if (!state.selectedFeature) return;

    const review = {
      createdAt: new Date().toISOString(),
      note: state.elements.reviewNote?.value.trim() || "",
      ratings: {}
    };

    reviewFields.forEach((field) => {
      const input = document.getElementById(`rating-${field.key}`);
      review.ratings[field.key] = Number(input?.value || 3);
    });

    const id = propertyId(state.selectedFeature);
    const reviews = getReviews(id);
    reviews.push(review);
    localStorage.setItem(storageKey(id), JSON.stringify(reviews));

    state.elements.reviewForm?.reset();
    reviewFields.forEach((field) => setText(`output-${field.key}`, "3"));
    closeReviewDialog();
    renderSelectedDetails(state.selectedFeature);
    setStatus("Review saved locally in this browser.");
  }

  function getReviews(id) {
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
    return `${config.reviews?.storagePrefix || "flatwise_reviews_v2:"}${id}`;
  }

  function parcelStyle(type) {
    if (type === "hover") {
      return {
        color: "#145c3a",
        weight: 3,
        opacity: 1,
        fillColor: "#1f7a4f",
        fillOpacity: 0.2
      };
    }

    if (type === "selected") {
      return {
        color: "#b23a2f",
        weight: 4,
        opacity: 1,
        fillColor: "#b23a2f",
        fillOpacity: 0.2
      };
    }

    if (type === "muted") {
      return {
        color: "#5e6965",
        weight: 1.25,
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
      .filter(Number.isFinite);

    if (!values.length) return NaN;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  function calculateFieldAverage(reviews, key) {
    const values = reviews.map((review) => Number(review.ratings?.[key])).filter(Number.isFinite);
    if (!values.length) return NaN;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  function setRatingPill(element, value) {
    if (!element) return;
    element.classList.remove("good", "warning", "bad");

    if (!Number.isFinite(value)) {
      element.textContent = "No rating";
      return;
    }

    element.textContent = `${value.toFixed(1)} / 5`;
    element.classList.add(ratingClass(value));
  }

  function ratingClass(value) {
    if (!Number.isFinite(value)) return "warning";
    if (value >= 3.8) return "good";
    if (value <= 2.4) return "bad";
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

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
})();
