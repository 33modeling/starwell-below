// 별우물 아래 — 게임 고리(장면·방 넘기기·전투·저장·지도·화면)
import { T, W, H, COLS, ROWS, DT, TILE, P, step, makePlayer, exitSide, tileAt, isSolid, breakFlood, rectsOverlap } from './physics.js';
import { ROOM_BY_ID, ROOMS, buildTiles, spawnPoint, savePoint, pickRect, neighborId, OPP } from './world.js';
import { ZONES, ABILITIES, KEY_ITEM, BOSSES, MAP_W, MAP_H } from './worldspec.js';
import { createInput, physInput } from './input.js';
import { newSave, loadSave, writeSave, clearSave, loadOptions, writeOptions } from './save.js';
import { sfx, unlock, setSound } from './audio.js';
import { makeEnemy, updateEnemy, makeBoss, updateBoss } from './actors.js';
import { drawBackground, renderTiles, drawWater, drawPlayer, drawEnemy, drawBoss, drawItem, drawSave } from './art.js';

const params = new URLSearchParams(location.search);
const MANUAL = params.has('manual');
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
cv.width = W; cv.height = H;
ctx.imageSmoothingEnabled = false;
const $ = (id) => document.getElementById(id);
const input = createInput(window);
input.bindTouch($('touch'));
const opts = loadOptions();
setSound(opts.sound);

const ABIL = Object.fromEntries(ABILITIES.map((a) => [a.id, a]));
const HP_TOTAL = ROOMS.reduce((n, r) => n + r.items.filter((i) => i.kind === 'hp').length, 0) + BOSSES.filter((b) => b && b.reward.kind === 'hp').length;
const SHOT_TOTAL = ROOMS.reduce((n, r) => n + r.items.filter((i) => i.kind === 'shot').length, 0);

let S = null; // 저장 상태
let scene = 'title';
let G = null; // 방 실행 상태
let clock = 0;
let rndState = 12345;
const rnd = () => { rndState = (rndState * 1103515245 + 12345) & 0x7fffffff; return rndState / 0x7fffffff; };

const nAb = () => ABILITIES.filter((a) => S.ab[a.id]).length;

// ── 방 불러오기 ───────────────────────────────
function doorCells(def, side) {
  const d = def.doors[side]; const out = [];
  if (!d) return out;
  if (side === 'L' || side === 'R') { const c = side === 'L' ? 0 : COLS - 1; const rows = d.high ? [5, 6, 7, 8] : [11, 12, 13, 14]; for (const r of rows) out.push([c, r]); }
  else if (side === 'T') for (let c = d.col; c <= d.col + 2; c++) out.push([c, 0]);
  else for (let c = d.col; c <= d.col + 2; c++) { out.push([c, 15]); out.push([c, 16]); }
  return out;
}

function loadRoom(id, side, keep = {}) {
  const def = ROOM_BY_ID.get(id);
  const broken = new Set(S.broken[id] || []);
  // 문으로 들어오면 그 문을 막던 금 간 벽·얼음·금 간 바닥은 이미 지나온 것이니 지운다
  if (side && def.doors[side]) {
    for (const [c, r] of doorCells(def, side)) {
      const ch = def.tiles[r * COLS + c];
      if (ch === 'C' || ch === 'I' || ch === 'P') broken.add(`${c},${r}`);
    }
    S.broken[id] = [...broken];
  }
  const tiles = buildTiles(def, { bossDone: (b) => S.bosses.includes(b), key: S.key, broken });
  const room = { tiles };
  let sp;
  if (side === 'S' || !side) sp = def.save ? savePoint(def) : def.bossSpawn || { x: 14 * T + 3, y: 15 * T - P.h - 0.01, vx: 0, vy: 0 };
  else sp = spawnPoint(def, side);
  const p = makePlayer(sp.x, sp.y);
  p.vy = sp.vy || 0;
  if (keep.p) { p.facing = keep.p.facing; if (side === 'L' || side === 'R') p.vx = keep.p.vx; }
  if (side === 'R') p.facing = -1; else if (side === 'L') p.facing = 1;
  const items = def.items.filter((i) => !S.got.includes(i.id)).map((i) => ({ ...i }));
  let boss = null;
  if (def.boss) {
    if (!S.bosses.includes(def.boss)) boss = makeBoss(def.boss, BOSSES[def.boss], def);
    else addReward(def, items);
  }
  const prevZone = G ? G.def.zone : 0;
  G = {
    def, room, p, items, boss, tilesCv: renderTiles(def, tiles),
    enemies: boss ? [] : def.enemies.map((e) => makeEnemy(e, def.zone)),
    shots: [], eshots: [], fx: [], inv: keep.inv || 0, hp: keep.hp ?? S.maxHp, cd: 0,
    safe: { x: sp.x, y: sp.y }, savedHere: side === 'S', locked: null, wind: 0, fade: 0.25, banner: prevZone !== def.zone ? 2.5 : (G ? G.banner : 0),
  };
  if (!S.visited.includes(id)) S.visited.push(id);
  S.room = id;
  writeSave(S);
}

