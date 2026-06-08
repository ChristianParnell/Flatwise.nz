Flatwise.Nz
Some Flats out there are terrible, and when you leave, you wish you could have a voice to tell the next 
tenant, or future flatmates not to live there. Flatwise is the solution to neglected flats that landlords allow 
unknowing tenants to move into. Flatwise is the second opinion to whether you should or not move into 
that flat. 
Reasoning 
Will be hosted as a website, but optionally an app would be better / Realistic.  
I have had the unfortunate luck of signing into a past bad tenancy agreements of some flats that had 
preexisting issues and neglect. The Landlords are always eager to get you on but, I unfortunately 
sometimes can’t see all the hidden cracks within a flat. I hope with enough clients and attention to this 
App / Website, landlords who neglect their property will have to now try much harder to maintain their 
property and ensure their tenants are happy and leave good reviews for future flatmates. And can also be 
reversed to review tenants in the future. 
I know this is like a black mirror episode Idea, but some of those episodes should be real life        
App / Website Functions:  
Rent value 
Is the price fair for the room, location, condition, and included bills? 
Cleanliness 
How clean are the kitchen, bathroom, bedroom, laundry, and shared spaces? 
Warmth & dryness 
Does the flat seem warm, dry, ventilated, and free from mould or damp smells? 
Noise level 
Is it quiet, loud, near traffic, near parties, or badly insulated? 
Safety 
Do the locks, lighting, entrances, street, and general environment feel safe? 
Flatmate vibe 
Do the current flatmates seem respectful, clear, relaxed, and honest? 
Communication 
Were the landlord, property manager, or flatmates clear about rent, bond, bills, rules, and expectations? 
Location 
How good is the access to buses, shops, work, uni, parking, parks, or essentials? 
Pressure level 
Did they pressure you to decide quickly, avoid questions, or make the place seem weirdly urgent? 
Overall liveability 
Would you want to live there for 6–12 months? 
AND RATINGS!       ★ ★ ★ ★ ☆ ☆



### 05-13 — Enlarged map tile loading

Asked to make the loaded map tiles much bigger so the map covers more area and feels less fragmented while moving around.

### 05-13 — Expanded LINZ boundary loading

Asked to improve LINZ parcel and property boundary loading so nearby boundary data appears more reliably while navigating the map.

### 05-13 — Full replacement scripts requested

Asked for full replacement scripts instead of small code snippets so the map, property selection, review system, and boundary features stay consistent.

### 05-13 — Leaflet integrity hash issue reported

Reported that Chrome was blocking Leaflet CSS because the Subresource Integrity hash did not match the downloaded file, causing the map styling to break.

### 05-13 — LINZ property parcel explained

Asked what LINZ property parcels are and how they relate to selecting and highlighting properties on the Flatwise.nz map.

### 05-13 — Property boundary highlighting requested

Asked for property boundary lines to highlight when clicking a property on the map.

### 05-13 — Map focus on selected property requested

Asked for the map to move and focus on the selected property after it is clicked.

### 05-13 — Incomplete tile loading issue raised

Asked for a way to reduce incomplete map tiles and make the map loading feel smoother.


### 05-13 — Map tile loading improved

Adjusted the OpenStreetMap tile settings to reduce blank, stretched, or incomplete map tiles. The map was updated to use more stable tile sizing, better tile buffering, a visible loading state, and retry handling for failed tile requests.

### 05-13 — Downloadable tile update files prepared

Packaged the map tile loading improvements into downloadable replacement files for easier GitHub upload. The main replacement files were `js/app.js` and `js/config.js`.

### 05-20 — LINZ property parcel selection added

Updated the map system so OpenStreetMap works as the base map while official LINZ property parcel boundaries sit above it as an interactive layer. Users can now hover over property parcels, click a parcel, and select the actual land boundary instead of relying only on map pins.

### 05-20 — Selected property boundary highlight improved

Added a stronger selected-property state so the clicked parcel turns red and remains clearly visible. A separate selected boundary layer was added so the selected outline stays on top even after the map moves, zooms, or reloads nearby parcel data.

### 05-20 — Map focus on selected property added

Improved the click behaviour so when a user selects a property parcel, the map automatically moves and zooms to focus on that selected boundary. This makes the site feel more property-focused and helps users understand exactly which parcel they selected.

### 05-20 — Review panel connection preserved

Kept the existing Flatwise review system connected to the selected property. When a parcel is selected, the details panel updates with property information, rent guidance, review data, and the option to save a local browser review.

### 05-20 — Downloadable boundary update files prepared

Packaged the updated LINZ parcel selection and boundary focus work into downloadable replacement files for easier GitHub upload. The main replacement file was `js/app.js`.

### 05-13 — Enlarged map tile loading

Updated the Leaflet tile loading behaviour so the map loads a wider surrounding area while users move around. This helps the map feel smoother, reduces visible tile pop-in, and makes navigation across the Flatwise map feel more stable.

### 05-13 — Leaflet integrity issue identified

Identified that the Leaflet stylesheet was being blocked because the Subresource Integrity hash did not match the downloaded file. Fixing or removing the incorrect integrity value prevents the map interface from breaking when Leaflet styling fails to load.

### 05-13 — Full replacement scripts prepared

Prepared full replacement versions of the key map files instead of small code snippets. This made the update easier to apply and reduced the chance of missing dependencies between the map, LINZ boundaries, tile settings, and review features.

### 05-20 — Property review writing requested

Added the requirement for users to write their own flat reviews after selecting a property. This moved Flatwise closer to its main purpose as a tenant-first review tool, where property selection connects directly to user feedback.

### 05-20 — Property selection highlight improved

Added the requirement that selected properties must be clearly highlighted on the map. This helps users understand exactly which property they are reviewing and makes the LINZ parcel selection feel more precise.

