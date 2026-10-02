(() => {
"use strict";

const $ = id => document.getElementById(id);
const clean = v => String(v ?? "").trim();
const digits = v => clean(v).replace(/\D/g, "");
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};

let type = "";
let entityId = "";
let business = null;
let place = null;
let contact = "";

function showError(text){ $("message").textContent = text || ""; }
function setLoading(on){
  $("submitBtn").disabled = on;
  $("spinner").classList.toggle("hidden", !on);
  $("submitText").textContent = on ? "Preparing WhatsApp…" : "Confirm Booking";
}

function idOf(item, entityType){
  if (!item) return "";
  const keys = entityType === "restaurant"
    ? ["restaurantId","Restaurant ID","restaurantID","restaurant_id","businessId","businessID","business_id","id"]
    : ["hotelId","Hotel ID","hotelID","hotel_id","businessId","businessID","business_id","id"];
  for(const k of keys){ const v=clean(item[k]); if(v) return v; }
  return "";
}

function phoneOf(item){
  return clean(item?.contactNumber || item?.phone || item?.whatsapp || "");
}

function normalizeWhatsAppNumber(value){
  let n = digits(value);
  if(n.startsWith("00")) n = n.slice(2);
  if(n.length === 10) n = "91" + n;
  return n;
}

async function loadBusiness(){
  const p = new URLSearchParams(location.search);
  type = clean(p.get("type")).toLowerCase();
  entityId = clean(p.get("id") || p.get("entityId"));
  const requestedPlaceId = clean(p.get("placeId"));

  if(type !== "restaurant" && type !== "hotel"){
    throw new Error("Please open this booking page from a valid Hotel or Restaurant.");
  }
  if(!entityId){
    throw new Error("Booking ID is missing. Please open Booking from the selected business.");
  }

  const response = await fetch("data/places.json", {cache:"no-store"});
  if(!response.ok) throw new Error(`Could not load places.json (${response.status}).`);
  const raw = await response.json();
  const places = Array.isArray(raw) ? raw : (Array.isArray(raw.places) ? raw.places : []);
  if(!Array.isArray(places) || !places.length) throw new Error("places.json does not contain valid place data.");

  for(const candidatePlace of places){
    if(requestedPlaceId && clean(candidatePlace.id) !== requestedPlaceId) continue;
    const list = type === "restaurant" ? candidatePlace.restaurants : candidatePlace.hotels;
    if(!Array.isArray(list)) continue;
    const found = list.find(item => idOf(item,type).toLowerCase() === entityId.toLowerCase());
    if(found){ place = candidatePlace; business = found; break; }
  }

  if(!business) throw new Error(`The selected ${type} was not found in places.json.`);

  const name = clean(business.name || business.hotelName || business.restaurantName || "Business");
  contact = phoneOf(business);

  $("entityType").value = type;
  $("entityId").value = idOf(business,type);
  $("entityName").value = name;
  $("selectedName").textContent = name;
  $("selectedType").textContent = type.toUpperCase();
  $("brandName").textContent = name;
  $("brandSub").textContent = type === "restaurant" ? "RESTAURANT BOOKING" : "HOTEL BOOKING";
  $("backText").textContent = type === "restaurant" ? "Back to Restaurant" : "Back to Hotels";
  $("pageTitle").textContent = type === "restaurant" ? "Reserve a Table" : "Book Your Stay";
  $("pageSubtitle").textContent = type === "restaurant"
    ? "Complete your details and send the booking request directly to the restaurant."
    : "Enter your details and send your booking request directly to the hotel.";
  $("introEyebrow").textContent = `${type.toUpperCase()} BOOKING`;
  $("businessContactPreview").textContent = contact || "No contact number in places.json";

  $("restaurantFields").classList.toggle("hidden", type !== "restaurant");
  $("hotelFields").classList.toggle("hidden", type !== "hotel");
  document.body.classList.toggle("restaurant-mode", type === "restaurant");
  document.body.classList.toggle("hotel-mode", type === "hotel");
  document.title = `${name} Booking | Kolkata Tourist Guide`;

  const backUrl = type === "restaurant"
    ? `/restaurant.html?id=${encodeURIComponent(place.id)}`
    : `/hotel.html?id=${encodeURIComponent(place.id)}`;
  $("backLink").href = backUrl;

  if(type === "restaurant"){
    $("rDate").min = today();
  }else{
    $("hCheckin").min = today();
    $("hCheckout").min = today();
    await loadHotelRooms();
  }
}

async function loadHotelRooms(){
  const rooms = Array.isArray(business.rooms)
    ? business.rooms
    : (Array.isArray(business.roomTypes) ? business.roomTypes : []);
  const select = $("roomType");
  select.innerHTML = '<option value="">Select room type</option>';
  rooms.forEach(room => {
    const r = typeof room === "string" ? {name:room} : room;
    const o = document.createElement("option");
    o.value = clean(r.name || r.type);
    o.textContent = `${clean(r.name || r.type || "Room")}${r.price || r.rate ? ` — ${r.price || r.rate}` : ""}`;
    select.appendChild(o);
  });
}

function validate(){
  if(!$("terms").checked){
    showError("Please agree to the Terms & Conditions and Privacy Policy.");
    return false;
  }

  if(type === "restaurant"){
    if(!clean($("rCustomerName").value) || !clean($("rEmail").value) ||
       !clean($("rPhone").value) || !clean($("rNationality").value) ||
       !clean($("rDate").value) || !clean($("rTime").value) || !clean($("rGuests").value)){
      showError("Please complete all required restaurant booking fields.");
      return false;
    }
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean($("rEmail").value))){
      showError("Please enter a valid email address.");
      return false;
    }
    if(digits($("rPhone").value).length < 7){
      showError("Please enter a valid phone number.");
      return false;
    }
  }else{
    if(!clean($("hCustomerName").value) || !clean($("hPhone").value) ||
       !clean($("hCheckin").value) || !clean($("hCheckout").value) || !clean($("hGuests").value)){
      showError("Please complete all required hotel booking fields.");
      return false;
    }
    if(new Date($("hCheckout").value) <= new Date($("hCheckin").value)){
      showError("Check-out date must be after check-in date.");
      return false;
    }
    if(digits($("hPhone").value).length < 10){
      showError("Please enter a valid mobile number.");
      return false;
    }
    if(clean($("hEmail").value) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean($("hEmail").value))){
      showError("Please enter a valid email address.");
      return false;
    }
  }
  return true;
}