function addReward(def, items) {
  const b = BOSSES[def.boss];
  const r = b.reward;
  const id = r.item ? r.item : r.kind === 'hp' ? `hp:boss${def.boss}` : 'heart';
  if (S.got.includes(id)) return;
  items.push({ id, kind: r.item === 'key' ? 'key' : r.item ? 'ability' : r.kind === 'hp' ? 'hp' : 'heart', c: def.reward.c, r: def.reward.r, reward: true });
}

function retile() { G.tilesCv = renderTiles(G.def, G.room.tiles); }
function markBroken(c, r) {
  const k = `${c},${r}`;
  const a = S.broken[G.def.id] || (S.broken[G.def.id] = []);
  if (!a.includes(k)) a.push(k);
}

// ── 게임 도우미(적·보스가 부름) ─────────────────
const helper = {
  get player() { return G.p; },
  get room() { return G.room; },
  rnd,
  shake(n) { G.shake = Math.max(G.shake || 0, n); },
  enemyShot(x, y, vx, vy, r, o = {}) { G.eshots.push({ x, y, vx, vy, r, life: o.life || 4, ...o }); },
  summon(type, x, y) { if (G.enemies.length < 4) { const e = makeEnemy({ type, c: Math.floor(x / T), r: Math.floor(y / T) }, G.def.zone); G.enemies.push(e); } },
  hazardRect(r) { if (rectsOverlap(r, G.p)) hurt(2); },
  set wind(v) { G.wind = v; },
};

// ── 피해·죽음 ──────────────────────────────────
function hurt(n, knock = true) {
  if (G.inv > 0 || scene !== 'play') return false;
  G.hp -= n; G.inv = 1.1; sfx.hit(); helper.shake(3);
  if (knock) { G.p.vy = -220; G.p.vx = -G.p.facing * 140; G.p.dashT = 0; G.p.pounding = false; }
  burst(G.p.x + 5, G.p.y + 10, '#ff6b8a', 10);
  if (G.hp <= 0) { G.hp = 0; scene = 'dead'; G.deadT = 1.6; sfx.die(); }
  return true;
}
function burst(x, y, color, n = 8, sp = 90) {
  for (let i = 0; i < n; i++) { const a = rnd() * 6.283, v = sp * (0.4 + rnd()); G.fx.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.4 + rnd() * 0.3, color }); }
}
function toast(text, t = 2) { G.toast = { text, t }; }

function respawnAtSave(countDeath) {
  if (countDeath) S.deaths++;
  const hp = S.maxHp;
  loadRoom(S.saveRoom, 'S', { hp });
  scene = 'play';
}

// ── 줍기 ───────────────────────────────────────
function pickup(it) {
  S.got.push(it.id);
  if (it.kind === 'ability') {
    S.ab[it.id] = true; sfx.big();
    const a = ABIL[it.id];
    showMsg(`${a.name} 을(를) 얻었다!`, a.desc, a.color);
  } else if (it.kind === 'key') {
    S.key = true; sfx.big();
    showMsg(`${KEY_ITEM.name} 을(를) 얻었다!`, KEY_ITEM.desc, KEY_ITEM.color);
  } else if (it.kind === 'hp') {
    S.maxHp++; G.hp = S.maxHp; sfx.pick();
    toast(`체력 조각! 최대 체력 ${S.maxHp}`);
  } else if (it.kind === 'shot') {
    S.shot++; sfx.pick();
    toast(`탄 강화! 별빛 세기 ${S.shot + 1}단계`);
  } else if (it.kind === 'heart') {
    S.cleared = true; sfx.big(); writeSave(S); showEnding(); return;
  }
  burst(it.c * T + 8, it.r * T + 8, '#fff3b0', 16, 120);
  writeSave(S);
}

