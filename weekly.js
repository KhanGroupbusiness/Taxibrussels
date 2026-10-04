'use strict';
(() => {
 const days=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
 const defaults=()=>days.map((day,index)=>({day,enabled:true,periods:[{from:index<5?'18:00':'05:00',to:index<5?'22:00':'23:00'}]}));
 const dayISO=date=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Brussels',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
 const addDays=(iso,n)=>new Date(Date.parse(iso+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
 const minutes=time=>{if(!/^\d{2}:\d{2}$/.test(time))throw new Error('Choose start and end times.');const [h,m]=time.split(':').map(Number);if(h>23||m>59)throw new Error('Choose valid times.');return h*60+m;};
 const time=m=>String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
 function validate(schedule){
  if(!Array.isArray(schedule)||schedule.length!==7)throw new Error('Set hours for all seven days.');
  schedule.forEach((day,index)=>{
   if(!day.enabled)return;
   if(!day.periods?.length)throw new Error(days[index]+': add at least one period.');
   const sorted=day.periods.map(p=>({start:minutes(p.from),end:minutes(p.to)})).sort((a,b)=>a.start-b.start);
   sorted.forEach((p,i)=>{if(p.end<=p.start)throw new Error(days[index]+': end time must be later than start time.');if(i&&p.start<sorted[i-1].end)throw new Error(days[index]+': periods overlap.');});
  });return schedule;
 }
 function plan(schedule,{from,weeks,duration,service,existing=[],now=Date.now(),convert=TaxiAPI.brusselsISO}){
  validate(schedule);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!Number.isFinite(Date.parse(from+'T12:00:00Z')))throw new Error('Choose a valid start date.');
  if(![1,2,4,8].includes(weeks)||![60,120,240,480].includes(duration))throw new Error('Choose a valid number of weeks and ride duration.');
  if(!['Transfer','Day Trip'].includes(service))throw new Error('Choose a service.');
  if(from<dayISO(new Date(now)))throw new Error('Choose today or a future date.');
  if(from>addDays(dayISO(new Date(now)),90))throw new Error('Choose a start date within the next 90 days.');
  const result={rows:[],overlaps:0,tooSoon:0,tooFar:0,shortMinutes:0};
  const occupied=existing.map(s=>({start:Date.parse(s.starts_at),end:Date.parse(s.ends_at)}));
  for(let i=0;i<weeks*7;i++){
   const date=addDays(from,i),weekday=(new Date(date+'T12:00:00Z').getUTCDay()+6)%7,day=schedule[weekday];
   if(!day.enabled)continue;
   for(const period of day.periods){
    const start=minutes(period.from),end=minutes(period.to);
    result.shortMinutes+=(end-start)%duration;
    for(let m=start;m+duration<=end;m+=duration){
     const starts_at=convert(date+'T'+time(m)),ends_at=convert(date+'T'+time(m+duration));
     const a=Date.parse(starts_at),b=Date.parse(ends_at);
     if(a<now+4*3600000){result.tooSoon++;continue;}
     if(a>now+90*86400000){result.tooFar++;continue;}
     if(occupied.some(s=>a<s.end&&b>s.start)){result.overlaps++;continue;}
     result.rows.push({starts_at,ends_at,service,label:''});occupied.push({start:a,end:b});
    }
   }
  }
  return result;
 }
 // Shared pure scheduling logic for validation and automated checks.
 window.TaxiWeeklyCore={defaults,validate,plan,addDays,dayISO};
 const el=id=>document.getElementById(id),container=el('weeklyDays');
 if(!container)return;
 let storageKey=null,loadedKey=null,pending=null,busy=false;
 const notify=message=>el('weeklyStatus').textContent=message;
 function invalidate(){pending=null;el('weeklyPreview').hidden=true;}
 function render(schedule){
  container.replaceChildren();
  schedule.forEach((day,index)=>{
   const row=document.createElement('div');row.className='weekly-day';row.dataset.index=index;
   const label=document.createElement('label');label.className='day-toggle';
   const check=document.createElement('input');check.type='checkbox';check.checked=day.enabled;check.className='day-enabled';check.setAttribute('aria-label',days[index]+' available');label.append(check,document.createTextNode(days[index]));
   const periods=document.createElement('div');periods.className='day-periods';
   const add=document.createElement('button');add.type='button';add.className='btn secondary small-button add-period';add.textContent='+ Add period';
   function apply(){row.classList.toggle('off',!check.checked);periods.querySelectorAll('input,button').forEach(input=>input.disabled=!check.checked);}
   add.addEventListener('click',()=>{addPeriod(periods,{from:'18:00',to:'22:00'},index,add);invalidate();});
   periods.append(add);day.periods.forEach(period=>addPeriod(periods,period,index,add));
   check.addEventListener('change',()=>{apply();invalidate();});row.append(label,periods);container.append(row);apply();
  });
 }
 function addPeriod(parent,period,index,before){
  const group=document.createElement('div');group.className='time-period';
  for(const [key,title] of [['from','From'],['to','Until']]){
   const label=document.createElement('label');label.textContent=title;
   const input=document.createElement('input');input.type='time';input.step=1800;input.value=period[key];input.className='period-'+key;input.required=true;input.setAttribute('aria-label',days[index]+' '+title.toLowerCase());input.addEventListener('change',invalidate);label.append(input);group.append(label);
  }
  const remove=document.createElement('button');remove.type='button';remove.className='btn secondary small-button';remove.textContent='Remove';remove.setAttribute('aria-label','Remove '+days[index]+' period');remove.addEventListener('click',()=>{group.remove();invalidate();});group.append(remove);parent.insertBefore(group,before);
 }
 function readSchedule(){return validate([...container.children].map((row,index)=>({day:days[index],enabled:row.querySelector('.day-enabled').checked,periods:[...row.querySelectorAll('.time-period')].map(p=>({from:p.querySelector('.period-from').value,to:p.querySelector('.period-to').value}))})));}
 async function requireAccess(){
  if(!TaxiAPI.ready)throw new Error('Connect the database first.');
  const {data:{session},error}=await TaxiAPI.client.auth.getSession();if(error)throw error;
  if(!session||!await TaxiAPI.rpc('taxi_is_admin',{}))throw new Error('Sign in with your driver account first.');
  storageKey='taxi-weekly:'+session.user.id;return session;
 }
 async function loadSaved(){
  try{await requireAccess();if(loadedKey===storageKey)return;loadedKey=storageKey;let saved=null;
   try{saved=JSON.parse(localStorage.getItem(storageKey));if(saved)validate(saved);}catch(_){saved=null;}
   render(saved||defaults());invalidate();notify(saved?'Saved weekly hours loaded from this device.':'Your usual hours are prefilled. Preview to publish them.');
  }catch(_){/* Login errors are displayed by the dashboard. */}
 }
 function options(){return{from:el('weeklyFrom').value,weeks:Number(el('weeklyWeeks').value),duration:Number(el('weeklyDuration').value),service:el('weeklyService').value};}
 async function fetchSlots(){const {data,error}=await TaxiAPI.client.from('taxi_slots').select('*').order('starts_at');if(error)throw error;return data;}
 function summary(result){return`${result.rows.length} new windows. ${result.overlaps} overlapping windows skipped; ${result.tooSoon} too close to pickup; ${result.tooFar} beyond 90 days. ${result.shortMinutes} minutes left over at period ends.`;}
 el('weeklyForm').addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;busy=true;el('previewWeekly').disabled=true;
  try{
   await requireAccess();invalidate();const schedule=readSchedule(),settings=options();
   if(settings.service==='Day Trip'&&settings.duration<480)throw new Error('For day trips, choose an 8-hour reserved window. Shorter weekday periods will not produce windows.');
   const result=plan(schedule,{...settings,existing:await fetchSlots()});pending={schedule,settings,result};
   el('weeklySummary').textContent=summary(result);const list=el('weeklyPreviewList');list.replaceChildren();
   const grouped=new Map();for(const slot of result.rows){const date=dayISO(new Date(slot.starts_at));if(!grouped.has(date))grouped.set(date,[]);grouped.get(date).push(slot);}
   for(const [date,slots] of grouped){const row=document.createElement('div');row.className='preview-day';const title=document.createElement('strong');title.textContent=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Brussels',weekday:'short',day:'numeric',month:'short'}).format(new Date(date+'T12:00:00Z'));const description=document.createElement('span');const clock=iso=>new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Brussels',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(iso));description.textContent=`${slots.length} windows · pickups ${slots.map(s=>clock(s.starts_at)).join(', ')}`;row.append(title,description);list.append(row);}
   el('weeklyPreview').hidden=false;el('publishWeekly').disabled=!result.rows.length;notify(result.rows.length?'Check the dates and pickup times below before publishing.':'No new windows fit these settings. Check reserved duration or existing availability.');
  }catch(error){notify(error.message);}finally{busy=false;el('previewWeekly').disabled=false;}
 });
 el('saveWeekly').addEventListener('click',async()=>{try{await requireAccess();localStorage.setItem(storageKey,JSON.stringify(readSchedule()));notify('Weekly hours saved on this device. Preview and publish to make dates bookable.');}catch(error){notify(error.message);}});
 el('weeklyService').addEventListener('change',()=>{if(el('weeklyService').value==='Day Trip')el('weeklyDuration').value='480';invalidate();});
 for(const id of ['weeklyFrom','weeklyWeeks','weeklyDuration'])el(id).addEventListener('change',invalidate);
 el('publishWeekly').addEventListener('click',async()=>{
  if(!pending||busy)return;busy=true;el('publishWeekly').disabled=true;el('previewWeekly').disabled=true;
  try{
   await requireAccess();const result=plan(pending.schedule,{...pending.settings,existing:await fetchSlots()});
   if(!result.rows.length){invalidate();notify('No new windows to publish. Existing windows are preserved.');return;}
   const {error}=await TaxiAPI.client.from('taxi_slots').insert(result.rows);if(error)throw error;
   let saved=true;try{localStorage.setItem(storageKey,JSON.stringify(pending.schedule));}catch(_){saved=false;}
   invalidate();await loadDashboard();notify(`${result.rows.length} windows published. ${saved?'Weekly hours saved on this device.':'Hours could not be saved on this device.'} Return later to publish the next date range.`);
  }catch(error){invalidate();notify(error.message.includes('exclusion')?'Availability changed while you were reviewing. Preview again; existing bookings are preserved.':error.message);}finally{busy=false;el('previewWeekly').disabled=false;}
 });
 function renderException(){
  const date=el('exceptionDate').value,list=el('exceptionList');list.replaceChildren();el('closeDate').disabled=true;
  const data=window.taxiDashboardData;if(!date||!data)return;
  const slots=data.slots.filter(s=>dayISO(new Date(s.starts_at))===date),active=new Set(data.requests.filter(r=>['pending','approved'].includes(r.status)).map(r=>r.slot_id));
  const closable=slots.filter(s=>!s.closed&&!active.has(s.id)&&Date.parse(s.ends_at)>Date.now());el('closeDate').disabled=!closable.length;
  if(!slots.length){list.textContent='No published windows for this date.';return;}
  for(const slot of slots){const text=document.createElement('p');text.textContent=`${TaxiAPI.format(slot.starts_at)} → ${TaxiAPI.format(slot.ends_at)} · ${slot.service} · ${active.has(slot.id)?'Reserved — kept':slot.closed?'Closed':'Open'}`;list.append(text);}
 }
 el('exceptionDate').addEventListener('change',()=>{el('exceptionStatus').textContent='';renderException();});
 el('closeDate').addEventListener('click',async()=>{
  const button=el('closeDate');button.disabled=true;
  try{
   await requireAccess();await loadDashboard();const data=window.taxiDashboardData,date=el('exceptionDate').value;
   const active=new Set(data.requests.filter(r=>['pending','approved'].includes(r.status)).map(r=>r.slot_id));
   const ids=data.slots.filter(s=>dayISO(new Date(s.starts_at))===date&&!s.closed&&!active.has(s.id)&&Date.parse(s.ends_at)>Date.now()).map(s=>s.id);
   if(!ids.length){el('exceptionStatus').textContent='No unreserved windows to close.';return;}
   if(!confirm(`Close ${ids.length} unreserved windows on ${date}? Existing reservations will be kept. You can reopen closed windows below.`))return;
   const {error}=await TaxiAPI.client.from('taxi_slots').update({closed:true}).in('id',ids);if(error)throw error;
   invalidate();await loadDashboard();el('exceptionStatus').textContent=`${ids.length} windows closed. Existing reservations were kept. Check any newly received requests before approving.`;
  }catch(error){el('exceptionStatus').textContent=error.message;}finally{renderException();}
 });
 render(defaults());el('weeklyFrom').value=dayISO(new Date());el('exceptionDate').value=dayISO(new Date());
 document.addEventListener('taxi-dashboard-loaded',()=>{loadSaved();renderException();});
 if(window.taxiDashboardData){loadSaved();renderException();}
})();
