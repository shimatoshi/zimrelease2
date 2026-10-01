const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync(new URL('../index.html','file://'+__filename),'utf8');
const submit=html.slice(html.indexOf('async function submitTopic()'),html.indexOf("document.querySelector('#topic-input').addEventListener"));
function form(fetch){
 const classes=new Set();
 const elements={
  '#topic-input':{value:'研究テーマ',disabled:false},
  '#submit-btn':{disabled:false},
  '#submit-msg':{textContent:'',classList:{add:c=>classes.add(c),remove:c=>classes.delete(c)}}
 };
 let timeout;
 const context=vm.createContext({document:{querySelector:s=>elements[s]},fetch,URL,AbortController,TypeError,setTimeout:f=>(timeout=f,1),clearTimeout:()=>{}});
 vm.runInContext(submit,context);
 return {elements,classes,send:()=>context.submitTopic(),timeout:()=>timeout()};
}
const resolveResponse={ok:true,json:async()=>({url:'https://backend.example/'})};
test('HTTP failure preserves the topic and releases the form',async()=>{
 let calls=0;const f=form(async()=>++calls===1?resolveResponse:{ok:false,status:503,json:async()=>({})});
 await f.send();assert.match(f.elements['#submit-msg'].textContent,/HTTP 503/);assert.equal(f.elements['#topic-input'].value,'研究テーマ');assert.equal(f.elements['#submit-btn'].disabled,false);assert(f.classes.has('error'));
});
test('resolver failure never submits a topic',async()=>{
 let calls=0;const f=form(async()=>{calls++;return {ok:false,status:502}});await f.send();assert.equal(calls,1);assert.match(f.elements['#submit-msg'].textContent,/送信先/);
});
test('successful acceptance clears the topic and normalizes a trailing slash',async()=>{
 let calls=0;const f=form(async(url,options)=>{if(++calls===1)return resolveResponse;assert.equal(url,'https://backend.example/api/research');assert.equal(options.method,'POST');assert.equal(JSON.parse(options.body).topic,'研究テーマ');return {ok:true,json:async()=>({job_id:'test'})}});
 await f.send();assert.equal(f.elements['#topic-input'].value,'');assert.match(f.elements['#submit-msg'].textContent,/受け付けました/);
});
test('a repeated submission while pending does not duplicate the POST',async()=>{
 let release,calls=0;const f=form(()=>{calls++;return new Promise(r=>release=r)});const pending=f.send();await f.send();assert.equal(calls,1);release({ok:false,status:502});await pending;
});
test('application rejection is displayed even for HTTP 200',async()=>{
 let calls=0;const f=form(async()=>++calls===1?resolveResponse:{ok:true,json:async()=>({success:false,error:'受付停止中'})});await f.send();assert.match(f.elements['#submit-msg'].textContent,/受付停止中/);assert.equal(f.elements['#topic-input'].value,'研究テーマ');
});
test('POST timeout warns that acceptance may have occurred',async()=>{
 let calls=0;const f=form(async(_,options)=>{if(++calls===1)return resolveResponse;return new Promise((_,reject)=>options.signal.addEventListener('abort',()=>reject({name:'AbortError'})))});
 const pending=f.send();await new Promise(r=>setImmediate(r));f.timeout();await pending;assert.match(f.elements['#submit-msg'].textContent,/受付済みの可能性/);assert.equal(f.elements['#submit-btn'].disabled,false);
});
test('an invalid resolver URL never submits a topic',async()=>{
 let calls=0;const f=form(async()=>{calls++;return {ok:true,json:async()=>({url:'http://backend.example'})}});await f.send();assert.equal(calls,1);assert(f.classes.has('error'));
});
function worker(fetch,match=async()=>undefined,put=async()=>{}){
 const handlers={};const deleted=[];
 const context=vm.createContext({self:{addEventListener:(name,fn)=>handlers[name]=fn,clients:{claim:async()=>{}},skipWaiting:async()=>{}},location:{origin:'https://library.example'},URL,Response,fetch,caches:{open:async()=>({put,addAll:async()=>{}}),match,keys:async()=>['zim-library-v1','other-app-v1','zim-library-v2'],delete:async k=>deleted.push(k)}});
 vm.runInContext(fs.readFileSync(new URL('../sw.js','file://'+__filename),'utf8'),context);
 return {deleted,activate:()=>{let promise;handlers.activate({waitUntil:p=>promise=p});return promise},get:(path,method='GET')=>{let promise;handlers.fetch({request:{url:'https://library.example'+path,method},respondWith:p=>promise=p});return promise}};
}
test('navigation returns the latest shell while caching it',async()=>{
 let writes=0;const w=worker(async()=>new Response('new shell'),async()=>new Response('old shell'),async()=>writes++);assert.equal(await (await w.get('/')).text(),'new shell');assert.equal(writes,1);
});
test('offline navigation returns the saved shell',async()=>{
 const w=worker(async()=>{throw Error('offline')},async()=>new Response('saved shell'));assert.equal(await (await w.get('/')).text(),'saved shell');
});
test('offline without a saved response returns HTTP 503',async()=>{
 const w=worker(async()=>{throw Error('offline')});assert.equal((await w.get('/api/releases')).status,503);
});
test('cache quota failures do not hide a successful response',async()=>{
 const w=worker(async()=>new Response('network'),async()=>undefined,async()=>{throw Error('quota')});assert.equal(await (await w.get('/')).text(),'network');
});
test('activation preserves unrelated application caches and POST is untouched',async()=>{
 const w=worker(async()=>new Response('ok'));await w.activate();assert.deepEqual(w.deleted,['zim-library-v1']);assert.equal(w.get('/api/research','POST'),undefined);
});
