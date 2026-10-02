const socket=io();
const params=new URLSearchParams(location.search);
const groupId=params.get("group")||"group";
const name=sessionStorage.getItem("chatName");
const markers=document.getElementById("markers");
const positions=new Map();

function addMarker(m){
  positions.set(m.id,m);
  renderMarkers();
}
function renderMarkers(){
  markers.innerHTML="";
  [...positions.values()].forEach((m,i)=>{
    const el=document.createElement("div");
    el.className="marker";
    el.style.left=(30+(i*23)%55)+"%";
    el.style.top=(35+(i*17)%45)+"%";
    el.innerHTML=`<div class="pin"></div><div class="marker-label">${escapeHtml(m.name)}</div>`;
    markers.appendChild(el);
  });
}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));}
socket.emit("joinGroup",{groupId,name});
socket.on("locationUpdate",addMarker);

if(navigator.geolocation){
  navigator.geolocation.watchPosition(pos=>{
    socket.emit("locationUpdate",{groupId,name,lat:pos.coords.latitude,lng:pos.coords.longitude});
    document.getElementById("locationStatus").textContent="Your live location is being shared with this group.";
  },()=>{
    document.getElementById("locationStatus").textContent="Location permission was not granted.";
  },{enableHighAccuracy:true,maximumAge:5000,timeout:10000});
}else{
  document.getElementById("locationStatus").textContent="This browser does not support location.";
}