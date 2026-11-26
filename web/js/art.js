// 그림: 모두 Canvas 2D 코드로 그린다(그림 파일 없음).
import { T, COLS, ROWS, W, H, TILE } from './physics.js';
import { ZONES } from './worldspec.js';

const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

export function drawBackground(ctx, zone, t, rid) {
  const z = ZONES[zone];
  const gr = ctx.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, z.bg[0]); gr.addColorStop(1, z.bg[1]);
  ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = z.color;
  for (let i = 0; i < 14; i++) {
    const x = hash(i, rid) * W, y = hash(rid, i + 9) * H, s = 6 + hash(i, i + rid) * 22;
    if (zone === 1) { ctx.fillRect(x, 0, 2 + s / 8, y); } // 뿌리
    else if (zone === 2) { ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s / 3, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s / 3, y); ctx.fill(); } // 수정
    else if (zone === 3) { ctx.beginPath(); ctx.arc(x, (y - t * 12 * (1 + (i % 3))) % H + (y < 0 ? H : 0), s / 6, 0, 7); ctx.fill(); } // 거품
    else if (zone === 4) { ctx.fillRect(x, (y - t * 20 * (1 + (i % 2)) + H * 4) % H, 2, 2); ctx.fillRect(x - 20, y, s * 2, 3); } // 불씨·관
    else if (zone === 5) { ctx.fillRect((x + t * 40 * (1 + (i % 3))) % (W + 60) - 60, y, s * 2, 1); } // 바람줄
    else { ctx.globalAlpha = 0.25 + 0.2 * Math.sin(t * 2 + i); ctx.fillRect(x, y, 2, 2); ctx.globalAlpha = 0.18; } // 별
  }
  ctx.restore();
}

export function renderTiles(def, tiles) {
  const cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(W, H) : Object.assign(document.createElement('canvas'), { width: W, height: H });
  const ctx = cv.getContext('2d');
  const z = ZONES[def.zone];
  const at = (c, r) => (c < 0 || c >= COLS || r < 0 || r >= ROWS ? TILE.ROCK : tiles[r * COLS + c]);
  const rocky = (t) => t === TILE.ROCK || t === TILE.FAKE || t === TILE.SMOOTH || t === TILE.CRACK || t === TILE.FLOORCRACK;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const t = at(c, r); const x = c * T, y = r * T;
    if (t === TILE.ROCK || t === TILE.FAKE || t === TILE.CRACK || t === TILE.FLOORCRACK) {
      ctx.fillStyle = z.rock; ctx.fillRect(x, y, T, T);
      ctx.fillStyle = z.rock2;
      for (let i = 0; i < 3; i++) { const h = hash(c * 3 + i, r + def.x * 7); ctx.fillRect(x + Math.floor(h * 13), y + Math.floor(hash(r * 5 + i, c) * 13), 3, 2); }
      if (!rocky(at(c, r - 1)) && at(c, r - 1) !== TILE.ICE) { ctx.fillStyle = z.color; ctx.fillRect(x, y, T, 3); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x, y + 3, T, 1); }
      if (t === TILE.FAKE) { ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.fillRect(x + 5, y + 5, 6, 6); }
      if (t === TILE.CRACK) { ctx.strokeStyle = '#e9e2c8'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + 3, y + 2); ctx.lineTo(x + 8, y + 7); ctx.lineTo(x + 5, y + 11); ctx.lineTo(x + 11, y + 15); ctx.moveTo(x + 8, y + 7); ctx.lineTo(x + 14, y + 5); ctx.stroke(); }
      if (t === TILE.FLOORCRACK) { ctx.fillStyle = '#2a2a33'; ctx.fillRect(x, y, T, T); ctx.strokeStyle = '#c9c9d6'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + 1, y + 4); ctx.lineTo(x + 6, y + 9); ctx.lineTo(x + 10, y + 3); ctx.lineTo(x + 15, y + 10); ctx.stroke(); }
    } else if (t === TILE.SMOOTH) {
      ctx.fillStyle = z.dark; ctx.fillRect(x, y, T, T);
      ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(x + 2, y + 2, T - 4, 2); ctx.fillRect(x + 2, y + 2, 2, T - 6);
      ctx.strokeStyle = z.rock2; ctx.strokeRect(x + 0.5, y + 0.5, T - 1, T - 1);
    } else if (t === TILE.PLAT) {
      ctx.fillStyle = z.rock2; ctx.fillRect(x, y, T, 4); ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(x, y + 4, T, 2);
      ctx.fillStyle = z.color; ctx.fillRect(x + 1, y, T - 2, 1);
    } else if (t === TILE.SPIKE) {
      ctx.fillStyle = '#d9d2c4';
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x + i * 4, y + T); ctx.lineTo(x + i * 4 + 2, y + 5); ctx.lineTo(x + i * 4 + 4, y + T); ctx.fill(); }
    } else if (t === TILE.ICE) {
      ctx.fillStyle = 'rgba(170,230,255,.85)'; ctx.fillRect(x, y, T, T);
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(x + 3, y + 3, 3, 8); ctx.strokeStyle = '#5fb6dd'; ctx.strokeRect(x + 0.5, y + 0.5, T - 1, T - 1);
    } else if (t === TILE.BOSSDOOR) {
      ctx.fillStyle = '#3a1020'; ctx.fillRect(x, y, T, T); ctx.fillStyle = '#e0466a'; ctx.fillRect(x + 6, y, 4, T); ctx.fillRect(x, y + 6, T, 2);
    } else if (t === TILE.KEYDOOR) {
      ctx.fillStyle = '#3d3010'; ctx.fillRect(x, y, T, T); ctx.fillStyle = '#ffd86b'; ctx.fillRect(x + 5, y, 6, T);
      ctx.beginPath(); ctx.arc(x + 8, y + 8, 3, 0, 7); ctx.fillStyle = '#fff4c2'; ctx.fill();
    }
  }
  return cv;
}

