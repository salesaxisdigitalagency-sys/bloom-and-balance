// Deterministic mocked integration tests (no real API keys or external network).
const assert=require('node:assert/strict');
process.env.SUPABASE_URL='https://test.supabase.co';
process.env.SUPABASE_ANON_KEY='public-test-key';
process.env.SUPABASE_SERVICE_ROLE_KEY='test-private-key';
process.env.OPENAI_API_KEY='test-ai-key';
const userid='00000000-0000-4000-8000-000000000001';
const user={id:userid,email:'bella@example.com'};
let remote={settings:{name:'Bella',currency:'NGN'},tasks:[{id:'task-001',title:'Read chapter 1',date:'2026-11-10',time:'20:00',priority:'high',done:false}],transactions:[],notes:[],memory:[],priorityCategories:[],habits:[],projects:[],goals:[],budgets:[]};
let aiSteps=[],seenRequests=[],failSaveOnce=false;
const res=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
global.fetch=async (url,opts={})=>{
  url=String(url);seenRequests.push({url,opts});
  if(url.endsWith('/auth/v1/user'))return res(user);
  if(url.includes('/rpc/bloom_charge_request'))return res(true);
  if(url.includes('/rest/v1/bloom_states')){
    if((opts.method||'GET')==='POST'){if(failSaveOnce){failSaveOnce=false;return res({message:'Test database failure'},500)}const body=JSON.parse(opts.body);remote=body.state;return new Response(null,{status:204});}
    return res([{state:remote}]);
  }
  if(url.endsWith('/v1/chat/completions')){
    const req=JSON.parse(opts.body);
    const next=aiSteps.shift();
    if(!next)throw new Error('Mock AI has no response');
    return res({choices:[{message:next}],usage:{total_tokens:300}});
  }
  throw new Error('Unexpected fetch: '+url);
};
const fn=require('../netlify/functions/ai.js');
const call=async text=>JSON.parse((await fn.handler({httpMethod:'POST',headers:{authorization:'Bearer valid-token'},
  body:JSON.stringify({today:'2026-11-09',timezone:'Africa/Lagos',messages:[{role:'user',content:text}]})})).body);
const tool=(id,name,args)=>({id,type:'function',function:{name,arguments:JSON.stringify(args)}});
(async()=>{
  aiSteps=[
    {role:'assistant',content:null,tool_calls:[tool('x1','list_tasks',{from:'2026-11-10'})]},
    {role:'assistant',content:'Tomorrow you have Read chapter 1 at 8 PM.'}
  ];
  let r=await call('What do I have tomorrow?');
  assert.equal(r.reply,'Tomorrow you have Read chapter 1 at 8 PM.');
  assert.equal(r.changes.length,0);
  assert.equal(remote.tasks.length,1);
  aiSteps=[
    {role:'assistant',content:null,tool_calls:[tool('x2','create_task',{title:'Study for mathematics',date:'2026-11-11',time:'20:00',priority:'high'})]},
    {role:'assistant',content:'Scheduled your mathematics study on Wednesday at 8 PM.'}
  ];
  r=await call('Add mathematics study Wednesday at 8pm');
  assert.equal(r.changes.length,1);
  assert.equal(remote.tasks.length,2);
  assert.equal(remote.tasks[1].title,'Study for mathematics');
  assert.equal(remote.tasks[1].date,'2026-11-11');
  const id=remote.tasks[1].id;
  aiSteps=[
    {role:'assistant',content:null,tool_calls:[tool('x3','update_task',{id,date:'2026-11-13'})]},
    {role:'assistant',content:'Moved the mathematics study task to Friday.'}
  ];
  r=await call('Move that task to Friday');
  assert.equal(r.changes.length,1);
  assert.equal(remote.tasks[1].date,'2026-11-13');
  aiSteps=[
    {role:'assistant',content:null,tool_calls:[tool('x4','save_note',{title:'An idea',body:'Track study hours every week',date:'2026-11-09'})]},
    {role:'assistant',content:'I saved your idea in Notes.'}
  ];
  r=await call('Remember this idea: track study hours');
  assert.equal(remote.notes.length,1);
  assert.equal(r.changes.length,1);
  aiSteps=[
    {role:'assistant',content:null,tool_calls:[tool('x5','create_task',{title:'Incorrect no date'})]},
    {role:'assistant',content:'What date would you like to schedule that for?'}
  ];
  r=await call('Add task with no date');
  assert.equal(r.changes.length,0);
  assert.equal(remote.tasks.length,2);
  assert.match(r.reply,/What date/);

  aiSteps=[
    {role:'assistant',content:null,tool_calls:[tool('x6','record_transaction',{type:'expense',amount:2500,category:'Transport',note:'Taxi fare',date:'2026-11-09'})]},
    {role:'assistant',content:'Recorded your 2500 transport expense.'}
  ];
  r=await call('Record 2500 transport expenses today');
  assert.equal(r.changes.length,1);
  assert.equal(remote.transactions[0].amount,2500);
  aiSteps=[
    {role:'assistant',content:null,tool_calls:[tool('x7','get_finances',{from:'2026-11-01',to:'2026-11-09'})]},
    {role:'assistant',content:'You spent 2500 on transport this month.'}
  ];
  r=await call('How much have I spent this month?');
  assert.equal(r.changes.length,0);
  aiSteps=[
    {role:'assistant',content:null,tool_calls:[tool('x8','set_task_reminder',{id,mode:'minutes',minutesBefore:10})]},
    {role:'assistant',content:'I set your reminder for 10 minutes before your mathematics study.'}
  ];
  r=await call('Remind me 10 minutes before mathematics study');
  assert.equal(r.changes.length,1);
  assert.equal(remote.tasks.find(x=>x.id===id).reminder.minutes,10);
  aiSteps=[
    {role:'assistant',content:null,tool_calls:[tool('x9','remember_preference',{key:'study time',value:'8 PM'})]},
    {role:'assistant',content:'I will remember your preferred study time is 8 PM.'}
  ];
  r=await call('Please remember my study time is 8 PM');
  assert.equal(remote.memory[0].value,'8 PM');
  // If a database write fails, Bloom MUST NOT claim the action was saved.
  failSaveOnce=true;
  aiSteps=[
    {role:'assistant',content:null,tool_calls:[tool('x10','create_task',{title:'Unsaved task',date:'2026-11-12'})]},
    {role:'assistant',content:'I saved the task.'}
  ];
  r=await call('Create unsaved task');
  assert.equal(r.changes.length,0);
  assert.doesNotMatch(r.reply,/I saved the task/i);
  assert.equal(remote.tasks.filter(x=>x.title==='Unsaved task').length,0);

  const anon=await fn.handler({httpMethod:'POST',headers:{},body:JSON.stringify({messages:[{role:'user',content:'hello'}]})});
  assert.equal(anon.statusCode,401);
  console.log('PASS: schedule retrieval; create/edit task; note save; expense recording/analysis; reminders; saved preference; missing-date rejection; failed-write safety; authentication.');
})().catch(err=>{console.error(err);process.exit(1)});
