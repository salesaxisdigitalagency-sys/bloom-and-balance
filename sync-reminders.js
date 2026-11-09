'use strict';
const S=require('./_shared.cjs');
exports.handler=async event=>{
 if(event.httpMethod!=='POST')return S.json(405,{error:'POST only'});
 try{
  const {user}=await S.auth(event);
  const {reminders=[]}=S.parse(event,50000);
  if(!Array.isArray(reminders)||reminders.length>500)return S.json(400,{error:'Too many reminders'});
  const state=S.ensure(await S.getState(user.id)||{});
  const validItems=new Set([...state.tasks.filter(x=>x.reminder&&!x.done).map(x=>'task:'+x.id),...state.notes.filter(x=>x.reminderAt).map(x=>'note:'+x.id)]);
  const existing=await S.rest('bloom_reminders?select=id,remind_at,sent_at&user_id=eq.'+encodeURIComponent(user.id),{service:true});
  const rows=reminders.filter(r=>validItems.has(r.id)&&String(r.title||'').length<=180&&String(r.body||'').length<=400&&
    Number.isFinite(Date.parse(r.at))&&Date.parse(r.at)<Date.now()+366*864e5)
    .map(r=>{
     const prior=existing.find(x=>x.id===user.id+':'+r.id);
     const iso=new Date(r.at).toISOString();
     return {id:user.id+':'+r.id,user_id:user.id,title:String(r.title).slice(0,180),
       body:String(r.body||'').slice(0,400),remind_at:iso,
       sent_at:prior&&new Date(prior.remind_at).getTime()===new Date(iso).getTime()?prior.sent_at:null};
    });
  if(existing.length){
   const keep=new Set(rows.map(x=>x.id));
   const remove=existing.filter(x=>!keep.has(x.id));
   for(const r of remove)await S.rest('bloom_reminders?id=eq.'+encodeURIComponent(r.id),{method:'DELETE',service:true,prefer:'return=minimal'});
  }
  if(rows.length)await S.rest('bloom_reminders?on_conflict=id',{method:'POST',service:true,body:rows,prefer:'resolution=merge-duplicates,return=minimal'});
  return S.json(200,{saved:true,count:rows.length});
 }catch(e){return S.fail(e)}
};
