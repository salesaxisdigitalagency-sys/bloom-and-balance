/* Bloom & Balance — Netlify static edition. Your data stays in this browser. */
(() => {
'use strict';
const STORAGE_KEY='bloom-and-balance-v1';
const CATEGORIES=['Food','Transport','Bills','Shopping','Business','Health','Education','Entertainment','Savings','Salary','Freelance','Gifts','Other'];
const VIEWS=['home','planner','notes','priorities','finances','projects','habits','insights','settings'];
const VIEW_TITLES={home:'My overview',planner:'Daily planner',notes:'Notes & journal',priorities:'My priorities',finances:'My finances',projects:'My projects',habits:'Habits & routines',insights:'My insights',settings:'Settings & backups'};
const initialState=()=>({version:1,settings:{name:'Bella',currency:'NGN',notifications:false,voiceReminders:false,alertTone:'soft'},tasks:[],transactions:[],budgets:[],goals:[],projects:[],habits:[],priorityCategories:[],notes:[],memory:[]});
let state=readState();
let currentView='home';
let selectedDay=localDay();
let transactionFilter='all';
let modalType=null, modalId=null;
let toastTimer;
let alerted=new Set();
const $=selector=>document.querySelector(selector);
const $$=selector=>Array.from(document.querySelectorAll(selector));
function readState(){
  try{
    const value=JSON.parse(localStorage.getItem(STORAGE_KEY));
    if(value && typeof value==='object' && !Array.isArray(value)){
      const fresh=initialState();
      const result={...fresh,...value,settings:{...fresh.settings,...(value.settings||{})}};
      for(const k of ['tasks','transactions','budgets','goals','projects','habits','priorityCategories','notes','memory']) if(!Array.isArray(result[k]))result[k]=[];
      return result;
    }
  }catch(err){console.warn('Could not read saved data',err)}
  return initialState();
}
function persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}catch(e){toast('Storage is full or unavailable. Export a backup to keep your data.');console.warn(e)}}
function update(){persist();renderAll();scheduleCloudSave()}
function id(){return (globalThis.crypto&&crypto.randomUUID)?crypto.randomUUID():'item_'+Date.now()+'_'+Math.random().toString(36).slice(2)}
function localDay(date=new Date()){const d=new Date(date.getTime()-date.getTimezoneOffset()*60000);return d.toISOString().slice(0,10)}
function offsetDay(day,n){const d=new Date(day+'T12:00:00');d.setDate(d.getDate()+n);return localDay(d)}
function readableDay(day,options={month:'short',day:'numeric'}){if(!day)return 'No date';const date=new Date(day+'T12:00:00');return isNaN(date.valueOf())?day:date.toLocaleDateString(undefined,options)}
function monthPrefix(){return localDay().slice(0,7)}
function escapeText(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function money(value,short=false){const currency=state.settings.currency||'NGN';try{return new Intl.NumberFormat(currency==='NGN'?'en-NG':undefined,{style:'currency',currency,notation:short&&Math.abs(Number(value))>=100000?'compact':'standard',minimumFractionDigits:0,maximumFractionDigits:short?1:2}).format(Number(value)||0)}catch{return currency+' '+(Number(value)||0).toLocaleString()}}
function value(id){return document.getElementById(id)}
function sum(items,key='amount'){return items.reduce((a,x)=>a+(Number(x[key])||0),0)}
function percent(a,b){return b>0?Math.max(0,Math.round(a/b*100)):0}
function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3200)}
function empty(title,description,icon='✿'){return `<div class="empty-state"><span class="empty-icon">${icon}</span><strong>${escapeText(title)}</strong><p>${escapeText(description)}</p></div>`}
function sortedTasks(items){const weight={high:0,medium:1,low:2};return [...items].sort((a,b)=>Number(!!a.done)-Number(!!b.done)||(a.time||'99:99').localeCompare(b.time||'99:99')||(weight[a.priority]??1)-(weight[b.priority]??1))}
function todayTasks(){return state.tasks.filter(t=>t.date===localDay())}
function currentTransactions(){return state.transactions.filter(t=>String(t.date||'').startsWith(monthPrefix()))}
function monthTotals(){const entries=currentTransactions();return{income:sum(entries.filter(t=>t.type==='income')),expenses:sum(entries.filter(t=>t.type==='expense'))}}
function activeProjects(){return state.projects.filter(p=>p.status!=='completed')}
function completedHabit(h,day=localDay()){return Array.isArray(h.days)&&h.days.includes(day)}
function streak(h){
  let day=localDay(),count=0;
  if(!completedHabit(h,day))day=offsetDay(day,-1);
  for(let i=0;i<366&&completedHabit(h,day);i++,day=offsetDay(day,-1))count++;
  return count;
}
function safeDate(d){return /^\d{4}-\d{2}-\d{2}$/.test(String(d))?d:localDay()}
function statusTag(status){let labels={active:'In progress',paused:'On hold',completed:'Completed'};let cls=status==='completed'?'done':status==='paused'?'paused':'';return `<span class="status-chip ${cls}">${escapeText(labels[status]||'In progress')}</span>`}
function renderAll(){
  const today=localDay();
  $('#top-date').textContent=readableDay(today,{weekday:'short',month:'short',day:'numeric'});
  $('#today-chip').textContent=readableDay(today,{weekday:'long',month:'short',day:'numeric'});
  const name=(state.settings.name||'').trim();
  const hour=new Date().getHours();
  let greeting=hour<12?'Good morning':hour<17?'Good afternoon':'Good evening';
  $('#greeting').textContent=`Hi ${name||'Bella'}, what can I do for you today? ✿`;
  $('#avatar').textContent=name?name[0].toUpperCase():'B';
  $('#voice-welcome-title').textContent=`Hi ${name||'Bella'}, wetin we go plan today? 💗`;
  renderHome();renderPlanner();renderNotes();renderPriorities();renderFinances();renderProjects();renderHabits();renderInsights();renderExtendedInsights();renderSettings();
}
function renderHome(){
  const today=todayTasks(),completed=today.filter(t=>t.done).length;
  const totals=monthTotals();
  $('#metric-tasks').textContent=completed+'/'+today.length;
  $('#metric-balance').textContent=money(totals.income-totals.expenses,true);
  $('#metric-projects').textContent=activeProjects().length;
  $('#metric-habits').textContent=state.habits.filter(h=>completedHabit(h)).length+'/'+state.habits.length;
  const overdue=state.tasks.filter(t=>!t.done&&t.date<localDay());
  const shown=sortedTasks([...overdue,...today]).slice(0,5);
  $('#home-tasks').innerHTML=shown.length?shown.map(t=>taskHtml(t)).join(''):empty('A fresh page, just for you','Add a task to start shaping your day.','☀');
  $('#home-habits').innerHTML=state.habits.length?state.habits.slice(0,5).map(h=>`<div class="habit-home-item"><div class="habit-symbol">${escapeText(h.emoji||'🌸')}</div><div class="habit-name">${escapeText(h.name)}<span class="habit-sub">${streak(h)} day streak</span></div><button class="check-today ${completedHabit(h)?'checked':''}" data-action="toggle-habit" data-id="${escapeText(h.id)}" type="button">${completedHabit(h)?'✓ Done':'Mark done'}</button></div>`).join(''):empty('Nothing to track yet','Add a routine you would like to grow.','♡');
  $('#home-priorities').innerHTML=state.priorityCategories.length
    ?state.priorityCategories.slice(0,4).map(c=>`<div class="home-priority-row"><span class="home-priority-dot">✳</span><strong>${escapeText(c.name)}</strong><span>${(c.items||[]).filter(x=>x.done).length}/${(c.items||[]).length} done</span></div>`).join('')
    :empty('Your important things belong here','Add a category like Faith, Family, Business or Personal growth.','✳');
  $('#home-finance').innerHTML=`<div class="money-snapshot"><div class="money-box"><small>Income this month</small><strong>${money(totals.income,true)}</strong></div><div class="divider-line"></div><div class="money-box"><small>Expenses this month</small><strong>${money(totals.expenses,true)}</strong></div></div>${state.transactions.length===0?'<p class="hint">Add your first income or expense to see your numbers bloom.</p>':''}`;
}
function taskHtml(t){
  const overdue=t.date<localDay()&&!t.done;
  return `<div class="task-row ${t.done?'task-done':''}"><input type="checkbox" class="task-check" data-check-task="${escapeText(t.id)}" aria-label="Complete ${escapeText(t.title)}" ${t.done?'checked':''}/><div class="task-body"><span class="task-title">${escapeText(t.title)}</span><div class="task-meta"><span>${t.time?escapeText(t.time)+' · ':''}${readableDay(t.date)}${overdue?' · overdue':''}</span><span class="tag ${escapeText(t.priority)}">${escapeText(t.priority||'medium')}</span>${t.category?`<span>${escapeText(t.category)}</span>`:''}</div></div><button type="button" class="icon-mini" title="Edit task" aria-label="Edit task" data-action="edit-task" data-id="${escapeText(t.id)}">✎</button><button type="button" class="icon-mini" title="Delete task" aria-label="Delete task" data-action="delete-task" data-id="${escapeText(t.id)}">×</button></div>`;
}
function renderPlanner(){
  const input=$('#planner-date');if(document.activeElement!==input)input.value=selectedDay;
  const strip=$('#date-strip');
  strip.innerHTML=Array.from({length:7},(_,i)=>{
    const date=offsetDay(selectedDay,i-3),active=date===selectedDay,today=date===localDay();
    return `<button type="button" data-action="select-day" data-day="${date}" class="date-button ${active?'selected':''} ${today?'today':''}" aria-pressed="${active}"><small>${readableDay(date,{weekday:'short'})}</small><strong>${new Date(date+'T12:00:00').getDate()}</strong></button>`;
  }).join('');
  $('#planner-list-title').textContent=selectedDay===localDay()?'Tasks for today':'Tasks for '+readableDay(selectedDay,{weekday:'long',month:'short',day:'numeric'});
  const tasks=sortedTasks(state.tasks.filter(t=>t.date===selectedDay));
  $('#planner-count').textContent=tasks.length+' '+(tasks.length===1?'task':'tasks');
  $('#planner-tasks').innerHTML=tasks.length?tasks.map(taskHtml).join(''):empty('Your schedule is open','Add a task, meeting, or tiny goal to this day.','▦');
}


