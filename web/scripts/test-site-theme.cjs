const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const root = path.resolve(__dirname, '..');
let ts;
try { ts = require('typescript'); } catch {
  ts = Module.createRequire(path.resolve(root, '../../fortify-brand-cleanup/web/package.json'))('typescript');
}

function fixture() {
  const state = { session: { user: { id: 'owner' } }, owner: true, setting: null, writes: 0, reads: 0, readFails: false, writeFails: false };
  const db = {
    user: { findUnique: async () => ({ id: 'owner', discordId: state.owner ? 'allowed' : 'member' }) },
    siteAppearance: {
      findUnique: async () => { state.reads++; if (state.readFails) throw Error('offline'); return state.setting; },
      upsert: async ({ where, create, update }) => {
        assert.equal(where.id, 'global');
        if (state.writeFails) throw Error('offline');
        state.writes++;
        state.setting = state.setting ? { ...state.setting, ...update } : { ...create };
        return state.setting;
      },
    },
  };
  const cache = new Map();
  const dataCache = new Map();
  function load(relative) {
    const file = path.resolve(root, relative);
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const result = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, reportDiagnostics: true,
    });
    assert.equal((result.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0, file);
    const localRequire = name => {
      if (name === 'next/cache') return {
        unstable_cache: (fn, keys, options) => {
          assert.equal(options.revalidate, 30);
          return async () => {
            const key = keys.join(':');
            if (!dataCache.has(key)) dataCache.set(key, Promise.resolve().then(fn).catch(error => { dataCache.delete(key); throw error; }));
            return dataCache.get(key);
          };
        },
        revalidateTag: tag => dataCache.delete(tag),
      };
      if (name === 'next/server') return { NextResponse: { json: (body, init) => Response.json(body, init) } };
      if (name === '@/auth') return { auth: async () => state.session };
      if (name === '@/lib/db') return { db };
      if (name === '@/lib/owner') return { isOwner: id => id === 'allowed' };
      let resolved = name.startsWith('@/') ? name.slice(2) : path.relative(root, path.resolve(path.dirname(file), name));
      return load(resolved + '.ts');
    };
    new Function('require', 'module', 'exports', result.outputText)(localRequire, module, module.exports);
    return module.exports;
  }
  return { state, patch: load('app/api/admin/site-theme/route.ts').PATCH, patchWorkspaceLayout: load('app/api/admin/workspace-layout/route.ts').PATCH, get: load('app/api/site-theme/route.ts').GET, storage: load('lib/site-appearance.ts') };
}

