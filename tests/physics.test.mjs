// 물리·충돌 단위 시험: 점프 높이, 이단 점프, 벽·천장, 한쪽 발판, 벽 타기, 대시로 벽 부수기, 내려찍기, 수영·숨 막힘, 가시, 방 나가기
import test from 'node:test';
import assert from 'node:assert/strict';
import { step, makePlayer, exitSide, T, COLS, ROWS, TILE, P, tileAt } from '../web/js/physics.js';
import { CH } from '../web/js/world.js';

// 글자 지도로 방 만들기(모자란 줄·칸은 빈칸, 맨 아래 두 줄은 바닥)
function room(lines) {
  const tiles = new Uint8Array(COLS * ROWS);
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    let ch = (lines[r] || '')[c] || '.';
    if (r >= 15 && !lines[r]) ch = '#';
    tiles[r * COLS + c] = CH[ch];
  }
  return { tiles };
}
const none = { left: false, right: false, up: false, down: false, jump: false, jumpP: false, dashP: false, downP: false };
const inp = (o) => ({ ...none, ...o });
function standAt(rm, c, feetRow = 15) { const p = makePlayer(c * T + 3, feetRow * T - P.h - 0.01); step(rm, p, none, {}); return p; }
function run(rm, p, ab, frames, f) { for (let i = 0; i < frames; i++) step(rm, p, f(i), ab); return p; }

test('바닥에 서면 땅에 닿은 상태가 되고 떨어지지 않는다', () => {
  const rm = room([]);
  const p = makePlayer(100, 100);
  run(rm, p, {}, 90, () => none);
  assert.ok(p.onGround);
  assert.ok(Math.abs(p.y + p.h - 15 * T) < 0.5, `발 위치 ${p.y + p.h}`);
});

test('점프 높이는 약 4칸(64~75px), 버튼을 일찍 떼면 낮게 뛴다', () => {
  const rm = room([]);
  const p = standAt(rm, 10);
  const y0 = p.y; let top = y0;
  run(rm, p, {}, 60, (i) => { top = Math.min(top, p.y); return inp({ jump: true, jumpP: i === 0 }); });
  const full = y0 - top;
  assert.ok(full > 64 && full < 75, `점프 ${full}`);
  const q = standAt(rm, 10); let top2 = q.y;
  run(rm, q, {}, 60, (i) => { top2 = Math.min(top2, q.y); return inp({ jump: i < 4, jumpP: i === 0 }); });
  assert.ok(q.y - top2 < full * 0.6 || y0 - top2 < full * 0.6, '짧게 누르면 낮다');
});

test('이단 점프는 능력이 있을 때만, 합쳐 7칸 남짓', () => {
  const rm = room([]);
  for (const [ab, lo, hi] of [[{}, 64, 75], [{ double: true }, 115, 130]]) {
    const p = standAt(rm, 10); const y0 = p.y; let top = y0;
    run(rm, p, ab, 90, (i) => { top = Math.min(top, p.y); return inp({ jump: true, jumpP: i === 0 || i === 18 }); });
    assert.ok(y0 - top > lo && y0 - top < hi, `${JSON.stringify(ab)} ${y0 - top}`);
  }
});

test('벽에 막히고 천장에 머리를 박는다', () => {
  const rm = room(['', '', '', '', '', '', '', '', '', '', '', '', '...........#', '...........#', '...........#']);
  const p = standAt(rm, 8);
  run(rm, p, {}, 80, () => inp({ right: true }));
  assert.ok(p.x + p.w <= 11 * T + 0.01, `벽 통과 x=${p.x}`);
  const low = room(['', '', '', '', '', '', '', '', '', '', '', '', '#####']);
  const q = standAt(low, 2);
  let top = q.y;
  run(low, q, {}, 40, (i) => { top = Math.min(top, q.y); return inp({ jump: true, jumpP: i === 0 }); });
  assert.ok(top >= 13 * T - 0.01, `천장 뚫음 ${top}`);
});

test('한쪽 발판: 아래에서 뚫고 올라가 그 위에 서고, ↓+점프로 내려간다', () => {
  const rm = room(['', '', '', '', '', '', '', '', '', '', '', '', '.........-----']);
  const p = standAt(rm, 11);
  run(rm, p, {}, 70, (i) => inp({ jump: true, jumpP: i === 0 }));
  assert.ok(p.onGround && Math.abs(p.y + p.h - 12 * T) < 0.6, `발판 위 ${p.y + p.h}`);
  run(rm, p, {}, 40, (i) => inp({ down: true, jump: i === 0, jumpP: i === 0 }));
  assert.ok(p.y + p.h > 13 * T, '내려감');
});

