const MASTER_ADMIN_ID = "KTG-ADMIN-2026";
const params = new URLSearchParams(location.search);
const requestedPlaceId = params.get("id");

let allPlaces = [];
let currentPlace = null;
let hotels = [];
let currentHotel = null;
let verifiedEditId = "";

const $ = (id) => document.getElementById(id);
const clean = (v) => String(v ?? "").trim();
const esc = (v) => clean(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

function imageUrl(h){
  const v = h?.image;
  return typeof v === "string" && /^https?:\/\//i.test(v.trim()) ? v.trim() : "";
}

function safeUrl(v){
  const s = clean(v);
  return /^https?:\/\//i.test(s) ? s : "";
}

function renderImagePreview(container, url, emptyText = "No image"){
  if(!container) return;
  const valid = safeUrl(url);
  container.innerHTML = valid
    ? `<img src="${esc(valid)}" alt="Hotel preview" referrerpolicy="no-referrer" onerror="this.parentElement.innerHTML='<div class=\"image-empty\"><span>🖼️</span><b>Image could not be loaded</b><small>Check the image link</small></div>'">`
    : `<div class="image-empty"><span>🏨</span><b>${esc(emptyText)}</b><small>Only an image link can be added</small></div>`;
}

document.addEventListener("DOMContentLoaded", () => {
  $("backBtn").addEventListener("click", () => {
    if (requestedPlaceId) location.href = `place.html?id=${encodeURIComponent(requestedPlaceId)}`;
    else history.back();
  });
  $("themeBtn").addEventListener("click", toggleTheme);
  document.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => closeModal($(b.dataset.close))));
  document.addEventListener("keydown", e => { if(e.key === "Escape") document.querySelectorAll(".modal").forEach(m => closeModal(m)); });
  $("hotelSearch").addEventListener("input", renderCards);
  $("bookingForm").addEventListener("submit", submitBooking);
  $("editAccessForm").addEventListener("submit", verifyHotelEdit);
  $("hotelEditForm").addEventListener("submit", saveHotelEdit);
  load();
});

async function load(){
  try{
    // Prefer the page-linked JSON if it exists; otherwise use the bundled hotel data.
    let json = null;
    const candidates = ["places.json", "data/places.json", "data/hotels.json"];
    for(const src of candidates){
      try{
        const res = await fetch(src,{cache:"no-store"});
        if(res.ok){ json = await res.json(); break; }
      }catch(_){ /* try next source */ }
    }
    if(!json) throw new Error("Could not load hotel JSON data.");

    allPlaces = Array.isArray(json) ? json : Array.isArray(json.places) ? json.places : [];
    const bundledHotels = Array.isArray(json.hotels) ? json.hotels : Array.isArray(json.data) ? json.data : [];

    if(allPlaces.length){
      currentPlace = requestedPlaceId
        ? allPlaces.find(p => clean(p.id)===clean(requestedPlaceId) || clean(p.placeId)===clean(requestedPlaceId))
        : allPlaces[0];
      if(!currentPlace) currentPlace = allPlaces[0];
      hotels = getHotelsFromPlace(currentPlace);
      if(!hotels.length && bundledHotels.length) hotels = bundledHotels.filter(h => samePlace(h,currentPlace));
    } else {
      // hotels.json is also supported as a standalone source.
      hotels = requestedPlaceId ? bundledHotels.filter(h => samePlace(h,{id:requestedPlaceId})) : bundledHotels;
      currentPlace = {id: requestedPlaceId || "", name: hotels[0]?.placeName || "Kolkata", shortInfo:"Hotel information loaded from the KTG JSON data."};
    }

    renderPlace();
    renderCards();
  }catch(err){
    console.error(err);
    $("hotelCards").innerHTML = `<div class="empty"><div>⚠️</div><h3>Could not load hotel data</h3><p>${esc(err.message)}</p></div>`;
  }
}

