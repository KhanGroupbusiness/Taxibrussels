'use strict';
(()=>{
 let selectedTrip='',quoteSequence=0;
 const field=id=>document.getElementById(id).value.trim();
 const snapshot=()=>JSON.stringify({slot_id:slotSelect.value,pickup:field('pickup'),dropoff:field('dropoff'),vehicle:field('vehicleType'),service:field('bookingType')==='day-trip'?'Day Trip':'Transfer',trip:selectedTrip});
 async function call(body){
  const {data,error}=await TaxiAPI.client.functions.invoke('booking-checkout',{body});
  if(error){let detail;try{detail=await error.context?.json();}catch{}throw Error(detail?.error||error.message);}
  if(data?.error)throw Error(data.error);return data;
 }
 async function quote(){
  if(!slotSelect.value){bookingNotice('Choose a date and an available pickup window first.');return;}
  const serial=++quoteSequence,state=snapshot();currentQuote=null;
  bookingNotice('Calculating your fare…');
  try{
   const payload=JSON.parse(state),q=await call({action:'quote',...payload});
   if(serial!==quoteSequence||snapshot()!==state)return;
   setQuote({type:payload.service,title:payload.service==='Day Trip'?selectedTrip:'Transfer',origin:payload.pickup,destination:payload.dropoff,distance:q.distance,duration:q.duration,price:q.price,extras:['Payment in test mode','Subject to driver approval'],quote_token:q.quote_token,expires_at:q.expires_at,serverSnapshot:state});
   bookingNotice('Review your fare, enter your details, then accept and pay. Your ride still needs driver approval.');
  }catch(e){if(serial===quoteSequence)bookingNotice(e.message);}
 }
 window.calculateTransfer=quote;
 window.selectDayTrip=async(title,origin,destination,_price,duration)=>{
  selectedTrip=title;++quoteSequence;
  document.getElementById('bookingType').value='day-trip';
  document.getElementById('pickup').value=origin;document.getElementById('dropoff').value=destination;
  currentQuote={type:'Day Trip',duration};
  document.getElementById('quoteBox').textContent='Choose a date and pickup window to calculate this day trip.';
  await refreshAvailability();currentQuote=null;
  document.getElementById('booking').scrollIntoView({behavior:'smooth'});
 };
 slotSelect.addEventListener('change',()=>{if(slotSelect.value)quote();});
 document.getElementById('bookingType').addEventListener('change',()=>{selectedTrip='';++quoteSequence;});
 for(const id of ['pickup','dropoff','vehicleType','date'])document.getElementById(id).addEventListener('input',()=>{++quoteSequence;currentQuote=null;});
 window.saveBooking=async()=>{
  if(requestBusy)return;
  if(!currentQuote?.quote_token||currentQuote.serverSnapshot!==snapshot()||Date.parse(currentQuote.expires_at)<=Date.now()){bookingNotice('Calculate a fresh fare for the selected pickup window first.');return;}
  if(!field('customerName')||field('customerName').length<2||field('customerPhone').length<6||!field('customerEmail')||!document.getElementById('customerEmail').checkValidity()){bookingNotice('Enter your name, phone and valid email.');return;}
  if(!document.getElementById('bookingConsent').checked){bookingNotice('Please acknowledge how your details are used.');return;}
  requestBusy=true;const button=document.getElementById('requestBooking');button.disabled=true;
  bookingNotice('Opening secure test checkout…');
  try{
   const data=await call({action:'checkout',quote_token:currentQuote.quote_token,customer:{name:field('customerName'),phone:field('customerPhone'),email:field('customerEmail'),passengers:Number(field('passengers')),luggage:Number(field('luggage')),notes:field('notes')}});
   const target=new URL(data.url);if(target.protocol!=='https:'||target.hostname!=='checkout.stripe.com')throw Error('Invalid checkout URL.');
   sessionStorage.setItem('taxiLastBooking',data.booking_id);window.location.assign(target.href);
  }catch(e){bookingNotice(e.message);}finally{requestBusy=false;button.disabled=false;}
 };
 const returned=new URLSearchParams(location.search).get('payment');
 if(returned){const ref=sessionStorage.getItem('taxiLastBooking');document.getElementById('quoteBox').textContent=(returned==='processing'?'Checkout completed. Payment confirmation is being processed. Your ride still needs driver approval.':'Checkout cancelled. No ride is confirmed. The pickup window is released after checkout expires (about 31 minutes).')+(ref?' Booking reference: '+ref:'');}
})();
