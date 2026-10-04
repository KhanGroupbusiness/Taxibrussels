'use strict';
(()=>{
 const form=document.getElementById('pricingForm');if(!form)return;
 const el=id=>document.getElementById(id),notice=text=>el('pricingStatus').textContent=text;
 let version=null,loaded=false,busy=false;
 for(const field of TaxiPricing.fields){
  const label=document.createElement('label');label.textContent=field.label;
  const input=document.createElement('input');input.id='price-'+field.key;input.type='number';input.min=field.min;input.max=field.max;input.step='0.01';input.required=true;label.append(input);el(field.key.startsWith('trip_')?'tripPriceFields':'otherPriceFields').append(label);
 }
 async function access(){const {data:{session},error}=await TaxiAPI.client.auth.getSession();if(error)throw error;if(!session||!await TaxiAPI.rpc('taxi_is_admin',{}))throw new Error('Sign in with driver access first.');}
 async function load(){
  if(busy)return;busy=true;el('reloadPrices').disabled=true;
  try{await access();const values=await TaxiPricing.load();for(const field of TaxiPricing.fields)el('price-'+field.key).value=values[field.key];version=values.updated_at;loaded=true;el('pricingFields').disabled=false;notice('Published prices loaded. Edit a fare, then save to publish your changes.');}
  catch(error){el('pricingFields').disabled=true;loaded=false;notice('Could not load prices. Run pricing-upgrade.sql once in Supabase, then try Load published prices. '+error.message);}
  finally{busy=false;el('reloadPrices').disabled=false;}
 }
 el('reloadPrices').addEventListener('click',load);
 document.addEventListener('taxi-dashboard-loaded',()=>{if(!loaded)load();});
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!loaded)return;busy=true;el('pricingFields').disabled=true;el('reloadPrices').disabled=true;
  try{
   await access();const values=TaxiPricing.validate(Object.fromEntries(TaxiPricing.fields.map(f=>[f.key,el('price-'+f.key).value])));
   const {data,error}=await TaxiAPI.client.from('taxi_pricing').update(values).eq('id',1).eq('updated_at',version).select('*').single();
   if(error)throw error;version=data.updated_at;notice('Prices published. New visitors and refreshed booking pages will use these fares. Existing bookings are unchanged.');
  }catch(error){notice('Prices were not saved. If another device edited them, load the latest prices and try again. '+error.message);}
  finally{busy=false;el('pricingFields').disabled=false;el('reloadPrices').disabled=false;}
 });
 if(window.taxiDashboardData)load();
})();
