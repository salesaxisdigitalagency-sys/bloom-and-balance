'use strict';
const webpush=require('web-push');
const S=require('./_shared.cjs');
exports.handler=async ()=>{
 try{
  if(!process.env.VAPID_PUBLIC_KEY||!process.env.VAPID_PRIVATE_KEY||!process.env.VAPID_SUBJECT) return S.json(503,{error:'VAPID keys are missing'});
  webpush.setVapidDetails(process.env.VAPID_SUBJECT,process.env.VAPID_PUBLIC_KEY,process.env.VAPID_PRIVATE_KEY);
  const now=new Date();
  const due=await S.rest('bloom_reminders?select=id,user_id,title,body,remind_at&sent_at=is.null&remind_at=lte.'+encodeURIComponent(now.toISOString())+
   '&remind_at=gte.'+encodeURIComponent(new Date(Date.now()-4*60*60*1000).toISOString())+'&limit=300',{service:true});
  let sent=0;
  for(const r of due){
   const subs=await S.rest('bloom_push_subscriptions?select=endpoint,subscription&user_id=eq.'+r.user_id,{service:true});
   let delivered=false;
   for(const s of subs){
    try{
     await webpush.sendNotification(s.subscription,JSON.stringify({title:r.title,body:r.body,tag:r.id,url:'/'}));
     delivered=true;sent++;
    }catch(e){
     if([404,410].includes(e.statusCode))
       await S.rest('bloom_push_subscriptions?endpoint=eq.'+encodeURIComponent(s.endpoint),{service:true,method:'DELETE',prefer:'return=minimal'});
    }
   }
   // Mark once at least one device accepted push. No subscription -> leave pending during retry window.
   if(delivered) await S.rest('bloom_reminders?id=eq.'+encodeURIComponent(r.id),{service:true,method:'PATCH',body:{sent_at:now.toISOString()},prefer:'return=minimal'});
  }
  return S.json(200,{due:due.length,delivered:sent});
 }catch(e){return S.fail(e)}
};
exports.config={schedule:"* * * * *"};
