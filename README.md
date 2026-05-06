# Flatwise NZ — GitHub Pages Prototype

Flatwise is a static GitHub Pages-ready website prototype for reviewing rental flats. It includes:

- Leaflet + OpenStreetMap map
- Fixed-size boxed map so the page does not stretch forever
- Hover-to-highlight OpenStreetMap building boundaries
- Click-to-select a mapped building/property outline using the Overpass API
- Demo flat markers around Wellington
- Information/review panel below the map
- Review form using the Flatwise rating categories
- Browser-based localStorage review saving
- Optional Google Street View Static API image support
- Editable rent benchmark JSON file

## How to run locally

Because the site loads JSON files, run it through a local server instead of double-clicking `index.html`.

```bash
python -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

## How to host on GitHub Pages

1. Create a new GitHub repository.
2. Upload all files from this folder.
3. Go to **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Choose your `main` branch and `/root`.
6. Save.
7. Open the GitHub Pages URL once deployment finishes.

## How the map works

The map uses Leaflet and OpenStreetMap tiles. At close zoom levels, the site queries Overpass for visible OSM building footprints and draws them as interactive outlines over the map. Hovering a mapped building highlights its boundary. Clicking that boundary selects the flat/building for review.

If the user clicks an area where there is no loaded building outline, the site falls back to a nearby Overpass building lookup. If none is found, the clicked point is still selectable so the prototype remains usable.

The search box filters demo flats as you type. To search a real NZ address through OpenStreetMap/Nominatim, type the address and press Enter. This is deliberately manual rather than automatic, so the site avoids hammering public OSM services.

This version also includes a boxed fixed-height map, no side panel squeezing the tile grid, repeated `invalidateSize()` calls after layout/scroll changes, and CSS guards so map tiles do not inherit unwanted image sizing. OSM does not provide legal property parcel boundaries everywhere, so the prototype highlights mapped building footprints rather than official cadastral property lines.

## Rent data

The file `data/rent-data.json` contains editable demo rent benchmarks for Wellington suburbs. For a real build, replace this file with official MBIE / Tenancy Services market rent data, or connect a backend/serverless function to the Market Rent API.

## Images

By default, the site shows a polished placeholder image panel. To enable real exterior street images:

1. Create a Google Maps Platform browser API key.
2. Restrict the key to your GitHub Pages domain.
3. Restrict the key to the Street View Static API only.
4. Open `js/config.js`.
5. Set:

```js
window.FLATWISE_CONFIG = {
  enableGoogleStreetView: true,
  googleStreetViewApiKey: "YOUR_RESTRICTED_KEY_HERE"
};
```

Do not put private or unrestricted keys in a public GitHub repository.

## Prototype privacy note

This MVP avoids showing exact addresses by default. Reviews should focus on living conditions, not private individuals. A real public version would need moderation, reporting, image rules, privacy controls, and a proper backend database such as Supabase or Firebase.
