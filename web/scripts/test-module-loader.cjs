const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
function load(path, mocks = {}, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, require: name => name in mocks ? mocks[name] : require(name),
    console: { error() {}, log() {} }, process: { env: {} }, URL, Date, Response, Request, Headers, Buffer, AbortSignal,
    setTimeout, clearTimeout, setImmediate, structuredClone, ...globals }, { filename: path });
  return exports;
}
module.exports = { load };