test('코요테 시간: 끝에서 막 떨어진 직후에도 점프된다', () => {
  const rm = room(['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '##########..................', '##########..................']);
  const p = standAt(rm, 9);
  let jumped = false;
  for (let i = 0; i < 60; i++) {
    const off = !p.onGround && p.vy >= 0 && p.x > 10 * T - 4;
    step(rm, p, inp({ right: true, jump: off, jumpP: off && !jumped }), {});
    if (off && !jumped) jumped = true;
    if (p.vy < -300) break;
  }
  assert.ok(p.vy < -300, '떨어진 뒤 잠깐 동안 점프');
});

test('벽 타기: 오를 수 있는 바위벽은 ↑로 오르고, 매끈한 벽은 못 오른다', () => {
  const lines = (ch) => Array.from({ length: 15 }, (_, r) => (r >= 3 ? '..........' + ch : ''));
  for (const [ch, ok] of [['#', true], ['=', false]]) {
    const rm = room(lines(ch));
    const p = standAt(rm, 9);
    let top = p.y;
    run(rm, p, { climb: true }, 200, (i) => { top = Math.min(top, p.y); return inp({ right: true, up: true, jump: i < 10, jumpP: i === 0 }); });
    assert.equal(top < 6 * T, ok, `${ch} 꼭대기 ${top}`);
  }
  const rm = room(lines('#'));
  const p = standAt(rm, 9);
  run(rm, p, {}, 200, (i) => inp({ right: true, up: true, jump: i < 10, jumpP: i === 0 }));
  assert.ok(p.y > 10 * T, '장갑 없으면 못 오름');
});

test('대시: 능력이 있으면 앞으로 빠르게 돌진하고 금 간 바위벽(C)을 부순다', () => {
  const lines = Array.from({ length: 15 }, (_, r) => (r >= 11 ? '..............C' : ''));
  const rm = room(lines);
  const p = standAt(rm, 10);
  const ev = [];
  step(rm, p, inp({ right: true, dashP: true }), { dash: true }, 1 / 60, ev);
  for (let i = 0; i < 20; i++) step(rm, p, inp({ right: true }), { dash: true }, 1 / 60, ev);
  assert.ok(ev.some((e) => e.type === 'break'), '부숨');
  assert.equal(tileAt(rm, 14, 13), TILE.EMPTY);
  const rm2 = room(lines);
  const q = standAt(rm2, 10);
  for (let i = 0; i < 40; i++) step(rm2, q, inp({ right: true, dashP: i === 0 }), {});
  assert.equal(tileAt(rm2, 14, 13), TILE.CRACK, '능력 없으면 그대로');
  assert.ok(q.x + q.w <= 14 * T + 0.01);
});

test('내려찍기: 공중에서 ↓ 로 금 간 바닥(P)을 깨고 아래로 떨어진다', () => {
  const lines = Array.from({ length: 17 }, (_, r) => (r === 10 ? '.....PPPP' : r >= 15 ? '#'.repeat(30) : ''));
  const rm = room(lines);
  const p = makePlayer(6 * T + 3, 10 * T - P.h - 0.01);
  step(rm, p, none, {});
  assert.ok(p.onGround);
  run(rm, p, { pound: true }, 60, (i) => inp({ jump: i < 8, jumpP: i === 0, down: i === 14, downP: i === 14 }));
  assert.equal(tileAt(rm, 6, 10), TILE.EMPTY);
  assert.ok(p.y + p.h > 14 * T, '아래 바닥까지');
});

test('물: 수영 능력이 있으면 떠오르고, 없으면 숨이 막힌다', () => {
  const lines = Array.from({ length: 15 }, (_, r) => (r >= 5 ? '.....~~~~~~~~~~~~' : ''));
  const rm = room(lines);
  const p = makePlayer(10 * T, 9 * T);
  const ev = [];
  run(rm, p, {}, 40, () => none).choke;
  for (let i = 0; i < 40; i++) step(rm, p, none, {}, 1 / 60, ev);
  assert.ok(ev.some((e) => e.type === 'choke'));
  const q = makePlayer(10 * T, 12 * T);
  const ev2 = [];
  const y0 = q.y;
  for (let i = 0; i < 40; i++) step(rm, q, inp({ up: true }), { swim: true }, 1 / 60, ev2);
  assert.ok(!ev2.some((e) => e.type === 'choke'));
  assert.ok(q.y < y0 - 30, `헤엄쳐 오름 ${y0 - q.y}`);
});

test('가시에 닿으면 알린다, 방 밖으로 나가면 쪽을 알려 준다', () => {
  const lines = Array.from({ length: 16 }, (_, r) => (r === 15 ? '#####^^^####' + '#'.repeat(18) : ''));
  const rm = room(lines);
  const p = makePlayer(6 * T, 12 * T);
  const ev = [];
  for (let i = 0; i < 40; i++) step(rm, p, none, {}, 1 / 60, ev);
  assert.ok(ev.some((e) => e.type === 'spike'));
  assert.equal(exitSide({ x: -8, y: 100, w: 10, h: 22 }), 'L');
  assert.equal(exitSide({ x: 478, y: 100, w: 10, h: 22 }), 'R');
  assert.equal(exitSide({ x: 100, y: -14, w: 10, h: 22 }), 'T');
  assert.equal(exitSide({ x: 100, y: 265, w: 10, h: 22 }), 'B');
  assert.equal(exitSide({ x: 100, y: 100, w: 10, h: 22 }), null);
});

test('열린 문으로는 방 밖까지 걸어 나갈 수 있다(가장자리 칸 복제)', () => {
  const lines = Array.from({ length: 15 }, (_, r) => (r >= 11 ? '.'.repeat(30) : '#' + '.'.repeat(28) + '#'));
  const rm = room(lines);
  const p = standAt(rm, 2);
  let side = null;
  for (let i = 0; i < 120 && !side; i++) { step(rm, p, inp({ left: true }), {}); side = exitSide(p); }
  assert.equal(side, 'L');
});