### 05-24 — LINZ property boundary workflow explored

Investigated how existing map data and APIs could be used to click and highlight real property boundaries. This established LINZ parcel data as the main foundation for accurate property selection in Flatwise.

### 05-24 — Street View property preview explored

Explored using Google Street View to show a road-facing image of a selected property. This added a future pathway for users to visually inspect a flat’s exterior alongside map data and reviews.

### 05-24 — Street View setup process documented

Outlined how the Street View API could be connected to the site, including setup, API key use, and restrictions. This helped define how Flatwise could safely add property preview images without exposing unrestricted API access.

### 06-05 — Flatwise repository workflow established

Confirmed the Flatwise.nz GitHub repository as the working foundation for future code changes. Future edits should preserve existing functionality, avoid changing unrequested parts, and provide complete downloadable files for GitHub Desktop upload.

### 06-05 — 3D building source issue reviewed

Reviewed errors related to the 3D building layer failing when the building source did not return usable GeoJSON features. This highlighted the need for safer fallbacks so the map does not fail when external building data is unavailable.

### 06-05 — 3D and shadow UI controls improved

Requested UI changes so 3D and shadow-related controls only appear when the correct mode is selected. This helps reduce clutter and prevents map options from overlapping or confusing users.

### 06-05 — Flatwise.nz repo workflow established

Set up the Flatwise.nz GitHub repository as the working foundation for future changes. The project structure was reviewed so updates could be made without changing unrelated files, with future deliverables prepared as downloadable changed files or full site packages.

### 06-05 — Official LINZ property boundaries added

Updated the map system to use the official LINZ NZ Property Boundaries layer for accurate property polygon selection. This allows users to click real property boundaries on the map instead of relying only on approximate markers or rough demo locations.

### 06-05 — Demo properties locked to real boundaries

Connected the demo flats to actual LINZ property polygons where possible. This makes the demo listings feel more realistic because each selected property can be tied to an official boundary rather than floating near a general map position.

### 06-05 — Street View Static API setup added

Added Google Street View Static API support for selected properties. The site was prepared to use a restricted browser key, allowing property cards to show a static road-facing image when Street View imagery is available.

### 06-05 — Street View metadata-first loading added

Improved the Street View system so it checks Google Street View metadata before requesting an image. This helps avoid unnecessary image requests and allows the site to show a clearer fallback message when no panorama exists nearby.

### 06-05 — Street View loading fix prepared

Fixed the Street View configuration flow so the site can correctly detect when Street View is enabled and when an API key is present. Cache-busting was also added so GitHub Pages is less likely to keep serving older JavaScript or config files.

### 06-05 — LINZ building response error handled

Adjusted the LINZ building data request to avoid the “building response was not GeoJSON” error. This makes the map more stable when loading extra building and boundary data around the selected property.

### 06-05 — Downloadable update packages prepared

Prepared downloadable update packages containing either the full updated site or only the changed files. This makes the workflow easier to use with GitHub Desktop while keeping the project’s existing structure intact.
### 06-06 — Shadow accuracy issue identified

Identified that the 3D shadow casting layer was not aligning correctly with buildings and appeared offset from the actual structures. This showed that the shadow system needed stronger coordinate handling and more accurate building-based projection.

### 06-06 — Satellite view separated from 3D shadow mode

Clarified that the realistic map view should become a separate Satellite View mode, while the 3D/shadow mode should focus on buildings and cast shadows. This keeps the map modes clearer and prevents different visual systems from being mixed together.

### 06-06 — Shadow overlap behaviour defined

Defined that overlapping shadows should not stack into darker areas. This improves readability by keeping shadow opacity consistent, even when multiple building shadows intersect.

### 06-06 — Review panel redesign requested

Requested a more professional and easier-to-read flat rating UI. This included improving the lightboxes, smoothing the layout, and making the review interface feel cleaner and more trustworthy.

### 06-08 — Sunlight heatmap options researched

Explored whether a sunlight heatmap API could be used with the LINZ map. The outcome was that Flatwise should use LINZ for property boundaries and a separate estimated sunlight layer for daylight analysis.

### 06-08 — Estimated sunlight overlay planned

Defined an estimated daylight system that can display sunlight conditions close to a selected property. The system is intended to show useful rental-focused sunlight information without claiming to be a formal engineering-grade solar report.

### 06-08 — Sunlight overlay modes added

Added planned sunlight modes for Off, Sun heatmap, Shadow cast, Winter sunlight, Summer sunlight, and Daily average estimate. These modes give users different ways to understand daylight and shadow conditions around a selected flat.

### 06-08 — Complete sunlight build prepared

Prepared a complete downloadable Flatwise build with the new sunlight overlay system added. The build included the sunlight controls, estimated heatmap rendering, selected-property focus, and mode-based daylight analysis.

### 06-08 — Daylight estimate mockup generated

Generated a visual mockup showing how the daylight estimate should appear on the map. The mockup showed a selected property boundary, a smooth heatmap overlay, sunlight controls, a daylight legend, and a property sunlight score card.

### 06-08 — Sunlight performance issue identified

Identified that the first sunlight version was too heavy for real-time use and could crash or freeze the website. The main issue was that the overlay was sampling too many points and recalculating shadows too often.

### 06-08 — Lightweight sunlight build prepared

Prepared a lighter version of the sunlight system using a lower-resolution canvas, reduced sun samples, fewer building shadows, and less frequent redraws. This was intended to keep the lighting effect while reducing computer load.

### 06-08 — Real-time sunlight build fixed

Prepared a corrected real-time sunlight build after the lightweight version failed to work properly. The fix made the sunlight layer safer, optional, and less likely to break the base map if the overlay fails.

