KOLKATA TOURIST GUIDE — SUPABASE LIVE CONNECTION

1. In Supabase SQL Editor, run SUPABASE-FINAL-SETUP.sql once.
2. The website uses only the Supabase Project URL and Publishable key.
3. Do NOT put SUPABASE_SECRET_KEY in any website file.
4. Upload this project to GitHub Pages.
5. Places, Hotels and Restaurants are loaded from Supabase.
6. Verified Edit -> Save writes through the ktg_update_entity RPC.
7. Supabase Realtime refreshes open KTG pages when place/hotel/restaurant data changes.

Important:
- The CSV imports must already exist in public.places, public.hotels, public.restaurants,
  public.place_hotels and public.place_restaurants.
- Tourist Place editing currently accepts the existing KTG-ADMIN-2026 edit ID;
  Hotel/Restaurant editing accepts that admin ID or the record's verification_id.
