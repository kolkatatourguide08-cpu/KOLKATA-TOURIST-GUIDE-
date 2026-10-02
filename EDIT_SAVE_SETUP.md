# KOLKATA TOURIST GUIDE — Restaurant/Hotel Edit Save

## What changed

The Edit page now has two modes:

1. **Node/Express server mode (persistent)**
   - Edit ID is verified by the server.
   - Edit -> Save sends `PUT /api/admin/entity`.
   - The server writes the updated restaurant/hotel back to the site's JSON data files.
   - The change remains after browser refresh and is available to other users of the same server.
   - A `.bak` backup is created before the data files are replaced.

2. **GitHub Pages/static mode**
   - GitHub Pages cannot write files on the server.
   - Therefore the existing static fallback stores edits in that browser's `localStorage`.
   - This is NOT a shared database.

## For real shared saving

Run the project with Node/Express on a server:

```bash
npm install
npm start
```

Then open the Edit page from that server URL.

If the website itself is hosted on GitHub Pages, the Edit page cannot directly change
the GitHub repository's JSON files. For shared editing from GitHub Pages, deploy the
Node/Express backend separately and connect the frontend to that backend URL.

## Important

Do not put the master Edit ID in client-side JavaScript for production. Set:

```text
KTG_ADMIN_ID=your-secret-master-id
```

in the server environment.


## Important data-flow fix

Restaurant/Place pages now read the latest saved split JSON data through the live server API. The compatibility `/places.json` endpoint is generated from the current split files, so an Edit -> Save (for example Rating 4.6 -> 4.5) is reflected on the public restaurant page after refresh. On GitHub Pages, the static compatibility layer uses browser localStorage because GitHub Pages cannot write repository files from client-side JavaScript.


## Fix for: "cannot pass more than 100 arguments to a function"

The current GitHub Pages bridge already calls `ktg_update_entity` with exactly four
arguments: `p_entity_type`, `p_entity_id`, `p_edit_id`, and `p_data` (JSONB).
If Supabase still reports the 100-argument error, an older overloaded
`ktg_update_entity` function is still present in the database.

Run `SUPABASE-FINAL-SETUP.sql` again from the beginning. The repaired SQL first
drops every existing `public.ktg_update_entity` overload and then recreates the
correct four-argument JSONB function.

Do not add a large list of individual function arguments and do not put a
Supabase secret/service-role key in the website.