function getHotelsFromPlace(place){
  return Array.isArray(place?.hotels) ? place.hotels
    : Array.isArray(place?.hotel) ? place.hotel
    : Array.isArray(place?.hotelList) ? place.hotelList : [];
}
function samePlace(h,p){
  const a = clean(h.placeId||h.placeSlug||h.placeName).toLowerCase();
  const ids = [clean(p.id),clean(p.placeId),clean(p.name)].map(x=>x.toLowerCase());
  return !a || ids.includes(a) || ids.some(x => x && a && (a===x || a.includes(x) || x.includes(a)));
}
function renderPlace(){
  const name = currentPlace?.name || currentPlace?.placeName || "Kolkata";
  $("placeName").textContent = name;
  $("placeLabel").textContent = name;
  $("heroTitle").textContent = `Find your next stay near ${name}`;
  $("heroText").textContent = currentPlace?.shortInfo || currentPlace?.description || "Choose a comfortable hotel for your trip.";
  document.title = `Hotels near ${name} | Kolkata Tourist Guide`;

  // Show ONLY the searched destination's JSON image in the top Hero area.
  // The hotel cards/details below are intentionally untouched.
  const hero = document.querySelector(".hero");
  const placeImage = safeUrl(currentPlace?.image);
  if(hero){
    hero.classList.toggle("has-place-image", !!placeImage);
    if(placeImage){
      hero.style.setProperty("--place-image", `url("${placeImage.replace(/"/g, '\"')}")`);
      hero.setAttribute("data-place-image", placeImage);
    }else{
      hero.style.removeProperty("--place-image");
      hero.removeAttribute("data-place-image");
    }
  }
}
function renderCards(){
  const q = clean($("hotelSearch").value).toLowerCase();
  const filtered = hotels.filter(h => [h.name,h.hotelName,h.location,h.category,h.starRating].join(" ").toLowerCase().includes(q));
  $("hotelCount").textContent = filtered.length;
  const box = $("hotelCards");
  box.innerHTML = "";
  if(!filtered.length){
    box.innerHTML = `<div class="empty"><div>🏨</div><h3>No matching hotels</h3><p>No hotel record matched your search.</p></div>`;
    $("details").innerHTML = `<div class="empty"><div>🏨</div><h3>Select a hotel</h3><p>Choose a hotel to view complete details.</p></div>`;
    return;
  }
  filtered.forEach(h=>{
    const card=document.createElement("article");
    card.className="hotel-card";
    const img=imageUrl(h);
    card.innerHTML = `
      <div class="hotel-thumb">${img ? `<img src="${esc(img)}" alt="${esc(h.name||h.hotelName||"Hotel")}" referrerpolicy="no-referrer" onerror="this.parentElement.innerHTML='<div class=\"image-empty\"><span>🏨</span><small>Image unavailable</small></div>'">` : `<div class="image-empty"><span>🏨</span><small>No image in JSON</small></div>`}</div>
      <div class="card-body">
        <div class="card-kicker">${esc(h.category||"HOTEL")}</div>
        <h3>${esc(h.name||h.hotelName||"Hotel")}</h3>
        <div class="muted">📍 ${esc(h.location||h.address||"Kolkata")}</div>
        <div class="meta">
          ${h.starRating?`<span class="pill">${esc(h.starRating)}</span>`:""}
          ${h.rating?`<span class="pill rating">★ ${esc(h.rating)}</span>`:""}
          ${startingPrice(h)?`<span class="pill price">${esc(formatPrice(startingPrice(h)))} / night</span>`:""}
        </div>
        <div class="muted">${esc(h.description||h.shortInfo||"Hotel information available.")}</div>
      </div>`;
    card.addEventListener("click",()=>selectHotel(h));
    box.appendChild(card);
  });
  selectHotel(filtered[0]);
}
function selectHotel(h){
  currentHotel=h;
  document.querySelectorAll(".hotel-card").forEach(c=>c.classList.remove("active"));
  const cards=[...document.querySelectorAll(".hotel-card")];
  const match=cards.find(c=>c.querySelector("h3")?.textContent===clean(h.name||h.hotelName||"Hotel"));
  if(match) match.classList.add("active");
  renderDetails(h);
  $("editTargetName").textContent=h.name||h.hotelName||"Hotel";
}
function roomsOf(h){
  if(Array.isArray(h.rooms)) return h.rooms;
  if(Array.isArray(h.roomTypes)) return h.roomTypes.map(r=>typeof r==="string"?{name:r}:r);
  return [];
}
function facilitiesOf(h){return Array.isArray(h.facilities)?h.facilities:Array.isArray(h.amenities)?h.amenities:[];}
function startingPrice(h){
  if(h.price!==undefined && clean(h.price)) return h.price;
  const r=roomsOf(h); return r.length ? (r.map(x=>x.price||x.rate).find(Boolean)||"") : "";
}
function formatPrice(v){if(v===undefined||v===null||clean(v)==="")return "—";const s=clean(v);return s.startsWith("₹")?s:`₹${s}`;}
function policiesOf(h){return h.policies||{};}
function renderDetails(h){
  const name=h.name||h.hotelName||"Hotel", fac=facilitiesOf(h), rooms=roomsOf(h), p=policiesOf(h), img=imageUrl(h);
  $("details").innerHTML=`
    <div class="detail-image">${img ? `<img src="${esc(img)}" alt="${esc(name)}" referrerpolicy="no-referrer" onerror="this.parentElement.innerHTML='<div class=\"image-empty\"><span>🏨</span><b>Image unavailable</b></div>'">` : `<div class="image-empty"><span>🏨</span><b>No image supplied</b><small>Hotel JSON has no image link</small></div>`}</div>
    <div class="details-head">
      <span class="eyebrow">HOTEL DETAILS</span>
      <h2>${esc(name)}</h2>
      <div class="muted">📍 ${esc(h.location||h.address||"Kolkata")}</div>
      <p class="muted">${esc(h.description||h.about||h.shortInfo||"Hotel information available.")}</p>
    </div>
    <div class="detail-grid">
      ${box("Category",h.category||"Hotel")}${box("Star rating",h.starRating||"—")}
      ${box("Contact",h.contactNumber||"—")}${box("Starting rate",formatPrice(startingPrice(h)))}
      ${box("Check-in",p.checkIn||h.checkInTime||h.checkIn||"—")}${box("Check-out",p.checkOut||h.checkOutTime||h.checkOut||"—")}
      ${box("Open",h.openingTime||"—")}${box("Close",h.closingTime||"—")}
    </div>
    <section class="details-section"><h3>Rooms & Rates</h3><div>${rooms.length?rooms.map(r=>`<div class="detail-box room-box"><b>${esc(r.name||r.type||"Room")}</b><div class="muted">${esc(r.guests||r.capacity||"2 Guests")} · ${esc(formatPrice(r.price||r.rate||"—"))}</div></div>`).join(""):`<div class="muted">Room information not supplied.</div>`}</div></section>
    <section class="details-section"><h3>Facilities</h3><div class="chips">${fac.length?fac.map(x=>`<span class="pill">${esc(x)}</span>`).join(""):`<span class="muted">No facilities supplied.</span>`}</div></section>
    <section class="details-section"><h3>Dining</h3><div class="chips">${(h.dining||h.restaurants||[]).map(x=>`<span class="pill">${esc(x)}</span>`).join("")||`<span class="muted">No dining information supplied.</span>`}</div></section>
    <section class="details-section"><h3>Policies</h3><div class="detail-grid inner">${box("Cancellation",p.cancellation||h.cancellation||"As per hotel policy")}${box("Children",p.children||h.childrenPolicy||"Allowed")}${box("Pets",p.pets||h.petPolicy||"Check with hotel")}${box("Payment",p.payment||h.payment||"Online / Hotel")}</div></section>
    <section class="details-section"><div class="actions"><button class="primary" id="bookBtn">View Details & Book Now</button><button class="secondary" id="editBtn">✎ Edit Hotel</button>${h.website||h.officialWebsite?`<a class="secondary" target="_blank" rel="noopener" href="${esc(h.website||h.officialWebsite)}">Official Website</a>`:""}${h.googleMaps?`<a class="secondary" target="_blank" rel="noopener" href="${esc(h.googleMaps)}">Map</a>`:""}</div></section>`;
  $("bookBtn").addEventListener("click",()=>openBooking(h));
  $("editBtn").addEventListener("click",openEditAccess);
}
function box(k,v){return `<div class="detail-box"><span>${esc(k)}</span><b>${esc(v||"—")}</b></div>`;}

