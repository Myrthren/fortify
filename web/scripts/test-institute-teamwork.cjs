const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const cache=new Map();
function load(name){const file=path.resolve(__dirname,'../lib',name+'.ts');if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','module','exports',code)(n=>load(n.replace('./','')),m,m.exports);return m.exports;}
const d=load('research-institute'),team=load('institute-teamwork'),motion=load('institute-motion');
test('funding requests and allocations retain real senders, recipients and resource outcomes',()=>{
 const original=d.createInstitute(),before=JSON.stringify(original),world=d.stepInstitute(original),messages=team.currentExchanges(world);
 assert.equal(JSON.stringify(original),before);
 assert.ok(messages.some(x=>x.from==='mira'&&x.to==='nia'&&x.kind==='request'));
 const allocation=messages.find(x=>x.from==='nia'&&x.kind==='handoff');assert.ok(allocation);
 assert.equal(world.projects.find(p=>p.id===(allocation.to==='mira'?'calibration':'redundancy')).funds,8);
 assert.ok(messages.every(x=>world.events.find(e=>e.id===x.eventId).actor===x.from));
});
test('actions deferred by shared-resource contention do not manufacture successful handoffs',()=>{
 const world=d.createInstitute();world.treasury=8;
 const next=d.stepInstitute(world);
 assert.ok(next.events.find(e=>e.actor==='nia').text.includes('deferred'));
 assert.equal(team.currentExchanges(next).filter(x=>x.from==='nia').length,0);
 world.treasury=100;world.benchReady=true;world.compute=1;
 for(const project of world.projects){project.level=1;project.funds=8;}
 const constrained=d.stepInstitute(world),handoffs=team.currentExchanges(constrained).filter(x=>x.kind==='handoff'&&x.trialId);
 assert.equal(handoffs.length,1);assert.equal(constrained.projects.flatMap(p=>p.trials).length,1);
 assert.ok(!handoffs.some(x=>constrained.agents.find(a=>a.id===x.from).activity.includes('Waiting')));
});
test('measurement handoffs and reviews reference the actual owned experiment',()=>{
 let world=d.createInstitute();const frames=[world];while(world.status==='active'){world=d.stepInstitute(world);frames.push(world);}
 const all=team.teamExchanges(world),reviews=all.filter(x=>x.kind==='review');assert.ok(reviews.length);
 for(const review of reviews){const project=world.projects.find(p=>p.trials.some(t=>t.id===review.trialId)),trial=project.trials.find(t=>t.id===review.trialId);assert.equal(review.from,'ada');assert.equal(review.to,project.id==='calibration'?'mira':'ivo');assert.equal(trial.reviewed,true);assert.ok(all.some(x=>x.kind==='handoff'&&x.trialId===trial.id&&x.to==='ada'));}
 const early=frames[1],before=JSON.stringify(early);assert.ok(team.currentExchanges(early).every(x=>x.round===1));assert.equal(JSON.stringify(early),before);
});
test('engineering support follows a real intervention and resolved service action',()=>{
 const fault=d.intervene(d.createInstitute(),'equipment-fault');assert.equal(team.currentExchanges(fault).length,0);
 const next=d.stepInstitute(fault),messages=team.currentExchanges(next);
 assert.ok(messages.some(x=>x.from==='sol'&&x.to==='jun'&&x.kind==='request'));
 assert.ok(messages.some(x=>x.from==='jun'&&x.to==='sol'&&x.kind==='support'));
 assert.ok(next.health>fault.health);assert.ok(next.treasury<fault.treasury);
});
test('scene focus keeps a real review response ahead of a redundant request in the same round',()=>{
 let world=d.createInstitute();for(let i=0;i<4;i++)world=d.stepInstitute(world);
 const all=team.currentExchanges(world,'mira'),focused=team.focusExchanges(world,'mira');
 assert.ok(all.some(x=>x.kind==='request'&&x.trialId===1));assert.ok(all.some(x=>x.kind==='review'&&x.trialId===1));
 assert.equal(focused.filter(x=>x.trialId===1).length,1);assert.equal(focused.find(x=>x.trialId===1).kind,'review');
 assert.equal(focused.at(-1).kind,'review');
 assert.ok(focused.every(x=>all.some(original=>original.id===x.id)));
});
test('legacy recordings remain readable and invalid exchange metadata is rejected',()=>{
 const world=d.stepInstitute(d.createInstitute()),legacy=JSON.parse(JSON.stringify(world));legacy.events.forEach(e=>delete e.exchanges);
 assert.doesNotThrow(()=>d.readInstitute(legacy));assert.deepEqual(team.teamExchanges(legacy),[]);
 const eventIndex=world.events.findIndex(e=>e.exchanges?.length);
 for(const patch of [{from:'unknown'},{to:'unknown'},{to:world.events[eventIndex].actor},{kind:'invented'},{trialId:999},{subject:'x'.repeat(241)}]){const invalid=JSON.parse(JSON.stringify(world));Object.assign(invalid.events[eventIndex].exchanges[0],patch);assert.throws(()=>d.readInstitute(invalid),/exchange/);}
});
test('conversation gaze needs a recorded exchange and a nearby work area, not merely shared space',()=>{
 const initial=d.createInstitute();assert.equal(team.conversationPartner(initial,'mira'),null);
 const world=d.stepInstitute(initial);assert.equal(team.conversationPartner(world,'mira'),'nia');
 const remote=JSON.parse(JSON.stringify(world));remote.agents.find(a=>a.id==='nia').location='office';assert.equal(team.conversationPartner(remote,'mira'),null);
 world.status='ended';assert.equal(team.conversationPartner(world,'mira'),null);
});
test('limb solver stays finite and reaches valid targets for both bend directions',()=>{
 for(const bend of[-1,1])for(const[down,forward]of[[.35,.3],[.25,.43],[.7,.1],[0,0],[10,10]]){const pose=motion.limbAngles(down,forward,.41,.42,bend);assert.ok(Number.isFinite(pose.root)&&Number.isFinite(pose.joint));assert.ok(pose.joint*bend>=0);if(Math.hypot(down,forward)>.01&&Math.hypot(down,forward)<.826){const y=.41*Math.cos(pose.root)+.42*Math.cos(pose.root+pose.joint),z=-.41*Math.sin(pose.root)-.42*Math.sin(pose.root+pose.joint);assert.ok(Math.abs(y-down)<1e-9);assert.ok(Math.abs(z-forward)<1e-9);}}
});
test('gait plants feet during stance and reduced-motion work poses do not oscillate',()=>{
 assert.equal(motion.footCycle(0,0).lift,0);assert.ok(motion.footCycle(.1,0).forward<motion.footCycle(0,0).forward);
 let lifted=false;for(let distance=0;distance<3;distance+=.01){for(const side of[0,1]){const foot=motion.footCycle(distance,side);assert.ok(Number.isFinite(foot.forward));assert.ok(foot.lift>=0&&foot.lift<=.101);if(foot.planted)assert.equal(foot.lift,0);else lifted=true;}}assert.ok(lifted);
 for(const kind of['read','type','bench','repair','discuss'])for(const side of[0,1])assert.deepEqual(motion.handReach(kind,side,0,true),motion.handReach(kind,side,22,true));
});
