### Flatwise.Nz
Some Flats out there are terrible, and when you leave, you wish you could have a voice to tell the next 
tenant, or future flatmates not to live there. Flatwise is the solution to neglected flats that landlords allow 
unknowing tenants to move into. Flatwise is the second opinion to whether you should or not move into 
that flat. 

### Reasoning 
Will be hosted as a website, but optionally an app would be better / Realistic.  
I have had the unfortunate luck of signing into a past bad tenancy agreements of some flats that had 
preexisting issues and neglect. The Landlords are always eager to get you on but, I unfortunately 
sometimes can’t see all the hidden cracks within a flat. I hope with enough clients and attention to this 
App / Website, landlords who neglect their property will have to now try much harder to maintain their 
property and ensure their tenants are happy and leave good reviews for future flatmates. And can also be 
reversed to review tenants in the future. 
I know this is like a black mirror episode Idea, but some of those episodes should be real life        

### App / Website Functions:  
### Rent value 
Is the price fair for the room, location, condition, and included bills? 
### Cleanliness 
How clean are the kitchen, bathroom, bedroom, laundry, and shared spaces? 
### Warmth & dryness 
Does the flat seem warm, dry, ventilated, and free from mould or damp smells? 
### Noise level 
Is it quiet, loud, near traffic, near parties, or badly insulated? 
### Safety 
Do the locks, lighting, entrances, street, and general environment feel safe? 
### Flatmate vibe 
Do the current flatmates seem respectful, clear, relaxed, and honest? 
### Communication 
Were the landlord, property manager, or flatmates clear about rent, bond, bills, rules, and expectations? 
### Location 
How good is the access to buses, shops, work, uni, parking, parks, or essentials? 
### Pressure level 
Did they pressure you to decide quickly, avoid questions, or make the place seem weirdly urgent? 
### Overall liveability 
Would you want to live there for 6–12 months? 
### AND RATINGS!       ★ ★ ★ ★ ☆ ☆



## Development Progress

### 05-12 — Map tile loading improved

Updated the Leaflet tile loading behaviour so the map loads a wider surrounding area while users move around. This reduced visible tile pop-in, helped prevent blank or incomplete tile sections, and made navigation across the Flatwise map feel smoother and more stable.

<img width="1146" height="814" alt="iii" src="https://github.com/user-attachments/assets/7178a2c7-aeaf-47ac-8d2b-55c0984fffa8" />


### 05-13 — LINZ boundary loading expanded

Improved the loading range for LINZ parcel and property boundary data so nearby boundaries appear more reliably while navigating. This made the map feel more continuous and helped support accurate property selection beyond only the immediately visible screen area.
Identified that Chrome was blocking the Leaflet stylesheet because the Subresource Integrity hash did not match the downloaded file. Resolving this issue was important because the blocked stylesheet caused the map layout and interface styling to break.

### 05-15 — LINZ property parcel workflow defined

Clarified how LINZ property parcels can be used as real land-boundary data for Flatwise.nz. This established official property boundaries as the correct foundation for selecting, highlighting, and reviewing flats more accurately than relying only on map pins.
Added the requirement for selected properties to highlight using their actual boundary lines. This strengthened the map interaction by making it clear which exact parcel a user had selected before reading or writing a review.

### 05-16 — Map focus on selected property added

Improved property selection behaviour so the map can move and focus on a selected property after it is clicked. This made the experience feel more intentional and helped users understand the relationship between the property boundary, the review panel, and the map location.

Prepared replacement project files for the tile loading improvements so the changes could be applied more easily through GitHub. The update focused mainly on the map configuration and application logic files while preserving the existing project structure.

### 05-20 — Tenant review writing added

Added the core requirement for users to write their own flat reviews after selecting a property. This moved Flatwise closer to its main purpose as a tenant-first review tool, where real property selection connects directly to lived rental feedback.
Updated the map system so OpenStreetMap works as the base map while official LINZ property parcel boundaries sit above it as an interactive layer. Users can now hover over property parcels, click a parcel, and select the actual land boundary instead of relying only on approximate demo pins.

### 05-20 — Selected property boundary highlight improved

Improved the selected-property state so the clicked parcel turns red and remains clearly visible. A separate selected boundary layer was added so the chosen outline stays on top even after the map moves, zooms, or reloads nearby parcel data.

### 05-20 — Review panel connection preserved

Kept the Flatwise review system connected to the selected property. When a parcel is selected, the details panel updates with property information, rent guidance, review data, and the option to save a local browser review.

### 05-20 — Downloadable boundary update files prepared

Packaged the updated LINZ parcel selection, boundary highlight, and property focus work into downloadable replacement files. This made the changes easier to upload into the GitHub repository without manually rebuilding the file structure.