function showMsg(title, desc, color) {
  scene = 'msg'; G.msg = { title, desc, color, t: 0 };
}

// ── 한 걸음 ────────────────────────────────────
function stepPlay(inp) {
  const p = G.p, def = G.def, ab = S.ab;
  S.time += DT;
  if (G.inv > 0) G.inv -= DT;
  if (G.fade > 0) G.fade -= DT;
  if (G.banner > 0) G.banner -= DT;
  if (G.toast) { G.toast.t -= DT; if (G.toast.t <= 0) G.toast = null; }
  if (G.shake > 0) G.shake = Math.max(0, G.shake - DT * 20);
  const ev = [];
  const pi = physInput(inp);
  pi.downP = inp.downP;
  const wasGround = p.onGround, wasDouble = p.doubleUsed, wasIn = p.inWater;
  step(G.room, p, pi, ab, DT, ev);
  if (!wasGround && p.onGround) burst(p.x + 5, p.y + p.h, 'rgba(220,210,190,.8)', 3, 30);
  if (inp.jumpP) { if (wasGround && !p.onGround) sfx.jump(); else if (!wasDouble && p.doubleUsed) { sfx.djump(); burst(p.x + 5, p.y + p.h, '#ffffff', 6, 60); } }
  if (p.inWater !== wasIn) sfx.splash();
  let changed = false;
  for (const e of ev) {
    if (e.type === 'break') { markBroken(e.c, e.r); changed = true; burst(e.c * T + 8, e.r * T + 8, '#d8cfb8', 5, 80); }
    else if (e.type === 'dash') sfx.dash();
    else if (e.type === 'pound') sfx.pound();
    else if (e.type === 'slam') helper.shake(3);
  }
  if (changed) { sfx.break(); retile(); writeSave(S); }
  if (ev.some((e) => e.type === 'spike' || e.type === 'choke')) {
    if (hurt(1, false) && scene === 'play') { p.x = G.safe.x; p.y = G.safe.y; p.vx = 0; p.vy = 0; p.dashT = 0; p.pounding = false; }
    if (ev.some((e) => e.type === 'choke')) toast('숨이 막힌다! 깊은 물은 아직 못 들어간다', 2.2);
  } else if (p.onGround && !p.inWater && !p.pounding) {
    const c = Math.floor((p.x + p.w / 2) / T), r = Math.round((p.y + p.h) / T);
    const t = tileAt(G.room, c, r);
    if (isSolid(t) && t !== TILE.FLOORCRACK) G.safe = { x: p.x, y: p.y };
  }
  if (G.wind) { const nx = p.x + G.wind * DT; const c = Math.floor((G.wind > 0 ? nx + p.w : nx) / T); let free = true; for (let r = Math.floor(p.y / T); r <= Math.floor((p.y + p.h - 1) / T); r++) if (isSolid(tileAt(G.room, c, r))) free = false; if (free) p.x = nx; }
  G.wind = 0;

  // 쏘기
  if (G.cd > 0) G.cd -= DT;
  if (inp.shootP && G.cd <= 0 && G.shots.length < 3 && !p.inWater) {
    G.cd = 0.16;
    const fire = !!ab.fire;
    const up = inp.up && !inp.left && !inp.right;
    const sx = p.x + p.w / 2, sy = p.y + 9;
    G.shots.push({ x: sx, y: sy, vx: up ? 0 : p.facing * 330, vy: up ? -330 : 0, life: 0.75, dmg: 1 + S.shot * 0.5, fire });
    fire ? sfx.fire() : sfx.shoot();
  }
  for (const s of G.shots) {
    s.x += s.vx * DT; s.y += s.vy * DT; s.life -= DT;
    const c = Math.floor(s.x / T), r = Math.floor(s.y / T);
    const t = tileAt(G.room, c, r);
    if (isSolid(t)) {
      s.life = 0;
      if (t === TILE.ICE && s.fire) { const evs = []; breakFlood(G.room, c, r, TILE.ICE, evs); for (const e of evs) markBroken(e.c, e.r); retile(); sfx.break(); burst(s.x, s.y, '#bfefff', 12, 100); writeSave(S); }
      else burst(s.x, s.y, s.fire ? '#ffb070' : '#fff6c0', 3, 40);
    }
    if (s.x < -8 || s.x > W + 8 || s.y < -8 || s.y > H + 8) s.life = 0;
  }
  // 적
  for (const e of G.enemies) {
    updateEnemy(e, DT, helper);
    for (const s of G.shots) if (s.life > 0 && s.x > e.x - 2 && s.x < e.x + e.w + 2 && s.y > e.y - 2 && s.y < e.y + e.h + 2) {
      s.life = 0; e.hp -= s.dmg; e.flash = 0.1; sfx.enemy();
      if (e.hp <= 0) { e.dead = true; burst(e.x + e.w / 2, e.y + e.h / 2, ZONES[def.zone].color, 10); if (rnd() < 0.3) G.items.push({ id: 'orb', kind: 'orb', c: Math.floor((e.x + e.w / 2) / T), r: Math.min(13, Math.floor((e.y + e.h / 2) / T)), t: 6 }); }
    }
    if (!e.dead && rectsOverlap(e, p)) hurt(1);
  }
  G.enemies = G.enemies.filter((e) => !e.dead);
  // 보스
  const b = G.boss;
  if (b && !b.dead) {
    if (!G.locked && p.x > 3 * T && p.x < W - 4 * T && p.y > 2 * T) lockDoors(true);
    if (G.locked) {
      updateBoss(b, DT, helper);
      for (const s of G.shots) if (s.life > 0 && b.vulnerable && s.x > b.x && s.x < b.x + b.w && s.y > b.y && s.y < b.y + b.h) {
        s.life = 0; b.hp -= s.dmg; b.flash = 0.08; sfx.bossHit();
        if (b.hp <= 0) bossDown(b);
      }
      if (!b.dead && b.vulnerable !== false && b.state !== 'warn' && rectsOverlap({ x: b.x + 4, y: b.y + 4, w: b.w - 8, h: b.h - 8 }, p)) hurt(2);
    }
  }
  G.shots = G.shots.filter((s) => s.life > 0);
  for (const s of G.eshots) {
    s.x += s.vx * DT; s.y += s.vy * DT; s.life -= DT;
    if (!s.ground && isSolid(tileAt(G.room, Math.floor(s.x / T), Math.floor(s.y / T)))) s.life = 0;
    if (s.x < 0 || s.x > W || s.y < 0 || s.y > H) s.life = 0;
    if (s.life > 0 && Math.abs(s.x - (p.x + p.w / 2)) < s.r + 4 && Math.abs(s.y - (p.y + p.h / 2)) < s.r + 9) { s.life = 0; hurt(1); }
  }
  G.eshots = G.eshots.filter((s) => s.life > 0);
  // 물건
  const pr = { x: p.x, y: p.y, w: p.w, h: p.h };
  for (const it of G.items) {
    if (it.kind === 'orb') { it.t -= DT; if (it.t <= 0) it.gone = true; }
    if (!it.gone && rectsOverlap(pickRect(it), pr)) {
      it.gone = true;
      if (it.kind === 'orb') { G.hp = Math.min(S.maxHp, G.hp + 1); sfx.pick(); }
      else pickup(it);
    }
  }
  G.items = G.items.filter((i) => !i.gone);
  // 저장 돌
  if (def.save) {
    const sr = { x: def.save.c * T - 4, y: def.save.r * T - 8, w: 24, h: 24 };
    const on = rectsOverlap(sr, pr);
    if (on && !G.savedHere) { G.savedHere = true; S.saveRoom = def.id; G.hp = S.maxHp; writeSave(S); sfx.save(); toast('별돌에 기록했다 · 체력 회복'); burst(def.save.c * T + 8, def.save.r * T, '#9ff0ff', 14, 70); }
    if (!on && G.savedHere && Math.abs(p.x - def.save.c * T) > 48) G.savedHere = false;
  }
  for (const f of G.fx) { f.x += f.vx * DT; f.y += f.vy * DT; f.vy += 200 * DT; f.life -= DT; }
  G.fx = G.fx.filter((f) => f.life > 0);
  // 방 넘기기
  const side = exitSide(p);
  if (side && scene === 'play') {
    if (def.doors[side]) {
      sfx.door();
      const keep = { p, hp: G.hp, inv: G.inv };
      loadRoom(neighborId(def, side), OPP[side], keep);
    } else { p.x = Math.max(0, Math.min(W - p.w, p.x)); p.y = Math.max(0, Math.min(H - p.h, p.y)); }
  }
}

