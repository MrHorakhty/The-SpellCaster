// Shared platform-gate spec (Suite W, W1-W6).
//
// Ported from e2e-run.mjs Suite P (PLATFORM). Its purpose is the isMobile GATE:
// every mobile-specific change in this app is wrapped in `isMobile`, so a
// regression there means mobile chrome appearing on desktop, or desktop chrome
// on mobile. The old suite asserted this one-sidedly (desktop-only), which meant
// it could never be run on Android. This one asserts the correct expectation for
// whichever entrypoint is driving it, so it runs on all three platforms.
//
// How "which platform" is known: isMobile in App.jsx is NOT viewport-based. It
// is `isTauri && (platform() === 'android' || 'ios')`, so a narrow desktop
// window is still desktop. The suite therefore keys off which entrypoint invoked
// it (driver.platform), not off window.innerWidth — which is exactly the kind of
// conflation W3 exists to catch.

export const platformGate = {
  title: 'SUITE W: PLATFORM GATE',
  async run(ctx) {
    const { log, evalJs, driver } = ctx;
    const expectMobile = driver.platform === 'mobile';

    const w = await evalJs(`(() => {
      const rail    = document.querySelector('div.shrink-0.bg-dark-800.rounded-xl.w-14');
      const sidebar = [...document.querySelectorAll('div.shrink-0.bg-dark-800.rounded-xl')]
                        .find(d => d.className.includes('lg:w-64') || d.className.includes('md:w-64'));
      return {
        href: location.href,
        isTauri: typeof window.__TAURI_INTERNALS__ !== 'undefined',
        rail: !!rail,
        sidebar: !!sidebar,
        hamburger: !!document.querySelector('button[title="Open navigation"]'),
        drawer: !!document.querySelector('[role="dialog"][aria-label="Navigation"]'),
        vw: window.innerWidth,
        vh: window.innerHeight,
        cards: document.querySelectorAll('[data-sound-card]').length
      };
    })()`);

    log('PLATFORM','W1: app page loaded',(w?.href||'').startsWith('http')?'PASS':'FAIL',w?.href);

    // EXPECT_TAURI is 1 on both the Windows phase and Android — it says "this is
    // a Tauri webview", not "this is a phone". Asserting it here is what stops
    // the two Tauri phases from being silently confused for one another.
    log('PLATFORM','W2: Tauri webview matches the phase that launched it',w?.isTauri === !!ctx.isTauri?'PASS':'FAIL',`got=${w?.isTauri} expected=${!!ctx.isTauri}`);

    log('PLATFORM','W3: the isMobile gate selects the right navigation chrome',
      (expectMobile ? (w?.rail===true && w?.sidebar===false) : (w?.rail===false && w?.sidebar===true)) ? 'PASS':'FAIL',
      `expectMobile=${expectMobile} rail=${w?.rail} sidebar=${w?.sidebar}`);

    log('PLATFORM','W4: the drawer opener exists only on mobile',
      w?.hamburger === expectMobile?'PASS':'FAIL',`hamburger=${w?.hamburger} expected=${expectMobile}`);

    // The drawer is created on open, so its absence means "not opened", which is
    // true on both platforms until something asks for it.
    log('PLATFORM','W5: no navigation drawer is open at rest',w?.drawer===false?'PASS':'FAIL',String(w?.drawer));

    log('PLATFORM','W6: viewport matches the platform',
      (expectMobile ? w?.vw <= 480 : w?.vw >= 1024) ? 'PASS':'FAIL',
      `${w?.vw}x${w?.vh} (expectMobile=${expectMobile})`);
  }
};
