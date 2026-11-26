// 도달 검사기: 게임과 같은 물리(step)로 '동작 묶음(매크로)'을 흉내 내어 방 안에서 갈 수 있는 곳을 찾는다.
// 방 하나 × 능력 조합마다 상태 그래프(땅에 선 자리·벽에 붙은 자리·물속 자리)를 만들고,
// 들어온 문에서 나갈 수 있는 문·주울 수 있는 물건을 돌려준다. 지도 전체 검사는 progress() 가 한다.
import { step, makePlayer, exitSide, T, TILE, P, tileAt } from '../web/js/physics.js';
import { buildTiles, spawnPoint, savePoint, pickRect, neighborId, OPP } from '../web/js/world.js';

export const ORDER = ['climb', 'dash', 'double', 'swim', 'pound', 'fire'];
export const abKey = (ab) => ORDER.map((k) => (ab[k] ? k[0] : '_')).join('') + (ab.key ? 'K' : '_');

function macrosFor(kind, ab, side, onPlat, wet) {
  const M = [];
  const add = (m) => M.push(Object.assign({ d: 0, jumps: [], hold: 1e9, dirFrom: 0, dirUntil: 1e9, up: false, down: false, dashAt: -1, downAt: -1, max: 150 }, m));
  if (kind === 'cling') {
    add({ d: side, up: true, climb: true, max: 240 });
    add({ d: -side, jumps: [0] });
    add({ d: -side, jumps: [0], dirUntil: 8, dirFrom: 0, then: side });
    add({ d: 0, jumps: [0] });
    if (ab.double) { add({ d: -side, jumps: [0, 16] }); add({ d: side, jumps: [0, 14], dirFrom: 8 }); }
    if (ab.dash) add({ d: -side, jumps: [0], dashAt: 10 });
    add({ d: 0 });
    return M;
  }
  if (wet && ab.swim) {
    for (const dx of [-1, 0, 1]) for (const v of ['up', 'none', 'down']) {
      if (dx === 0 && v === 'none') continue;
      add({ d: dx, up: v === 'up', down: v === 'down', swim: 18 });
    }
    for (const dx of [-1, 0, 1]) add({ d: dx, jumps: [0], up: true, swim: 30 });
  }
  if (kind !== 'ground') return M;
  for (const d of [-1, 0, 1]) {
    add({ d, jumps: [0] });
    add({ d, jumps: [0], hold: 6 });
    if (d) {
      add({ d, jumps: [0], dirFrom: 12 });
      add({ d, jumps: [0], dirUntil: 10 });
      add({ d, walk: true, max: 200 });
    }
    if (ab.double) {
      add({ d, jumps: [0, 16] });
      add({ d, jumps: [0, 26] });
      if (d) { add({ d, jumps: [0, 16], dirFrom: 14 }); add({ d, jumps: [0, 18], dirUntil: 12 }); }
    }
    if (ab.dash && d) {
      add({ d, dashAt: 0 });
      add({ d, jumps: [0], dashAt: 14 });
      if (ab.double) add({ d, jumps: [0, 16], dashAt: 30 });
    }
    if (ab.climb && d) {
      add({ d, jumps: [0], up: true, climb: true, max: 260 });
    }
  }
  if (onPlat) add({ d: 0, jumps: [0], down: true });
  return M;
}

function inputAt(m, f) {
  let d = 0;
  if (f >= m.dirFrom && f < m.dirUntil) d = m.d; else if (f >= m.dirUntil && m.then !== undefined) d = m.then;
  const wet = m.swim !== undefined;
  if (wet && f >= m.swim) return { left: false, right: false, up: false, down: false, jump: false, jumpP: false, dashP: false, downP: false };
  return {
    left: d < 0, right: d > 0, up: m.up, down: m.down,
    jump: m.jumps.length > 0 && f <= m.hold, jumpP: m.jumps.includes(f) || (wet && m.jumps.length > 0 && m.up && f % 8 === 0),
    dashP: m.dashAt === f, downP: m.downAt === f,
  };
}

function snapshot(p) {
  return { x: p.x, y: p.y };
}
function classify(room, p, ab) {
  const cx = p.x + p.w / 2;
  if (p.inWater && ab.swim) {
    const c = Math.floor(cx / T), r = Math.floor((p.y + p.h / 2) / T);
    return { kind: 'water', key: `w${c},${r}` };
  }
  if (p.onGround) {
    const c = Math.floor(cx / T), r = Math.round((p.y + p.h) / T);
    return { kind: 'ground', key: `g${c},${r}`, onPlat: tileAt(room, c, r) === TILE.PLAT };
  }
  if (p.cling) {
    const c = Math.floor(cx / T), r = Math.floor((p.y + p.h / 2) / T);
    return { kind: 'cling', key: `c${c},${r},${p.cling}`, side: p.cling };
  }
  return null;
}