let noteSearch='',noteDateFilter='',noteDraftTimer=null;
function renderNotes(){
  const box=$('#notes-list');
  const search=noteSearch.trim().toLowerCase();
  const notes=[...(state.notes||[])].filter(n=>(!noteDateFilter||n.date===noteDateFilter)&&
    (!search||(n.title+' '+n.body+' '+(n.category||'')).toLowerCase().includes(search)))
    .sort((a,b)=>Number(!!b.pinned)-Number(!!a.pinned)||(b.updatedAt||b.date||'').localeCompare(a.updatedAt||a.date||''));
  box.innerHTML=notes.length?notes.map(n=>`<article class="note-card ${n.pinned?'pinned':''}">
    <div class="note-date">${n.pinned?'📌 PINNED · ':''}${escapeText(readableDay(n.date,{weekday:'short',month:'long',day:'numeric'}))} · ${escapeText(n.category||'Personal')}</div>
    <h3>${escapeText(n.title||'My note')}</h3><p>${escapeText(n.body||'')}</p>
    ${n.reminderAt?`<div class="hint">🔔 ${escapeText(new Date(n.reminderAt).toLocaleString())}</div>`:''}
    <div class="note-actions"><button type="button" data-action="edit-note" data-id="${escapeText(n.id)}">✎ Edit</button>
      <button type="button" data-action="pin-note" data-id="${escapeText(n.id)}">${n.pinned?'Unpin':'📌 Pin'}</button>
      <button type="button" data-action="delete-note" data-id="${escapeText(n.id)}">Remove</button></div></article>`).join('')
    :empty('A little space for your thoughts','Write your first note, journal entry, or business idea.','✎');
}
function autoSaveNote(){
  if(modalType!=='note'||!$('#entry-dialog').open)return;
  const values=Object.fromEntries(new FormData($('#entry-form')).entries());
  if(!values.body?.trim()&&!values.title?.trim())return;
  let entry=state.notes.find(n=>n.id===modalId);
  if(!entry){entry={id:id(),pinned:false};state.notes.push(entry);modalId=entry.id}
  Object.assign(entry,{
    title:(values.title||'').trim().slice(0,120)||'My note',
    body:(values.body||'').trim().slice(0,12000),
    date:safeDate(values.date),category:(values.category||'Personal').trim().slice(0,50),
    reminderAt:values.reminderAt||'',updatedAt:new Date().toISOString()
  });
  update();
  $('#modal-submit').textContent='Saved ✓';
}
function renderExtendedInsights(){
  const end=localDay(),week=recentDays(7),month=monthPrefix();
  const groups={today:state.tasks.filter(t=>t.date===end),week:state.tasks.filter(t=>week.includes(t.date)),month:state.tasks.filter(t=>t.date.startsWith(month))};
  for(const [key,tasks] of Object.entries(groups)){
    const done=tasks.filter(x=>x.done).length,completion=percent(done,tasks.length);
    const ring=$('#progress-'+key+'-circle');
    ring.style.setProperty('--percent',String(completion));
    ring.querySelector('span').textContent=completion+'%';
    $('#progress-'+key+'-detail').textContent=`${done} completed · ${tasks.length-done} pending of ${tasks.length} planned`;
  }
  const values=week.map(d=>{const all=state.tasks.filter(t=>t.date===d);return percent(all.filter(x=>x.done).length,all.length)});
  drawBars('#task-progress-chart',week,values,'',v=>`${v}% tasks completed`);
  const productive=week.map((date,i)=>({date,percentage:values[i],count:state.tasks.filter(t=>t.date===date).length})).filter(x=>x.count).sort((a,b)=>b.percentage-a.percentage||b.count-a.count)[0];
  $('#progress-best-day').textContent=productive?`Best day: ${readableDay(productive.date,{weekday:'long'})}, ${productive.percentage}% completed. Based on scheduled tasks.`:'Add tasks to see your most productive day.';
  const pending=groups.week.filter(t=>!t.done).length;
  $('#progress-suggestion').textContent=pending?`${pending} task${pending===1?'':'s'} from the last 7 days remain pending. Consider rescheduling overdue items and choosing your next top three priorities.`:'Your scheduled week has no outstanding tasks. Keep your pace realistic and sustainable.';
}
function renderMemory(){
  $('#memory-list').innerHTML=(state.memory||[]).length?state.memory.map(m=>`<div class="memory-item"><span><strong>${escapeText(m.key)}</strong>: ${escapeText(m.value)}</span><button type="button" data-action="delete-memory" data-id="${escapeText(m.id)}" title="Forget this preference">✕</button></div>`).join(''):empty('No saved preferences yet',"Ask Bloom to remember your preferred routines, or leave this section empty.",'♡');
}

