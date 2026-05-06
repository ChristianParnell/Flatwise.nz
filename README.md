# Flatwise NZ — GitHub Pages Prototype

Flatwise is a static, GitHub Pages-ready prototype for a tenant review map. It uses Leaflet with OpenStreetMap tiles, Overpass building-footprint lookup, editable rent benchmark data, sample reviews, and browser-based review storage.

## What's included

- Stable full-width map box using OpenStreetMap + Leaflet
- NZ-bounded map view so the map does not feel endless
- Search demo flats/suburbs, or press Enter to search an address with OpenStreetMap Nominatim
- Building-footprint loading from Overpass when zoomed in
- Hover over a mapped building to highlight its footprint
- Click a building footprint to select it for review
- Details and review panel below the map
- Editable rent benchmark data in `data/rent-data.json`
- Sample reviews in `data/sample-reviews.json`
- New reviews saved in the user's browser using `localStorage`
- Optional Google Street View image support through `js/config.js`

## Hosting on GitHub Pages

1. Create a new GitHub repository.
2. Upload all files from this folder into the repository root.
3. Go to **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select your `main` branch and `/root`.
6. Save.

Your site will publish at your GitHub Pages URL.

## Optional Street View images

The prototype works without a Google key. To enable real street image previews:

1. Create a Google Maps Platform browser key.
2. Restrict the key to your GitHub Pages domain.
3. Restrict the key to the Street View Static API only.
4. Open `js/config.js`.
5. Set:

```js
window.FLATWISE_CONFIG = {
  enableGoogleStreetView: true,
  googleStreetViewApiKey: "YOUR_RESTRICTED_KEY"
};
```

Do not put unrestricted private keys into a public GitHub repository.

## Important prototype note

OpenStreetMap usually provides mapped building footprints, not legal property parcel boundaries. For Flatwise, this means the highlighted shape should be treated as a building-location selection, not an official cadastral/property boundary.

For a real public version, use a backend such as Supabase/Firebase, moderation, report tools, privacy rules, and official MBIE/Tenancy Services market-rent data.