// 방 하나의 상태 그래프
export class RoomSolver {
  constructor(def, ab, opts = {}) {
    this.def = def;
    this.ab = ab;
    this.room = { tiles: buildTiles(def, { ab, solver: true, key: !!ab.key, bossDone: opts.bossDone || (() => true) }) };
    this.items = (def.items || []).map((it) => ({ id: it.id, rect: pickRect(it) }));
    if (opts.extraItems) for (const it of opts.extraItems) this.items.push({ id: it.id, rect: pickRect(it) });
    this.states = new Map(); // key → {kind, snap, side, next:Set, exits:Set, items:Set}
    this.steps = 0;
  }
  // 시작 자리(문 쪽·저장 돌)에서 첫 상태로
  entry(side) {
    const sp = side === 'S' ? savePoint(this.def) : side === 'BOSS' ? this.def.bossSpawn : spawnPoint(this.def, side);
    const key = 'E' + side;
    if (!this.states.has(key)) {
      const st = { kind: 'entry', snap: sp, next: new Set(), exits: new Set(), items: new Set() };
      this.states.set(key, st);
      this.run(st, { d: 0, jumps: [], hold: 0, dirFrom: 0, dirUntil: 1e9, up: false, down: false, dashAt: -1, downAt: -1, max: 200, entry: true });
    }
    return key;
  }
  run(st, m) {
    const p = makePlayer(st.snap.x, st.snap.y);
    p.vx = st.snap.vx || 0; p.vy = st.snap.vy || 0;
    if (st.kind === 'ground') p.onGround = true;
    if (st.kind === 'cling') p.cling = st.side;
    const ev = [];
    let lastY = p.y, still = 0, left = false;
    for (let f = 0; f < m.max; f++) {
      const inp = inputAt(m, f);
      ev.length = 0;
      step(this.room, p, inp, this.ab, 1 / 60, ev);
      this.steps++;
      if (ev.length && ev.some((e) => e.type === 'spike' || e.type === 'choke')) return;
      const ex = exitSide(p);
      if (ex) { st.exits.add(ex); return; }
      for (const it of this.items) {
        const r = it.rect;
        if (p.x < r.x + r.w && p.x + p.w > r.x && p.y < r.y + r.h && p.y + p.h > r.y) st.items.add(it.id);
      }
      if (f < 1 && !m.entry) continue;
      const cl = classify(this.room, p, this.ab);
      if (m.swim !== undefined) {
        if (f >= m.swim && cl) { this.link(st, cl, p); return; }
        continue;
      }
      if (!cl) { left = true; continue; }
      if (m.walk) {
        if (cl.kind === 'ground') {
          this.link(st, cl, p);
          if (left) return;
          if (Math.abs(p.vx) < 1) { if (++still > 3) return; } else still = 0;
          continue;
        }
        this.link(st, cl, p); return;
      }
      if (m.climb && cl.kind === 'cling') {
        if (Math.abs(p.y - lastY) < 0.01) { if (++still > 4) { this.link(st, cl, p); return; } } else still = 0;
        lastY = p.y;
        continue;
      }
      this.link(st, cl, p);
      return;
    }
  }
  link(st, cl, p) {
    st.next.add(cl.key);
    if (!this.states.has(cl.key)) {
      const ns = { kind: cl.kind, snap: snapshot(p), side: cl.side, onPlat: cl.onPlat, next: new Set(), exits: new Set(), items: new Set(), todo: true };
      this.states.set(cl.key, ns);
      this.queue.push(ns);
    }
  }
  explore() {
    while (this.queue.length) {
      const s = this.queue.pop();
      if (!s.todo) continue;
      s.todo = false;
      const wet = s.kind === 'water' || (s.kind === 'ground' && this.wetAt(s.snap));
      for (const m of macrosFor(s.kind, this.ab, s.side, s.onPlat, wet)) this.run(s, m);
    }
  }
  wetAt(snap) {
    return tileAt(this.room, Math.floor((snap.x + P.w / 2) / T), Math.floor((snap.y + P.h / 2) / T)) === TILE.WATER;
  }
  // 들어온 곳에서 닿는 것
  reach(side) {
    this.queue = [];
    const k = this.entry(side);
    this.explore();
    const seen = new Set([k]);
    const st = [k];
    const exits = new Set(), items = new Set();
    while (st.length) {
      const s = this.states.get(st.pop());
      for (const e of s.exits) exits.add(e);
      for (const i of s.items) items.add(i);
      for (const n of s.next) if (!seen.has(n)) { seen.add(n); st.push(n); }
    }
    return { exits, items, states: seen.size };
  }
}

