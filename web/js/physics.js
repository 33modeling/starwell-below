// 별우물 아래 — 물리·충돌(순수 함수, DOM 없음). 게임과 도달 검사기가 똑같이 쓴다.
// 한 칸 16px, 방 하나 30×17칸(480×272). 1/60초 고정 걸음.
export const T = 16;
export const COLS = 30;
export const ROWS = 17;
export const W = COLS * T;
export const H = ROWS * T;
export const DT = 1 / 60;

export const TILE = {
  EMPTY: 0, ROCK: 1, SMOOTH: 2, PLAT: 3, SPIKE: 4, WATER: 5,
  CRACK: 6, FLOORCRACK: 7, ICE: 8, BOSSDOOR: 9, FAKE: 10, KEYDOOR: 11,
};
const SOLID = new Uint8Array(16);
for (const t of [1, 2, 6, 7, 8, 9, 11]) SOLID[t] = 1;
const CLIMB = new Uint8Array(16);
for (const t of [1, 6]) CLIMB[t] = 1;
export const isSolid = (t) => SOLID[t] === 1;
export const isClimbable = (t) => CLIMB[t] === 1;

export const P = {
  w: 10, h: 22,
  grav: 1400, jumpV: 440, djumpV: 400, run: 120, accG: 1500, accA: 950, maxFall: 420,
  coyote: 0.08, buffer: 0.12, cutV: 200,
  dashV: 330, dashT: 0.18,
  climbV: 80, mantleV: 270, wallJumpVX: 150, wallJumpVY: 400,
  swimV: 95, swimG: 260, swimMaxFall: 70, swimOutV: 380,
  poundV: 560, chokeT: 0.5,
};

// 방 타일 읽기: 밖은 가장 가까운 가장자리 칸을 돌려준다(문이 뚫린 곳은 비어 있으니 밖으로 나갈 수 있다).
export function tileAt(room, c, r) {
  if (c < 0) c = 0; else if (c >= COLS) c = COLS - 1;
  if (r < 0) r = 0; else if (r >= ROWS) r = ROWS - 1;
  return room.tiles[r * COLS + c];
}
export function setTile(room, c, r, t) {
  if (c >= 0 && c < COLS && r >= 0 && r < ROWS) room.tiles[r * COLS + c] = t;
}

export function makePlayer(x, y) {
  return {
    x, y, w: P.w, h: P.h, vx: 0, vy: 0, facing: 1,
    onGround: false, coyote: 0, buf: 0, jumpHeld: false, doubleUsed: false,
    dashT: 0, dashUsed: false, cling: 0, wasCling: 0, inWater: false, choke: 0,
    pounding: false, dropT: 0,
  };
}

// 몸이 사각형 [x0,x1)×[y0,y1) 에서 단단한 칸과 겹치는지
function solidIn(room, x0, y0, x1, y1) {
  const c0 = Math.floor(x0 / T), c1 = Math.floor((x1 - 0.001) / T);
  const r0 = Math.floor(y0 / T), r1 = Math.floor((y1 - 0.001) / T);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (SOLID[tileAt(room, c, r)]) return true;
  return false;
}
export function overlapsTile(room, p, kind) {
  const c0 = Math.floor((p.x + 1) / T), c1 = Math.floor((p.x + p.w - 1.001) / T);
  const r0 = Math.floor((p.y + 2) / T), r1 = Math.floor((p.y + p.h - 1.001) / T);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (tileAt(room, c, r) === kind) return true;
  return false;
}
// 붙은 같은 종류 칸을 모두 지운다(금 간 바닥·바위벽 부수기)
export function breakFlood(room, c, r, kind, events) {
  const st = [[c, r]];
  while (st.length) {
    const [a, b] = st.pop();
    if (a < 0 || a >= COLS || b < 0 || b >= ROWS || tileAt(room, a, b) !== kind) continue;
    setTile(room, a, b, TILE.EMPTY);
    if (events) events.push({ type: 'break', c: a, r: b, kind });
    st.push([a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]);
  }
}

