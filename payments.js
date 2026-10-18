'use strict';
(()=>{
 let sequence=0,timer,selectedTrip='',quoteBusy=false;
 const el=id=>document.getElementById(id),value=id=>el(id).value.trim();
 const service=()=>value('bookingType')==='day-trip'?'Day Trip':'Transfer';
 const slot=()=>availableSlots.find(s=>s.id===slotSelect.value);
 const state=()=>JSON.stringify({selection:slotSelect.value,pickup:value('pickup'),dropoff:value('dropoff'),vehicle:value('vehicleType'),service:service(),trip:selectedTrip});
 const money=n=>new Intl.NumberFormat('en-BE',{style:'currency',currency:'EUR'}).format(n);
 function clearQuote(message='Enter your journey and choose a pickup time to see your fare.'){
  currentQuote=null;el('quoteBox').replaceChildren();const p=document.createElement('p');p.textContent=message;el('quoteBox').append(p);updateActionButtons();
 }
 window.updateActionButtons=()=>{
  const button=el('requestBooking');button.disabled=requestBusy||quoteBusy||!currentQuote?.quote_token;
  button.textContent=requestBusy?'Opening secure payment…':quoteBusy?'Calculating your fare…':currentQuote?.quote_token?'Continue to payment — '+money(currentQuote.price):'Continue to payment';
 };
 window.renderQuote=()=>{
  const box=el('quoteBox');box.replaceChildren();
  const label=document.createElement('span');label.className='fare-label';label.textContent='Your fare';
  const price=document.createElement('strong');price.className='big-price';price.textContent=money(currentQuote.price);
  const detail=document.createElement('p');detail.className='small';detail.textContent=currentQuote.type==='Day Trip'?currentQuote.duration+' · '+selectedTrip:currentQuote.distance+' · about '+currentQuote.duration;
  box.append(label,price,detail);
 };
 async function call(body){
  const {data,error}=await TaxiAPI.client.functions.invoke('booking-checkout',{body});
  if(error){let detail;try{detail=await error.context?.json();}catch{}const e=new Error(detail?.error||error.message);e.requiredMinutes=detail?.required_minutes;throw e;}
  if(data?.error)throw Error(data.error);return data;
 }
 async function quote(){
  const selected=slot();
  if(!selected||!value('pickup')||!value('dropoff')){clearQuote();return;}
  if(service()==='Day Trip'&&!selectedTrip){clearQuote('Choose a day trip above first.');return;}
  const serial=++sequence,snapshot=state();quoteBusy=true;clearQuote('Calculating your fare…');bookingNotice('');
  try{
   const q=await call({action:'quote',slot_id:selected.slot_id,pickup_at:selected.pickup_at,pickup:value('pickup'),dropoff:value('dropoff'),vehicle:value('vehicleType'),service:service(),trip:selectedTrip});
   if(serial!==sequence||state()!==snapshot)return;
   if(q.required_minutes!==requiredJourneyMinutes){requiredJourneyMinutes=q.required_minutes;await refreshAvailability(true);if(serial!==sequence||state()!==snapshot)return;}
   // The server validates expiry at checkout. Never trust the device wall clock.
   currentQuote={type:service(),title:selectedTrip||'Transfer',origin:value('pickup'),destination:value('dropoff'),distance:q.distance,duration:q.duration,price:q.price,quote_token:q.quote_token,serverSnapshot:snapshot};
   renderQuote();bookingNotice('');
  }catch(e){if(serial===sequence){clearQuote('Your fare could not be calculated.');bookingNotice(e.message);if(e.requiredMinutes){requiredJourneyMinutes=e.requiredMinutes;await refreshAvailability(true);}}}
  finally{if(serial===sequence){quoteBusy=false;updateActionButtons();}}
 }
 function scheduleQuote(resetDuration=false){++sequence;quoteBusy=false;clearTimeout(timer);if(resetDuration)requiredJourneyMinutes=service()==='Day Trip'?240:60;clearQuote();timer=setTimeout(async()=>{if(resetDuration)await refreshAvailability(true);quote();},500);}
 for(const id of ['pickup','dropoff','vehicleType'])for(const event of ['input','change'])el(id).addEventListener(event,()=>scheduleQuote(true));
 el('date').addEventListener('change',async()=>{++sequence;quoteBusy=false;clearQuote();await refreshAvailability();});
 el('bookingType').addEventListener('change',async()=>{++sequence;quoteBusy=false;selectedTrip='';requiredJourneyMinutes=service()==='Day Trip'?240:60;clearQuote(service()==='Day Trip'?'Choose a day trip above.':undefined);await refreshAvailability();});
 slotSelect.addEventListener('change',()=>{clearTimeout(timer);quote();});
 window.calculateTransfer=quote;
 window.selectDayTrip=async(title,origin,destination)=>{
  ++sequence;quoteBusy=false;selectedTrip=title;requiredJourneyMinutes=240;
  el('bookingType').value='day-trip';el('pickup').value=origin;el('dropoff').value=destination;
  clearQuote('Choose a date and pickup time for your 4-hour '+title+'.');
  await refreshAvailability();el('booking').scrollIntoView({behavior:'smooth'});
 };
 window.saveBooking=async()=>{
  if(requestBusy||quoteBusy)return;
  if(!currentQuote?.quote_token||currentQuote.serverSnapshot!==state()){await quote();return;}
  for(const id of ['customerName','customerPhone','customerEmail','passengers','luggage'])if(!el(id).reportValidity())return;
  if(value('customerName').length<2||value('customerPhone').length<6){bookingNotice('Enter your name and phone number.');return;}
  if(!el('bookingConsent').checked){bookingNotice('Please accept the booking terms before continuing.');el('bookingConsent').focus();return;}
  requestBusy=true;updateActionButtons();bookingNotice('Opening secure test payment…');
  try{
   const data=await call({action:'checkout',quote_token:currentQuote.quote_token,customer:{name:value('customerName'),phone:value('customerPhone'),email:value('customerEmail'),passengers:Number(value('passengers')),luggage:Number(value('luggage')),notes:value('notes')}});
   const target=new URL(data.url);if(target.protocol!=='https:'||target.hostname!=='checkout.stripe.com')throw Error('Invalid checkout URL.');
   try{sessionStorage.setItem('taxiLastBooking',data.booking_id);}catch{}
   window.location.assign(target.href);
  }catch(e){bookingNotice(e.message);if(/quote expired/i.test(e.message)){await quote();bookingNotice('Your fare has been refreshed. Review it and continue to payment.');}}
  finally{requestBusy=false;updateActionButtons();}
 };
 clearQuote();refreshAvailability();
 const returned=new URLSearchParams(location.search).get('payment');
 if(returned){let ref='';try{ref=sessionStorage.getItem('taxiLastBooking')||'';}catch{}bookingNotice((returned==='processing'?'Payment is being confirmed. Your ride still needs driver approval.':'Payment cancelled. The selected time is released when checkout expires.')+(ref?' Reference: '+ref:''));}
})();