### 05-24 — LINZ property boundary workflow explored

Investigated how existing map data and public APIs could support clicking and highlighting real property boundaries. This helped confirm LINZ parcel data as the strongest foundation for accurate property selection in Flatwise.

<img width="1044" height="718" alt="Screenshot 2026-05-24 225709" src="https://github.com/user-attachments/assets/f848c1c5-9a9d-45fa-9a13-1f5115b1f140" />

### 06-02 — Flatwise repository workflow established

Confirmed the Flatwise.nz GitHub repository as the working foundation for future development. The workflow was set up so future updates preserve existing functionality, avoid changing unrelated files, and provide complete downloadable files or ZIP packages for GitHub Desktop upload.

### 06-05 — Official LINZ property boundaries added

Updated the map system to use the official LINZ NZ Property Boundaries layer for accurate property polygon selection. This allowed users to click real property boundaries on the map instead of relying only on approximate markers or rough demo locations.

Connected demo flat listings to real LINZ property polygons where possible. This made the prototype feel more realistic because selected demo flats could now relate to official land parcels rather than floating loosely near general map positions.

<img width="1000" height="820" alt="Screenshot 2026-06-05 210636" src="https://github.com/user-attachments/assets/67a88a1c-aec7-4a8f-82ca-f8a2448514ef" />


### 06-05 — Street View Static API support added

Prepared the site to use the Google Street View Static API for selected properties. The system was designed to use a restricted browser key so property cards could show a static road-facing image when Street View imagery is available. Explored using Google Street View to show a road-facing preview image of a selected property. This added a future pathway for users to visually inspect a flat’s exterior alongside map data, parcel boundaries, and tenant reviews. Outlined how the Google Street View Static API could be connected to Flatwise, including API key setup, browser restrictions, and fallback behaviour. This helped define a safer setup process so property preview images could be added without exposing unrestricted API access.

<img width="1100" height="875" alt="Screenshot 2026-05-25 000142" src="https://github.com/user-attachments/assets/ed5643df-f9aa-4428-afe6-104f27c03483" />

### 06-05 — Street View metadata-first loading added

Improved the Street View workflow so the site checks metadata before requesting an image. This helps avoid unnecessary image requests and allows the interface to show a clearer fallback message when no panorama exists nearby.

### 06-05 — Street View configuration flow fixed

Fixed the Street View configuration flow so the site can correctly detect when Street View is enabled and when an API key is present. Cache-busting was also added to reduce the chance of GitHub Pages serving outdated JavaScript or configuration files.

### 06-05 — LINZ building response handling improved

Adjusted the LINZ building data request to avoid failures when the response is empty, unexpected, or not valid GeoJSON. This made the map more stable when loading extra building and boundary data around selected properties.

### 06-05 — Public building data sources investigated

Researched free council and public data sources that could support 3D-style buildings and shadow casting across major New Zealand cities. Wellington City Council building height data was identified as a strong immediate source, with LINZ building outlines suggested as a broader national fallback.

### 06-05 — 3D building and shadow mode added

Prepared a lightweight 3D/shadow mode for the Flatwise map. The implementation added fake 2.5D building extrusion, building shadow projection based on sun direction, date and time controls, and optional terrain-style shading while keeping the existing Leaflet map and review system intact.

<img width="678" height="603" alt="Screenshot 2026-06-06 142355" src="https://github.com/user-attachments/assets/4580951c-d948-43f1-afc2-ae6bdb61822f" />
<img width="703" height="637" alt="Screenshot 2026-06-06 142326" src="https://github.com/user-attachments/assets/7e5f14a3-69d9-4f4c-86e9-f080afdad367" />


### 06-05 — Property selection marker cleaned up

Removed the extra temporary square or centre marker that appeared after selecting a property. The selected parcel now relies on the actual property boundary highlight, making the interaction cleaner and less visually distracting.

### 06-05 — Replacement file naming clarified

Confirmed that future downloadable fixes should keep the same filenames and folder paths as the live GitHub repository. This made updates easier to copy into GitHub Desktop without needing to rename files or restructure the project manually.

### 06-05 — 3D building source fallback improved

Improved the 3D building loader so it no longer fails when a council or LINZ building service returns an empty, unexpected, or non-GeoJSON response. The layer now handles service issues more safely and falls back where possible instead of breaking the 3D mode.

### 06-05 — 3D control panel behaviour improved

Updated the 3D/shadow interface so its controls only appear when the 3D/shadow mode is selected. This reduced interface clutter, prevented controls from clipping into other map options, and made the standard map view cleaner.
<img width="232" height="214" alt="Screenshot 2026-06-05 214911" src="https://github.com/user-attachments/assets/b1607743-1907-498b-98ea-db805ac0f3bc" />



