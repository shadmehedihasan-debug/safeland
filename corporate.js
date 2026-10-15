(()=>{
const S=LantStore,$=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const me=S.session();
if(!me||me.role!=='corp'){location.replace('index.html');return}
$('#off').textContent=me.name;
const leave=()=>{S.endSession();location.href='index.html#login'};
$('#back').onclick=leave;$('#out').onclick=leave;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* Tabs */
function tab(t){$$('[data-t]').forEach(b=>b.setAttribute('aria-selected',b.dataset.t===t));$$('[data-p]').forEach(p=>p.hidden=p.dataset.p!==t);if(t==='agri')initAgri();if(t==='balu')initRiver()}
$$('[data-t]').forEach(b=>b.onclick=()=>tab(b.dataset.t));tab('lock');

/* 1. Escrow lock engine */
const sel=$('#plotSel'),CLS={ACTIVE_VERIFIED:'b-a',TEMPORARY_ESCROW_LOCK:'b-l',PERMANENT_RECORD_UPDATED:'b-p'};
sel.innerHTML=Object.entries(S.plots()).map(([k,p])=>`<option value="${esc(k)}">${esc(p.place)}</option>`).join('');
const cur=()=>S.plots()[sel.value],locked=()=>cur().state==='TEMPORARY_ESCROW_LOCK';
function say(m,bad){const e=$('#plotMsg');e.textContent=m||'';e.className='msg'+(bad?' bad':'')}
function drawPlot(){
  const p=cur(),l=locked();
  $('#plotInfo').innerHTML=`<p><span class="badge ${CLS[p.state]}">${p.state}</span></p><p>Titleholder: <b>${esc(p.owner)}</b>${l?'<br>Incoming buyer: <b>'+esc(p.buyer)+'</b>':''}</p><p>Safe to lend or buy: <b>${l?'No, the plot is locked':'Yes'}</b></p>`;
  $('#hist').innerHTML=(p.history||[]).slice().reverse().map(h=>`<li>${esc(new Date(h.at).toLocaleString())}: ${esc(h.m)}</li>`).join('')||'<li>No activity yet.</li>';
}
sel.onchange=()=>{say();drawPlot()};
$('#bLock').onclick=()=>{
  if(locked())return say('Blocked: this plot is already under a temporary escrow lock.',1);
  const b=$('#buyer').value.trim();if(!b)return say('Enter the buyer name first.',1);
  S.lockPlot(sel.value,b);$('#buyer').value='';drawPlot();say('Plot locked. A digital notice was sent to the AC (Land) office.');
};
$('#bMut').onclick=()=>{
  if(!locked())return say('Nothing to complete. This plot has no pending deed.',1);
  const b=cur().buyer;S.completeMutation(sel.value);drawPlot();say('e-Mutation complete. The lock is released and '+b+' is the permanent titleholder.');
};
$('#bTry').onclick=()=>locked()?say('Blocked: no new sale, power of attorney or mortgage can start on a locked plot.',1):say('Allowed: the plot is clean and tradeable.');
drawPlot();

/* Map helper (Leaflet): satellite and street layers */
function mkMap(id){
  const el=$('#'+id);
  if(typeof L==='undefined'){el.classList.add('off');el.textContent='The map could not load. Check your internet connection and refresh the page.';return null}
  const m=L.map(id);
  const sat=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:18,attribution:'Tiles &copy; Esri'});
  const st=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'&copy; OpenStreetMap contributors'});
  sat.addTo(m);L.control.layers({'Satellite':sat,'Street map':st}).addTo(m);
  return m}

