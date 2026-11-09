'use strict';
const S=require('./_shared.cjs');
exports.handler=async event=>{
 if(event.httpMethod!=='POST')return S.json(405,{error:'POST only'});
 try{
  const {user}=await S.auth(event);
  if(!process.env.VAPID_PUBLIC_KEY||!process.env.VAPID_PRIVATE_KEY) return S.json(503,{error:'Push notifications are not configured on this Netlify site.'});
  const body=S.parse(event,14000);
  const sub=body.subscription;
  if(!sub?.endpoint?.startsWith('https://')||typeof sub?.keys?.auth!=='string'||typeof sub?.keys?.p256dh!=='string')return S.json(400,{error:'Invalid push subscription'});
  if(sub.endpoint.length>1400)return S.json(400,{error:'Push endpoint too long'});
  await S.rest('bloom_push_subscriptions?on_conflict=endpoint',{service:true,method:'POST',body:{user_id:user.id,endpoint:sub.endpoint,subscription:sub},prefer:'resolution=merge-duplicates,return=minimal'});
  return S.json(200,{saved:true});
 }catch(e){return S.fail(e)}
};
