const CONFIG = window.FLATWISE_CONFIG || {};

const state = {
  map: null,
  selectedMarker: null,
  selectedFlat: null,
  sampleReviews: [],
  rentData: [],
  demoMarkers: [],
  localReviews: loadLocalReviews(),
  resizeTimer: null,
  searchTimer: null
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
  attachMapStabiliser();
  renderSearchResults("");
  invalidateMapSize("initial load");
}

function cacheElements() {
  els.map = document.getElementById("map");
  els.mapStatus = document.getElementById("mapStatus");
  els.detailsEmpty = document.getElementById("detailsEmpty");
  els.detailsContent = document.getElementById("detailsContent");
  els.photoFrame = document.getElementById("photoFrame");
  els.selectedType = document.getElementById("selectedType");
  els.selectedTitle = document.getElementById("selectedTitle");
  els.selectedSuburb = document.getElementById("selectedSuburb");
  els.selectedScore = document.getElementById("selectedScore");
  els.rentBenchmark = document.getElementById("rentBenchmark");
  els.reviewCount = document.getElementById("reviewCount");
  els.rentDescription = document.getElementById("rentDescription");
  els.ratingBreakdown = document.getElementById("ratingBreakdown");
  els.reviewList = document.getElementById("reviewList");
  els.searchInput = document.getElementById("searchInput");
  els.clearSearch = document.getElementById("clearSearch");
  els.reviewDialog = document.getElementById("reviewDialog");
  els.reviewForm = document.getElementById("reviewForm");
  els.ratingInputs = document.getElementById("ratingInputs");
  els.reviewNote = document.getElementById("reviewNote");
  els.reviewDialogSuburb = document.getElementById("reviewDialogSuburb");
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

  state.map = L.map("map", {
    zoomControl: false,
    scrollWheelZoom: true,
    preferCanvas: true,
    zoomAnimation: true,
    fadeAnimation: false,
    markerZoomAnimation: true
  }).setView(center, zoom);

  L.control.zoom({ position: "bottomright" }).addTo(state.map);

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 20,
    updateWhenIdle: true,
    keepBuffer: 4,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(state.map);

  state.map.on("click", handleMapClick);
}


function attachMapStabiliser() {
  if (!state.map || !els.map) return;

  const schedule = () => invalidateMapSize("layout changed");

  window.addEventListener("resize", schedule, { passive: true });
  window.addEventListener("load", () => invalidateMapSize("window loaded"), { once: true });

  if ("ResizeObserver" in window) {
    const observer = new ResizeObserver(schedule);
    observer.observe(els.map);
    observer.observe(document.querySelector(".map-panel"));
  }

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) invalidateMapSize("map visible");
    }, { threshold: 0.1 });
    observer.observe(els.map);
  }

  [60, 180, 420, 900].forEach(delay => {
    window.setTimeout(() => invalidateMapSize(`settle ${delay}`), delay);
  });
}

function invalidateMapSize(reason = "") {
  if (!state.map) return;
  window.clearTimeout(state.resizeTimer);
  state.resizeTimer = window.setTimeout(() => {
    state.map.invalidateSize({ animate: false, pan: false });
  }, 40);
}

function scrollToMap() {
  document.getElementById("mapArea").scrollIntoView({ behavior: "smooth", block: "start" });
  invalidateMapSize("scroll to map");
  window.setTimeout(() => invalidateMapSize("after scroll"), 420);
}

function scrollToDetails() {
  document.querySelector(".details-panel").scrollIntoView({ behavior: "smooth", block: "nearest" });
  invalidateMapSize("scroll to details");
}

function addDemoMarkers() {
  state.sampleReviews.forEach(flat => {
    const average = calculateAverage(flat.ratings);
    const marker = L.marker([flat.lat, flat.lng], {
      icon: markerIcon(scoreClass(average), average.toFixed(1))
    }).addTo(state.map);

    marker.bindPopup(`
      <div class="flat-popup">
        <strong>${escapeHtml(flat.name)}</strong>
        <span class="popup-meta">${escapeHtml(flat.suburb)} · ${average.toFixed(1)}/5</span>
      </div>
    `);

    marker.on("click", () => {
      selectFlat({ ...flat, source: "demo", osmKey: flat.osmKey || `demo/${flat.id}` });
    });

    state.demoMarkers.push({ marker, flat });
  });
}

async function handleMapClick(event) {
  const { lat, lng } = event.latlng;
  setStatus("Looking for a nearby building on OpenStreetMap…");

  try {
    const building = await findNearbyBuilding(lat, lng);
    const selected = building || createManualSelection(lat, lng);
    selectFlat(selected);
    setStatus(building ? "Building selected. Add a review or compare local rent guidance." : "No OSM building found nearby, so Flatwise selected this map point instead.");
  } catch (error) {
    console.warn(error);
    const selected = createManualSelection(lat, lng);
    selectFlat(selected);
    setStatus("Overpass could not be reached, so Flatwise selected this map point instead. The rest of the prototype still works.");
  }
}

