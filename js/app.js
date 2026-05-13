const CONFIG = window.FLATWISE_CONFIG || {};

const state = {
  map: null,
  parcelLayer: null,
  buildingLayer: null,
  selectedMarker: null,
  selectedLayer: null,
  hoveredLayer: null,
  selectedFlat: null,
  selectedBounds: null,
  sampleReviews: [],
  rentData: [],
  localReviews: loadLocalReviews(),
  demoMarkers: [],
  loadTimer: null,
  dataController: null,
  lastLoadKey: "",
  isLoadingBoundaries: false,
  suppressLoadUntil: 0
};

const ratingFields = [
  { key: "rentValue", label: "Rent value", hint: "Is the price fair for the room, location, condition, and bills?" },
  { key: "cleanliness", label: "Cleanliness", hint: "Kitchen, bathroom, bedroom, laundry, and shared spaces." },
  { key: "warmthDryness", label: "Warmth & dryness", hint: "Warm, dry, ventilated, mould-free, and healthy." },
  { key: "noise", label: "Noise level", hint: "Traffic, parties, insulation, and neighbours." },
  { key: "safety", label: "Safety", hint: "Locks, lighting, entrances, street, and environment." },
  { key: "flatmateVibe", label: "Flatmate vibe", hint: "Respectful, clear, relaxed, and honest." },
  { key: "communication", label: "Communication", hint: "Rent, bond, bills, rules, and expectations." },
  { key: "locationScore", label: "Location", hint: "Buses, shops, work, uni, parking, and essentials." },
  { key: "pressureLevel", label: "Low pressure", hint: "Higher score means less rushing or weird urgency." },
  { key: "liveability", label: "Overall liveability", hint: "Would you want to live here for 6–12 months?" }
];

const els = {};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  cacheElements();
  buildRatingInputs();
  await loadData();
  initMap();
  addDemoMarkers();
  bindUI();
  renderEmptyBreakdown();
}

function cacheElements() {
  els.map = document.getElementById("map");
  els.mapStatus = document.getElementById("mapStatus");
  els.searchForm = document.getElementById("searchForm");
  els.searchInput = document.getElementById("searchInput");
  els.clearSearch = document.getElementById("clearSearch");
  els.wellingtonButton = document.getElementById("wellingtonButton");
  els.heroWellingtonButton = document.getElementById("heroWellingtonButton");
  els.focusButton = document.getElementById("focusButton");
  els.reviewButton = document.getElementById("reviewButton");
  els.inlineReviewButton = document.getElementById("inlineReviewButton");
  els.topReviewButton = document.getElementById("topReviewButton");
  els.detailsEmpty = document.getElementById("detailsEmpty");
  els.detailsContent = document.getElementById("detailsContent");
  els.photoFrame = document.getElementById("photoFrame");
  els.selectedType = document.getElementById("selectedType");
  els.selectedTitle = document.getElementById("selectedTitle");
  els.selectedSuburb = document.getElementById("selectedSuburb");
  els.selectedScore = document.getElementById("selectedScore");
  els.rentBenchmark = document.getElementById("rentBenchmark");
  els.rentDescription = document.getElementById("rentDescription");
  els.boundarySource = document.getElementById("boundarySource");
  els.boundaryDescription = document.getElementById("boundaryDescription");
  els.ratingBreakdown = document.getElementById("ratingBreakdown");
  els.reviewList = document.getElementById("reviewList");
  els.reviewCount = document.getElementById("reviewCount");
  els.reviewDialog = document.getElementById("reviewDialog");
  els.reviewForm = document.getElementById("reviewForm");
  els.ratingInputs = document.getElementById("ratingInputs");
  els.reviewNote = document.getElementById("reviewNote");
  els.reviewDialogSuburb = document.getElementById("reviewDialogSuburb");
  els.closeDialog = document.getElementById("closeDialog");
  els.cancelReview = document.getElementById("cancelReview");
}

