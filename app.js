const KEY = "croissant_store_records_v1";
const SETTINGS_KEY = "croissant_store_settings_v1";
const DEFAULTS = { factoryName: "سجل المصنع", boxSize: 40 };

let records = loadRecords();
let settings = loadSettings();

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

function loadRecords(){ try{return JSON.parse(localStorage.getItem(KEY)||"[]")}catch{return[]}}
function saveRecords(){localStorage.setItem(KEY,JSON.stringify(records))}
function loadSettings(){try{return {...DEFAULTS,...JSON.parse(localStorage.getItem(SETTINGS_KEY)||"{}")}}catch{return{...DEFAULTS}}}
function saveSettings(){localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings))}
function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function dateKey(d=new Date()){const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0");return `${y}-${m}-${day}`}
function fmtDate(iso){return new Intl.DateTimeFormat("ar-LB",{year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(iso))}
function fmtTime(iso){return new Intl.DateTimeFormat("ar-LB",{hour:"2-digit",minute:"2-digit"}).format(new Date(iso))}
function money(v){return v===""||v==null?"":Number(v).toLocaleString("en-US",{maximumFractionDigits:2})}
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2200)}

function navigate(view){
  $$(".view").forEach(v=>v.classList.toggle("active",v.id===`view-${view}`));
  $$(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.nav===view));
  if(view==="home") renderHome();
  if(view==="records") renderRecords();
  if(view==="reports") renderReportPreview();
  if(view==="settings") loadSettingsForm();
  window.scrollTo({top:0,behavior:"smooth"});
}
$$("[data-nav]").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.nav)));

function partialValues(){
  return $$("#partials input").map(i=>Math.max(0,Number(i.value)||0));
}
function calculateTotal(){
  const full=Math.max(0,Number($("#fullBoxes").value)||0);
  const partial=partialValues().reduce((a,b)=>a+b,0);
  const total=full*Number(settings.boxSize)+partial;
  $("#totalPieces").textContent=total.toLocaleString("ar-LB");
  return {full,partial,total};
}
function addPartial(value=""){
  const row=document.createElement("div");row.className="partial-row";
  row.innerHTML=`<input type="number" min="1" max="${settings.boxSize-1}" step="1" inputmode="numeric" placeholder="عدد الحبات في الصندوق الناقص" value="${esc(value)}"><button type="button" class="remove-partial" aria-label="حذف">×</button>`;
  row.querySelector("input").addEventListener("input",calculateTotal);
  row.querySelector(".remove-partial").addEventListener("click",()=>{row.remove();calculateTotal()});
  $("#partials").appendChild(row);
  row.querySelector("input").focus();
}
$("#addPartialBtn").addEventListener("click",()=>addPartial());
$("#fullBoxes").addEventListener("input",calculateTotal);

$$('input[name="type"]').forEach(r=>r.addEventListener("change",()=>{
  const hall=$('input[name="type"]:checked').value==="hall";
  $("#nameLabel").textContent=hall?"اسم الصالة":"اسم الزبون";
  $("#partyName").placeholder=hall?"مثلاً: صالة البيع":"مثلاً: آدم";
  $("#paymentSection").style.display=hall?"none":"block";
}));
$$('input[name="payment"]').forEach(r=>r.addEventListener("change",()=>{
  $("#amountField").style.display=$('input[name="payment"]:checked').value==="unpaid"?"none":"block";
}));

$("#recordForm").addEventListener("submit",(e)=>{
  e.preventDefault();
  const type=$('input[name="type"]:checked').value;
  const partyName=$("#partyName").value.trim();
  if(!partyName){toast("أدخل اسم الجهة");return}
  const calc=calculateTotal();
  if(calc.total<=0){toast("أدخل كمية المنتجات");return}
  const partials=partialValues().filter(v=>v>0);
  if(partials.some(v=>v>=settings.boxSize)){toast(`الصندوق الناقص يجب أن يكون أقل من ${settings.boxSize} حبة`);return}
  const payment=type==="customer"?$('input[name="payment"]:checked').value:null;
  const amount=type==="customer"&&payment!=="unpaid"?$("#amount").value:"";
  records.unshift({id:crypto.randomUUID(),createdAt:new Date().toISOString(),type,partyName,fullBoxes:calc.full,partials,total:calc.total,payment,amount,notes:$("#notes").value.trim()});
  saveRecords();
  toast("تم حفظ العملية");
  resetForm();
  navigate("home");
});

function resetForm(){
  $("#recordForm").reset();$("#partials").innerHTML="";$("#fullBoxes").value=0;$("#amount").value="";$("#notes").value="";
  $('input[name="type"][value="customer"]').checked=true;
  $("#nameLabel").textContent="اسم الزبون";$("#partyName").placeholder="مثلاً: آدم";$("#paymentSection").style.display="block";$("#amountField").style.display="block";calculateTotal();
}

function detailsText(r){
  const full=r.fullBoxes?`${r.fullBoxes} × ${settings.boxSize}`:"";
  const partial=r.partials.length?r.partials.map(v=>`${v}`).join(" + "):"";
  return [full,partial].filter(Boolean).join(" + ") || "—";
}
function paymentText(p){return p==="cash"?"نقداً":p==="whish"?"Whish Money":p==="unpaid"?"غير مدفوع":"—"}

