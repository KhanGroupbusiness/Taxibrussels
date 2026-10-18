'use strict';
(()=>{
 const tabs=[...document.querySelectorAll('[data-view]')];
 function show(view){for(const section of document.querySelectorAll('.driver-view'))section.hidden=section.id!=='view-'+view;for(const tab of tabs)tab.setAttribute('aria-pressed',String(tab.dataset.view===view));document.getElementById('rideSearch').closest('label').hidden=['availability','pricing'].includes(view);}
 for(const tab of tabs)tab.addEventListener('click',()=>show(tab.dataset.view));
 const search=document.getElementById('rideSearch');
 function filter(){const term=search.value.trim().toLowerCase();for(const card of document.querySelectorAll('[data-search]'))card.hidden=!card.dataset.search.includes(term);}
 search.addEventListener('input',filter);
 function updateCounts(){document.getElementById('approvalCount').textContent=document.querySelectorAll('#bookingsList article').length;document.getElementById('upcomingCount').textContent=document.querySelectorAll('#upcomingList article').length;filter();}
 document.addEventListener('taxi-rides-rendered',updateCounts);
 show('approvals');updateCounts();
})();