async function loadData() {
  const [reviewsResponse, rentResponse] = await Promise.all([
    fetch("data/sample-reviews.json"),
    fetch("data/rent-data.json")
  ]);

  state.sampleReviews = await reviewsResponse.json();
  state.rentData = await rentResponse.json();
}

function initMap() {
  const center = CONFIG.defaultMapCenter || [-41.29484, 174.77885];
  const zoom = CONFIG.defaultZoom || 17;
  const bounds = CONFIG.mapBounds || [[-47.8, 165.5], [-33.8, 179.5]];
  const canvasRenderer = L.canvas({ padding: 0.5 });

  state.map = L.map("map", {
    zoomControl: false,
    scrollWheelZoom: true,
    doubleClickZoom: true,
    touchZoom: true,
    dragging: true,
    inertia: true,
    zoomAnimation: true,
    fadeAnimation: true,
    markerZoomAnimation: true,
    preferCanvas: false,
    renderer: canvasRenderer,
    zoomSnap: 1,
    zoomDelta: 1,
    wheelPxPerZoomLevel: 96,
    worldCopyJump: false,
    maxBounds: bounds,
    maxBoundsViscosity: 0.75,
    minZoom: 5,
    maxZoom: CONFIG.maxBoundaryZoom || 19
  }).setView(center, zoom);

  L.control.zoom({ position: "bottomright" }).addTo(state.map);

  L.tileLayer(CONFIG.osmTileUrl || "https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    minZoom: 5,
    maxZoom: CONFIG.maxBoundaryZoom || 19,
    maxNativeZoom: CONFIG.mapMaxNativeZoom || 19,

    // HUGE TILE MODE:
    // 1024 with zoomOffset -2 makes every rendered tile cover a much larger map area.
    // For sharper but less extreme loading, use 512 with zoomOffset -1 in config.js.
    tileSize: CONFIG.mapTileSize || 1024,
    zoomOffset: Number.isFinite(CONFIG.mapTileZoomOffset) ? CONFIG.mapTileZoomOffset : -2,

    noWrap: true,
    detectRetina: false,
    updateWhenZooming: CONFIG.mapUpdateWhenZooming ?? false,
    updateWhenIdle: CONFIG.mapUpdateWhenIdle ?? true,
    updateInterval: CONFIG.mapUpdateInterval || 300,
    keepBuffer: CONFIG.mapTileKeepBuffer ?? 6,
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(state.map);

  state.map.createPane("propertyPane");
  state.map.getPane("propertyPane").style.zIndex = 430;
  state.map.getPane("propertyPane").style.pointerEvents = "auto";

  state.map.createPane("buildingPane");
  state.map.getPane("buildingPane").style.zIndex = 420;
  state.map.getPane("buildingPane").style.pointerEvents = "none";

  state.buildingLayer = L.layerGroup([], { pane: "buildingPane" }).addTo(state.map);
  state.parcelLayer = L.layerGroup([], { pane: "propertyPane" }).addTo(state.map);

  state.map.on("moveend zoomend", scheduleBoundaryLoad);
  state.map.on("click", handleBackgroundClick);

  state.map.whenReady(() => {
    stableInvalidate();
    setTimeout(stableInvalidate, 120);
    setTimeout(scheduleBoundaryLoad, 260);
    setStatus("Map ready. Zoom in to load official LINZ property boundaries.");
  });

  window.addEventListener("resize", debounce(() => {
    stableInvalidate();
    scheduleBoundaryLoad();
  }, 180), { passive: true });
}

function stableInvalidate() {
  if (!state.map) return;
  state.map.invalidateSize({ animate: false, pan: false });
}

function addDemoMarkers() {
  state.sampleReviews.forEach(flat => {
    const average = calculateAverage(flat.ratings);
    const marker = L.marker([flat.lat, flat.lng], {
      icon: markerIcon(scoreClass(average), average.toFixed(1)),
      riseOnHover: true
    }).addTo(state.map);

    marker.bindPopup(`
      <div class="flat-popup">
        <strong>${escapeHtml(flat.name)}</strong>
        <span class="popup-meta">${escapeHtml(flat.suburb)} · demo review · ${average.toFixed(1)}/5</span>
      </div>
    `);

    marker.on("click", () => {
      selectFlat({
        ...flat,
        source: "demo",
        osmKey: flat.osmKey || `demo/${flat.id}`
      }, null, { focus: true });
    });

    state.demoMarkers.push({ marker, flat });
  });
}

function bindUI() {
  els.searchForm.addEventListener("submit", event => {
    event.preventDefault();
    const query = els.searchInput.value.trim();
    if (query) searchLocation(query);
  });

  els.clearSearch.addEventListener("click", () => {
    els.searchInput.value = "";
    els.searchInput.focus();
  });

  els.wellingtonButton.addEventListener("click", jumpToWellington);
  els.heroWellingtonButton.addEventListener("click", jumpToWellington);
  els.focusButton.addEventListener("click", focusSelected);
  els.reviewButton.addEventListener("click", openReviewDialog);
  els.inlineReviewButton.addEventListener("click", openReviewDialog);
  els.topReviewButton.addEventListener("click", openReviewDialog);
  els.closeDialog.addEventListener("click", () => els.reviewDialog.close());
  els.cancelReview.addEventListener("click", () => els.reviewDialog.close());
  els.reviewForm.addEventListener("submit", saveReview);
}

function jumpToWellington() {
  state.map.setView(CONFIG.defaultMapCenter || [-41.29484, 174.77885], CONFIG.defaultZoom || 17, { animate: true });
  document.getElementById("mapArea").scrollIntoView({ behavior: "smooth", block: "start" });
  setTimeout(stableInvalidate, 450);
}

async function searchLocation(query) {
  setStatus(`Searching for “${query}”…`);

  // Manual, user-triggered geocoding only. No autocomplete loop.
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "nz");
  url.searchParams.set("q", query);

  try {
    const response = await fetch(url.toString(), {
      headers: { "Accept": "application/json" }
    });

    if (!response.ok) throw new Error(`Nominatim failed: ${response.status}`);

    const results = await response.json();
    if (!results.length) {
      setStatus("No address found. Try a street, suburb, or a more complete address.");
      return;
    }

    const result = results[0];
    const lat = Number(result.lat);
    const lng = Number(result.lon);
    const zoom = Math.max(CONFIG.minBoundaryZoom || 16, 18);

    state.map.setView([lat, lng], zoom, { animate: true });
    setStatus(`Moved to ${result.display_name}. Zoom/hover to select the exact parcel.`);
    setTimeout(scheduleBoundaryLoad, 650);
  } catch (error) {
    console.warn(error);
    setStatus("Search is unavailable right now. You can still move the map manually.");
  }
}

