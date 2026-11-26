// 적과 보스. 모두 같은 틀: update(dt, g) / hurtbox / hp. g 는 게임 쪽 도우미(player, shoot, tiles, rnd ...).
import { T, W, H, TILE, isSolid, tileAt } from './physics.js';

const FLOOR = 15 * T;

export function makeEnemy(e, zone) {
  const base = { type: e.type, x: e.c * T, y: e.r * T, vx: 0, vy: 0, t: Math.random() * 3, flash: 0, dead: false, zone };
  if (e.type === 'crawler') return Object.assign(base, { w: 14, h: 12, y: (e.r + 1) * T - 12, vx: 28 + zone * 4, hp: 2 + zone });
  if (e.type === 'flyer') return Object.assign(base, { w: 12, h: 12, hp: 1 + zone, ox: e.c * T, oy: e.r * T });
  return Object.assign(base, { w: 14, h: 14, y: (e.r + 1) * T - 14, hp: 3 + zone, cd: 1.5 });
}

export function updateEnemy(e, dt, g) {
  e.t += dt;
  if (e.flash > 0) e.flash -= dt;
  const p = g.player;
  if (e.type === 'crawler') {
    const ahead = e.vx > 0 ? e.x + e.w + 1 : e.x - 1;
    const c = Math.floor(ahead / T), rFeet = Math.floor((e.y + e.h + 2) / T), rBody = Math.floor((e.y + e.h - 2) / T);
    const wall = isSolid(tileAt(g.room, c, rBody));
    const t = tileAt(g.room, c, rFeet);
    const gap = !(isSolid(t) || t === TILE.PLAT);
    if (wall || gap || ahead < T || ahead > W - T) e.vx = -e.vx;
    e.x += e.vx * dt;
  } else if (e.type === 'flyer') {
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy);
    if (d < 170) { e.ox += (dx / d) * (22 + e.zone * 4) * dt; e.oy += (dy / d) * (22 + e.zone * 4) * dt; }
    e.x = e.ox + Math.sin(e.t * 2) * 10;
    e.y = e.oy + Math.sin(e.t * 3.1) * 8;
  } else {
    e.cd -= dt;
    if (e.cd <= 0 && Math.abs(p.x - e.x) < 260) {
      e.cd = 2.4 - Math.min(1, e.zone * 0.15);
      const dx = p.x + p.w / 2 - (e.x + e.w / 2), dy = p.y + p.h / 2 - (e.y + 4), d = Math.hypot(dx, dy) || 1;
      g.enemyShot(e.x + e.w / 2, e.y + 4, (dx / d) * 95, (dy / d) * 95, 3);
    }
  }
}

// ── 보스 ───────────────────────────────────────────
// 각 보스는 { x,y,w,h,hp,max, vulnerable, update(dt,g), name }. 탄은 g.enemyShot(x,y,vx,vy,r,opt)
export function makeBoss(id, info, def) {
  const b = { id, name: info.name, color: info.color, hp: info.hp, max: info.hp, t: 0, state: 'intro', st: 1.2, flash: 0, vulnerable: true, dead: false, dir: -1, phase: 1 };
  const cx = W / 2;
  if (id === 1) Object.assign(b, { w: 46, h: 34, x: cx + 60, y: FLOOR - 34, vx: 0, vy: 0, hops: 0 });
  if (id === 2) Object.assign(b, { w: 40, h: 26, x: cx - 20, y: 50, vx: 0, vy: 0 });
  if (id === 3) Object.assign(b, { w: 30, h: 70, x: cx, y: FLOOR, baseY: FLOOR, vulnerable: false, side: 1 });
  if (id === 4) Object.assign(b, { w: 52, h: 54, x: cx + 50, y: FLOOR - 54, vx: 0, vy: 0, shots: 0 });
  if (id === 5) Object.assign(b, { w: 44, h: 28, x: cx, y: 46, vx: 0, vy: 0, gust: 0 });
  if (id === 6) Object.assign(b, { w: 44, h: 44, x: cx - 22, y: 70, vx: 0, vy: 0, ang: 0, beam: null });
  return b;
}

function aim(g, x, y, speed) {
  const p = g.player;
  const dx = p.x + p.w / 2 - x, dy = p.y + p.h / 2 - y, d = Math.hypot(dx, dy) || 1;
  return [(dx / d) * speed, (dy / d) * speed];
}