function wallSide(room, p, side) {
  // side: -1 왼쪽, 1 오른쪽. 몸 높이 가운데 부분 옆 칸에 오를 수 있는 벽이 있는지
  const x = side < 0 ? p.x - 1 : p.x + p.w + 0.5;
  const c = Math.floor(x / T);
  const r0 = Math.floor((p.y + 4) / T), r1 = Math.floor((p.y + p.h - 4) / T);
  for (let r = r0; r <= r1; r++) if (CLIMB[tileAt(room, c, r)]) return true;
  return false;
}
function supportBelow(room, p) {
  const y = p.y + p.h + 0.5;
  const r = Math.floor(y / T);
  const c0 = Math.floor((p.x + 0.5) / T), c1 = Math.floor((p.x + p.w - 0.5) / T);
  for (let c = c0; c <= c1; c++) {
    const t = tileAt(room, c, r);
    if (SOLID[t]) return true;
    if (t === TILE.PLAT && p.dropT <= 0 && Math.abs(r * T - (p.y + p.h)) < 0.6) return true;
  }
  return false;
}

// 발밑이 한쪽 발판뿐인가(단단한 바닥이 섞이면 아님)
function onPlatOnly(room, p) {
  const r = Math.floor((p.y + p.h + 0.5) / T);
  const c0 = Math.floor((p.x + 0.5) / T), c1 = Math.floor((p.x + p.w - 0.5) / T);
  let plat = false;
  for (let c = c0; c <= c1; c++) { const t = tileAt(room, c, r); if (SOLID[t]) return false; if (t === TILE.PLAT) plat = true; }
  return plat;
}

