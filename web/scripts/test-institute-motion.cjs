const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../lib/institute-motion.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,m={exports:{}};new Function('exports',code)(m.exports);const{workPose}=m.exports;
const world={round:2,status:'active'},agent=(id,location,activity)=>({id,location,activity});
test('only agents at an authored seated station sit; visitors discuss the evidence',()=>{
 assert.equal(workPose(agent('ada','analysis','Review experiment 1'),false,world).seated,true);
 assert.equal(workPose(agent('mira','analysis','Ask Ada to review the latest measurement'),false,world).seated,false);
 assert.equal(workPose(agent('mira','analysis','Ask Ada to review the latest measurement'),false,world).kind,'discuss');
 assert.equal(workPose(agent('ivo','compute','Run a controlled experiment'),false,world).kind,'type');
});
test('waiting, finished and moving agents never perform a stationary work action',()=>{
 const a=agent('mira','compute','Waiting for a test slot');assert.equal(workPose(a,false,world).kind,'wait');
 assert.equal(workPose(agent('sol','workbench','Prepare the shared test bench'),false,{...world,status:'ended'}).kind,'wait');
 assert.deepEqual(workPose(agent('ada','analysis','Review experiment 1'),true,world),{kind:'walk',seated:false,label:'Walking to station'});
});
test('equipment failure alone does not manufacture a repair; the recorded decision drives the pose',()=>{
 assert.equal(workPose(agent('jun','maintenance','Inspect equipment and report its condition'),false,world).kind,'read');
 assert.equal(workPose(agent('jun','maintenance','Service and recalibrate the instrument'),false,world).kind,'repair');
 assert.equal(workPose(agent('sol','workbench','Recalibrate sensors'),false,world).kind,'bench');
 assert.equal(workPose(agent('mira','office','Reading the research brief'),false,{...world,round:0}).kind,'read');
});