async function findNearbyBuilding(lat, lng) {
  const radius = Number(CONFIG.overpassSearchRadiusMeters || 22);
  const query = `
    [out:json][timeout:12];
    (
      way(around:${radius},${lat},${lng})["building"];
      relation(around:${radius},${lat},${lng})["building"];
      way(around:${radius},${lat},${lng})["addr:housenumber"];
      relation(around:${radius},${lat},${lng})["addr:housenumber"];
    );
    out center tags 10;
  `;

  const url = `${CONFIG.overpassEndpoint}?data=${encodeURIComponent(query)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Overpass request failed: ${response.status}`);
  const data = await response.json();
  const candidates = (data.elements || [])
    .map(element => normaliseOsmElement(element, lat, lng))
    .filter(Boolean)
    .sort((a, b) => distanceMeters(lat, lng, a.lat, a.lng) - distanceMeters(lat, lng, b.lat, b.lng));

  return candidates[0] || null;
}

function normaliseOsmElement(element, fallbackLat, fallbackLng) {
  const lat = element.center?.lat || element.lat || fallbackLat;
  const lng = element.center?.lon || element.lon || fallbackLng;
  const tags = element.tags || {};
  const road = tags["addr:street"] || tags.name || "Selected building";
  const houseNumber = tags["addr:housenumber"];
  const suburb = inferSuburb(lat, lng, tags["addr:suburb"] || tags.suburb);
  const displayName = CONFIG.showExactAddress && houseNumber ? `${houseNumber} ${road}` : `${road} area`;

  return {
    id: `${element.type}/${element.id}`,
    osmKey: `${element.type}/${element.id}`,
    source: "osm",
    name: displayName,
    suburb: suburb?.area || tags["addr:city"] || "Wellington",
    lat,
    lng,
    ratings: {},
    note: "No Flatwise reviews yet. Be the first tenant voice for this location.",
    tags
  };
}

function createManualSelection(lat, lng) {
  const suburb = inferSuburb(lat, lng);
  return {
    id: `manual/${lat.toFixed(5)},${lng.toFixed(5)}`,
    osmKey: `manual/${lat.toFixed(5)},${lng.toFixed(5)}`,
    source: "manual",
    name: "Selected map point",
    suburb: suburb?.area || "Wellington",
    lat,
    lng,
    ratings: {},
    note: "No building was found at this click. You can still use this as a prototype review location."
  };
}

function selectFlat(flat) {
  state.selectedFlat = flat;
  placeSelectedMarker(flat);
  renderDetails(flat);
  els.detailsEmpty.classList.add("hidden");
  els.detailsContent.classList.remove("hidden");
  invalidateMapSize("selected flat");
  window.setTimeout(scrollToDetails, 120);
}

function placeSelectedMarker(flat) {
  if (state.selectedMarker) state.selectedMarker.remove();
  state.selectedMarker = L.marker([flat.lat, flat.lng], {
    icon: selectedMarkerIcon()
  }).addTo(state.map);
  state.selectedMarker.bindPopup(`<strong>${escapeHtml(flat.name)}</strong><br><span class="popup-meta">Selected for review</span>`, { autoPan: false }).openPopup();
}

function renderDetails(flat) {
  const reviews = getReviewsForFlat(flat);
  const combinedRatings = reviews.length ? averageRatings(reviews.map(review => review.ratings)) : flat.ratings || {};
  const averageScore = Object.keys(combinedRatings).length ? calculateAverage(combinedRatings) : null;
  const rent = inferSuburb(flat.lat, flat.lng, flat.suburb);

  els.selectedType.textContent = flat.source === "osm" ? "OpenStreetMap building" : flat.source === "demo" ? "Demo flat" : "Selected location";
  els.selectedTitle.textContent = flat.name || "Selected flat";
  els.selectedSuburb.textContent = rent?.area || flat.suburb || "Wellington";
  els.selectedScore.textContent = averageScore ? `${averageScore.toFixed(1)} / 5` : "No rating";
  els.selectedScore.className = `rating-pill ${averageScore ? scoreClass(averageScore) : ""}`;
  els.reviewCount.textContent = String(reviews.length);

  renderPhoto(flat);
  renderRent(rent);
  renderBreakdown(combinedRatings);
  renderReviews(reviews, flat);
}

