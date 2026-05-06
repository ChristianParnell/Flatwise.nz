# Flatwise — GitHub Pages Prototype

Flatwise is a tenant-first property review prototype. It is designed to run as a static website on GitHub Pages.

## What this version includes

- Stable OpenStreetMap / Leaflet map viewport
- Whole-number zoom steps to prevent raster tile splitting/stutter
- Official LINZ NZ Primary Parcel boundaries loaded from ArcGIS REST
- LINZ NZ Building Outlines shown as a secondary footprint layer
- Hover a property parcel to highlight its boundary
- Click a property parcel to select it and focus the map on that property
- Info and review panel below the map
- Demo local rent guidance from `data/rent-data.json`
- Local review saving with browser `localStorage`
- Optional Google Street View image support in `js/config.js`

## How to host on GitHub Pages

1. Create a GitHub repository.
2. Upload everything inside this folder to the repository root.
3. Go to **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Choose your `main` branch and `/root`.
6. Save and wait for the GitHub Pages link.

## Data sources used by the prototype

The base map uses OpenStreetMap raster tiles through Leaflet. The parcel and building boundaries are loaded directly in the browser from public LINZ ArcGIS REST services:

- LINZ NZ Primary Parcels
- LINZ NZ Building Outlines

The rent file is currently demo data. For a real build, replace `data/rent-data.json` with MBIE / Tenancy Services market-rent data.

## Important prototype notes

This is not a full public review platform yet. A real version would need:

- database storage such as Supabase or Firebase
- user accounts or review verification
- moderation tools
- abuse reporting
- privacy rules around exact locations and uploaded images
- legal review around public property/tenant comments

## Optional Street View images

Open `js/config.js` and change:

```js
 enableGoogleStreetView: true,
 googleStreetViewApiKey: "YOUR_RESTRICTED_KEY"
```

Use a restricted browser key only. Restrict it to your GitHub Pages domain and only the Street View Static API.
