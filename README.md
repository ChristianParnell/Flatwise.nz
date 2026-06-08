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

### 05-27 — Flatwise repository workflow established

Confirmed Flatwise.nz GitHub repo as the working base for future development. The workflow was designed to ensure future updates will preserve existing functionality, not alter unrelated files, and deliver complete downloadable files or ZIP packages suitable for upload to GitHub Desktop. Updated map system to use official LINZ NZ Property Boundaries layer to select property polygons correctly. This allowed users to click on actual property boundaries on the map instead of using approximate markers or rough demo locations. Where possible, linked demo flat listings to actual LINZ property polygons. This made the prototype feel more real as the selected demo flats could now be tied to official land parcels rather than floating loosely around general map positions.

<img width="1000" height="820" alt="Screenshot 2026-06-05 210636" src="https://github.com/user-attachments/assets/67a88a1c-aec7-4a8f-82ca-f8a2448514ef" />

Site preparation for using the Google Street View Static API for some selected properties. Built the system with a limited browser key so that property cards can display a static, street-facing image where Street View imagery is available. Looked at using Google Street View to show a preview image of a selected property facing onto the road. This provided users with another future avenue to visually review an exterior of a flat, along with map data, parcel boundaries and tenant reviews. Explained how the integration of the Google Street View Static API with Flatwise could be done, including API key configuration, browser restrictions and fallback behaviour. That helped to define a safer process for setting up property preview images without exposing unrestricted API access.

<img width="1100" height="875" alt="Screenshot 2026-05-25 000142" src="https://github.com/user-attachments/assets/ed5643df-f9aa-4428-afe6-104f27c03483" />

Improved the Street View workflow so the site checks metadata before requesting an image. This helps avoid unnecessary image requests and allows the interface to show a clearer fallback message when no panorama exists nearby. Fixed the Street View configuration flow so the site can correctly detect when Street View is enabled and when an API key is present. Cache-busting was also added to reduce the chance of GitHub Pages serving outdated JavaScript or configuration files. Adjusted the LINZ building data request to avoid failures when the response is empty, unexpected, or not valid GeoJSON. This made the map more stable when loading extra building and boundary data around selected properties.

### 05-29 — Public building data sources investigated

Researched free council and public data sources that could support 3D-style buildings and shadow casting across major New Zealand cities. Wellington City Council building height data was identified as a strong immediate source, with LINZ building outlines suggested as a broader national fallback.
Prepared a lightweight 3D/shadow mode for the Flatwise map. The implementation added fake 2.5D building extrusion, building shadow projection based on sun direction, date and time controls, and optional terrain-style shading while keeping the existing Leaflet map and review system intact.

<img width="678" height="603" alt="Screenshot 2026-06-06 142355" src="https://github.com/user-attachments/assets/4580951c-d948-43f1-afc2-ae6bdb61822f" />
<img width="703" height="637" alt="Screenshot 2026-06-06 142326" src="https://github.com/user-attachments/assets/7e5f14a3-69d9-4f4c-86e9-f080afdad367" />


### 06-01 — Property selection marker cleaned up

Removed the extra temporary square or centre marker that appeared after selecting a property. The selected parcel now relies on the actual property boundary highlight, making the interaction cleaner and less visually distracting.
Confirmed that future downloadable fixes should keep the same filenames and folder paths as the live GitHub repository. This made updates easier to copy into GitHub Desktop without needing to rename files or restructure the project manually.
Improved the 3D building loader so it no longer fails when a council or LINZ building service returns an empty, unexpected, or non-GeoJSON response. The layer now handles service issues more safely and falls back where possible instead of breaking the 3D mode.
Updated the 3D/shadow interface so its controls only appear when the 3D/shadow mode is selected. This reduced interface clutter, prevented controls from clipping into other map options, and made the standard map view cleaner.


### 06-03 — Downloadable update packages prepared

Prepared downloadable update packages containing either the full updated site or only the changed files. This made the workflow easier to use with GitHub Desktop while keeping the project’s existing structure intact.

