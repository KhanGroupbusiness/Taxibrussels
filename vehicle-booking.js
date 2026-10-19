'use strict';
(()=>{
 const vehicle=document.getElementById('vehicleType'),pax=document.getElementById('passengers');
 function sync(){const van=vehicle.value==='van';pax.max=van?'8':'3';if(Number(pax.value)>Number(pax.max))pax.value=pax.max;document.querySelectorAll('[data-vehicle]').forEach(b=>{const on=b.dataset.vehicle===vehicle.value;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on));});}
 vehicle.addEventListener('change',sync);
 document.querySelectorAll('[data-vehicle]').forEach(b=>b.addEventListener('click',()=>{vehicle.value=b.dataset.vehicle;sync();vehicle.dispatchEvent(new Event('change',{bubbles:true}));}));
 document.querySelectorAll('[data-route-pickup]').forEach(b=>b.addEventListener('click',()=>{const type=document.getElementById('bookingType');type.value='transfer';type.dispatchEvent(new Event('change',{bubbles:true}));document.getElementById('pickup').value=b.dataset.routePickup;document.getElementById('dropoff').value=b.dataset.routeDropoff;document.getElementById('pickup').dispatchEvent(new Event('change',{bubbles:true}));document.getElementById('date').focus();}));sync();
})();
