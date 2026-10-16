(async()=>{
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const S=LantStore;
let ctx={},otpOk=null,otpBack='user',flashMsg='',cur='choose';
await S.ready;
const err=(f,m)=>{f.querySelector('.err').textContent=m};
const mask=p=>'*'.repeat(Math.max(p.length-3,0))+p.slice(-3);

function show(v){
  cur=v;
  $$('[data-v]').forEach(s=>s.hidden=s.dataset.v!==v);
  $$('.err').forEach(x=>x.textContent='');
  const f=$('#flash');f.textContent=flashMsg;f.hidden=!flashMsg||!['choose','user','corp'].includes(v);
  scrollTo(0,0);
}
function showIntro(){$('#portal').hidden=true;$('#intro').hidden=false}
function askOtp(phone,ok,back){otpOk=ok;otpBack=back;ctx.phone=phone;$('#otpMsg').textContent='An OTP has been sent to '+mask(phone)+'.';$('#otp').value='';show('otp');$('#otp').focus()}
function welcome(name,role){flashMsg='';$('#wName').textContent=name;$('#wRole').textContent=role;show('welcome')}

$('#enter').onclick=()=>{$('#intro').hidden=true;$('#portal').hidden=false;show('choose')};
document.addEventListener('click',e=>{const b=e.target.closest('[data-go]');if(b)show(b.dataset.go)});
const parent={choose:'intro',user:'choose',signup:'user',corp:'choose',forgot:'user',reset:'forgot',welcome:'choose'};
$('#back').onclick=()=>{const v=cur==='otp'?otpBack:parent[cur];v==='intro'?showIntro():show(v)};
$('#resend').onclick=()=>{err($('#fOtp'),'');$('#otpMsg').textContent='A new OTP has been sent to '+mask(ctx.phone)+'.'};

const net=f=>err(f,'Could not reach the database. Check your connection and try again.');
const busy=(f,on)=>{const b=f.querySelector('.btn');if(b)b.disabled=!!on};

$('#fUser').onsubmit=async e=>{e.preventDefault();
  const f=e.target,id=$('#uId').value.trim();let u;
  busy(f,1);try{u=await S.login('user',id,$('#uPw').value)}catch(x){busy(f,0);return net(f)}busy(f,0);
  if(!u)return err(f,'ID or password is incorrect.');
  askOtp(u.phone,()=>{S.log('user login',id,true);S.setSession('user',id,u.name,u.token,u.phone);location.href='portal.html'},'user');
};
$('#fCorp').onsubmit=async e=>{e.preventDefault();
  const f=e.target,id=$('#cId').value.trim();let u;
  busy(f,1);try{u=await S.login('corp',id,$('#cPw').value)}catch(x){busy(f,0);return net(f)}busy(f,0);
  if(!u)return err(f,'ID or password is incorrect.');
  askOtp(u.phone,()=>{S.log('corporate login',id,true);S.setSession('corp',id,u.name,u.token,u.phone);location.href='corporate.html'},'corp');
};
$('#fSign').onsubmit=e=>{e.preventDefault();
  const g=i=>$(i).value.trim(),f=e.target,first=g('#sF'),last=g('#sL'),nid=g('#sN'),ph=g('#sP'),pw=$('#sW').value,pw2=$('#sW2').value;
  if(!first||!last)return err(f,'Enter your first and last name.');
  if(!/^\d{10,17}$/.test(nid))return err(f,'NID number must be 10 to 17 digits.');
  if(!/^\+?\d{10,15}$/.test(ph))return err(f,'Enter a valid phone number.');
  if(pw.length<8)return err(f,'Password must be at least 8 characters.');
  if(pw!==pw2)return err(f,'Passwords do not match.');
  askOtp(ph,async()=>{
    let ok;try{ok=await S.register(nid,{first,last,phone:ph,pw})}catch(x){show('signup');return net(f)}
    if(!ok){show('signup');return err(f,'An account with this NID number already exists.')}
    flashMsg='Account created. Log in with your NID number and password.';
    f.reset();showIntro();
  },'signup');
};
$('#fOtp').onsubmit=e=>{e.preventDefault();
  if(!S.checkOtp($('#otp').value.trim()))return err(e.target,'Incorrect OTP. Please try again.');
  otpOk();
};
$('#fForgot').onsubmit=async e=>{e.preventDefault();
  const f=e.target,id=$('#fId').value.trim(),ln=$('#fLn').value.trim();let ph;
  try{ph=await S.forgot(id,ln)}catch(x){return net(f)}
  if(!ph)return err(f,'ID and last name do not match our records.');
  ctx.tid=id;ctx.last=ln;askOtp(ph,()=>show('reset'),'forgot');
};
$('#fReset').onsubmit=async e=>{e.preventDefault();
  const f=e.target,p=$('#rW').value,p2=$('#rW2').value;let ok;
  if(p.length<8)return err(f,'Password must be at least 8 characters.');
  if(p!==p2)return err(f,'Passwords do not match.');
  try{ok=await S.reset(ctx.tid,ctx.last,p)}catch(x){return net(f)}
  if(!ok)return err(f,'The password could not be updated. Go back and try again.');
  flashMsg='Password updated. Log in with your new password.';
  f.reset();show('user');
};
$$('[data-demo]').forEach(b=>b.onclick=async()=>{
  const k=b.dataset.demo,f=b.closest('form');b.disabled=true;
  try{const r=await S.demoLogin(k);if(!r)throw 0;S.setSession(k,r.id,r.name,r.token,r.phone);location.href=k==='user'?'portal.html':'corporate.html'}
  catch(x){b.disabled=false;err(f,'The demo could not start. Check your connection and try again.')}
});
if(location.hash==='#login')$('#enter').click();
})();
