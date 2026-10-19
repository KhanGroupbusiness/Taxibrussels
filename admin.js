'use strict';
const statusBox=document.getElementById('adminStatus');
const panel=document.getElementById('adminPanel');
const login=document.getElementById('loginForm');
const notice=text=>statusBox.textContent=text;
const resetForm=document.getElementById('passwordResetForm');
const callbackParams=new URLSearchParams(window.location.hash.slice(1));
const callbackError=callbackParams.get('error_description');
let recovering=callbackParams.get('type')==='recovery'||new URLSearchParams(window.location.search).get('reset')==='1';
function cleanRecoveryURL(){window.history.replaceState({},'',window.location.pathname);}
async function showRecovery(){
 panel.hidden=true;login.hidden=true;resetForm.hidden=true;
 const {data:{session},error}=await TaxiAPI.client.auth.getSession();
 if(error)throw error;
 if(!session){recovering=false;cleanRecoveryURL();login.hidden=false;notice('This reset link has expired or is invalid. Enter your email and select Forgot password for a new link.');return;}
 resetForm.hidden=false;notice('Choose and confirm your new password.');
}
if(TaxiAPI.ready){
 TaxiAPI.client.auth.onAuthStateChange(event=>{
  if(event==='PASSWORD_RECOVERY'){recovering=true;setTimeout(()=>showRecovery().catch(e=>notice(e.message)),0);}
 });
}
document.getElementById('forgotPassword').addEventListener('click',async()=>{
 const email=document.getElementById('adminEmail');
 if(!email.reportValidity())return;
 const button=document.getElementById('forgotPassword');button.disabled=true;
 try{
  if(!TaxiAPI.ready)throw new Error('Connect the database first.');
  const redirect=new URL('admin.html',window.location.href);redirect.searchParams.set('reset','1');
  const {error}=await TaxiAPI.client.auth.resetPasswordForEmail(email.value.trim(),{redirectTo:redirect.href});
  if(error)throw error;
  notice('If an account exists for this email, a reset link has been sent. Open the newest email link to choose a new password.');
 }catch(error){notice(error.message);}finally{button.disabled=false;}
});
resetForm.addEventListener('submit',async e=>{
 e.preventDefault();const button=document.getElementById('savePassword');button.disabled=true;
 try{
  if(!TaxiAPI.ready)throw new Error('Connect the database first.');
  const password=document.getElementById('newPassword').value;
  if(password.length<8)throw new Error('Use at least 8 characters.');
  if(password!==document.getElementById('confirmPassword').value)throw new Error('The passwords do not match.');
  const {data:{session},error:sessionError}=await TaxiAPI.client.auth.getSession();
  if(sessionError)throw sessionError;
  if(!session)throw new Error('This reset session has expired. Request a new reset link.');
  const {error}=await TaxiAPI.client.auth.updateUser({password});
  if(error)throw error;
  resetForm.reset();recovering=false;resetForm.hidden=true;cleanRecoveryURL();
  const {error:signOutError}=await TaxiAPI.client.auth.signOut({scope:'local'});
  panel.hidden=true;login.hidden=false;
  document.getElementById('adminPassword').value='';
  notice(signOutError?'Password saved. Refresh this page and sign in with your new password.':'Password saved. Sign in with your new password.');
 }catch(error){notice(error.message);}finally{button.disabled=false;}
});
function textElement(tag,text){const node=document.createElement(tag);node.textContent=text;return node;}
function action(label,fn){const b=textElement('button',label);b.className='btn secondary';b.addEventListener('click',async()=>{b.disabled=true;try{await fn();}catch(e){notice(e.message);}finally{b.disabled=false;}});return b;}
let isOwner=false,me=null,stage='new',view='rides',allRides=[],assignments=[],drivers=[],ownRides=[],renderSerial=0,polling=false;
const el=id=>document.getElementById(id),money=n=>new Intl.NumberFormat('en-BE',{style:'currency',currency:'EUR'}).format(Number(n)),rpc=(name,args={})=>TaxiAPI.rpc(name,args);
function node(tag,text,cls){const n=textElement(tag,text);if(cls)n.className=cls;return n;}
function showSection(v){view=v;for(const s of document.querySelectorAll('.portal-section'))s.hidden=s.id!=='section-'+v;for(const b of document.querySelectorAll('[data-section]'))b.setAttribute('aria-pressed',String(b.dataset.section===v));}
for(const b of document.querySelectorAll('[data-section]'))b.addEventListener('click',()=>showSection(b.dataset.section));
async function read(table){const {data,error}=await TaxiAPI.client.from(table).select('*');if(error)throw error;return data;}
async function checkAccess(){
 if(!TaxiAPI.ready){notice('Online portal is not configured.');return;}if(recovering){await showRecovery();return;}
 const {data:{session},error}=await TaxiAPI.client.auth.getSession();if(error)throw error;me=session?.user?.id;
 if(!me){panel.hidden=true;login.hidden=false;return;}
 isOwner=!!await rpc('taxi_is_admin');const own=await read('taxi_drivers');
 if(!isOwner&&!own.some(d=>d.user_id===me&&d.active)){panel.hidden=true;login.hidden=false;notice('Your driver profile is not active. Contact Belgium Ride dispatch.');return;}
 panel.hidden=false;login.hidden=true;el('portalTitle').textContent=isOwner?'Dispatch dashboard':'My driver portal';
 for(const n of document.querySelectorAll('.owner-only'))n.hidden=!isOwner;
 showSection('rides');await loadDashboard();
}
function latest(r){return assignments.filter(a=>a.booking_id===r.id).sort((a,b)=>Date.parse(b.offered_at)-Date.parse(a.offered_at)||b.id.localeCompare(a.id))[0];}
function category(r){if(r.status==='approved')return Date.parse(r.booked_until)>Date.now()?'confirmed':'history';if(r.status!=='pending'||r.payment_status!=='paid')return 'history';const a=latest(r);return a?.status==='offered'?'waiting':a?.status==='accepted'?'ready':'new';}
const stages=[['new','New / reassign'],['waiting','Awaiting driver'],['ready','Ready to confirm'],['confirmed','Confirmed'],['history','History & payments']];
async function loadDashboard(){
 if(polling||!me)return;polling=true;try{
 if(isOwner){await rpc('taxi_dispatch_expire');[allRides,assignments,drivers]=await Promise.all([read('taxi_requests'),read('taxi_assignments'),read('taxi_drivers')]);
 const audit=await TaxiAPI.client.from('taxi_dispatch_events').select('*').order('created_at',{ascending:false}).limit(100);if(audit.error)throw audit.error;
 el('dispatchAudit').replaceChildren(...audit.data.map(e=>node('p',`${TaxiAPI.format(e.created_at)} · ${e.event.replaceAll('_',' ')} · ${e.booking_id||''}${e.detail?' · '+e.detail:''}`)));
 renderRoster();window.taxiDashboardData={requests:allRides};document.dispatchEvent(new CustomEvent('taxi-dashboard-loaded'));
 }else ownRides=await rpc('taxi_driver_rides');
 await loadHours();renderRides();
 }finally{polling=false;}
}
function renderRoster(){
 el('driverRoster').replaceChildren();
 for(const d of drivers){
  const card=node('article','', 'quote');card.append(node('h3',d.name),node('p',`${d.email} · ${d.active?'Active':'Inactive'}`));
  const label=node('label','Vehicle types'),select=document.createElement('select');
  for(const [key,title] of [['standard','Car'],['van','Van'],['both','Both Car and Van']])select.add(new Option(title,key));select.value=d.vehicle;label.append(select);card.append(label);
  card.append(action('Save vehicle types',async()=>{await rpc('taxi_dispatch_set_vehicle',{p_driver:d.user_id,p_vehicle:select.value});notice('Vehicle types saved. One shared driver calendar prevents car/van overlaps.');await loadDashboard();}));
  card.append(action(d.active?'Deactivate':'Activate',async()=>{await rpc('taxi_dispatch_toggle_driver',{p_driver:d.user_id,p_active:!d.active});await loadDashboard();}));el('driverRoster').append(card);
 }
}
function field(label,type,value){const wrap=node('label',label),input=document.createElement('input');input.type=type;input.value=value;wrap.append(input);return {wrap,input};}
function renderRides(){const serial=++renderSerial;const out=el('dispatchRides');out.replaceChildren();const term=el('rideSearch').value.trim().toLowerCase();
 if(isOwner){el('dispatchStages').replaceChildren(...stages.map(([key,title])=>{const b=node('button',`${title} (${allRides.filter(r=>category(r)===key).length})`);b.type='button';b.setAttribute('aria-pressed',String(stage===key));b.addEventListener('click',()=>{stage=key;renderRides();});return b;}));
 el('dispatchHelp').textContent=stage==='new'?'Assign a paid booking to an available driver. Driver rejection never cancels the customer booking.':stage==='ready'?'The driver accepted. Your final confirmation sends the customer email.':stage==='waiting'?'Waiting for driver responses. Expired offers return to your queue.':'';
 const sorted=allRides.filter(r=>category(r)===stage).sort((a,b)=>Date.parse(a.pickup_at)-Date.parse(b.pickup_at));
 for(const r of sorted){if(![r.id,r.name,r.pickup,r.dropoff].join(' ').toLowerCase().includes(term))continue;const card=rideCard(r);const a=latest(r);if(a)card.append(node('p',`Latest offer: ${drivers.find(d=>d.user_id===a.driver_id)?.name||'Driver'} · ${a.status} · Driver amount ${money(a.driver_pay)}`));
 if(r.status==='pending'&&r.payment_status==='paid'){
 const choices=node('select',''),label=node('label','Assign a driver');label.append(choices);choices.append(new Option('Loading available drivers…',''));card.append(label);
 rpc('taxi_dispatch_drivers',{p_request:r.id}).then(rows=>{if(serial!==renderSerial)return;choices.replaceChildren(new Option('Choose an available driver',''));for(const d of rows.filter(d=>d.available))choices.add(new Option(d.name+(d.user_id===me?' (me)':''),d.user_id));}).catch(e=>{choices.replaceChildren(new Option('Could not load drivers',''));notice(e.message);});
 const pay=field('Driver amount (€)','number','');pay.input.min='0';pay.input.max='10000';pay.input.step='.01';pay.input.required=true;
 const due=field('Response deadline (minutes)','number','30');due.input.min='5';due.input.max='240';due.input.required=true;card.append(pay.wrap,due.wrap);
 card.append(action('Assign & notify driver',async()=>{if(!choices.value||!pay.input.reportValidity()||!due.input.reportValidity())throw Error('Choose a driver and enter their payment and response deadline.');await rpc('taxi_dispatch_assign',{p_request:r.id,p_driver:choices.value,p_pay:Number(pay.input.value),p_minutes:Number(due.input.value)});notice('Assignment saved. Driver notification queued. Customer remains pending.');await loadDashboard();}));
 card.append(action('Drive it myself',async()=>{await rpc('taxi_dispatch_assign',{p_request:r.id,p_driver:me,p_pay:0,p_minutes:30});notice('Assigned to you. Review and confirm the customer.');await loadDashboard();}));
 if(a?.status==='accepted')card.append(action('Confirm customer booking',async()=>{if(!confirm('Confirm this accepted driver and send the customer confirmation?'))return;await rpc('taxi_decide',{p_request:r.id,p_status:'approved',p_price:Number(r.final_price)});notice('Customer booking confirmed. Existing confirmation email has been queued.');await loadDashboard();}));
 card.append(action('Decline booking & refund',async()=>{if(!confirm('Decline the CUSTOMER booking and start its full refund? This is different from reassigning a driver.'))return;await rpc('taxi_decide',{p_request:r.id,p_status:'declined',p_price:null});notice('Booking declined. Your existing refund workflow will process it.');await loadDashboard();}));
 }
 if(r.status==='approved')card.append(action('Cancel customer booking & refund',async()=>{if(!confirm('Cancel this confirmed booking and start the refund?'))return;await rpc('taxi_decide',{p_request:r.id,p_status:'cancelled',p_price:null});await loadDashboard();}));
 out.append(card);
 }
 }else{el('dispatchHelp').textContent='Accepting tells dispatch you can drive. The customer is confirmed only after dispatch gives final approval.';
 for(const r of ownRides){if(![r.booking_id,r.pickup,r.dropoff].join(' ').toLowerCase().includes(term))continue;const card=rideCard({...r,id:r.booking_id,name:r.customer_name||'Assignment',payment_status:null,final_price:null});card.append(node('p',`Your payment: ${money(r.driver_pay)} · ${r.status}`));
 if(r.status==='offered'){card.append(node('p',`Respond before ${TaxiAPI.format(r.deadline)}`));const note=field('Note for dispatch (optional)','text','');note.input.maxLength=1000;card.append(note.wrap);for(const [label,accept] of [['Accept assignment',true],['Reject assignment',false]])card.append(action(label,async()=>{await rpc('taxi_dispatch_respond',{p_assignment:r.id,p_accept:accept,p_note:note.input.value});notice('Response sent to dispatch.');await loadDashboard();}));}
 if(r.status==='accepted')card.append(node('p','Accepted — awaiting final confirmation from dispatch.'));
 out.append(card);
 }}if(!out.children.length)out.append(node('p','No rides in this section.'));
}
function rideCard(r){const c=node('article','', 'quote dispatch-ride');c.append(node('h3',r.pickup+' → '+r.dropoff),node('p',`${TaxiAPI.format(r.pickup_at)} → ${TaxiAPI.format(r.booked_until)}`),node('p',`${r.vehicle==='van'?'Van':'Car'} · ${r.passengers} passengers · ${r.luggage} bags`),node('p',`${r.service}${r.trip?' · '+r.trip:''}`),node('p','Reference: '+r.id));if(r.name)c.append(node('p',r.name));if(r.phone)c.append(node('p','Phone: '+r.phone));if(isOwner)c.append(node('p',`Customer fare: ${money(r.final_price)} · ${r.payment_status}`));if(r.notes)c.append(node('p','Notes: '+r.notes));return c;}
let hoursLoaded=false;
async function loadHours(){if(hoursLoaded)return;const [saved,exceptions]=await Promise.all([read('taxi_driver_hours'),read('taxi_driver_days')]);const days=[[1,'Monday'],[2,'Tuesday'],[3,'Wednesday'],[4,'Thursday'],[5,'Friday'],[6,'Saturday'],[0,'Sunday']];el('driverHoursRows').replaceChildren();
 for(const [weekday,title]of days){const h=saved.find(x=>x.driver_id===me&&x.weekday===weekday)||{enabled:false,opens:'09:00',closes:'22:00'};const row=node('div','', 'working-hours-row');row.dataset.weekday=weekday;const label=node('label',title),toggle=document.createElement('input');toggle.type='checkbox';toggle.checked=h.enabled;toggle.className='enabled';label.prepend(toggle);row.append(label);for(const key of ['opens','closes']){const f=field(key==='opens'?'From':'Until','time',h[key].slice(0,5));f.input.step=900;f.input.required=true;f.input.className=key;row.append(f.wrap);}el('driverHoursRows').append(row);}
 el('dayExceptions').replaceChildren(...exceptions.filter(x=>x.driver_id===me).sort((a,b)=>a.day.localeCompare(b.day)).map(x=>node('p',`${x.day}: ${x.enabled?x.opens.slice(0,5)+'–'+x.closes.slice(0,5):'Day off'}`)));hoursLoaded=true;
}
el('driverHoursForm').addEventListener('submit',async e=>{e.preventDefault();try{const hours=[...el('driverHoursRows').children].map(row=>({weekday:Number(row.dataset.weekday),enabled:row.querySelector('.enabled').checked,opens:row.querySelector('.opens').value,closes:row.querySelector('.closes').value}));await rpc('taxi_driver_save_hours',{p_hours:hours});notice('Your weekly hours are saved. Existing paid bookings remain reserved.');}catch(e){notice(e.message);}});
async function saveDay(remove=false){if(!el('exceptionDate').reportValidity())return;await rpc('taxi_driver_save_day',{p_day:el('exceptionDate').value,p_enabled:el('exceptionEnabled').checked,p_opens:el('exceptionFrom').value,p_closes:el('exceptionUntil').value,p_remove:remove});hoursLoaded=false;await loadHours();notice('Date availability saved. Existing bookings are preserved.');}
el('dayForm').addEventListener('submit',async e=>{e.preventDefault();try{await saveDay();}catch(e){notice(e.message);}});el('removeException').addEventListener('click',()=>saveDay(true).catch(e=>notice(e.message)));
el('driverForm').addEventListener('submit',async e=>{e.preventDefault();try{await rpc('taxi_dispatch_register',{p_email:el('driverEmail').value,p_name:el('driverName').value,p_vehicle:el('driverVehicle').value});e.target.reset();notice('Driver registered. They can sign in and publish their own hours.');await loadDashboard();}catch(e){notice(e.message);}});
el('rideSearch').addEventListener('input',renderRides);
login.addEventListener('submit',async e=>{e.preventDefault();try{const {error}=await TaxiAPI.client.auth.signInWithPassword({email:el('adminEmail').value.trim(),password:el('adminPassword').value});el('adminPassword').value='';if(error)throw error;hoursLoaded=false;notice('');await checkAccess();}catch(e){notice(e.message);}});
el('refresh').addEventListener('click',()=>loadDashboard().catch(e=>notice(e.message)));
el('logout').addEventListener('click',async()=>{await TaxiAPI.client.auth.signOut();me=null;hoursLoaded=false;allRides=[];assignments=[];drivers=[];ownRides=[];for(const id of ['dispatchRides','driverRoster','dispatchAudit','driverHoursRows','dayExceptions'])el(id).replaceChildren();for(const input of el('pricingForm').querySelectorAll('input'))input.value='';el('pricingFields').disabled=true;panel.hidden=true;login.hidden=false;notice('Signed out.');});
setInterval(()=>{if(me&&!panel.hidden&&!document.hidden&&view==='rides')loadDashboard().catch(e=>notice(e.message));},30000);
if(callbackError){recovering=false;cleanRecoveryURL();notice('Reset link failed: '+callbackError+'. Request a new link.');}else checkAccess().catch(e=>notice(e.message));
