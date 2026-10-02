"use strict";

const socket = (typeof io === "function")
  ? io({reconnection:true,reconnectionAttempts:8,timeout:8000})
  : createOfflineChatSocket();

function createOfflineChatSocket(){
  const handlers=new Map();
  const offlineId="local-"+Math.random().toString(36).slice(2,10);
  return {
    id:offlineId, connected:true,
    on(event,fn){ if(!handlers.has(event)) handlers.set(event,[]); handlers.get(event).push(fn); return this; },
    emit(event,payload){
      const key="ktg-offline-chat-"+(payload?.groupId||"group");
      if(event==="joinGroup"){
        const saved=JSON.parse(localStorage.getItem(key)||"[]");
        (handlers.get("groupState")||[]).forEach(fn=>fn({members:[{id:offlineId,name:payload.name}],locations:[],messages:saved}));
      } else if(event==="chatMessage"){
        const saved=JSON.parse(localStorage.getItem(key)||"[]");
        const message={messageId:"local-"+Date.now()+"-"+Math.random().toString(36).slice(2,7),senderId:offlineId,id:offlineId,name:payload.name||"Member",text:String(payload.text||""),replyTo:payload.replyTo||null,createdAt:Date.now()};
        saved.push(message); localStorage.setItem(key,JSON.stringify(saved.slice(-200)));
        (handlers.get("chatMessage")||[]).forEach(fn=>fn(message));
      }
      return this;
    }
  };
}

const params = new URLSearchParams(location.search);
const place = params.get("place") || params.get("id") || "group";
const groupId = `place-${place}`;

const $ = id => document.getElementById(id);
const members = new Map();
const locations = new Map();
const messages = new Map();
let myName = "";
let replyingTo = null;
let watchId = null;
let map = null;
const mapMarkers = new Map();

function escapeHtml(value){
  return String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[ch]));
}
function initials(name){
  return String(name||"?").trim().split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase() || "?";
}
function timeLabel(ts){
  const d = new Date(ts || Date.now());
  return d.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"});
}
function openChat(){
  $("nameGate").style.display="none";
  $("nameInput").blur();
  try { requestLocation(); } catch(e) {}
  socket.emit("joinGroup", {groupId, name:myName});
}
function updateMembers(){
  const list=[...members.values()];
  $("members").innerHTML = list.map(m=>{
    const mine = m.id === socket.id;
    return `<div class="member">
      <div class="member-avatar">${escapeHtml(initials(m.name))}</div>
      <div class="member-info">
        <span class="member-name">${escapeHtml(m.name)}${mine?" (you)":""}</span>
        <span class="member-status"><i class="online-dot"></i> Online</span>
      </div>
    </div>`;
  }).join("");
}
function addSystem(text){
  const el=document.createElement("div"); el.className="system"; el.textContent=text; $("messages").appendChild(el); scrollBottom();
}
function renderMessage(m){
  messages.set(m.messageId || `${m.id}-${m.createdAt}`, m);
  const existing=document.querySelector(`[data-message-id="${CSS.escape(m.messageId || "")}"]`);
  if(existing) return;
  const mine=m.senderId===socket.id;
  const row=document.createElement("div");
  row.className=`message-row ${mine?"mine":""}`;
  row.dataset.messageId=m.messageId || "";
  const quoted = m.replyTo ? `<div class="quoted"><b>${escapeHtml(m.replyTo.name)}</b><div>${escapeHtml(m.replyTo.text)}</div></div>` : "";
  const avatar=mine?"":`<div class="avatar">${escapeHtml(initials(m.name))}</div>`;
  row.innerHTML=`${avatar}<div class="bubble"><strong>${escapeHtml(m.name)}</strong>${quoted}<div class="bubble-text">${escapeHtml(m.text)}</div><span class="meta">${timeLabel(m.createdAt)}</span><button class="reply-btn" type="button" data-reply="${escapeHtml(m.messageId||"")}">↩ Reply</button></div>`;
  $("messages").appendChild(row); scrollBottom();
}
function scrollBottom(){const box=$("messages"); box.scrollTop=box.scrollHeight;}
function setReply(m){
  replyingTo=m;
  $("replyBar").hidden=false;
  $("replyName").textContent=m.name;
  $("replyText").textContent=m.text;
  $("messageInput").focus();
}
function clearReply(){replyingTo=null;$("replyBar").hidden=true;$("replyName").textContent="";$("replyText").textContent="";}

