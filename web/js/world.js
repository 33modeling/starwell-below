// 방 데이터 읽기: 타일 글자 → 숫자, 문 상태 반영, 들어올 때 서는 자리. 게임과 검사기가 함께 쓴다.
import { TILE, COLS, ROWS, T, P } from './physics.js';
import { ROOMS } from './data/rooms.js';

export const CH = { '.': 0, '#': 1, '=': 2, '-': 3, '^': 4, '~': 5, C: 6, P: 7, I: 8, B: 9, F: 10, K: 11 };
export const CH_OF = Object.fromEntries(Object.entries(CH).map(([k, v]) => [v, k]));
export const OPP = { L: 'R', R: 'L', T: 'B', B: 'T' };

export const ROOM_BY_ID = new Map(ROOMS.map((r) => [r.id, r]));
export { ROOMS };

export function neighborId(def, side) {
  const [dx, dy] = { L: [-1, 0], R: [1, 0], T: [0, -1], B: [0, 1] }[side];
  return `${def.x + dx},${def.y + dy}`;
}

// ctx: { ab: {dash,pound,fire,...}, bossDone(id)→bool, key: bool, broken: Set('c,r'), solver: bool }
// solver 가 참이면 능력으로 부술 수 있는 칸(금 간 벽·바닥, 얼음)을 미리 비워 둔다.
export function buildTiles(def, ctx = {}) {
  const tiles = new Uint8Array(COLS * ROWS);
  const s = def.tiles;
  const ab = ctx.ab || {};
  const doorOpen = def.bossDoor ? !!(ctx.bossDone && ctx.bossDone(def.bossDoor)) : false;
  for (let i = 0; i < COLS * ROWS; i++) {
    let t = CH[s[i]];
    if (t === TILE.BOSSDOOR && doorOpen) t = TILE.EMPTY;
    if (t === TILE.KEYDOOR && ctx.key) t = TILE.EMPTY;
    if (ctx.solver) {
      if (t === TILE.CRACK && ab.dash) t = TILE.EMPTY;
      if (t === TILE.FLOORCRACK && ab.pound) t = TILE.EMPTY;
      if (t === TILE.ICE && ab.fire) t = TILE.EMPTY;
    }
    tiles[i] = t;
  }
  if (ctx.broken) for (const k of ctx.broken) { const [c, r] = k.split(',').map(Number); tiles[r * COLS + c] = TILE.EMPTY; }
  return tiles;
}

// 문으로 들어올 때 서는 자리(몸 왼쪽 위 좌표)와 처음 속도
export function spawnPoint(def, side) {
  const d = def.doors[side];
  if (side === 'L' || side === 'R') {
    const col = side === 'L' ? 1 : COLS - 2;
    const feet = d.high ? 9 : 15;
    return { x: col * T + (T - P.w) / 2, y: feet * T - P.h - 0.01, vx: 0, vy: 0 };
  }
  if (side === 'T') return { x: (d.col + 1) * T + (T - P.w) / 2, y: 1, vx: 0, vy: 60 };
  // 아래 구멍으로 올라옴: 구멍 옆 바닥에 선다
  const col = d.col - 1 >= 2 ? d.col - 1 : d.col + 3;
  return { x: col * T + (T - P.w) / 2, y: 15 * T - P.h - 0.01, vx: 0, vy: 0 };
}
export function savePoint(def) {
  return { x: def.save.c * T + (T - P.w) / 2, y: (def.save.r + 1) * T - P.h - 0.01, vx: 0, vy: 0 };
}
// 줍는 물건 사각형
export function pickRect(it) { return { x: it.c * T + 2, y: it.r * T + 2, w: 12, h: 12 }; }
