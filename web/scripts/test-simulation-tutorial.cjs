const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const root=path.resolve(__dirname,'..');
function fixture(){
 const rows=new Map(),state={userId:'member-a',writes:0},businesses=[{id:'business-a',userId:'member-a'},{id:'business-b',userId:'member-a'},{id:'foreign',userId:'member-b'}];
 const key=w=>`${w.userId}:${w.scope}`;
 const db={businessProfile:{findFirst:async({where})=>businesses.find(b=>b.id===where.id&&b.userId===where.userId)||null},simulationTutorialProgress:{findUnique:async({where})=>rows.get(key(where.userId_scope))||null,upsert:async({where,create,update})=>{state.writes++;const k=key(where.userId_scope);rows.set(k,rows.has(k)?{...rows.get(k),...update}:create);}},$queryRaw:async()=>[]};
 db.$transaction=async fn=>fn(db);
 const cache=new Map();
 function load(relative){const file=path.resolve(root,relative);if(cache.has(file))return cache.get(file);const exports={};cache.set(file,exports);const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','exports',code)(name=>name==='next/server'?{NextResponse:Response}:name==='@/lib/db'?{db}:name==='@/lib/workspace-request'?{workspaceUserId:async()=>state.userId,mutationOrigin:req=>req.headers.get('origin')===new URL(req.url).origin,workspaceError:(error,status=400)=>Response.json({error},{status}),workspaceBody:async req=>JSON.parse(await req.text())}:load(name.replace('@/','')+'.ts'),exports);return exports;}
 const domain=load('lib/simulation-tutorial.ts'),route=load('app/api/research-lab/tutorial/route.ts');
 const request=(body,origin='https://fortify-io.com')=>new Request('https://fortify-io.com/api/research-lab/tutorial',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
 return{domain,route,request,state,rows};
}
test('tutorial scopes and device saves isolate both member and business without abandoning personal history',()=>{
 const{domain}=fixture();assert.equal(domain.tutorialScope(null),'personal');assert.notEqual(domain.tutorialScope('a'),domain.tutorialScope('b'));
 assert.equal(domain.simulationStorageKey('user',null),'fortify-institute-v1:user');
 assert.notEqual(domain.simulationStorageKey('user','a'),domain.simulationStorageKey('user','b'));
 assert.notEqual(domain.simulationStorageKey('one','a'),domain.simulationStorageKey('two','a'));
});
test('progress requires authentication, matching origin and an owned business',async()=>{
 const f=fixture(),body={businessId:'business-a',version:1,outcome:'completed'};
 f.state.userId=null;assert.equal((await f.route.POST(f.request(body))).status,401);f.state.userId='member-a';
 assert.equal((await f.route.POST(f.request(body,'https://foreign.example'))).status,403);
 assert.equal((await f.route.POST(f.request({...body,businessId:'foreign'}))).status,404);
 assert.equal((await f.route.POST(f.request({...body,version:999}))).status,400);
 assert.equal((await f.route.POST(f.request({...body,outcome:'invented'}))).status,400);
 assert.equal(f.state.writes,0);
});
test('completion and skip persist per business and user; replay cannot downgrade completion',async()=>{
 const f=fixture(),post=async(businessId,outcome)=>f.route.POST(f.request({businessId,version:1,outcome}));
 assert.equal((await post('business-a','completed')).status,200);await post('business-b','skipped');await post(null,'skipped');await post('business-a','skipped');
 assert.equal(f.rows.get('member-a:business:business-a').outcome,'completed');assert.equal(f.rows.get('member-a:business:business-b').outcome,'skipped');assert.equal(f.rows.size,3);
 f.state.userId='member-b';await post(null,'completed');assert.equal(f.rows.size,4);assert.equal(f.rows.get('member-a:personal').outcome,'skipped');
});