export function updateBoss(b, dt, g) {
  b.t += dt;
  if (b.flash > 0) b.flash -= dt;
  b.st -= dt;
  const p = g.player;
  const pcx = p.x + p.w / 2;
  const mx = b.x + b.w / 2, my = b.y + b.h / 2;
  const rage = b.hp < b.max / 2 ? 1 : 0;
  b.phase = b.hp < b.max / 3 ? 3 : b.hp < (b.max * 2) / 3 ? 2 : 1;
  switch (b.id) {
    case 1: { // 가시두꺼비: 뛰어오르다 내려앉으며 땅 물결
      if (b.state === 'intro' || b.state === 'idle') {
        if (b.st <= 0) { b.state = 'hop'; b.hops++; const big = b.hops % 3 === 0; b.vy = big ? -560 : -420; b.vx = Math.sign(pcx - mx) * (big ? 90 : 130); b.big = big; }
      } else if (b.state === 'hop') {
        b.vy += 1400 * dt; b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.x < T) { b.x = T; b.vx = -b.vx; } if (b.x + b.w > W - T) { b.x = W - T - b.w; b.vx = -b.vx; }
        if (b.y + b.h >= FLOOR && b.vy > 0) {
          b.y = FLOOR - b.h; b.state = 'idle'; b.st = rage ? 0.5 : 0.85; g.shake(4);
          for (const s of [-1, 1]) g.enemyShot(mx + s * 20, FLOOR - 6, s * (150 + rage * 40), 0, 5, { ground: true, life: 3 });
          if (b.big) for (let i = 0; i < 4; i++) g.enemyShot(40 + g.rnd() * (W - 80), 20, 0, 140, 4, { life: 3 });
        }
      }
      break;
    }
    case 2: { // 수정박쥐 여왕: 8자 비행, 내리꽂기, 수정 조각 떨구기
      if (b.state === 'intro' || b.state === 'fly') {
        b.state = 'fly';
        const tx = W / 2 + Math.sin(b.t * 0.9) * 170, ty = 54 + Math.sin(b.t * 1.8) * 26;
        b.x += (tx - b.w / 2 - b.x) * Math.min(1, dt * 3); b.y += (ty - b.y) * Math.min(1, dt * 3);
        if (Math.abs(mx - pcx) < 18 && g.rnd() < dt * 3) for (let i = -1; i <= 1; i++) g.enemyShot(mx + i * 10, my + 10, i * 30, 160, 4);
        if (b.st <= 0) { b.state = 'dive'; b.st = 0.9; const v = aim(g, mx, my, 300); b.vx = v[0]; b.vy = v[1]; }
      } else if (b.state === 'dive') {
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.y + b.h > FLOOR) { b.y = FLOOR - b.h; b.vy = -Math.abs(b.vy); g.shake(2); }
        if (b.x < T || b.x + b.w > W - T) b.vx = -b.vx;
        if (b.st <= 0) { b.state = 'fly'; b.st = rage ? 1.6 : 2.6; if (rage) for (let a = 0; a < 8; a++) g.enemyShot(mx, my, Math.cos(a * 0.785) * 110, Math.sin(a * 0.785) * 110, 4); }
      }
      break;
    }
    case 3: { // 물뱀 무랑: 바닥에서 솟아 거품 부채꼴, 나왔을 때만 맞는다
      if (b.state === 'intro') { b.state = 'under'; b.st = 0.8; }
      if (b.state === 'under') {
        b.vulnerable = false; b.y = FLOOR + 10;
        if (b.st <= 0) { b.state = 'warn'; b.st = 0.7; b.x = Math.max(T * 2, Math.min(W - T * 2 - b.w, pcx + (g.rnd() < 0.5 ? -90 : 90) - b.w / 2)); }
      } else if (b.state === 'warn') {
        if (b.st <= 0) { b.state = 'up'; b.st = rage ? 2.2 : 2.8; b.shots = 0; }
      } else if (b.state === 'up') {
        b.vulnerable = true; b.y += (FLOOR - b.h - b.y) * Math.min(1, dt * 8);
        const n = Math.floor((2.8 - b.st) / (rage ? 0.6 : 0.9));
        if (n > b.shots && b.st > 0.4) {
          b.shots = n;
          const [vx, vy] = aim(g, mx, b.y + 10, 120);
          const a = Math.atan2(vy, vx);
          for (const da of rage ? [-0.5, -0.25, 0, 0.25, 0.5] : [-0.35, 0, 0.35]) g.enemyShot(mx, b.y + 10, Math.cos(a + da) * 120, Math.sin(a + da) * 120, 5);
        }
        if (b.st <= 0) { b.state = 'dive'; b.st = 0.5; }
      } else if (b.state === 'dive') {
        b.y += 260 * dt;
        if (b.st <= 0) { b.state = 'under'; b.st = rage ? 0.6 : 1.0; }
      }
      break;
    }
    case 4: { // 풀무 거인: 걷기 → 불꽃 부채 → 돌진
      if (b.state === 'intro' || b.state === 'walk') {
        b.state = 'walk';
        b.x += Math.sign(pcx - mx) * (30 + rage * 20) * dt;
        if (b.st <= 0) { b.shots++; if (b.shots % 3 === 0) { b.state = 'wind'; b.st = 0.6; b.dir = Math.sign(pcx - mx) || 1; } else { b.state = 'fire'; b.st = 0.5; } }
      } else if (b.state === 'fire') {
        if (b.st <= 0) {
          const [vx, vy] = aim(g, mx, b.y + 14, 130); const a = Math.atan2(vy, vx);
          for (let i = -2; i <= 2; i++) g.enemyShot(mx, b.y + 14, Math.cos(a + i * 0.2) * 130, Math.sin(a + i * 0.2) * 130, 5, { fire: true });
          b.state = 'walk'; b.st = rage ? 1.3 : 2.0;
        }
      } else if (b.state === 'wind') {
        if (b.st <= 0) { b.state = 'charge'; b.vx = b.dir * (250 + rage * 60); }
      } else if (b.state === 'charge') {
        b.x += b.vx * dt;
        if (b.x < T || b.x + b.w > W - T) {
          b.x = Math.max(T, Math.min(W - T - b.w, b.x)); g.shake(6);
          for (let i = 0; i < 5; i++) g.enemyShot(40 + g.rnd() * (W - 80), 18, 0, 130 + g.rnd() * 40, 4, { fire: true });
          b.state = 'walk'; b.st = 1.6;
        }
      }
      b.x = Math.max(T, Math.min(W - T - b.w, b.x));
      break;
    }
    case 5: { // 회오리매: 위에서 맴돌며 바람(밀기)·깃털 연사·급강하
      if (b.state === 'intro' || b.state === 'hover') {
        b.state = 'hover';
        const tx = W / 2 + Math.sin(b.t * 0.7) * 160;
        b.x += (tx - b.w / 2 - b.x) * Math.min(1, dt * 2); b.y += (40 - b.y) * Math.min(1, dt * 2);
        if (b.st <= 0) {
          const r = g.rnd();
          if (r < 0.35) { b.state = 'gust'; b.st = 2.2; b.gust = pcx > W / 2 ? 1 : -1; }
          else if (r < 0.7) { b.state = 'volley'; b.st = 1.2; b.shots = 0; }
          else { b.state = 'swoop'; b.st = 1.1; const v = aim(g, mx, my, 280); b.vx = v[0]; b.vy = v[1]; }
        }
      } else if (b.state === 'gust') {
        g.wind = b.gust * (70 + rage * 30);
        if (g.rnd() < dt * 4) g.enemyShot(b.gust > 0 ? 20 : W - 20, 60 + g.rnd() * 160, b.gust * 150, 0, 3, { leaf: true });
        if (b.st <= 0) { b.state = 'hover'; b.st = 1.2; }
      } else if (b.state === 'volley') {
        const n = Math.floor((1.2 - b.st) / 0.25);
        if (n > b.shots) { b.shots = n; const [vx, vy] = aim(g, mx, my, 170); g.enemyShot(mx, my, vx, vy, 4); }
        if (b.st <= 0) { b.state = 'hover'; b.st = rage ? 0.8 : 1.4; }
      } else if (b.state === 'swoop') {
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.y + b.h > FLOOR) { b.y = FLOOR - b.h; b.vy = -Math.abs(b.vy); }
        if (b.x < T || b.x + b.w > W - T) b.vx = -b.vx;
        if (b.st <= 0) { b.state = 'hover'; b.st = 1.4; }
      }
      break;
    }
    case 6: { // 검은 별 그림자: 세 단계 — 고리 탄, 겨눈 세 발+부하, 가로 빛줄기
      if (b.state === 'intro') { b.state = 'float'; b.st = 1; }
      const tx = W / 2 + Math.sin(b.t * 0.6) * 120, ty = 70 + Math.sin(b.t * 1.3) * 24;
      b.x += (tx - b.w / 2 - b.x) * Math.min(1, dt * 1.5); b.y += (ty - b.y) * Math.min(1, dt * 1.5);
      if (b.st <= 0) {
        b.ang += 0.3;
        const n = b.phase === 1 ? 10 : 12;
        for (let i = 0; i < n; i++) { const a = b.ang + (i * Math.PI * 2) / n; g.enemyShot(mx, my, Math.cos(a) * 90, Math.sin(a) * 90, 4, { star: true }); }
        if (b.phase >= 2) { const [vx, vy] = aim(g, mx, my, 150); const a = Math.atan2(vy, vx); for (const d of [-0.2, 0, 0.2]) g.enemyShot(mx, my, Math.cos(a + d) * 150, Math.sin(a + d) * 150, 4, { star: true }); }
        if (b.phase >= 2 && g.rnd() < 0.35) g.summon('flyer', mx, my);
        if (b.phase === 3 && !b.beam) b.beam = { y: Math.max(40, Math.min(FLOOR - 20, p.y + p.h / 2)), t: 0 };
        b.st = b.phase === 1 ? 2.0 : b.phase === 2 ? 1.7 : 1.5;
      }
      if (b.beam) {
        b.beam.t += dt;
        if (b.beam.t > 0.9 && b.beam.t < 1.4) g.hazardRect({ x: T, y: b.beam.y - 5, w: W - 2 * T, h: 10 });
        if (b.beam.t > 1.4) b.beam = null;
      }
      break;
    }
  }
}
