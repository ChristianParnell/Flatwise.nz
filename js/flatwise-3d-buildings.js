(() => {
  "use strict";

  const config = window.FLATWISE_CONFIG || {};
  const settings = { ...(config.threeD || {}) };

  if (!window.L) {
    console.warn("Flatwise 3D shadow cast could not start because Leaflet is not available.");
    return;
  }

  const THREE_D_MODE_VALUE = settings.sunlightModeValue || "threeDShadow";
  const THREE_D_MODE_LABEL = settings.sunlightModeLabel || "3D shadow cast";
  const SATELLITE_MODE_VALUE = settings.satelliteModeValue || "satelliteView";
  const SATELLITE_MODE_LABEL = settings.satelliteModeLabel || "Satellite view";
  const SELECT_ID = settings.sunlightModeSelectId || "sunlightMode";

  const state = {
    map: null,
    active: false,
    enabled3d: true,
    enabledShadows: true,
    refreshTimer: 0,
    abortController: null,
    cache: new Map(),
    features: [],
    sourceLabel: "ready",
    originalTileState: null,
    basemapSwapped: false,
    layers: {
      roofs: null,
      walls: null,
      shadows: null
    },
    control: {
      container: null,
      status: null,
      source: null,
      modeToggle: null,
      shadowToggle: null,
      datetimeInput: null
    }
  };

  class UnifiedShadowCanvasLayer extends L.Layer {
    constructor(options = {}) {
      super(options);
      this.options = { pane: "flatwiseShadowPane", ...options };
      this._shapes = [];
      this._canvas = null;
      this._ctx = null;
      this._map = null;
      this._frame = 0;
    }

    onAdd(map) {
      this._map = map;
      this._canvas = L.DomUtil.create("canvas", "flatwise-unified-shadow-canvas");
      this._ctx = this._canvas.getContext("2d");
      map.getPane(this.options.pane || "overlayPane").appendChild(this._canvas);
      map.on("move zoom resize zoomend viewreset", this._scheduleDraw, this);
      this._resetCanvas();
    }

    onRemove(map) {
      map.off("move zoom resize zoomend viewreset", this._scheduleDraw, this);
      if (this._canvas?.parentNode) this._canvas.parentNode.removeChild(this._canvas);
      if (this._frame) window.cancelAnimationFrame(this._frame);
      this._frame = 0;
      this._canvas = null;
      this._ctx = null;
      this._map = null;
    }

    setShapes(shapes) {
      this._shapes = Array.isArray(shapes) ? shapes : [];
      this._scheduleDraw();
    }

    _scheduleDraw() {
      if (!this._map || !this._canvas) return;
      if (this._frame) window.cancelAnimationFrame(this._frame);
      this._frame = window.requestAnimationFrame(() => {
        this._frame = 0;
        this._resetCanvas();
      });
    }

    _resetCanvas() {
      if (!this._map || !this._canvas || !this._ctx) return;

      const size = this._map.getSize();
      const pixelRatio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      const topLeft = this._map.containerPointToLayerPoint([0, 0]);

      this._canvas.width = Math.round(size.x * pixelRatio);
      this._canvas.height = Math.round(size.y * pixelRatio);
      this._canvas.style.width = `${size.x}px`;
      this._canvas.style.height = `${size.y}px`;
      L.DomUtil.setPosition(this._canvas, topLeft);

      const ctx = this._ctx;
      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      ctx.clearRect(0, 0, size.x, size.y);

      if (!this._shapes.length) return;

      const fillOpacity = clamp(settings.shadowOpacity ?? 0.18, 0, 1);
      ctx.fillStyle = colorToRgba(settings.shadowColor || "#111827", fillOpacity);
      ctx.beginPath();

      for (const shape of this._shapes) {
        const points = (shape || [])
          .map((latLng) => this._map.latLngToLayerPoint(latLng).subtract(topLeft))
          .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));

        if (points.length < 3) continue;
        const clockwisePoints = ensureClockwiseScreenPoints(points);
        ctx.moveTo(clockwisePoints[0].x, clockwisePoints[0].y);
        for (let index = 1; index < clockwisePoints.length; index += 1) {
          ctx.lineTo(clockwisePoints[index].x, clockwisePoints[index].y);
        }
        ctx.closePath();
      }

      // One fill call means overlapping building shadows do not stack darker on each other.
      ctx.fill("nonzero");
    }
  }

  waitForFlatwiseMap();

  function waitForFlatwiseMap() {
    const existingMap = window.FlatwiseMap || window.FLATWISE_MAPS?.[0];
    if (existingMap) {
      initialise(existingMap);
      return;
    }

    window.addEventListener("flatwise:map-ready", (event) => {
      if (event.detail?.map) initialise(event.detail.map);
    }, { once: true });

    let checks = 0;
    const timer = window.setInterval(() => {
      const map = window.FlatwiseMap || window.FLATWISE_MAPS?.[0];
      if (map || checks > 100) {
        window.clearInterval(timer);
        if (map) initialise(map);
      }
      checks += 1;
    }, 120);
  }

  function initialise(map) {
    if (state.map) return;
    state.map = map;

    createPanes();
    createLayers();
    installRuntimeStyles();
    cleanupLegacySunlightUI();
    createControl();
    bindMapEvents();
    updateStatus("Choose 3D shadow cast to load the building layer.");
  }

  function createPanes() {
    const panes = state.map.getPanes();

    if (!panes.flatwiseShadowPane) state.map.createPane("flatwiseShadowPane");
    if (!panes.flatwiseWallPane) state.map.createPane("flatwiseWallPane");
    if (!panes.flatwiseRoofPane) state.map.createPane("flatwiseRoofPane");

    const shadowPane = state.map.getPane("flatwiseShadowPane");
    const wallPane = state.map.getPane("flatwiseWallPane");
    const roofPane = state.map.getPane("flatwiseRoofPane");

    shadowPane.style.zIndex = 371;
    wallPane.style.zIndex = 383;
    roofPane.style.zIndex = 389;

    shadowPane.classList.add("flatwise-3d-shadow-pane");
    wallPane.classList.add("flatwise-3d-wall-pane");
    roofPane.classList.add("flatwise-3d-roof-pane");
  }

  function createLayers() {
    state.layers.shadows = new UnifiedShadowCanvasLayer({ pane: "flatwiseShadowPane" });
    state.layers.walls = L.layerGroup();
    state.layers.roofs = L.layerGroup();
  }

  function bindMapEvents() {
    state.map.on("moveend zoomend", () => scheduleRefresh(false));
    state.map.on("zoomstart movestart", () => {
      if (state.active) updateStatus("Updating 3D shadow cast…");
    });
  }

  function createControl() {
    const control = L.control({ position: "topright" });

    control.onAdd = () => {
      const container = L.DomUtil.create("div", "flatwise-3d-control");
      container.setAttribute("aria-label", "3D shadow cast controls");
      container.innerHTML = `
        <div class="flatwise-3d-control__title">3D shadow cast</div>
        <p class="flatwise-3d-control__note">Anchors shadows to the real building footprint. Satellite view is a separate map mode.</p>
        <label class="flatwise-3d-check">
          <input type="checkbox" data-flatwise-3d-toggle checked />
          <span>Building footprints</span>
        </label>
        <label class="flatwise-3d-check">
          <input type="checkbox" data-flatwise-shadow-toggle checked />
          <span>Cast shadows</span>
        </label>
        <label class="flatwise-3d-time">
          <span>Date/time</span>
          <input type="datetime-local" data-flatwise-shadow-time />
        </label>
        <div class="flatwise-3d-control__source" data-flatwise-source>Source: ready</div>
        <div class="flatwise-3d-control__status" data-flatwise-status>Choose 3D shadow cast.</div>
      `;

      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.disableScrollPropagation(container);

      state.control.container = container;
      state.control.status = container.querySelector("[data-flatwise-status]");
      state.control.source = container.querySelector("[data-flatwise-source]");
      state.control.modeToggle = container.querySelector("[data-flatwise-3d-toggle]");
      state.control.shadowToggle = container.querySelector("[data-flatwise-shadow-toggle]");
      state.control.datetimeInput = container.querySelector("[data-flatwise-shadow-time]");

      state.control.datetimeInput.value = toDateTimeLocalValue(settings.shadowDateTime) || getDefaultShadowDateTimeValue();

      state.control.modeToggle.addEventListener("change", () => {
        state.enabled3d = state.control.modeToggle.checked;
        toggleVisualLayers();
        scheduleRefresh(true);
      });

      state.control.shadowToggle.addEventListener("change", () => {
        state.enabledShadows = state.control.shadowToggle.checked;
        toggleVisualLayers();
        scheduleRefresh(true);
      });

      state.control.datetimeInput.addEventListener("change", () => scheduleRefresh(true));

      installModeSelectIntegration();
      return container;
    };

    control.addTo(state.map);
  }

  function installModeSelectIntegration() {
    const select = document.getElementById(SELECT_ID);

    if (!select) {
      state.control.container?.classList.add("is-visible");
      activate3DShadowMode();
      return;
    }

    keepOnly3DShadowOption(select);
    syncFromModeSelect();

    select.addEventListener("change", () => {
      window.setTimeout(syncFromModeSelect, 0);
    });
  }

  function keepOnly3DShadowOption(select) {
    const previousValue = [THREE_D_MODE_VALUE, SATELLITE_MODE_VALUE].includes(select.value) ? select.value : "off";
    select.innerHTML = "";

    const offOption = document.createElement("option");
    offOption.value = "off";
    offOption.textContent = "Off";
    select.appendChild(offOption);

    const threeDOption = document.createElement("option");
    threeDOption.value = THREE_D_MODE_VALUE;
    threeDOption.textContent = THREE_D_MODE_LABEL;
    select.appendChild(threeDOption);

    const satelliteOption = document.createElement("option");
    satelliteOption.value = SATELLITE_MODE_VALUE;
    satelliteOption.textContent = SATELLITE_MODE_LABEL;
    select.appendChild(satelliteOption);

    select.value = previousValue;
  }

  function syncFromModeSelect() {
    cleanupLegacySunlightUI();

    const select = document.getElementById(SELECT_ID);
    const selectedValue = select ? select.value : THREE_D_MODE_VALUE;
    const shouldActivate3D = selectedValue === THREE_D_MODE_VALUE || !select;
    const shouldActivateSatellite = selectedValue === SATELLITE_MODE_VALUE;

    state.control.container?.classList.toggle("is-visible", shouldActivate3D);
    document.body.classList.toggle("flatwise-3d-shadow-active", shouldActivate3D);
    document.body.classList.toggle("flatwise-satellite-view-active", shouldActivateSatellite);

    if (shouldActivate3D) {
      setSatelliteBasemap(false);
      activate3DShadowMode();
    } else {
      deactivate3DShadowMode();
      setSatelliteBasemap(shouldActivateSatellite);
    }
  }

  function activate3DShadowMode() {
    state.active = true;
    state.enabled3d = state.control.modeToggle ? state.control.modeToggle.checked : true;
    state.enabledShadows = state.control.shadowToggle ? state.control.shadowToggle.checked : true;

    toggleVisualLayers();
    scheduleRefresh(true);
  }

  function deactivate3DShadowMode() {
    state.active = false;
    state.enabled3d = false;
    state.enabledShadows = false;
    clearVisualLayers();
    toggleVisualLayers();
    updateStatus("3D shadow cast is off.");
  }

  function toggleVisualLayers() {
    toggleLayer(state.layers.roofs, state.active && state.enabled3d);
    toggleLayer(state.layers.walls, state.active && state.enabled3d);
    toggleLayer(state.layers.shadows, state.active && state.enabledShadows);
  }

  function toggleLayer(layer, shouldBeVisible) {
    if (!state.map || !layer) return;
    const isVisible = state.map.hasLayer(layer);

    if (shouldBeVisible && !isVisible) layer.addTo(state.map);
    if (!shouldBeVisible && isVisible) layer.removeFrom(state.map);
  }

  function scheduleRefresh(force = false) {
    if (!state.map || !state.active) return;

    window.clearTimeout(state.refreshTimer);
    state.refreshTimer = window.setTimeout(() => {
      refresh(force).catch((error) => {
        if (error?.name === "AbortError") return;
        console.warn("Flatwise 3D shadow refresh failed:", error);
        clearVisualLayers();
        updateStatus("3D buildings could not refresh from the council/LINZ source. Zoom closer or pan slightly.");
      });
    }, force ? 30 : (settings.refreshDebounceMs || 300));
  }

  async function refresh(force = false) {
    if (!state.active) return;

    const minZoom = settings.minZoom || 17;
    if (state.map.getZoom() < minZoom) {
      clearVisualLayers();
      updateStatus(`Zoom to level ${minZoom} or closer to load 3D shadow cast.`);
      return;
    }

    const bounds = state.map.getBounds().pad(0.08);
    if (isQueryTooLarge(bounds)) {
      clearVisualLayers();
      updateStatus("This view is too wide for live 3D shadow casting. Zoom closer to a city block.");
      return;
    }

    const geoJson = await loadBuildingsForView(bounds, force);
    state.features = limitFeatures(geoJson.features || []);
    renderBuildings();

    const count = state.features.length;
    updateStatus(`${state.enabled3d ? "Building footprints" : "Buildings hidden"} + ${state.enabledShadows ? "anchored shadow cast" : "shadows hidden"}. ${count} buildings drawn.`);
    updateSource(`Source: ${state.sourceLabel}`);
  }

  async function loadBuildingsForView(bounds, force = false) {
    const key = makeCacheKey(bounds);
    if (!force && state.cache.has(key)) return state.cache.get(key);

    if (state.abortController) state.abortController.abort();
    state.abortController = new AbortController();

    const sources = getBuildingSources();
    let lastError = null;

    for (const source of sources) {
      try {
        const url = makeArcGisQueryUrl(source, bounds);
        const response = await fetch(url, { signal: state.abortController.signal });

        if (!response.ok) {
          throw new Error(`${source.label} returned ${response.status}`);
        }

        const payload = await response.json();
        const geoJson = source.preferJson ? convertArcGisJsonToGeoJson(payload) : normaliseGeoJson(payload);

        if (geoJson.features.length) {
          state.sourceLabel = source.label;
          storeCacheEntry(key, geoJson);
          return geoJson;
        }
      } catch (error) {
        if (error?.name === "AbortError") throw error;
        lastError = error;
      }
    }

    if (lastError) console.warn("Flatwise 3D source fallback used no features:", lastError);
    const empty = { type: "FeatureCollection", features: [] };
    storeCacheEntry(key, empty);
    return empty;
  }

  function getBuildingSources() {
    const center = state.map.getCenter();
    const sources = [];
    const urls = config.urls || {};

    if (inNamedBounds(center, settings.cityBounds?.wellington) && urls.wccBuildingFootprints) {
      sources.push({
        key: "wcc",
        label: "WCC building heights",
        url: urls.wccBuildingFootprints,
        preferJson: true,
        outFields: "*"
      });
    }

    if (urls.buildingOutlines) {
      sources.push({
        key: "linz",
        label: "LINZ building footprints",
        url: urls.buildingOutlines,
        preferJson: false,
        outFields: config.linz?.buildingOutFields || "*"
      });
    }

    return sources;
  }

  function makeArcGisQueryUrl(source, bounds) {
    const params = new URLSearchParams({
      f: source.preferJson ? "json" : "geojson",
      where: "1=1",
      outFields: source.outFields || "*",
      returnGeometry: "true",
      spatialRel: "esriSpatialRelIntersects",
      inSR: "4326",
      outSR: "4326",
      geometryType: "esriGeometryEnvelope",
      geometry: JSON.stringify({
        xmin: bounds.getWest(),
        ymin: bounds.getSouth(),
        xmax: bounds.getEast(),
        ymax: bounds.getNorth(),
        spatialReference: { wkid: 4326 }
      }),
      resultRecordCount: String(settings.resultRecordCount || 450),
      geometryPrecision: String(settings.geometryPrecision || 6)
    });

    return `${source.url}?${params.toString()}`;
  }

  function normaliseGeoJson(payload) {
    if (!payload) return { type: "FeatureCollection", features: [] };
    if (payload.type === "FeatureCollection" && Array.isArray(payload.features)) return payload;
    if (Array.isArray(payload.features)) return { type: "FeatureCollection", features: payload.features };
    return { type: "FeatureCollection", features: [] };
  }

  function convertArcGisJsonToGeoJson(payload) {
    if (!payload || !Array.isArray(payload.features)) {
      return { type: "FeatureCollection", features: [] };
    }

    const features = payload.features
      .map((feature, index) => {
        const geometry = arcGisGeometryToGeoJson(feature.geometry);
        if (!geometry) return null;

        return {
          type: "Feature",
          id: feature.attributes?.OBJECTID || feature.attributes?.objectid || index,
          properties: feature.attributes || {},
          geometry
        };
      })
      .filter(Boolean);

    return { type: "FeatureCollection", features };
  }

  function arcGisGeometryToGeoJson(geometry) {
    if (!geometry) return null;

    if (Array.isArray(geometry.rings)) {
      const polygons = splitRingsToPolygons(geometry.rings);
      if (!polygons.length) return null;
      if (polygons.length === 1) return { type: "Polygon", coordinates: polygons[0] };
      return { type: "MultiPolygon", coordinates: polygons };
    }

    if (Array.isArray(geometry.paths)) {
      return { type: "MultiLineString", coordinates: geometry.paths };
    }

    return null;
  }

  function splitRingsToPolygons(rings) {
    const cleanRings = rings
      .filter((ring) => Array.isArray(ring) && ring.length >= 4)
      .map((ring) => ring.map((point) => [Number(point[0]), Number(point[1])]).filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1])));

    if (!cleanRings.length) return [];

    const outerRings = [];
    const holes = [];

    cleanRings.forEach((ring) => {
      if (Math.abs(ringSignedArea(ring)) < 1e-12) return;
      if (ringSignedArea(ring) < 0) outerRings.push([ring]);
      else holes.push(ring);
    });

    if (!outerRings.length) outerRings.push([cleanRings[0]]);

    holes.forEach((hole) => {
      const testPoint = hole[0];
      const target = outerRings.find((polygon) => pointInRing(testPoint, polygon[0]));
      if (target) target.push(hole);
    });

    return outerRings;
  }

  function renderBuildings() {
    clearVisualLayers();

    if (!state.features.length || (!state.enabled3d && !state.enabledShadows)) return;

    const sortedFeatures = [...state.features].sort((a, b) => {
      const ay = getFeatureCenterLatLng(a)?.lat || 0;
      const by = getFeatureCenterLatLng(b)?.lat || 0;
      return by - ay;
    });

    const sun = getSunPosition(getSelectedDate(), state.map.getCenter().lat, state.map.getCenter().lng);
    const unifiedShadowShapes = [];

    for (const feature of sortedFeatures) {
      const rings = getFeatureLatLngRings(feature);
      if (!rings.length) continue;

      const heightMeters = getBuildingHeight(feature.properties || {});
      const extrusion = getExtrusionOffset(heightMeters);
      const mainRing = rings[0];

      if (state.enabledShadows) {
        collectShadowShapes(mainRing, heightMeters, sun, unifiedShadowShapes);
      }

      if (state.enabled3d) {
        if (Math.abs(extrusion.x) > 0.05 || Math.abs(extrusion.y) > 0.05) {
          renderWalls(mainRing, extrusion, heightMeters);
        }
        renderRoof(rings, extrusion, heightMeters);
      }
    }

    if (state.enabledShadows && typeof state.layers.shadows?.setShapes === "function") {
      state.layers.shadows.setShapes(unifiedShadowShapes);
    }
  }

  function collectShadowShapes(ring, heightMeters, sun, targetShapes) {
    const cleanRing = cleanClosedRing(ring);
    if (!cleanRing.length || cleanRing.length < 3) return;

    const altitude = clamp(sun.altitude || 0.18, 0.08, 1.3);
    const shadowMeters = clamp(
      heightMeters / Math.tan(altitude),
      settings.minShadowLengthMeters || 2,
      settings.maxShadowLengthMeters || 95
    );

    const shadowBearing = normaliseRadians((sun.azimuth || 0) + Math.PI);
    const shiftedRing = cleanRing.map((latLng) => offsetLatLngByMeters(latLng, shadowBearing, shadowMeters));

    // Store all projected roof shapes and connecting edge strips, then draw them in one canvas fill.
    // That makes the shadows behave like a union mask: where shadows overlap, they stay one tint.
    targetShapes.push(closeRing(shiftedRing));

    for (let index = 0; index < cleanRing.length; index += 1) {
      const nextIndex = (index + 1) % cleanRing.length;
      const a = cleanRing[index];
      const b = cleanRing[nextIndex];
      const shiftedB = shiftedRing[nextIndex];
      const shiftedA = shiftedRing[index];

      if (!a || !b || !shiftedA || !shiftedB) continue;
      targetShapes.push(closeRing([a, b, shiftedB, shiftedA]));
    }
  }

  function renderWalls(ring, extrusion, heightMeters) {
    if (!ring || ring.length < 3) return;

    const points = ring.map((latLng) => state.map.latLngToLayerPoint(latLng));
    const fillOpacity = clamp((settings.wallOpacityMin ?? 0.72) + (heightMeters / 110), settings.wallOpacityMin ?? 0.72, settings.wallOpacityMax ?? 0.88);

    for (let index = 0; index < points.length - 1; index += 1) {
      const pointA = points[index];
      const pointB = points[index + 1];
      const topA = L.point(pointA.x + extrusion.x, pointA.y + extrusion.y);
      const topB = L.point(pointB.x + extrusion.x, pointB.y + extrusion.y);

      const wallLatLngs = [pointA, pointB, topB, topA].map((point) => state.map.layerPointToLatLng(point));
      L.polygon(wallLatLngs, {
        pane: "flatwiseWallPane",
        className: "flatwise-3d-wall",
        interactive: false,
        stroke: true,
        weight: 0.6,
        color: "#334155",
        opacity: 0.38,
        fill: true,
        fillColor: "#64748b",
        fillOpacity
      }).addTo(state.layers.walls);
    }
  }

  function renderRoof(rings, extrusion, heightMeters) {
    const extrudedRings = rings
      .map((ring) => ring.map((latLng) => {
        const point = state.map.latLngToLayerPoint(latLng);
        return state.map.layerPointToLatLng(L.point(point.x + extrusion.x, point.y + extrusion.y));
      }))
      .filter((ring) => ring.length >= 3);

    if (!extrudedRings.length) return;

    const roofTone = heightMeters > 18 ? "#7f8fa1" : "#94a3b8";
    L.polygon(extrudedRings, {
      pane: "flatwiseRoofPane",
      className: "flatwise-3d-roof",
      interactive: false,
      stroke: true,
      weight: 0.85,
      color: "#334155",
      opacity: 0.62,
      fill: true,
      fillColor: roofTone,
      fillOpacity: settings.roofOpacity ?? 0.98
    }).addTo(state.layers.roofs);
  }

  function clearVisualLayers() {
    if (typeof state.layers.shadows?.setShapes === "function") state.layers.shadows.setShapes([]);
    else state.layers.shadows?.clearLayers?.();
    state.layers.walls?.clearLayers();
    state.layers.roofs?.clearLayers();
  }

  function getFeatureLatLngRings(feature) {
    if (!feature?.geometry) return [];

    const geometry = feature.geometry;
    let coordinateRings = [];

    if (geometry.type === "Polygon") {
      coordinateRings = geometry.coordinates || [];
    } else if (geometry.type === "MultiPolygon") {
      const largestPolygon = (geometry.coordinates || [])
        .slice()
        .sort((a, b) => Math.abs(ringSignedArea(b?.[0] || [])) - Math.abs(ringSignedArea(a?.[0] || [])))[0];
      coordinateRings = largestPolygon || [];
    }

    return coordinateRings
      .map((ring) => ring
        .map((coordinate) => {
          const lng = Number(coordinate[0]);
          const lat = Number(coordinate[1]);
          return Number.isFinite(lat) && Number.isFinite(lng) ? L.latLng(lat, lng) : null;
        })
        .filter(Boolean))
      .filter((ring) => ring.length >= 3);
  }

  function getBuildingHeight(properties) {
    const heightKeys = [
      "approx_hei",
      "APPROX_HEI",
      "Approx_Hei",
      "ApproxHei",
      "ApproximateHeight",
      "approximate_height",
      "height",
      "HEIGHT",
      "Height",
      "building_height",
      "BLDG_HEIGHT",
      "elevation"
    ];

    for (const key of heightKeys) {
      const value = parseNumberWithUnits(properties[key]);
      if (Number.isFinite(value) && value > 0) {
        return clamp(value, settings.minHeightMeters || 3, settings.maxHeightMeters || 85);
      }
    }

    const levels = parseNumberWithUnits(properties.levels || properties.Levels || properties.storeys || properties.Storeys || properties.building_levels);
    if (Number.isFinite(levels) && levels > 0) {
      return clamp(levels * 3.1, settings.minHeightMeters || 3, settings.maxHeightMeters || 85);
    }

    return settings.fallbackHouseHeightMeters || settings.defaultBuildingHeightMeters || 7.5;
  }

  function parseNumberWithUnits(value) {
    if (typeof value === "number") return value;
    if (typeof value !== "string") return NaN;
    const match = value.replace(",", ".").match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : NaN;
  }

  function getExtrusionOffset(heightMeters) {
    // The base footprint remains locked to the true GIS geometry. This offset only lifts the roof
    // for a lightweight 2.5D building effect; shadows are still cast from the real footprint.
    if (settings.perspectiveExtrusion !== true) return L.point(0, 0);

    const pixels = clamp(
      heightMeters * (settings.heightPixelScale || 0.32),
      settings.minExtrudePixels || 1,
      settings.maxExtrudePixels || 22
    );

    return L.point(-pixels * 0.42, -pixels * 0.72);
  }

  function getSelectedDate() {
    const value = state.control.datetimeInput?.value || settings.shadowDateTime;
    const parsed = value ? new Date(value) : null;
    if (parsed && !Number.isNaN(parsed.getTime())) return parsed;
    return new Date();
  }

  function getSunPosition(date, latitude, longitude) {
    const radians = Math.PI / 180;
    const dayOfYear = getDayOfYear(date);
    const hour = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
    const gamma = (2 * Math.PI / 365) * (dayOfYear - 1 + (hour - 12) / 24);

    const declination =
      0.006918 -
      0.399912 * Math.cos(gamma) +
      0.070257 * Math.sin(gamma) -
      0.006758 * Math.cos(2 * gamma) +
      0.000907 * Math.sin(2 * gamma) -
      0.002697 * Math.cos(3 * gamma) +
      0.00148 * Math.sin(3 * gamma);

    const equationOfTime = 229.18 * (
      0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma)
    );

    const timezoneOffsetHours = -date.getTimezoneOffset() / 60;
    const trueSolarMinutes = ((hour * 60 + equationOfTime + 4 * longitude - 60 * timezoneOffsetHours) % 1440 + 1440) % 1440;
    const hourAngle = (trueSolarMinutes / 4 - 180) * radians;
    const lat = latitude * radians;

    const cosZenith = clamp(
      Math.sin(lat) * Math.sin(declination) + Math.cos(lat) * Math.cos(declination) * Math.cos(hourAngle),
      -1,
      1
    );
    const zenith = Math.acos(cosZenith);
    const altitude = Math.max(0.05, (Math.PI / 2) - zenith);

    const azimuth = Math.atan2(
      Math.sin(hourAngle),
      Math.cos(hourAngle) * Math.sin(lat) - Math.tan(declination) * Math.cos(lat)
    ) + Math.PI;

    return { altitude, azimuth };
  }

  function getDayOfYear(date) {
    const start = new Date(date.getFullYear(), 0, 0);
    return Math.floor((date - start) / 86400000);
  }

  function limitFeatures(features) {
    const max = settings.maxBuildingFeatures || 240;
    const center = state.map.getCenter();

    return features
      .map((feature) => {
        const featureCenter = getFeatureCenterLatLng(feature);
        const distance = featureCenter ? state.map.distance(center, featureCenter) : Infinity;
        return { feature, distance };
      })
      .filter((entry) => Number.isFinite(entry.distance))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, max)
      .map((entry) => entry.feature);
  }

  function getFeatureCenterLatLng(feature) {
    const rings = getFeatureLatLngRings(feature);
    const ring = rings[0];
    if (!ring?.length) return null;

    const sums = ring.reduce((acc, latLng) => {
      acc.lat += latLng.lat;
      acc.lng += latLng.lng;
      return acc;
    }, { lat: 0, lng: 0 });

    return L.latLng(sums.lat / ring.length, sums.lng / ring.length);
  }

  function makeCacheKey(bounds) {
    const zoom = state.map.getZoom();
    const round = (value) => Number(value).toFixed(4);
    return [zoom, round(bounds.getSouth()), round(bounds.getWest()), round(bounds.getNorth()), round(bounds.getEast())].join(":");
  }

  function storeCacheEntry(key, value) {
    state.cache.set(key, value);

    const maxEntries = settings.cacheEntries || 18;
    while (state.cache.size > maxEntries) {
      const oldestKey = state.cache.keys().next().value;
      state.cache.delete(oldestKey);
    }
  }

  function isQueryTooLarge(bounds) {
    const maxDegrees = settings.maxQueryAreaDegrees || 0.016;
    return Math.abs(bounds.getEast() - bounds.getWest()) > maxDegrees || Math.abs(bounds.getNorth() - bounds.getSouth()) > maxDegrees;
  }

  function inNamedBounds(latLng, namedBounds) {
    if (!latLng || !namedBounds) return false;
    return latLng.lat >= namedBounds.south &&
      latLng.lat <= namedBounds.north &&
      latLng.lng >= namedBounds.west &&
      latLng.lng <= namedBounds.east;
  }

  function setSatelliteBasemap(shouldUseSatelliteBasemap) {
    const tileUrl = settings.satelliteBaseTiles || settings.shadowBaseTiles;
    if (!state.map || !tileUrl) return;

    const baseLayer = getPrimaryTileLayer();
    if (!baseLayer) return;

    const attribution = settings.satelliteBaseAttribution || settings.shadowBaseAttribution;

    if (shouldUseSatelliteBasemap && !state.basemapSwapped) {
      state.originalTileState = {
        layer: baseLayer,
        url: baseLayer._url,
        attribution: baseLayer.options?.attribution || ""
      };

      baseLayer.setUrl(tileUrl, false);
      if (attribution && state.map.attributionControl) {
        state.map.attributionControl.addAttribution(attribution);
      }
      state.basemapSwapped = true;
      document.body.classList.add("flatwise-satellite-basemap-active");
    }

    if (!shouldUseSatelliteBasemap && state.basemapSwapped && state.originalTileState?.layer) {
      state.originalTileState.layer.setUrl(state.originalTileState.url, false);
      if (attribution && state.map.attributionControl) {
        state.map.attributionControl.removeAttribution(attribution);
      }
      state.basemapSwapped = false;
      document.body.classList.remove("flatwise-satellite-basemap-active");
    }
  }

  function getPrimaryTileLayer() {
    let found = null;
    state.map.eachLayer((layer) => {
      if (!found && layer instanceof L.TileLayer && typeof layer.setUrl === "function") {
        found = layer;
      }
    });
    return found;
  }

  function cleanupLegacySunlightUI() {
    const readout = document.getElementById("sunlightReadout");
    if (readout) {
      readout.classList.add("hidden");
      readout.setAttribute("aria-hidden", "true");
    }

    const title = document.getElementById("sunlightTitle");
    if (title) title.textContent = "3D shadow cast";

    const text = document.getElementById("sunlightText");
    if (text) text.textContent = "This readout is hidden. Use the 3D shadow cast control instead.";
  }

  function installRuntimeStyles() {
    if (document.getElementById("flatwise-3d-runtime-style")) return;

    const style = document.createElement("style");
    style.id = "flatwise-3d-runtime-style";
    style.textContent = `
      #sunlightReadout,
      .sunlight-readout,
      .leaflet-sunlight-pane {
        display: none !important;
        opacity: 0 !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }

      .flatwise-3d-shadow-pane,
      .flatwise-3d-wall-pane,
      .flatwise-3d-roof-pane {
        mix-blend-mode: normal;
      }

      .flatwise-unified-shadow-canvas {
        position: absolute;
        pointer-events: none;
        filter: blur(${settings.shadowBlurPixels ?? 0.25}px);
      }

      .flatwise-3d-shadow {
        filter: blur(${settings.shadowBlurPixels ?? 0.25}px);
      }
    `;
    document.head.appendChild(style);
  }

  function updateStatus(message) {
    if (state.control.status) state.control.status.textContent = message;
  }

  function updateSource(message) {
    if (state.control.source) state.control.source.textContent = message;
  }

  function toDateTimeLocalValue(value) {
    if (!value) return "";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return getLocalDateTimeValue(date);
  }

  function getLocalDateTimeValue(date) {
    const pad = (value) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function getDefaultShadowDateTimeValue() {
    const date = new Date();
    // Use noon as the default because it is the clearest first view and avoids odd dawn/dusk
    // shadows that can look broken before the user chooses a specific time.
    date.setHours(12, 0, 0, 0);
    return getLocalDateTimeValue(date);
  }

  function ensureClockwiseScreenPoints(points) {
    return screenSignedArea(points) < 0 ? [...points].reverse() : points;
  }

  function screenSignedArea(points) {
    let area = 0;
    for (let index = 0; index < points.length; index += 1) {
      const current = points[index];
      const next = points[(index + 1) % points.length];
      area += current.x * next.y - next.x * current.y;
    }
    return area / 2;
  }

  function colorToRgba(hexColor, opacity) {
    const hex = String(hexColor || "#111827").replace("#", "").trim();
    const normalised = hex.length === 3
      ? hex.split("").map((char) => char + char).join("")
      : hex.padEnd(6, "0").slice(0, 6);

    const red = Number.parseInt(normalised.slice(0, 2), 16);
    const green = Number.parseInt(normalised.slice(2, 4), 16);
    const blue = Number.parseInt(normalised.slice(4, 6), 16);

    if (![red, green, blue].every(Number.isFinite)) {
      return `rgba(17,24,39,${opacity})`;
    }

    return `rgba(${red},${green},${blue},${opacity})`;
  }

  function cleanClosedRing(ring) {
    if (!Array.isArray(ring)) return [];
    const result = ring.filter((latLng) => Number.isFinite(latLng?.lat) && Number.isFinite(latLng?.lng));
    if (result.length > 1) {
      const first = result[0];
      const last = result[result.length - 1];
      if (Math.abs(first.lat - last.lat) < 1e-12 && Math.abs(first.lng - last.lng) < 1e-12) {
        result.pop();
      }
    }
    return result;
  }

  function closeRing(ring) {
    if (!Array.isArray(ring) || !ring.length) return ring || [];
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (Math.abs(first.lat - last.lat) < 1e-12 && Math.abs(first.lng - last.lng) < 1e-12) return ring;
    return [...ring, first];
  }

  function offsetLatLngByMeters(latLng, bearingRadians, distanceMeters) {
    const earthRadiusMeters = 6378137;
    const angularDistance = distanceMeters / earthRadiusMeters;
    const lat1 = latLng.lat * Math.PI / 180;
    const lng1 = latLng.lng * Math.PI / 180;
    const sinLat1 = Math.sin(lat1);
    const cosLat1 = Math.cos(lat1);
    const sinDistance = Math.sin(angularDistance);
    const cosDistance = Math.cos(angularDistance);

    const lat2 = Math.asin(
      sinLat1 * cosDistance + cosLat1 * sinDistance * Math.cos(bearingRadians)
    );
    const lng2 = lng1 + Math.atan2(
      Math.sin(bearingRadians) * sinDistance * cosLat1,
      cosDistance - sinLat1 * Math.sin(lat2)
    );

    return L.latLng(lat2 * 180 / Math.PI, lng2 * 180 / Math.PI);
  }

  function normaliseRadians(value) {
    const full = Math.PI * 2;
    return ((value % full) + full) % full;
  }

  function metersPerPixelAtLatitude(latitude, zoom) {
    return 156543.03392 * Math.cos(latitude * Math.PI / 180) / Math.pow(2, zoom);
  }

  function ringSignedArea(ring) {
    if (!Array.isArray(ring) || ring.length < 3) return 0;

    let area = 0;
    for (let index = 0; index < ring.length; index += 1) {
      const current = ring[index];
      const next = ring[(index + 1) % ring.length];
      area += (Number(current[0]) || 0) * (Number(next[1]) || 0) - (Number(next[0]) || 0) * (Number(current[1]) || 0);
    }
    return area / 2;
  }

  function pointInRing(point, ring) {
    const x = point[0];
    const y = point[1];
    let inside = false;

    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const xi = ring[i][0];
      const yi = ring[i][1];
      const xj = ring[j][0];
      const yj = ring[j][1];
      const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-12) + xi;
      if (intersects) inside = !inside;
    }

    return inside;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }
})();