// 캐시: (방, 능력, 보스 처치 상태) → 풀이기
const cache = new Map();
export function solverFor(def, ab, bossDone) {
  const bd = def.bossDoor ? (bossDone(def.bossDoor) ? 'o' : 'x') : '';
  const k = def.id + '|' + abKey(ab) + bd;
  let s = cache.get(k);
  if (!s) { s = new RoomSolver(def, ab, { bossDone }); cache.set(k, s); }
  return s;
}
export function clearCache() { cache.clear(); }

// 지도 전체 진행 검사: 시작 방에서 출발해, 닿는 물건을 줍고 보스를 쓰러뜨리며(방에 닿으면 이긴 것으로 침)
// 더 이상 늘지 않을 때까지 넓힌다. 단계(phase)마다 새로 얻은 것을 기록한다.
export function progress(rooms, opts = {}) {
  const byId = new Map(rooms.map((r) => [r.id, r]));
  const start = rooms.find((r) => r.start);
  const ab = {};
  const bosses = new Set();
  const got = new Set();
  const phases = [];
  const visited = new Set();
  const nodePhase = new Map();
  for (let phase = 0; phase < 40; phase++) {
    const bossDone = (id) => bosses.has(id);
    const seeds = [start.id + '|S', ...[...visited].filter((id) => byId.get(id).save).map((id) => id + '|S')];
    const nodes = new Set(seeds);
    const st = [...nodes];
    const newGot = [];
    while (st.length) {
      const node = st.pop();
      const [id, side] = node.split('|');
      const def = byId.get(id);
      visited.add(id);
      if (!nodePhase.has(node)) nodePhase.set(node, phase);
      if (def.boss && !bosses.has(def.boss)) newGot.push('boss' + def.boss);
      const r = solverFor(def, ab, bossDone).reach(side);
      for (const it of r.items) if (!got.has(it)) newGot.push(it);
      for (const e of r.exits) {
        const nid = neighborId(def, e);
        if (!byId.has(nid) || !def.doors[e]) continue;
        const nn = nid + '|' + OPP[e];
        if (!nodes.has(nn)) { nodes.add(nn); st.push(nn); }
      }
    }
    const fresh = [...new Set(newGot)];
    if (!fresh.length) { phases.push({ phase, got: [], nodes: nodes.size, ab: { ...ab }, bosses: [...bosses] }); break; }
    for (const g of [...fresh]) {
      got.add(g);
      if (g.startsWith('boss')) {
        const b = Number(g.slice(4));
        bosses.add(b);
        const reward = opts.bossRewards && opts.bossRewards[b];
        if (reward) { got.add(reward); fresh.push(reward); if (!reward.includes(':') && reward !== 'ending') ab[reward] = true; }
      } else if (!g.includes(':')) ab[g] = true;
    }
    phases.push({ phase, got: fresh, nodes: nodes.size, ab: { ...ab }, bosses: [...bosses] });
  }
  return { phases, got, ab, bosses, visited, nodePhase };
}

// 갇힘 검사: (방|들어온 쪽) 에서 그때 가진 능력만으로 별돌 있는 방에 닿는가
export function canReachSave(rooms, node, ab, bosses) {
  const byId = new Map(rooms.map((r) => [r.id, r]));
  const bossDone = (id) => bosses.includes(id);
  const seen = new Set([node]);
  const st = [node];
  while (st.length) {
    const n = st.pop();
    const [id, side] = n.split('|');
    const def = byId.get(id);
    if (def.save) return true;
    const r = solverFor(def, ab, bossDone).reach(side);
    for (const e of r.exits) {
      const nid = neighborId(def, e);
      if (!byId.has(nid) || !def.doors[e]) continue;
      const nn = nid + '|' + OPP[e];
      if (!seen.has(nn)) { seen.add(nn); st.push(nn); }
    }
  }
  return false;
}
