'use strict';
const URLBASE = () => (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const ANON = () => process.env.SUPABASE_ANON_KEY || '';
const SERVICE = () => process.env.SUPABASE_SERVICE_ROLE_KEY || '';
function json(status, value, headers={}) {
  return {statusCode: status, headers: {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store', ...headers},body: JSON.stringify(value)};
}
function parse(event,max=25000) {
  if (!event.body || event.body.length > max) throw new Error('Request exceeds allowed size or is empty');
  return JSON.parse(event.body);
}
async function rest(path, options={}) {
  const {token, service=false, method='GET', body, prefer='return=representation'}=options;
  const key=service?SERVICE():ANON();
  if (!URLBASE()||!key) throw new Error('Cloud database configuration is missing');
  const r=await fetch(URLBASE()+'/rest/v1/'+path, {
    method,
    headers:{apikey:key,Authorization:'Bearer '+(service?key:token),
      'Content-Type':'application/json',Prefer:prefer},
    body: body === undefined ? undefined:JSON.stringify(body)
  });
  const txt=await r.text();
  const data=txt?JSON.parse(txt):null;
  if(!r.ok) throw new Error('Cloud database operation failed ('+r.status+'): '+(data?.message||data?.error||'unknown error'));
  return data;
}
async function auth(event) {
  const header=event.headers.authorization || event.headers.Authorization || '';
  const token=header.match(/^Bearer (.+)$/i)?.[1];
  if (!token) throw Object.assign(new Error('Please sign in to Bloom first.'),{status:401});
  if(!URLBASE()||!ANON()) throw Object.assign(new Error('Bloom cloud account is not configured.'),{status:503});
  const r=await fetch(URLBASE()+'/auth/v1/user',{headers:{apikey:ANON(),Authorization:'Bearer '+token}});
  if(!r.ok) throw Object.assign(new Error('Your sign-in expired. Please sign in again.'),{status:401});
  const user=await r.json();
  if(!user?.id) throw Object.assign(new Error('Unauthorized'),{status:401});
  return {token,user};
}
async function getState(userId) {
  const rows=await rest('bloom_states?select=state&user_id=eq.'+encodeURIComponent(userId)+'&limit=1',{service:true});
  return rows[0]?.state||null;
}
async function saveState(userId,state) {
  await rest('bloom_states?on_conflict=user_id',{method:'POST',service:true,
    body:{user_id:userId,state,updated_at:new Date().toISOString()},prefer:'resolution=merge-duplicates,return=minimal'});
}
function fail(error) {
  console.error('Bloom function:',error?.message);
  return json(error.status||500,{error:error.status?error.message:'Something went wrong on the secure server. Please try again.'});
}
function validDate(s) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s||'')) return false;
  const date=new Date(s+'T12:00:00Z');
  return !isNaN(date.valueOf())&&date.toISOString().slice(0,10)===s;
}
function validTime(s){return typeof s==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(s);}
function trim(s,limit=120){return String(s??'').trim().slice(0,limit);}
function number(v){return Number(v);}
function uid(){return crypto.randomUUID();}
function ensure(state){
  for(const k of ['tasks','transactions','budgets','goals','projects','habits','priorityCategories','notes','memory']) if(!Array.isArray(state[k]))state[k]=[];
  if(!state.settings||typeof state.settings!=='object')state.settings={};
  return state;
}
module.exports={json,parse,rest,auth,getState,saveState,fail,validDate,validTime,trim,number,uid,ensure};
