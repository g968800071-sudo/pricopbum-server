const C='pricopbum-mw4tiqf0';const A=['./','index.html','game.js','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','splash.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(A.map(x=>new Request(x,{cache:'reload'})))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>{const old=k.filter(x=>x!==C);return Promise.all(old.map(x=>caches.delete(x))).then(()=>self.clients.claim()).then(()=>{if(old.length)return self.clients.matchAll({type:'window'}).then(cs=>cs.forEach(c=>{try{c.navigate(c.url)}catch(_){}}))})}))});
self.addEventListener('message',e=>{if(e.data==='skip')self.skipWaiting()});
self.addEventListener('fetch',e=>{const q=e.request,u=new URL(q.url);if(q.method!=='GET'||u.origin!==location.origin||u.pathname.endsWith('/ws')||u.pathname.indexOf('/api')===0)return;const code=q.mode==='navigate'||/\.(html|js|webmanifest)$/.test(u.pathname)||u.pathname.endsWith('/');
if(code){e.respondWith(fetch(q,{cache:'no-store'}).then(res=>{if(res&&res.ok){const cp=res.clone();caches.open(C).then(c=>c.put(q,cp))}return res}).catch(()=>caches.match(q,{ignoreSearch:true}).then(r=>r||caches.match('index.html'))));return;}
e.respondWith(caches.match(q).then(r=>r||fetch(q).then(res=>{if(res&&res.ok){const cp=res.clone();caches.open(C).then(c=>c.put(q,cp))}return res})))});