function openBooking(h){
  currentHotel=h; $("bookingHotelName").textContent=h.name||h.hotelName||"Hotel";
  const select=$("roomSelect"), rooms=roomsOf(h); select.innerHTML="";
  (rooms.length?rooms:[{name:"Standard Room",price:startingPrice(h)}]).forEach((r,i)=>{const o=document.createElement("option");o.value=String(i);o.textContent=`${r.name||r.type||"Room"} — ${formatPrice(r.price||r.rate||"—")}`;select.appendChild(o);});
  const update=()=>{const r=(rooms.length?rooms:[{price:startingPrice(h)}])[Number(select.value)||0];$("selectedRoomPrice").textContent=formatPrice(r.price||r.rate||startingPrice(h));};
  select.onchange=update;update();$("bookingResult").textContent="";openModal($("bookingModal"));
}
async function submitBooking(e){
  e.preventDefault();
  if(!currentHotel)return;

  const guestName=clean($("guestName").value);
  const phone=clean($("guestPhone").value);
  const guests=Number($("guestCount").value);
  const checkIn=clean($("checkIn").value);
  const checkOut=clean($("checkOut").value);
  const address=clean($("guestAddress").value);
  const selectedRoom=$("roomSelect").selectedOptions[0]?.textContent||"";

  if(!guestName){$("bookingResult").className="result error";$("bookingResult").textContent="Please enter your name.";return;}
  if(phone.replace(/\D/g,"").length<10){$("bookingResult").className="result error";$("bookingResult").textContent="Please enter a valid mobile number.";return;}
  if(!Number.isInteger(guests)||guests<1||guests>20){$("bookingResult").className="result error";$("bookingResult").textContent="Guests must be between 1 and 20.";return;}
  if(!checkIn||!checkOut){$("bookingResult").className="result error";$("bookingResult").textContent="Please select check-in and check-out dates.";return;}

  const businessName=currentHotel.name||currentHotel.hotelName||"Hotel";
  let whatsappNumber=clean(currentHotel.contactNumber||currentHotel.phone||"").replace(/\D/g,"");

  // Testing number: 9002907513. If a future data number is already international,
  // preserve its country code; otherwise assume India (+91).
  if(whatsappNumber.startsWith("0")) whatsappNumber=whatsappNumber.replace(/^0+/,"");
  if(whatsappNumber.length===10) whatsappNumber="91"+whatsappNumber;

  if(!whatsappNumber){
    $("bookingResult").className="result error";
    $("bookingResult").textContent="This hotel does not have a valid WhatsApp contact number in places.json.";
    return;
  }

  const button=e.submitter;
  if(button){
    button.disabled=true;
    button.dataset.originalText=button.textContent;
    button.textContent="Opening WhatsApp…";
  }
  $("bookingResult").className="result";
  $("bookingResult").textContent="Preparing your booking details for WhatsApp…";

  try{
    const bookingId="KTG-HOTEL-BOOK-"+Date.now().toString(36).toUpperCase();
    const lines=[
      "🏨 KTG HOTEL BOOKING REQUEST",
      "",
      `Hotel: ${businessName}`,
      `Booking ID: ${bookingId}`,
      "",
      `Guest Name: ${guestName}`,
      `Guest Phone: ${phone}`,
      `Guests: ${guests}`,
      `Room: ${selectedRoom||"Standard Room"}`,
      `Check-in: ${checkIn}`,
      `Check-out: ${checkOut}`
    ];
    if(address)lines.push(`Guest Address: ${address}`);
    lines.push("", "Please confirm availability with the customer.", "", "Sent from Kolkata Tourist Guide (KTG)");

    const whatsappUrl=`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(lines.join("\n"))}`;

    // Open directly from the submit event so browsers are less likely to block it.
    const popup=window.open(whatsappUrl,"_blank","noopener,noreferrer");
    if(!popup){
      window.location.href=whatsappUrl;
      return;
    }

    localStorage.setItem("ktg_last_hotel_booking",JSON.stringify({
      bookingId,
      entityType:"hotel",
      entityId:getHotelId(currentHotel),
      entityName:businessName,
      customerName:guestName,
      customerPhone:phone,
      guests,
      roomType:selectedRoom,
      checkIn,
      checkOut,
      address,
      whatsappNumber,
      createdAt:new Date().toISOString(),
      whatsappSent:true
    }));

    $("bookingResult").className="result success";
    $("bookingResult").textContent=`✓ Booking ${bookingId} prepared. WhatsApp opened for ${businessName}.`;
  }catch(err){
    console.error("Hotel WhatsApp booking error:",err);
    $("bookingResult").className="result error";
    $("bookingResult").textContent=err.message||"Could not open WhatsApp booking.";
  }finally{
    if(button){button.disabled=false;button.textContent=button.dataset.originalText||"Confirm Booking Request";}
  }
}

