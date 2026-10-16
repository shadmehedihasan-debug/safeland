(async()=>{
const S=LantStore,$=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const TR=SafeLang.tr,PL=SafeLang.place;
const me=S.session();
if(!me||me.role!=='user'){location.replace('index.html');return}
await S.load();
$('#who').textContent=TR('Verified: {0} | NID: {1}',me.name,me.id);
const leave=()=>{S.endSession();location.href='index.html#login'};
$('#back').onclick=leave;$('#out').onclick=leave;
$('#menu').onclick=()=>{const o=$('#side').classList.toggle('open');$('#menu').setAttribute('aria-expanded',o)};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mask=p=>'*'.repeat(Math.max(p.length-3,0))+p.slice(-3);
const say=(id,m,bad)=>{const e=$(id);e.textContent=m||'';e.className='msg'+(bad?' bad':'')};
const num=n=>n.toLocaleString('en-IN',{maximumFractionDigits:2});
const now=()=>new Date().toLocaleString('en-GB',{timeZone:'Asia/Dhaka'});
const tab=t=>{
  $$('#side [data-t]').forEach(b=>b.setAttribute('aria-current',b.dataset.t===t));
  $$('[data-p]').forEach(p=>p.hidden=p.dataset.p!==t);
  $('#side').classList.remove('open');scrollTo(0,0);
};
$$('#side [data-t]').forEach(b=>b.onclick=()=>tab(b.dataset.t));
tab('vault');

/* 1. My Land Vault */
const CEIL=60*33; /* 60 bighas, counted as 33 decimals per bigha */
const gl=[];
function drawVault(){
  const L=S.lands(me.id),tot=L.reduce((a,p)=>a+p.area,0),on=S.guard(me.id),pct=tot/CEIL*100;
  $('#vTitle').textContent=TR('My registered land portfolio')+' ('+(L.length===1?TR('1 parcel detected'):TR('{0} parcels detected',L.length))+')';
  $('#parcels').innerHTML=L.map(p=>`<div class="row"><b>${esc(PL(p.place))}${p.khatian?' ('+TR('Khatian')+' '+esc(p.khatian)+')':''}</b><span>${p.area} ${TR('Shotok')}</span><span class="badge ${on?'b-a':'b-x'}">${on?TR('Protected'):TR('Guard off')}</span><span class="sub">${TR('Tax:')} ${TR(p.tax)}</span></div>`).join('');
  $('#total').textContent=tot.toFixed(1)+' '+TR('Shotok')+' ('+(tot/100).toFixed(3)+' '+TR('acres')+')';
  $('#bar').style.width=Math.min(100,pct)+'%';
  $('#pct').textContent=pct.toFixed(2)+'% '+TR('of the statutory ceiling');
  $('#guard').checked=on;
  $('#gTxt').textContent=on?TR('On: you get an SMS and a call if anyone starts an e-Mutation on your land.'):TR('Off: you will not be alerted.');
  $('#gLog').innerHTML=gl.map(t=>`<div class="alert">${t}</div>`).join('');
}
$('#guard').onchange=e=>{S.setGuard(me.id,e.target.checked);drawVault()};
$('#gTest').onclick=()=>{
  if(!S.guard(me.id))return say('#gTxt',TR('Turn the guard on first.'),1);
  const L=S.lands(me.id),p=L[Math.floor(Math.random()*L.length)];
  gl.unshift(`<b>${now()}</b><br>${TR('Someone has started an e-Mutation application on {0}. An SMS and a call were sent to {1}. If this is not you, contact the AC (Land) office.',esc(PL(p.place)),mask(me.phone||''))}`);
  S.log('guard alert',me.id,true);drawVault();
};
/* Link another parcel: goes under verification, then is added only if it matches the land records.
   Every request waits 10 to 60 seconds before it is checked, and the page says the result
   will be available within 24 hours. */
const WAIT=[10000,60000];
let pend=S.pending(me.id);
function drawVer(){
  $('#verif').innerHTML=pend.length?pend.map(it=>{const q=it.q;return`<div class="row"><b>${TR('Plot')} #${esc(q.daag)}, ${esc(q.mouza)}, ${esc(q.upazila)} (${TR('Khatian')} ${esc(q.khatian)})</b><span class="badge b-l">${TR('Checking')}</span><span class="sub">${TR('Result will be available within 24 hours.')}</span></div>`}).join(''):`<p class="sub">${TR('Nothing is waiting for verification.')}</p>`;
}
async function settle(it){
  let r=null;
  try{r=await S.verifyParcel(me.id,it.q)}catch(x){}
  if(!r){say('#lMsg',TR('Could not reach the database. We will try again shortly.'),1);setTimeout(()=>settle(it),30000);return}
  S.removePending(me.id,it.id);pend=S.pending(me.id);drawVer();
  if(r.result==='verified'){say('#lMsg',TR('Verified. The parcel was added to your vault.'));drawVault()}
  else if(r.result==='linked')say('#lMsg',TR('This parcel is already in your vault.'));
  else say('#lMsg',TR('Access denied. These details do not match the land records for your NID. The parcel was not added.'),1);
}
const schedule=it=>setTimeout(()=>settle(it),Math.max(0,it.at-Date.now()));
$('#fLand').onsubmit=e=>{e.preventDefault();
  const g=i=>$(i).value.trim(),q={district:g('#lD'),upazila:g('#lU'),mouza:g('#lM'),daag:g('#lDaag'),khatian:g('#lK')};
  if(Object.values(q).some(x=>!x))return say('#lMsg',TR('Fill in every field.'),1);
  const it={id:Date.now()+'-'+Math.random().toString(36).slice(2,6),q,at:Date.now()+WAIT[0]+Math.random()*(WAIT[1]-WAIT[0])};
  S.addPending(me.id,it);pend=S.pending(me.id);
  e.target.reset();drawVer();
  say('#lMsg',TR('Request received. The result will be available within 24 hours.'));
  schedule(it);
};
drawVer();pend.slice().forEach(schedule);
drawVault();

/* 2. Land Check (sample result: no real land records are connected) */
const hs=s=>{let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0};
$('#fCheck').onsubmit=e=>{e.preventDefault();
  const v=['cD','cU','cM','cDaag','cK'].map(i=>$('#'+i).value.trim());
  if(v.some(x=>!x))return say('#cMsg',TR('Fill in all five fields.'),1);
  say('#cMsg','');
  const known=S.plots()[v[3].replace(/\D/g,'')],h=hs(v.join('|').toLowerCase());
  let own=0,lock=0,lit=0,zone=0;
  if(known)lock=known.state==='TEMPORARY_ESCROW_LOCK'?1:0;
  else{own=h%7===0?1:0;lock=h%11===3?1:0;lit=h%9===4?1:0;const z=(h>>>5)%8;zone=z<3?z+1:0}
  const score=100-30*own-35*lock-25*lit-25*(zone?1:0),r=score>=80?['s-g','Safe']:score>=50?['s-y','Caution']:['s-r','High Risk'];
  const rows=[
    [TR('Ownership continuity'),!own,own?TR('Gap found in the chain between the {0} survey records.',TR(['CS and SA','SA and RS','RS and BS'][(h>>>3)%3])):TR('Unbroken chain across the CS, SA, RS and BS surveys.')],
    [TR('Sub-registry lock status'),!lock,lock?TR('Active transfer escrow lock. A deed is in progress and the plot is frozen for up to 20 days.'):TR('No active 20-day transfer escrow.')],
    [TR('Litigation and injunctions'),!lit,lit?TR('A civil court stay order or caveat is registered on this plot.'):TR('No registered stay orders or caveats.')],
    [TR('Zoning compliance'),!zone,zone?TR(['Inside a gazetted highway reserve.','Inside a flood flow zone.','Inside a railway buffer.'][zone-1]):TR('Outside highway reserves, flood flow zones and railway buffers.')]
  ];
  $('#cRes').innerHTML=`<div class="score ${r[0]}"><b>${score}</b><span>${TR('/ 100')}</span><em>${TR(r[1])}</em></div>`+
    rows.map(x=>`<div class="row"><b>${x[0]}</b><span class="badge ${x[1]?'b-a':'b-x'}">${x[1]?TR('Pass'):TR('Fail')}</span><span class="sub">${x[2]}</span></div>`).join('')+
    `<p class="sub">${TR('Sample result for this demo. Confirm with the land office and a lawyer before you buy.')}</p>`;
};

/* 3. Tax and Fee Calculator. Edit RATES if the official rates change. */
const RATES={stamp:1.5,reg:1,lg:2};
$('#fFee').onsubmit=e=>{e.preventDefault();
  const up=$('#fU').value.trim(),area=+$('#fA').value,kat=$('#fUn').value==='katha',val=+$('#fV').value,ait=+($('#fAit').value||0);
  if(!up||!(area>0)||!(val>0)||ait<0)return say('#fMsg',TR('Enter the upazila, a land area and a deed value greater than zero.'),1);
  say('#fMsg','');
  const dec=kat?area*1.65:area,k=kat?area:area/1.65;
  const mut=[[TR('Court fee'),20],[TR('Notice fee'),50],[TR('Record amendment'),1000],[TR('Khatian copy'),100]],mt=mut.reduce((a,x)=>a+x[1],0);
  const rg=[[TR('Stamp duty ({0}%)',RATES.stamp),val*RATES.stamp/100],[TR('Registration fee ({0}%)',RATES.reg),val*RATES.reg/100],[TR('Local government tax ({0}%)',RATES.lg),val*RATES.lg/100],[TR('AIT ({0}%)',ait),val*ait/100]];
  const rt=rg.reduce((a,x)=>a+x[1],0),tr=rows=>rows.map(x=>`<tr><td>${x[0]}</td><td>BDT ${num(x[1])}</td></tr>`).join('');
  $('#fRes').innerHTML=`<p class="sub">${TR('{0}: {1} decimals ({2} katha). Deed value BDT {3}.',esc(PL(up)),num(dec),num(k),num(val))}</p>
  <div class="tw"><table><tr><th colspan="2">${TR('e-Mutation (Namjari): fixed fee')}</th></tr>${tr(mut)}<tr><th>${TR('e-Mutation total')}</th><th>BDT ${num(mt)}</th></tr>
  <tr><th colspan="2">${TR('Registration costs')}</th></tr>${tr(rg)}<tr><th>${TR('Registration total')}</th><th>BDT ${num(rt)}</th></tr>
  <tr><th>${TR('Grand total')}</th><th>BDT ${num(mt+rt)}</th></tr></table></div>
  <h2>${TR('Pay directly, no middleman')}</h2>
  <div class="tw"><table><tr><th>${TR('Payment')}</th><th>${TR('Economic code')}</th></tr>
  <tr><td>${TR('Stamp duty')}</td><td>1162101</td></tr><tr><td>${TR('Document registration fee')}</td><td>1422201</td></tr>
  <tr><td>${TR('Local government tax')}</td><td>${TR('Confirm at the sub-registry or local body')}</td></tr>
  <tr><td>${TR('AIT')}</td><td>${TR('Confirm at the sub-registry')}</td></tr>
  <tr><td>${TR('e-Mutation fees')}</td><td>${TR('Confirm at the AC (Land) office')}</td></tr></table></div>
  <p class="sub">${TR('Pay through bKash, Nagad or iBAS++ and keep the receipt. Payment links are not connected in this demo.')}</p>
  <p class="sub">${TR('The e-Mutation fee is BDT 1,170. The percentage rates are the ones set for this portal. Published guides disagree on them (some list 3% stamp duty and 2% registration fee), so confirm the current rates at the sub-registry before you pay.')}</p>`;
};

/* 4. Family Land Distributor (Faraiz) with exact fractions */
const gcd=(a,b)=>b?gcd(b,a%b):Math.abs(a);
const F=(n,d=1)=>{const g=gcd(n,d)||1;return{n:n/g,d:d/g}};
const add=(a,b)=>F(a.n*b.d+b.n*a.d,a.d*b.d),sub=(a,b)=>F(a.n*b.d-b.n*a.d,a.d*b.d),mul=(a,b)=>F(a.n*b.n,a.d*b.d),div=(a,b)=>F(a.n*b.d,a.d*b.n),cmp=(a,b)=>a.n*b.d-b.n*a.d;
const fs=a=>a.d===1?String(a.n):a.n+'/'+a.d;
const mixed=a=>{const w=Math.floor(a.n/a.d),r=a.n-w*a.d;return r?(w?w+' ':'')+r+'/'+a.d:String(w)};
const dp=a=>(a.n/a.d).toFixed(4);
function faraiz(male,sp,sons,dau,mom,dad){
  const child=sons+dau>0,sh=[];let note='';
  const push=(k,name,count,share)=>{if(count>0)sh.push({k,name,count,share})};
  let spS=F(0);
  if(sp>0){spS=male?(child?F(1,8):F(1,4)):(child?F(1,4):F(1,2));push('sp',male?(sp>1?'Wives':'Wife'):'Husband',sp,spS)}
  if(mom)push('mo','Mother',1,!child&&dad&&sp>0?div(sub(F(1),spS),F(3)):child?F(1,6):F(1,3));
  if(dad&&child)push('fa','Father',1,F(1,6));
  if(!sons&&dau)push('da',dau>1?'Daughters':'Daughter',dau,dau>1?F(2,3):F(1,2));
  const tot=sh.reduce((a,x)=>add(a,x.share),F(0)),rem=sub(F(1),tot);
  if(cmp(rem,F(0))<0){sh.forEach(x=>x.share=div(x.share,tot));note='Aul applied: the fixed shares added up to more than the whole estate, so every share was reduced in proportion.'}
  else if(cmp(rem,F(0))>0){
    if(sons){const u=2*sons+dau;push('so',sons>1?'Sons':'Son',sons,mul(rem,F(2*sons,u)));push('da',dau>1?'Daughters':'Daughter',dau,mul(rem,F(dau,u)))}
    else if(dad){const x=sh.find(y=>y.k==='fa');if(x)x.share=add(x.share,rem);else push('fa','Father',1,rem)}
    else{
      const base=sh.filter(x=>x.k!=='sp');
      if(base.length){const bt=base.reduce((a,x)=>add(a,x.share),F(0));base.forEach(x=>x.share=add(x.share,mul(rem,div(x.share,bt))));note='Radd applied: the remainder was returned in proportion to the heirs who have fixed shares, other than the spouse.'}
      else if(sh.length){sh[0].share=add(sh[0].share,rem);note='Radd applied: the spouse is the only heir, so the spouse receives the whole estate.'}
    }
  }
  const order=['sp','mo','fa','so','da'];
  return{rows:sh.sort((a,b)=>order.indexOf(a.k)-order.indexOf(b.k)),note};
}
let last=null;
const male=()=>$('#aS').value==='m';
$('#aS').onchange=()=>{$('#spLbl').textContent=male()?TR('Number of wives (0 to 4)'):TR('Husband alive (0 or 1)');$('#aSp').max=male()?4:1};
$('#fFar').onsubmit=e=>{e.preventDefault();
  const name=$('#aN').value.trim(),et=$('#aE').value.trim(),int=i=>Math.max(0,Math.floor(+$(i).value||0));
  if(!name)return say('#aMsg',TR('Enter the name of the deceased.'),1);
  if(!/^\d+(\.\d+)?$/.test(et)||!(+et>0))return say('#aMsg',TR('Enter the land estate as a number greater than zero.'),1);
  const sp=Math.min(int('#aSp'),male()?4:1),sons=int('#aSo'),dau=int('#aDa'),mom=$('#aMo').checked,dad=$('#aFa').checked;
  const r=faraiz(male(),sp,sons,dau,mom,dad);
  if(!r.rows.length)return say('#aMsg',TR('Add at least one surviving heir.'),1);
  say('#aMsg','');
  const [i,f='']=et.split('.'),est=F(+(i+f),Math.pow(10,f.length));
  last={name,male:male(),et,est,...r};
  const body=r.rows.map(x=>{const g=mul(est,x.share);return`<tr><td>${TR(x.name)}</td><td>${x.count}</td><td>${fs(x.share)}</td><td>${mixed(g)} (${dp(g)})</td><td>${mixed(div(g,F(x.count)))} (${dp(div(g,F(x.count)))})</td></tr>`}).join('');
  $('#faRes').innerHTML=`<div class="tw"><table><tr><th>${TR('Heir')}</th><th>${TR('Number')}</th><th>${TR('Share of estate')}</th><th>${TR('Land for the group (decimals)')}</th><th>${TR('Land for each person (decimals)')}</th></tr>${body}<tr><th colspan="3">${TR('Total')}</th><th colspan="2">${mixed(est)} ${TR('decimals, matches the estate exactly')}</th></tr></table></div>${r.note?'<p class="sub">'+TR(r.note)+'</p>':''}<button type="button" class="btn" id="faDl">${TR('Download Warishan Buntonnama summary')}</button><p class="sub">${TR('Brackets show the exact amount to four decimal places. Attach the official Warishan certificate from the Union Parishad or city corporation when you apply for e-Mutation.')}</p>`;
  $('#faDl').onclick=download;
};
function download(){
  const r=last;if(!r)return;
  const rows=r.rows.map(x=>{const g=mul(r.est,x.share);return`<tr><td>${TR(x.name)}</td><td>${x.count}</td><td>${fs(x.share)}</td><td>${mixed(g)}</td><td>${mixed(div(g,F(x.count)))}</td></tr>`}).join('');
  const html=`<!DOCTYPE html><html lang="${SafeLang.lang()}"><head><meta charset="utf-8"><title>${TR('Warishan Buntonnama summary')}</title><style>body{font-family:Arial,sans-serif;max-width:760px;margin:30px auto;color:#14201b}h1{color:#004d38;font-size:1.4rem}table{border-collapse:collapse;width:100%}td,th{border:1px solid #888;padding:6px 8px;text-align:left}.sig{margin-top:70px;display:flex;justify-content:space-between}</style></head><body><h1>${TR('Safe Land: Family Distribution Deed Summary (Warishan Buntonnama)')}</h1><p>${TR('Date:')} ${esc(now())}<br>${TR('Prepared for:')} ${esc(me.name)} (NID ${esc(me.id)})</p><p>${TR('Deceased:')} <b>${esc(r.name)}</b> (${TR(r.male?'male':'female')})<br>${TR('Total land estate:')} <b>${esc(r.et)} ${TR('decimals')}</b></p><table><tr><th>${TR('Heir')}</th><th>${TR('Number')}</th><th>${TR('Share of estate')}</th><th>${TR('Land for the group (decimals)')}</th><th>${TR('Land for each person (decimals)')}</th></tr>${rows}</table>${r.note?'<p>'+TR(r.note)+'</p>':''}<p>${TR('Shares follow Islamic inheritance rules for the heirs listed. This summary is for reference and is attached with the official Warishan certificate to an e-Mutation application.')}</p><div class="sig"><span>${TR('Applicant signature')}</span><span>${TR('Date')}</span></div></body></html>`;
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([html],{type:'text/html'}));a.download='warishan-buntonnama-summary.html';a.click();URL.revokeObjectURL(a.href);
}

/* 5. Report Digging: anonymous, with GPS, time and nearest mouza */
const MOUZA=[['Baipail, Savar',23.865,90.248],['Savar',23.858,90.267],['Dhamrai',23.919,90.214],['Sonargaon, Narayanganj',23.65,90.6],['Manikganj',23.864,90.005],['Meghnaghat',23.61,90.612]];
$('#rPlace').innerHTML+=MOUZA.map((m,i)=>`<option value="${i}">${esc(PL(m[0]))}</option>`).join('');
const near=(la,lo)=>MOUZA.map(m=>[Math.hypot((m[1]-la)*111,(m[2]-lo)*102),m[0]]).sort((a,b)=>a[0]-b[0])[0][1];
$('#rPhoto').onchange=e=>{const f=e.target.files[0];$('#rPrev').innerHTML=f?`<img alt="${TR('Photo preview')}" src="${URL.createObjectURL(f)}">`:''};
$('#fRep').onsubmit=async e=>{e.preventDefault();
  const f=$('#rPhoto').files[0];
  if(!f)return say('#rMsg',TR('Take or choose a photo of the violation first.'),1);
  say('#rMsg',TR('Reading your GPS location...'));
  let ll=null,gps=true;
  try{ll=await new Promise((ok,no)=>navigator.geolocation?navigator.geolocation.getCurrentPosition(p=>ok([p.coords.latitude,p.coords.longitude]),no,{timeout:8000,enableHighAccuracy:true}):no())}catch(x){}
  if(!ll){
    const i=$('#rPlace').value;
    if(i==='')return say('#rMsg',TR('Could not read your GPS. Allow location access, or choose the nearest mouza.'),1);
    ll=[MOUZA[i][1],MOUZA[i][2]];gps=false;
  }
  const t={id:'RPT-'+Math.random().toString(36).slice(2,8).toUpperCase(),time:now(),kind:$('#rKind').value,ll,gps,mouza:near(ll[0],ll[1]),photo:f.name+' ('+Math.round(f.size/1024)+' KB)',note:$('#rNote').value.trim()};
  S.addReport(t);
  say('#rMsg','');e.target.reset();$('#rPrev').innerHTML='';
  $('#rRes').innerHTML=`<div class="box"><p><b>${TR('Report {0} submitted anonymously.',t.id)}</b></p>
  <p>${TR('Type:')} ${esc(TR(t.kind))}<br>${TR('Time:')} ${esc(t.time)} ${TR('(Bangladesh)')}<br>${TR('Position:')} ${t.ll[0].toFixed(5)}, ${t.ll[1].toFixed(5)} (${TR(t.gps?'device GPS':'chosen by hand')})<br>${TR('Nearest mouza:')} ${esc(PL(t.mouza))} ${TR('(approximate)')}<br>${TR('Photo:')} ${esc(t.photo)}</p>
  <p class="sub">${TR('The ticket goes to the UNO, AC (Land) and River Police queue. In this demo it is saved in your browser and not sent anywhere.')}</p></div>`;
};
})();