export function drawWater(ctx, tiles, t) {
  ctx.save();
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (tiles[r * COLS + c] !== TILE.WATER) continue;
    const top = r === 0 || tiles[(r - 1) * COLS + c] !== TILE.WATER;
    ctx.fillStyle = 'rgba(60,150,220,.42)'; ctx.fillRect(c * T, r * T, T, T);
    if (top) { ctx.fillStyle = 'rgba(190,235,255,.7)'; ctx.fillRect(c * T, r * T + 1 + Math.sin(t * 3 + c) * 1, T, 2); }
  }
  ctx.restore();
}

// 주인공 '모아': 흙으로 빚은 꼬마. 머리에 새싹, 목도리 색은 가진 능력 수에 따라 바뀐다.
export function drawPlayer(ctx, p, t, nAb, inv) {
  if (inv > 0 && Math.floor(t * 20) % 2) return;
  const x = Math.round(p.x), y = Math.round(p.y);
  const f = p.facing;
  ctx.save();
  ctx.translate(x + p.w / 2, y);
  if (f < 0) ctx.scale(-1, 1);
  const run = p.onGround && Math.abs(p.vx) > 10 ? Math.sin(t * 18) : 0;
  const squash = p.onGround ? 0 : p.vy < 0 ? -1 : 1;
  // 다리
  ctx.fillStyle = '#8a5a3a';
  ctx.fillRect(-4, 17, 3, 5 - (run > 0 ? 1 : 0)); ctx.fillRect(1, 17, 3, 5 - (run < 0 ? 1 : 0));
  // 몸
  ctx.fillStyle = '#c98a5a'; ctx.fillRect(-5, 9 + squash * 0.5, 10, 9);
  const scarf = ['#b8b0a0', '#8fd16a', '#e6f2ff', '#ffffff', '#7fd8ff', '#c9c9d6', '#ff9a4a'][Math.min(6, nAb)];
  ctx.fillStyle = scarf; ctx.fillRect(-5, 9, 10, 2); ctx.fillRect(-8 - (p.dashT > 0 ? 4 : 0), 9 + Math.sin(t * 9) * 1, 4 + (p.dashT > 0 ? 4 : 0), 2);
  // 머리
  ctx.fillStyle = '#d99a68'; ctx.beginPath(); ctx.arc(0, 5, 6, 0, 7); ctx.fill();
  ctx.fillStyle = '#2a1a10'; ctx.fillRect(1, 3, 2, 3); ctx.fillRect(-2, 3, 1, 3);
  // 새싹
  ctx.fillStyle = '#7fd36a'; ctx.beginPath(); ctx.ellipse(2, -2, 3, 1.6, -0.5, 0, 7); ctx.fill(); ctx.fillRect(0, -2, 1, 3);
  if (p.cling) { ctx.fillStyle = '#8fd16a'; ctx.fillRect(4, 10, 3, 3); }
  if (p.inWater) { ctx.strokeStyle = 'rgba(200,240,255,.7)'; ctx.beginPath(); ctx.arc(0, 5, 8, 0, 7); ctx.stroke(); }
  ctx.restore();
}

