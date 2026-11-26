// 세계 규모·자료 일관성: 방 60개+, 지역 5개+, 능력 6개+, 보스 5개+, 문 짝 맞음, 방 데이터가 설계와 같음
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { ROOMS, ROOM_BY_ID, neighborId, OPP, CH } from '../web/js/world.js';
import { ZONES, ABILITIES, BOSSES } from '../web/js/worldspec.js';
import { COLS, ROWS } from '../web/js/physics.js';

test('규모: 방 60개 이상, 지역 5개 이상, 능력 6개 이상, 보스 5개 이상', () => {
  assert.ok(ROOMS.length >= 60, `방 ${ROOMS.length}`);
  const zones = new Set(ROOMS.map((r) => r.zone));
  assert.ok(zones.size >= 5, `지역 ${zones.size}`);
  assert.ok(ABILITIES.length >= 6);
  const bossRooms = ROOMS.filter((r) => r.boss);
  assert.ok(bossRooms.length >= 5 && BOSSES.filter(Boolean).length === bossRooms.length);
  assert.ok(BOSSES.some((b) => b && b.reward.ending), '엔딩 보스');
  for (const z of zones) assert.ok(ZONES[z] && ROOMS.filter((r) => r.zone === z).length >= 6, `지역 ${z} 방 수`);
});

test('숨은 강화: 체력 조각·탄 강화가 여러 지역에 흩어져 있다', () => {
  const hp = ROOMS.flatMap((r) => r.items.filter((i) => i.kind === 'hp').map(() => r.zone));
  const shot = ROOMS.flatMap((r) => r.items.filter((i) => i.kind === 'shot').map(() => r.zone));
  assert.ok(hp.length >= 8 && new Set(hp).size >= 4, `체력 ${hp.length}`);
  assert.ok(shot.length >= 6 && new Set(shot).size >= 4, `탄 ${shot.length}`);
  assert.ok(ROOMS.filter((r) => r.save).length >= 6, '별돌');
});

test('타일 문자열 길이와 글자가 맞다', () => {
  for (const r of ROOMS) {
    assert.equal(r.tiles.length, COLS * ROWS, r.id);
    for (const ch of r.tiles) assert.ok(ch in CH, `${r.id} 글자 ${ch}`);
  }
});

test('문은 짝이 맞다: 이웃 방의 반대쪽 문과 종류·자리가 같다', () => {
  for (const r of ROOMS) for (const [side, d] of Object.entries(r.doors)) {
    const n = ROOM_BY_ID.get(neighborId(r, side));
    assert.ok(n, `${r.id} ${side} 이웃 없음`);
    const o = n.doors[OPP[side]];
    assert.ok(o, `${r.id} ${side} 짝 없음`);
    assert.equal(o.type, d.type);
    assert.equal(o.col, d.col);
    assert.equal(!!o.high, !!d.high);
  }
});

test('가장자리 칸: 문이 아닌 곳은 막혀 있다(방 밖으로 새지 않음)', () => {
  for (const r of ROOMS) {
    const at = (c, rr) => r.tiles[rr * COLS + c];
    const open = (ch) => ch === '.' || ch === '~';
    for (let rr = 0; rr < ROWS; rr++) {
      if (open(at(0, rr))) assert.ok(r.doors.L, `${r.id} 왼쪽 ${rr}`);
      if (open(at(COLS - 1, rr))) assert.ok(r.doors.R, `${r.id} 오른쪽 ${rr}`);
    }
    for (let c = 0; c < COLS; c++) {
      if (open(at(c, 0))) assert.ok(r.doors.T, `${r.id} 위 ${c}`);
      if (open(at(c, ROWS - 1))) assert.ok(r.doors.B, `${r.id} 아래 ${c}`);
    }
  }
});

test('rooms.js 는 설계(worldspec.js)로 다시 만든 것과 같다', () => {
  execFileSync(process.execPath, ['tools/build-world.mjs', '--check'], { cwd: new URL('..', import.meta.url).pathname, stdio: 'pipe' });
});
