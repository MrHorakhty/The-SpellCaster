// Shared CDP connection plumbing for the E2E suites.
//
// Historically every entrypoint (e2e-full.mjs, e2e-mobile.mjs, e2e-run.mjs,
// e2e-features.mjs) carried its own copy of this block. They had drifted: the
// mobile/Android copies grew a fatal socket-close guard after the Android
// WebView killed the whole app on a bad IPC message and node exited 0 silently,
// while the desktop copies never got it. Hoisting it here gives every suite the
// loud-failure guard and one place to fix connection bugs.

export function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Attach to the first http(s) page target on the debug port. Waits up to 60s
// for the app to come up (Android cold-boots are slow).
async function findPage(port, label) {
  for (let i = 0; i < 120; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json`);
      const targets = await res.json();
      const page = targets?.find(t => t.type === 'page' && (t.url || '').startsWith('http'));
      if (page) return page;
    } catch (e) {}
    await sleep(500);
  }
  console.error(`[${label}] NO APP PAGE on :${port}`);
  process.exit(1);
}

// Connect and return the low-level primitives plus the fatal-close guard.
//
//   cdp(method, params)         -> Promise<response>
//   cdpInput(method, params)    -> cdp, but re-focuses the window first (see note)
//   evalJs(expression)          -> value, or { __error } on a page exception
//   close()                     -> intentionally detach (suppresses the guard)
export async function connect({ port, label, fatalExit = 3 } = {}) {
  const page = await findPage(port, label);
  console.log(`[${label}] page: ${page.url}`);

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let seq = 0;
  const pending = new Map();
  ws.onmessage = ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  };

  // If the app dies (e.g. the Android WebView kills the whole app when its
  // renderer is terminated) the socket closes with requests still in flight:
  // every pending promise never settles, the event loop drains and node exits 0
  // SILENTLY, so the log looks truncated while the runner reports success. Fail
  // loudly instead.
  let closingIntentionally = false;
  ws.onclose = () => {
    if (closingIntentionally) return;
    console.error(`[${label}] FATAL: CDP socket closed with ${pending.size} unanswered request(s) - the app most likely died. Exit ${fatalExit}.`);
    process.exit(fatalExit);
  };
  ws.onerror = (e) => {
    if (closingIntentionally) return;
    console.error(`[${label}] FATAL: CDP socket error (${(e && e.message) || 'unknown'}). Exit ${fatalExit}.`);
    process.exit(fatalExit);
  };

  const cdp = (method, params = {}) => new Promise(resolve => {
    const id = ++seq;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });

  // Headed Edge silently drops injected input while its window is occluded: a
  // background or minimized window delivers no DOM events at all, and the
  // page's own document.hasFocus() still reads true, so the failure looks like
  // an app that ignores clicks. Re-focus the window before every injected event
  // so the input lands no matter what the user has in front of the browser.
  const cdpInput = (method, params = {}) =>
    cdp('Page.bringToFront').then(() => cdp(method, params));

  const evalJs = async (expression) => {
    const r = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) return { __error: r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text };
    return r.result?.result?.value;
  };

  await cdp('Runtime.enable');
  await cdp('Page.enable');
  await cdp('DOM.enable');

  const close = () => { closingIntentionally = true; ws.close(); };

  return { cdp, cdpInput, evalJs, close, page };
}