function scheduleBoundaryLoad() {
  if (!state.map) return;
  clearTimeout(state.loadTimer);
  state.loadTimer = setTimeout(loadBoundariesForView, CONFIG.boundaryLoadDelay || 420);
}

async function loadBoundariesForView() {
  if (!state.map || state.isLoadingBoundaries) return;
  if (Date.now() < state.suppressLoadUntil) return;

  const zoom = state.map.getZoom();
  const minZoom = CONFIG.minBoundaryZoom || 16;

  if (zoom < minZoom) {
    state.parcelLayer.clearLayers();
    state.buildingLayer.clearLayers();
    state.lastLoadKey = "";
    setStatus(`Zoom in closer to load LINZ property boundaries. Current zoom: ${zoom}.`);
    return;
  }

  // Load a much larger area than the exact visible viewport.
  // This stops the boundary layer from feeling like it is only appearing in tiny patches.
  const bounds = state.map.getBounds().pad(CONFIG.boundaryLoadPadding ?? 0.65);
  const loadKey = buildBoundsKey(bounds, zoom);

  if (loadKey === state.lastLoadKey) return;
  state.lastLoadKey = loadKey;

  if (state.dataController) state.dataController.abort();
  state.dataController = new AbortController();
  state.isLoadingBoundaries = true;

  setStatus("Loading official LINZ property parcels and building outlines…");

  try {
    const [parcels, buildings] = await Promise.all([
      queryArcGis(
        CONFIG.linzParcelsEndpoint,
        bounds,
        CONFIG.parcelRecordCount || 2000,
        state.dataController.signal
      ),
      queryArcGis(
        CONFIG.linzBuildingsEndpoint,
        bounds,
        CONFIG.buildingRecordCount || 2000,
        state.dataController.signal
      )
    ]);

    renderBuildingOutlines(buildings);
    renderParcelBoundaries(parcels);

    if (parcels.length) {
      setStatus(`${parcels.length} LINZ property parcels loaded. Hover a parcel to highlight it, then click to select and focus.`);
    } else {
      setStatus("No LINZ property parcels returned in this view. Try zooming or moving slightly.");
    }
  } catch (error) {
    if (error.name === "AbortError") return;
    console.warn(error);
    setStatus("Could not load LINZ boundaries right now. Check the internet connection, then move or zoom the map again.");
  } finally {
    state.isLoadingBoundaries = false;
  }
}