function renderPriorities(){
  const container=$('#priority-categories');
  if(!container)return;
  container.innerHTML=state.priorityCategories.length?state.priorityCategories.map(c=>{
    const items=Array.isArray(c.items)?c.items:[];
    const done=items.filter(x=>x.done).length;
    const isOpen=c.expanded!==false;
    return `<details class="priority-category" data-category-id="${escapeText(c.id)}" ${isOpen?'open':''}>
      <summary class="priority-category-title">
        <span class="priority-chevron">⌄</span><span class="priority-category-icon">✳</span>
        <span class="priority-category-heading"><strong>${escapeText(c.name)}</strong><small>${done} of ${items.length} sub-priorities complete</small></span>
        <span class="priority-progress">${items.length?Math.round(done/items.length*100):0}%</span>
      </summary>
      <div class="priority-category-body">
        ${items.length?items.map(x=>`<div class="priority-sub ${x.done?'priority-sub-done':''}"><label><input type="checkbox" data-priority-check="${escapeText(c.id)}" data-item-id="${escapeText(x.id)}" ${x.done?'checked':''}/><span>${escapeText(x.title)}</span></label><button type="button" class="icon-mini" data-action="delete-priority-item" data-id="${escapeText(c.id)}" data-item-id="${escapeText(x.id)}" aria-label="Delete ${escapeText(x.title)}">×</button></div>`).join(''):empty('Nothing inside this category yet','Add a sub-priority to get started.','♡')}
        <div class="priority-category-actions"><button type="button" class="btn tiny secondary" data-action="add-priority-item" data-id="${escapeText(c.id)}">+ Add sub-priority</button><button type="button" class="text-button" data-action="rename-priority-category" data-id="${escapeText(c.id)}">Rename</button><button type="button" class="text-button danger-text" data-action="delete-priority-category" data-id="${escapeText(c.id)}">Delete category</button></div>
      </div>
    </details>`;
  }).join(''):empty('Begin with what matters to you','Create a category, then add sub-priorities underneath it. Expand or collapse each one.','✳');
}
function priorityTaskSummary(day=localDay()){
  const tasks=sortedTasks(state.tasks.filter(t=>t.date===day&&!t.done));
  const priorityGroups=state.priorityCategories.map(c=>({...c,items:(c.items||[]).filter(x=>!x.done)})).filter(c=>c.items.length);
  const taskSummary=tasks.length?tasks.slice(0,10).map((t,i)=>`${i+1}, ${t.title}${t.time?' at '+t.time:''}, ${t.priority||'medium'} priority`).join('. '):'No unfinished tasks saved for that day';
  const prioritySummary=priorityGroups.length?priorityGroups.map(c=>`${c.name}: ${c.items.slice(0,6).map(x=>x.title).join(', ')}`).join('. '):'You have not added any unfinished sub-priorities';
  return `Here is your plan for ${readableDay(day,{weekday:'long',month:'long',day:'numeric'})}. Tasks: ${taskSummary}. Your priority categories: ${prioritySummary}.`;
}
function renderTodayPlan(){
  const day=localDay(),tasks=sortedTasks(state.tasks.filter(t=>t.date===day));
  const high=tasks.filter(t=>t.priority==='high'&&!t.done).length;
  const name=(state.settings.name||'Bella').trim()||'Bella';
  $('#today-title').textContent=`Your plan for today, ${name} ✿`;
  const tasksHTML=tasks.length?tasks.map(t=>`<div class="today-task ${t.done?'today-done':''}"><label><input type="checkbox" data-check-task="${escapeText(t.id)}" ${t.done?'checked':''}/><span>${escapeText(t.title)}<small>${t.time?escapeText(t.time)+' · ':''}${escapeText(t.priority||'medium')} priority · ${escapeText(t.category||'Personal')}</small></span></label></div>`).join(''):empty('No tasks on your calendar yet','Add one and you will see it here.','☀');
  const priorities=state.priorityCategories.length?state.priorityCategories.map(c=>`<div class="today-priority-group"><strong>✳ ${escapeText(c.name)}</strong>${(c.items||[]).length?(c.items||[]).map(x=>`<label class="today-sub ${x.done?'today-done':''}"><input type="checkbox" data-priority-check="${escapeText(c.id)}" data-item-id="${escapeText(x.id)}" ${x.done?'checked':''}/><span>${escapeText(x.title)}</span></label>`).join(''):'<p class="hint">No sub-priorities yet</p>'}</div>`).join(''):empty('No priority categories yet','Create your focus areas from My priorities.','✳');
  $('#today-plan-content').innerHTML=`<p class="today-intro">${escapeText(readableDay(day,{weekday:'long',month:'long',day:'numeric'}))} · ${tasks.filter(t=>!t.done).length} tasks left · ${high} high-priority tasks</p><div class="today-plan-section"><h3>☀ Scheduled plans</h3>${tasksHTML}</div><div class="today-plan-section"><h3>✳ What matters most</h3>${priorities}</div>`;
}
function openTodayPlan(){renderTodayPlan();if(!$('#today-dialog').open)$('#today-dialog').showModal()}
function renderFinances(){
  const totals=monthTotals();
  $('#fin-income').textContent=money(totals.income,true);
  $('#fin-expenses').textContent=money(totals.expenses,true);
  $('#fin-balance').textContent=money(totals.income-totals.expenses,true);
  $('#fin-savings-count').textContent=state.goals.length;
  $('#budgets-list').innerHTML=state.budgets.length?state.budgets.map(b=>{
    const spent=sum(currentTransactions().filter(t=>t.type==='expense'&&t.category===b.category));
    const used=percent(spent,Number(b.limit));
    return `<div class="progress-item"><div class="progress-top"><strong>${escapeText(b.category)}</strong><span>${money(spent,true)} of ${money(b.limit,true)} <button type="button" class="icon-mini" data-action="delete-budget" data-id="${escapeText(b.id)}" title="Remove budget">×</button></span></div><div class="progress-track"><div class="progress-fill ${used>100?'over':''}" style="width:${Math.min(100,used)}%"></div></div><p class="progress-note">${used}% of your monthly budget used</p></div>`;
  }).join(''):empty('Your budget, your rules','Set a spending limit by category to see your progress.','◈');
  $('#goals-list').innerHTML=state.goals.length?state.goals.map(g=>{
    const progress=percent(Number(g.current)||0,Number(g.target)||1);
    return `<div class="goal-card"><div class="goal-card-head"><strong>♡ ${escapeText(g.name)}</strong><div class="goal-card-actions"><button type="button" class="small-action" data-action="deposit-goal" data-id="${escapeText(g.id)}">+ Add money</button><button type="button" class="icon-mini" data-action="delete-goal" data-id="${escapeText(g.id)}" aria-label="Delete savings goal">×</button></div></div><div class="progress-top"><span>${money(g.current)}</span><span>Goal: ${money(g.target)}</span></div><div class="progress-track"><div class="progress-fill" style="width:${Math.min(100,progress)}%"></div></div><p class="progress-note">${progress}% saved ${progress>=100?'· Goal reached ✨':''}</p></div>`;
  }).join(''):empty('Start saving for a dream','Create your first savings goal, big or small.','♡');
  $('#transaction-filter').value=transactionFilter;
  let items=state.transactions.filter(t=>transactionFilter==='all'||t.type===transactionFilter);
  items=[...items].sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.id).localeCompare(String(a.id)));
  $('#transactions-list').innerHTML=items.length?items.slice(0,100).map(t=>`<div class="transaction-row"><div class="trans-icon ${escapeText(t.type)}">${t.type==='income'?'↗':'↘'}</div><div class="trans-copy"><strong>${escapeText(t.note||t.category||'Transaction')}</strong><small>${escapeText(t.category||'Other')} · ${readableDay(t.date)}</small></div><span class="trans-amount ${escapeText(t.type)}">${t.type==='income'?'+':'−'}${money(t.amount)}</span><button type="button" class="icon-mini" data-action="delete-transaction" data-id="${escapeText(t.id)}" title="Delete transaction" aria-label="Delete transaction">×</button></div>`).join(''):empty('Nothing in your money diary','Add an income or expense to begin tracking.','◈');
}
function renderProjects(){
  const active=activeProjects().length,complete=state.projects.filter(p=>p.status==='completed').length,paused=state.projects.filter(p=>p.status==='paused').length;
  $('#project-summary').innerHTML=`<span class="summary-pill"><strong>${active}</strong> open</span><span class="summary-pill"><strong>${complete}</strong> completed</span><span class="summary-pill"><strong>${paused}</strong> on hold</span>`;
  const projects=[...state.projects].sort((a,b)=>(a.status==='completed')-(b.status==='completed')||String(a.deadline||'9999').localeCompare(String(b.deadline||'9999')));
  $('#projects-list').innerHTML=projects.length?projects.map(p=>`<article class="project-card"><div class="proj-top"><div class="proj-symbol">✧</div>${statusTag(p.status)}</div><h3>${escapeText(p.title)}</h3><p>${escapeText(p.description||'One beautiful step at a time.')}</p><div class="project-progress"><div class="progress-top"><strong>Progress</strong><span>${Math.min(100,Math.max(0,Number(p.progress)||0))}%</span></div><div class="progress-track"><div class="progress-fill" style="width:${Math.min(100,Math.max(0,Number(p.progress)||0))}%"></div></div></div><div class="proj-footer"><small>▦ ${p.deadline?'Due '+readableDay(p.deadline):'No deadline set'}</small><span class="tag">${escapeText(p.status==='completed'?'Finished':'Keep growing')}</span></div><div class="project-actions"><button type="button" class="small-action" data-action="edit-project" data-id="${escapeText(p.id)}">Edit project</button><button type="button" class="small-action" data-action="delete-project" data-id="${escapeText(p.id)}">Delete</button></div></article>`).join(''):`<div style="grid-column:1/-1">${empty('Your next big idea belongs here','Create a project to track goals, deadlines, and progress.','✧')}</div>`;
}
function recentDays(n){return Array.from({length:n},(_,i)=>offsetDay(localDay(),i-n+1))}
function renderHabits(){
  const done=state.habits.filter(h=>completedHabit(h)).length,number=state.habits.length;
  const rate=percent(done,number);
  $('#habit-daily-message').textContent=number?`${done} of ${number} habits completed today`:'Every day is a fresh start';
  $('#habits-ring').style.background=`conic-gradient(#bd83b5 ${rate}%,#f7e8f3 ${rate}%)`;
  $('#habits-ring').querySelector('span').textContent=rate+'%';
  const days=recentDays(7);
  const heading=`<div class="habit-tracker-row heading"><span>Your habit</span>${days.map(d=>`<span class="day-heading">${readableDay(d,{weekday:'short'})}</span>`).join('')}<span class="habit-streak">Streak</span></div>`;
  $('#habit-tracker').innerHTML=state.habits.length?heading+state.habits.map(h=>`<div class="habit-tracker-row"><div class="habit-info"><span class="habit-symbol">${escapeText(h.emoji||'🌸')}</span><div><strong>${escapeText(h.name)}</strong><small><button type="button" class="text-button" data-action="delete-habit" data-id="${escapeText(h.id)}" style="font-size:9px;padding:0">Remove</button></small></div></div>${days.map(d=>`<button type="button" class="habit-day ${completedHabit(h,d)?'checked':''} ${d===localDay()?'today':''}" aria-label="${completedHabit(h,d)?'Unmark':'Mark'} ${escapeText(h.name)} on ${d}" title="${readableDay(d)}" data-action="toggle-habit" data-id="${escapeText(h.id)}" data-day="${d}">${completedHabit(h,d)?'✓':'·'}</button>`).join('')}<span class="habit-streak">🔥 ${streak(h)}</span></div>`).join(''):empty('Your habits can start here','Create a habit, then check in each day.','♡');
}
function renderInsights(){
  const week=recentDays(7);
  const weekStart=week[0];
  $('#insight-tasks').textContent=state.tasks.filter(t=>t.done&&t.date>=weekStart&&t.date<=localDay()).length;
  $('#insight-habits').textContent=state.habits.reduce((n,h)=>n+(h.days||[]).filter(d=>week.includes(d)).length,0);
  $('#insight-spent').textContent=money(monthTotals().expenses,true);
  $('#insight-projects').textContent=state.projects.filter(p=>p.status==='completed').length;
  const expenses=week.map(d=>sum(state.transactions.filter(t=>t.type==='expense'&&t.date===d)));
  const checks=week.map(d=>state.habits.filter(h=>completedHabit(h,d)).length);
  drawBars('#spending-chart',week,expenses,'peach-bar',v=>money(v,true));
  drawBars('#habit-chart',week,checks,'',v=>`${v} check-ins`);
  const m=monthTotals(),totalTasks=state.tasks.filter(t=>t.date.startsWith(monthPrefix()));
  const done=totalTasks.filter(t=>t.done).length;
  const completedProjects=state.projects.filter(p=>p.status==='completed').length;
  const savingsTotal=sum(state.goals,'current');
  $('#monthly-recap').innerHTML=`<div class="recap-grid"><div class="recap-tile"><strong>${done}/${totalTasks.length}</strong><small>tasks completed this month</small></div><div class="recap-tile"><strong>${money(m.income-m.expenses,true)}</strong><small>monthly net balance</small></div><div class="recap-tile"><strong>${money(savingsTotal,true)}</strong><small>recorded savings goals balance</small></div><div class="recap-tile"><strong>${completedProjects}</strong><small>finished projects overall</small></div><div class="recap-tile"><strong>${state.habits.length}</strong><small>habits you're growing</small></div><div class="recap-tile"><strong>${state.budgets.length}</strong><small>monthly budget categories</small></div></div><p class="hint">Savings goal balances are tracked separately from income and expenses; adding to a goal does not automatically create a transaction.</p>`;
}
function drawBars(selector,days,values,color,tip){
  const max=Math.max(1,...values);
  $(selector).innerHTML=days.map((day,i)=>`<div class="bar-col"><div class="bar-fill ${color}" title="${escapeText(readableDay(day)+': '+tip(values[i]))}" role="img" aria-label="${escapeText(readableDay(day)+': '+tip(values[i]))}" style="height:${Math.max(3,values[i]/max*132)}px"></div><small>${escapeText(readableDay(day,{weekday:'short'}))}</small></div>`).join('');
}
function renderSettings(){
  if(document.activeElement!==$('#settings-name'))$('#settings-name').value=state.settings.name||'';
  if(document.activeElement!==$('#settings-currency'))$('#settings-currency').value=state.settings.currency||'NGN';
  $('#settings-voice-reminders').checked=!!state.settings.voiceReminders;
  $('#settings-alert-tone').value=state.settings.alertTone||'soft';
  renderMemory();renderCloudStatus();
  const permission=('Notification' in window)?Notification.permission:'unsupported';
  $('#notification-status').textContent=permission==='granted'?'✓ Notifications are allowed on this device while the app is open.':permission==='denied'?'Notifications are blocked in this browser. Change the permission in your browser settings.':permission==='unsupported'?'This browser does not support notifications.':'Notifications are currently off.';
}
function navigate(view){
  if(!VIEWS.includes(view))view='home';
  currentView=view; $$('.view').forEach(el=>el.classList.toggle('active',el.id==='view-'+view));
  $$('[data-go]').forEach(el=>el.classList.toggle('active',el.dataset.go===view&&el.classList.contains('nav-item')||el.dataset.go===view&&el.classList.contains('mobile-nav-item')));
  $('#top-section').textContent=VIEW_TITLES[view];
  if(location.hash!=='#'+view)history.replaceState(null,'','#'+view);
  window.scrollTo({top:0,behavior:'instant'});
}
function field(name,label,type='text',val='',extra=''){
  return `<label>${escapeText(label)}<input type="${type}" name="${escapeText(name)}" value="${escapeText(val)}" ${extra}></label>`;
}
function choice(name,label,values,selected){
  return `<label>${escapeText(label)}<select name="${escapeText(name)}">${values.map(([v,lab])=>`<option value="${escapeText(v)}" ${selected===v?'selected':''}>${escapeText(lab)}</option>`).join('')}</select></label>`;
}
function openModal(type,itemId=null){
  modalType=type;modalId=itemId;
  const options=CATEGORIES.map(c=>[c,c]);
  let title='',html='',button='Save';
  const match=(items)=>items.find(item=>String(item.id)===String(itemId));
  if(type==='task'){
    const t=match(state.tasks)||{title:'',date:selectedDay,time:'',priority:'medium',category:'Personal'};
    title=itemId?'Edit your task':'Plan a new task';
    html=field('title','What needs doing?','text',t.title,'required maxlength="120" placeholder="e.g. Review my weekly goals"')+
      `<div class="field-grid">${field('date','Date','date',safeDate(t.date),'required')}${field('time','Time (optional)','time',t.time)}</div>`+
      `<div class="field-grid">${choice('priority','Priority',[['low','Low'],['medium','Medium'],['high','High']],t.priority)}${choice('category','Area',[['Personal','Personal'],['Business','Business'],['Finance','Finance'],['Other','Other']],t.category)}</div>`+
      `<div class="field-grid">${choice('reminderMode','Remind me',[['off','No reminder'],['minutes','Before task'],['at','At a specific date and time']],t.reminder?.mode||'off')}${field('reminderMinutes','Minutes before','number',t.reminder?.minutes??15,'min="0" max="10080" step="1"')}</div>`+
      field('reminderAt','Custom reminder time','datetime-local',t.reminder?.at||'');
  }else if(type==='note'){
    const n=match(state.notes)||{title:'',body:'',category:'Personal',date:localDay(),reminderAt:''};
    title=itemId?'Edit your note':'Write a little note';
    html=field('title','Title','text',n.title,'maxlength="120" placeholder="e.g. A lovely idea"')+
       `<label>Your thoughts<textarea name="body" rows="7" maxlength="12000" placeholder="Write anything you want to remember…">${escapeText(n.body)}</textarea></label>`+
       `<div class="field-grid">${field('category','Collection','text',n.category,'maxlength="50" placeholder="Journal, Ideas, Work"')}${field('date','Date','date',n.date,'required')}</div>`+
       field('reminderAt','Remind me about this (optional)','datetime-local',n.reminderAt);
    html+='<p class="hint">Your note saves automatically as you type. Close anytime.</p>';
    button='Save note';
  }else if(type==='transaction'){
    title='Add a money entry';
    html=`<div class="field-grid">${choice('type','Entry type',[['expense','Expense'],['income','Income']],'expense')}${field('amount','Amount','number','','required min="0.01" step="0.01" placeholder="0.00"')}</div>`+
      `<div class="field-grid">${choice('category','Category',options,'Other')}${field('date','Date','date',localDay(),'required')}</div>`+
      field('note','Description (optional)','text','','maxlength="100" placeholder="What was it for?"');
  }else if(type==='project'){
    const p=match(state.projects)||{title:'',description:'',deadline:'',status:'active',progress:0};
    title=itemId?'Update your project':'Start a new project';
    html=field('title','Project name','text',p.title,'required maxlength="100" placeholder="Your big idea"')+
      `<label>What is this project about?<textarea name="description" rows="3" maxlength="500" placeholder="What would you like to achieve?">${escapeText(p.description)}</textarea></label>`+
      `<div class="field-grid">${field('deadline','Target date (optional)','date',p.deadline)}${choice('status','Status',[['active','In progress'],['paused','On hold'],['completed','Completed']],p.status)}</div>`+
      `<label>Progress: <span id="progress-display">${Number(p.progress)||0}%</span><input id="progress-input" name="progress" type="range" min="0" max="100" step="5" value="${Number(p.progress)||0}"></label>`;
  }else if(type==='habit'){
    title='Grow a new habit';
    html=field('name','Habit name','text','','required maxlength="70" placeholder="e.g. Read for 15 minutes"')+
      field('emoji','Pick an emoji','text','🌸','maxlength="8" placeholder="🌸"')+
      '<p class="hint">Tap your habit every day to build your streak.</p>';
  }else if(type==='budget'){
    title='Set a monthly budget';
    html=choice('category','Spending category',options,'Food')+field('limit','Monthly spending limit','number','','required min="0.01" step="0.01" placeholder="0.00"');
  }else if(type==='goal'){
    title='Create a savings goal';
    html=field('name','What are you saving for?','text','','required maxlength="90" placeholder="e.g. Emergency fund"')+
      `<div class="field-grid">${field('target','Target amount','number','','required min="0.01" step="0.01"')}${field('current','Already saved','number','0','required min="0" step="0.01"')}</div>`;
  }else if(type==='priority-category'){
    const c=match(state.priorityCategories)||{name:''};
    title=itemId?'Rename priority category':'Create a priority category';
    html=field('name','Category name','text',c.name,'required maxlength="70" placeholder="e.g. Business, Family, Wellbeing"');
  }else if(type==='priority-item'){
    if(!state.priorityCategories.length){toast('Create a priority category first');return openModal('priority-category')}
    const c=state.priorityCategories.find(x=>String(x.id)===String(itemId));
    title='Add a sub-priority';
    html=choice('categoryId','Which category?',state.priorityCategories.map(x=>[x.id,x.name]),c?.id||state.priorityCategories[0].id)+
      field('title','Sub-priority','text','','required maxlength="120" placeholder="e.g. Contact three new customers"');
  }else if(type==='deposit'){
    const g=match(state.goals);if(!g)return;
    title='Add savings to '+g.name;
    html=field('amount','Amount to add','number','','required min="0.01" step="0.01" placeholder="0.00"');
    button='Add savings';
  }else return;
  $('#modal-title').textContent=title;
  $('#modal-fields').className='modal-fields';
  $('#modal-fields').innerHTML=html;
  $('#modal-submit').textContent=button;
  $('#entry-dialog').showModal();
  updateReminderFields();
  setTimeout(()=>$('#modal-fields input:not([type=range]), #modal-fields select')?.focus(),50);
}
function updateReminderFields(){
  if(modalType!=='task')return;
  const mode=$('#modal-fields [name="reminderMode"]')?.value||'off';
  const before=$('#modal-fields [name="reminderMinutes"]')?.closest('label');
  const at=$('#modal-fields [name="reminderAt"]')?.closest('label');
  if(before)before.style.display=mode==='minutes'?'':'none';
  if(at)at.style.display=mode==='at'?'':'none';
}