function renderPhoto(flat) {
  if (CONFIG.enableGoogleStreetView && CONFIG.googleStreetViewApiKey) {
    const url = `https://maps.googleapis.com/maps/api/streetview?size=800x420&location=${flat.lat},${flat.lng}&fov=80&pitch=0&key=${encodeURIComponent(CONFIG.googleStreetViewApiKey)}`;
    els.photoFrame.innerHTML = `<img src="${url}" alt="Street view image near ${escapeAttribute(flat.name)}" loading="lazy">`;
    return;
  }

  els.photoFrame.innerHTML = `
    <div class="photo-placeholder">
      <span class="building-icon">⌂</span>
      <strong>${escapeHtml(flat.name || "Selected flat")}</strong>
      <small>Image layer ready. Add a restricted Street View API key in <code>js/config.js</code>, or replace this with tenant-uploaded images later.</small>
    </div>
  `;
}

function renderRent(rent) {
  if (!rent) {
    els.rentBenchmark.textContent = "No local data";
    els.rentDescription.textContent = "No rent benchmark was found for this selected area yet. Add one in data/rent-data.json.";
    return;
  }

  els.rentBenchmark.textContent = `$${rent.medianRent}/week`;
  els.rentDescription.innerHTML = `
    <strong>${escapeHtml(rent.area)}</strong> ${escapeHtml(rent.dwellingType)} benchmark:
    lower quartile $${rent.lowerQuartile}, median $${rent.medianRent}, upper quartile $${rent.upperQuartile} per week.
    Replace this demo file with official MBIE/Tenancy Services market-rent data for a live build.
  `;
}

function renderBreakdown(ratings) {
  if (!ratings || Object.keys(ratings).length === 0) {
    els.ratingBreakdown.innerHTML = `
      <div class="review-card">
        <strong>No rating breakdown yet.</strong>
        <p>Once someone reviews this flat, the category scores will appear here.</p>
      </div>
    `;
    return;
  }

  els.ratingBreakdown.innerHTML = ratingFields.map(field => {
    const value = Number(ratings[field.key] || 0);
    const width = Math.max(0, Math.min(100, (value / 5) * 100));
    return `
      <div class="breakdown-row">
        <div class="breakdown-label"><span>${escapeHtml(field.label)}</span><span>${value.toFixed(1)}/5</span></div>
        <div class="meter" aria-hidden="true"><span style="--width:${width}%"></span></div>
      </div>
    `;
  }).join("");
}