function buildBoundsKey(bounds, zoom) {
  const precision = zoom >= 18 ? 5 : 4;

  return [
    Math.round(zoom),
    bounds.getSouth().toFixed(precision),
    bounds.getWest().toFixed(precision),
    bounds.getNorth().toFixed(precision),
    bounds.getEast().toFixed(precision)
  ].join("|");
}

async function queryArcGis(endpoint, bounds, recordCount, signal) {
  const params = new URLSearchParams({
    f: "json",
    where: "1=1",
    geometry: `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`,
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "*",
    returnGeometry: "true",
    outSR: "4326",
    geometryPrecision: "7",
    resultRecordCount: String(recordCount)
  });

  const response = await fetch(`${endpoint}?${params.toString()}`, { signal });
  if (!response.ok) throw new Error(`LINZ ArcGIS request failed: ${response.status}`);

  const data = await response.json();
  if (data.error) throw new Error(data.error.message || "LINZ ArcGIS error");

  return Array.isArray(data.features) ? data.features : [];
}

function renderBuildingOutlines(features) {
  state.buildingLayer.clearLayers();

  features.forEach(feature => {
    const latLngRings = esriRingsToLatLngs(feature.geometry);
    if (!latLngRings) return;

    const layer = L.polygon(latLngRings, {
      pane: "buildingPane",
      interactive: false,
      ...buildingStyle()
    });

    layer.addTo(state.buildingLayer);
  });
}

function renderParcelBoundaries(features) {
  state.parcelLayer.clearLayers();
  const selectedKey = state.selectedFlat?.osmKey;

  features.forEach(feature => {
    const latLngRings = esriRingsToLatLngs(feature.geometry);
    if (!latLngRings) return;

    const layer = L.polygon(latLngRings, {
      pane: "propertyPane",
      interactive: true,
      bubblingMouseEvents: false,
      ...parcelStyle("idle")
    });

    const flat = normaliseParcelFeature(feature, layer);
    layer.flatwiseData = flat;

    layer.on("mouseover", () => handleParcelHover(layer));
    layer.on("mouseout", () => handleParcelOut(layer));
    layer.on("click", event => {
      if (event.originalEvent) L.DomEvent.stopPropagation(event.originalEvent);
      selectFlat(flat, layer, { focus: true });
      setStatus("Property selected. The red outline is the selected LINZ primary parcel boundary.");
    });

    layer.bindTooltip("Click to select this property parcel", {
      sticky: true,
      direction: "top",
      className: "property-tooltip"
    });

    layer.addTo(state.parcelLayer);

    if (flat.osmKey === selectedKey) {
      state.selectedLayer = layer;
      layer.setStyle(parcelStyle("selected"));
      layer.bringToFront();
    }
  });
}