/* 3. Topsoil scan */
const BD=[[20.6,88.0],[26.7,92.7]];
const ag=[
 {plot:'512',up:'Savar',ll:[23.862,90.272],t:'3 acres of fertile topsoil excavated on Daag #512 in Savar. Illegal brickfield activity suspected!'},
 {plot:'77',up:'Dhamrai',ll:[23.915,90.205],t:'Sand dumped over 1.5 acres of green field on Daag #77 in Dhamrai. Unapproved construction suspected!'},
 {plot:'301',up:'Manikganj',ll:[23.855,90.012],t:'Sudden dry patch of 2 acres on 3-crop land at Daag #301 in Manikganj. Topsoil removal suspected!',done:1}
];
let agMap=null,agMk=[];
const agCol=a=>a.done?'#004d38':'#b42318';
function drawAg(){
  $('#alerts').innerHTML=ag.map((a,i)=>`<div class="alert${a.done?' ok':''}" data-c="${i}"><b>Daag #${a.plot}, ${a.up}</b><p>Warning: ${a.t}</p><p class="sub">Sent to the Upazila Agriculture Officer and AC (Land)</p>${a.done?'<span class="badge b-p">Inspection dispatched</span>':`<button type="button" class="btn sm" data-i="${i}">Dispatch inspection</button>`}</div>`).join('');
  agMk.forEach((m,i)=>m.setStyle({fillColor:agCol(ag[i])}));
}
function initAgri(){
  if(agMap)return agMap.invalidateSize();
  agMap=mkMap('agMap');if(!agMap)return;
  agMap.fitBounds(BD);
  agMk=ag.map((a,i)=>L.circleMarker(a.ll,{radius:10,color:'#fff',weight:2,fillColor:agCol(a),fillOpacity:1}).addTo(agMap).bindTooltip('Daag #'+a.plot+', '+a.up).on('click',()=>{
    const cs=$$('#alerts .alert');cs.forEach((x,k)=>x.classList.toggle('sel',k===i));cs[i].scrollIntoView({block:'nearest',behavior:'smooth'})}));
}
$('#alerts').onclick=e=>{
  const b=e.target.closest('[data-i]');
  if(b){ag[b.dataset.i].done=1;drawAg();return}
  const c=e.target.closest('[data-c]');
  if(c&&agMap){const i=+c.dataset.c;agMap.flyTo(ag[i].ll,13);agMk[i].openTooltip()}
};
$('#agBd').onclick=()=>agMap&&agMap.fitBounds(BD);
$('#agFit').onclick=()=>agMap&&agMap.fitBounds(ag.map(a=>a.ll),{padding:[40,40]});
drawAg();

/* 4. River inspection: boats are simulated on a real map near Meghna Bridge.
   Edit BRIDGE and ZONE below to match the official Balu Mahal survey. */
