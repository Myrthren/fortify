const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const moduleUnderTest={exports:{}};
new Function('exports',ts.transpileModule(fs.readFileSync(path.join(__dirname,'../lib/institute-performance.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(moduleUnderTest.exports);
const {resolutionAfterWindow,graphicsPixelRatio}=moduleUnderTest.exports;
test('adaptive resolution backs off under sustained slow rendering and recovers gradually',()=>{
  assert.equal(resolutionAfterWindow(1,40),.9);
  assert.equal(resolutionAfterWindow(.8,16),.85);
  assert.equal(resolutionAfterWindow(.9,21),.9);
});
test('adaptive quality has readable lower and upper bounds',()=>{
  let slow=1,fast=1;
  for(let i=0;i<30;i++){slow=resolutionAfterWindow(slow,100);fast=resolutionAfterWindow(fast,16)}
  assert.equal(slow,.7);assert.equal(fast,1.25);
});
test('manual graphics modes ignore adaptive changes and cap retina buffers',()=>{
  assert.equal(graphicsPixelRatio(3,'high',.7),1.5);
  assert.equal(graphicsPixelRatio(3,'balanced',.7),1);
  assert.equal(graphicsPixelRatio(3,'auto',.8),.8);
  assert.equal(graphicsPixelRatio(1,'auto',1.25),1);
});
