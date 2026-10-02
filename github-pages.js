
/* KTG Supabase client + GitHub Pages data bridge */
(function(){
  const SUPABASE_URL = "https://yinfffjkoifbxwbpbraj.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_LEIbLKoU-qxY5m8b05LnXA_kYW9XASn";

  const nativeFetch = window.fetch.bind(window);
  const base = new URL('./', location.href).href;
  const OVERRIDE_KEY = 'ktg_static_data_overrides_v1';
  const LEGACY_NAMES = ['/data/places.json','/places.json'];
  let sbPromise = null;
  let realtimeStarted = false;

  function loadSupabase(){
    if(sbPromise) return sbPromise;
    sbPromise = new Promise((resolve,reject)=>{
      if(window.supabase?.createClient){
        resolve(window.supabase); return;
      }
      const script=document.createElement('script');
      script.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
      script.onload=()=>resolve(window.supabase);
      script.onerror=()=>reject(new Error('Supabase client library could not be loaded.'));
      document.head.appendChild(script);
    });
    return sbPromise;
  }
  async function client(){
    const api=await loadSupabase();
    if(!window.__KTGSupabaseClient){
      window.__KTGSupabaseClient=api.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{
        auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
      });
    }
    return window.__KTGSupabaseClient;
  }

  const clean=v=>String(v??'').trim();
  function arr(v){ return Array.isArray(v)?v:(v==null||v===''?[]:[v]); }
  function mapHotel(h){
    return {
      hotelId:h.hotel_id, verificationId:h.verification_id, businessId:h.business_id,
      name:h.name, type:h.type, location:h.location, contactNumber:h.contact_number,
      image:h.image, rating:h.rating, reviews:h.reviews, price:h.price, priceUnit:h.price_unit,
      description:h.description, facilities:h.facilities, website:h.website,
      googleMaps:h.google_maps, openingTime:h.opening_time, closingTime:h.closing_time,
      placeId:h.place_id, category:h.category, starRating:h.star_rating,
      latitude:h.latitude, longitude:h.longitude, email:h.email,
      checkInTime:h.check_in_time, checkOutTime:h.check_out_time, dining:h.dining,
      images:h.images, gallery:h.gallery, hasImage:h.has_image, updatedAt:h.updated_at
    };
  }
  function mapRestaurant(r){
    return {
      restaurantId:r.restaurant_id, verificationId:r.verification_id, businessId:r.business_id,
      name:r.name, type:r.type, hotel:r.hotel, location:r.location,
      contactNumber:r.contact_number, image:r.image, rating:r.rating, reviews:r.reviews,
      price:r.price, priceUnit:r.price_unit, averageCost:r.average_cost,
      description:r.description, cuisine:r.cuisine, openingTime:r.opening_time,
      closingTime:r.closing_time, menu:r.menu, facilities:r.facilities,
      website:r.website, googleMaps:r.google_maps, placeId:r.place_id,
      updatedAt:r.updated_at
    };
  }
  function mapPlace(p){
    return {
      id:p.id, name:p.name, shortInfo:p.short_info, image:p.image,
      metroStation:p.metro_station, openingHours:p.opening_hours,
      closingDay:p.closing_day, ticketPrice:p.ticket_price,
      extraCharges:p.extra_charges, attractions:p.attractions,
      contactNumber:p.contact_number, officialWebsite:p.official_website,
      googleMaps:p.google_maps, latitude:p.latitude, longitude:p.longitude,
      metroBookingUrl:p.metro_booking_url, dataNote:p.data_note,
      updatedAt:p.updated_at, hotels:[], restaurants:[]
    };
  }

  async function getPlacesFromSupabase(){
    const c=await client();
    const [p,h,r,ph,pr]=await Promise.all([
      c.from('places').select('*').order('name'),
      c.from('hotels').select('*').order('name'),
      c.from('restaurants').select('*').order('name'),
      c.from('place_hotels').select('*'),
      c.from('place_restaurants').select('*')
    ]);
    for(const x of [p,h,r,ph,pr]) if(x.error) throw x.error;

    const places=(p.data||[]).map(mapPlace);
    const hotels=(h.data||[]).map(mapHotel);
    const restaurants=(r.data||[]).map(mapRestaurant);
    const hm=new Map(hotels.map(x=>[clean(x.hotelId),x]));
    const rm=new Map(restaurants.map(x=>[clean(x.restaurantId),x]));
    const pm=new Map(places.map(x=>[clean(x.id),x]));

    for(const link of ph.data||[]){
      const place=pm.get(clean(link.place_id)), hotel=hm.get(clean(link.hotel_id));
      if(place && hotel) place.hotels.push({...hotel,placeId:hotel.placeId||place.id});
    }
    for(const link of pr.data||[]){
      const place=pm.get(clean(link.place_id)), rest=rm.get(clean(link.restaurant_id));
      if(place && rest) place.restaurants.push({...rest,placeId:rest.placeId||place.id});
    }

    // Some imported rows carry place_id but may not have a link row.
    for(const hotel of hotels){
      if(hotel.placeId && pm.has(clean(hotel.placeId))){
        const p=pm.get(clean(hotel.placeId));
        if(!p.hotels.some(x=>clean(x.hotelId)===clean(hotel.hotelId))) p.hotels.push(hotel);
      }
    }
    for(const rest of restaurants){
      if(rest.placeId && pm.has(clean(rest.placeId))){
        const p=pm.get(clean(rest.placeId));
        if(!p.restaurants.some(x=>clean(x.restaurantId)===clean(rest.restaurantId))) p.restaurants.push(rest);
      }
    }

    startRealtime();
    return places;
  }

  async function startRealtime(){
    if(realtimeStarted) return;
    realtimeStarted=true;
    try{
      const c=await client();
      c.channel('ktg-live-data')
        .on('postgres_changes',{event:'*',schema:'public',table:'places'},()=>location.reload())
        .on('postgres_changes',{event:'*',schema:'public',table:'hotels'},()=>location.reload())
        .on('postgres_changes',{event:'*',schema:'public',table:'restaurants'},()=>location.reload())
        .subscribe();
    }catch(e){ console.warn('KTG realtime unavailable:',e); }
  }

  async function getPlaces(){
    try { return await getPlacesFromSupabase(); }
    catch(e){
      console.warn('Supabase load failed; falling back to static files:',e);
      return await loadStaticPlaces();
    }
  }

  async function fetchFirstWorking(candidates){
    let last=null;
    for(const file of candidates){
      try{
        const r=await nativeFetch(new URL(file,base).href,{cache:'no-store'});
        if(!r.ok){last=new Error(`${file} could not be loaded (${r.status})`);continue;}
        const d=await r.json();
        if(Array.isArray(d)) return d;
        last=new Error(`${file} must contain an array`);
      }catch(e){last=e;}
    }
    throw last||new Error('Place data file could not be loaded.');
  }
  async function loadStaticPlaces(){
    const parts=await Promise.all(Array.from({length:10},(_,i)=>fetchFirstWorking([`places-${i+1}.json`,`data/places-${i+1}.json`])));
    return parts.flat();
  }

  function jsonResponse(obj,status=200){
    return new Response(JSON.stringify(obj),{status,headers:{'Content-Type':'application/json'}});
  }

  async function verify(body){
    const c=await client();
    const {data,error}=await c.rpc('ktg_verify_entity',{
      p_entity_type:String(body.entityType||''),
      p_entity_id:String(body.entityId||''),
      p_entity_name:String(body.entityName||''),
      p_edit_id:String(body.editId||'')
    });
    if(error) throw error;
    return data;
  }

  async function loadEntity(body){
    const places=await getPlacesFromSupabase();
    const type=String(body.entityType||'').toLowerCase();
    for(const p of places){
      const list=type==='hotel'?p.hotels:type==='restaurant'?p.restaurants:[p];
      const found=list.find(x=>
        (body.entityId && (type==='hotel'?x.hotelId:type==='restaurant'?x.restaurantId:x.id)===String(body.entityId)) ||
        (body.entityName && String(x.name||'').toLowerCase()===String(body.entityName).toLowerCase())
      );
      if(found) return {success:true,entity:found,id:type==='hotel'?found.hotelId:type==='restaurant'?found.restaurantId:found.id,entityType:type,placeId:p.id};
    }
    return {success:false,message:'Business/place not found.'};
  }

  async function updateEntity(body){
    const c=await client();
    const {data,error}=await c.rpc('ktg_update_entity',{
      p_entity_type:String(body.entityType||''),
      p_entity_id:String(body.entityId||''),
      p_edit_id:String(body.editId||''),
      p_data:body.data||{}
    });
    if(error) throw error;
    if(!data?.success) return data;
    return data;
  }

  const IS_STATIC_HOST =
    location.protocol==='file:' ||
    /\.github\.io$/i.test(location.hostname) ||
    (location.hostname==='localhost' && !window.__KTG_SERVER_MODE__);

  window.fetch = async function(input,init){
    const raw=typeof input==='string'?input:input?.url||'';
    const u=new URL(raw,location.href), path=u.pathname;
    const method=(init?.method||'GET').toUpperCase();

    // On a real Express deployment, leave /api calls alone.
    if(!IS_STATIC_HOST && path.startsWith('/api/')) return nativeFetch(input,init);

    if(method==='GET' && LEGACY_NAMES.some(n=>path===n||path.endsWith(n))){
      try{return jsonResponse(await getPlaces());}
      catch(e){return jsonResponse({success:false,message:e.message},500);}
    }

    if(path.includes('/api/restaurants/') && method==='GET'){
      const rid=decodeURIComponent(path.split('/').pop());
      try{
        const places=await getPlaces();
        for(const p of places){
          const found=p.restaurants.find(x=>clean(x.restaurantId)===rid);
          if(found) return jsonResponse({success:true,restaurant:found,restaurantId:rid});
        }
        return jsonResponse({success:false,message:'Restaurant not found.'},404);
      }catch(e){return jsonResponse({success:false,message:e.message},500);}
    }

    if(path.endsWith('/api/admin/verify') && method==='POST'){
      try{return jsonResponse(await verify(JSON.parse(init?.body||'{}')));}
      catch(e){return jsonResponse({success:false,message:e.message||'Verification failed.'},500);}
    }

    if(path.endsWith('/api/admin/entity') && method==='POST'){
      try{return jsonResponse(await loadEntity(JSON.parse(init?.body||'{}')));}
      catch(e){return jsonResponse({success:false,message:e.message||'Could not load data.'},500);}
    }

    if(path.endsWith('/api/admin/entity') && method==='PUT'){
      try{return jsonResponse(await updateEntity(JSON.parse(init?.body||'{}')));}
      catch(e){return jsonResponse({success:false,message:e.message||'Could not save changes.'},500);}
    }

    return nativeFetch(input,init);
  };

  window.KTGStatic={getPlaces,clearOverrides(){location.reload();}};
})();