function esriRingsToLatLngs(geometry) {
  if (!geometry || !Array.isArray(geometry.rings) || !geometry.rings.length) return null;

  const rings = geometry.rings
    .filter(ring => Array.isArray(ring) && ring.length >= 3)
    .map(ring => ring
      .map(point => [Number(point[1]), Number(point[0])])
      .filter(pair => Number.isFinite(pair[0]) && Number.isFinite(pair[1]))
    );

  return rings.length ? rings : null;
}

function normaliseParcelFeature(feature, layer) {
  const attributes = feature.attributes || {};
  const id = getFirst(attributes, ["OBJECTID", "objectid", "id", "parcel_id", "PARCEL_ID"]) || cryptoSafeId();
  const center = layer.getBounds().getCenter();
  const appellation = getFirst(attributes, ["appellation", "APPellation", "APP_DESCRIPTION", "parcel_intent", "purpose", "PURPOSE"]);
  const locality = getFirst(attributes, ["suburb_locality", "SUBURB_LOCALITY", "locality", "LOCALITY"]);
  const parcelArea = getFirst(attributes, ["shape_area", "Shape__Area", "area", "AREA"]);
  const inferredRent = inferRentArea(center.lat, center.lng, locality);
  const displayName = appellation && CONFIG.showExactAddress ? String(appellation) : "Selected property parcel";

  return {
    id: `linz-parcel/${id}`,
    osmKey: `linz-parcel/${id}`,
    source: "linz-parcel",
    name: displayName,
    suburb: inferredRent?.area || locality || "Wellington",
    lat: center.lat,
    lng: center.lng,
    boundarySource: "LINZ NZ Primary Parcels",
    boundaryDescription: parcelArea
      ? `Official primary parcel polygon. Approx. area attribute: ${formatArea(parcelArea)}.`
      : "Official primary parcel polygon from LINZ.",
    ratings: {},
    note: "No Flatwise review exists for this selected property yet.",
    attributes
  };
}

function handleParcelHover(layer) {
  els.map.classList.add("is-hovering-property");

  if (state.hoveredLayer && state.hoveredLayer !== state.selectedLayer) {
    state.hoveredLayer.setStyle(parcelStyle("idle"));
  }

  state.hoveredLayer = layer;

  if (layer !== state.selectedLayer) {
    layer.setStyle(parcelStyle("hover"));
    layer.bringToFront();
  }

  setStatus("Property boundary highlighted. Click it to select and focus on this parcel.");
}

function handleParcelOut(layer) {
  els.map.classList.remove("is-hovering-property");
  if (layer !== state.selectedLayer) layer.setStyle(parcelStyle("idle"));
}

function handleBackgroundClick(event) {
  if (!event.latlng) return;
  setStatus("No parcel was selected. Hover over a visible boundary, then click the highlighted property.");
}

function selectFlat(flat, layer = null, options = {}) {
  if (state.selectedLayer && state.selectedLayer !== layer) {
    state.selectedLayer.setStyle(parcelStyle("idle"));
  }

  state.selectedFlat = flat;
  state.selectedLayer = layer || null;
  state.selectedBounds = layer
    ? layer.getBounds()
    : L.latLngBounds([flat.lat, flat.lng], [flat.lat, flat.lng]);

  if (layer) {
    layer.setStyle(parcelStyle("selected"));
    layer.bringToFront();
  }

  placeSelectedMarker(flat);
  renderDetails(flat);
  els.detailsEmpty.classList.add("hidden");
  els.detailsContent.classList.remove("hidden");

  if (options.focus) focusSelected({ fromSelection: true });
}