export function drawEnemy(ctx, e, t, zone) {
  const z = ZONES[zone];
  ctx.save();
  ctx.translate(Math.round(e.x), Math.round(e.y));
  const fl = e.flash > 0;
  if (e.type === 'crawler') {
    ctx.fillStyle = fl ? '#fff' : z.dark; ctx.beginPath(); ctx.ellipse(7, 7, 7, 6, 0, Math.PI, 0); ctx.fill(); ctx.fillRect(0, 6, 14, 5);
    ctx.fillStyle = fl ? '#fff' : z.color; for (let i = 0; i < 3; i++) ctx.fillRect(2 + i * 4, 2 - (i === 1 ? 2 : 0), 2, 3);
    ctx.fillStyle = '#ffe6a0'; ctx.fillRect(e.vx > 0 ? 10 : 2, 6, 2, 2);
    ctx.fillStyle = '#000'; const k = Math.floor(t * 10) % 2; ctx.fillRect(1 + k, 11, 2, 1); ctx.fillRect(10 - k, 11, 2, 1);
  } else if (e.type === 'flyer') {
    ctx.fillStyle = fl ? '#fff' : z.color; ctx.beginPath(); ctx.arc(6, 6, 5, 0, 7); ctx.fill();
    const wv = Math.sin(t * 20) * 4;
    ctx.fillStyle = fl ? '#fff' : z.dark; ctx.beginPath(); ctx.moveTo(1, 6); ctx.lineTo(-5, 2 + wv); ctx.lineTo(1, 9); ctx.moveTo(11, 6); ctx.lineTo(17, 2 + wv); ctx.lineTo(11, 9); ctx.fill();
    ctx.fillStyle = '#ff4b6a'; ctx.fillRect(4, 5, 2, 2); ctx.fillRect(7, 5, 2, 2);
  } else {
    ctx.fillStyle = fl ? '#fff' : z.dark; ctx.fillRect(1, 4, 12, 10);
    ctx.fillStyle = fl ? '#fff' : z.color; ctx.beginPath(); ctx.arc(7, 5, 5, Math.PI, 0); ctx.fill();
    ctx.fillStyle = e.cd < 0.4 ? '#ffec6b' : '#401010'; ctx.fillRect(5, 6, 4, 3);
  }
  ctx.restore();
}

