# KTG GitHub Pages Upload

Upload the **contents of this folder** to the root of the `KTG` repository (where `index.html` is visible), not the folder itself.

The important files are:
- `index.html`
- `data/places.json`
- `hotel.html`, `restaurant.html`, `place.html`, `booking.html`, `map.html`, `chat.html`, `edit.html`
- `js/github-pages.js`
- `css/`

GitHub Pages is static, so Express/Socket.IO server APIs cannot persist shared JSON changes. In static mode, hotel/restaurant edit changes are stored in the current browser's localStorage. The original Node/Express project remains available in the source ZIP for server hosting.
