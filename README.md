# Kolkata Tourist Guide

Starter website based on the requested design and feature flow.

## Current structure
- Home/search page
- Six starter places in `public/data/places.json`
- Location permission after search
- Place details interface
- Name prompt before group chat
- Real-time group chat using Socket.IO
- Live location sharing foundation using Socket.IO
- Dark/light mode
- Share button
- Google Maps button
- Hotel/restaurant image hooks
- Metro booking URL hook

## Run
1. Install Node.js.
2. Open this folder in VS Code.
3. Run:
   `npm install`
4. Run:
   `npm start`
5. Open:
   `http://localhost:3000`

## Important
The six places currently have placeholder detail fields so you can fill in your own data later.

For production live maps, connect `map.html` to a map provider and add latitude/longitude to each place. The current Socket.IO layer is already prepared for group location events.

## GitHub Pages
This package is prepared for a repository project site such as `/KTG/`. The contents of `public/` are moved to the repository root, `.nojekyll` is included, and `/data/places.json` is loaded using project-relative URLs. Admin hotel/restaurant edits are stored in browser localStorage in static mode because GitHub Pages cannot run the Express server or write back to JSON files. For shared server-side persistence, run the existing Node/Express server on a server host.


## Edit/Save persistence
The Edit system writes changes to the JSON place-data files when the Node/Express server is running. GitHub Pages remains static and uses browser-only fallback storage unless a separate backend is configured. See `EDIT_SAVE_SETUP.md`.