function buildData(){
  if(type === "restaurant"){
    return {
      entityType:type, entityName:$("entityName").value, entityId,
      customerName:clean($("rCustomerName").value),
      email:clean($("rEmail").value),
      customerPhone:digits($("rPhone").value),
      countryCode:$("rCountryCode").value,
      nationality:clean($("rNationality").value),
      occasion:clean($("rOccasion").value),
      bookingDate:clean($("rDate").value),
      bookingTime:clean($("rTime").value),
      guests:Number($("rGuests").value),
      tablePreference:clean($("rTable").value),
      seatingArea:clean($("rSeating").value),
      dietaryPreference:clean($("rDiet").value),
      additionalRequests:clean($("rRequests").value),
      placeName:clean(place?.name)
    };
  }

  return {
    entityType:type, entityName:$("entityName").value, entityId,
    customerName:clean($("hCustomerName").value),
    email:clean($("hEmail").value),
    customerPhone:digits($("hPhone").value),
    checkIn:clean($("hCheckin").value),
    checkOut:clean($("hCheckout").value),
    guests:Number($("hGuests").value),
    roomType:clean($("roomType").value),
    specialRequest:clean($("hRequests").value),
    address:clean($("hAddress").value),
    placeName:clean(place?.name)
  };
}

function createBookingId(){
  const prefix = type === "restaurant" ? "REST" : "HOTEL";
  return `KTG-${prefix}-BOOK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,7).toUpperCase()}`;
}

function messageText(data, bookingId){
  const lines = [
    type === "restaurant" ? "🍽️ KTG RESTAURANT TABLE BOOKING" : "🏨 KTG HOTEL BOOKING REQUEST",
    "",
    `Business: ${data.entityName}`,
    `Business ID: ${data.entityId}`,
    `Tourist Place: ${data.placeName || "Kolkata"}`,
    `Booking ID: ${bookingId}`,
    "",
    `Customer: ${data.customerName}`,
    `Phone: ${data.countryCode || "+91"} ${data.customerPhone}`,
    data.email ? `Email: ${data.email}` : "",
    data.nationality ? `Nationality: ${data.nationality}` : "",
    `Guests: ${data.guests}`
  ];

  if(type === "restaurant"){
    lines.push(
      `Date: ${data.bookingDate}`,
      `Time: ${data.bookingTime}`,
      data.occasion ? `Special Occasion: ${data.occasion}` : "",
      data.tablePreference ? `Table Preference: ${data.tablePreference}` : "",
      data.seatingArea ? `Seating Area: ${data.seatingArea}` : "",
      data.dietaryPreference ? `Dietary Preference: ${data.dietaryPreference}` : "",
      data.additionalRequests ? `Additional Requests: ${data.additionalRequests}` : ""
    );
  }else{
    lines.push(
      `Check-in: ${data.checkIn}`,
      `Check-out: ${data.checkOut}`,
      data.roomType ? `Room Type: ${data.roomType}` : "",
      data.specialRequest ? `Special Request: ${data.specialRequest}` : "",
      data.address ? `Guest Address: ${data.address}` : ""
    );
  }

  lines.push("", "Sent from Kolkata Tourist Guide (KTG)");
  return lines.filter(Boolean).join("\n");
}

function openWhatsApp(data, bookingId){
  const number = normalizeWhatsAppNumber(contact);
  if(!number || number.length < 11){
    throw new Error("This business does not have a valid WhatsApp contact number in places.json.");
  }

  const url = `https://wa.me/${number}?text=${encodeURIComponent(messageText(data,bookingId))}`;

  // Same-tab first is more reliable with popup blockers; WhatsApp itself decides
  // whether to open the app or web client.
  window.location.assign(url);
}

$("bookingForm").addEventListener("submit", event => {
  event.preventDefault();
  showError("");

  if(!business){
    showError("Booking business could not be loaded.");
    return;
  }
  if(!validate()) return;

  const data = buildData();
  const bookingId = createBookingId();

  try{
    localStorage.setItem("ktg_last_booking", JSON.stringify({
      ...data, bookingId,
      whatsappNumber:normalizeWhatsAppNumber(contact),
      createdAt:new Date().toISOString()
    }));
  }catch(_){}

  setLoading(true);
  try{
    openWhatsApp(data, bookingId);
  }catch(error){
    setLoading(false);
    showError(error.message || "Could not open WhatsApp.");
  }
});

$("newBookingBtn").addEventListener("click", () => {
  $("successPanel").classList.add("hidden");
  $("bookingForm").classList.remove("hidden");
  $("bookingForm").reset();
  loadBusiness().catch(err => showError(err.message));
});

loadBusiness().catch(error => {
  console.error("Booking load error:", error);
  showError(error.message || "Could not load booking information.");
});
})();
