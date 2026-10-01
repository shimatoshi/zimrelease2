const CACHE='zim-library-v2',SHELL=['/','/index.html','/manifest.webmanifest','/icon.svg'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('zim-library-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 const u=new URL(e.request.url);
 if(e.request.method!=='GET'||u.origin!==location.origin)return;
 if(u.pathname!=='/api/releases'&&!SHELL.includes(u.pathname))return;
 e.respondWith((async()=>{
  try{
   const response=await fetch(e.request);
   if(response.ok){
    try{const cache=await caches.open(CACHE);await cache.put(e.request,response.clone())}catch{}
    return response;
   }
   return await caches.match(e.request)||response;
  }catch{
   return await caches.match(e.request)||new Response('Offline',{status:503});
  }
 })());
});
