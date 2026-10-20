const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
const root = path.resolve(__dirname, '..'), at = new Date('2026-10-20T10:00:00Z');
function fixture() {
  const state = { session: { user: { id: 'alice' } }, tier: 'ELITE', plans: [], runs: [], launches: [], result: { runId: 'execution1', status: 'completed' }, throwRun: false, offline: false, rate: true,
    workflows: [{ id: 'workflow1', userId: 'alice', name: 'Prepare a brief', description: null, updatedAt: at, nodes: { nodes: [{ type: 'action_notion', label: 'Create draft page', config: { accessToken: 'NEVER_SERIALIZE' } }] }, runs: [] }, { id: 'private', userId: 'bob', name: 'Private procedure', updatedAt: at, nodes: [], runs: [] }] };
  const matches = (row, where) => Object.entries(where).every(([key, value]) => typeof value === 'object' && value && 'in' in value ? value.in.includes(row[key]) : row[key] === value);
  const write = (row, data) => { if (state.offline) throw Error('offline'); for (const [key,value] of Object.entries(data)) row[key] = value && typeof value === 'object' && 'increment' in value ? row[key] + value.increment : value; row.updatedAt = at; return structuredClone(row); };
  const db = {
    user: { findUnique: async () => ({ tier: state.tier, discordId: null }) },
    futurePlan: {
      create: async ({ data }) => { if (state.offline) throw Error('offline'); const plan = { id: `plan${state.plans.length + 1}`, version: 1, archived: false, createdAt: at, updatedAt: at, ...data }; state.plans.push(plan); return structuredClone(plan); },
      findFirst: async ({ where, include }) => { if (state.offline) throw Error('offline'); const plan = state.plans.find(p => matches(p, where)); return plan ? structuredClone({ ...plan, ...(include ? { runs: state.runs.filter(r => r.planId === plan.id) } : {}) }) : null; },
      updateMany: async ({ where, data }) => { const plan = state.plans.find(p => matches(p, where)); if (!plan) return { count: 0 }; write(plan, data); return { count: 1 }; },
    },
    workflow: { findFirst: async ({ where }) => state.workflows.find(w => matches(w, where)) ?? null, findMany: async ({ where }) => state.workflows.filter(w => matches(w, where)), count: async ({ where }) => state.workflows.filter(w => matches(w, where)).length },
    planProcedureRun: {
      findUnique: async ({ where }) => state.runs.find(r => matches(r, where.planId_nodeId)) ?? null,
      create: async ({ data }) => { if (state.runs.some(r => r.planId === data.planId && r.nodeId === data.nodeId)) throw Error('unique'); const run = { id: `reservation${state.runs.length}`, status: 'starting', message: null, runId: null, createdAt: at, updatedAt: at, ...data }; state.runs.push(run); return { ...run }; },
      update: async ({ where, data }) => write(state.runs.find(r => matches(r, where)), data),
      updateMany: async ({ where, data }) => { const row = state.runs.find(r => matches(r, where)); if (!row) return { count: 0 }; write(row, data); return { count: 1 }; },
    },
  };
  for (const connection of ['notion','shopify','stripe','google','meta']) db[connection + 'Connection'] = { findUnique: async ({ where, select }) => { assert.equal(where.userId, 'alice'); assert.ok(!('accessToken' in select)); return connection === 'notion' ? { workspaceName: 'My workspace' } : null; } };
  db.$transaction = async fn => { const plans = structuredClone(state.plans), runs = structuredClone(state.runs); try { return await fn(db); } catch (e) { state.plans = plans; state.runs = runs; throw e; } };
  const cache = new Map();
  function load(relative, runner = false) {
    const file = path.resolve(root, relative.endsWith('.ts') ? relative : relative + '.ts'); if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
    function requireLocal(name) {
      if (name === 'next/server') return { NextResponse: Object.assign(Response, { json: Response.json }) };
      if (name === '@/auth') return { auth: async () => state.session };
      if (name === '@/lib/db' || name === './db') return { db };
      if (name === '@/lib/rate-limit') return { rateLimit: () => ({ ok: state.rate, resetMs: 10 }), rateLimitResponse: () => Response.json({ error: 'Wait' }, { status: 429 }) };
      if (name === '@/lib/workflow-runner') return { runWorkflow: async (...args) => { state.launches.push(args); if (state.throwRun) throw Error('interrupted'); return state.result; } };
      if (runner && !name.endsWith('db') && !name.startsWith('node:')) return {};
      if (name.startsWith('node:')) return require(name);
      return load(name.startsWith('@/') ? name.slice(2) : path.relative(root, path.resolve(path.dirname(file), name)));
    }
    new Function('require','module','exports',code)(requireLocal,module,module.exports); return module.exports;
  }
  const domain = load('lib/future-plans');
  function saved(document = { nodes: [{ id: 'step', kind: 'procedure', title: 'Prepare launch', body: '', status: 'planned', x: 0, y: 0, width: 265, height: 185, workflowId: 'workflow1' }], edges: [], viewport: { x: 0, y: 0, zoom: 1 } }) { const plan = { id: 'plan1', userId: 'alice', version: 1, title: 'Launch', description: '', archived: false, document, ...domain.planCounts(document), createdAt: at, updatedAt: at }; state.plans.push(plan); return plan; }
  return { state, load, saved, domain, post: load('app/api/plans/route').POST, get: load('app/api/plans/[id]/route').GET, patch: load('app/api/plans/[id]/route').PATCH, run: load('app/api/plans/[id]/procedure/route').POST };
}
const req = (body, method = 'POST', origin = 'https://fortify-io.com') => new Request('https://fortify-io.com/api/plans/plan1', { method, headers: { origin, 'Content-Type':'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const context = id => ({ params: Promise.resolve({ id }) });
const approval = { nodeId: 'step', version: 1, workflowUpdatedAt: at.toISOString(), approved: true };

test('all starters validate, contain no pre-attached automations, and export standard JSON Canvas structures', () => {
  const { domain: d } = fixture();
  for (const kind of ['blank','launch','growth']) { const doc = d.parsePlanDocument(d.planStarter(kind)); assert.ok(doc.nodes.every(n => !n.workflowId)); const exported = d.exportJsonCanvas(doc); assert.ok(exported.nodes.every(n => ['text','group','link'].includes(n.type))); assert.ok(exported.edges.every(e => e.fromNode && e.toNode)); }
});
test('invalid shapes, calendar dates, oversized canvases and executable resource URLs are rejected', () => {
  const f = fixture(), doc = f.saved().document, d = f.domain;
  for (const value of [null, {}, { ...doc, nodes: Array(101).fill(doc.nodes[0]) }, { ...doc, nodes: [doc.nodes[0],doc.nodes[0]] }, { ...doc, nodes: [{ ...doc.nodes[0], date: '2026-02-30' }] }, { ...doc, nodes: [{ ...doc.nodes[0], url: 'javascript:alert(1)' }] }, { ...doc, nodes: [{ ...doc.nodes[0], url: 'https://user:pass@example.com' }] }, { ...doc, viewport: { x: 0, y: 0, zoom: Infinity } }]) assert.throws(() => d.parsePlanDocument(value));
});
test('blocking loops are rejected but supporting feedback loops remain valid', () => {
  const { domain: d } = fixture(), doc = d.planStarter('growth'); doc.edges.push({ id:'feedback', from:'review', to:'audience', relation:'blocks', label:'' }); assert.throws(() => d.parsePlanDocument(doc), /loop/); doc.edges.at(-1).relation = 'supports'; assert.doesNotThrow(() => d.parsePlanDocument(doc));
});
test('readiness respects prerequisites, dates, completion and relationship meanings', () => {
  const f = fixture(), doc = f.domain.planStarter('growth'); assert.equal(f.domain.planReadiness(doc,'outreach','2026-10-20').ready,false); doc.nodes.find(n=>n.id==='leads').status='done'; assert.equal(f.domain.planReadiness(doc,'outreach','2026-10-20').ready,true); doc.nodes.find(n=>n.id==='outreach').date='2026-10-21'; assert.equal(f.domain.planReadiness(doc,'outreach','2026-10-20').ready,false); doc.edges.find(e=>e.to==='outreach').relation='alternative'; assert.equal(f.domain.planReadiness(doc,'outreach','2026-10-21').ready,true); doc.nodes.find(n=>n.id==='outreach').status='done'; assert.equal(f.domain.planReadiness(doc,'outreach','2026-10-21').ready,false);
});
test('a target date on a task does not prevent starting work before the deadline; exports retain resource notes', () => {
  const f=fixture(), doc=f.domain.planStarter('growth'); const task=doc.nodes.find(n=>n.id==='audience'); task.date='2999-01-01'; task.body='Keep these planning notes'; task.url='https://example.com/resource'; assert.equal(f.domain.planReadiness(doc,task.id,'2026-10-20').ready,true); const exported=f.domain.exportJsonCanvas(doc).nodes.find(n=>n.id===task.id); assert.match(exported.text,/Keep these planning notes/); assert.match(exported.text,/https:\/\/example.com\/resource/);
});
test('signed-out and malformed sessions cannot access plans or procedures', async () => {
  for (const session of [null,{user:{}},{user:{id:123}}]) { const f=fixture(); f.state.session=session; for (const action of [()=>f.post(req({title:'Plan'})),()=>f.get(new Request('https://fortify-io.com'),context('plan1')),()=>f.patch(req({version:1,title:'X'},'PATCH'),context('plan1')),()=>f.run(req(approval),context('plan1'))]) assert.equal((await action()).status,401); assert.equal(f.state.launches.length,0); }
});
test('foreign origins cannot mutate plans or launch procedures', async () => {
  const f=fixture(); f.saved(); for(const origin of ['', 'null', 'https://evil.example']) { assert.equal((await f.post(req({title:'X'},'POST',origin))).status,403); assert.equal((await f.patch(req({version:1,title:'X'},'PATCH',origin),context('plan1'))).status,403); assert.equal((await f.run(req(approval,'POST',origin),context('plan1'))).status,403); } assert.equal(f.state.plans[0].version,1);
});
test('creating, saving and archiving plans preserves data and increments versions', async () => {
  const f=fixture(); assert.equal((await f.post(req({title:'  My plan ',template:'growth'}))).status,201); assert.equal(f.state.plans[0].title,'My plan'); const response=await f.patch(req({version:1,archived:true,title:'Renamed'},'PATCH'),context('plan1')); assert.equal(response.status,200); const plan=(await response.json()).plan; assert.equal(plan.version,2); assert.equal(plan.archived,true); assert.equal(plan.title,'Renamed');
});
test('cross-account reads and edits stay private; stale saves cannot overwrite newer work', async () => {
  const f=fixture(); f.saved(); f.state.plans[0].userId='bob'; assert.equal((await f.get(new Request('https://fortify-io.com'),context('plan1'))).status,404); assert.equal((await f.patch(req({version:1,title:'Steal'},'PATCH'),context('plan1'))).status,404); assert.equal((await f.run(req(approval),context('plan1'))).status,404); f.state.plans[0].userId='alice'; assert.equal((await f.patch(req({version:9,title:'Stale'},'PATCH'),context('plan1'))).status,409); assert.equal(f.state.plans[0].title,'Launch');
});
test('procedure bindings enforce ownership and never serialize configuration or credentials', async () => {
  const f=fixture(), plan=f.saved(); const bindings=await f.load('lib/plan-storage').getPlanBindings('alice'); assert.equal(bindings.workflows.length,1); assert.equal(bindings.software.find(s=>s.id==='notion').connected,true); assert.ok(!JSON.stringify(bindings).includes('NEVER_SERIALIZE')); assert.ok(!JSON.stringify(bindings).includes('Private procedure')); plan.document.nodes[0].workflowId='private'; assert.equal((await f.patch(req({version:1,document:plan.document},'PATCH'),context('plan1'))).status,400);
});
test('invalid bodies, empty edits and creation throttles return actionable errors without writing', async () => {
  const f=fixture(); f.saved(); for(const body of ['null','{broken', {version:1}, {version:1, title:''}, {version:1,archived:'yes'}]) assert.equal((await f.patch(req(body,'PATCH'),context('plan1'))).status,400); f.state.rate=false; assert.equal((await f.post(req({title:'x'}))).status,429); assert.equal(f.state.plans.length,1);
});
test('procedure launches require explicit approval, execution tier and reviewed plan/workflow versions', async () => {
  const f=fixture(); f.saved(); assert.equal((await f.run(req({...approval,approved:false}),context('plan1'))).status,400); f.state.tier='PRO'; assert.equal((await f.run(req(approval),context('plan1'))).status,403); f.state.tier='ELITE'; assert.equal((await f.run(req({...approval,version:2}),context('plan1'))).status,409); assert.equal((await f.run(req({...approval,workflowUpdatedAt:'old'}),context('plan1'))).status,409); assert.equal(f.state.launches.length,0);
});
test('future dates, unfinished prerequisites, completed cards and archived plans prevent execution', async () => {
  for(const condition of ['future','blocked','done','archived']) { const f=fixture(), p=f.saved(); if(condition==='future') p.document.nodes[0].date='2999-01-01'; if(condition==='done') p.document.nodes[0].status='done'; if(condition==='archived') p.archived=true; if(condition==='blocked') { p.document.nodes.push({...p.document.nodes[0],id:'before',kind:'task',workflowId:undefined}); p.document.edges.push({id:'block',from:'before',to:'step',relation:'blocks',label:''}); } assert.notEqual((await f.run(req(approval),context('plan1'))).status,200); assert.equal(f.state.launches.length,0); }
});
test('a successful launch reserves the card once and passes the reviewed workflow version to the runner', async () => {
  const f=fixture(); f.saved(); assert.equal((await f.run(req(approval),context('plan1'))).status,200); assert.equal(f.state.launches.length,1); assert.equal(f.state.launches[0][3],at.toISOString()); assert.equal(f.state.runs[0].status,'completed'); assert.equal((await f.run(req({...approval,version:2}),context('plan1'))).status,409); assert.equal(f.state.launches.length,1); assert.equal(f.state.plans[0].version,2,'rejected repeat rolls back version lock');
});
test('an uncertain or partially failed execution cannot be repeated through the plan', async () => {
  for(const interrupted of [true,false]) { const f=fixture(); f.saved(); f.state.throwRun=interrupted; f.state.result={runId:'execution1',status:'failed'}; assert.equal((await f.run(req(approval),context('plan1'))).status,interrupted?503:200); assert.equal((await f.run(req({...approval,version:2}),context('plan1'))).status,409); assert.equal(f.state.launches.length,1); }
});
test('preflight failures with no execution can be reviewed and retried safely', async () => {
  const f=fixture(); f.saved(); f.state.result={runId:'',status:'error',message:'Insufficient capacity'}; await f.run(req(approval),context('plan1')); assert.equal(f.state.runs[0].status,'not-started'); f.state.result={runId:'execution1',status:'completed'}; assert.equal((await f.run(req({...approval,version:2}),context('plan1'))).status,200); assert.equal(f.state.runs.length,1); assert.equal(f.state.runs[0].status,'completed');
});
test('the actual workflow runner rejects an edited definition before capacity or side effects', async () => {
  const f=fixture(); const runner=f.load('lib/workflow-runner',true); const result=await runner.runWorkflow('workflow1','alice',{},'old-version'); assert.equal(result.status,'error'); assert.equal(result.runId,''); assert.match(result.message,/changed/);
});
