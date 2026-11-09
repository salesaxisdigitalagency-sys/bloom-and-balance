const CACHE='bloom-balance-v4-intelligence';
const ASSETS=['./','./index.html','./styles.css','./app.js','./config.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==self.location.origin||u.pathname.includes('/.netlify/'))return;
  e.respondWith(fetch(e.request).then(r=>{
    if(r.ok){const copy=r.clone();e.waitUntil(caches.open(CACHE).then(c=>c.put(e.request,copy)));}
    return r;
  }).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))));
});
self.addEventListener('push',e=>{
  let payload={title:'Bloom & Balance ✿',body:'You have a reminder!',url:'/'};
  try{payload={...payload,...e.data.json()}}catch{}
  e.waitUntil(self.registration.showNotification(String(payload.title||'Bloom reminder').slice(0,160),{
    body:String(payload.body||'Your planner needs your attention.').slice(0,300),
    icon:'./icons/icon-192.png',badge:'./icons/icon-192.png',
    tag:String(payload.tag||'bloom-reminder').slice(0,250),
    data:{url:'/'}
  }));
});
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(all=>{
    for(const c of all){if(new URL(c.url).origin===self.location.origin)return c.focus()}
    return self.clients.openWindow('./');
  }));
});
