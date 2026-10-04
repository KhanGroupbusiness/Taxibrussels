'use strict';
const statusBox=document.getElementById('adminStatus');
const panel=document.getElementById('adminPanel');
const login=document.getElementById('loginForm');
const notice=text=>statusBox.textContent=text;
function textElement(tag,text){const node=document.createElement(tag);node.textContent=text;return node;}
function action(label,fn){const b=textElement('button',label);b.className='btn secondary';b.addEventListener('click',async()=>{b.disabled=true;try{await fn();}catch(e){notice(e.message);}finally{b.disabled=false;}});return b;}
async function checkAccess(){
 if(!TaxiAPI.ready){notice('Connect Supabase using booking-config.js and run schema.sql first.');return;}
 const {data:{session}}=await TaxiAPI.client.auth.getSession();
 const allowed=session && await TaxiAPI.rpc('taxi_is_admin',{});
 panel.hidden=!allowed;login.hidden=!!allowed;
 if(session&&!allowed) notice('This user has no driver access. Add its UUID to taxi_private.admins in the SQL Editor.');
 if(allowed) await loadDashboard();
}
async function loadDashboard(){
 const [slots,requests]=await Promise.all([TaxiAPI.client.from('taxi_slots').select('*').order('starts_at'),TaxiAPI.client.from('taxi_requests').select('*').order('created_at',{ascending:false})]);
 if(slots.error||requests.error) throw new Error(slots.error?.message||requests.error?.message);
 const slotMap=new Map(slots.data.map(s=>[s.id,s]));
 const list=document.getElementById('slotsList');list.replaceChildren();
 for(const s of slots.data.filter(s=>Date.parse(s.ends_at)>Date.now())){
  const card=textElement('article','');card.className='quote';
  const occupied=requests.data.find(r=>r.slot_id===s.id&&['pending','approved'].includes(r.status));
  card.append(textElement('p',`${TaxiAPI.format(s.starts_at)} → ${TaxiAPI.format(s.ends_at)} · ${s.service} · ${s.closed?'Closed':occupied?occupied.status:'Open'}${s.label?' · '+s.label:''}`));
  card.append(action(s.closed?'Reopen':'Close window',async()=>{const {error}=await TaxiAPI.client.from('taxi_slots').update({closed:!s.closed}).eq('id',s.id);if(error)throw error;await loadDashboard();}));list.append(card);
 }
 if(!list.children.length) list.append(textElement('p','No future windows. Publish your first available window above.'));
 const bookings=document.getElementById('bookingsList');bookings.replaceChildren();
 for(const r of requests.data){
  const s=slotMap.get(r.slot_id); const card=textElement('article','');card.className='quote';
  card.append(textElement('h3',`${r.status.toUpperCase()} · ${r.name}`));
  for(const line of [`Reference: ${r.id}`,`Pickup: ${s?TaxiAPI.format(s.starts_at):'Unknown'}`,`Reserved until: ${s?TaxiAPI.format(s.ends_at):'Unknown'}`,`${r.service}${r.trip?' · '+r.trip:''}`,`${r.pickup} → ${r.dropoff}`,`Phone: ${r.phone} · Email: ${r.email}`,`${r.passengers} passengers · ${r.luggage} bags`,`Indicative fare: €${r.estimated_price ?? 'Not provided'}${r.final_price!==null?' · Final fare: €'+r.final_price:''}`,`Notes: ${r.notes||'None'}`]) card.append(textElement('p',line));
  if(r.status==='pending'){
   const label=textElement('label','Final fare (€)');const price=document.createElement('input');price.type='number';price.min='0.01';price.max='10000';price.step='0.01';price.value=r.estimated_price||'';label.append(price);card.append(label);
   const checkLabel=textElement('label','');const check=document.createElement('input');check.type='checkbox';checkLabel.append(check,document.createTextNode(' I checked that this entire journey and pickup travel fit the reserved window.'));card.append(checkLabel);
   card.append(action('Approve',async()=>{if(!check.checked)throw new Error('Check the journey duration before approval.');if(!price.value||!price.checkValidity())throw new Error('Enter a valid final fare.');await TaxiAPI.rpc('taxi_decide',{p_request:r.id,p_status:'approved',p_price:Number(price.value)});await loadDashboard();notice('Approved. Use Email customer to send the confirmation.');}));
   card.append(action('Decline and release time',async()=>{await TaxiAPI.rpc('taxi_decide',{p_request:r.id,p_status:'declined',p_price:null});await loadDashboard();notice('Declined. Use Email customer to notify them.');}));
  }
  if(r.status==='approved')card.append(action('Cancel and release time',async()=>{if(!confirm('Cancel this approved ride? You must inform the customer.'))return;await TaxiAPI.rpc('taxi_decide',{p_request:r.id,p_status:'cancelled',p_price:null});await loadDashboard();notice('Cancelled. Inform the customer.');}));
  const email=textElement('a','Email customer');email.className='btn secondary';
  const outcome=r.status==='approved'?`Your booking is confirmed. Final fare: €${r.final_price}.`:r.status==='pending'?'Your request is pending driver review. This is not a confirmed ride.':`Your booking request has been ${r.status}.`;
  email.href=`mailto:${encodeURIComponent(r.email)}?subject=${encodeURIComponent('Khan Executive Taxi — '+r.status)}&body=${encodeURIComponent(`Hello ${r.name},\n\n${outcome}\nReference: ${r.id}\nPickup: ${s?TaxiAPI.format(s.starts_at):''}\nRoute: ${r.pickup} → ${r.dropoff}\n\nKhan Executive Taxi`)}`;card.append(email);bookings.append(card);
 }
 if(!requests.data.length)bookings.append(textElement('p','No requests yet.'));
}
login.addEventListener('submit',async e=>{e.preventDefault();try{if(!TaxiAPI.ready)throw new Error('Connect the database first.');const {error}=await TaxiAPI.client.auth.signInWithPassword({email:document.getElementById('adminEmail').value,password:document.getElementById('adminPassword').value});document.getElementById('adminPassword').value='';if(error)throw error;notice('');await checkAccess();}catch(error){notice(error.message);}});
document.getElementById('slotForm').addEventListener('submit',async e=>{e.preventDefault();try{const starts_at=TaxiAPI.brusselsISO(document.getElementById('slotStart').value), ends_at=TaxiAPI.brusselsISO(document.getElementById('slotEnd').value);if(Date.parse(starts_at)<Date.now()+4*3600000)throw new Error('Allow at least four hours before pickup.');if(Date.parse(ends_at)<=Date.parse(starts_at))throw new Error('End must be after pickup.');const {error}=await TaxiAPI.client.from('taxi_slots').insert({starts_at,ends_at,service:document.getElementById('slotService').value,label:document.getElementById('slotLabel').value});if(error)throw error;await loadDashboard();notice('Available window published.');}catch(error){notice(error.message.includes('exclusion')?'This window overlaps another published window. Choose a different period.':error.message);}});
document.getElementById('refresh').addEventListener('click',()=>loadDashboard().catch(e=>notice(e.message)));
document.getElementById('logout').addEventListener('click',async()=>{await TaxiAPI.client.auth.signOut();panel.hidden=true;login.hidden=false;document.getElementById('bookingsList').replaceChildren();document.getElementById('slotsList').replaceChildren();notice('Signed out.');});
checkAccess().catch(e=>notice(e.message));