function lockDoors(on) {
  if (on) {
    G.locked = [];
    for (const side of Object.keys(G.def.doors)) for (const [c, r] of doorCells(G.def, side)) {
      G.locked.push([c, r, G.room.tiles[r * COLS + c]]);
      if (!isSolid(G.room.tiles[r * COLS + c]) || side !== 'B') G.room.tiles[r * COLS + c] = TILE.BOSSDOOR;
    }
    retile(); sfx.boss(); G.bossIntro = 2;
  } else if (G.locked) {
    for (const [c, r, t] of G.locked) G.room.tiles[r * COLS + c] = t;
    G.locked = 'done';
    retile();
  }
}
function bossDown(b) {
  b.dead = true;
  S.bosses.push(b.id);
  burst(b.x + b.w / 2, b.y + b.h / 2, b.color, 40, 160);
  helper.shake(8); sfx.big();
  G.eshots = [];
  G.enemies = [];
  lockDoors(false);
  // 보스가 막고 있던 먼 문도 이제 열림
  G.room.tiles = buildTiles(G.def, { bossDone: (x) => S.bosses.includes(x), key: S.key, broken: new Set(S.broken[G.def.id] || []) });
  retile();
  addReward(G.def, G.items);
  writeSave(S);
  toast(`${b.name} 을(를) 물리쳤다!`, 3);
}