function handleEntry(e){
  e.preventDefault();if(!modalType)return;
  const v=Object.fromEntries(new FormData(e.currentTarget).entries());
  const amount=Number(v.amount);
  const match=(items)=>items.find(item=>String(item.id)===String(modalId));
  if(modalType==='task'){
    if(!v.title?.trim()||!safeDate(v.date))return;
    const old=match(state.tasks),reminder=v.reminderMode==='minutes'
      ?{mode:'minutes',minutes:Math.min(10080,Math.max(0,Number(v.reminderMinutes)||0))}
      :v.reminderMode==='at'&&v.reminderAt?{mode:'at',at:v.reminderAt}:null;
    const newTask={id:old?.id||id(),title:v.title.trim(),date:safeDate(v.date),time:v.time||'',category:v.category||'Personal',priority:v.priority||'medium',done:old?.done||false,completedAt:old?.completedAt||null,reminder};
    if(old)Object.assign(old,newTask);else state.tasks.push(newTask);
    toast(old?'Task updated ♡':'A new task is ready to bloom ✿');
  }else if(modalType==='note'){
    const body=(v.body||'').trim(),title=(v.title||'').trim()||'My note';
    if(!body&&!title)return;
    const old=match(state.notes);
    const note={id:old?.id||id(),title:title.slice(0,120),body:body.slice(0,12000),category:(v.category||'Personal').trim().slice(0,50),date:safeDate(v.date),pinned:old?.pinned||false,reminderAt:v.reminderAt||'',updatedAt:new Date().toISOString()};
    if(old)Object.assign(old,note);else state.notes.push(note);
    toast('Note saved ✎');
  }else if(modalType==='transaction'){
    if(!(amount>0))return;
    state.transactions.push({id:id(),type:v.type==='income'?'income':'expense',amount,category:v.category||'Other',date:safeDate(v.date),note:(v.note||'').trim()});
    toast('Money entry saved ♡');
  }else if(modalType==='project'){
    if(!v.title?.trim())return;
    const old=match(state.projects),progress=Math.min(100,Math.max(0,Number(v.progress)||0));
    const status=['active','paused','completed'].includes(v.status)?v.status:'active';
    const newProj={id:old?.id||id(),title:v.title.trim(),description:(v.description||'').trim(),deadline:v.deadline||'',status,progress:status==='completed'?100:progress};
    if(old)Object.assign(old,newProj);else state.projects.push(newProj);
    toast(old?'Project updated ✧':'A new project is taking shape ✧');
  }else if(modalType==='habit'){
    if(!v.name?.trim())return;
    state.habits.push({id:id(),name:v.name.trim(),emoji:(v.emoji||'🌸').trim().slice(0,8)||'🌸',days:[]});
    toast('Your new habit is ready ♡');
  }else if(modalType==='budget'){
    if(!(Number(v.limit)>0))return;
    const existing=state.budgets.find(b=>b.category===v.category);
    if(existing)existing.limit=Number(v.limit);else state.budgets.push({id:id(),category:v.category,limit:Number(v.limit)});
    toast('Your monthly budget is saved ◈');
  }else if(modalType==='goal'){
    if(!v.name?.trim()||!(Number(v.target)>0))return;
    state.goals.push({id:id(),name:v.name.trim(),target:Number(v.target),current:Math.max(0,Number(v.current)||0)});
    toast('Your savings dream is on its way ♡');
  }else if(modalType==='priority-category'){
    const name=(v.name||'').trim();if(!name)return;
    const existing=match(state.priorityCategories);
    if(existing)existing.name=name;else state.priorityCategories.push({id:id(),name,expanded:true,items:[]});
    toast(existing?'Priority renamed ✳':'New priority category added ✳');
  }else if(modalType==='priority-item'){
    const c=state.priorityCategories.find(x=>String(x.id)===String(v.categoryId));
    const title=(v.title||'').trim();if(!c||!title)return;
    if(!Array.isArray(c.items))c.items=[];
    c.items.push({id:id(),title,done:false});c.expanded=true;
    toast('Sub-priority added ♡');
  }else if(modalType==='deposit'){
    const g=match(state.goals);if(!g||!(amount>0))return;
    g.current=Number(g.current||0)+amount;
    toast('A little closer to your goal ✨');
  }
  $('#entry-dialog').close();modalType=null;modalId=null;update();
}
function toggleHabit(habitId,day=localDay()){
  const h=state.habits.find(x=>String(x.id)===String(habitId));if(!h)return;
  if(!Array.isArray(h.days))h.days=[];
  if(h.days.includes(day))h.days=h.days.filter(d=>d!==day);else h.days.push(day);
  update();
}
function deleteFrom(type,itemId,label){
  const keys={task:'tasks',transaction:'transactions',project:'projects',habit:'habits',goal:'goals',budget:'budgets'};
  const key=keys[type];if(!key)return;
  if(!confirm('Delete this '+label+'? This cannot be undone.'))return;
  state[key]=state[key].filter(x=>String(x.id)!==String(itemId));
  update();toast('Deleted from your planner');
}
function generateDayPlan(){
  const day=localDay();
  const due=sortedTasks(state.tasks.filter(t=>!t.done&&t.date<=day));
  const today=due.filter(t=>t.date===day),late=due.filter(t=>t.date<day);
  const habits=state.habits.filter(h=>!completedHabit(h));
  const upcoming=[...state.projects].filter(p=>p.status==='active'&&p.deadline&&p.deadline>=day&&p.deadline<=offsetDay(day,7)).sort((a,b)=>a.deadline.localeCompare(b.deadline));
  const month=monthTotals();
  const priorities=[...today.filter(t=>t.priority==='high'),...today.filter(t=>t.priority!=='high')];
  const work=priorities.slice(0,4);
  const taskText=work.length?`<ul>${work.map((t,i)=>`<li><strong>${i+1}. ${escapeText(t.title)}</strong>${t.time?' at '+escapeText(t.time):''} · ${escapeText(t.category||'Personal')}</li>`).join('')}</ul>`:'<p>You have no unfinished tasks scheduled for today. Pick one meaningful thing you would love to accomplish and add it to your planner.</p>';
  const reminderText=late.length?`<p>You also have <strong>${late.length} overdue task${late.length===1?'':'s'}</strong>. Consider rescheduling ${escapeText(late[0].title)} so it has a realistic place in your week.</p>`:'<p>No overdue tasks are calling for your attention today.</p>';
  const projectText=upcoming.length?`<ul>${upcoming.slice(0,3).map(p=>`<li><strong>${escapeText(p.title)}</strong> — due ${escapeText(readableDay(p.deadline))}; take one small step forward.</li>`).join('')}</ul>`:'<p>Nothing urgent is due on your active projects this week. Consider spending a short focused session on your most meaningful project.</p>';
  const habitText=habits.length?`<p>You have <strong>${habits.length} habit${habits.length===1?'':'s'}</strong> left to check off. Start with ${escapeText(habits[0].name)}${habits.length>1?' and then '+escapeText(habits[1].name):''}.</p>`:'<p>Your habits are all checked in for today — or you haven’t added any yet. Either way, give yourself credit for showing up.</p>';
  const spendingText=state.transactions.length?`<p>This month you recorded ${money(month.income)} in income and ${money(month.expenses)} in expenses. ${month.expenses>month.income?'Your spending is above your recorded income — consider checking your budget before new purchases.':'Keep an eye on spending so your plans and money stay in balance.'}</p>`:'<p>Record any money that comes in or goes out today. A quick check-in makes budgeting easier.</p>';
  $('#assistant-content').innerHTML=`<p class="assistant-intro">Here's a practical, gentle plan for ${escapeText(readableDay(day,{weekday:'long',month:'long',day:'numeric'}))}. These suggestions are created locally from what you entered — no paid AI needed.</p><div class="assistant-section"><h3>☀ Start with your most important tasks</h3>${taskText}${reminderText}</div><div class="assistant-section"><h3>✧ Move your projects forward</h3>${projectText}</div><div class="assistant-section"><h3>♡ Make time for your habits</h3>${habitText}</div><div class="assistant-section"><h3>◈ Take a tiny money moment</h3>${spendingText}</div><p class="assistant-intro">✿ You do not have to do everything perfectly. A few intentional wins are enough.</p>`;
  $('#assistant-dialog').showModal();
}
async function enableNotifications(){
  if(!('Notification' in window)){toast('This browser does not support notifications');return}
  try{
    const permission=await Notification.requestPermission();
    state.settings.notifications=permission==='granted';
    update();
    toast(permission==='granted'?'Reminders enabled while the app is open ♡':'Notifications were not enabled');
  }catch(e){toast('Could not enable notifications')}
}

