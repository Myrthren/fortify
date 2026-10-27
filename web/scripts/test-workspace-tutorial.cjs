const test=require('node:test'), assert=require('node:assert/strict'), path=require('node:path');
const {load}=require('./test-module-loader.cjs');
const root=path.resolve(__dirname,'..');
const domain=load(path.join(root,'lib/workspace-tutorial.ts'));
function fixture(){
 const state={userId:'one',tier:'PRO',fail:false,writes:0}, rows=new Map();
 const progress={findUnique:async({where})=>rows.get(where.userId)||null,upsert:async({where,create,update})=>{if(state.fail)throw Error('offline');state.writes++;const next=rows.has(where.userId)?{...rows.get(where.userId),...update}:create;rows.set(where.userId,next);return next;}};
 const db={workspaceTutorialProgress:progress,$queryRaw:async()=>[],user:{findUnique:async()=>{if(state.fail)throw Error('offline');return {tier:state.tier,workspaceTutorial:rows.get(state.userId)||null};}}};
 db.$transaction=async fn=>fn(db);
 const route=load(path.join(root,'app/api/workspace/tutorial/route.ts'),{'next/server':{NextResponse:Response},'@/lib/db':{db},'@/lib/workspace-tutorial':domain,'@/lib/workspace-request':{workspaceUserId:async()=>state.userId,mutationOrigin:req=>req.headers.get('origin')===new URL(req.url).origin,workspaceError:(error,status=400)=>Response.json({error},{status}),workspaceBody:async req=>JSON.parse(await req.text())}});
 const request=(body,origin='https://fortify-io.com')=>new Request('https://fortify-io.com/api/workspace/tutorial',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
 const post=(action,step)=>route.POST(request({version:1,action,step}));
 return {state,rows,db,route,request,post};
}
test('tutorial reads cannot enroll users; only a first-subscription enrollment becomes automatic',async()=>{
 const f=fixture();
 let result=await (await f.route.GET()).json();assert.equal(result.autoStart,false);assert.equal(f.state.writes,0);
 await domain.enrollWorkspaceTutorial(f.db,'one');
 // Prisma applies these defaults in the real database.
 Object.assign(f.rows.get('one'),{step:0,version:1,outcome:'pending'});
 result=await(await f.route.GET()).json();assert.equal(result.autoStart,true);assert.equal(result.state.step,0);
 f.state.tier='FREE';assert.equal((await(await f.route.GET()).json()).autoStart,false);
});
test('authentication, origin and bounded progress guard every tutorial mutation',async()=>{
 const f=fixture();f.state.userId=null;assert.equal((await f.route.GET()).status,401);assert.equal((await f.post('skip',0)).status,401);f.state.userId='one';
 assert.equal((await f.route.POST(f.request({version:1,action:'skip',step:0},'https://foreign.test'))).status,403);
 for(const body of [{version:2,action:'skip',step:0},{version:1,action:'restart',step:0},{version:1,action:{toString:'advance'},step:1},{version:1,action:null,step:0},{version:1,action:'advance',step:-1},{version:1,action:'advance',step:5},{version:1,action:'complete',step:3},{version:1,action:'advance',step:1.5}])assert.equal((await f.route.POST(f.request(body))).status,400);
 assert.equal(f.state.writes,0);
});
test('progress survives reads, stays account-scoped and never regresses on replay or a late skip',async()=>{
 const f=fixture();f.rows.set('one',{userId:'one',version:1,step:0,outcome:'pending'});
 await f.post('advance',3);await f.post('advance',1);
 assert.equal((await(await f.route.GET()).json()).state.step,3);
 await f.post('complete',4);await f.post('skip',0);await f.post('advance',1);
 assert.equal(f.rows.get('one').outcome,'completed');assert.equal(f.rows.get('one').step,4);
 assert.equal((await(await f.route.GET()).json()).autoStart,false);
 f.state.userId='two';await f.post('skip',1);assert.equal(f.rows.get('two').outcome,'skipped');assert.equal(f.rows.get('one').outcome,'completed');
});
test('manual replay never enrolls an existing member; storage failures remain recoverable',async()=>{
 const f=fixture();await f.post('advance',1);assert.equal(f.rows.get('one').outcome,'skipped');
 assert.equal((await(await f.route.GET()).json()).autoStart,false);
 f.state.fail=true;assert.equal((await f.route.GET()).status,503);assert.equal((await f.post('complete',4)).status,503);assert.equal(f.rows.get('one').outcome,'skipped');
});

function paypalFixture(){
 const state={signedIn:true,status:'ACTIVE',plan:'plan_pro',subscription:null,tutorial:null,fail:false,tier:'FREE'}, domain=load(path.join(root,'lib/workspace-tutorial.ts'));
 const tx={$queryRaw:async()=>[],subscription:{findUnique:async()=>state.subscription},workspaceTutorialProgress:{upsert:async({create})=>{state.tutorial??={...create,outcome:'pending',step:0,version:1};}},user:{update:async({data})=>{if(state.fail)throw Error('write failed');state.tier=data.tier;state.subscription={id:'sub',...data.subscription.upsert.create};return {discordId:null};}}};
 const db={$transaction:async fn=>{const before=structuredClone(state);try{return await fn(tx);}catch(e){Object.assign(state,before);throw e;}}};
 const {POST}=load(path.join(root,'app/api/paypal/activate/route.ts'),{'next/server':{NextResponse:Response},'@/auth':{auth:async()=>state.signedIn?{user:{id:'one'}}:null},'@/lib/db':{db},'@/lib/paypal':{getSubscription:async()=>({status:state.status,plan_id:state.plan})},'@/lib/discord':{},'@/lib/tiers':{PLAN_TO_TIER:{plan_pro:'PRO'}},'@/lib/workspace-tutorial':domain});
 const activate=()=>POST(new Request('https://fortify-io.com/api/paypal/activate',{method:'POST',body:JSON.stringify({subscriptionID:'verified-sub'})}));
 return {state,activate};
}
test('PayPal enrollment is atomic with the first activated subscription; retries and returning members do not restart it',async()=>{
 const f=paypalFixture();assert.equal((await f.activate()).status,200);assert.equal(f.state.tutorial.outcome,'pending');
 f.state.tutorial.outcome='completed';await f.activate();assert.equal(f.state.tutorial.outcome,'completed');
 const returning=paypalFixture();returning.state.subscription={id:'previous'};await returning.activate();assert.equal(returning.state.tutorial,null);
 const failed=paypalFixture();failed.state.fail=true;await assert.rejects(failed.activate());assert.equal(failed.state.tutorial,null);assert.equal(failed.state.subscription,null);
});
test('failed or unknown PayPal plans cannot enroll the tutorial',async()=>{
 for(const change of [f=>f.state.signedIn=false,f=>f.state.status='CANCELLED',f=>f.state.plan='unknown']){const f=paypalFixture();change(f);assert.ok((await f.activate()).status>=400);assert.equal(f.state.tutorial,null);}
});
