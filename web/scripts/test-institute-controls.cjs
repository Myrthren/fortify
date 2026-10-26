// Component callback tests, not a substitute for browser/layout verification.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),crypto=require('node:crypto'),root=path.resolve(__dirname,'..');
function controls(store=new Map(),key='device-test',options={}){
 const slots=[],effects=[],pending=[],timers=new Map();let cursor=0,changed=false,nextTimer=1,tree,confirm=true,confirmCount=0;
 const react={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],value=>{const next=typeof value==='function'?value(slots[i]):value;if(next!==slots[i])changed=true;slots[i]=next;}];},useRef(initial){const i=cursor++;if(!(i in slots))slots[i]={current:initial};return slots[i];},useEffect(fn,deps){const i=cursor++,old=effects[i];if(!old||deps.some((d,j)=>d!==old.deps[j])){effects[i]={deps,cleanup:old?.cleanup};pending.push(()=>{effects[i].cleanup?.();effects[i].cleanup=fn();});}}};
 const cache=new Map(),localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)},window={confirm:()=>{confirmCount++;return confirm;}};
 function load(file){file=path.resolve(file);if(!path.extname(file))file+=fs.existsSync(file+'.tsx')?'.tsx':'.ts';if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;function req(n){if(n==='@/components/research-institute-scene')return{ResearchInstituteScene:'scene'};if(n==='react')return react;if(n==='react/jsx-runtime')return{jsx:(type,props,key)=>({type,props,key}),jsxs:(type,props,key)=>({type,props,key})};if(n==='lucide-react')return new Proxy({},{get:(_,n)=>n});if(n.startsWith('@/'))return load(path.join(root,n.slice(2)));return require(n);}new Function('require','module','exports','localStorage','window','crypto','setTimeout','clearTimeout',code)(req,m,m.exports,localStorage,window,crypto,(cb,ms)=>{const id=nextTimer++;timers.set(id,{cb,ms});return id;},id=>timers.delete(id));return m.exports;}
 const {ResearchInstitute}=load(path.join(root,'components/research-institute'));
 function render(){let count=0;do{changed=false;cursor=0;tree=ResearchInstitute({storageKey:key,aiAvailable:false,...options});while(pending.length)pending.shift()();if(++count>12)throw Error('render loop');}while(changed);return tree;}
 function all(node,result=[]){if(!node||typeof node!=='object')return result;if(Array.isArray(node)){node.forEach(n=>all(n,result));return result;}result.push(node);all(node.props?.children,result);return result;}
 const text=node=>typeof node==='string'||typeof node==='number'?String(node):Array.isArray(node)?node.map(text).join(''):node?.props?text(node.props.children):'';
 function find(predicate){const n=all(tree).find(predicate);assert.ok(n,'control was rendered');return n;}
 // Playback lives in the separately browser-tested 3D component. Exercise its
 // controller callbacks here without creating a second WebGL scene in Node.
 function button(name){if(['Next round','Run simulation','Pause'].includes(name)){const scene=find(n=>n.type==='scene').props;return{props:{onClick:name==='Next round'?scene.onStep:scene.onToggleRun,disabled:name==='Next round'?!scene.canStep:!scene.canRun}};}return find(n=>n.type==='button'&&text(n).trim()===name);}
 render();return{store,key,render,text:()=>text(tree),find,button,state:()=>JSON.parse(store.get(key)),setConfirmation:value=>confirm=value,confirmationCount:()=>confirmCount,async act(fn){await fn();return render();},async timer(){const item=[...timers.entries()][0];assert.ok(item);timers.delete(item[0]);item[1].cb();await Promise.resolve();render();},timers};
}
test('next-round control runs the real engine and autosaves a restorable session',async()=>{const c=controls();assert.equal(c.state().frames.at(-1).round,0);await c.act(()=>c.button('Next round').props.onClick());assert.equal(c.state().frames.at(-1).round,1);assert.match(c.text(),/Nia allocated 8 shared credits/);const restored=controls(c.store,c.key);assert.equal(restored.state().frames.at(-1).round,1);assert.match(restored.text(),/Round 1 \/ 24/);});
test('intervention controls change resources; replay cannot advance or alter the present',async()=>{const c=controls();await c.act(()=>c.button('Next round').props.onClick());await c.act(()=>c.find(n=>n.type==='button'&&cString(n).startsWith('Instrument fault')).props.onClick());assert.equal(c.state().frames.at(-1).health,35);const frames=c.state().frames.length;await c.act(()=>c.find(n=>n.props?.['aria-label']==='Replay recorded research states').props.onChange({target:{value:'0'}}));assert.match(c.text(),/Viewing recorded history/);assert.equal(c.button('Next round').props.disabled,true);await c.act(()=>c.button('Next round').props.onClick());assert.equal(c.state().frames.length,frames);await c.act(()=>c.find(n=>n.type==='button'&&cString(n).startsWith('Return to latest')).props.onClick());assert.match(c.text(),/35%/);});
function cString(n){if(typeof n==='string'||typeof n==='number')return String(n);if(Array.isArray(n))return n.map(cString).join('');return cString(n?.props?.children??'');}
test('run, pause and timed playback advance bounded rounds without a permanent background loop',async()=>{const c=controls();await c.act(()=>c.button('Run simulation').props.onClick());assert.equal(c.timers.size,1);await c.timer();assert.equal(c.state().frames.at(-1).round,1);assert.equal(c.timers.size,1);await c.act(()=>c.button('Pause').props.onClick());assert.equal(c.timers.size,0);assert.match(c.text(),/Session paused/);});
test('agent inspection and research priorities work independently of advancing time',async()=>{const c=controls();await c.act(()=>c.find(n=>n.props?.['aria-label']==='Inspect Jun Park, Systems engineer').props.onClick());assert.match(c.text(),/Keep instruments trustworthy/);assert.match(c.text(),/threshold requires 2 reviewed results/);await c.act(()=>c.find(n=>n.props?.['aria-label']==='Research priority').props.onChange({target:{value:'rigour'}}));assert.equal(c.state().frames.at(-1).focus,'rigour');assert.equal(c.state().frames.at(-1).round,0);assert.match(c.text(),/threshold requires 3 reviewed results/);});
test('reset requires a valid seed and respects a declined history replacement',async()=>{const c=controls();await c.act(()=>c.button('Next round').props.onClick());c.setConfirmation(false);await c.act(()=>c.button('New session').props.onClick());assert.equal(c.state().frames.at(-1).round,1);assert.equal(c.confirmationCount(),1);c.setConfirmation(true);await c.act(()=>c.button('New session').props.onClick());assert.equal(c.state().frames.length,1);assert.equal(c.state().frames[0].round,0);});
test('different account storage keys start separately and invalid device saves recover safely',()=>{const store=new Map([['broken','{not json']]);const broken=controls(store,'broken');assert.match(broken.text(),/previous device save could not be restored/);const other=controls(store,'new-account');assert.equal(other.state().frames[0].round,0);assert.notEqual(store.get('new-account'),'{not json');});
test('device storage failure is visible and does not stop the simulation',async()=>{const store=new Map();store.set=()=>{throw Error('quota');};const c=controls(store);assert.match(c.text(),/Device save unavailable/);await c.act(()=>c.button('Next round').props.onClick());assert.match(c.text(),/Round 1 \/ 24/);assert.match(c.text(),/Device save unavailable/);});

