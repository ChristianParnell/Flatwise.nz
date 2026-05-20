# Flatwise.nz SRI + Stable Map Fix

This package is a full GitHub Pages-ready replacement build for the Flatwise.nz prototype.

## What changed

1. `index.html` now uses the corrected Leaflet 1.9.4 CSS SRI hash:

   `sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=`

2. Leaflet JavaScript keeps the official 1.9.4 hash:

   `sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=`

3. The map uses whole-number zoom steps. This avoids fractional raster tile scaling that can make streets look split while zooming.

4. Global image styling is prevented from affecting Leaflet tiles. This fixes a common cause of stretched or incomplete map tiles.

5. Tile loading now has retry handling. A small loading badge appears while tiles are being requested.

6. LINZ property parcel boundaries load only when the map is close enough. This keeps the browser fast and avoids massive boundary requests.

7. Hovering a parcel highlights its boundary. Clicking it selects the property, focuses the map, and opens the review panel.

8. Building outlines load at closer zoom levels as a lighter secondary layer.

## How to install

Copy these files and folders into the root of your `Flatwise.nz` repository:

- `index.html`
- `assets/`
- `css/`
- `data/`
- `js/`

Commit and push to GitHub. GitHub Pages should then redeploy the site.

## Important note about data

The rent guide inside `data/rent-data.json` is only demo placeholder data. For a real public version, replace it with official New Zealand rental data.

## Optional Street View images

Open `js/config.js` and change:

```js
streetView: {
  enableGoogleStreetView: true,
  googleStreetViewApiKey: "YOUR_RESTRICTED_KEY"
}
```

Use a restricted browser key only. Restrict it to your GitHub Pages domain and to the Street View Static API.
