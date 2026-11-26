// 방 만들기: worldspec.js(손으로 짠 지도·연결·특징)를 읽어 방 66개의 타일을 정해진 씨앗으로 만들고,
// 도달 검사기로 하나하나 확인해 통과한 판만 web/js/data/rooms.js 에 쓴다.
// 사용법: node tools/build-world.mjs [--check]   (--check 는 쓰지 않고 지금 파일과 같은지만 본다)
import { writeFileSync, readFileSync } from 'node:fs';
import { LINKS, FEATURES, LAYOUT, MAP_W, MAP_H, zoneAt, cellKey, BOSSES, ZONES, GATE_NEED } from '../web/js/worldspec.js';
import { COLS, ROWS } from '../web/js/physics.js';
import { RoomSolver, ORDER } from './solver.mjs';

const OUT = new URL('../web/js/data/rooms.js', import.meta.url);

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const ri = (R, a, b) => a + Math.floor(R() * (b - a + 1));

// 1) 칸마다 문
const cells = new Map();
LAYOUT.forEach((row, y) => row.forEach((z, x) => { if (z !== '.') cells.set(cellKey(x, y), { x, y, zone: Number(z), doors: {} }); }));
const vlinks = [];
for (const [x1, y1, x2, y2, type, boss] of LINKS) {
  const a = cells.get(cellKey(x1, y1)), b = cells.get(cellKey(x2, y2));
  if (!a || !b) throw new Error('link to empty cell ' + [x1, y1, x2, y2]);
  if (y1 === y2) {
    a.doors.R = { type, boss, high: type === 'd' };
    b.doors.L = { type, boss, high: type === 'd' };
  } else {
    const d = { type, boss };
    a.doors.B = d; b.doors.T = d; vlinks.push({ a, b, d });
  }
}
// 세로 구멍 열: 한 방의 위·아래 구멍이 너무 가깝지 않게
{
  const R = rng(9137);
  for (const { a, b, d } of vlinks) {
    for (let tries = 0; ; tries++) {
      const col = ri(R, 6, 20);
      const other = [a.doors.T && a.doors.T !== d ? a.doors.T.col : null, b.doors.B && b.doors.B !== d ? b.doors.B.col : null].filter((v) => v != null);
      if (other.every((o) => Math.abs(o - col) >= 9) || tries > 200) { d.col = col; break; }
    }
  }
}

// 2) 능력 순서(추상 그래프) — 방마다 처음 닿을 때 가진 능력
const needOf = (door) => (door.type === 'b' ? 'boss' + door.boss : GATE_NEED[door.type]);
const OPPS = { L: 'R', R: 'L', T: 'B', B: 'T' };
const nb = (c, s) => cellKey(c.x + { L: -1, R: 1, T: 0, B: 0 }[s], c.y + { L: 0, R: 0, T: -1, B: 1 }[s]);
const rewardOf = (b) => (BOSSES[b].reward.item || (BOSSES[b].reward.kind === 'hp' ? null : null));
const upNeed = { plain: null, hidden: null, climb: 'climb', double: 'double', dash: 'dash', fire: 'fire', pound: 'pound', swim: 'swim' };
function abstractProgress() {
  const have = new Set();
  const arrive = new Map();
  for (let it = 0; it < 30; it++) {
    const seen = new Set(['2,3']);
    const st = ['2,3'];
    let grew = false;
    while (st.length) {
      const k = st.pop();
      const c = cells.get(k);
      if (!arrive.has(k)) arrive.set(k, new Set(have));
      const f = FEATURES[k] || {};
      if (f.item && !have.has(f.item)) { have.add(f.item); grew = true; }
      if (f.boss && !have.has('boss' + f.boss)) { have.add('boss' + f.boss); const r = rewardOf(f.boss); if (r) have.add(r); grew = true; }
      for (const s of Object.keys(c.doors)) {
        const n = needOf(c.doors[s]);
        if (n && !have.has(n)) continue;
        const nk = nb(c, s);
        if (!seen.has(nk)) { seen.add(nk); st.push(nk); }
      }
    }
    if (!grew) break;
  }
  return arrive;
}
const ARRIVE = abstractProgress();