function renderReviews(reviews, flat) {
  if (!reviews.length) {
    els.reviewList.innerHTML = `
      <div class="review-card">
        <header><strong>Be the first reviewer</strong><span>—</span></header>
        <p>${escapeHtml(flat.note || "No tenant reviews have been added for this location yet.")}</p>
      </div>
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
          <time datetime="${date.toISOString()}">${date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</time>
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
    .map(item => ({ ratings: item.ratings, note: item.note, createdAt: item.createdAt, source: "demo" }));

  const localMatches = state.localReviews.filter(item => item.osmKey === key);
  return [...demoMatches, ...localMatches];
}

function buildRatingInputs() {
  els.ratingInputs.innerHTML = ratingFields.map(field => `
    <div class="rating-field">
      <label for="${field.key}">
        <span>${field.label}</span>
        <output id="${field.key}Value">3</output>
      </label>
      <input type="range" id="${field.key}" name="${field.key}" min="1" max="5" step="1" value="3" aria-describedby="${field.key}Hint" />
      <small id="${field.key}Hint">${field.hint}</small>
    </div>
  `).join("");

  ratingFields.forEach(field => {
    const input = document.getElementById(field.key);
    const output = document.getElementById(`${field.key}Value`);
    input.addEventListener("input", () => { output.value = input.value; output.textContent = input.value; });
  });
}

function openReviewDialog() {
  if (!state.selectedFlat) {
    setStatus("Select a flat or building first, then write a review.");
    scrollToMap();
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
  localStorage.setItem("flatwiseLocalReviews", JSON.stringify(state.localReviews));
  els.reviewDialog.close();
  renderDetails(state.selectedFlat);
  setStatus("Review saved in this browser. On a real build, this would go to a moderated database.");
}

function bindUI() {
  document.getElementById("jumpToMap").addEventListener("click", scrollToMap);
  document.getElementById("jumpToHow").addEventListener("click", () => document.getElementById("howItWorks").scrollIntoView({ behavior: "smooth" }));
  document.getElementById("startReviewTop").addEventListener("click", scrollToMap);
  document.getElementById("startReviewHero").addEventListener("click", scrollToMap);
  document.getElementById("openDemoFlat").addEventListener("click", () => {
    const demo = state.sampleReviews[0];
    state.map.setView([demo.lat, demo.lng], 18, { animate: false });
    invalidateMapSize("open demo flat");
    selectFlat({ ...demo, source: "demo", osmKey: demo.osmKey || `demo/${demo.id}` });
    scrollToMap();
  });

  document.getElementById("locateWellington").addEventListener("click", () => {
    state.map.setView(CONFIG.defaultMapCenter || [-41.29484, 174.77885], CONFIG.defaultZoom || 17, { animate: false });
    invalidateMapSize("locate Wellington");
  });
  document.getElementById("reviewSelected").addEventListener("click", openReviewDialog);
  document.getElementById("writeReviewInline").addEventListener("click", openReviewDialog);
  document.getElementById("cancelReview").addEventListener("click", () => els.reviewDialog.close());
  els.reviewForm.addEventListener("submit", saveReview);

  els.searchInput.addEventListener("input", event => {
    window.clearTimeout(state.searchTimer);
    const value = event.target.value;
    state.searchTimer = window.setTimeout(() => renderSearchResults(value), 180);
  });

  els.searchInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      searchAddress(event.target.value);
    }
  });
  els.clearSearch.addEventListener("click", () => {
    els.searchInput.value = "";
    renderSearchResults("");
    els.searchInput.focus();
  });
}

function renderSearchResults(query) {
  const q = query.trim().toLowerCase();
  if (!q) {
    state.demoMarkers.forEach(({ marker }) => marker.addTo(state.map));
    return;
  }

  const matches = state.demoMarkers.filter(({ flat }) => {
    const haystack = [flat.name, flat.suburb, flat.note, ...Object.keys(flat.ratings || {})].join(" ").toLowerCase();
    return haystack.includes(q);
  });

  state.demoMarkers.forEach(({ marker }) => marker.remove());
  matches.forEach(({ marker }) => marker.addTo(state.map));

  if (matches.length) {
    const group = L.featureGroup(matches.map(item => item.marker));
    state.map.fitBounds(group.getBounds().pad(0.28), { animate: false });
    invalidateMapSize("search fit bounds");
    setStatus(`${matches.length} demo flat${matches.length === 1 ? "" : "s"} matched your search.`);
  } else {
    setStatus("No demo flats matched. Press Enter to search OpenStreetMap for that address, or click any map building to select it.");
  }
}

async function searchAddress(query) {
  const q = query.trim();
  if (q.length < 3) {
    setStatus("Type a suburb, street, or address first.");
    return;
  }

  setStatus("Searching OpenStreetMap for that address…");

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=nz&q=${encodeURIComponent(q)}`;
    const response = await fetch(url, {
      headers: {
        "Accept": "application/json"
      }
    });
    if (!response.ok) throw new Error(`Address search failed: ${response.status}`);
    const results = await response.json();

    if (!results.length) {
      setStatus("No address result found. Try a simpler search like 'Jessie Street Wellington', then click the building.");
      return;
    }

    const result = results[0];
    const lat = Number(result.lat);
    const lng = Number(result.lon);
    state.map.setView([lat, lng], 18, { animate: false });
    invalidateMapSize("address search");

    const building = await findNearbyBuilding(lat, lng);
    selectFlat(building || createManualSelection(lat, lng));
    setStatus("Address found. Flatwise selected the closest building or map point for review.");
  } catch (error) {
    console.warn(error);
    setStatus("Address search could not be reached. You can still pan the map and click the building manually.");
  }
}

function inferSuburb(lat, lng, explicitName = "") {
  if (!state.rentData.length) return explicitName ? { area: explicitName } : null;
  if (explicitName) {
    const exact = state.rentData.find(item => item.area.toLowerCase() === explicitName.toLowerCase());
    if (exact) return exact;
  }
  return state.rentData
    .map(item => ({ ...item, distance: distanceMeters(lat, lng, item.lat, item.lng) }))
    .sort((a, b) => a.distance - b.distance)[0];
}

function averageRatings(ratingSets) {
  const result = {};
  ratingFields.forEach(field => {
    const values = ratingSets.map(set => Number(set[field.key])).filter(value => Number.isFinite(value) && value > 0);
    if (values.length) result[field.key] = values.reduce((sum, value) => sum + value, 0) / values.length;
  });
  return result;
}

function calculateAverage(ratings) {
  const values = ratingFields.map(field => Number(ratings?.[field.key])).filter(value => Number.isFinite(value) && value > 0);
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function scoreClass(score) {
  if (score >= 4) return "good";
  if (score >= 3) return "warning";
  return "bad";
}

function markerIcon(className, label) {
  return L.divIcon({
    className: "",
    html: `<div class="custom-marker demo-marker ${className}"><span>${label}</span></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -31]
  });
}

function selectedMarkerIcon() {
  return L.divIcon({
    className: "",
    html: `<div class="custom-marker selected-marker"><span>✓</span></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -31]
  });
}

function loadLocalReviews() {
  try {
    return JSON.parse(localStorage.getItem("flatwiseLocalReviews") || "[]");
  } catch {
    return [];
  }
}

function setStatus(message) {
  els.mapStatus.textContent = message;
}

function distanceMeters(lat1, lon1, lat2, lon2) {
  const radius = 6371000;
  const toRad = value => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  }[char]));
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}