// ── 그리기 ─────────────────────────────────────
function draw() {
  ctx.save();
  if (!G) { ctx.fillStyle = '#0b0a12'; ctx.fillRect(0, 0, W, H); ctx.restore(); return; }
  const sh = G.shake || 0;
  ctx.translate(Math.round((rnd() - 0.5) * sh), Math.round((rnd() - 0.5) * sh));
  const def = G.def;
  drawBackground(ctx, def.zone, clock, def.x * 13 + def.y * 7);
  ctx.drawImage(G.tilesCv, 0, 0);
  if (def.save) drawSave(ctx, def.save, clock, G.savedHere || S.saveRoom === def.id);
  for (const it of G.items) drawItem(ctx, it, clock, it.kind === 'ability' ? ABIL[it.id].color : it.kind === 'key' ? KEY_ITEM.color : it.kind === 'heart' ? '#ffd86b' : null);
  for (const e of G.enemies) drawEnemy(ctx, e, clock, def.zone);
  if (G.boss && !G.boss.dead && G.locked) drawBoss(ctx, G.boss, clock);
  drawPlayer(ctx, G.p, clock, nAb(), G.inv);
  for (const s of G.shots) { ctx.fillStyle = s.fire ? '#ff9a4a' : '#fff3a0'; ctx.fillRect(s.x - 3, s.y - 2, 6, 4); ctx.fillStyle = '#fff'; ctx.fillRect(s.x - 1, s.y - 1, 2, 2); }
  for (const s of G.eshots) { ctx.fillStyle = s.fire ? '#ff7a3a' : s.star ? '#ffd86b' : s.leaf ? '#cfeee6' : '#ff5d8a'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill(); }
  drawWater(ctx, G.room.tiles, clock);
  for (const f of G.fx) { ctx.globalAlpha = Math.min(1, f.life * 2); ctx.fillStyle = f.color; ctx.fillRect(f.x - 1, f.y - 1, 3, 3); }
  ctx.globalAlpha = 1;
  ctx.restore();
  drawHud();
  if (G.fade > 0) { ctx.fillStyle = `rgba(8,6,14,${Math.min(1, G.fade * 4)})`; ctx.fillRect(0, 0, W, H); }
  if (scene === 'map') drawMap();
  if (scene === 'msg') drawMsg();
  if (scene === 'dead') { ctx.fillStyle = `rgba(20,0,10,${Math.min(0.8, (1.6 - G.deadT))})`; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#fff'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('모아가 쓰러졌다…', W / 2, H / 2); ctx.font = '12px sans-serif'; ctx.fillText('마지막 별돌에서 다시', W / 2, H / 2 + 20); ctx.textAlign = 'left'; }
}

function drawHud() {
  ctx.save();
  for (let i = 0; i < S.maxHp; i++) {
    const x = 8 + (i % 12) * 11, y = 7 + Math.floor(i / 12) * 10;
    ctx.fillStyle = i < G.hp ? '#ff5d7a' : 'rgba(255,255,255,.18)';
    ctx.beginPath(); ctx.arc(x + 2, y + 2, 2.6, 0, 7); ctx.arc(x + 6, y + 2, 2.6, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 0.6, y + 3); ctx.lineTo(x + 4, y + 8); ctx.lineTo(x + 8.6, y + 3); ctx.fill();
  }
  ctx.font = '10px sans-serif'; ctx.fillStyle = '#fff3a0';
  ctx.fillText(`별빛 ${S.shot + 1}`, 8, S.maxHp > 12 ? 34 : 26);
  let x = 52;
  const ay = S.maxHp > 12 ? 30 : 22;
  for (const a of ABILITIES) { if (!S.ab[a.id]) continue; ctx.fillStyle = a.color; ctx.beginPath(); ctx.arc(x, ay, 3.5, 0, 7); ctx.fill(); x += 10; }
  if (S.key) { ctx.fillStyle = KEY_ITEM.color; ctx.fillRect(x - 3, ay - 4, 6, 8); }
  if (G.banner > 0) {
    ctx.globalAlpha = Math.min(1, G.banner);
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(W / 2 - 90, 30, 180, 26);
    ctx.fillStyle = ZONES[G.def.zone].color; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(ZONES[G.def.zone].name, W / 2, 48);
    ctx.globalAlpha = 1;
  }
  if (G.toast) { ctx.globalAlpha = Math.min(1, G.toast.t * 2); ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; const w = ctx.measureText(G.toast.text).width + 20; ctx.fillRect(W / 2 - w / 2, H - 46, w, 22); ctx.fillStyle = '#fff'; ctx.fillText(G.toast.text, W / 2, H - 31); ctx.globalAlpha = 1; }
  const b = G.boss;
  if (b && !b.dead && G.locked) {
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(60, H - 18, W - 120, 12);
    ctx.fillStyle = b.color; ctx.fillRect(62, H - 16, (W - 124) * Math.max(0, b.hp / b.max), 8);
    ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeText(b.name, W / 2, H - 23); ctx.fillStyle = '#fff'; ctx.fillText(b.name, W / 2, H - 23);
  }
  ctx.textAlign = 'left';
  ctx.restore();
}

const GATE_COLOR = { w: '#8fd16a', d: '#ffffff', a: '#e6f2ff', s: '#7fd8ff', p: '#c9c9d6', f: '#ff9a4a', b: '#e0466a', k: '#ffd86b' };
function drawMap() {
  ctx.save();
  ctx.fillStyle = 'rgba(6,5,12,.92)'; ctx.fillRect(0, 0, W, H);
  const cw = 34, ch = 22, ox = Math.round((W - MAP_W * cw) / 2), oy = 34;
  ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
  ctx.fillText('별우물 지도', W / 2, 20);
  const vis = new Set(S.visited);
  for (const r of ROOMS) {
    if (!vis.has(r.id)) continue;
    const x = ox + r.x * cw, y = oy + r.y * ch;
    const z = ZONES[r.zone];
    ctx.fillStyle = z.dark; ctx.fillRect(x + 2, y + 2, cw - 4, ch - 4);
    ctx.strokeStyle = z.color; ctx.lineWidth = 1.5; ctx.strokeRect(x + 2.5, y + 2.5, cw - 5, ch - 5);
    for (const [side, d] of Object.entries(r.doors)) {
      ctx.fillStyle = d.type === '-' ? z.color : GATE_COLOR[d.type] || '#fff';
      if (side === 'L') ctx.fillRect(x, y + ch / 2 - 3, 4, 6);
      if (side === 'R') ctx.fillRect(x + cw - 4, y + ch / 2 - 3, 4, 6);
      if (side === 'T') ctx.fillRect(x + cw / 2 - 3, y, 6, 4);
      if (side === 'B') ctx.fillRect(x + cw / 2 - 3, y + ch - 4, 6, 4);
    }
    if (r.save) { ctx.fillStyle = '#9ff0ff'; ctx.fillRect(x + 6, y + 7, 5, 8); }
    if (r.boss) { ctx.fillStyle = S.bosses.includes(r.boss) ? '#666' : '#e0466a'; ctx.beginPath(); ctx.arc(x + cw / 2, y + ch / 2, 4, 0, 7); ctx.fill(); }
    if (r.items.some((i) => !S.got.includes(i.id))) { ctx.fillStyle = '#ffe36b'; ctx.fillRect(x + cw - 11, y + 7, 4, 4); }
    if (r.id === G.def.id && Math.floor(clock * 3) % 2 === 0) { ctx.fillStyle = '#fff'; ctx.fillRect(x + cw / 2 - 2, y + ch / 2 - 2, 5, 5); }
  }
  const hp = S.got.filter((g) => g.startsWith('hp:')).length, sh = S.got.filter((g) => g.startsWith('shot:')).length;
  const pct = Math.round((100 * (S.visited.length + hp + sh)) / (ROOMS.length + HP_TOTAL + SHOT_TOTAL));
  ctx.font = '11px sans-serif'; ctx.fillStyle = '#ddd';
  ctx.fillText(`방 ${S.visited.length}/${ROOMS.length} · 체력 조각 ${hp}/${HP_TOTAL} · 탄 강화 ${sh}/${SHOT_TOTAL} · 수집 ${pct}%`, W / 2, H - 22);
  ctx.fillText(`지금: ${ZONES[G.def.zone].name} · 시간 ${fmtTime(S.time)}`, W / 2, H - 8);
  ctx.textAlign = 'left';
  ctx.restore();
}
function drawMsg() {
  const m = G.msg;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#17142a'; ctx.fillRect(50, 80, W - 100, 100); ctx.strokeStyle = m.color; ctx.lineWidth = 2; ctx.strokeRect(51, 81, W - 102, 98);
  ctx.textAlign = 'center'; ctx.fillStyle = m.color; ctx.font = 'bold 16px sans-serif'; ctx.fillText(m.title, W / 2, 112);
  ctx.fillStyle = '#eee'; ctx.font = '12px sans-serif'; ctx.fillText(m.desc, W / 2, 138);
  if (m.t > 0.5) { ctx.fillStyle = '#aaa'; ctx.font = '11px sans-serif'; ctx.fillText('점프·쏘기 단추로 계속', W / 2, 165); }
  ctx.restore();
}
const fmtTime = (s) => `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// ── 장면 고리 ───────────────────────────────────
function tick() {
  const inp = input.poll();
  clock += DT;
  if (scene === 'play') {
    if (inp.pauseP) { openPause(); return; }
    if (inp.mapP) { scene = 'map'; return; }
    stepPlay(inp);
  } else if (scene === 'map') {
    if (inp.mapP || inp.pauseP || inp.jumpP || inp.shootP) scene = 'play';
  } else if (scene === 'msg') {
    G.msg.t += DT;
    if (G.msg.t > 0.5 && (inp.jumpP || inp.shootP || inp.confirmP)) { scene = 'play'; G.p.buf = 0; }
  } else if (scene === 'dead') {
    G.deadT -= DT;
    if (G.deadT <= 0) respawnAtSave(true);
  } else if (scene === 'pause') {
    if (inp.pauseP) closePause();
  }
}

let acc = 0, last = 0;
function frame(ts) {
  const dt = Math.min(0.1, (ts - last) / 1000 || 0);
  last = ts;
  acc += dt;
  let n = 0;
  while (acc >= DT && n < 6) { tick(); acc -= DT; n++; }
  if (n === 6) acc = 0;
  draw();
  requestAnimationFrame(frame);
}

// ── 메뉴(HTML) ─────────────────────────────────
function show(id, on) { $(id).hidden = !on; }
function refreshTitle() {
  const s = loadSave();
  $('btn-continue').hidden = !s;
  $('save-info').textContent = s ? `저장: ${ZONES[ROOM_BY_ID.get(s.saveRoom).zone].name} · 방 ${s.visited.length}/${ROOMS.length} · ${fmtTime(s.time)}${s.cleared ? ' · 엔딩 봄' : ''}` : '';
}
function startGame(fresh) {
  unlock();
  S = fresh ? newSave() : (loadSave() || newSave());
  if (fresh) writeSave(S);
  G = null;
  loadRoom(S.saveRoom, 'S');
  if (fresh) toast(document.body.classList.contains('touch') ? '◀ ▶ 이동 · 점프 · 쏘기 — 막힌 길은 능력을 얻은 뒤에' : '← → 이동 · Z 점프 · X 쏘기 · M 지도', 5);
  scene = 'play';
  for (const id of ['title', 'pause', 'ending', 'help']) show(id, false);
  document.body.classList.add('playing');
  cv.focus && cv.focus();
}
function openPause() { scene = 'pause'; show('pause', true); $('btn-sound').textContent = `소리: ${opts.sound ? '켬' : '끔'}`; }
function closePause() { scene = 'play'; show('pause', false); show('help', false); }
function toTitle() { scene = 'title'; for (const id of ['pause', 'ending', 'help']) show(id, false); show('title', true); document.body.classList.remove('playing'); refreshTitle(); }
function showEnding() {
  scene = 'ending';
  const hp = S.got.filter((g) => g.startsWith('hp:')).length, sh = S.got.filter((g) => g.startsWith('shot:')).length;
  $('ending-stats').textContent = `걸린 시간 ${fmtTime(S.time)} · 쓰러짐 ${S.deaths}번 · 방 ${S.visited.length}/${ROOMS.length} · 체력 조각 ${hp}/${HP_TOTAL} · 탄 강화 ${sh}/${SHOT_TOTAL}`;
  show('ending', true);
  document.body.classList.remove('playing');
}

$('btn-new').addEventListener('click', () => {
  if (loadSave() && !confirm('저장된 여행을 지우고 새로 시작할까요?')) return;
  clearSave(); startGame(true);
});
$('btn-continue').addEventListener('click', () => startGame(false));
for (const b of document.querySelectorAll('[data-help]')) b.addEventListener('click', () => show('help', true));
$('btn-help-close').addEventListener('click', () => show('help', false));
$('btn-resume').addEventListener('click', closePause);
$('btn-map').addEventListener('click', () => { closePause(); scene = 'map'; });
$('btn-warp').addEventListener('click', () => { show('pause', false); respawnAtSave(false); });
$('btn-sound').addEventListener('click', () => { opts.sound = !opts.sound; setSound(opts.sound); writeOptions(opts); $('btn-sound').textContent = `소리: ${opts.sound ? '켬' : '끔'}`; });
$('btn-title').addEventListener('click', toTitle);
$('btn-end-title').addEventListener('click', toTitle);
$('btn-pause-touch').addEventListener('click', () => { if (scene === 'play') openPause(); else if (scene === 'pause') closePause(); });
$('btn-map-touch').addEventListener('click', () => { if (scene === 'play') scene = 'map'; else if (scene === 'map') scene = 'play'; });
window.addEventListener('pointerdown', unlock, { once: true });
window.addEventListener('keydown', unlock, { once: true });
if (params.has('touch') || matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');
refreshTitle();

// ── 시험용 손잡이 ───────────────────────────────
window.__STARWELL__ = {
  get scene() { return scene; },
  get room() { return G && G.def.id; },
  state: () => JSON.parse(JSON.stringify(S)),
  peek: () => G && { x: G.p.x, y: G.p.y, vx: G.p.vx, vy: G.p.vy, onGround: G.p.onGround, hp: G.hp, room: G.def.id, boss: G.boss && { hp: G.boss.hp, dead: G.boss.dead, locked: !!G.locked } },
  game: () => G,
  start: (fresh = true) => startGame(fresh),
  advance(n = 1) { for (let i = 0; i < n; i++) tick(); draw(); },
  teleport(id, side = 'S') { loadRoom(id, side); scene = 'play'; },
  give(...ids) { for (const id of ids) { if (id === 'key') S.key = true; else S.ab[id] = true; } writeSave(S); },
  input,
};
if (MANUAL) draw(); else requestAnimationFrame(frame);