function openEditAccess(){
  if(!currentHotel)return;
  $("editTargetName").textContent=currentHotel.name||currentHotel.hotelName||"Hotel";
  $("hotelEditId").value="";$("editAccessError").textContent="";openModal($("editAccessModal"));
}
async function verifyHotelEdit(e){
  e.preventDefault();const supplied=clean($("hotelEditId").value);if(!supplied)return;
  const expected=getVerificationId(currentHotel);
  if(supplied===MASTER_ADMIN_ID || (expected && supplied===expected)){verifiedEditId=supplied;closeModal($("editAccessModal"));openEditForm();return;}
  try{
    const r=await fetch("/api/admin/verify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({editId:supplied,entityType:"hotel",entityId:getHotelId(currentHotel),entityName:currentHotel.name||currentHotel.hotelName,placeId:currentPlace?.id||currentPlace?.placeId||""})});
    const j=await r.json();if(r.ok&&j.success){verifiedEditId=supplied;closeModal($("editAccessModal"));openEditForm();return;}throw new Error(j.message||"Invalid Hotel Verification ID.");
  }catch(err){$("editAccessError").textContent=err.message||"Invalid Hotel Verification ID.";}
}

function openEditForm(){
  const h=currentHotel, form=$("hotelEditForm"), img=imageUrl(h);
  $("editTitle").textContent=`Edit: ${h.name||h.hotelName||"Hotel"}`;
  form.innerHTML=`
    <div class="editor-shell">
      <aside class="editor-sidebar">
        <div id="editImagePreview" class="edit-image-preview"></div>
        <button type="button" class="change-image-btn" id="changeImageBtn">↥ Change Image</button>
        <div class="image-link-panel" id="imageLinkPanel">
          <label>Image Link
            <input id="hotelImageUrl" data-field="image" type="url" inputmode="url" placeholder="https://example.com/hotel-image.jpg" value="${esc(img)}" autocomplete="off">
          </label>
          <small>Only a direct image URL/link is accepted. No file upload is used.</small>
        </div>
        <div class="side-info"><span>Hotel ID</span><b>${esc(getHotelId(h)||"—")}</b></div>
        <div class="side-info"><span>Verification</span><b>Protected</b></div>
      </aside>
      <section class="editor-main">
        <div class="form-section"><div class="form-section-title"><span>▣</span><b>Basic Information</b></div>
          <div class="edit-grid">
            ${editField("name","Hotel Name",h.name||h.hotelName||"")}
            ${editField("category","Hotel Type",h.category||"Luxury Hotel","select",["Luxury Hotel","Business Hotel","Boutique Hotel","Budget Hotel","Resort","Heritage Hotel","Other"])}
            ${editField("description","Description",h.description||h.about||"", "textarea")}
            ${editField("starRating","Star Rating",h.starRating||"5-star","select",["1-star","2-star","3-star","4-star","5-star","Unrated"])}
            ${editField("price","Price Range / Starting Price",h.price||startingPrice(h)||"")}
          </div>
        </div>
        <div class="form-section"><div class="form-section-title"><span>⌖</span><b>Location</b></div>
          <div class="edit-grid">${editField("location","Address / Location",h.location||h.address||"","input",null,true)}${editField("latitude","Latitude",h.latitude??"")}${editField("longitude","Longitude",h.longitude??"")}</div>
        </div>
        <div class="form-section"><div class="form-section-title"><span>▣</span><b>Contact Information</b></div>
          <div class="edit-grid">${editField("contactNumber","Phone Number",h.contactNumber||"")}${editField("email","Email",h.email||"")}${editField("website","Website",h.website||h.officialWebsite||"")}${editField("googleMaps","Google Maps",h.googleMaps||"")}</div>
        </div>
        <div class="form-section"><div class="form-section-title"><span>◫</span><b>Additional Details</b></div>
          <div class="edit-grid">${editField("checkInTime","Check-in Time",h.checkInTime||h.checkIn||"")}${editField("checkOutTime","Check-out Time",h.checkOutTime||h.checkOut||"")}${editField("openingTime","Opening Time",h.openingTime||"")}${editField("closingTime","Closing Time",h.closingTime||"")}${editField("facilities","Amenities / Facilities",facilitiesOf(h).join("\\n"),"textarea",null,true)}${editField("dining","Dining / Restaurants",(h.dining||h.restaurants||[]).join("\\n"),"textarea",null,true)}</div>
        </div>
        <div class="save-row"><button type="submit" class="primary save-btn">✓ Save Changes</button><button type="button" class="secondary" id="resetEdit">Reset</button></div>
        <div id="saveMessage" class="result"></div>
      </section>
    </div>`;

  renderImagePreview($("editImagePreview"), img, "No image in JSON");
  $("changeImageBtn").addEventListener("click",()=>{
    const panel=$("imageLinkPanel");
    panel.classList.toggle("open");
    if(panel.classList.contains("open")) $("hotelImageUrl").focus();
  });
  $("hotelImageUrl").addEventListener("input",()=>renderImagePreview($("editImagePreview"),$("hotelImageUrl").value,"No image in JSON"));
  $("resetEdit").addEventListener("click",openEditForm);
  openModal($("editModal"));
}
function editField(k,label,value,type="input",options=null,full=false){
  let control="";
  if(type==="textarea") control=`<textarea data-field="${esc(k)}" rows="4">${esc(value)}</textarea>`;
  else if(type==="select") control=`<select data-field="${esc(k)}">${(options||[]).map(o=>`<option ${clean(value)===o?"selected":""}>${esc(o)}</option>`).join("")}</select>`;
  else control=`<input data-field="${esc(k)}" value="${esc(value)}" ${k.toLowerCase().includes("url")||["website","googleMaps"].includes(k)?'type="url"':''}>`;
  return `<label class="edit-field ${full?"full":""}">${esc(label)}${control}</label>`;
}
async function saveHotelEdit(e){
  e.preventDefault();
  const updated={...currentHotel};
  document.querySelectorAll("#hotelEditForm [data-field]").forEach(el=>{
    const k=el.dataset.field;
    if(k==="image") return;
    updated[k]=el.tagName==="TEXTAREA"?el.value.split(/\r?\n/).map(clean).filter(Boolean):el.value.trim();
  });
  const imageInput=$("hotelImageUrl");
  const image=safeUrl(imageInput?.value);
  updated.image=image||null;
  updated.images=image?[image]:[];
  updated.gallery=image?[image]:[];
  updated.hasImage=Boolean(image);
  for(const k of ["hotelId","businessId","verificationId","hotelVerificationId","Hotel Verification ID","hotelEditId","Hotel Edit ID","hotelEditID","verificationID","editId","businessEditId","Hotel ID"]) if(currentHotel[k]!==undefined) updated[k]=currentHotel[k];

  const msg=$("saveMessage");msg.textContent="Saving...";
  try{
    const r=await fetch("/api/admin/entity",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({editId:verifiedEditId,entityType:"hotel",entityId:getHotelId(currentHotel),placeId:currentPlace?.id||currentPlace?.placeId||"",entity:updated})});
    const j=await r.json().catch(()=>({}));
    if(!r.ok||!j.success) throw new Error(j.message||"Server could not save the hotel.");
    currentHotel=j.entity||updated;
    const idx=hotels.findIndex(x=>getHotelId(x)===getHotelId(currentHotel)); if(idx>=0) hotels[idx]=currentHotel;
    renderCards();renderDetails(currentHotel);
    msg.className="result success";msg.textContent="✓ Hotel information saved successfully.";
    setTimeout(()=>closeModal($("editModal")),900);
  }catch(err){msg.className="result";msg.textContent=`Server save failed: ${err.message}. Your current UI data was not overwritten.`;}
}
function getHotelId(h){return clean(h.hotelId||h["Hotel ID"]||h.businessId||h.id);}
function getVerificationId(h){return clean(h.verificationId||h.hotelVerificationId||h["Hotel Verification ID"]||h.hotelEditId||h["Hotel Edit ID"]||h.editId||h.businessEditId);}
function openModal(m){m.classList.remove("hidden");m.setAttribute("aria-hidden","false");document.body.style.overflow="hidden";}
function closeModal(m){if(!m)return;m.classList.add("hidden");m.setAttribute("aria-hidden","true");if(![...document.querySelectorAll(".modal")].some(x=>!x.classList.contains("hidden")))document.body.style.overflow="";}
function toggleTheme(){document.body.classList.toggle("dark");localStorage.setItem("ktg_hotel_theme",document.body.classList.contains("dark")?"dark":"light");}
if(localStorage.getItem("ktg_hotel_theme")==="dark")document.body.classList.add("dark");
