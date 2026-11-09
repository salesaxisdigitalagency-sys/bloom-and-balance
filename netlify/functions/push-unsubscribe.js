'use strict';
const S=require('./_shared.cjs');
exports.handler=async event=>{
 if(event.httpMethod!=='POST')return S.json(405,{error:'POST only'});
 try{
  const {user}=await S.auth(event);
  const body=S.parse(event,6000);
  const endpoint=String(body.endpoint||'');
  if(!endpoint.startsWith('https://'))return S.json(400,{error:'Invalid subscription'});
  await S.rest('bloom_push_subscriptions?user_id=eq.'+encodeURIComponent(user.id)+'&endpoint=eq.'+encodeURIComponent(endpoint),{
   method:'DELETE',service:true,prefer:'return=minimal'
  });
  return S.json(200,{removed:true});
 }catch(e){return S.fail(e)}
};
