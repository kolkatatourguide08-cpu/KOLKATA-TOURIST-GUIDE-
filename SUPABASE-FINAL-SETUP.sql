
-- KOLKATA TOURIST GUIDE — Supabase final setup
-- Run this ONCE in Supabase SQL Editor after importing the CSV files.
-- Uses the Publishable/anon key in the website.
-- Never put SUPABASE_SECRET_KEY in the website.

create extension if not exists pgcrypto;

-- Keep public visitors read-only.
alter table public.places enable row level security;
alter table public.hotels enable row level security;
alter table public.restaurants enable row level security;
alter table public.place_hotels enable row level security;
alter table public.place_restaurants enable row level security;

drop policy if exists "Public can view places" on public.places;
create policy "Public can view places" on public.places
for select to anon, authenticated using (true);

drop policy if exists "Public can view hotels" on public.hotels;
create policy "Public can view hotels" on public.hotels
for select to anon, authenticated using (true);

drop policy if exists "Public can view restaurants" on public.restaurants;
create policy "Public can view restaurants" on public.restaurants
for select to anon, authenticated using (true);

drop policy if exists "Public can view place hotels" on public.place_hotels;
create policy "Public can view place hotels" on public.place_hotels
for select to anon, authenticated using (true);

drop policy if exists "Public can view place restaurants" on public.place_restaurants;
create policy "Public can view place restaurants" on public.place_restaurants
for select to anon, authenticated using (true);

-- Remove direct public writes. The verified RPC below is the writer.
drop policy if exists "Public can update places" on public.places;
drop policy if exists "Public can update hotels" on public.hotels;
drop policy if exists "Public can update restaurants" on public.restaurants;

-- Realtime: database changes can make open KTG pages refresh automatically.
do $$
begin
  alter publication supabase_realtime add table public.places;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.hotels;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.restaurants;
exception when duplicate_object then null;
end $$;

-- IMPORTANT REPAIR:
-- Remove any older/overloaded ktg_update_entity functions before creating
-- the correct 4-argument JSONB RPC. This prevents the PostgreSQL
-- "cannot pass more than 100 arguments to a function" error.
do $$
declare
  r record;
begin
  for r in
    select n.nspname as schema_name,
           p.proname as function_name,
           pg_get_function_identity_arguments(p.oid) as identity_args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'ktg_update_entity'
  loop
    execute format(
      'drop function if exists %I.%I(%s)',
      r.schema_name,
      r.function_name,
      r.identity_args
    );
  end loop;
end $$;

