let places = [];
const input = document.getElementById("searchInput");
const grid = document.getElementById("placeGrid");
const modal = document.getElementById("locationModal");
let pendingPlace = null;

async function loadPlaces(){
  places = window.KTGStatic?.getPlaces
    ? await window.KTGStatic.getPlaces()
    : (await Promise.all(Array.from({length:10}, (_,i) =>
        fetch(`data/places-${i+1}.json`).then(r => r.json())
      ))).flat();
  renderPlaces(places);
}
function renderPlaces(list){
  grid.innerHTML = list.map(p => `
    <article class="place-tile" data-id="${p.id}">
      <div class="place-img">${p.image ? `<img src="${p.image}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover">` : p.name}</div>
      <h3>${p.name}</h3>
      <p>${p.metroStation || "Kolkata"}</p>
    </article>`).join("");
  document.querySelectorAll(".place-tile").forEach(el => el.onclick = () => requestLocation(el.dataset.id));
}
function findPlace(){
  const q = input.value.trim().toLowerCase();
  if(!q) return;
  const p = places.find(x => x.name.toLowerCase().includes(q));
  if(!p){ alert("Place not found in the current data."); return; }
  requestLocation(p.id);
}
function requestLocation(id){
  pendingPlace = id;
  modal.classList.remove("hidden");
}
document.getElementById("searchBtn").onclick = findPlace;
input.addEventListener("keydown", e => { if(e.key === "Enter") findPlace(); });
document.getElementById("allowLocationBtn").onclick = () => {
  if(!pendingPlace) return;
  navigator.geolocation.getCurrentPosition(
    pos => {
      sessionStorage.setItem("userLat", pos.coords.latitude);
      sessionStorage.setItem("userLng", pos.coords.longitude);
      location.href = `place.html?id=${encodeURIComponent(pendingPlace)}`;
    },
    () => location.href = `place.html?id=${encodeURIComponent(pendingPlace)}`
  );
};
document.getElementById("continueWithoutLocation").onclick = () => {
  if(pendingPlace) location.href = `place.html?id=${encodeURIComponent(pendingPlace)}`;
};
document.getElementById("themeBtn").onclick = () => {
  document.body.classList.toggle("light");
  localStorage.setItem("theme", document.body.classList.contains("light") ? "light" : "dark");
};
if(localStorage.getItem("theme")==="light") document.body.classList.add("light");
loadPlaces();