(() => {
  "use strict";

  const config = window.FLATWISE_CONFIG || {};
  const settings = {
    ...(config.threeD || {})
  };

  if (!window.L) {
    console.warn("Flatwise 3D mode could not start because Leaflet is not available.");
    return;
  }

  const state = {
    map: null,
    enabled3d: false,
    enabledShadows: false,
    enabledTerrain: Boolean(settings.terrainEnabledDefault),
    refreshTimer: 0,
    buildingAbortController: null,
    terrainAbortController: null,
    cache: new Map(),
    terrainCache: new Map(),
    features: [],
    terrainGrid: null,
    sourceLabel: "Ready",
    layers: {
      walls: null,
      roofs: null,
      shadows: null,
      terrain: null
    },
    control: {
      container: null,
      status: null,
      modeToggle: null,
      shadowToggle: null,
      terrainToggle: null,
      datetimeInput: null,
      source: null
    }
  };

  const NZ_LATITUDE = -41.2865;
  const NZ_LONGITUDE = 174.7762;
  const THREE_D_MODE_VALUE = settings.sunlightModeValue || "threeDShadow";
  const THREE_D_MODE_LABEL = settings.sunlightModeLabel || "3D / shadow";


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
      if (map || checks > 80) {
        window.clearInterval(timer);
        if (map) initialise(map);
      }
      checks += 1;
    }, 125);
  }

  function initialise(map) {
    if (state.map) return;
    state.map = map;

    createPanes();
    createLayers();
    installStyles();
    createControl();
    bindMapEvents();

    updateStatus("3D mode is ready. Turn it on when zoomed into a city block.");
  }

  function createPanes() {
    const panes = state.map.getPanes();

    if (!panes.flatwiseTerrainPane) state.map.createPane("flatwiseTerrainPane");
    if (!panes.flatwiseShadowPane) state.map.createPane("flatwiseShadowPane");
    if (!panes.flatwiseWallPane) state.map.createPane("flatwiseWallPane");
    if (!panes.flatwiseRoofPane) state.map.createPane("flatwiseRoofPane");

    state.map.getPane("flatwiseTerrainPane").style.zIndex = 365;
    state.map.getPane("flatwiseShadowPane").style.zIndex = 372;
    state.map.getPane("flatwiseWallPane").style.zIndex = 385;
    state.map.getPane("flatwiseRoofPane").style.zIndex = 386;

    state.map.getPane("flatwiseTerrainPane").classList.add("flatwise-3d-terrain-pane");
    state.map.getPane("flatwiseShadowPane").classList.add("flatwise-3d-shadow-pane");
    state.map.getPane("flatwiseWallPane").classList.add("flatwise-3d-wall-pane");
    state.map.getPane("flatwiseRoofPane").classList.add("flatwise-3d-roof-pane");
  }

  function createLayers() {
    state.layers.terrain = new TerrainCanvasLayer({ pane: "flatwiseTerrainPane" });
    state.layers.shadows = L.layerGroup([], { pane: "flatwiseShadowPane" });
    state.layers.walls = L.layerGroup([], { pane: "flatwiseWallPane" });
    state.layers.roofs = L.layerGroup([], { pane: "flatwiseRoofPane" });
  }

  function bindMapEvents() {
    state.map.on("moveend zoomend", scheduleRefresh);
    state.map.on("zoomstart movestart", () => {
      if (state.enabled3d || state.enabledShadows || state.enabledTerrain) updateStatus("Updating the 3D view…");
    });
  }

  function createControl() {
    const control = L.control({ position: "topright" });

    control.onAdd = () => {
      const container = L.DomUtil.create("div", "flatwise-3d-control");
      container.innerHTML = `
        <div class="flatwise-3d-control__title">3D / shadows</div>
        <div class="flatwise-3d-control__note">Extra controls appear only while the Sunlight overlay is set to 3D / shadow.</div>
        <label class="flatwise-3d-control__row">
          <input type="checkbox" data-flatwise-3d-toggle>
          <span>3D buildings</span>
        </label>
        <label class="flatwise-3d-control__row">
          <input type="checkbox" data-flatwise-shadow-toggle>
          <span>Cast shadows</span>
        </label>
        <label class="flatwise-3d-control__row">
          <input type="checkbox" data-flatwise-terrain-toggle>
          <span>Terrain shade</span>
        </label>
        <input class="flatwise-3d-control__datetime" type="datetime-local" data-flatwise-shadow-time aria-label="Shadow date and time">
        <div class="flatwise-3d-control__buttons">
          <button type="button" data-flatwise-winter>Winter noon</button>
          <button type="button" data-flatwise-summer>Summer sun</button>
        </div>
        <div class="flatwise-3d-control__source" data-flatwise-source>Source: ready</div>
        <div class="flatwise-3d-control__status" data-flatwise-status>Turn on a mode.</div>
      `;

      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.disableScrollPropagation(container);

      state.control.container = container;
      state.control.status = container.querySelector("[data-flatwise-status]");
      state.control.source = container.querySelector("[data-flatwise-source]");
      state.control.modeToggle = container.querySelector("[data-flatwise-3d-toggle]");
      state.control.shadowToggle = container.querySelector("[data-flatwise-shadow-toggle]");
      state.control.terrainToggle = container.querySelector("[data-flatwise-terrain-toggle]");
      state.control.datetimeInput = container.querySelector("[data-flatwise-shadow-time]");

      const initialDate = settings.shadowDateTime || getLocalDateTimeValue(new Date());
      state.control.datetimeInput.value = toDateTimeLocalValue(initialDate) || getLocalDateTimeValue(new Date());
      state.control.terrainToggle.checked = state.enabledTerrain;

      state.control.modeToggle.addEventListener("change", () => {
        state.enabled3d = state.control.modeToggle.checked;
        toggleLayer(state.layers.walls, state.enabled3d);
        toggleLayer(state.layers.roofs, state.enabled3d);
        scheduleRefresh(true);
      });

      state.control.shadowToggle.addEventListener("change", () => {
        state.enabledShadows = state.control.shadowToggle.checked;
        toggleLayer(state.layers.shadows, state.enabledShadows);
        scheduleRefresh(true);
      });

      state.control.terrainToggle.addEventListener("change", () => {
        state.enabledTerrain = state.control.terrainToggle.checked;
        toggleLayer(state.layers.terrain, state.enabledTerrain);
        scheduleRefresh(true);
      });

      state.control.datetimeInput.addEventListener("change", () => {
        scheduleRefresh(true);
      });

      container.querySelector("[data-flatwise-winter]").addEventListener("click", () => {
        state.control.datetimeInput.value = settings.winterPresetDateTime || "2026-06-21T12:00";
        if (!state.enabledShadows) {
          state.enabledShadows = true;
          state.control.shadowToggle.checked = true;
          toggleLayer(state.layers.shadows, true);
        }
        scheduleRefresh(true);
      });

      container.querySelector("[data-flatwise-summer]").addEventListener("click", () => {
        state.control.datetimeInput.value = settings.summerPresetDateTime || "2026-12-21T13:00";
        if (!state.enabledShadows) {
          state.enabledShadows = true;
          state.control.shadowToggle.checked = true;
          toggleLayer(state.layers.shadows, true);
        }
        scheduleRefresh(true);
      });

      installSunlightModeIntegration();

      return container;
    };

    control.addTo(state.map);
  }

  function installSunlightModeIntegration() {
    const select = document.getElementById(settings.sunlightModeSelectId || "sunlightMode");

    if (!select) {
      // Fallback for future layouts: keep the tool usable if the sunlight selector is renamed.
      state.control.container?.classList.add("is-visible");
      return;
    }

    ensure3DShadowOption(select);
    syncFromSunlightModeSelect();

    select.addEventListener("change", () => {
      window.setTimeout(syncFromSunlightModeSelect, 0);
    });
  }

  function ensure3DShadowOption(select) {
    const existingOption = Array.from(select.options || []).find((option) => option.value === THREE_D_MODE_VALUE);
    if (existingOption) {
      existingOption.textContent = THREE_D_MODE_LABEL;
      return;
    }

    const option = document.createElement("option");
    option.value = THREE_D_MODE_VALUE;
    option.textContent = THREE_D_MODE_LABEL;
    select.appendChild(option);
  }

  function syncFromSunlightModeSelect() {
    const select = document.getElementById(settings.sunlightModeSelectId || "sunlightMode");
    const shouldShow3DPanel = !select || select.value === THREE_D_MODE_VALUE;

    state.control.container?.classList.toggle("is-visible", shouldShow3DPanel);

    if (shouldShow3DPanel) {
      activate3DShadowModeFromSelect();
      update3DShadowReadout();
    } else {
      deactivate3DShadowModeFromSelect();
    }
  }

  function activate3DShadowModeFromSelect() {
    if (!state.enabled3d && !state.enabledShadows) {
      state.enabled3d = true;
      state.enabledShadows = true;
      state.enabledTerrain = false;
    }

    if (state.control.modeToggle) state.control.modeToggle.checked = state.enabled3d;
    if (state.control.shadowToggle) state.control.shadowToggle.checked = state.enabledShadows;
    if (state.control.terrainToggle) state.control.terrainToggle.checked = state.enabledTerrain;

    toggleLayer(state.layers.walls, state.enabled3d);
    toggleLayer(state.layers.roofs, state.enabled3d);
    toggleLayer(state.layers.shadows, state.enabledShadows);
    toggleLayer(state.layers.terrain, state.enabledTerrain);

    scheduleRefresh(true);
  }

  function deactivate3DShadowModeFromSelect() {
    state.enabled3d = false;
    state.enabledShadows = false;
    state.enabledTerrain = false;

    if (state.control.modeToggle) state.control.modeToggle.checked = false;
    if (state.control.shadowToggle) state.control.shadowToggle.checked = false;
    if (state.control.terrainToggle) state.control.terrainToggle.checked = false;

    toggleLayer(state.layers.walls, false);
    toggleLayer(state.layers.roofs, false);
    toggleLayer(state.layers.shadows, false);
    toggleLayer(state.layers.terrain, false);
    clearVisualLayers();
    updateStatus("3D/shadow mode is off.");
  }

  function update3DShadowReadout() {
    const title = document.getElementById("sunlightTitle");
    const text = document.getElementById("sunlightText");

    if (title) title.textContent = "3D / shadow mode";
    if (text) {
      text.textContent = "Buildings are drawn as a lightweight 2.5D layer. Shadows use the selected date/time and approximate building heights for a rental-focused sunlight check.";
    }
  }

  function scheduleRefresh(force = false) {
    if (!state.map) return;

    window.clearTimeout(state.refreshTimer);
    state.refreshTimer = window.setTimeout(() => {
      refresh(force).catch((error) => {
        if (error?.name === "AbortError") return;
        console.warn("Flatwise 3D refresh failed:", error);
        state.features = [];
        clearBuildingLayers();
        updateStatus("3D layer could not refresh from the council/LINZ source. Zoom closer or pan slightly.");
      });
    }, force ? 40 : (settings.refreshDebounceMs || 340));
  }

  async function refresh(force = false) {
    if (!state.enabled3d && !state.enabledShadows && !state.enabledTerrain) {
      clearVisualLayers();
      updateStatus("3D/shadow mode is off.");
      return;
    }

    const minZoom = settings.minZoom || 17;
    if (state.map.getZoom() < minZoom) {
      clearVisualLayers();
      updateStatus(`Zoom to level ${minZoom} or closer to load 3D buildings.`);
      return;
    }

    const bounds = state.map.getBounds().pad(0.08);
    if (isQueryTooLarge(bounds)) {
      clearVisualLayers();
      updateStatus("3D view is too wide. Zoom closer so Flatwise only loads nearby buildings.");
      return;
    }

    if (state.enabled3d || state.enabledShadows) {
      const geoJson = await loadBuildingsForView(bounds, force);
      state.features = limitFeatures(geoJson?.features || []);
      renderBuildings();
    }

    if (state.enabledTerrain) {
      await loadTerrainForView(bounds, force);
      renderTerrain();
    }

    const count = state.features.length;
    const activeParts = [];
    if (state.enabled3d) activeParts.push("3D buildings");
    if (state.enabledShadows) activeParts.push("shadow cast");
    if (state.enabledTerrain) activeParts.push("terrain shade");
    updateStatus(`${activeParts.join(" + ")} active. ${count} building${count === 1 ? "" : "s"} drawn.`);
  }

  async function loadBuildingsForView(bounds, force = false) {
    const sources = chooseBuildingSources(state.map.getCenter()).filter((source) => source?.url);
    if (!sources.length) {
      return emptyFeatureCollection();
    }

    const boundsKey = roundedBounds(bounds, 4);
    const cached = !force ? getFirstCachedSource(sources, boundsKey) : null;
    if (cached) return cached;

    if (state.buildingAbortController) state.buildingAbortController.abort();
    state.buildingAbortController = new AbortController();

    const errors = [];

    for (const source of sources) {
      const cacheKey = `${source.key}:${state.map.getZoom()}:${boundsKey}`;
      state.sourceLabel = source.label;
      updateSourceLabel(source.label);

      try {
        const geoJson = await fetchArcGisAsGeoJson(source, bounds, state.buildingAbortController.signal);
        const features = Array.isArray(geoJson.features) ? geoJson.features : [];

        if (!features.length) {
          errors.push(`${source.label} returned no features`);
          continue;
        }

        state.cache.set(cacheKey, geoJson);
        trimCache(state.cache, settings.cacheEntries || 16);
        return geoJson;
      } catch (error) {
        if (error?.name === "AbortError") throw error;
        errors.push(`${source.label}: ${error.message || error}`);
        console.warn(`Flatwise 3D building source failed (${source.label}):`, error);
      }
    }

    updateSourceLabel("No building source available for this view");
    updateStatus(errors.length ? `No 3D buildings loaded. ${errors[0]}.` : "No 3D buildings loaded for this view.");
    return emptyFeatureCollection();
  }

  function getFirstCachedSource(sources, boundsKey) {
    for (const source of sources) {
      const cacheKey = `${source.key}:${state.map.getZoom()}:${boundsKey}`;
      if (state.cache.has(cacheKey)) {
        state.sourceLabel = source.label;
        updateSourceLabel(source.label);
        return state.cache.get(cacheKey);
      }
    }

    return null;
  }

  async function fetchArcGisAsGeoJson(source, bounds, signal) {
    const formats = source.preferJson ? ["json", "geojson"] : ["geojson", "json"];
    let lastError = null;

    for (const format of formats) {
      try {
        const requestUrl = buildArcGisEnvelopeQueryUrl(source.url, bounds, source.outFields || "*", source.key, format);
        const response = await fetch(requestUrl, { signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        const geoJson = normaliseArcGisPayloadToGeoJson(data);
        return geoJson;
      } catch (error) {
        if (error?.name === "AbortError") throw error;
        lastError = error;
      }
    }

    throw lastError || new Error("Building source did not return usable features.");
  }

  function chooseBuildingSources(center) {
    const sources = [];

    if (isInsideCityBounds(center, "wellington") && config.urls?.wccBuildingFootprints) {
      sources.push({
        key: "wcc-heights",
        label: "WCC building heights",
        url: config.urls.wccBuildingFootprints,
        outFields: "*"
      });

      if (config.urls?.wccBuildingFootprintsOutline) {
        sources.push({
          key: "wcc-outline-heights",
          label: "WCC building outline heights",
          url: config.urls.wccBuildingFootprintsOutline,
          outFields: "*"
        });
      }
    }

    sources.push({
      key: "linz-footprints",
      label: "LINZ footprints + estimated height",
      url: config.urls?.buildingOutlines,
      outFields: config.linz?.buildingOutFields || "*"
    });

    return sources;
  }

  function isInsideCityBounds(latlng, key) {
    const bounds = settings.cityBounds?.[key];
    if (!bounds || !latlng) return false;
    return latlng.lat >= bounds.south && latlng.lat <= bounds.north && latlng.lng >= bounds.west && latlng.lng <= bounds.east;
  }

  function buildArcGisEnvelopeQueryUrl(baseUrl, bounds, outFields, sourceKey, format = "geojson") {
    const geometry = {
      xmin: bounds.getWest(),
      ymin: bounds.getSouth(),
      xmax: bounds.getEast(),
      ymax: bounds.getNorth(),
      spatialReference: { wkid: 4326 }
    };

    const url = new URL(baseUrl);
    url.searchParams.set("f", format);
    url.searchParams.set("where", "1=1");
    url.searchParams.set("outFields", outFields || "*");
    url.searchParams.set("returnGeometry", "true");
    url.searchParams.set("spatialRel", "esriSpatialRelIntersects");
    url.searchParams.set("geometryType", "esriGeometryEnvelope");
    url.searchParams.set("inSR", "4326");
    url.searchParams.set("outSR", "4326");
    url.searchParams.set("geometry", JSON.stringify(geometry));
    url.searchParams.set("resultRecordCount", String(settings.resultRecordCount || 500));
    url.searchParams.set("geometryPrecision", String(settings.geometryPrecision || 6));

    if (sourceKey === "linz-footprints") {
      url.searchParams.set("orderByFields", "OBJECTID");
    }

    return url.toString();
  }

  function normaliseArcGisPayloadToGeoJson(data) {
    if (data?.error) {
      throw new Error(data.error.message || "ArcGIS service returned an error.");
    }

    if (data?.type === "FeatureCollection" && Array.isArray(data.features)) {
      return { ...data, features: data.features.filter((feature) => feature?.geometry) };
    }

    if (Array.isArray(data?.features)) {
      const spatialReference = data.spatialReference || data.geometryProperties?.shapeAreaFieldName || null;
      const features = data.features
        .map((feature) => esriFeatureToGeoJsonFeature(feature, spatialReference))
        .filter((feature) => feature?.geometry);

      return {
        type: "FeatureCollection",
        features
      };
    }

    return emptyFeatureCollection();
  }

  function esriFeatureToGeoJsonFeature(feature) {
    const geometry = esriGeometryToGeoJson(feature?.geometry);
    if (!geometry) return null;

    return {
      type: "Feature",
      geometry,
      properties: feature.attributes || feature.properties || {}
    };
  }

  function esriGeometryToGeoJson(geometry) {
    if (!geometry) return null;

    if (Array.isArray(geometry.rings)) {
      return {
        type: "Polygon",
        coordinates: geometry.rings.map((ring) => ring.map((point) => [Number(point[0]), Number(point[1])]))
      };
    }

    if (Array.isArray(geometry.paths)) {
      return {
        type: "MultiLineString",
        coordinates: geometry.paths.map((path) => path.map((point) => [Number(point[0]), Number(point[1])]))
      };
    }

    if (Number.isFinite(Number(geometry.x)) && Number.isFinite(Number(geometry.y))) {
      return {
        type: "Point",
        coordinates: [Number(geometry.x), Number(geometry.y)]
      };
    }

    return null;
  }

  function emptyFeatureCollection() {
    return {
      type: "FeatureCollection",
      features: []
    };
  }

  function limitFeatures(features) {
    const max = settings.maxBuildingFeatures || 260;
    return features
      .filter((feature) => feature?.geometry)
      .map((feature) => ({
        feature,
        height: getBuildingHeightMeters(feature),
        areaScore: getFeatureScreenAreaScore(feature)
      }))
      .sort((a, b) => b.areaScore - a.areaScore)
      .slice(0, max)
      .map((item) => item.feature);
  }

  function getFeatureScreenAreaScore(feature) {
    const rings = getFeatureRings(feature);
    let score = 0;
    for (const ring of rings) {
      score += Math.max(0, ring.length - 2);
    }
    return score;
  }

  function renderBuildings() {
    state.layers.walls.clearLayers();
    state.layers.roofs.clearLayers();
    state.layers.shadows.clearLayers();

    const sun = getSunForCurrentControl();
    const center = state.map.getCenter();
    const metersPerPixel = getMetersPerPixel(center.lat, state.map.getZoom());

    for (const feature of state.features) {
      const height = getBuildingHeightMeters(feature);
      const rings = getFeatureRings(feature);
      const heightOffset = getExtrudeOffsetPixels(height);

      for (const ring of rings) {
        const projected = ring.map((latlng) => state.map.latLngToLayerPoint(latlng));
        if (projected.length < 3) continue;

        const shifted = projected.map((point) => L.point(point.x - heightOffset.x, point.y - heightOffset.y));
        const roofLatLngs = shifted.map((point) => state.map.layerPointToLatLng(point));

        if (state.enabled3d) {
          drawWallPolygons(projected, shifted, height);
          L.polygon(roofLatLngs, {
            pane: "flatwiseRoofPane",
            interactive: false,
            className: "flatwise-3d-roof",
            stroke: true,
            color: "#53606b",
            weight: 0.75,
            opacity: 0.62,
            fill: true,
            fillColor: roofColourForHeight(height),
            fillOpacity: 0.64
          }).addTo(state.layers.roofs);
        }

        if (state.enabledShadows) {
          drawShadowPolygon(projected, height, sun, metersPerPixel);
        }
      }
    }
  }

  function drawWallPolygons(basePoints, roofPoints, height) {
    const fillOpacity = clamp(0.26 + height / 180, 0.28, 0.48);

    for (let i = 0; i < basePoints.length; i += 1) {
      const next = (i + 1) % basePoints.length;
      const quad = [
        basePoints[i],
        basePoints[next],
        roofPoints[next],
        roofPoints[i]
      ].map((point) => state.map.layerPointToLatLng(point));

      L.polygon(quad, {
        pane: "flatwiseWallPane",
        interactive: false,
        className: "flatwise-3d-wall",
        stroke: true,
        color: "#40505a",
        weight: 0.55,
        opacity: 0.28,
        fill: true,
        fillColor: "#6d7a84",
        fillOpacity
      }).addTo(state.layers.walls);
    }
  }

  function drawShadowPolygon(basePoints, height, sun, metersPerPixel) {
    if (!sun || sun.altitude <= 0.035) return;

    const rawShadowMeters = height / Math.tan(sun.altitude);
    const shadowMeters = clamp(rawShadowMeters, 2, settings.maxShadowLengthMeters || 180);
    const shadowPixels = clamp(shadowMeters / Math.max(metersPerPixel, 0.05), 3, settings.maxShadowPixels || 240);

    const shadowBearing = sun.azimuth + Math.PI;
    const offset = L.point(
      Math.sin(shadowBearing) * shadowPixels,
      -Math.cos(shadowBearing) * shadowPixels
    );

    const shifted = basePoints.map((point) => L.point(point.x + offset.x, point.y + offset.y));
    const shadowPoints = [
      ...basePoints,
      ...shifted.slice().reverse()
    ].map((point) => state.map.layerPointToLatLng(point));

    L.polygon(shadowPoints, {
      pane: "flatwiseShadowPane",
      interactive: false,
      className: "flatwise-3d-shadow",
      stroke: false,
      fill: true,
      fillColor: "#1a2027",
      fillOpacity: settings.shadowOpacity || 0.28
    }).addTo(state.layers.shadows);
  }

  function getFeatureRings(feature) {
    const geometry = feature?.geometry;
    if (!geometry) return [];

    if (geometry.type === "Polygon") {
      return (geometry.coordinates || [])
        .slice(0, 1)
        .map(coordinatesToLatLngRing)
        .filter((ring) => ring.length >= 3);
    }

    if (geometry.type === "MultiPolygon") {
      return (geometry.coordinates || [])
        .map((polygon) => polygon?.[0])
        .filter(Boolean)
        .map(coordinatesToLatLngRing)
        .filter((ring) => ring.length >= 3);
    }

    return [];
  }

  function coordinatesToLatLngRing(coordinates) {
    const points = coordinates
      .map((coord) => Array.isArray(coord) && coord.length >= 2 ? L.latLng(Number(coord[1]), Number(coord[0])) : null)
      .filter((latlng) => latlng && Number.isFinite(latlng.lat) && Number.isFinite(latlng.lng));

    if (points.length > 1) {
      const first = points[0];
      const last = points[points.length - 1];
      if (Math.abs(first.lat - last.lat) < 0.0000001 && Math.abs(first.lng - last.lng) < 0.0000001) {
        points.pop();
      }
    }

    return points;
  }

  function getBuildingHeightMeters(feature) {
    const props = feature?.properties || {};
    const raw = firstFiniteNumber([
      props.approx_hei,
      props.Approx_Hei,
      props.ApproximateHeight,
      props.approx_height,
      props.height,
      props.Height,
      props.building_height,
      props.BUILDING_H,
      parseHeightString(props["height:roof"]),
      parseLevels(props["building:levels"])
    ]);

    const fallback = state.sourceLabel === "WCC building heights"
      ? settings.defaultBuildingHeightMeters
      : settings.fallbackHouseHeightMeters;

    return clamp(
      Number.isFinite(raw) && raw > 0 ? raw : (fallback || settings.defaultBuildingHeightMeters || 7.5),
      settings.minHeightMeters || 3,
      settings.maxHeightMeters || 85
    );
  }

  function parseHeightString(value) {
    if (value === null || value === undefined) return NaN;
    const match = String(value).match(/[\d.]+/);
    return match ? Number(match[0]) : NaN;
  }

  function parseLevels(value) {
    const levels = Number(value);
    if (!Number.isFinite(levels) || levels <= 0) return NaN;
    return levels * 3.1;
  }

  function firstFiniteNumber(values) {
    for (const value of values) {
      const number = Number(value);
      if (Number.isFinite(number)) return number;
    }
    return NaN;
  }

  function getExtrudeOffsetPixels(height) {
    const scale = settings.heightPixelScale || 0.42;
    const zoomFactor = Math.max(0.55, (state.map.getZoom() - 15) / 4);
    const magnitude = clamp(
      height * scale * zoomFactor,
      settings.minExtrudePixels || 2,
      settings.maxExtrudePixels || 34
    );

    return L.point(magnitude * 0.55, magnitude);
  }

  function roofColourForHeight(height) {
    if (height >= 35) return "#70818d";
    if (height >= 18) return "#7f909a";
    return "#8f9da5";
  }

  async function loadTerrainForView(bounds, force = false) {
    const terrainUrl = config.urls?.terrainElevation;
    if (!terrainUrl) {
      updateStatus("Terrain source is not configured.");
      return;
    }

    const minZoom = settings.terrainMinZoom || 16;
    if (state.map.getZoom() < minZoom) {
      state.terrainGrid = null;
      updateStatus(`Zoom to level ${minZoom} or closer for terrain shade.`);
      return;
    }

    const gridSize = Math.max(3, Math.min(8, Number(settings.terrainGridSize || 5)));
    const cacheKey = `terrain:${gridSize}:${roundedBounds(bounds, 3)}`;
    if (!force && state.terrainCache.has(cacheKey)) {
      state.terrainGrid = state.terrainCache.get(cacheKey);
      return;
    }

    const points = createTerrainSamplePoints(bounds, gridSize);
    if (!points.length) return;

    if (state.terrainAbortController) state.terrainAbortController.abort();
    state.terrainAbortController = new AbortController();

    const url = new URL(terrainUrl);
    url.searchParams.set("locations", points.map((point) => `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`).join("|"));

    const response = await fetch(url.toString(), { signal: state.terrainAbortController.signal });
    if (!response.ok) throw new Error(`Terrain source failed with HTTP ${response.status}`);

    const data = await response.json();
    const results = Array.isArray(data?.results) ? data.results : [];
    const samples = results.map((result, index) => ({
      lat: points[index]?.lat,
      lng: points[index]?.lng,
      elevation: Number(result?.elevation)
    })).filter((sample) => Number.isFinite(sample.lat) && Number.isFinite(sample.lng) && Number.isFinite(sample.elevation));

    state.terrainGrid = { gridSize, samples, bounds };
    state.terrainCache.set(cacheKey, state.terrainGrid);
    trimCache(state.terrainCache, 8);
  }

  function createTerrainSamplePoints(bounds, gridSize) {
    const maxPoints = settings.terrainMaxPoints || 36;
    const size = Math.min(gridSize, Math.floor(Math.sqrt(maxPoints)) || gridSize);
    const points = [];

    for (let y = 0; y < size; y += 1) {
      const lat = lerp(bounds.getSouth(), bounds.getNorth(), size === 1 ? 0.5 : y / (size - 1));
      for (let x = 0; x < size; x += 1) {
        const lng = lerp(bounds.getWest(), bounds.getEast(), size === 1 ? 0.5 : x / (size - 1));
        points.push({ lat, lng, x, y });
      }
    }

    return points;
  }

  function renderTerrain() {
    if (!state.layers.terrain) return;
    state.layers.terrain.setTerrainGrid(state.enabledTerrain ? state.terrainGrid : null);
  }

  function clearVisualLayers() {
    clearBuildingLayers();
    state.layers.terrain?.setTerrainGrid(null);
  }

  function clearBuildingLayers() {
    state.layers.walls?.clearLayers();
    state.layers.roofs?.clearLayers();
    state.layers.shadows?.clearLayers();
  }

  function toggleLayer(layer, shouldShow) {
    if (!state.map || !layer) return;
    if (shouldShow) {
      if (!state.map.hasLayer(layer)) layer.addTo(state.map);
    } else if (state.map.hasLayer(layer)) {
      state.map.removeLayer(layer);
    }
  }

  function isQueryTooLarge(bounds) {
    const max = settings.maxQueryAreaDegrees || 0.018;
    const width = Math.abs(bounds.getEast() - bounds.getWest());
    const height = Math.abs(bounds.getNorth() - bounds.getSouth());
    return width * height > max;
  }

  function roundedBounds(bounds, precision) {
    return [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()]
      .map((value) => Number(value).toFixed(precision))
      .join(":");
  }

  function trimCache(cache, maxEntries) {
    while (cache.size > maxEntries) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
  }

  function updateStatus(message) {
    if (state.control.status) state.control.status.textContent = message;
  }

  function updateSourceLabel(label) {
    if (state.control.source) state.control.source.textContent = `Source: ${label}`;
  }

  function getSunForCurrentControl() {
    const value = state.control.datetimeInput?.value;
    const date = value ? new Date(value) : new Date();
    const center = state.map?.getCenter?.() || L.latLng(NZ_LATITUDE, NZ_LONGITUDE);
    return getSunPosition(date, center.lat, center.lng);
  }

  // Compact solar-position approximation based on standard astronomical equations.
  // Good enough for a visual shadow prototype; not intended for legal or engineering work.
  function getSunPosition(date, latitude, longitude) {
    const rad = Math.PI / 180;
    const dayMs = 1000 * 60 * 60 * 24;
    const j2000 = Date.UTC(2000, 0, 1, 12);
    const days = (date.valueOf() - j2000) / dayMs;

    const meanAnomaly = rad * (357.5291 + 0.98560028 * days);
    const equationOfCenter = rad * (
      1.9148 * Math.sin(meanAnomaly) +
      0.0200 * Math.sin(2 * meanAnomaly) +
      0.0003 * Math.sin(3 * meanAnomaly)
    );
    const perihelion = rad * 102.9372;
    const eclipticLongitude = meanAnomaly + equationOfCenter + perihelion + Math.PI;
    const obliquity = rad * 23.4397;

    const declination = Math.asin(Math.sin(eclipticLongitude) * Math.sin(obliquity));
    const rightAscension = Math.atan2(
      Math.sin(eclipticLongitude) * Math.cos(obliquity),
      Math.cos(eclipticLongitude)
    );

    const siderealTime = rad * (280.16 + 360.9856235 * days) - rad * longitude;
    const hourAngle = siderealTime - rightAscension;
    const phi = rad * latitude;

    const altitude = Math.asin(
      Math.sin(phi) * Math.sin(declination) +
      Math.cos(phi) * Math.cos(declination) * Math.cos(hourAngle)
    );

    const azimuth = normaliseRadians(Math.atan2(
      Math.sin(hourAngle),
      Math.cos(hourAngle) * Math.sin(phi) - Math.tan(declination) * Math.cos(phi)
    ) + Math.PI);

    return { altitude, azimuth };
  }

  function normaliseRadians(value) {
    const full = Math.PI * 2;
    return ((value % full) + full) % full;
  }

  function getMetersPerPixel(latitude, zoom) {
    return 40075016.686 * Math.cos(latitude * Math.PI / 180) / (256 * Math.pow(2, zoom));
  }

  function toDateTimeLocalValue(value) {
    if (!value) return "";
    if (typeof value === "string") {
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return value.slice(0, 16);
      const parsed = new Date(value);
      return Number.isNaN(parsed.valueOf()) ? "" : getLocalDateTimeValue(parsed);
    }
    if (value instanceof Date && !Number.isNaN(value.valueOf())) return getLocalDateTimeValue(value);
    return "";
  }

  function getLocalDateTimeValue(date) {
    const local = new Date(date.valueOf() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  const TerrainCanvasLayer = L.Layer.extend({
    initialize(options = {}) {
      L.setOptions(this, options);
      this._grid = null;
      this._canvas = null;
      this._frame = 0;
    },

    onAdd(map) {
      this._map = map;
      this._canvas = L.DomUtil.create("canvas", "flatwise-3d-terrain-canvas");
      this._canvas.style.opacity = String(settings.terrainOpacity || 0.26);
      const pane = map.getPane(this.options.pane) || map.getPanes().overlayPane;
      pane.appendChild(this._canvas);

      map.on("moveend zoomend resize", this._reset, this);
      this._reset();
    },

    onRemove(map) {
      map.off("moveend zoomend resize", this._reset, this);
      if (this._canvas?.parentNode) this._canvas.parentNode.removeChild(this._canvas);
      this._canvas = null;
      this._map = null;
    },

    setTerrainGrid(grid) {
      this._grid = grid;
      this._reset();
    },

    _reset() {
      if (!this._map || !this._canvas) return;
      L.Util.cancelAnimFrame(this._frame);
      this._frame = L.Util.requestAnimFrame(this._draw, this);
    },

    _draw() {
      if (!this._map || !this._canvas) return;

      const size = this._map.getSize();
      const topLeft = this._map.containerPointToLayerPoint([0, 0]);
      L.DomUtil.setPosition(this._canvas, topLeft);
      this._canvas.width = Math.max(1, size.x);
      this._canvas.height = Math.max(1, size.y);

      const context = this._canvas.getContext("2d");
      context.clearRect(0, 0, size.x, size.y);

      if (!this._grid?.samples?.length) return;

      const samples = this._grid.samples;
      const elevations = samples.map((sample) => sample.elevation);
      const minElevation = Math.min(...elevations);
      const maxElevation = Math.max(...elevations);
      const spread = Math.max(1, maxElevation - minElevation);

      for (const sample of samples) {
        const point = this._map.latLngToContainerPoint([sample.lat, sample.lng]);
        const shade = (sample.elevation - minElevation) / spread;
        const radius = Math.max(size.x, size.y) / Math.max(3, this._grid.gridSize || 5) * 0.68;

        const gradient = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius);
        gradient.addColorStop(0, `rgba(255,255,255,${0.18 + shade * 0.18})`);
        gradient.addColorStop(0.48, `rgba(63,83,91,${0.05 + (1 - shade) * 0.13})`);
        gradient.addColorStop(1, "rgba(63,83,91,0)");

        context.fillStyle = gradient;
        context.beginPath();
        context.arc(point.x, point.y, radius, 0, Math.PI * 2);
        context.fill();
      }
    }
  });

  function installStyles() {
    if (document.getElementById("flatwise-3d-plugin-styles")) return;

    const style = document.createElement("style");
    style.id = "flatwise-3d-plugin-styles";
    style.textContent = `
      .flatwise-3d-control {
        display: none;
        width: min(270px, calc(100vw - 34px));
        box-sizing: border-box;
        margin-top: 10px;
        padding: 14px;
        border: 1px solid rgba(20, 26, 31, 0.16);
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.96);
        box-shadow: 0 18px 44px rgba(15, 23, 42, 0.16);
        color: #17212b;
        font: 600 13px/1.38 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        backdrop-filter: blur(18px);
        overflow: hidden;
      }

      .flatwise-3d-control.is-visible {
        display: block;
      }

      .flatwise-3d-control__title {
        margin-bottom: 5px;
        font-size: 14px;
        font-weight: 800;
        letter-spacing: -0.02em;
      }

      .flatwise-3d-control__note {
        margin-bottom: 10px;
        color: #64727d;
        font-size: 11px;
        font-weight: 650;
        line-height: 1.35;
      }

      .flatwise-3d-control__row {
        display: flex;
        align-items: center;
        gap: 9px;
        min-height: 26px;
        margin: 6px 0;
        cursor: pointer;
        white-space: nowrap;
      }

      .flatwise-3d-control__row input {
        accent-color: #17212b;
      }

      .flatwise-3d-control__datetime {
        display: block;
        width: 100%;
        min-width: 0;
        box-sizing: border-box;
        margin-top: 10px;
        padding: 8px 9px;
        border: 1px solid rgba(20, 26, 31, 0.14);
        border-radius: 10px;
        background: rgba(248, 250, 252, 0.92);
        color: #17212b;
        font: inherit;
        font-size: 12px;
      }

      .flatwise-3d-control__buttons {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin-top: 10px;
      }

      .flatwise-3d-control__buttons button {
        min-height: 32px;
        padding: 7px 8px;
        border: 0;
        border-radius: 999px;
        background: #17212b;
        color: #fff;
        font: inherit;
        font-size: 11px;
        line-height: 1.1;
        white-space: nowrap;
        cursor: pointer;
      }

      .flatwise-3d-control__source,
      .flatwise-3d-control__status {
        margin-top: 9px;
        color: #52606b;
        font-size: 11px;
        font-weight: 650;
        line-height: 1.35;
        white-space: normal;
        overflow-wrap: anywhere;
      }

      .flatwise-3d-wall,
      .flatwise-3d-roof,
      .flatwise-3d-shadow {
        pointer-events: none;
      }

      .flatwise-3d-terrain-canvas {
        position: absolute;
        pointer-events: none;
        mix-blend-mode: multiply;
      }

      @media (max-width: 720px) {
        .flatwise-3d-control {
          width: min(238px, calc(100vw - 28px));
          padding: 12px;
          font-size: 12px;
        }

        .flatwise-3d-control__buttons {
          grid-template-columns: 1fr;
        }
      }
    `;

    document.head.appendChild(style);
  }

  waitForFlatwiseMap();
})();