function gentleTone(){
  const tone=state.settings.alertTone||'soft';
  if(tone==='silent')return;
  try{
    const audio=new (window.AudioContext||window.webkitAudioContext)();
    const oscillator=audio.createOscillator(),gain=audio.createGain();
    oscillator.type='sine';
    oscillator.frequency.value=tone==='bright'?770:530;
    gain.gain.setValueAtTime(.0001,audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(.06,audio.currentTime+.045);
    gain.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+.5);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start();oscillator.stop(audio.currentTime+.55);
    oscillator.onended=()=>audio.close();
  }catch{}
}
function reminderCheck(){
  if(!('Notification' in window)||Notification.permission!=='granted'||!state.settings.notifications)return;
  const now=Date.now();
  for(const r of getReminderEntries()){
    const due=Date.parse(r.at),tag=r.id+':'+r.at;
    if(due>now||now-due>90000||alerted.has(tag))continue;
    alerted.add(tag);
    try{new Notification(r.title,{body:r.body,icon:'./icons/icon-192.png',tag:r.id})}catch(err){console.warn('Notification unavailable',err)}
    gentleTone();
    if(state.settings.voiceReminders&&'speechSynthesis' in window){
      try{
        const u=new SpeechSynthesisUtterance(`Hey ${bloomName()}, it's time for ${r.body}. You planned this for yourself.`);
        u.lang='en-NG';u.rate=.95;speechSynthesis.speak(u);
      }catch{}
    }
  }
}
function exportBackup(){
  const json=JSON.stringify(state,null,2),blob=new Blob([json],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Bloom-and-Balance-backup-'+localDay()+'.json';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Your backup has been downloaded ♡');
}
async function importBackup(file){
  if(!file)return;
  try{
    if(file.size>5*1024*1024)throw new Error('Backup file is too large');
    const parsed=JSON.parse(await file.text());
    const keys=['tasks','transactions','budgets','goals','projects','habits'];
    if(!parsed||typeof parsed!=='object'||!keys.every(k=>Array.isArray(parsed[k])))throw new Error('This does not look like a Bloom & Balance backup');
    if(!confirm('Importing will replace all data currently saved in this browser. Continue?'))return;
    const fresh=initialState();
    state={...fresh,settings:{...fresh.settings,...(parsed.settings||{})}};
    for(const k of keys)state[k]=parsed[k].slice(0,10000).filter(x=>x&&typeof x==='object'&&!Array.isArray(x));
    state.priorityCategories=Array.isArray(parsed.priorityCategories)?parsed.priorityCategories.slice(0,300).filter(x=>x&&typeof x.name==='string').map(x=>({id:String(x.id||id()),name:x.name.slice(0,70),expanded:x.expanded!==false,items:Array.isArray(x.items)?x.items.slice(0,300).filter(y=>y&&typeof y.title==='string').map(y=>({id:String(y.id||id()),title:y.title.slice(0,120),done:!!y.done})):[]})) : [];
    state.notes=Array.isArray(parsed.notes)?parsed.notes.slice(0,5000):[];
    state.memory=Array.isArray(parsed.memory)?parsed.memory.slice(0,300):[];
    update();toast('Your backup has been restored ♡');
  }catch(e){toast(e.message||'Could not import that file')}
}
function clearData(){
  if(!confirm('Delete ALL saved items including notes and memory from this browser? You cannot undo this without a backup.'))return;
  if(!confirm('Last check: erase everything in this browser?'))return;
  state=initialState();update();navigate('home');toast('Your local data has been cleared');
}