const BRIDGE=[23.6045,90.6153],NTXT='6 pm to 6 am',NIGHT=[18,6],MARGIN=20;
const ZONE=[[23.632,90.6053],[23.620,90.6083],[23.608,90.6115],[23.608,90.6169],[23.620,90.6137],[23.632,90.6107]];
const O=ZONE[0],KX=102000,KY=111000;
const toM=p=>[(p[1]-O[1])*KX,(p[0]-O[0])*KY],toLL=m=>[O[0]+m[1]/KY,O[1]+m[0]/KX];
const ZM=ZONE.map(toM),CL=[[23.632,90.608],[23.620,90.611],[23.608,90.6142]].map(toM);
const seg=CL.slice(1).map((p,i)=>Math.hypot(p[0]-CL[i][0],p[1]-CL[i][1])),CLL=seg.reduce((x,y)=>x+y,0);
function along(s){let i=0;while(i<seg.length-1&&s>seg[i]){s-=seg[i];i++}const t=Math.min(1,s/seg[i]);return [CL[i][0]+(CL[i+1][0]-CL[i][0])*t,CL[i][1]+(CL[i+1][1]-CL[i][1])*t]}
function sd(m){let inside=false,d=1e9; /* metres from the line: negative inside, positive outside */
  for(let i=0,j=ZM.length-1;i<ZM.length;j=i++){
    const a=ZM[i],b=ZM[j];
    if((a[1]>m[1])!==(b[1]>m[1])&&m[0]<(b[0]-a[0])*(m[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
    const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((m[0]-a[0])*dx+(m[1]-a[1])*dy)/(dx*dx+dy*dy)));
    d=Math.min(d,Math.hypot(m[0]-a[0]-t*dx,m[1]-a[1]-t*dy));
  }
  return inside?-d:d}
const mk=(id,kind,ll,x)=>({id,kind,p:toM(ll),h:toM(ll),v:[0,0],mode:'hold',pump:1,trail:[],sd:-100,st:0,ll,...x});
const boats=[
  mk('BD-07','Dredger',[23.626,90.6095],{}),
  mk('BD-09','Dredger',[23.620,90.6131],{mode:'drift',v:[.5,0]}),
  mk('BD-12','Sand carrier',[23.632,90.608],{pump:0,s:40,dir:1})
];
const COL=['#006a4e','#d98e04','#b42318'],BC=['b-a','b-l','b-x'],LB=['Inside zone','Near boundary','ALERT'],STAT=['New','Acknowledged','Patrol dispatched'];
const alerts=[];let simT=0,nightTest=false,rMap=null,rTimer=null,aid=0,lastSig='',tD=false;
const hour=()=>+new Date().toLocaleString('en-GB',{timeZone:'Asia/Dhaka',hour:'numeric',hour12:false})%24;
const isNight=()=>nightTest||hour()>=NIGHT[0]||hour()<NIGHT[1];
const clk=()=>new Date().toLocaleTimeString('en-GB',{timeZone:'Asia/Dhaka',hour:'2-digit',minute:'2-digit',second:'2-digit'});
const dur=x=>Math.floor(x/60)+' min '+String(Math.floor(x%60)).padStart(2,'0')+' s';
function watch(b,kind,on){
  let a=alerts.find(x=>x.boat===b.id&&x.kind===kind&&!x.end);
  if(on&&!a){a={id:++aid,boat:b.id,what:b.kind,kind,t0:simT,time:clk(),st:0,end:0};alerts.unshift(a);if(alerts.length>12)alerts.length=12}
  if(on){a.ll=b.ll;a.d=b.sd}else if(a)a.end=simT;
}
function step(){
  const dt=+$('#spd').value;simT+=dt;
  boats.forEach((b,i)=>{
    let m;
    if(b.s!==undefined){b.s+=b.dir*.9*dt;if(b.s>CLL-40){b.s=CLL-40;b.dir=-1}if(b.s<40){b.s=40;b.dir=1}m=along(b.s)}
    else{
      if(b.mode==='drift'){b.p[0]+=b.v[0]*dt;b.p[1]+=b.v[1]*dt;if(b.sd>45)b.mode='hold'}
      else if(b.mode==='return'){const dx=b.h[0]-b.p[0],dy=b.h[1]-b.p[1],d=Math.hypot(dx,dy);if(d<3)b.mode='hold';else{const k=Math.min(d,.8*dt)/d;b.p[0]+=dx*k;b.p[1]+=dy*k}}
      m=[b.p[0]+2.5*Math.sin(simT/9+i*2),b.p[1]+2.5*Math.cos(simT/11+i*2)];
    }
    b.g=[m[0]+(Math.random()-.5)*4,m[1]+(Math.random()-.5)*4]; /* GPS wobble of about 2 m */
    b.sd=sd(b.g);b.ll=toLL(b.g);b.trail.push(b.ll);if(b.trail.length>80)b.trail.shift();
    b.st=b.sd>MARGIN?2:b.sd>-MARGIN?1:0;
    watch(b,'boundary',b.st===2);watch(b,'night',!!b.pump&&isNight());
  });
  draw();
}
const detail=a=>`Time ${a.time} (Bangladesh). Position ${a.ll[0].toFixed(5)}, ${a.ll[1].toFixed(5)}.${a.kind==='boundary'?' '+Math.round(a.d)+' m outside the line.':''} ${a.end?'Lasted':'Active for'} ${dur((a.end||simT)-a.t0)}.`;
function draw(){
  if(rMap)boats.forEach(b=>{b.mk.setLatLng(b.ll).setStyle({fillColor:COL[b.st]});b.tr.setLatLngs(b.trail)});
  $('#dredgers').innerHTML=boats.map(b=>`<div class="row"><b>${b.id}</b><span>${b.kind}</span><span class="badge ${BC[b.st]}">${LB[b.st]}</span><span class="sub">${b.sd<0?Math.round(-b.sd)+' m inside':Math.round(b.sd)+' m outside'} the line, ${b.pump?'pump on':'pump off'}</span></div>`).join('');
  $('#clock').textContent='Bangladesh time '+clk()+'. The pump ban ('+NTXT+') is '+(isNight()?'active.':'not active.');
  const sig=alerts.map(a=>a.id+':'+a.st+':'+(a.end?1:0)).join();
  if(sig!==lastSig){
    lastSig=sig;
    $('#bAlerts').innerHTML=alerts.length?alerts.map(a=>`<div class="alert${a.end?' ok':''}"><p><b>${a.kind==='boundary'?`Alert: ${a.what} #${a.boat} crossed outside the Balu Mahal boundary near Meghna Bridge. Illegal dredging in progress!`:`Alert: ${a.what} #${a.boat} is running its pump during banned nighttime hours (${NTXT}).`}</b></p><p class="sub" id="d${a.id}"></p><p class="sub">Sent to the River Police and the Deputy Commissioner (DC)</p><span class="badge ${a.end?'b-a':'b-x'}">${a.end?'Resolved':STAT[a.st]}</span> ${!a.end&&a.st<2?`<button type="button" class="btn sm" data-a="${a.id}">${a.st?'Dispatch patrol':'Acknowledge'}</button>`:''}</div>`).join(''):'<p class="sub">No alerts. All boats are inside the legal zone.</p>';
  }
  alerts.forEach(a=>{const e=$('#d'+a.id);if(e)e.textContent=detail(a)});
}
function initRiver(){
  if(rMap)return rMap.invalidateSize();
  rMap=mkMap('riverMap');
  if(rMap){
    rMap.fitBounds(ZONE,{padding:[30,30]});
    L.polygon(ZONE,{color:'#2ee59d',weight:3,dashArray:'8 6',fillColor:'#2ee59d',fillOpacity:.12}).addTo(rMap).bindTooltip('Legal Balu Mahal zone');
    L.circleMarker(BRIDGE,{radius:6,color:'#fff',weight:2,fillColor:'#14201b',fillOpacity:1}).addTo(rMap).bindTooltip('Meghna Bridge',{permanent:true,direction:'right',offset:[8,0]});
    boats.forEach(b=>{
      b.mk=L.circleMarker(b.ll,{radius:8,color:'#fff',weight:2,fillColor:COL[0],fillOpacity:1}).addTo(rMap).bindTooltip(b.id,{permanent:true,direction:'right',offset:[8,0]});
      b.tr=L.polyline([],{color:'#f2b134',weight:2,opacity:.9}).addTo(rMap);
    });
  }
  if(!rTimer){step();rTimer=setInterval(step,1000)}
}
$('#bAlerts').onclick=e=>{
  const b=e.target.closest('[data-a]');if(!b)return;
  const a=alerts.find(x=>x.id==b.dataset.a),bt=boats.find(x=>x.id===a.boat);
  a.st++;
  if(a.st===2){if(a.kind==='boundary')bt.mode='return';else bt.pump=0}
  lastSig='';draw();
};
$('#tDrift').onclick=e=>{tD=!tD;const b=boats[0];if(tD){b.mode='drift';b.v=[1.5,0]}else b.mode='return';e.target.textContent=tD?'Test: bring BD-07 back':'Test: BD-07 drifts to the bank'};
$('#tNight').onclick=e=>{nightTest=!nightTest;e.target.textContent=nightTest?'Test: back to real time of day':'Test: simulate night'};
})();