function focusSelected(options = {}) {
  if (!state.selectedFlat) {
    setStatus("Select a property first, then Flatwise can focus on it.");
    document.getElementById("mapArea").scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  if (state.selectedBounds && state.selectedBounds.isValid && state.selectedBounds.isValid()) {
    state.suppressLoadUntil = Date.now() + 700;
    const fitOptions = { padding: [96, 96], maxZoom: 19, animate: true };
    state.map.fitBounds(state.selectedBounds.pad(0.85), fitOptions);
  } else {
    state.map.setView([state.selectedFlat.lat, state.selectedFlat.lng], 19, { animate: true });
  }

  if (!options.fromSelection) {
    document.getElementById("mapArea").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  setTimeout(() => {
    stableInvalidate();
    scheduleBoundaryLoad();
  }, 760);
}

function placeSelectedMarker(flat) {
  if (state.selectedMarker) state.selectedMarker.remove();

  state.selectedMarker = L.marker([flat.lat, flat.lng], {
    icon: selectedMarkerIcon(),
    keyboard: false,
    zIndexOffset: 900
  }).addTo(state.map);

  state.selectedMarker.bindPopup(`
    <div class="flat-popup">
      <strong>${escapeHtml(flat.name || "Selected property")}</strong>
      <span class="popup-meta">Selected for review</span>
    </div>
  `, { autoPan: false });
}

function renderDetails(flat) {
  const reviews = getReviewsForFlat(flat);
  const combinedRatings = reviews.length
    ? averageRatings(reviews.map(review => review.ratings))
    : flat.ratings || {};
  const averageScore = Object.keys(combinedRatings).length ? calculateAverage(combinedRatings) : null;
  const rent = inferRentArea(flat.lat, flat.lng, flat.suburb);

  els.selectedType.textContent = labelForSource(flat.source);
  els.selectedTitle.textContent = flat.name || "Selected property";
  els.selectedSuburb.textContent = rent?.area || flat.suburb || "Wellington";
  els.selectedScore.textContent = averageScore ? `${averageScore.toFixed(1)} / 5` : "No rating";
  els.selectedScore.className = `rating-pill ${averageScore ? scoreClass(averageScore) : ""}`;
  els.reviewCount.textContent = String(reviews.length);
  els.boundarySource.textContent = flat.boundarySource || "Map location";
  els.boundaryDescription.textContent = flat.boundaryDescription || "Selected map position. Official boundaries load when available.";

  renderPhoto(flat);
  renderRent(rent);
  renderBreakdown(combinedRatings);
  renderReviews(reviews, flat);
}

function labelForSource(source) {
  if (source === "linz-parcel") return "LINZ property parcel";
  if (source === "demo") return "Demo flat review";
  return "Selected location";
}

function renderPhoto(flat) {
  if (CONFIG.enableGoogleStreetView && CONFIG.googleStreetViewApiKey) {
    const url = `https://maps.googleapis.com/maps/api/streetview?size=900x520&location=${flat.lat},${flat.lng}&fov=80&pitch=0&key=${encodeURIComponent(CONFIG.googleStreetViewApiKey)}`;
    els.photoFrame.innerHTML = `<img src="${escapeAttribute(url)}" alt="Street view preview for selected property">`;
    return;
  }

  els.photoFrame.innerHTML = `
    <div class="photo-placeholder">
      <div>
        <span>⌂</span>
        <strong>${escapeHtml(flat.name || "Selected property")}</strong>
        <small>Image layer is ready. Add a restricted Street View API key in <code>js/config.js</code>, or swap this for moderated tenant-uploaded images in a real version.</small>
      </div>
    </div>
  `;
}

function renderRent(rent) {
  if (!rent) {
    els.rentBenchmark.textContent = "No local data";
    els.rentDescription.textContent = "No rent benchmark was found for this selected area. Add one in data/rent-data.json.";
    return;
  }

  els.rentBenchmark.textContent = `$${rent.medianRent}/week`;
  els.rentDescription.innerHTML = `
    <strong>${escapeHtml(rent.area)}</strong> ${escapeHtml(rent.dwellingType)}: lower quartile $${rent.lowerQuartile}, median $${rent.medianRent}, upper quartile $${rent.upperQuartile} per week.
    ${escapeHtml(rent.note || "")}
  `;
}

function renderBreakdown(ratings) {
  if (!ratings || Object.keys(ratings).length === 0) {
    renderEmptyBreakdown();
    return;
  }

  els.ratingBreakdown.innerHTML = ratingFields.map(field => {
    const value = Number(ratings[field.key] || 0);
    const width = Math.max(0, Math.min(100, (value / 5) * 100));

    return `
      <div class="breakdown-row">
        <div class="breakdown-label">
          <span>${escapeHtml(field.label)}</span>
          <strong>${value.toFixed(1)}/5</strong>
        </div>
        <div class="meter"><span style="--width: ${width}%"></span></div>
      </div>
    `;
  }).join("");
}

function renderEmptyBreakdown() {
  if (!els.ratingBreakdown) return;

  els.ratingBreakdown.innerHTML = `
    <div class="info-card">
      <strong>No rating breakdown yet.</strong>
      <p>Once someone reviews this property, the category scores will appear here.</p>
    </div>
  `;
}

function renderReviews(reviews, flat) {
  if (!reviews.length) {
    els.reviewList.innerHTML = `
      <article class="review-card">
        <header>
          <strong>Be the first reviewer—</strong>
          <span>0 reviews</span>
        </header>
        <p>${escapeHtml(flat.note || "No tenant reviews have been added for this property yet.")}</p>
      </article>
    `;
    return;
  }

  els.reviewList.innerHTML = reviews.map(review => {
    const avg = calculateAverage(review.ratings);
    const date = review.createdAt ? new Date(review.createdAt) : new Date();

    return `
      <article class="review-card">
        <header>
          <strong>${avg.toFixed(1)} / 5 tenant score</strong>
          <span>${date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
        </header>
        <p>${escapeHtml(review.note || "No written note provided.")}</p>
      </article>
    `;
  }).join("");
}

function getReviewsForFlat(flat) {
  const key = flat.osmKey || flat.id;

  const demoMatches = state.sampleReviews
    .filter(item => (item.osmKey || `demo/${item.id}`) === key || item.id === flat.id)
    .map(item => ({
      ratings: item.ratings,
      note: item.note,
      createdAt: item.createdAt,
      source: "demo"
    }));

  const localMatches = state.localReviews.filter(item => item.osmKey === key);

  return [...demoMatches, ...localMatches];
}

function buildRatingInputs() {
  els.ratingInputs.innerHTML = ratingFields.map(field => `
    <div class="rating-field">
      <label for="${escapeAttribute(field.key)}">
        <span>${escapeHtml(field.label)}</span>
        <output id="${escapeAttribute(field.key)}Value">3</output>
      </label>
      <input id="${escapeAttribute(field.key)}" type="range" min="1" max="5" value="3" step="1">
      <small>${escapeHtml(field.hint)}</small>
    </div>
  `).join("");

  ratingFields.forEach(field => {
    const input = document.getElementById(field.key);
    const output = document.getElementById(`${field.key}Value`);

    input.addEventListener("input", () => {
      output.value = input.value;
      output.textContent = input.value;
    });
  });
}

function openReviewDialog() {
  if (!state.selectedFlat) {
    setStatus("Select a property first, then write a review.");
    document.getElementById("mapArea").scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  els.reviewDialogSuburb.textContent = `${state.selectedFlat.name} · ${state.selectedFlat.suburb || "Wellington"}`;
  els.reviewNote.value = "";

  ratingFields.forEach(field => {
    const input = document.getElementById(field.key);
    const output = document.getElementById(`${field.key}Value`);
    input.value = "3";
    output.textContent = "3";
  });

  if (typeof els.reviewDialog.showModal === "function") {
    els.reviewDialog.showModal();
  } else {
    alert("Your browser does not support dialog windows. Please use a modern browser for this prototype.");
  }
}

function saveReview(event) {
  event.preventDefault();
  if (!state.selectedFlat) return;

  const ratings = {};
  ratingFields.forEach(field => {
    ratings[field.key] = Number(document.getElementById(field.key).value);
  });

  const review = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    osmKey: state.selectedFlat.osmKey || state.selectedFlat.id,
    flatName: state.selectedFlat.name,
    suburb: state.selectedFlat.suburb,
    lat: state.selectedFlat.lat,
    lng: state.selectedFlat.lng,
    ratings,
    note: els.reviewNote.value.trim(),
    createdAt: new Date().toISOString()
  };

  state.localReviews.unshift(review);
  localStorage.setItem("flatwise_reviews_v6", JSON.stringify(state.localReviews));
  els.reviewDialog.close();
  renderDetails(state.selectedFlat);
  setStatus("Review saved locally in this browser. For a live build, connect this form to Supabase or Firebase.");
}

function inferRentArea(lat, lng, possibleName = "") {
  if (!state.rentData.length) return null;

  const normalisedName = String(possibleName || "").trim().toLowerCase();
  const directMatch = state.rentData.find(item => {
    const aliases = [item.area, ...(item.aliases || [])].map(value => String(value).toLowerCase());
    return aliases.some(alias => alias && normalisedName.includes(alias));
  });

  if (directMatch) return directMatch;

  return [...state.rentData]
    .filter(item => Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng)))
    .sort((a, b) => distanceMeters(lat, lng, a.lat, a.lng) - distanceMeters(lat, lng, b.lat, b.lng))[0] || null;
}