function request(body, origin = 'https://fortify-io.com') {
  return new Request('https://fortify-io.com/api/admin/site-theme', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', origin },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function workspaceLayoutRequest(body, origin = 'https://fortify-io.com') {
  return new Request('https://fortify-io.com/api/admin/workspace-layout', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', origin },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

test('new installation defaults to the approved theme and classic workspace without writing', async () => {
  const f = fixture();
  const res = await f.get();
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { theme: 'scifi', workspaceLayout: 'classic' });
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.equal(f.state.writes, 0);
});

test('only authenticated owners can change the universal theme', async () => {
  const f = fixture();
  f.state.session = null;
  assert.equal((await f.patch(request({ theme: 'original' }))).status, 401);
  f.state.session = { user: { id: 'member' } }; f.state.owner = false;
  assert.equal((await f.patch(request({ theme: 'original' }))).status, 403);
  assert.equal(f.state.writes, 0);
});

test('only authenticated owners can change the universal workspace layout', async () => {
  const f = fixture();
  f.state.session = null;
  assert.equal((await f.patchWorkspaceLayout(workspaceLayoutRequest({ workspaceLayout: 'command-centre' }))).status, 401);
  f.state.session = { user: { id: 'member' } }; f.state.owner = false;
  assert.equal((await f.patchWorkspaceLayout(workspaceLayoutRequest({ workspaceLayout: 'command-centre' }))).status, 403);
  assert.equal(f.state.writes, 0);
});

test('foreign and missing origins cannot change appearance', async () => {
  const f = fixture();
  for (const origin of ['https://elsewhere.example', '', 'null']) {
    assert.equal((await f.patch(request({ theme: 'original' }, origin))).status, 403);
  }
  for (const origin of ['https://elsewhere.example', '', 'null']) {
    assert.equal((await f.patchWorkspaceLayout(workspaceLayoutRequest({ workspaceLayout: 'command-centre' }, origin))).status, 403);
  }
  assert.equal(f.state.writes, 0);
});

test('invalid themes, empty values and malformed JSON never reach storage', async () => {
  const f = fixture();
  for (const body of [{ theme: 'cyan' }, { theme: '' }, { theme: 1 }, {}, null, '{bad-json']) {
    assert.equal((await f.patch(request(body))).status, 400);
  }
  assert.equal(f.state.writes, 0);
});

test('invalid workspace layouts and malformed JSON never reach storage', async () => {
  const f = fixture();
  for (const body of [{ workspaceLayout: 'hybrid' }, { workspaceLayout: '' }, { workspaceLayout: 1 }, {}, null, '{bad-json']) {
    assert.equal((await f.patchWorkspaceLayout(workspaceLayoutRequest(body))).status, 400);
  }
  assert.equal(f.state.writes, 0);
});

test('owner can switch both ways and anonymous readers get the same persisted setting', async () => {
  const f = fixture();
  for (const theme of ['original', 'scifi']) {
    const saved = await f.patch(request({ theme }));
    assert.equal(saved.status, 200);
    assert.deepEqual(await saved.json(), { theme });
    f.state.session = null;
    assert.deepEqual(await (await f.get()).json(), { theme, workspaceLayout: 'classic' });
    f.state.session = { user: { id: 'owner' } };
    assert.equal(f.state.setting.updatedBy, 'owner');
  }
  assert.equal(f.state.writes, 2);
});

test('owner can switch workspace layouts and anonymous readers receive the persisted choice', async () => {
  const f = fixture();
  for (const workspaceLayout of ['command-centre', 'classic']) {
    const saved = await f.patchWorkspaceLayout(workspaceLayoutRequest({ workspaceLayout }));
    assert.equal(saved.status, 200);
    assert.deepEqual(await saved.json(), { workspaceLayout });
    f.state.session = null;
    assert.deepEqual(await (await f.get()).json(), { theme: 'scifi', workspaceLayout });
    f.state.session = { user: { id: 'owner' } };
    assert.equal(f.state.setting.updatedBy, 'owner');
  }
  assert.equal(f.state.writes, 2);
});

test('failed saves are reported without changing the stored theme', async () => {
  const f = fixture();
  f.state.setting = { id: 'global', theme: 'original' }; f.state.writeFails = true;
  assert.equal((await f.patch(request({ theme: 'scifi' }))).status, 503);
  assert.equal(f.state.setting.theme, 'original');
  assert.equal(f.state.writes, 0);
});

test('read outages are not broadcast as a theme reset', async () => {
  const f = fixture(); f.state.readFails = true;
  const res = await f.get();
  assert.equal(res.status, 503);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.equal((await res.json()).theme, undefined);
});

test('repeated theme reads share one database read and owner edits invalidate it immediately', async () => {
  const f = fixture();
  await Promise.all([f.get(), f.get(), f.get()]);
  assert.equal(f.state.reads, 1);
  await f.patch(request({ theme: 'original' }));
  assert.deepEqual(await (await f.get()).json(), { theme: 'original', workspaceLayout: 'classic' });
  assert.equal(f.state.reads, 2);
  f.state.writeFails = true;
  assert.equal((await f.patch(request({ theme: 'scifi' }))).status, 503);
  assert.deepEqual(await (await f.get()).json(), { theme: 'original', workspaceLayout: 'classic' });
  assert.equal(f.state.reads, 2);
});

test('storage rejects invalid values even outside the HTTP handler', async () => {
  const f = fixture();
  await assert.rejects(() => f.storage.saveSiteTheme('unknown', 'owner'), /Invalid/);
  assert.equal(f.state.writes, 0);
  await assert.rejects(() => f.storage.saveWorkspaceLayout('unknown', 'owner'), /Invalid/);
  assert.equal(f.state.writes, 0);
});

function syncFixture(fetcher) {
  const document = Object.assign(new EventTarget(), {
    visibilityState: 'visible', documentElement: { dataset: { theme: 'scifi', workspaceLayout: 'classic' } },
  });
  let tick, cleanup, cleared = false;
  const window = Object.assign(new EventTarget(), {
    setInterval: (fn, ms) => { assert.equal(ms, 30000); tick = fn; return 1; },
    clearInterval: () => { cleared = true; },
  });
  const result = ts.transpileModule(fs.readFileSync(path.join(root, 'components/site-theme-sync.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const module = { exports: {} };
  const requireMock = name => {
    if (name === 'react') return { useEffect: fn => { cleanup = fn(); } };
    if (name === 'next/navigation') return { usePathname: () => '/dashboard' };
    if (name === '@/lib/site-theme') return { isSiteTheme: value => value === 'original' || value === 'scifi' };
    if (name === '@/lib/workspace-layout') return { isWorkspaceLayout: value => value === 'classic' || value === 'command-centre' };
    throw Error(name);
  };
  new Function('require','module','exports','document','window','fetch',result.outputText)(requireMock,module,module.exports,document,window,fetcher);
  module.exports.SiteThemeSync();
  return { document, window, tick: () => tick(), cleanup: () => cleanup(), isCleared: () => cleared };
}

test('open pages adopt global appearance choices and retain them through outages', async () => {
  let response = { theme: 'original', workspaceLayout: 'command-centre' }, status = 200;
  const f = syncFixture(async (_, options) => {
    assert.equal(options.cache, 'no-store');
    return Response.json(response, { status });
  });
  await new Promise(setImmediate);
  assert.equal(f.document.documentElement.dataset.theme, 'original');
  assert.equal(f.document.documentElement.dataset.workspaceLayout, 'command-centre');
  status = 503; response = { error: 'offline' };
  await f.tick();
  assert.equal(f.document.documentElement.dataset.theme, 'original');
  status = 200; response = { theme: 'scifi', workspaceLayout: 'classic' };
  await f.tick();
  assert.equal(f.document.documentElement.dataset.theme, 'scifi');
  assert.equal(f.document.documentElement.dataset.workspaceLayout, 'classic');
  f.cleanup(); assert.equal(f.isCleared(), true);
});

test('an older in-flight poll cannot undo a freshly saved selection', async () => {
  let resolve;
  const f = syncFixture(() => new Promise(done => { resolve = done; }));
  f.window.dispatchEvent(new CustomEvent('fortify-theme-saved', { detail: 'scifi' }));
  f.window.dispatchEvent(new CustomEvent('fortify-workspace-layout-saved', { detail: 'command-centre' }));
  resolve(Response.json({ theme: 'original', workspaceLayout: 'classic' }));
  await new Promise(setImmediate);
  assert.equal(f.document.documentElement.dataset.theme, 'scifi');
  assert.equal(f.document.documentElement.dataset.workspaceLayout, 'command-centre');
  f.cleanup();
});