Identified that the 3D shadow casting layer was not aligning correctly with buildings and appeared offset from the actual structures. This showed that the shadow system needed stronger coordinate handling and more accurate building-based projection.

<img width="574" height="526" alt="Screenshot 2026-06-06 135755" src="https://github.com/user-attachments/assets/f86aa418-bef4-4fad-a211-f1de0197ed11" />

Separated realistic satellite imagery into its own map mode instead of forcing it inside the 3D/shadow system. This made the map modes clearer by keeping satellite viewing useful as a separate feature while allowing 3D shadow mode to focus on buildings, parcels, and shadow casting.

### 06-04 — Shadow overlap behaviour improved

Updated the shadow rendering behaviour so overlapping building shadows do not stack into darker patches. Intersecting shadows now behave as one unified tint layer, making the shadow cast cleaner, easier to read, and more realistic.
Adjusted the 3D shadow casting logic after shadows appeared offset from their source buildings. The update focused on keeping shadows tied more closely to the actual building footprints so they no longer appeared to come from unrelated houses or stretch incorrectly across roads.

<img width="761" height="489" alt="Screenshot 2026-06-08 201609" src="https://github.com/user-attachments/assets/7741cf40-e187-4a16-a624-de01fd036e59" />


Improved the “write your own review” panel so it looked more professional and easier to use. The rating sliders were reorganised into cleaner rows, score labels were made easier to read, and the form styling was adjusted to feel more polished and trustworthy.

<img width="1100" height="739" alt="Screenshot 2026-06-08 201848" src="https://github.com/user-attachments/assets/054906ab-7892-470d-935d-fcf5e1dc2690" />

Cleaned up the map mode controls so the 3D shadow system is easier to understand and no longer overlaps with unrelated sunlight tools. Inactive sunlight modes were removed from this view so the interface could focus on the working 3D shadow cast feature.

<img width="265" height="316" alt="Screenshot 2026-06-08 201959" src="https://github.com/user-attachments/assets/60d80dd4-4323-4bec-85ff-5699453708e6" />


### 06-06 — Sunlight estimate panel removed from 3D mode

- Removed beige sunlight estimate panel when 3D shadow cast mode is activated. This made the right-side interface cleaner, avoided panel overlap, and made the 3D shadow controls feel more intentional instead of cluttered. Improved 3D shadow mode for better building and shadow viewing on the map. The work was focused on improving the readability of the building layer and reducing visual clutter due to the previous map styling and overlapping UI elements.
Investigation with the LINZ map and a sunlight heatmap API. The conclusion was that Flatwise needs to use LINZ for property boundaries but should use a separate estimated sunlight layer for daylight and shadow analysis.
Developed an estimated daylight system to display sunlight conditions near a selected property. The system was built as rental guidance rather than a formal engineering grade solar report, to keep the feature useful without overclaiming accuracy.
Added planned sunlight modes Off Sun heatmap Shadow cast Winter sunlight Summer sunlight Daily average estimate The modes provided users with different ways of understanding the daylight and shadow conditions around a selected flat.
Download the full Flatwise build now including the new sunlight overlay system. The build included sunlight controls, estimated heatmap rendering, selected-property focus and daylight analysis by mode.
Generated a visual mockup showing how the daylight estimate could appear on the map. The mockup included a selected property boundary, a smooth heatmap overlay, sunlight controls, a daylight legend, and a property sunlight score card.

### 06-07 — Sunlight performance issue identified

Identified that the first sunlight version was too heavy for real-time use and could crash or freeze the website. The main issue was that the overlay sampled too many points and recalculated shadows too often.
Prepared a lighter version of the sunlight system using a lower-resolution canvas, reduced sun samples, fewer building shadows, and less frequent redraws. This was intended to keep the lighting effect while reducing computer load.

### 06-08 — Real-time sunlight build fixed

Prepared a corrected real-time sunlight build after the lightweight version failed to work properly. The fix made the sunlight layer safer, optional, and less likely to break the base map if the overlay fails.

<img width="1139" height="867" alt="Screenshot 2026-06-08 203630" src="https://github.com/user-attachments/assets/15bd5b78-e7f8-473a-bcc3-a8f5b9438188" />