// 3) 방 하나 만들기
function makeRoom(cell, seed) {
  const R = rng(seed);
  const key = cellKey(cell.x, cell.y);
  const feat = FEATURES[key] || {};
  const g = Array.from({ length: ROWS }, () => Array(COLS).fill('.'));
  const set = (c, r, ch) => { if (c >= 0 && c < COLS && r >= 0 && r < ROWS) g[r][c] = ch; };
  for (let c = 0; c < COLS; c++) { g[0][c] = '#'; g[15][c] = '#'; g[16][c] = '#'; }
  for (let r = 0; r < ROWS; r++) { g[r][0] = '#'; g[r][COLS - 1] = '#'; }
  const used = Array(COLS).fill(false); // 바닥 칸 예약
  const keep = []; // 장식·발판 금지 구역
  const reserve = (c0, c1) => { for (let c = Math.max(0, c0); c <= Math.min(COLS - 1, c1); c++) used[c] = true; };
  const plug = { a: 'C', f: 'I', b: 'B', k: 'K' };
  const doors = {};
  for (const [s, d] of Object.entries(cell.doors)) {
    doors[s] = { type: d.type, ...(d.boss ? { boss: d.boss } : {}), ...(d.high ? { high: true } : {}), ...(d.col != null ? { col: d.col } : {}) };
    if (s === 'L' || s === 'R') {
      const wc = s === 'L' ? 0 : COLS - 1, dir = s === 'L' ? 1 : -1;
      if (d.high) {
        for (let r = 5; r <= 8; r++) set(wc, r, '.');
        for (let i = 0; i <= 3; i++) set(wc + dir * i, 9, '=');
        for (let r = 10; r <= 14; r++) set(wc, r, '=');
        keep.push(s === 'L' ? [0, 10, 0, 14] : [COLS - 11, COLS - 1, 0, 14]);
        reserve(s === 'L' ? 1 : COLS - 5, s === 'L' ? 4 : COLS - 2);
      } else if (d.type === 's') {
        for (let i = 0; i <= 6; i++) { for (let r = 6; r <= 14; r++) set(wc + dir * i, r, '~'); for (let r = 1; r <= 5; r++) if (i > 0) set(wc + dir * i, r, '#'); }
        reserve(s === 'L' ? 1 : COLS - 10, s === 'L' ? 9 : COLS - 2);
        keep.push(s === 'L' ? [0, 9, 0, 14] : [COLS - 10, COLS - 1, 0, 14]);
      } else {
        for (let r = 11; r <= 14; r++) set(wc, r, plug[d.type] || '.');
        reserve(s === 'L' ? 1 : COLS - 4, s === 'L' ? 3 : COLS - 2);
        keep.push(s === 'L' ? [0, 3, 9, 14] : [COLS - 4, COLS - 1, 9, 14]);
      }
    } else if (s === 'T') {
      const hc = d.col;
      for (let c = hc; c <= hc + 2; c++) set(c, 0, d.type === 'b' ? 'B' : d.type === 'k' ? 'K' : '.');
      if (d.type === 'w') {
        for (let r = 1; r <= 11; r++) set(hc - 1, r, '#');
        keep.push([hc - 4, hc + 6, 0, 14]);
      } else {
        const rows = d.type === 'd' ? [12, 9, 6] : [12, 9, 6, 3];
        if (d.type === 'd') { set(hc - 1, 0, '='); set(hc + 3, 0, '='); }
        for (const r of rows) for (let c = hc; c <= hc + 2; c++) set(c, r, '-');
        keep.push(d.type === 'd' ? [hc - 5, hc + 7, 0, 14] : [hc - 2, hc + 4, 0, 14]);
      }
      reserve(hc - 1, hc + 3);
    } else if (s === 'B') {
      const hc = d.col;
      for (let c = hc; c <= hc + 2; c++) for (const r of [15, 16]) set(c, r, d.type === 'p' ? 'P' : d.type === 'b' ? 'B' : '.');
      reserve(hc - 2, hc + 4);
    }
  }
  const free = (w, lo = 2, hi = COLS - 3) => {
    const opts = [];
    for (let c = lo; c + w - 1 <= hi; c++) { let ok = true; for (let i = -1; i <= w; i++) if (used[c + i]) ok = false; if (ok) opts.push(c); }
    if (!opts.length) return null;
    return opts[Math.floor(R() * opts.length)];
  };
  const items = [];
  let save = null, bossSpawn = null, reward = null;
  const mid = (w) => { // 가운데 가까운 자리
    const c0 = free(w, 9, 20) ?? free(w);
    return c0;
  };
  if (feat.boss) {
    // 보스 방: 넓은 바닥과 양쪽 발판
    for (const [c0, c1] of [[5, 8], [21, 24]]) {
      let ok = true; for (let c = c0; c <= c1; c++) if (used[c]) ok = false;
      if (ok) for (let c = c0; c <= c1; c++) set(c, 10, '-');
    }
    const c = used[14] ? (used[17] ? 11 : 17) : 14;
    reward = { c, r: 13 };
    bossSpawn = { x: c * 16 + 3, y: 15 * 16 - 22.01, vx: 0, vy: 0 };
    reserve(c - 1, c + 1);
  }
  if (feat.save) {
    const c = mid(3);
    if (c == null) return null;
    save = { c: c + 1, r: 14 };
    reserve(c, c + 2);
  }
  if (feat.item) {
    const c = mid(3);
    if (c == null) return null;
    items.push({ id: feat.item, kind: 'ability', c: c + 1, r: 13 });
    reserve(c, c + 2);
  }
  if (feat.up) {
    const id = `${feat.up.kind}:${key}`;
    const kind = feat.up.kind;
    const n = feat.up.nook;
    if (n === 'plain') {
      const c = free(1); if (c == null) return null;
      items.push({ id, kind, c, r: 13 }); reserve(c, c);
    } else if (n === 'hidden' || n === 'dash' || n === 'fire' || n === 'pound') {
      const x = free(5); if (x == null) return null;
      const face = { hidden: 'F', dash: 'C', fire: 'I', pound: '#' }[n];
      for (let c = x; c <= x + 4; c++) set(c, 12, n === 'pound' && c > x && c < x + 4 ? 'P' : '#');
      for (const r of [13, 14]) { set(x, r, face); set(x + 4, r, face); }
      items.push({ id, kind, c: x + 2, r: 13, nook: n });
      reserve(x, x + 4); keep.push([x - 1, x + 5, 8, 14]);
    } else if (n === 'climb') {
      const x = free(2, 6, 23); if (x == null) return null;
      for (let r = 5; r <= 14; r++) { set(x, r, '#'); set(x + 1, r, '#'); }
      items.push({ id, kind, c: x, r: 4, nook: n });
      reserve(x - 1, x + 2); keep.push([x - 4, x + 5, 0, 14]);
    } else if (n === 'double') {
      const x = free(3, 6, 22); if (x == null) return null;
      for (let c = x; c <= x + 2; c++) set(c, 9, '=');
      items.push({ id, kind, c: x + 1, r: 8, nook: n });
      reserve(x - 1, x + 3); keep.push([x - 5, x + 7, 0, 14]);
    } else if (n === 'swim') {
      const x = free(9, 2, 27); if (x == null) return null;
      const p = x + 2;
      for (let r = 9; r <= 14; r++) { set(p, r, '='); set(p + 4, r, '='); for (let c = p + 1; c <= p + 3; c++) set(c, r, '~'); }
      for (const c of [x, x + 1, p + 5, p + 6]) set(c, 12, '-');
      items.push({ id, kind, c: p + 2, r: 14, nook: n });
      reserve(x, x + 8); keep.push([x - 1, x + 9, 6, 14]);
    }
  }
  const inKeep = (c, r) => keep.some(([c0, c1, r0, r1]) => c >= c0 && c <= c1 && r >= r0 && r <= r1);
  // 장식·지형
  const quiet = feat.boss || feat.save || feat.start;
  if (!quiet && R() < 0.55) { // 가시 구덩이
    const p = free(3); if (p != null) { for (let c = p; c < p + 3; c++) set(c, 15, '^'); reserve(p - 1, p + 3); }
  }
  if (!quiet && R() < 0.5) { // 낮은 둔덕
    const w = ri(R, 3, 5); const s0 = free(w);
    if (s0 != null) { const h = R() < 0.5 ? 1 : 2; for (let c = s0; c < s0 + w; c++) for (let r = 15 - h; r <= 14; r++) set(c, r, '#'); reserve(s0, s0 + w - 1); }
  }
  const nPlat = feat.boss ? 0 : ri(R, 1, 3);
  for (let i = 0; i < nPlat; i++) {
    const w = ri(R, 3, 5), r = ri(R, 9, 11), c0 = ri(R, 3, COLS - 4 - w);
    let ok = true;
    for (let c = c0 - 1; c <= c0 + w; c++) for (let rr = r - 3; rr <= r + 1; rr++) if (inKeep(c, rr) || (g[rr] && g[rr][c] !== '.' && rr < 15)) ok = false;
    if (ok) for (let c = c0; c < c0 + w; c++) set(c, r, '-');
  }
  if (!feat.boss && R() < 0.5) { // 매달린 바위(장식)
    const c = ri(R, 4, COLS - 5), len = ri(R, 1, 3);
    let ok = true; for (let r = 1; r <= len + 2; r++) if (inKeep(c, r) || g[r][c] !== '.') ok = false;
    if (ok) for (let r = 1; r <= len; r++) set(c, r, '=');
  }
  // 적
  const enemies = [];
  if (!quiet) {
    const n = ri(R, 1, 3);
    const z = cell.zone;
    for (let i = 0; i < n; i++) {
      const roll = R();
      if (roll < 0.45) { const c = ri(R, 5, 24); if (g[14][c] === '.' && g[15][c] === '#') enemies.push({ type: 'crawler', c, r: 14 }); }
      else if (roll < 0.8) { const c = ri(R, 6, 23), r = ri(R, 4, 8); if (g[r][c] === '.') enemies.push({ type: 'flyer', c, r }); }
      else if (z >= 2) { const c = ri(R, 6, 23); if (g[14][c] === '.' && g[15][c] === '#') enemies.push({ type: 'spitter', c, r: 14 }); }
    }
  }
  return {
    id: key, x: cell.x, y: cell.y, zone: cell.zone, doors,
    ...(feat.start ? { start: true } : {}), ...(feat.boss ? { boss: feat.boss, reward, bossSpawn } : {}),
    ...(cell.doors.B && cell.doors.B.type === 'b' ? { bossDoor: cell.doors.B.boss } : {}),
    ...(cell.doors.T && cell.doors.T.type === 'b' ? { bossDoor: cell.doors.T.boss } : {}),
    ...(cell.doors.L && cell.doors.L.type === 'b' ? { bossDoor: cell.doors.L.boss } : {}),
    ...(cell.doors.R && cell.doors.R.type === 'b' ? { bossDoor: cell.doors.R.boss } : {}),
    save, items, enemies,
    tiles: g.map((r) => r.join('')).join(''),
  };
}

