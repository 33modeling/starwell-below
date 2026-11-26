// 입력: 키보드·터치 단추·게임패드를 한 상태로 모은다. 매 걸음 poll() 로 '이번에 누름'을 계산한다.
const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  KeyZ: 'jump', Space: 'jump', KeyK: 'jump', KeyX: 'shoot', KeyJ: 'shoot', KeyC: 'dash', KeyL: 'dash', ShiftLeft: 'dash', ShiftRight: 'dash',
  KeyM: 'map', Tab: 'map', Escape: 'pause', KeyP: 'pause', Enter: 'confirm',
};
const NAMES = ['left', 'right', 'up', 'down', 'jump', 'shoot', 'dash', 'map', 'pause', 'confirm'];

export function createInput(target = window) {
  const keys = {}, touch = {}, prev = {};
  const cur = {};
  const onKey = (down) => (e) => {
    const n = KEYMAP[e.code];
    if (!n) return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    keys[n] = down;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Tab'].includes(e.code)) e.preventDefault();
  };
  target.addEventListener('keydown', onKey(true));
  target.addEventListener('keyup', onKey(false));
  target.addEventListener('blur', () => { for (const k of NAMES) { keys[k] = false; touch[k] = false; } });

  // 터치 단추: data-key 를 가진 요소. 손가락이 단추 위로 미끄러져도 따라간다.
  function bindTouch(root) {
    const active = new Map(); // pointerId → key
    const keyAt = (x, y) => { const el = document.elementFromPoint(x, y); const b = el && el.closest && el.closest('[data-key]'); return b && root.contains(b) ? b.dataset.key : null; };
    const refresh = () => {
      for (const k of NAMES) touch[k] = false;
      for (const k of active.values()) if (k) touch[k] = true;
      for (const b of root.querySelectorAll('[data-key]')) b.classList.toggle('on', !!touch[b.dataset.key]);
    };
    root.addEventListener('pointerdown', (e) => { const k = keyAt(e.clientX, e.clientY); if (!k) return; e.preventDefault(); active.set(e.pointerId, k); try { root.setPointerCapture(e.pointerId); } catch {} refresh(); });
    root.addEventListener('pointermove', (e) => { if (!active.has(e.pointerId)) return; const k = keyAt(e.clientX, e.clientY); const old = active.get(e.pointerId); if (k && k !== old && ['left', 'right', 'up', 'down'].includes(k) && ['left', 'right', 'up', 'down'].includes(old)) { active.set(e.pointerId, k); refresh(); } });
    const end = (e) => { if (active.delete(e.pointerId)) refresh(); };
    root.addEventListener('pointerup', end); root.addEventListener('pointercancel', end); root.addEventListener('lostpointercapture', end);
    root.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  function pad() {
    const out = {};
    const gps = (navigator.getGamepads && navigator.getGamepads()) || [];
    for (const gp of gps) {
      if (!gp || !gp.connected) continue;
      const b = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      out.left = out.left || b(14) || ax < -0.4; out.right = out.right || b(15) || ax > 0.4;
      out.up = out.up || b(12) || ay < -0.5; out.down = out.down || b(13) || ay > 0.5;
      out.jump = out.jump || b(0); out.shoot = out.shoot || b(2); out.dash = out.dash || b(1) || b(5) || b(7);
      out.map = out.map || b(3) || b(8); out.pause = out.pause || b(9); out.confirm = out.confirm || b(0);
    }
    return out;
  }

  function poll() {
    const g = pad();
    for (const k of NAMES) {
      const v = !!(keys[k] || touch[k] || g[k]);
      cur[k + 'P'] = v && !prev[k];
      cur[k] = v;
      prev[k] = v;
    }
    return cur;
  }
  // 시험용: 키를 직접 넣는다
  function force(name, v) { keys[name] = v; }
  return { poll, bindTouch, force, state: cur };
}

// 물리 입력으로 바꾸기
export function physInput(i) {
  return { left: i.left, right: i.right, up: i.up, down: i.down, jump: i.jump, jumpP: i.jumpP, dashP: i.dashP, downP: i.downP };
}
