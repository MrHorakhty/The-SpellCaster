// Platform driver: absorbs the desktop-vs-mobile divergence behind one surface.
//
// The suites' assertions are identical on both platforms; only *how* an action
// is delivered differs. Desktop Edge needs real CDP mouse events (synthetic
// `.click()` is not a trusted gesture for autoplay) routed through cdpInput so
// the window is re-focused first. The Android WebView wants
// Input.dispatchTouchEvent, and its edit-mode toggle lives on the grid header
// rather than the sidebar. Everything a shared spec needs is here.

export function makeDriver({ platform, cdp, cdpInput, evalJs, sleep }) {
  const isDesktop = platform === 'desktop';

  // A real trusted tap at viewport coordinates. On desktop this is a complete
  // mouse click; on mobile a touchStart/touchEnd pair. Synthetic element.click()
  // is NOT a user gesture, so autoplay is refused and play() rejects with the
  // per-sound-volume P9 check - use this when the app's playback must actually start.
  const trustedTap = async (x, y) => {
    if (isDesktop) {
      await cdpInput('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
      await cdpInput('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    } else {
      await cdp('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      await cdp('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }
  };

  // Scroll a card to the viewport centre and return fresh tap coordinates.
  // Coordinates go stale the moment the layout moves, so never cache them.
  const centeredCard = async (selector) => {
    await evalJs(`(() => { const c=document.querySelector('${selector}'); if(c) c.scrollIntoView({ block:'center' }); return 'OK'; })()`);
    await sleep(250);
    return evalJs(`(() => {
      const c = document.querySelector('${selector}');
      if (!c) return null;
      const r = c.getBoundingClientRect();
      return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) };
    })()`);
  };

  // Drag a card from one point to another. The app's reorder is POINTER-event
  // based (App.jsx onPointerDown -> document pointermove/pointerup), so the
  // same code path serves mouse and touch: a CDP touch drag synthesizes the
  // pointer events with pointerType 'touch'. Edit mode is required - outside it
  // the press arms the press-and-hold prime instead of starting a drag.
  const dragFromTo = async (from, to) => {
    if (isDesktop) {
      await cdpInput('Input.dispatchMouseEvent', { type: 'mousePressed', x: from.x, y: from.y, button: 'left', clickCount: 1 });
      await sleep(50);
      const steps = 5;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        await cdpInput('Input.dispatchMouseEvent', {
          type: 'mouseMoved',
          x: Math.round(from.x + (to.x - from.x) * t),
          y: Math.round(from.y + (to.y - from.y) * t),
          button: 'left'
        });
        await sleep(30);
      }
      await cdpInput('Input.dispatchMouseEvent', { type: 'mouseReleased', x: to.x, y: to.y, button: 'left', clickCount: 0 });
    } else {
      const pt = (x, y) => [{ x: Math.round(x), y: Math.round(y), id: 1, radiusX: 2, radiusY: 2, force: 1 }];
      await cdp('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(from.x, from.y) });
      await sleep(60);
      const steps = 5;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        await cdp('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: pt(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t)
        });
        await sleep(50);
      }
      await cdp('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }
  };

  // Edit mode: desktop toggles via the sidebar "Toggle Edit Mode" button (which
  // carries a lime class when active); mobile via the grid-header
  // Enter/Exit Edit Mode button. Both are no-ops when already in the target state.
  const enterEditMode = async () => {
    if (isDesktop) {
      const active = await evalJs(`!!document.querySelector('button[title="Toggle Edit Mode"]')?.className?.match(/lime|lime-600|bg-lime/)`);
      if (!active) {
        await evalJs(`document.querySelector('button[title="Toggle Edit Mode"]')?.click()`);
        await sleep(400);
      }
    } else {
      const active = await evalJs(`!!document.querySelector('button[title="Exit Edit Mode"]')`);
      if (!active) {
        await evalJs(`document.querySelector('button[title="Enter Edit Mode"]')?.click()`);
        await sleep(400);
      }
    }
  };

  const exitEditMode = async () => {
    if (isDesktop) {
      const active = await evalJs(`!!document.querySelector('button[title="Toggle Edit Mode"]')?.className?.match(/lime|lime-600|bg-lime/)`);
      if (active) {
        await evalJs(`document.querySelector('button[title="Toggle Edit Mode"]')?.click()`);
        await sleep(400);
      }
    } else {
      const active = await evalJs(`!!document.querySelector('button[title="Exit Edit Mode"]')`);
      if (active) {
        await evalJs(`document.querySelector('button[title="Exit Edit Mode"]')?.click()`);
        await sleep(400);
      }
    }
  };

  return { platform, isDesktop, trustedTap, centeredCard, dragFromTo, enterEditMode, exitEditMode };
}