// inp: {left,right,up,down,jump(누르고 있음),jumpP(이번에 누름),dashP,downP}
// ab: {climb,dash,double,swim,pound,fire} 참·거짓. events: 배열(선택)
export function step(room, p, inp, ab, dt = DT, events = null) {
  const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
  if (dir) p.facing = dir;
  const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
  p.inWater = tileAt(room, Math.floor(cx / T), Math.floor(cy / T)) === TILE.WATER;
  if (inp.jumpP) p.buf = P.buffer; else if (p.buf > 0) p.buf -= dt;
  if (p.coyote > 0) p.coyote -= dt;
  if (p.dropT > 0) p.dropT -= dt;
  p.wasCling = p.cling;
  p.cling = 0;

  if (p.dashT > 0) {
    p.dashT -= dt;
    p.vx = p.facing * P.dashV;
    p.vy = 0;
    if (p.dashT <= 0) p.vx = p.facing * P.run;
  } else if (p.inWater && ab.swim) {
    p.choke = 0;
    p.pounding = false;
    const tx = dir * P.swimV;
    p.vx += Math.sign(tx - p.vx) * Math.min(Math.abs(tx - p.vx), 900 * dt);
    const headWater = tileAt(room, Math.floor(cx / T), Math.floor((p.y - 2) / T)) === TILE.WATER;
    if (inp.jumpP && !headWater) { p.vy = -P.swimOutV; }
    else if (inp.up || inp.jump) p.vy = -P.swimV;
    else if (inp.down) p.vy = P.swimV;
    else { p.vy += P.swimG * dt; if (p.vy > P.swimMaxFall) p.vy = P.swimMaxFall; if (p.vy < -P.swimV) p.vy = -P.swimV; }
    p.doubleUsed = false; p.dashUsed = false;
  } else if (p.inWater) {
    p.choke += dt;
    p.vx *= 0.85;
    p.vy = Math.min(p.vy + P.grav * 0.4 * dt, 120);
    if (p.choke >= P.chokeT && events) events.push({ type: 'choke' });
  } else {
    p.choke = 0;
    const tx = dir * P.run;
    const acc = p.onGround ? P.accG : P.accA;
    if (!p.pounding) p.vx += Math.sign(tx - p.vx) * Math.min(Math.abs(tx - p.vx), acc * dt);
    // 벽 타기
    if (ab.climb && !p.onGround && !p.pounding && dir !== 0 && wallSide(room, p, dir)) {
      p.cling = dir;
      p.doubleUsed = false; p.dashUsed = false;
      if (inp.jumpP) {
        p.vy = -P.wallJumpVY; p.vx = -dir * P.wallJumpVX; p.cling = 0; p.buf = 0;
      } else if (inp.up) p.vy = -P.climbV;
      else if (inp.down) p.vy = P.climbV * 1.6;
      else p.vy = 0;
    } else if (p.wasCling && inp.up && p.vy < 0 && dir !== 0) {
      p.vy = -P.mantleV; // 벽 꼭대기 넘어가기
    }
    if (!p.cling) {
      if (inp.down && inp.jumpP && p.onGround && onPlatOnly(room, p)) {
        p.dropT = 0.22; p.buf = 0; p.onGround = false; // 발판 아래로 내려가기 — 점프 대신
      }
      if (p.buf > 0 && (p.onGround || p.coyote > 0)) {
        p.vy = -P.jumpV; p.onGround = false; p.coyote = 0; p.buf = 0;
      } else if (inp.jumpP && !p.onGround && ab.double && !p.doubleUsed) {
        p.vy = -P.djumpV; p.doubleUsed = true; p.buf = 0; p.pounding = false;
      }
      if (!inp.jump && p.vy < -P.cutV && !p.pounding) p.vy = -P.cutV;
      if (inp.dashP && ab.dash && !p.dashUsed && !p.pounding) {
        p.dashT = P.dashT; p.dashUsed = true; p.vy = 0; p.vx = p.facing * P.dashV;
        if (events) events.push({ type: 'dash' });
      } else if (inp.downP && ab.pound && !p.onGround && !p.pounding) {
        p.pounding = true; p.vx = 0; p.vy = P.poundV;
        if (events) events.push({ type: 'pound' });
      }
      if (p.pounding) p.vy = P.poundV;
      else if (p.dashT <= 0) { p.vy += P.grav * dt; if (p.vy > P.maxFall) p.vy = P.maxFall; }
    }
  }

  // 가로 이동
  let nx = p.x + p.vx * dt;
  if (solidIn(room, nx, p.y, nx + p.w, p.y + p.h)) {
    if (p.dashT > 0) {
      // 돌진 중 금 간 바위벽은 부순다
      const c = Math.floor((p.vx > 0 ? nx + p.w : nx) / T);
      let broke = false;
      for (let r = Math.floor(p.y / T); r <= Math.floor((p.y + p.h - 0.001) / T); r++) {
        if (tileAt(room, c, r) === TILE.CRACK) { breakFlood(room, c, r, TILE.CRACK, events); broke = true; }
      }
      if (broke && !solidIn(room, nx, p.y, nx + p.w, p.y + p.h)) { p.x = nx; nx = null; }
    }
    if (nx !== null) {
      if (p.vx > 0) p.x = Math.floor((nx + p.w) / T) * T - p.w - 0.001;
      else if (p.vx < 0) p.x = (Math.floor(nx / T) + 1) * T + 0.001;
      if (solidIn(room, p.x, p.y, p.x + p.w, p.y + p.h)) p.x = p.x; // 안전 장치
      p.vx = 0;
      if (p.dashT > 0) p.dashT = 0;
    }
  } else p.x = nx;

  // 세로 이동
  const prevBottom = p.y + p.h;
  let ny = p.y + p.vy * dt;
  let landed = false;
  if (p.vy > 0) {
    const bottom = ny + p.h;
    const r = Math.floor((bottom - 0.001) / T);
    const c0 = Math.floor(p.x / T), c1 = Math.floor((p.x + p.w - 0.001) / T);
    let hit = false;
    for (let c = c0; c <= c1; c++) {
      const t = tileAt(room, c, r);
      if (p.pounding && t === TILE.FLOORCRACK) { breakFlood(room, c, r, TILE.FLOORCRACK, events); continue; }
      if (SOLID[t]) hit = true;
      else if (t === TILE.PLAT && p.dropT <= 0 && prevBottom <= r * T + 0.5) hit = true;
    }
    // 두 줄을 한 번에 넘는 일은 없다(최대 낙하 9.3px/걸음)
    if (hit) {
      ny = r * T - p.h;
      if (p.pounding && events) events.push({ type: 'slam' });
      p.vy = 0; landed = true; p.pounding = false;
    }
  } else if (p.vy < 0) {
    if (solidIn(room, p.x, ny, p.x + p.w, ny + p.h)) {
      ny = (Math.floor(ny / T) + 1) * T + 0.001;
      p.vy = 0;
    }
  }
  p.y = ny;
  if (landed) {
    if (!p.onGround && events) events.push({ type: 'land' });
    p.onGround = true; p.doubleUsed = false; if (p.dashT <= 0) p.dashUsed = false;
  } else if (p.vy >= 0 && supportBelow(room, p)) {
    p.onGround = true; if (p.dashT <= 0) p.dashUsed = false; p.doubleUsed = false;
  } else {
    if (p.onGround && p.vy >= 0) p.coyote = P.coyote;
    p.onGround = false;
  }
  if (events && overlapsTile(room, p, TILE.SPIKE)) events.push({ type: 'spike' });
  return p;
}

// 방 나가기 판정: 몸 가운데가 방 밖으로 나가면 그 쪽(L/R/T/B)
export function exitSide(p) {
  const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
  if (cx < 0) return 'L';
  if (cx >= W) return 'R';
  if (cy < 0) return 'T';
  if (cy >= H) return 'B';
  return null;
}

export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