// Genuine AI and secure cloud account. Existing localStorage key remains unchanged.
const bloomConfig=window.BLOOM_CONFIG||{};
const cloudConfigured=()=>!!(bloomConfig.supabaseUrl&&bloomConfig.supabaseAnonKey);
let cloudSession=null,cloudSyncReady=false,cloudSaveTimer=null,cloudQueue=Promise.resolve();
try{cloudSession=JSON.parse(localStorage.getItem('bloom-cloud-session')||'null')}catch{}
function saveSession(session){
  cloudSession=session||null;
  if(cloudSession)localStorage.setItem('bloom-cloud-session',JSON.stringify(cloudSession));
  else localStorage.removeItem('bloom-cloud-session');
  renderCloudStatus();
}
async function cloudAuth(){
  if(!cloudConfigured())throw new Error('Connect Supabase and configure config.js first.');
  if(!cloudSession?.access_token)throw new Error('Sign in from Settings to use Bloom AI and cloud sync.');
  if(Date.now()>(Number(cloudSession.expires_at||0)*1000-120000)){
    if(!cloudSession.refresh_token)throw new Error('Your session expired. Please sign in again.');
    const r=await fetch(bloomConfig.supabaseUrl.replace(/\/$/,'')+'/auth/v1/token?grant_type=refresh_token',{
      method:'POST',headers:{apikey:bloomConfig.supabaseAnonKey,'Content-Type':'application/json'},
      body:JSON.stringify({refresh_token:cloudSession.refresh_token})
    });
    const data=await r.json();
    if(!r.ok||!data.access_token){saveSession(null);throw new Error('Your session expired. Please sign in again.')}
    saveSession({...data,expires_at:Math.floor(Date.now()/1000)+(data.expires_in||3600),user:data.user||cloudSession.user});
  }
  return cloudSession.access_token;
}
async function cloudFetch(path,{method='GET',body,prefer='return=representation'}={}){
  const token=await cloudAuth();
  const r=await fetch(bloomConfig.supabaseUrl.replace(/\/$/,'')+'/rest/v1/'+path,{
    method,headers:{apikey:bloomConfig.supabaseAnonKey,Authorization:'Bearer '+token,'Content-Type':'application/json',Prefer:prefer},
    body:body===undefined?undefined:JSON.stringify(body)
  });
  const t=await r.text(),data=t?JSON.parse(t):null;
  if(!r.ok)throw new Error('Cloud sync failed ('+r.status+'). '+(data?.message||''));
  return data;
}
function cloudStatus(msg){const el=$('#cloud-sync-status');if(el)el.textContent=msg}
function renderCloudStatus(){
  const el=$('#cloud-account-status');if(!el)return;
  const logged=cloudSession?.user?.email;
  el.textContent=!cloudConfigured()?'⚠ Cloud not configured. Follow README setup.':
    logged?'✓ Signed in as '+logged+(cloudSyncReady?' · syncing':' · connecting…'):'Cloud configured. Sign in to unlock Bloom AI.';
}
function localDataCount(s){
  return ['tasks','transactions','budgets','goals','projects','habits','priorityCategories','notes','memory'].reduce((x,k)=>x+(s[k]?.length||0),0);
}
function mergeData(local,remote){
  const merged={...initialState(),...remote,settings:{...initialState().settings,...local.settings,...remote.settings}};
  for(const key of ['tasks','transactions','budgets','goals','projects','habits','priorityCategories','notes','memory']){
    const combined=new Map();
    for(const item of local[key]||[])if(item?.id)combined.set(String(item.id),item);
    for(const item of remote[key]||[])if(item?.id)combined.set(String(item.id),item);
    merged[key]=Array.from(combined.values());
  }
  return merged;
}
async function cloudSignIn(mode='signin'){
  if(!cloudConfigured()){toast('Bloom cloud is not configured. Follow the included setup guide.');return}
  const email=$('#cloud-email').value.trim(),password=$('#cloud-password').value;
  if(!email||password.length<8){toast('Enter an email and password of at least 8 characters.');return}
  cloudStatus('Connecting to your secure account…');
  try{
    const url=bloomConfig.supabaseUrl.replace(/\/$/,'')+'/auth/v1/'+(mode==='signup'?'signup':'token?grant_type=password');
    const response=await fetch(url,{method:'POST',headers:{apikey:bloomConfig.supabaseAnonKey,'Content-Type':'application/json'},body:JSON.stringify({email,password})});
    const data=await response.json();
    if(!response.ok)throw new Error(data.msg||data.error_description||data.message||'Sign in failed');
    if(!data.access_token){cloudStatus('Check your inbox to confirm your email, then sign in.');return}
    saveSession({...data,expires_at:Math.floor(Date.now()/1000)+(data.expires_in||3600)});
    $('#cloud-password').value='';
    await cloudInitialSync();
    cloudStatus('Your private Bloom data is syncing across devices ♡');
  }catch(e){cloudStatus('Could not connect: '+e.message);toast(e.message)}
}
async function cloudInitialSync(){
  cloudSyncReady=false;
  const user=cloudSession?.user;
  if(!user?.id)throw new Error('Account information missing; sign in again.');
  const previous=localStorage.getItem('bloom-cloud-user');
  const oldLocal=JSON.parse(JSON.stringify(state));
  localStorage.setItem('bloom-before-cloud-sync',JSON.stringify(oldLocal));
  const rows=await cloudFetch('bloom_states?select=state&user_id=eq.'+encodeURIComponent(user.id)+'&limit=1');
  const remote=rows?.[0]?.state;
  if(!remote&&previous&&previous!==user.id&&localDataCount(oldLocal)>0){
    if(!confirm('This device has entries from another Bloom account. Upload them to this new account? Choose Cancel to start with an empty cloud planner. A local recovery copy is kept.'))state=initialState();
  }
  if(remote){
    if(previous===user.id&&localStorage.getItem('bloom-cloud-dirty')==='yes'){
      // Recover local additions made while network sync was unavailable.
      state=mergeData(oldLocal,remote);
      toast('Recovered local changes that were not synced ✿');
    }else if(previous!==user.id&&localDataCount(oldLocal)>0 &&
      confirm('This account already has saved Bloom data. Merge this device’s entries with the cloud data? Cancel uses cloud data only. A local recovery copy has been saved.')){
      state=mergeData(oldLocal,remote);
    }else state={...initialState(),...remote,settings:{...initialState().settings,...(remote.settings||{})}};
  }
  for(const k of ['tasks','transactions','budgets','goals','projects','habits','priorityCategories','notes','memory'])if(!Array.isArray(state[k]))state[k]=[];
  localStorage.setItem('bloom-cloud-user',user.id);
  persist();renderAll();
  cloudSyncReady=true;
  await scheduleCloudSave(true);
  renderCloudStatus();
}
function scheduleCloudSave(immediate=false){
  if(!cloudConfigured()||!cloudSession?.user?.id||!cloudSyncReady)return Promise.resolve();
  localStorage.setItem('bloom-cloud-dirty','yes');
  if(cloudSaveTimer)clearTimeout(cloudSaveTimer);
  if(immediate)return queueCloudSave();
  cloudSaveTimer=setTimeout(()=>{cloudSaveTimer=null;queueCloudSave()},550);
}
function queueCloudSave(){
  const snapshot=JSON.parse(JSON.stringify(state));
  cloudQueue=cloudQueue.catch(()=>{}).then(async()=>{
    await cloudFetch('bloom_states?on_conflict=user_id',{
      method:'POST',body:{user_id:cloudSession.user.id,state:snapshot,updated_at:new Date().toISOString()},
      prefer:'resolution=merge-duplicates,return=minimal'
    });
    if(JSON.stringify(state)===JSON.stringify(snapshot))localStorage.removeItem('bloom-cloud-dirty');
    cloudStatus('✓ All changes saved to your secure cloud account.');
    await syncCloudReminders();
  }).catch(err=>{cloudStatus('⚠ Changes are saved locally, but cloud sync failed: '+err.message);throw err});
  return cloudQueue;
}
async function flushCloudSave(){
  if(cloudSaveTimer){clearTimeout(cloudSaveTimer);cloudSaveTimer=null;await queueCloudSave();}
  else await cloudQueue;
}
function getReminderEntries(){
  const result=[];
  for(const t of state.tasks){
    if(t.done||!t.reminder)continue;
    const r=t.reminder;
    let when;
    if(r.mode==='minutes'&&t.time)when=new Date(new Date(t.date+'T'+t.time+':00').getTime()-Number(r.minutes||0)*60000);
    if(r.mode==='at'&&r.at)when=new Date(r.at);
    if(when&&!isNaN(when.valueOf()))result.push({id:'task:'+t.id,at:when.toISOString(),title:'Bloom reminder ✿',body:t.title});
  }
  for(const n of state.notes||[]){
    if(!n.reminderAt)continue;
    const when=new Date(n.reminderAt);
    if(!isNaN(when.valueOf()))result.push({id:'note:'+n.id,at:when.toISOString(),title:'Bloom note reminder ✎',body:n.title||'Your saved note'});
  }
  return result;
}
async function bloomFunction(name,data){
  const token=await cloudAuth();
  const response=await fetch('/.netlify/functions/'+name,{
    method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify(data)
  });
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(payload.error||'The secure Bloom service could not complete the request.');
  return payload;
}
async function syncCloudReminders(){
  if(!cloudSyncReady)return;
  try{await bloomFunction('sync-reminders',{reminders:getReminderEntries()})}
  catch(e){cloudStatus('Cloud data saved. Background reminders need additional setup: '+e.message)}
}
async function logoutCloud(){
  if(!confirm('Sign out? Your data remains in this browser unless you also delete local data.'))return;
  try{
    if('serviceWorker' in navigator&&'PushManager' in window){
      const registration=await navigator.serviceWorker.ready;
      const sub=await registration.pushManager.getSubscription();
      if(sub){await bloomFunction('push-unsubscribe',{endpoint:sub.endpoint});await sub.unsubscribe()}
    }
  }catch(err){console.warn('Could not unregister push notifications',err)}
  cloudSyncReady=false;saveSession(null);cloudStatus('Signed out. Existing entries remain on this device.');toast('Signed out ♡');
}
function base64ToBytes(base64){
  const pad='='.repeat((4-base64.length%4)%4);
  const binary=atob((base64+pad).replace(/-/g,'+').replace(/_/g,'/'));
  return Uint8Array.from(binary,c=>c.charCodeAt(0));
}
async function enablePush(){
  const status=$('#push-status');
  try{
    if(!cloudConfigured()||!cloudSession)throw new Error('Sign in to your cloud account first.');
    if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window))throw new Error('Your browser does not support Web Push. Try a supported browser or install the app.');
    if(!bloomConfig.vapidPublicKey)throw new Error('VAPID public key is not configured in config.js.');
    const permission=await Notification.requestPermission();
    if(permission!=='granted')throw new Error('Notification permission was not granted.');
    const registration=await navigator.serviceWorker.ready;
    let subscription=await registration.pushManager.getSubscription();
    if(!subscription)subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:base64ToBytes(bloomConfig.vapidPublicKey)});
    await bloomFunction('push-subscribe',{subscription:subscription.toJSON()});
    await flushCloudSave();await syncCloudReminders();
    state.settings.notifications=true;persist();
    status.textContent='✓ Background reminders enabled on this device, subject to browser delivery and scheduled function availability.';
  }catch(e){status.textContent='Could not enable background reminders: '+e.message}
}

