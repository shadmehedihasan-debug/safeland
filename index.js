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

$('#fUser').onsubmit=async e=>{e.preventDefault();
  const id=$('#uId').value.trim(),u=S.user(id);
  if(!u||u.h!==await S.hash(id,$('#uPw').value)){S.log('user login',id,false);return err(e.target,'ID or password is incorrect.')}
  askOtp(u.phone,()=>{S.log('user login',id,true);S.setSession('user',id,u.first+' '+u.last);location.href='portal.html'},'user');
};
$('#fCorp').onsubmit=async e=>{e.preventDefault();
  const id=$('#cId').value.trim(),u=S.corp(id);
  if(!u||u.h!==await S.hash(id,$('#cPw').value)){S.log('corporate login',id,false);return err(e.target,'ID or password is incorrect.')}
  askOtp(u.phone,()=>{S.log('corporate login',id,true);S.setSession('corp',id,u.name);location.href='corporate.html'},'corp');
};
$('#fSign').onsubmit=e=>{e.preventDefault();
  const g=i=>$(i).value.trim(),f=e.target,first=g('#sF'),last=g('#sL'),nid=g('#sN'),ph=g('#sP'),pw=$('#sW').value,pw2=$('#sW2').value;
  if(!first||!last)return err(f,'Enter your first and last name.');
  if(!/^\d{10,17}$/.test(nid))return err(f,'NID number must be 10 to 17 digits.');
  if(!/^\+?\d{10,15}$/.test(ph))return err(f,'Enter a valid phone number.');
  if(pw.length<8)return err(f,'Password must be at least 8 characters.');
  if(pw!==pw2)return err(f,'Passwords do not match.');
  if(S.user(nid))return err(f,'An account with this NID number already exists.');
  askOtp(ph,async()=>{
    await S.addUser(nid,{first,last,phone:ph,pw});
    flashMsg='Account created. Log in with your NID number and password.';
    f.reset();showIntro();
  },'signup');
};
$('#fOtp').onsubmit=e=>{e.preventDefault();
  if(!S.checkOtp($('#otp').value.trim()))return err(e.target,'Incorrect OTP. Please try again.');
  otpOk();
};
$('#fForgot').onsubmit=e=>{e.preventDefault();
  const id=$('#fId').value.trim(),u=S.user(id);
  if(!u||u.last.toLowerCase()!==$('#fLn').value.trim().toLowerCase())return err(e.target,'ID and last name do not match our records.');
  ctx.tid=id;askOtp(u.phone,()=>show('reset'),'forgot');
};
$('#fReset').onsubmit=async e=>{e.preventDefault();
  const p=$('#rW').value,p2=$('#rW2').value;
  if(p.length<8)return err(e.target,'Password must be at least 8 characters.');
  if(p!==p2)return err(e.target,'Passwords do not match.');
  await S.setPassword(ctx.tid,p);
  flashMsg='Password updated. Log in with your new password.';
  e.target.reset();show('user');
};
if(location.hash==='#login')$('#enter').click();
})();