export function drawBoss(ctx, b, t) {
  ctx.save();
  const fl = b.flash > 0;
  const c = fl ? '#ffffff' : b.color;
  const x = Math.round(b.x), y = Math.round(b.y);
  ctx.translate(x, y);
  if (b.id === 1) { // 두꺼비
    ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(23, 22, 23, 14, 0, Math.PI, 0); ctx.fill(); ctx.fillRect(0, 21, 46, 13);
    ctx.fillStyle = '#3c5a20'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(4 + i * 7, 12); ctx.lineTo(7 + i * 7, 2 + (i % 2) * 3); ctx.lineTo(10 + i * 7, 12); ctx.fill(); }
    ctx.fillStyle = '#ffe38a'; ctx.beginPath(); ctx.arc(12, 16, 4, 0, 7); ctx.arc(34, 16, 4, 0, 7); ctx.fill();
    ctx.fillStyle = '#000'; ctx.fillRect(11, 15, 2, 3); ctx.fillRect(33, 15, 2, 3);
    ctx.fillStyle = '#e0b07a'; ctx.fillRect(10, 27, 26, 3);
  } else if (b.id === 2) { // 박쥐 여왕
    const wv = Math.sin(t * 14) * 7;
    ctx.fillStyle = fl ? '#fff' : '#5c3fa0';
    ctx.beginPath(); ctx.moveTo(14, 12); ctx.lineTo(-14, 2 + wv); ctx.lineTo(-6, 14); ctx.lineTo(-14, 22 + wv / 2); ctx.lineTo(14, 18); ctx.fill();
    ctx.beginPath(); ctx.moveTo(26, 12); ctx.lineTo(54, 2 + wv); ctx.lineTo(46, 14); ctx.lineTo(54, 22 + wv / 2); ctx.lineTo(26, 18); ctx.fill();
    ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(20, 14, 12, 11, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#e8ddff'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(12 + i * 6, 4); ctx.lineTo(15 + i * 6, -6); ctx.lineTo(18 + i * 6, 4); ctx.fill(); }
    ctx.fillStyle = '#ff4b8a'; ctx.fillRect(14, 11, 3, 3); ctx.fillRect(23, 11, 3, 3);
  } else if (b.id === 3) { // 물뱀
    if (b.state === 'warn') { ctx.restore(); ctx.save(); ctx.fillStyle = 'rgba(160,220,255,.7)'; for (let i = 0; i < 5; i++) ctx.fillRect(b.x - 6 + i * 9, 236 - Math.abs(Math.sin(t * 10 + i)) * 6, 4, 4); ctx.restore(); return; }
    ctx.fillStyle = c; for (let i = 0; i < 6; i++) ctx.fillRect(5 + Math.sin(t * 4 + i) * 4, 14 + i * 10, 20, 11);
    ctx.beginPath(); ctx.ellipse(15, 10, 15, 11, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#d8f6ff'; ctx.fillRect(5, 14, 20, 3);
    ctx.fillStyle = '#ffd34a'; ctx.fillRect(6, 6, 5, 4); ctx.fillRect(19, 6, 5, 4); ctx.fillStyle = '#000'; ctx.fillRect(8, 6, 2, 4); ctx.fillRect(21, 6, 2, 4);
  } else if (b.id === 4) { // 풀무 거인
    ctx.fillStyle = fl ? '#fff' : '#4a2a1c'; ctx.fillRect(4, 14, 44, 32); ctx.fillRect(8, 46, 12, 8); ctx.fillRect(32, 46, 12, 8);
    ctx.fillStyle = c; ctx.fillRect(12, 0, 28, 18);
    ctx.fillStyle = b.state === 'fire' || b.state === 'wind' ? '#fff2a0' : '#ffb24a'; ctx.fillRect(16, 22, 20, 14);
    ctx.fillStyle = '#000'; ctx.fillRect(17, 6, 6, 4); ctx.fillRect(29, 6, 6, 4);
    ctx.fillStyle = '#8a4d31'; ctx.fillRect(-4, 18, 8, 22); ctx.fillRect(48, 18, 8, 22);
  } else if (b.id === 5) { // 회오리매
    const wv = Math.sin(t * 9) * 6;
    ctx.fillStyle = fl ? '#fff' : '#7fa8a2';
    ctx.beginPath(); ctx.moveTo(16, 12); ctx.lineTo(-18, 4 + wv); ctx.lineTo(16, 20); ctx.fill(); ctx.beginPath(); ctx.moveTo(28, 12); ctx.lineTo(62, 4 + wv); ctx.lineTo(28, 20); ctx.fill();
    ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(22, 14, 13, 12, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffcf4a'; ctx.beginPath(); ctx.moveTo(22, 16); ctx.lineTo(30, 19); ctx.lineTo(22, 22); ctx.fill();
    ctx.fillStyle = '#000'; ctx.fillRect(17, 10, 3, 3); ctx.fillRect(25, 10, 3, 3);
  } else { // 검은 별 그림자
    ctx.translate(22, 22);
    ctx.rotate(t * 0.8);
    ctx.fillStyle = fl ? '#fff' : '#120f1e';
    ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 11 : 24; const a = (i * Math.PI) / 5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill();
    ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.stroke();
    ctx.rotate(-t * 0.8);
    ctx.fillStyle = b.phase === 3 ? '#ff6b8a' : '#ffd86b'; ctx.beginPath(); ctx.arc(0, 0, 5 + Math.sin(t * 6), 0, 7); ctx.fill();
  }
  ctx.restore();
  if (b.id === 6 && b.beam) {
    ctx.save();
    if (b.beam.t < 0.9) { ctx.strokeStyle = 'rgba(255,107,138,.6)'; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(T, b.beam.y); ctx.lineTo(W - T, b.beam.y); ctx.stroke(); }
    else if (b.beam.t < 1.4) { ctx.fillStyle = '#ffe0ea'; ctx.fillRect(T, b.beam.y - 5, W - 2 * T, 10); ctx.fillStyle = '#ff6b8a'; ctx.fillRect(T, b.beam.y - 2, W - 2 * T, 4); }
    ctx.restore();
  }
}

export function drawItem(ctx, it, t, color) {
  const x = it.c * T + 8, y = it.r * T + 8 + Math.sin(t * 3) * 2;
  ctx.save();
  if (it.kind === 'ability' || it.kind === 'key' || it.kind === 'heart') {
    ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.beginPath(); ctx.arc(x, y, 10 + Math.sin(t * 4) * 1.5, 0, 7); ctx.fill();
    ctx.fillStyle = color || '#fff'; ctx.beginPath();
    for (let i = 0; i < 8; i++) { const r = i % 2 ? 3 : 7; const a = (i * Math.PI) / 4 + t; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
    ctx.closePath(); ctx.fill();
    if (it.kind === 'ability') { ctx.fillStyle = '#6b5a45'; ctx.fillRect(x - 7, it.r * T + 15, 14, 1); ctx.fillRect(x - 6, it.r * T + 16, 12, 16); ctx.fillStyle = '#8a7558'; ctx.fillRect(x - 6, it.r * T + 16, 12, 2); }
  } else if (it.kind === 'hp') {
    ctx.fillStyle = '#ff5d7a'; ctx.beginPath(); ctx.arc(x - 3, y - 1, 3.5, 0, 7); ctx.arc(x + 3, y - 1, 3.5, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 6.5, y); ctx.lineTo(x, y + 7); ctx.lineTo(x + 6.5, y); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(x - 4, y - 3, 2, 2);
  } else if (it.kind === 'shot') {
    ctx.fillStyle = '#ffe36b'; ctx.beginPath(); ctx.moveTo(x, y - 7); ctx.lineTo(x + 6, y); ctx.lineTo(x, y + 7); ctx.lineTo(x - 6, y); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(x - 1, y - 3, 2, 6);
  } else if (it.kind === 'orb') {
    ctx.fillStyle = '#ff8da0'; ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill();
  }
  ctx.restore();
}

export function drawSave(ctx, s, t, lit) {
  const x = s.c * T + 8, y = (s.r + 1) * T;
  ctx.save();
  ctx.fillStyle = '#4a4560'; ctx.fillRect(x - 8, y - 22, 16, 22); ctx.fillRect(x - 10, y - 4, 20, 4);
  ctx.fillStyle = lit ? '#9ff0ff' : '#6a86a0';
  ctx.globalAlpha = 0.7 + Math.sin(t * 3) * 0.3;
  ctx.beginPath(); ctx.moveTo(x, y - 19); ctx.lineTo(x + 4, y - 12); ctx.lineTo(x, y - 5); ctx.lineTo(x - 4, y - 12); ctx.fill();
  ctx.restore();
}