### 06-05 — Downloadable update packages prepared

Prepared downloadable update packages containing either the full updated site or only the changed files. This made the workflow easier to use with GitHub Desktop while keeping the project’s existing structure intact.

### 06-06 — Shadow accuracy issue identified

Identified that the 3D shadow casting layer was not aligning correctly with buildings and appeared offset from the actual structures. This showed that the shadow system needed stronger coordinate handling and more accurate building-based projection.

<img width="1110" height="586" alt="Screenshot 2026-06-06 135755" src="https://github.com/user-attachments/assets/2f36af9a-168f-4d72-818e-992a8bf402e4" />

### 06-06 — Satellite view separated from 3D shadow mode

Separated realistic satellite imagery into its own map mode instead of forcing it inside the 3D/shadow system. This made the map modes clearer by keeping satellite viewing useful as a separate feature while allowing 3D shadow mode to focus on buildings, parcels, and shadow casting.

### 06-06 — Shadow overlap behaviour improved

Updated the shadow rendering behaviour so overlapping building shadows do not stack into darker patches. Intersecting shadows now behave as one unified tint layer, making the shadow cast cleaner, easier to read, and more realistic.

### 06-06 — Review form UI redesigned

Improved the “write your own review” panel so it looked more professional and easier to use. The rating sliders were reorganised into cleaner rows, score labels were made easier to read, and the form styling was adjusted to feel more polished and trustworthy.

### 06-06 — 3D shadow controls simplified

Cleaned up the map mode controls so the 3D shadow system is easier to understand and no longer overlaps with unrelated sunlight tools. Inactive sunlight modes were removed from this view so the interface could focus on the working 3D shadow cast feature.

### 06-06 — Sunlight estimate panel removed from 3D mode

Removed the beige sunlight estimate panel when 3D shadow cast mode is active. This kept the right-side interface cleaner, prevented panel overlap, and made the 3D shadow controls feel more intentional instead of cluttered.

### 06-06 — 3D shadow map presentation improved

Updated the 3D shadow mode so buildings and shadows display more clearly on the map. The work focused on making the building layer easier to read and reducing visual confusion caused by previous map styling and overlapping interface elements.

### 06-06 — Shadow alignment issues addressed

Adjusted the 3D shadow casting logic after shadows appeared offset from their source buildings. The update focused on keeping shadows tied more closely to the actual building footprints so they no longer appeared to come from unrelated houses or stretch incorrectly across roads.

### 06-06 — Full replacement files prepared

Prepared complete downloadable replacement files using the same filenames as the existing project files. This made the updates easier to apply through GitHub Desktop while preserving the project structure and avoiding unnecessary file renaming.

### 06-08 — Sunlight heatmap options researched

Explored whether a sunlight heatmap API could be used alongside the LINZ map. The outcome was that Flatwise should use LINZ for property boundaries while using a separate estimated sunlight layer for daylight and shadow analysis.

### 06-08 — Estimated sunlight overlay planned

Defined an estimated daylight system that can display sunlight conditions close to a selected property. The system was planned as rental-focused guidance rather than a formal engineering-grade solar report, keeping the feature useful while avoiding overclaiming accuracy.

### 06-08 — Sunlight overlay modes added

Added planned sunlight modes including Off, Sun heatmap, Shadow cast, Winter sunlight, Summer sunlight, and Daily average estimate. These modes gave users different ways to understand daylight and shadow conditions around a selected flat.

### 06-08 — Complete sunlight build prepared

Prepared a complete downloadable Flatwise build with the new sunlight overlay system added. The build included sunlight controls, estimated heatmap rendering, selected-property focus, and mode-based daylight analysis.

### 06-08 — Daylight estimate mockup generated

Generated a visual mockup showing how the daylight estimate could appear on the map. The mockup included a selected property boundary, a smooth heatmap overlay, sunlight controls, a daylight legend, and a property sunlight score card.

### 06-08 — Sunlight performance issue identified

Identified that the first sunlight version was too heavy for real-time use and could crash or freeze the website. The main issue was that the overlay sampled too many points and recalculated shadows too often.

### 06-08 — Lightweight sunlight build prepared

Prepared a lighter version of the sunlight system using a lower-resolution canvas, reduced sun samples, fewer building shadows, and less frequent redraws. This was intended to keep the lighting effect while reducing computer load.

### 06-08 — Real-time sunlight build fixed

Prepared a corrected real-time sunlight build after the lightweight version failed to work properly. The fix made the sunlight layer safer, optional, and less likely to break the base map if the overlay fails.