function requestLocation(){
  if(!navigator.geolocation){
    $("trackStatus").textContent="This browser does not support live location.";
    addSystem("Live location is not supported by this browser.");
    return;
  }
  $("trackStatus").textContent="Requesting your device location…";
  watchId=navigator.geolocation.watchPosition(pos=>{
    const payload={groupId,name:myName,lat:pos.coords.latitude,lng:pos.coords.longitude,accuracy:pos.coords.accuracy||null,timestamp:Date.now()};
    locations.set(socket.id,{...payload,id:socket.id});
    socket.emit("locationUpdate",payload);
    $("trackStatus").textContent="Your live location is being shared with the group.";
    $("myLocationText").textContent=`${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`;
    updateMapMarker({...payload,id:socket.id}, true);
  }, err=>{
    $("trackStatus").textContent = err.code===1 ? "Location permission was not granted." : "Could not read your live location.";
    $("myLocationText").textContent="Location not shared";
  }, {enableHighAccuracy:true,maximumAge:3000,timeout:15000});
}
function ensureMap(){
  if(map) return;
  map=L.map("liveMap",{zoomControl:true}).setView([22.5726,88.3639],12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"© OpenStreetMap contributors"}).addTo(map);
}
function updateMapMarker(m,isMe=false){
  if(!map) return;
  const pos=[m.lat,m.lng];
  let marker=mapMarkers.get(m.id);
  if(!marker){
    marker=L.marker(pos).addTo(map); mapMarkers.set(m.id,marker);
  } else marker.setLatLng(pos);
  marker.bindPopup(`<b>${escapeHtml(m.name||"Member")}${isMe?" (You)":""}</b><br>Live location`).openPopup();
  renderLocationRows();
}
function renderLocationRows(){
  const rows=[...locations.values()];
  $("otherLocationRows").innerHTML=rows.filter(x=>x.id!==socket.id).map(x=>`<div class="location-member"><span class="dot"></span><b>${escapeHtml(x.name)}</b><span>${Number(x.lat).toFixed(5)}, ${Number(x.lng).toFixed(5)}</span></div>`).join("");
}
function openTrack(){
  $("trackDrawer").classList.add("open"); $("trackDrawer").setAttribute("aria-hidden","false"); ensureMap(); setTimeout(()=>map.invalidateSize(),80);
  if(locations.size){const arr=[...locations.values()]; arr.forEach(x=>updateMapMarker(x,x.id===socket.id)); const bounds=L.latLngBounds(arr.map(x=>[x.lat,x.lng])); if(bounds.isValid()) map.fitBounds(bounds.pad(.25));}
}
function closeTrack(){$("trackDrawer").classList.remove("open");$("trackDrawer").setAttribute("aria-hidden","true");}

function setupTheme(){
  const saved=localStorage.getItem("ktg-chat-theme");
  if(saved === "dark") document.body.classList.add("dark");
  updateThemeButton();
  const btn=$("themeBtn");
  if(btn) btn.onclick=()=>{
    document.body.classList.toggle("dark");
    localStorage.setItem("ktg-chat-theme", document.body.classList.contains("dark")?"dark":"light");
    updateThemeButton();
    if(map) setTimeout(()=>map.invalidateSize(),60);
  };
}
function updateThemeButton(){
  const btn=$("themeBtn");
  if(btn) btn.textContent=document.body.classList.contains("dark")?"☼":"☾";
}

$("groupTitle").textContent=place.replaceAll("-"," ");
setupTheme();
$("backBtn").onclick=()=>history.back();
$("trackBtn").onclick=openTrack;
$("closeTrack").onclick=closeTrack;
$("trackDrawer").addEventListener("click",e=>{if(e.target===$("trackDrawer"))closeTrack();});
$("cancelReply").onclick=clearReply;
$("messages").addEventListener("click",e=>{
  const btn=e.target.closest("[data-reply]"); if(!btn)return;
  const m=messages.get(btn.dataset.reply); if(m)setReply(m);
});
$("messageForm").addEventListener("submit",e=>{
  e.preventDefault();
  const input=$("messageInput"); const text=input.value.trim(); if(!text)return;
  socket.emit("chatMessage",{groupId,name:myName,text,replyTo:replyingTo?{messageId:replyingTo.messageId,name:replyingTo.name,text:replyingTo.text}:null});
  input.value=""; clearReply();
});
$("joinBtn").onclick=()=>{
  const value=$("nameInput").value.trim();
  if(value.length<2){$("nameInput").focus();return;}
  myName=value.slice(0,60); sessionStorage.setItem("chatName",myName); openChat();
};
$("nameInput").addEventListener("keydown",e=>{if(e.key==="Enter")$("joinBtn").click();});

socket.on("groupState",state=>{
  (state.members||[]).forEach(m=>members.set(m.id,m));
  (state.locations||[]).forEach(m=>locations.set(m.id,m));
  (state.messages||[]).forEach(renderMessage);
  updateMembers(); renderLocationRows();
  if(map) [...locations.values()].forEach(x=>updateMapMarker(x,x.id===socket.id));
});
socket.on("memberJoined",m=>{members.set(m.id,m);updateMembers();if(m.id!==socket.id)addSystem(`${m.name} joined the chat.`);});
socket.on("memberLeft",m=>{members.delete(m.id);locations.delete(m.id);const marker=mapMarkers.get(m.id);if(marker&&map)map.removeLayer(marker);mapMarkers.delete(m.id);updateMembers();renderLocationRows();addSystem(`${m.name} left the chat.`);});
socket.on("chatMessage",renderMessage);
socket.on("locationUpdate",m=>{if(!m||m.groupId!==groupId||!m.id)return;locations.set(m.id,m);renderLocationRows();if(map)updateMapMarker(m,m.id===socket.id);});
socket.on("connect",()=>{if(myName)socket.emit("joinGroup",{groupId,name:myName});});
socket.on("disconnect",()=>{ /* reconnect handled automatically by Socket.IO */ });

const stored=sessionStorage.getItem("chatName");
// Always ask on entry as requested. A stored name is offered as a convenient default only.
if(stored)$("nameInput").value=stored;
$("nameInput").focus();