function card(r){
  return `<article class="record-card">
    <div class="record-top">
      <div><div class="record-name">${esc(r.partyName)} <span class="pill">${r.type==="customer"?"زبون":"صالة"}</span></div>
      <div class="record-meta">${fmtDate(r.createdAt)} · ${fmtTime(r.createdAt)}</div></div>
      <div class="record-total">${r.total.toLocaleString("ar-LB")} حبة</div>
    </div>
    <div class="record-details">
      <div><b>الكمية:</b> ${esc(detailsText(r))}</div>
      ${r.type==="customer"?`<div><b>الدفع:</b> ${paymentText(r.payment)}${r.amount?` · ${money(r.amount)}`:""}</div>`:""}
      ${r.notes?`<div><b>ملاحظات:</b> ${esc(r.notes)}</div>`:""}
      <button type="button" class="delete-record" data-delete-id="${esc(r.id)}">حذف العملية</button>
    </div>
  </article>`
}
function renderHome(){
  const today=dateKey();
  const list=records.filter(r=>r.createdAt.slice(0,10)===today);
  $("#todayLabel").textContent=new Intl.DateTimeFormat("ar-LB",{weekday:"long",day:"numeric",month:"long"}).format(new Date());
  $("#todayTotal").textContent=list.reduce((s,r)=>s+r.total,0).toLocaleString("ar-LB");
  $("#todayCount").textContent=list.length.toLocaleString("ar-LB");
  $("#todayCustomers").textContent=list.filter(r=>r.type==="customer").length.toLocaleString("ar-LB");
  $("#todayHalls").textContent=list.filter(r=>r.type==="hall").length.toLocaleString("ar-LB");
  $("#recentRecords").innerHTML=list.slice(0,5).map(card).join("")||`<div class="empty">لا توجد عمليات اليوم.</div>`;
}
function renderRecords(){
  const q=$("#searchInput").value.trim().toLowerCase(), type=$("#typeFilter").value, date=$("#dateFilter").value;
  const list=records.filter(r=>(!q||r.partyName.toLowerCase().includes(q)||r.notes.toLowerCase().includes(q))&&(type==="all"||r.type===type)&&(!date||r.createdAt.slice(0,10)===date));
  $("#recordsList").innerHTML=list.map(card).join("")||`<div class="empty">لا توجد نتائج.</div>`;
}
["searchInput","typeFilter","dateFilter"].forEach(id=>$( "#"+id).addEventListener(id==="searchInput"?"input":"change",renderRecords));

document.addEventListener("click",(e)=>{
  const btn=e.target.closest("[data-delete-id]");
  if(!btn) return;
  const record=records.find(r=>r.id===btn.dataset.deleteId);
  if(!record) return;
  if(confirm(`حذف عملية ${record.partyName} — ${record.total} حبة؟\\n\\nلا يمكن التراجع عن هذا الحذف.`)){
    records=records.filter(r=>r.id!==record.id);
    saveRecords();
    renderHome();
    renderRecords();
    renderReportPreview();
    toast("تم حذف العملية");
  }
});

function renderReportPreview(){
  const from=$("#fromDate").value,to=$("#toDate").value,type=$("#reportType").value;
  let list=filteredReport(from,to,type);
  const total=list.reduce((s,r)=>s+r.total,0);
  $("#reportPreview").innerHTML=`
    <h3>${esc(settings.factoryName)}</h3>
    <div class="record-meta">${from||"—"} إلى ${to||"—"} · ${type==="all"?"كل العمليات":type==="customer"?"الزبائن":"الصالات"}</div>
    <table class="report-table"><thead><tr><th>التاريخ</th><th>الجهة</th><th>النوع</th><th>الكمية</th><th>الدفع</th></tr></thead>
    <tbody>${list.map(r=>`<tr><td>${fmtDate(r.createdAt)}</td><td>${esc(r.partyName)}</td><td>${r.type==="customer"?"زبون":"صالة"}</td><td>${r.total}</td><td>${r.type==="customer"?paymentText(r.payment):"—"}</td></tr>`).join("")||`<tr><td colspan="5">لا توجد عمليات.</td></tr>`}</tbody></table>
    <div class="report-summary">إجمالي العمليات: ${list.length} · إجمالي الحبات: ${total.toLocaleString("ar-LB")}</div>`;
}
function filteredReport(from,to,type){
  return records.filter(r=>(!from||r.createdAt.slice(0,10)>=from)&&(!to||r.createdAt.slice(0,10)<=to)&&(type==="all"||r.type===type));
}
$("#fromDate").value=dateKey(new Date(Date.now()-30*86400000));$("#toDate").value=dateKey();
["fromDate","toDate","reportType"].forEach(id=>$("#"+id).addEventListener("change",renderReportPreview));

$("#printReport").addEventListener("click",()=>{
  renderReportPreview();
  setTimeout(()=>window.print(),100);
});

function loadSettingsForm(){$("#factoryName").value=settings.factoryName;$("#defaultBoxSize").value=settings.boxSize}
$("#saveSettings").addEventListener("click",()=>{
  const box=Math.max(1,Number($("#defaultBoxSize").value)||40);
  settings={factoryName:$("#factoryName").value.trim()||"سجل المصنع",boxSize:box};saveSettings();toast("تم حفظ الإعدادات");calculateTotal();renderHome();
});
$("#clearData").addEventListener("click",()=>{
  if(confirm("هل أنت متأكد؟ سيتم حذف جميع العمليات نهائياً من هذا الجهاز.")){records=[];saveRecords();renderHome();renderRecords();toast("تم حذف العمليات")}
});

window.addEventListener("beforeinstallprompt",(e)=>{e.preventDefault();window.deferredPrompt=e;$("#installBtn").hidden=false});
$("#installBtn").addEventListener("click",async()=>{if(window.deferredPrompt){window.deferredPrompt.prompt();await window.deferredPrompt.userChoice;window.deferredPrompt=null;$("#installBtn").hidden=true}});

if("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("./sw.js").catch(()=>{});
loadSettingsForm();calculateTotal();renderHome();