// Bloom AI: real, authenticated model conversation and trusted application tools.
// The free, Netlify-static version uses local intent parsing, not a generative AI service.
let voiceRecognition=null,voiceListening=false,voiceLastReply='';
let voiceSpeechOn=true,voiceHandsFree=false,voiceFirstWelcome=false,aiBusy=false;
const AI_HISTORY_KEY='bloom-ai-conversation-v2';
let aiHistory=[];
try{const saved=JSON.parse(localStorage.getItem(AI_HISTORY_KEY)||'[]');if(Array.isArray(saved))aiHistory=saved.filter(m=>['user','assistant'].includes(m.role)&&typeof m.content==='string').slice(-18)}catch{}
function voiceStatus(message){$('#voice-status').textContent=message}
function bloomName(){return (state.settings.name||'Bella').trim()||'Bella'}
function chatLine(who,text){
  const container=$('#voice-chat'),line=document.createElement('div');
  line.className='chat-line '+(who==='bloom'?'chat-bloom':'chat-you');
  const label=document.createElement('span');label.className='chat-label';label.textContent=who==='bloom'?'✿ Bloom':'You';
  const body=document.createElement('p');body.textContent=text;
  line.append(label,body);container.appendChild(line);
  while(container.childElementCount>55)container.firstElementChild.remove();
  container.scrollTop=container.scrollHeight;
}
function voiceSuggestions(values=[]){
  const container=$('#voice-suggestions');
  container.replaceChildren();
  for(const label of values){
    const btn=document.createElement('button');btn.type='button';btn.textContent=label;
    btn.dataset.action='voice-suggest';btn.dataset.example=label;container.appendChild(btn);
  }
}
function voiceReply(message){voiceLastReply=message;return message}
function speakText(message,listenAfter=false){
  if(!voiceSpeechOn||!('speechSynthesis' in window)){
    if(listenAfter&&voiceHandsFree)voiceStatus('Tap 🎤 Speak to answer.');
    return;
  }
  try{
    speechSynthesis.cancel();
    const utterance=new SpeechSynthesisUtterance(message);utterance.lang='en-NG';utterance.rate=.97;utterance.pitch=1.05;
    utterance.onend=()=>{if(listenAfter&&voiceHandsFree&&$('#voice-dialog').open&&!voiceListening){setTimeout(()=>{if($('#voice-dialog').open)toggleVoiceMic(true)},300)}};
    utterance.onerror=()=>{if(listenAfter&&voiceHandsFree)voiceStatus('Tap 🎤 Speak to answer Bloom.')};
    speechSynthesis.speak(utterance);
  }catch(err){voiceStatus('Voice playback unavailable. You can still read and type.')}
}
function bloomSay(message,{suggest=[],speak=true}={}){
  voiceReply(message);chatLine('bloom',message);voiceSuggestions(suggest);
  if(speak)speakText(message,voiceHandsFree);
}
function openVoice(){
  const dialog=$('#voice-dialog');
  if(!dialog.open)dialog.showModal();
  if(!voiceFirstWelcome){
    voiceFirstWelcome=true;
    if(aiHistory.length){
      aiHistory.forEach(m=>chatLine(m.role==='assistant'?'bloom':'you',m.content));
    }else bloomSay(`Hi ${bloomName()}! What can I do for you today? You can ask me anything, check your plans, or tell me what to save.`,{suggest:['What do I have tomorrow?','I want to add a task','How much did I spend this month?','Remember a new idea']});

  }
  voiceStatus(!cloudConfigured()?'Bloom AI needs secure configuration (Settings).':!cloudSession?'Sign in under Settings to use real Bloom AI.':SpeechRecognitionAPI()?'Ask anything in English or Pidgin, or type below.':'Microphone unsupported here; type your request.');
  $('#voice-input').focus();
}
function stopVoice(){
  if(voiceRecognition){try{voiceRecognition.abort()}catch(err){console.warn(err)}voiceRecognition=null}
  voiceListening=false;$('#voice-orb').classList.remove('listening');$('#voice-mic').textContent='🎤 Speak';
}
function closeVoice(){
  voiceHandsFree=false;stopVoice();if('speechSynthesis' in window)speechSynthesis.cancel();
  $('#voice-dialog').close();
}
function SpeechRecognitionAPI(){return window.SpeechRecognition||window.webkitSpeechRecognition||null}
function toggleVoiceMic(auto=false){
  if(voiceListening){stopVoice();voiceHandsFree=false;voiceStatus('Stopped listening. Tap Speak to start again.');return}
  const Speech=SpeechRecognitionAPI();
  if(!Speech){voiceStatus('This browser does not support speech recognition. Please type instead.');return}
  if(!auto)voiceHandsFree=true;
  if('speechSynthesis' in window)speechSynthesis.cancel();
  let rec;
  try{rec=new Speech();rec.lang='en-NG';rec.interimResults=true;rec.continuous=false;rec.maxAlternatives=1}
  catch(err){voiceStatus('Microphone unavailable. Please type your reply.');return}
  voiceRecognition=rec;let finalText='';
  rec.onstart=()=>{if(voiceRecognition!==rec)return;voiceListening=true;$('#voice-orb').classList.add('listening');$('#voice-mic').textContent='■ Stop';voiceStatus('Listening in English or Pidgin…')};
  rec.onresult=e=>{
    if(voiceRecognition!==rec)return;
    const words=Array.from(e.results).map(r=>r[0]?.transcript||'').join(' ').trim();
    if(!words)return;
    $('#voice-input').value=words;
    if(Array.from(e.results).some(r=>r.isFinal))finalText=words;
    voiceStatus(finalText?'Got it! Working out what you meant…':'Hearing: '+words.slice(0,65));
  };
  rec.onerror=e=>{
    if(voiceRecognition!==rec)return;
    const messages={'not-allowed':'Microphone is blocked. Allow it in browser settings or type here.','service-not-allowed':'Speech service is unavailable. Type your reply instead.','no-speech':'I did not hear you. Try again.','network':'This browser needs internet for speech recognition. Typing still works.','audio-capture':'No microphone found.','language-not-supported':'Nigerian English speech recognition is unsupported here; try typing.'};
    voiceStatus(messages[e.error]||'Microphone error. You can type your reply.');
    voiceHandsFree=false;
  };
  rec.onend=()=>{
    if(voiceRecognition!==rec)return;
    voiceListening=false;voiceRecognition=null;$('#voice-orb').classList.remove('listening');$('#voice-mic').textContent='🎤 Speak';
    if(finalText){$('#voice-input').value='';sendToBloom(finalText)}
  };
  try{rec.start()}catch(err){voiceRecognition=null;voiceHandsFree=false;voiceStatus('Could not start listening. Tap again or type your reply.')}
}
function speakVoice(){if(voiceLastReply)speakText(voiceLastReply,false);else voiceStatus('Ask Bloom something first.')}
function voiceReset(){
  aiHistory=[];localStorage.removeItem(AI_HISTORY_KEY);
  $('#voice-chat').replaceChildren();
  bloomSay(`Fresh start, ${bloomName()}! What would you like to talk about?`,{suggest:['What is my plan tomorrow?','Help plan my week','Add a note','Show my pending tasks']});
}

function previewVoice(){
  const text=$('#voice-input').value.trim();
  if(!text){voiceStatus('Tell Bloom something first.');return}
  $('#voice-input').value='';
  sendToBloom(text);
}
async function sendToBloom(raw){
  const text=String(raw||'').trim().slice(0,1800);
  if(!text||aiBusy)return;
  chatLine('you',text);
  voiceStatus('Bloom is thinking…');
  if(!cloudConfigured()){
    bloomSay('I want to understand you properly, so I need my secure AI service connected first. Please follow the Netlify and Supabase setup in the download guide.',{speak:false});
    voiceStatus('AI setup is required.');return;
  }
  if(!cloudSession){
    bloomSay('Please open Settings and sign in to your private Bloom account. This allows me to read and update your real plans securely.',{speak:false});
    voiceStatus('Sign-in required.');return;
  }
  aiBusy=true;$('#voice-mic').disabled=true;
  aiHistory.push({role:'user',content:text});aiHistory=aiHistory.slice(-18);
  localStorage.setItem(AI_HISTORY_KEY,JSON.stringify(aiHistory));
  try{
    await flushCloudSave();
    const answer=await bloomFunction('ai',{
      messages:aiHistory,
      today:localDay(),
      timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'Africa/Lagos'
    });
    if(answer.state){
      // The backend has committed every reported action to the database.
      state={...initialState(),...answer.state,settings:{...initialState().settings,...(answer.state.settings||{})}};
      persist();renderAll();
      if($('#today-dialog').open)renderTodayPlan();
      syncCloudReminders();
    }
    const reply=String(answer.reply||'I could not produce an answer. Please try again.').slice(0,5000);
    bloomSay(reply,{suggest:['What about tomorrow?','Show my pending tasks','Help me plan my day']});
    aiHistory.push({role:'assistant',content:reply});
    aiHistory=aiHistory.slice(-18);
    localStorage.setItem(AI_HISTORY_KEY,JSON.stringify(aiHistory));
    voiceStatus(answer.changes?.length?`${answer.changes.length} change(s) saved to your cloud planner.`:'Response from your connected AI.');
  }catch(e){
    // A failed request is never shown as a saved action.
    aiHistory.pop();
    localStorage.setItem(AI_HISTORY_KEY,JSON.stringify(aiHistory));
    bloomSay('I could not complete that request: '+e.message+' I have not confirmed any new changes. Please check your planner before trying again.',{speak:false});
    voiceStatus('Could not complete request.');
  }finally{aiBusy=false;$('#voice-mic').disabled=false}
}

