// e2e-snapshot.mjs - crash-safe localStorage snapshot/restore for the E2E harness.
//
// The suites already snapshot localStorage at start and restore it at the end
// (SAVE_RESTORE=1), but that restore only runs if the suite survives: when a run
// crashes the app or is killed, the E2E seed data is left behind in the app. This
// script is called by the runner instead, so the snapshot is taken before the suite
// starts and restored from the runner's finally block regardless of how node exits.
//
// Usage (CDP_PORT / LABEL env, same as the other suites):
//   node e2e-snapshot.mjs save    <file>
//   node e2e-snapshot.mjs restore <file>
//
// Exit codes: 0 ok, 3 app/CDP unreachable, 4 bad usage or unusable snapshot.
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';

const DEBUG_PORT = process.env.CDP_PORT || 9225;
const LABEL = process.env.LABEL || 'SNAP';
const [mode, file] = process.argv.slice(2);

if (!['save', 'restore'].includes(mode) || !file) {
  console.error(`[${LABEL}] usage: node e2e-snapshot.mjs save|restore <file>`);
  process.exit(4);
}

const log = (...a) => console.log(`[${LABEL}]`, ...a);

async function connect() {
  const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
  const targets = await res.json();
  const page = targets.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
  if (!page) throw new Error(`no page target on :${DEBUG_PORT}`);
  return page.webSocketDebuggerUrl;
}

const wsUrl = await connect().catch(err => {
  console.error(`[${LABEL}] FAILED: app not reachable on :${DEBUG_PORT} (${err.message}). ` +
    `If the suite crashed the app, the snapshot was NOT restored - rerun this script once the app is up.`);
  process.exit(3);
});

const ws = new WebSocket(wsUrl);
let seq = 0;
const pending = new Map();
let closed = false;

ws.addEventListener('message', e => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
});
ws.addEventListener('close', () => { closed = true; });

const cdp = (method, params = {}) => new Promise((resolve, reject) => {
  if (closed) return reject(new Error('socket closed'));
  const id = ++seq;
  pending.set(id, resolve);
  ws.send(JSON.stringify({ id, method, params }));
  setTimeout(() => { if (pending.delete(id)) reject(new Error(`${method} timed out`)); }, 20000);
});

await new Promise(r => ws.addEventListener('open', r));

const evalJs = async expression => {
  const r = await cdp('Runtime.evaluate', { expression, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.text || 'evaluate failed');
  return r.result?.result?.value;
};

if (mode === 'save') {
  const dump = await evalJs(
    `JSON.stringify(Object.fromEntries(Array.from({length:localStorage.length},(_,i)=>localStorage.key(i)).map(k=>[k,localStorage.getItem(k)])))`
  );
  if (!dump || dump === '{}') {
    console.error(`[${LABEL}] FAILED: app storage is empty - refusing to write an empty snapshot.`);
    process.exit(4);
  }
  writeFileSync(file, dump);
  const keys = Object.keys(JSON.parse(dump)).length;
  log(`saved ${keys} localStorage keys (${statSync(file).size} bytes) -> ${file}`);
  ws.close();
  process.exit(0);
}

// restore - never clear storage unless we actually have data to put back
if (!existsSync(file)) {
  console.error(`[${LABEL}] FAILED: snapshot ${file} does not exist - storage left untouched.`);
  process.exit(4);
}
const raw = readFileSync(file, 'utf8');
let data;
try { data = JSON.parse(raw); } catch { data = null; }
if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).length === 0) {
  console.error(`[${LABEL}] FAILED: snapshot ${file} is empty or corrupt - storage left untouched.`);
  process.exit(4);
}

const applied = await evalJs(`(() => {
  const o = ${JSON.stringify(data)};
  localStorage.clear();
  for (const k of Object.keys(o)) localStorage.setItem(k, o[k]);
  return Object.keys(o).length;
})()`);
log(`restored ${applied} localStorage keys from ${file}`);
await cdp('Page.reload', { ignoreCache: true }).catch(() => {});
await new Promise(r => setTimeout(r, 3000));
log('page reloaded so the app re-reads storage');
ws.close();
process.exit(0);
