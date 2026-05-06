// Flatwise configuration
// GitHub Pages note: do not put private secrets here.
// If you use Google Street View, create a browser key restricted to your GitHub Pages domain
// and restrict it to the Street View Static API only.
window.FLATWISE_CONFIG = {
  appName: "Flatwise NZ",
  defaultMapCenter: [-41.29484, 174.77885],
  defaultZoom: 17,
  overpassEndpoint: "https://overpass-api.de/api/interpreter",
  overpassSearchRadiusMeters: 28,
  minimumBuildingZoom: 16,

  // Optional. Leave blank and the site will show a polished built-in placeholder instead.
  googleStreetViewApiKey: "",
  enableGoogleStreetView: false,

  // For privacy, the UI avoids showing exact addresses by default.
  showExactAddress: false
};
