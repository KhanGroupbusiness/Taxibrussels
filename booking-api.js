'use strict';
window.TaxiAPI = (() => {
 const config = window.TAXI_CONFIG || {};
 const ready = /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.supabaseUrl || '') && !!config.publishableKey;
 const client = ready && window.supabase ? window.supabase.createClient(config.supabaseUrl, config.publishableKey, {auth:{persistSession:true}}) : null;
 async function rpc(name, args) {
  if (!client) throw new Error('Online booking is not yet connected. Please return later.');
  const {data,error} = await client.rpc(name,args);
  if (error) throw new Error(error.message);
  return data;
 }
 const format = iso => new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Brussels',dateStyle:'medium',timeStyle:'short'}).format(new Date(iso));
 // Reject nonexistent and ambiguous local times at daylight-saving transitions.
 function brusselsISO(local) {
  const base = Date.parse(local+'Z');
  if (!Number.isFinite(base)) throw new Error('Choose a valid date and time.');
  const fmt = new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Brussels',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  const matches=[1,2].map(h=>new Date(base-h*3600000)).filter(d=>fmt.format(d).replace(' ','T')===local);
  if(matches.length!==1) throw new Error('This time is ambiguous or unavailable due to the clock change. Choose a different hour.');
  return matches[0].toISOString();
 }
 return {client,ready:!!client,rpc,format,brusselsISO};
})();
