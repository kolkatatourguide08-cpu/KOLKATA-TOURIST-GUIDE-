"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const state={verified:false,editId:"",entityType:"",entityId:"",entityName:"",placeId:"",entity:null};
  const $=id=>document.getElementById(id);
  const editIdInput=$("editId"), verifyButton=$("verifyButton"), entityTypeInput=$("entityType"), entityIdInput=$("entityId"), entityNameInput=$("entityName"), loadButton=$("loadButton"), entitySection=$("entitySection"), editor=$("mainEditForm"), editorGrid=$("editorGrid"), editorTitle=$("editorTitle"), editorSubtitle=$("editorSubtitle"), editorType=$("editorType"), recordId=$("recordId"), saveButton=$("saveButton"), resetButton=$("resetButton"), logoutBtn=$("logoutBtn"), status=$("statusMessage"), saveMessage=$("saveMessage"), lockButton=$("lockButton"), lockModal=$("lockModal"), cancelLockButton=$("cancelLockButton"), confirmLockButton=$("confirmLockButton");
  const p=new URLSearchParams(location.search);
  const urlType=(p.get("type")||"").trim().toLowerCase();
  const placeId=(p.get("placeId")||"").trim();
  const urlEntityId=(p.get("restaurantId")||p.get("hotelId")||p.get("entityId")||"").trim();
  state.placeId=placeId;

  const esc=v=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
  const clean=v=>String(v??"").trim();
  const cap=v=>{v=clean(v);return v?v[0].toUpperCase()+v.slice(1):""};
  const label=k=>String(k).replace(/([A-Z])/g," $1").replace(/[_-]/g," ").replace(/^\w/,c=>c.toUpperCase()).trim();
  const typeOf=k=>{const s=String(k).toLowerCase();if(s.includes("email"))return"email";if(s.includes("phone")||s.includes("mobile")||s.includes("contact"))return"tel";if(s.includes("date"))return"date";if(s.includes("time"))return"time";if(s.includes("url")||s.includes("website")||s.includes("link")||s.includes("image")||s.includes("photo")||s.includes("maps"))return"url";return"text"};
  function msg(text,type="info",target=status){target.textContent=text;target.className=`status ${type}`;target.hidden=false}
  function loading(btn,on,normal,wait){if(!btn)return;btn.disabled=on;btn.textContent=on?wait:normal}
  function entityId(e){return clean(e?.id||e?.businessId||e?.restaurantId||e?.hotelId||e?.["Restaurant ID"]||e?.["Hotel ID"])}
  function entityName(e){return clean(e?.name||e?.restaurantName||e?.hotelName||e?.title||"Business")}
  function protectedKey(k){const s=String(k).toLowerCase();return s==="id"||s==="businessid"||s==="hotelid"||s==="restaurantid"||s==="editid"||k==="Restaurant ID"||k==="Hotel ID"||k==="Edit ID"||s==="updatedat"}

  const groups=[
    {title:"Basic Information",icon:"▣",keys:["name","description","shortInfo","cuisine","cuisineType","price","priceUnit","averageCost","roomType"]},
    {title:"Location Information",icon:"⌖",keys:["address","location","area","locality","city","state","pincode","postalCode","latitude","longitude","googleMaps","googleMapsLink","metroStation","distance"]},
    {title:"Contact Information",icon:"⌕",keys:["contactNumber","phone","alternatePhone","email","website","officialWebsite","bookingLink"]},
    {title:"Restaurant / Hotel Details",icon:"◉",keys:["hotel","rating","averageRating","reviews","openingTime","closingTime","openingHours","closingDay","closedDay","seatingCapacity","specialties","specialities","highlights"]},
    {title:"Facilities & Services",icon:"✦",keys:["facilities","amenities","services"]},
    {title:"Images & Photos",icon:"▧",keys:["image","images","photo","photos","photo2","photo3","photo4","photo5","photo6"]},
    {title:"Menu / Rooms / Policies",icon:"☷",keys:["menu","rooms","policies","cancellation","payment","children","pets"]}
  ];
  function createControl(key,value){
    let input;
    if(Array.isArray(value)|| (value!==null&&typeof value==="object")){
      input=document.createElement("textarea");input.className="edit-input array-field";input.value=JSON.stringify(value,null,2);input.dataset.type=Array.isArray(value)?"array":"object";
    }else if(typeof value==="boolean"){
      input=document.createElement("select");input.className="edit-input";input.innerHTML='<option value="true">True</option><option value="false">False</option>';input.value=String(value);input.dataset.type="boolean";
    }else{
      input=document.createElement("input");input.className="edit-input";input.type=typeof value==="number"?"number":typeOf(key);input.step=typeof value==="number"?"any":undefined;input.value=clean(value);input.dataset.type=typeof value==="number"?"number":"string";
    }
    input.dataset.field=key;
    if(protectedKey(key)){input.readOnly=input.tagName!=="SELECT";input.classList.add("readonly-field");}
    return input;
  }
  function fieldEl(key,value,wide=false){
    const wrap=document.createElement("div");wrap.className=`field${wide?" wide":""}`;
    const lab=document.createElement("label");lab.textContent=label(key);wrap.appendChild(lab);
    wrap.appendChild(createControl(key,value));
    return wrap;
  }
  function render(entity,type){
    editorGrid.innerHTML="";
    const used=new Set(); const keys=Object.keys(entity||{});
    const allGroups=groups.map(g=>({...g,keys:g.keys.filter(k=>keys.includes(k))})).filter(g=>g.keys.length);
    allGroups.forEach((g,idx)=>{
      const card=document.createElement("section");card.className=`section-card${g.title==="Images & Photos"||g.title==="Menu / Rooms / Policies"?" wide":""}`;
      const head=document.createElement("div");head.className="section-head";head.innerHTML=`<span class="section-icon">${g.icon}</span><div><b>${g.title}</b><small>${idx===0?"Core business information":"Manage this part of the business profile"}</small></div>`;card.appendChild(head);
      const body=document.createElement("div");body.className="section-body";
      g.keys.forEach(k=>{used.add(k);body.appendChild(fieldEl(k,entity[k],k==="description"||Array.isArray(entity[k])||typeof entity[k]==="object"))});card.appendChild(body);editorGrid.appendChild(card);
    });
    const extra=keys.filter(k=>!used.has(k)&&!protectedKey(k));
    if(extra.length){const card=document.createElement("section");card.className="section-card wide";const head=document.createElement("div");head.className="section-head";head.innerHTML='<span class="section-icon">⋯</span><div><b>Additional Information</b><small>Other fields stored with this business</small></div>';card.appendChild(head);const body=document.createElement("div");body.className="section-body";extra.forEach(k=>body.appendChild(fieldEl(k,entity[k],Array.isArray(entity[k])||typeof entity[k]==="object")));card.appendChild(body);editorGrid.appendChild(card)}
    if(entity.image||Array.isArray(entity.images)){const imgs=Array.isArray(entity.images)?entity.images:(entity.image?[entity.image]:[]);const urls=imgs.map(x=>typeof x==="string"?x:x?.image).filter(Boolean).slice(0,6);if(urls.length){const card=document.createElement("section");card.className="section-card wide";const head=document.createElement("div");head.className="section-head";head.innerHTML='<span class="section-icon">▧</span><div><b>Photo Preview</b><small>Preview of current image URLs</small></div>';card.appendChild(head);const body=document.createElement("div");body.className="section-body";const f=document.createElement("div");f.className="field wide";const list=document.createElement("div");list.className="image-list";urls.forEach((u,i)=>{const p=document.createElement("div");p.className="image-preview";p.innerHTML=`<img src="${esc(u)}" alt="Photo ${i+1}" onerror="this.style.opacity=.25"><span>Photo ${i+1}</span>`;list.appendChild(p)});f.appendChild(list);body.appendChild(f);card.appendChild(body);editorGrid.appendChild(card)}}
    editor.hidden=false; saveButton.disabled=false; resetButton.disabled=false;
    editorTitle.textContent=`Edit ${cap(type)}`;editorType.textContent=cap(type).toUpperCase();editorSubtitle.textContent=`${entityName(entity)} • ${entityId(entity)}`;recordId.textContent=entityId(entity);document.title=`KTG — Edit ${cap(type)}`;
  }
  function collect(){const data={};editorGrid.querySelectorAll("[data-field]").forEach(input=>{const k=input.dataset.field;if(protectedKey(k))return;const t=input.dataset.type;if(t==="array"||t==="object"){const raw=input.value.trim();if(!raw){data[k]=t==="array"?[]:{};return}try{data[k]=JSON.parse(raw)}catch(e){throw new Error(`${label(k)} contains invalid JSON.`)}}else if(t==="boolean")data[k]=input.value==="true";else if(t==="number")data[k]=input.value.trim()===""?null:Number(input.value);else data[k]=input.value});return data}
  async function verify(){const editId=clean(editIdInput.value),type=clean(entityTypeInput.value).toLowerCase(),id=clean(entityIdInput.value),name=clean(entityNameInput.value);if(!editId)return msg("Please enter your Edit ID.","warning");if(!["hotel","restaurant"].includes(type))return msg("Please select Hotel or Restaurant first.","warning");if(!id&&!name)return msg("Business ID or Business Name is required.","warning");loading(verifyButton,true,"✓ Verify Edit ID","Verifying...");try{const r=await fetch("/api/admin/verify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({editId,entityType:type,entityId:id,entityName:name,placeId:state.placeId})});const result=await r.json();if(!r.ok||!result.success){state.verified=false;return msg(result.message||"Invalid Edit ID.","error")}state.verified=true;state.editId=editId;state.entityType=result.entityType||type;state.entityId=result.entityId||id;state.placeId=result.placeId||state.placeId;editIdInput.readOnly=true;editIdInput.classList.add("readonly-field");verifyButton.disabled=true;verifyButton.textContent="✓ Verified";loadButton.disabled=false;entitySection.hidden=false;msg("✓ Edit ID verified successfully.","success");await load();}catch(e){console.error(e);msg("Unable to connect to the KTG server.","error")}finally{if(!state.verified)loading(verifyButton,false,"✓ Verify Edit ID","Verifying...")}}
  async function load(){if(!state.verified)return msg("Please verify the Edit ID first.","warning");const type=clean(entityTypeInput.value).toLowerCase(),id=clean(entityIdInput.value),name=clean(entityNameInput.value);loading(loadButton,true,"📂 Load Business","Loading...");try{const r=await fetch("/api/admin/entity",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({editId:state.editId,entityType:type,entityId:id,entityName:name,placeId:state.placeId})});const result=await r.json();if(!r.ok||!result.success){editor.hidden=true;return msg(result.message||"Business could not be loaded.","error")}state.entity=result.entity||result.data;state.entityType=result.entityType||type;state.entityId=result.id||entityId(state.entity);state.entityName=entityName(state.entity);render(state.entity,state.entityType);msg(`✓ ${cap(state.entityType)} loaded successfully.`,"success");setTimeout(()=>editor.scrollIntoView({behavior:"smooth",block:"start"}),100)}catch(e){console.error(e);msg("Unable to connect to the KTG server.","error")}finally{loading(loadButton,false,"📂 Load Business","Loading...")}}
  async function save(e){e.preventDefault();if(!state.verified||!state.entity)return msg("No verified business is currently loaded.","error");let data;try{data=collect()}catch(err){return msg(err.message,"error")}if(data.name!==undefined&&!clean(data.name))return msg("Business name cannot be empty.","warning");loading(saveButton,true,"💾 Save Changes","Saving...");try{const r=await fetch("/api/admin/entity",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({editId:state.editId,entityType:state.entityType,entityId:state.entityId,entityName:state.entityName,placeId:state.placeId,data})});const result=await r.json();if(!r.ok||!result.success)return msg(result.message||"Could not save changes.","error");state.entity=result.entity||result.data;state.entityId=result.id||entityId(state.entity);state.entityName=entityName(state.entity);render(state.entity,state.entityType);msg("✓ Changes saved successfully.","success",saveMessage)}catch(err){console.error(err);msg("Unable to connect to the KTG server while saving.","error")}finally{loading(saveButton,false,"💾 Save Changes","Saving...")}}
  function reset(){if(state.entity){render(state.entity,state.entityType);msg("↶ Current changes were reset.","info")}}
  function lock(){state.verified=false;state.editId="";state.entity=null;editIdInput.value="";editIdInput.readOnly=false;editIdInput.classList.remove("readonly-field");verifyButton.disabled=false;verifyButton.textContent="✓ Verify Edit ID";loadButton.disabled=true;editor.hidden=true;entitySection.hidden=true;editorGrid.innerHTML="";if(urlEntityId){entityIdInput.value=urlEntityId;entityIdInput.readOnly=true}else entityIdInput.value="";msg("🔒 Dashboard locked. Verify the Edit ID again.","info");scrollTo({top:0,behavior:"smooth"})}

  verifyButton.addEventListener("click",verify);loadButton.addEventListener("click",load);editor.addEventListener("submit",save);resetButton.addEventListener("click",reset);logoutBtn.addEventListener("click",()=>{if(lockModal)lockModal.hidden=false});lockButton.addEventListener("click",()=>lockModal.hidden=false);cancelLockButton.addEventListener("click",()=>lockModal.hidden=true);confirmLockButton.addEventListener("click",()=>{lockModal.hidden=true;lock()});lockModal.addEventListener("click",e=>{if(e.target===lockModal)lockModal.hidden=true});
  editIdInput.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();verify()}});entityIdInput.addEventListener("keydown",e=>{if(e.key==="Enter"&&state.verified){e.preventDefault();load()}});
  entityTypeInput.addEventListener("change",()=>{state.entityType=clean(entityTypeInput.value).toLowerCase();if(!urlEntityId){entityIdInput.value="";entityNameInput.value=""}editor.hidden=true});

  if(urlType&&["hotel","restaurant"].includes(urlType))entityTypeInput.value=urlType;
  if(urlEntityId){entityIdInput.value=urlEntityId;entityIdInput.readOnly=true;entityIdInput.classList.add("readonly-field")}
  state.placeId=placeId;
  if(urlEntityId)msg("Business selected from the URL. Enter your Edit ID to open the editor.","info");
  window.KTGEdit={lock,load,verify};
});