function setStatus(message) {
  if (els.mapStatus) els.mapStatus.textContent = message;
}

function parcelStyle(mode = "idle") {
  if (mode === "selected") {
    return {
      color: "#b23a2f",
      weight: 4,
      opacity: 1,
      fillColor: "#b23a2f",
      fillOpacity: 0.22
    };
  }

  if (mode === "hover") {
    return {
      color: "#101312",
      weight: 3.2,
      opacity: 0.98,
      fillColor: "#1f7a4f",
      fillOpacity: 0.2
    };
  }

  return {
    color: "#101312",
    weight: 1.15,
    opacity: 0.46,
    fillColor: "#fffaf0",
    fillOpacity: 0.02
  };
}

function buildingStyle() {
  return {
    color: "#1f7a4f",
    weight: 1,
    opacity: 0.38,
    fillColor: "#1f7a4f",
    fillOpacity: 0.08
  };
}

function markerIcon(className, label) {
  return L.divIcon({
    className: "",
    html: `
      <div class="demo-marker ${escapeAttribute(className)}">
        <span>${escapeHtml(label)}</span>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 38],
    popupAnchor: [0, -34]
  });
}

function selectedMarkerIcon() {
  return L.divIcon({
    className: "",
    html: `<div class="selected-marker"></div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 31],
    popupAnchor: [0, -28]
  });
}