function onAction(button){
  const action=button.dataset.action,itemId=button.dataset.id;
  if(action==='add-note')return openModal('note');
  if(action==='edit-note')return openModal('note',itemId);
  if(action==='pin-note'){
    const n=state.notes.find(x=>x.id===itemId);if(n){n.pinned=!n.pinned;update();toast(n.pinned?'Note pinned ✎':'Note unpinned');}return;
  }
  if(action==='delete-note'){
    const n=state.notes.find(x=>x.id===itemId);
    if(n&&confirm('Delete this note?')){state.notes=state.notes.filter(x=>x.id!==itemId);update();toast('Note removed');}return;
  }
  if(action==='clear-notes-filter'){noteSearch='';noteDateFilter='';$('#notes-search').value='';$('#notes-date').value='';renderNotes();return}
  if(action==='cloud-signup')return cloudSignIn('signup');
  if(action==='cloud-signout')return logoutCloud();
  if(action==='enable-push')return enablePush();
  if(action==='save-reminder-settings'){
    state.settings.voiceReminders=$('#settings-voice-reminders').checked;
    state.settings.alertTone=$('#settings-alert-tone').value;
    update();toast('Reminder preferences saved ✿');return;
  }
  if(action==='delete-memory'){
    const memory=state.memory.find(x=>x.id===itemId);
    if(memory&&confirm('Forget this saved preference?')){state.memory=state.memory.filter(x=>x.id!==itemId);update();toast('Preference removed');}return;
  }
  if(action==='clear-chat-history'){
    if(confirm('Clear your local conversation history with Bloom?')){
      aiHistory=[];localStorage.removeItem(AI_HISTORY_KEY);
      $('#voice-chat').replaceChildren();voiceFirstWelcome=false;toast('Conversation history cleared');
    }return;
  }
  if(action==='voice-open')return openVoice();
  if(action==='voice-close')return closeVoice();
  if(action==='voice-mic')return toggleVoiceMic();
  if(action==='voice-speak')return speakVoice();
  if(action==='voice-reset')return voiceReset();
  if(action==='voice-toggle-audio'){
    voiceSpeechOn=!voiceSpeechOn;button.textContent=voiceSpeechOn?'🔊 Voice on':'🔇 Voice off';
    button.setAttribute('aria-pressed',String(voiceSpeechOn));
    if(!voiceSpeechOn&&'speechSynthesis' in window)speechSynthesis.cancel();
    voiceStatus(voiceSpeechOn?'I will speak my replies aloud.':'Voice playback is off. Chat still works.');
    return;
  }
  if(action==='voice-suggest')return sendToBloom(button.dataset.example||'');
  if(action==='voice-preview')return previewVoice();
  if(action==='voice-example'){
    $('#voice-input').value=button.dataset.example||'';
    return previewVoice();
  }
  if(action==='today-open')return openTodayPlan();
  if(action==='today-close')return $('#today-dialog').close();
  if(action==='today-read'){speakText(priorityTaskSummary(),false);return}
  if(action==='today-add-task'){$('#today-dialog').close();selectedDay=localDay();return openModal('task')}
  if(action==='add-priority-category')return openModal('priority-category');
  if(action==='rename-priority-category')return openModal('priority-category',itemId);
  if(action==='delete-priority-category'){
    const c=state.priorityCategories.find(x=>x.id===itemId);
    if(!c||!confirm(`Delete ${c.name} and all its sub-priorities?`))return;
    state.priorityCategories=state.priorityCategories.filter(x=>x.id!==itemId);
    update();toast('Priority category removed');return;
  }
  if(action==='add-priority-item')return openModal('priority-item',itemId);
  if(action==='delete-priority-item'){
    const c=state.priorityCategories.find(x=>x.id===itemId);
    if(!c||!confirm('Delete this sub-priority?'))return;
    c.items=(c.items||[]).filter(x=>x.id!==button.dataset.itemId);update();return;
  }
  if(action==='add-task')return openModal('task');
  if(action==='edit-task')return openModal('task',itemId);
  if(action==='delete-task')return deleteFrom('task',itemId,'task');
  if(action==='select-day'){selectedDay=button.dataset.day;return renderPlanner()}
  if(action==='add-transaction')return openModal('transaction');
  if(action==='delete-transaction')return deleteFrom('transaction',itemId,'transaction');
  if(action==='add-project')return openModal('project');
  if(action==='edit-project')return openModal('project',itemId);
  if(action==='delete-project')return deleteFrom('project',itemId,'project');
  if(action==='add-habit')return openModal('habit');
  if(action==='toggle-habit')return toggleHabit(itemId,button.dataset.day||localDay());
  if(action==='delete-habit')return deleteFrom('habit',itemId,'habit');
  if(action==='add-budget')return openModal('budget');
  if(action==='delete-budget')return deleteFrom('budget',itemId,'budget');
  if(action==='add-goal')return openModal('goal');
  if(action==='deposit-goal')return openModal('deposit',itemId);
  if(action==='delete-goal')return deleteFrom('goal',itemId,'savings goal');
  if(action==='plan-day')return generateDayPlan();
  if(action==='close-modal'){if(modalType==='note')autoSaveNoteFinal();modalType=null;modalId=null;$('#entry-dialog').close();return}
  if(action==='close-assistant'){$('#assistant-dialog').close();return}
  if(action==='notifications'){navigate('settings');return enableNotifications()}
  if(action==='export')return exportBackup();
  if(action==='import'){$('#import-file').click();return}
  if(action==='clear-data')return clearData();
}
document.addEventListener('click',e=>{
  const go=e.target.closest('[data-go]');if(go){e.preventDefault();navigate(go.dataset.go);return}
  const button=e.target.closest('button[data-action]');if(button){e.preventDefault();onAction(button)}
});
document.addEventListener('change',e=>{
  const t=e.target;
  if(t.matches('[data-check-task]')){const task=state.tasks.find(item=>String(item.id)===String(t.dataset.checkTask));if(task){task.done=t.checked;task.completedAt=t.checked?new Date().toISOString():null;update();if($('#today-dialog').open)renderTodayPlan();if(t.checked)toast('You did it! One more little win ✿')}}
  if(t.matches('[data-priority-check]')){
    const c=state.priorityCategories.find(x=>x.id===t.dataset.priorityCheck);
    const item=(c?.items||[]).find(x=>x.id===t.dataset.itemId);
    if(item){item.done=t.checked;update();if($('#today-dialog').open)renderTodayPlan();if(t.checked)toast('Another priority completed ✳')}
  }
  if(t.name==='reminderMode')updateReminderFields();
  if(t.id==='planner-date'){selectedDay=safeDate(t.value);renderPlanner()}
  if(t.id==='transaction-filter'){transactionFilter=t.value;renderFinances()}
  if(t.id==='import-file'){importBackup(t.files[0]);t.value=''}
});
$('#voice-input').addEventListener('keydown',e=>{
  if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();previewVoice()}
});
document.addEventListener('toggle',e=>{
  if(e.target.matches('details.priority-category')){
    const c=state.priorityCategories.find(x=>x.id===e.target.dataset.categoryId);
    if(c&&c.expanded!==e.target.open){c.expanded=e.target.open;persist()}
  }
},true);
$('#voice-dialog').addEventListener('close',()=>{voiceHandsFree=false;stopVoice()});
$('#entry-form').addEventListener('submit',handleEntry);
$('#entry-form').addEventListener('input',e=>{
  if(e.target.id==='progress-input')$('#progress-display').textContent=e.target.value+'%';
  if(modalType==='note'){
    clearTimeout(noteDraftTimer);
    noteDraftTimer=setTimeout(autoSaveNote,500);
  }
});
$('#entry-form').addEventListener('change',e=>{
  if(modalType==='note'){clearTimeout(noteDraftTimer);noteDraftTimer=setTimeout(autoSaveNote,150)}
});
$('#notes-search').addEventListener('input',e=>{noteSearch=e.target.value;renderNotes()});
$('#notes-date').addEventListener('change',e=>{noteDateFilter=e.target.value;renderNotes()});
$('#cloud-account-form').addEventListener('submit',e=>{e.preventDefault();cloudSignIn('signin')});
$('#settings-form').addEventListener('submit',e=>{
  e.preventDefault();state.settings.name=$('#settings-name').value.trim().slice(0,50)||'Bella';
  state.settings.currency=$('#settings-currency').value;update();toast('Your preferences are saved ♡');
});
$('#entry-dialog').addEventListener('close',()=>{
  if(modalType==='note'){
    clearTimeout(noteDraftTimer);
    autoSaveNoteFinal();
  }
  modalType=null;modalId=null;
});
function autoSaveNoteFinal(){
  // Store edits that were typed immediately before close.
  if(modalType!=='note')return;
  const v=Object.fromEntries(new FormData($('#entry-form')).entries());
  if(!v.body?.trim()&&!v.title?.trim())return;
  let n=state.notes.find(x=>x.id===modalId);
  if(!n){n={id:id(),pinned:false};state.notes.push(n)}
  Object.assign(n,{title:(v.title||'').trim().slice(0,120)||'My note',
    body:(v.body||'').trim().slice(0,12000),category:(v.category||'Personal').trim().slice(0,50),
    date:safeDate(v.date),reminderAt:v.reminderAt||'',updatedAt:new Date().toISOString()});
  update();
}

window.addEventListener('hashchange',()=>navigate(location.hash.replace('#','')));
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{}));
if(cloudSession&&cloudConfigured())cloudInitialSync().catch(e=>{cloudStatus('⚠ Could not reconnect to cloud: '+e.message)});

renderAll();navigate(location.hash.replace('#','')||'home');
setInterval(reminderCheck,60*1000);setTimeout(reminderCheck,3000);
})();