test('walkthrough uses real actions while preserving the saved business run', async t => {
 const originalFetch=global.fetch,requests=[];
 global.fetch=async(url,options)=>{requests.push({url,body:JSON.parse(options.body)});return Response.json({seen:true,version:1});};t.after(()=>{global.fetch=originalFetch;});
 const store=new Map(),key='member-a:business-a';
 const existing=controls(store,key);await existing.act(()=>existing.button('Next round').props.onClick());
 const saved=store.get(key),c=controls(store,key,{tutorial:{businessId:'business-a',businessName:'Northstar',seen:false}});
 const tour=()=>c.find(n=>n.props?.onSkip&&n.props?.step).props,scene=()=>c.find(n=>n.type==='scene').props;
 assert.equal(tour().step,'welcome');await c.act(()=>tour().onAction());
 assert.equal(scene().world.round,0);assert.equal(store.get(key),saved);
 await c.act(()=>scene().onSelect('mira'));assert.equal(tour().step,'advance');
 await c.act(()=>scene().onStep());assert.equal(tour().step,'intervene');
 await c.act(()=>scene().onIntervene('equipment-fault'));assert.equal(scene().world.health,35);assert.equal(tour().step,'respond');
 await c.act(()=>scene().onStep());assert.equal(tour().step,'replay');assert.equal(scene().world.round,2);assert.ok(scene().world.health>35);
 assert.equal(store.get(key),saved);
 await c.act(()=>tour().onAction());assert.equal(tour().step,'finish');assert.ok(scene().world.round<2);
 // onAction starts the async persistence operation; flush its awaited response.
 await c.act(async()=>{tour().onAction();await new Promise(resolve=>setImmediate(resolve));});
 assert.equal(scene().world.round,1);assert.equal(store.get(key),saved);
 assert.deepEqual(requests,[{url:'/api/research-lab/tutorial',body:{businessId:'business-a',version:1,outcome:'completed'}}]);
 const cached=controls(store,key,{tutorial:{businessId:'business-a',businessName:'Northstar',seen:false}});
 assert.equal(cached.find(n=>n.props?.['data-environment']).props['data-tutorial'],undefined,'a stale back-navigation render must not reopen completed guidance');
});

test('a seen business does not auto-open the walkthrough; failures can exit without losing work', async t => {
 const originalFetch=global.fetch;global.fetch=async()=>Response.json({error:'Offline'},{status:503});t.after(()=>{global.fetch=originalFetch;});
 const seen=controls(new Map(),'seen-business',{tutorial:{businessId:'a',businessName:'Seen business',seen:true}});
 assert.equal(seen.find(n=>n.props?.['data-environment']).props['data-tutorial'],undefined);
 const c=controls(new Map(),'new-business',{tutorial:{businessId:'b',businessName:'New business',seen:false}});
 const tour=()=>c.find(n=>n.props?.onSkip&&n.props?.step).props;
 const saved=c.store.get(c.key);await c.act(()=>tour().onAction());
 await c.act(async()=>{tour().onSkip();await new Promise(resolve=>setImmediate(resolve));});
 assert.match(tour().error,/could not be saved/);assert.equal(c.store.get(c.key),saved);
 await c.act(()=>tour().onExit());assert.equal(c.store.get(c.key),saved);
 assert.equal(c.find(n=>n.props?.['data-environment']).props['data-tutorial'],undefined);
});
