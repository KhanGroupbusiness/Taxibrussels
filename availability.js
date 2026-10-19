'use strict';
let availableSlots=[];
let availabilityRevision=0;
let requestBusy=false;
const bookingStatus=document.getElementById('bookingStatus');
const slotSelect=document.getElementById('availableSlot');
let requiredJourneyMinutes=60;
function bookingNotice(message){bookingStatus.textContent=message;}
async function refreshAvailability(keepSelection=false){
 const revision=++availabilityRevision,previous=keepSelection?slotSelect.value:'';
 availableSlots=[];
 const day=document.getElementById('date').value;
 slotSelect.replaceChildren(new Option(day?'Loading pickup times…':'Choose a date first',''));
 if(!TaxiAPI.ready||!day)return;
 try{
  const service=document.getElementById('bookingType').value==='day-trip'?'Day Trip':'Transfer';
  const rows=await TaxiAPI.rpc('taxi_pickup_times_dispatch',{p_day:day,p_service:service,p_minutes:requiredJourneyMinutes,p_vehicle:document.getElementById('vehicleType').value});
  if(revision!==availabilityRevision)return;
  availableSlots=rows.map(s=>({...s,id:s.slot_id+'|'+s.pickup_at}));
  slotSelect.replaceChildren(new Option(rows.length?'Choose your pickup time':'No pickup times available',''));
  const clock=iso=>new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Brussels',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(iso));
  for(const s of availableSlots)slotSelect.add(new Option(clock(s.pickup_at),s.id));
  if(availableSlots.some(s=>s.id===previous))slotSelect.value=previous;
  if(!rows.length)bookingNotice('No times fit this journey. Please choose another date.');
 }catch(error){if(revision===availabilityRevision){slotSelect.replaceChildren(new Option('Could not load times',''));bookingNotice(error.message);}}
}
function invalidateBookingQuote(){currentQuote=null;updateActionButtons();}
window.updateActionButtons=function(){};
