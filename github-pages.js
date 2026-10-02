/* KTG GitHub Pages compatibility layer
   Loads the place database from 10 split JSON files.
   Supports both:
     /places-1.json ... /places-10.json
   and:
     /data/places-1.json ... /data/places-10.json
   so the same project works with the current GitHub Pages layout
   and the Node/Express layout.
*/
(function(){
  const nativeFetch = window.fetch.bind(window);
  const base = new URL('./', location.href).href;
  const SPLIT_FILES = Array.from({length:10}, (_,i) => [
    `places-${i+1}.json`,
    `data/places-${i+1}.json`
  ]);
  const LEGACY_NAMES = [
    '/data/places.json',
    '/places.json'
  ];
  const OVERRIDE_KEY = 'ktg_static_data_overrides_v1';

  function readOverrides(){
    try { return JSON.parse(localStorage.getItem(OVERRIDE_KEY)||'{}'); }
    catch { return {}; }
  }
  function writeOverrides(v){
    localStorage.setItem(OVERRIDE_KEY, JSON.stringify(v));
  }
  function idOf(e){
    return String(e?.hotelId||e?.restaurantId||e?.businessId||e?.id||
      e?.['Hotel ID']||e?.['Restaurant ID']||'').trim();
  }
  function nameOf(e){
    return String(e?.name||e?.hotelName||e?.restaurantName||e?.title||'').trim();
  }
  function typeList(place,type){
    if(!place) return [];
    const keys = type==='hotel'
      ? ['hotels','hotel','hotelList']
      : ['restaurants','restaurant','restaurantList'];
    for(const k of keys) if(Array.isArray(place[k])) return place[k];
    return [];
  }

  async function fetchFirstWorking(candidates){
    let lastError = null;
    for(const file of candidates){
      try{
        const r = await nativeFetch(new URL(file, base).href, {cache:'no-store'});
        if(!r.ok){
          lastError = new Error(`${file} could not be loaded (${r.status})`);
          continue;
        }
        const data = await r.json();
        if(!Array.isArray(data)){
          lastError = new Error(`${file} must contain an array`);
          continue;
        }
        return data;
      }catch(e){
        lastError = e;
      }
    }
    throw lastError || new Error('Place data file could not be loaded.');
  }

  async function loadSplitPlaces(){
    const parts = await Promise.all(
      SPLIT_FILES.map(fetchFirstWorking)
    );
    return parts.flat();
  }

  async function getPlaces(){
    const places = await loadSplitPlaces();
    const ov = readOverrides();

    for(const p of places){
      for(const type of ['hotel','restaurant']){
        const list = typeList(p,type);
        const saved = ov[p.id]?.[type] || {};
        for(let i=0;i<list.length;i++){
          const id = idOf(list[i]);
          if(saved[id]) list[i] = Object.assign({}, list[i], saved[id]);
        }
      }
    }
    return places;
  }

  function jsonResponse(obj,status=200){
    return new Response(JSON.stringify(obj),{
      status,
      headers:{'Content-Type':'application/json'}
    });
  }

  /*
     IMPORTANT:
     When the real Node/Express server is running, let /api/* requests
     reach the server so Edit -> Save writes to the real JSON database.
     The static mock API is used only when there is no backend.
  */
  const IS_STATIC_HOST =
    location.protocol === 'file:' ||
    /\.github\.io$/i.test(location.hostname) ||
    location.hostname === 'localhost' && !window.__KTG_SERVER_MODE__;

  window.fetch = async function(input, init){
    const rawUrl = typeof input==='string' ? input : input?.url || '';
    const absoluteUrl = new URL(rawUrl, location.href);
    const path = absoluteUrl.pathname;
    const method = (init?.method||'GET').toUpperCase();

    /*
       Real Express server mode:
       never intercept /api/*.
    */
    if(!IS_STATIC_HOST && path.startsWith('/api/')){
      return nativeFetch(input, init);
    }

    /* Old code requests places.json. Always serve the combined
       10-file database instead of the old large file. */
    if(
      method === 'GET' &&
      LEGACY_NAMES.some(name => path === name || path.endsWith(name))
    ){
      try{
        return jsonResponse(await getPlaces());
      }catch(e){
        return jsonResponse({
          success:false,
          message:e.message || 'Place data could not be loaded.'
        },500);
      }
    }

    if(path.startsWith('/api/')){
      try{
        const places = await getPlaces();

        if(
          path.includes('/api/restaurants/') &&
          method === 'GET'
        ){
          const rid = decodeURIComponent(path.split('/').pop());
          for(const p of places){
            const found = typeList(p,'restaurant')
              .find(x => idOf(x) === rid);
            if(found){
              return jsonResponse({
                success:true,
                restaurant:found,
                restaurantId:rid
              });
            }
          }
          return jsonResponse({success:false},404);
        }

        if(path.endsWith('/api/admin/verify') && method==='POST'){
          const body=JSON.parse(init?.body||'{}');
          const type=String(body.entityType||'').toLowerCase();
          if(!['hotel','restaurant'].includes(type)){
            return jsonResponse({
              success:false,
              message:'Invalid business type.'
            },400);
          }

          let entity=null, place=null;
          for(const p of places){
            const found=typeList(p,type).find(x =>
              (body.entityId && idOf(x)===String(body.entityId)) ||
              (body.entityName &&
               nameOf(x).toLowerCase()===String(body.entityName).toLowerCase())
            );
            if(found){ entity=found; place=p; break; }
          }

          if(!entity){
            return jsonResponse({
              success:false,
              message:'Business not found in place data.'
            },404);
          }

          const expected=String(
            entity.verificationId ||
            entity.hotelVerificationId ||
            entity.restaurantVerificationId ||
            entity.editId || ''
          );
          const supplied=String(body.editId||'');

          if(
            supplied !== 'KTG-ADMIN-2026' &&
            supplied !== expected
          ){
            return jsonResponse({
              success:false,
              message:'Invalid Edit ID.'
            },403);
          }

          return jsonResponse({
            success:true,
            entityType:type,
            entityId:idOf(entity),
            placeId:place.id
          });
        }

        if(path.endsWith('/api/admin/entity') && method==='POST'){
          const body=JSON.parse(init?.body||'{}');
          const type=String(body.entityType||'').toLowerCase();

          for(const p of places){
            const found=typeList(p,type).find(x =>
              (body.entityId && idOf(x)===String(body.entityId)) ||
              (body.entityName &&
               nameOf(x).toLowerCase()===String(body.entityName).toLowerCase())
            );
            if(found){
              return jsonResponse({
                success:true,
                entity:found,
                id:idOf(found),
                entityType:type
              });
            }
          }

          return jsonResponse({
            success:false,
            message:'Business not found.'
          },404);
        }

        if(path.endsWith('/api/admin/entity') && method==='PUT'){
          const body=JSON.parse(init?.body||'{}');
          const type=String(body.entityType||'').toLowerCase();

          for(const p of places){
            const found=typeList(p,type)
              .find(x => idOf(x)===String(body.entityId));

            if(found){
              const merged=Object.assign(
                {}, found, body.data||body.entity||{}
              );
              const ov=readOverrides();
              ov[p.id] ||= {};
              ov[p.id][type] ||= {};
              ov[p.id][type][idOf(found)] = merged;
              writeOverrides(ov);

              return jsonResponse({
                success:true,
                entity:merged,
                data:merged,
                id:idOf(found),
                entityType:type
              });
            }
          }

          return jsonResponse({
            success:false,
            message:'Business not found.'
          },404);
        }
      }catch(e){
        return jsonResponse({
          success:false,
          message:e.message || 'Static API error'
        },500);
      }
    }

    return nativeFetch(input, init);
  };

  window.KTGStatic = {
    getPlaces,
    clearOverrides(){
      localStorage.removeItem(OVERRIDE_KEY);
      location.reload();
    }
  };
})();
