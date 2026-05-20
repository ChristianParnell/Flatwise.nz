# Flatwise.nz — Review System Upgrade

This package is a full GitHub Pages-ready version of Flatwise with the SRI fix, stable Leaflet setup, demo flat review flow, and optional property-line highlighting.

## What changed

1. The Leaflet CSS Subresource Integrity hash has been corrected in `index.html`.

2. Demo flat markers are now selectable. Click a marker and the details panel opens with seeded demo reviews.

3. The review form now uses a professional 1–10 rental rating system. Reviews are saved locally in the browser through `localStorage`, so the prototype works without accounts or a backend.

4. Reviews include optional context fields. A tester can add a nickname, tenancy period, weekly rent paid, recommendation, and tenant note.

5. Property-line highlighting is optional. The map includes toggles for showing LINZ property lines and highlighting the selected outline.

6. Clicking a demo flat tries to load the nearest LINZ parcel outline and highlight it when the boundary service returns a match.

7. The map cursor has been forced back to a normal arrow instead of the grab or hand cursor.

## Install

Copy all files from this folder into the root of your `Flatwise.nz` GitHub repository.

Replace the existing files when asked:

- `index.html`
- `css/style.css`
- `js/app.js`
- `js/config.js`
- `data/rent-data.json`
- `assets/logo.svg`

Commit and push to GitHub Pages.

## Test checklist

Open the live site and check these flows:

1. The map loads without the Chrome SRI error.
2. The map displays with Leaflet styles applied correctly.
3. The cursor over the map stays as a normal arrow.
4. Clicking a demo flat marker opens the details panel.
5. Clicking “Review selected” opens the 1–10 review form.
6. Saving a review updates the score and adds the note locally.
7. Turning property lines off clears the LINZ overlays while the demo reviews still work.
8. Turning property lines back on loads parcel lines again when zoomed in.

## Notes

The current review system is a prototype. For a real public version, you would want user accounts, moderation, privacy rules, abuse reporting, and a database instead of localStorage.

The rent data and review data in `data/rent-data.json` are demo placeholders. Replace them with an official or properly licensed data source before treating the information as real.