// 4) 방 검사
const FULL = Object.fromEntries([...ORDER, 'key'].map((k) => [k, true]));
const without = (ab, k) => { const o = { ...ab }; delete o[k]; return o; };
const needFor = (d) => (d.type === 'b' ? 'boss' : GATE_NEED[d.type]);
// 이 문 쪽이 막혀 있어야 하는 방인가(세로 문은 오르는 쪽/찍는 쪽만)
function gateHere(side, d) {
  if (d.type === '-' || d.type === '|') return false;
  if (side === 'L' || side === 'R') return true;
  if (d.type === 'w' || d.type === 'd') return side === 'T';
  if (d.type === 'p') return side === 'B';
  return true;
}
export function checkRoom(def, arrive) {
  const problems = [];
  const sides = Object.keys(def.doors);
  const entries = (ab, bossOpen) => {
    const out = [];
    for (const s of sides) {
      const d = def.doors[s];
      const n = needFor(d);
      if (n === 'boss' ? !bossOpen : n && !ab[n]) continue;
      if (s === 'B' && d.type === 'p' && !ab.pound) continue;
      out.push(s);
    }
    if (def.save) out.push('S');
    if (def.boss) out.push('BOSS');
    return out;
  };
  const sets = [['full', FULL, true]];
  if (arrive) {
    const ab = {}; for (const k of arrive) if (!k.startsWith('boss')) ab[k] = true;
    if (def.boss) { const r = BOSSES[def.boss].reward.item; if (r) ab[r] = true; }
    const bossOpen = def.bossDoor ? arrive.has('boss' + def.bossDoor) : false;
    sets.push(['arrive', ab, bossOpen]);
  }
  for (const [name, ab, bossOpen] of sets) {
    const S = new RoomSolver(def, ab, { bossDone: () => bossOpen, extraItems: def.reward ? [{ id: 'reward', ...def.reward }] : [] });
    const want = sides.filter((s) => { const d = def.doors[s]; const n = needFor(d); return n === 'boss' ? bossOpen : !n || ab[n]; });
    const wantItems = def.items.filter((it) => !it.nook || !upNeed[it.nook] || ab[upNeed[it.nook]]).map((it) => it.id);
    for (const e of entries(ab, bossOpen)) {
      const r = S.reach(e);
      for (const s of want) if (s !== e && !r.exits.has(s)) {
        // 위로 오르는 문은 아래에서 위로만 확인, 내려찍는 바닥은 위에서만
        problems.push(`${name}: ${e}→${s} 못 감`);
      }
      for (const i of wantItems) if (!r.items.has(i)) problems.push(`${name}: ${e}→물건 ${i} 못 줍`);
    }
  }
  // 잠금: 능력 없이 그 문으로 못 나간다
  for (const s of sides) {
    const d = def.doors[s];
    if (!gateHere(s, d)) continue;
    const n = needFor(d);
    const ab = n === 'boss' ? FULL : without(FULL, n);
    const S = new RoomSolver(def, ab, { bossDone: () => n !== 'boss' });
    for (const e of entries(ab, n !== 'boss')) {
      if (e === s) continue;
      if (S.reach(e).exits.has(s)) problems.push(`잠금 샘: ${n} 없이 ${e}→${s}`);
    }
  }
  // 숨은 강화의 잠금
  for (const it of def.items) {
    const n = it.nook && upNeed[it.nook];
    if (!n) continue;
    const S = new RoomSolver(def, without(FULL, n), {});
    for (const e of entries(without(FULL, n), true)) if (S.reach(e).items.has(it.id)) problems.push(`강화 잠금 샘: ${n} 없이 ${e}→${it.id}`);
  }
  return problems;
}