-- Verification RPC.
create or replace function public.ktg_verify_entity(
  p_entity_type text,
  p_entity_id text default '',
  p_entity_name text default '',
  p_edit_id text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t text := lower(trim(coalesce(p_entity_type,'')));
  rid text;
  hid text;
  pid text;
  nm text;
  ok boolean := false;
begin
  if t = 'restaurant' then
    select r.restaurant_id, r.place_id, r.name,
           (trim(p_edit_id) = 'KTG-ADMIN-2026' or trim(p_edit_id) = coalesce(r.verification_id,''))
      into rid, pid, nm, ok
    from public.restaurants r
    where (trim(p_entity_id) <> '' and r.restaurant_id = trim(p_entity_id))
       or (trim(p_entity_id) = '' and lower(r.name) = lower(trim(p_entity_name)))
    limit 1;
  elsif t = 'hotel' then
    select h.hotel_id, h.place_id, h.name,
           (trim(p_edit_id) = 'KTG-ADMIN-2026' or trim(p_edit_id) = coalesce(h.verification_id,''))
      into hid, pid, nm, ok
    from public.hotels h
    where (trim(p_entity_id) <> '' and h.hotel_id = trim(p_entity_id))
       or (trim(p_entity_id) = '' and lower(h.name) = lower(trim(p_entity_name)))
    limit 1;
  elsif t = 'place' then
    select p.id, p.id, p.name,
           (trim(p_edit_id) = 'KTG-ADMIN-2026')
      into rid, pid, nm, ok
    from public.places p
    where (trim(p_entity_id) <> '' and p.id = trim(p_entity_id))
       or (trim(p_entity_id) = '' and lower(p.name) = lower(trim(p_entity_name)))
    limit 1;
  else
    return jsonb_build_object('success',false,'message','Invalid entity type.');
  end if;

  if rid is null then
    return jsonb_build_object('success',false,'message','Business/place not found.');
  end if;
  if not ok then
    return jsonb_build_object('success',false,'message','Invalid Edit ID.');
  end if;

  return jsonb_build_object(
    'success',true,
    'entityType',t,
    'entityId',rid,
    'placeId',coalesce(pid,''),
    'entityName',coalesce(nm,'')
  );
end;
$$;

-- Verified update RPC.
-- Only whitelisted frontend fields can be changed.
create or replace function public.ktg_update_entity(
  p_entity_type text,
  p_entity_id text,
  p_edit_id text,
  p_data jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t text := lower(trim(coalesce(p_entity_type,'')));
  idv text := trim(coalesce(p_entity_id,''));
  editv text := trim(coalesce(p_edit_id,''));
  ok boolean := false;
  out jsonb;
  sql text;
  sets text[] := '{}';
  k text;
  v jsonb;
  allowed jsonb;
  col text;
  typ text;
begin
  if t = 'restaurant' then
    select (editv = 'KTG-ADMIN-2026' or editv = coalesce(r.verification_id,''))
      into ok from public.restaurants r where r.restaurant_id=idv;
  elsif t = 'hotel' then
    select (editv = 'KTG-ADMIN-2026' or editv = coalesce(h.verification_id,''))
      into ok from public.hotels h where h.hotel_id=idv;
  elsif t = 'place' then
    select (editv = 'KTG-ADMIN-2026') into ok from public.places p where p.id=idv;
  else
    return jsonb_build_object('success',false,'message','Invalid entity type.');
  end if;

  if not ok then
    return jsonb_build_object('success',false,'message','Invalid Edit ID or record.');
  end if;

  -- JSON key -> database column mapping.
  allowed := jsonb_build_object(
    'name','name','description','description','shortInfo','short_info',
    'short_info','short_info','image','image','images','images',
    'metroStation','metro_station','openingHours','opening_hours',
    'closingDay','closing_day','ticketPrice','ticket_price',
    'extraCharges','extra_charges','attractions','attractions',
    'contactNumber','contact_number','officialWebsite','official_website',
    'googleMaps','google_maps','latitude','latitude','longitude','longitude',
    'metroBookingUrl','metro_booking_url','dataNote','data_note',
    'type','type','location','location','price','price','priceUnit','price_unit',
    'averageCost','average_cost','rating','rating','reviews','reviews',
    'cuisine','cuisine','openingTime','opening_time','closingTime','closing_time',
    'hotel','hotel','facilities','facilities','website','website',
    'placeId','place_id','category','category','starRating','star_rating',
    'email','email','checkInTime','check_in_time','checkOutTime','check_out_time',
    'dining','dining','gallery','gallery','hasImage','has_image',
    'menu','menu','rooms','rooms','policies','policies','cancellation','cancellation',
    'payment','payment','children','children','pets','pets',
    'address','address','area','area','locality','locality','city','city',
    'state','state','pincode','pincode','postalCode','postal_code',
    'googleMapsLink','google_maps','bookingLink','booking_link',
    'phone','phone','alternatePhone','alternate_phone',
    'amenities','amenities','services','services','seatingCapacity','seating_capacity',
    'specialties','specialties','specialities','specialities','highlights','highlights',
    'roomType','room_type','distance','distance','cuisineType','cuisine_type'
  );

  for k,v in select * from jsonb_each(coalesce(p_data,'{}'::jsonb)) loop
    col := allowed ->> k;
    if col is null then continue; end if;
    -- Never allow identity/security/timestamp fields.
    if col in ('id','restaurant_id','hotel_id','business_id','verification_id','edit_id','updated_at') then continue; end if;

    if jsonb_typeof(v) in ('object','array') then
      sets := array_append(sets, format('%I = $1::jsonb', col));
    else
      -- Let PostgreSQL cast from text to the destination column.
      sets := array_append(sets, format('%I = $1', col));
    end if;
  end loop;

  -- For simplicity and safety, execute known columns individually using
  -- jsonb_populate_record-like casts through dynamic SQL.
  if t='restaurant' then
    sql := 'update public.restaurants set updated_at=now()';
    for k,v in select * from jsonb_each(coalesce(p_data,'{}'::jsonb)) loop
      col := allowed ->> k;
      if col is null or col in ('restaurant_id','business_id','verification_id','updated_at') then continue; end if;
      if t='restaurant' and col in ('description','menu','facilities') then
        sql := sql || format(', %I = %L::jsonb', col, v::text);
      elsif col in ('rating') then
        sql := sql || format(', %I = %L::numeric', col, v #>> '{}');
      else
        sql := sql || format(', %I = %L', col, v #>> '{}');
      end if;
    end loop;
    sql := sql || ' where restaurant_id = ' || quote_literal(idv);
    execute sql;
    select to_jsonb(r) into out from public.restaurants r where r.restaurant_id=idv;
  elsif t='hotel' then
    sql := 'update public.hotels set updated_at=now()';
    for k,v in select * from jsonb_each(coalesce(p_data,'{}'::jsonb)) loop
      col := allowed ->> k;
      if col is null or col in ('hotel_id','business_id','verification_id','updated_at') then continue; end if;
      if t='hotel' and col in ('description','facilities','dining','images','gallery') then
        sql := sql || format(', %I = %L::jsonb', col, v::text);
      elsif col in ('rating','latitude','longitude') then
        sql := sql || format(', %I = %L::numeric', col, v #>> '{}');
      elsif col='has_image' then
        sql := sql || format(', %I = %L::boolean', col, v #>> '{}');
      else
        sql := sql || format(', %I = %L', col, v #>> '{}');
      end if;
    end loop;
    sql := sql || ' where hotel_id = ' || quote_literal(idv);
    execute sql;
    select to_jsonb(h) into out from public.hotels h where h.hotel_id=idv;
  elsif t='place' then
    sql := 'update public.places set updated_at=now()';
    for k,v in select * from jsonb_each(coalesce(p_data,'{}'::jsonb)) loop
      col := allowed ->> k;
      if col is null or col in ('id','updated_at') then continue; end if;
      if col in ('latitude','longitude') then
        sql := sql || format(', %I = %L::numeric', col, v #>> '{}');
      else
        sql := sql || format(', %I = %L', col, v #>> '{}');
      end if;
    end loop;
    sql := sql || ' where id = ' || quote_literal(idv);
    execute sql;
    select to_jsonb(p) into out from public.places p where p.id=idv;
  end if;

  return jsonb_build_object('success',true,'entity',out,'data',out,'id',idv,'entityType',t);
exception when others then
  return jsonb_build_object('success',false,'message',sqlerrm);
end;
$$;

grant execute on function public.ktg_verify_entity(text,text,text,text) to anon, authenticated;
grant execute on function public.ktg_update_entity(text,text,text,jsonb) to anon, authenticated;
