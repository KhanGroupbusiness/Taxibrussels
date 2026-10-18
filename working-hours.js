'use strict';
(()=>{
 const form=document.getElementById('workingHoursForm'),rows=document.getElementById('workingHoursRows'),status=document.getElementById('workingHoursStatus'),button=document.getElementById('saveWorkingHours');
 const weekdays=[[1,'Monday'],[2,'Tuesday'],[3,'Wednesday'],[4,'Thursday'],[5,'Friday'],[6,'Saturday'],[0,'Sunday']];
 let loaded=false,loading=false;
 function render(saved=[]){rows.replaceChildren();for(const [weekday,name] of weekdays){
  const data=saved.find(x=>x.weekday===weekday)||{enabled:true,opens:'09:00',closes:'22:00'};
  const row=document.createElement('div');row.className='working-hours-row';row.dataset.weekday=weekday;
  const label=document.createElement('label');label.className='hours-day';const toggle=document.createElement('input');toggle.type='checkbox';toggle.checked=data.enabled;toggle.className='hours-enabled';label.append(toggle,document.createTextNode(name));row.append(label);
  for(const [field,title] of [['opens','From'],['closes','Until']]){const wrap=document.createElement('label');wrap.textContent=title;const input=document.createElement('input');input.type='time';input.step=900;input.required=true;input.className='hours-'+field;input.value=data[field].slice(0,5);wrap.append(input);row.append(wrap);}
  const off=document.createElement('span');off.className='hours-off';off.textContent='Day off';row.append(off);
  const apply=()=>{for(const input of row.querySelectorAll('input[type=time]'))input.disabled=!toggle.checked;row.classList.toggle('is-off',!toggle.checked);};toggle.addEventListener('change',apply);apply();rows.append(row);
 }}
 async function load(){if(loaded||loading||!window.taxiDashboardData)return;loading=true;try{
  const {data,error}=await TaxiAPI.client.from('taxi_working_hours').select('*').order('weekday');if(error)throw error;
  render(data);loaded=true;status.textContent=data.length?'Your saved working hours are shown. Change them and save once.':'Choose your usual hours, then save. They apply to transfers and day trips.';
 }catch(e){status.textContent=e.message;}finally{loading=false;}}
 form.addEventListener('submit',async event=>{event.preventDefault();button.disabled=true;status.textContent='Saving your working hours…';
  try{const hours=[...rows.children].map(row=>({weekday:Number(row.dataset.weekday),enabled:row.querySelector('.hours-enabled').checked,opens:row.querySelector('.hours-opens').value,closes:row.querySelector('.hours-closes').value}));
   for(const h of hours)if(h.enabled&&(!h.opens||!h.closes||h.closes<=h.opens||Number(h.opens.slice(3))%15||Number(h.closes.slice(3))%15))throw Error('Choose end times after start times, in 15-minute steps.');
   await TaxiAPI.rpc('taxi_save_working_hours',{p_hours:hours});await loadDashboard();status.textContent='Working hours saved. Customers can now choose pickup times every 15 minutes. Existing rides are preserved.';
  }catch(e){status.textContent=e.message;}finally{button.disabled=false;}
 });
 render();document.addEventListener('taxi-dashboard-loaded',load);load();
})();