function loadLocalReviews() {
  try {
    return JSON.parse(localStorage.getItem("flatwise_reviews_v6") || "[]");
  } catch {
    return [];
  }
}

function averageRatings(ratingObjects) {
  const totals = {};
  const counts = {};

  ratingObjects.forEach(ratings => {
    ratingFields.forEach(field => {
      const value = Number(ratings?.[field.key]);
      if (!Number.isFinite(value) || value <= 0) return;

      totals[field.key] = (totals[field.key] || 0) + value;
      counts[field.key] = (counts[field.key] || 0) + 1;
    });
  });

  return Object.fromEntries(Object.keys(totals).map(key => [key, totals[key] / counts[key]]));
}

function calculateAverage(ratings) {
  const values = ratingFields
    .map(field => Number(ratings?.[field.key]))
    .filter(value => Number.isFinite(value) && value > 0);

  if (!values.length) return 0;

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function scoreClass(score) {
  if (score >= 4) return "good";
  if (score >= 3) return "warning";
  return "bad";
}

function distanceMeters(lat1, lng1, lat2, lng2) {
  const radius = 6371000;
  const toRad = value => Number(value) * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1))
    * Math.cos(toRad(lat2))
    * Math.sin(dLng / 2) ** 2;

  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getFirst(object, keys) {
  for (const key of keys) {
    if (object && object[key] !== undefined && object[key] !== null && String(object[key]).trim() !== "") {
      return object[key];
    }
  }

  return null;
}

function formatArea(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  return `${Math.round(number).toLocaleString()} m²`;
}

function cryptoSafeId() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

function debounce(callback, wait) {
  let timeout;

  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => callback(...args), wait);
  };
}
