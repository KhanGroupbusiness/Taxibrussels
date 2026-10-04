'use strict';
let availableSlots = [];
let availabilityRevision = 0;
let requestBusy = false;
const bookingStatus = document.getElementById('bookingStatus');
const slotSelect = document.getElementById('availableSlot');
function bookingNotice(message) { bookingStatus.textContent=message; }
async function refreshAvailability() {
 const revision=++availabilityRevision;
 slotSelect.replaceChildren(new Option('Choose a date first',''));
 availableSlots=[];
 if (!TaxiAPI.ready) { bookingNotice('Online booking is being configured. Requests are not open yet.'); return; }
 const day=document.getElementById('date').value;
 if(!day) return;
 slotSelect.replaceChildren(new Option('Checking available times…',''));
 try {
  const rows=await TaxiAPI.rpc('taxi_availability',{p_day:day,p_service:document.getElementById('bookingType').value==='day-trip'?'Day Trip':'Transfer'});
  if(revision!==availabilityRevision) return;
  const hours=currentQuote?.type==='Day Trip'?parseFloat(currentQuote.duration):0;
  availableSlots=rows.filter(s=>!hours || (Date.parse(s.ends_at)-Date.parse(s.starts_at))/3600000>=hours);
  slotSelect.replaceChildren(new Option(availableSlots.length?'Select an available pickup time':'No available times for this date',''));
  for(const s of availableSlots) slotSelect.add(new Option(`${TaxiAPI.format(s.starts_at)} — reserved until ${TaxiAPI.format(s.ends_at)}${s.label?' · '+s.label:''}`,s.id));
  bookingNotice(availableSlots.length?'Your request needs driver approval. No payment is taken now.':'Try another date. Only published availability is bookable.');
 } catch(e) { if(revision===availabilityRevision){slotSelect.replaceChildren(new Option('Availability unavailable',''));bookingNotice(e.message);} }
}
function invalidateBookingQuote() {
 currentQuote=null;
 document.getElementById('quoteBox').textContent='Calculate your transfer or select a day trip again after changing the route, vehicle or time.';
}
slotSelect.addEventListener('change',()=>{
 const s=availableSlots.find(x=>x.id===slotSelect.value);
 if(s){
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Brussels',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(s.starts_at));
  document.getElementById('time').value=parts;
  if(currentQuote?.type==='Transfer') invalidateBookingQuote();
 }
});
for(const id of ['date','bookingType']) document.getElementById(id).addEventListener('change',()=>{invalidateBookingQuote();refreshAvailability();});
for(const id of ['pickup','dropoff','vehicleType']) document.getElementById(id).addEventListener('input',invalidateBookingQuote);
window.saveBooking = async function() {
 if(requestBusy) return;
 if(!TaxiAPI.ready) {bookingNotice('Online booking is not connected yet.');return;}
 const slot=availableSlots.find(x=>x.id===slotSelect.value);
 if(!slot || !currentQuote) {bookingNotice('Choose an available pickup time, then calculate a transfer or select a day trip.');return;}
 const value=id=>document.getElementById(id).value.trim();
 const name=value('customerName'), phone=value('customerPhone'), email=value('customerEmail');
 if(name.length<2 || phone.length<6 || !document.getElementById('customerEmail').checkValidity() || !email) {bookingNotice('Enter your name, valid email and phone number.');return;}
 if(!document.getElementById('bookingConsent').checked) {bookingNotice('Please acknowledge how your booking details will be used.');return;}
 const button=document.getElementById('requestBooking');
 requestBusy=true; button.disabled=true; bookingNotice('Submitting your request…');
 try {
  const id=await TaxiAPI.rpc('taxi_request',{p_slot:slot.id,p_name:name,p_phone:phone,p_email:email,p_pickup:value('pickup'),p_dropoff:value('dropoff'),p_passengers:Number(value('passengers')),p_luggage:Number(value('luggage')),p_notes:value('notes'),p_service:currentQuote.type,p_trip:currentQuote.type==='Day Trip'?currentQuote.title:'',p_price:currentQuote.price});
  await refreshAvailability();
  bookingNotice(`Request received. Reference: ${id}. Your ride is pending driver approval. Keep this reference; the driver will contact you after review. No payment has been taken.`);
 } catch(e) {await refreshAvailability();bookingNotice(e.message);}
 finally {requestBusy=false;button.disabled=false;}
};
// Quotes remain indicative until the driver confirms the route and final fare.
window.updateActionButtons=function() {};
const originalSelectDayTrip=window.selectDayTrip;
window.selectDayTrip=function(...args){originalSelectDayTrip(...args);refreshAvailability();};
refreshAvailability();