export function debugMake(key, attempt) {
  const cell = cells.get(key);
  return makeRoom(cell, (cell.x * 7919 + cell.y * 104729 + attempt * 31337) >>> 0);
}

export function buildAll(log = () => {}) {
  const rooms = [];
  for (const [key, cell] of cells) {
    let best = null;
    for (let attempt = 0; attempt < 80; attempt++) {
      const seed = (cell.x * 7919 + cell.y * 104729 + attempt * 31337) >>> 0;
      const def = makeRoom(cell, seed);
      if (!def) { if (attempt === 79) log(`${key} 자리 없음`); continue; }
      const pr = checkRoom(def, ARRIVE.get(key));
      if (!pr.length) { best = def; log(`${key} ok (시도 ${attempt + 1})`); break; }
      if (attempt === 79) log(`${key} 실패: ${pr.slice(0, 4).join(' / ')}`);
    }
    if (!best) throw new Error('방을 만들지 못함: ' + key);
    rooms.push(best);
  }
  rooms.sort((a, b) => a.y - b.y || a.x - b.x);
  return rooms;
}

export function serialize(rooms) {
  const lines = rooms.map((r) => '  ' + JSON.stringify(r));
  return '// 자동 생성(tools/build-world.mjs) — 손으로 고치지 말 것\nexport const ROOMS = [\n' + lines.join(',\n') + ',\n];\n';
}

if (process.argv[1] && process.argv[1].endsWith('build-world.mjs')) {
  const t0 = Date.now();
  const rooms = buildAll((m) => process.stdout.write(m + '\n'));
  const text = serialize(rooms);
  if (process.argv.includes('--check')) {
    const cur = readFileSync(OUT, 'utf8');
    if (cur !== text) { console.error('rooms.js 가 설계와 다름 — node tools/build-world.mjs 로 다시 만들 것'); process.exit(1); }
    console.log('rooms.js 최신');
  } else {
    writeFileSync(OUT, text);
    console.log(`방 ${rooms.length}개 씀 (${((Date.now() - t0) / 1000).toFixed(1)}초)`);
  }
}
