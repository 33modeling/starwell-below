// 별우물 아래 — 세계 설계(손으로 짠 원본). 방 타일은 tools/build-world.mjs 가 이 설계로 만들어 data/rooms.js 에 쓴다.
// 지도는 가로 12 × 세로 8 칸, 한 칸이 방 하나(30×17타일).
export const MAP_W = 12;
export const MAP_H = 8;

export const ZONES = [
  null,
  { id: 1, name: '뿌리 마을터', color: '#7fae5a', dark: '#24351c', bg: ['#1a2416', '#2d3b22'], rock: '#5b4a35', rock2: '#7a6448' },
  { id: 2, name: '수정 동굴', color: '#a98bf0', dark: '#2a2147', bg: ['#140f26', '#2a1f4a'], rock: '#4b3f73', rock2: '#6c5aa3' },
  { id: 3, name: '잠긴 물길', color: '#58b8e0', dark: '#123345', bg: ['#0a1c28', '#123247'], rock: '#2f5566', rock2: '#46798c' },
  { id: 4, name: '불씨 대장간', color: '#f08a4b', dark: '#3d1d10', bg: ['#22100a', '#3a1b10'], rock: '#5e3424', rock2: '#8a4d31' },
  { id: 5, name: '바람 첨탑', color: '#9fe0d0', dark: '#1d3a38', bg: ['#102428', '#22464a'], rock: '#557c7a', rock2: '#7fa8a2' },
  { id: 6, name: '별 심장', color: '#ffd86b', dark: '#2b2410', bg: ['#0b0a12', '#221c34'], rock: '#3b3550', rock2: '#5d5478' },
];

// 지역 배치(숫자 = 지역, . = 빈 칸)
export const LAYOUT = [
  '....66665555'.split(''),
  '....66.65555'.split(''),
  '11111....555'.split(''),
  '111111.4445.'.split(''),
  '222.1..44444'.split(''),
  '2222.333.44.'.split(''),
  '2222333334..'.split(''),
  '.2..3333....'.split(''),
];

// 능력(얻는 순서)
export const ABILITIES = [
  { id: 'climb', name: '이끼 장갑', desc: '벽에 붙어 ↑ 로 오르고, 붙은 채 점프하면 벽 차기', color: '#8fd16a' },
  { id: 'dash', name: '바람 신', desc: '대시 단추로 앞으로 돌진 — 금 간 바위벽을 부순다', color: '#e6f2ff' },
  { id: 'double', name: '구름 씨앗', desc: '공중에서 한 번 더 점프', color: '#ffffff' },
  { id: 'swim', name: '물방울 숨', desc: '깊은 물에서 숨 쉬며 헤엄친다', color: '#7fd8ff' },
  { id: 'pound', name: '무쇠 발', desc: '공중에서 ↓ — 내려찍어 금 간 바닥을 깬다', color: '#c9c9d6' },
  { id: 'fire', name: '불씨 구슬', desc: '쏘는 별빛이 불탄이 되어 얼음을 녹인다', color: '#ff9a4a' },
];
export const KEY_ITEM = { id: 'key', name: '별 열쇠', desc: '별 심장으로 가는 문을 연다', color: '#ffd86b' };

// 문 종류: '-' 열림, w 벽 타기 필요, d 이단 점프, a 돌진(금 간 벽), s 수영(물굴), p 내려찍기(금 간 바닥),
// f 불탄(얼음), b 보스 문(bossId 처치 뒤 열림), k 별 열쇠
export const GATE_NEED = { '-': null, '|': null, w: 'climb', d: 'double', a: 'dash', s: 'swim', p: 'pound', f: 'fire', k: 'key' };

// 연결: [x1,y1,x2,y2,종류,보스번호?]  (가로는 x2=x1+1, 세로는 y2=y1+1 — 위 칸이 먼저)
export const LINKS = [
  // 1 뿌리 마을터
  [0, 2, 1, 2, '-'], [1, 2, 2, 2, '-'], [2, 2, 3, 2, '-'], [3, 2, 4, 2, '-'],
  [0, 3, 1, 3, '-'], [1, 3, 2, 3, '-'], [2, 3, 3, 3, '-'], [3, 3, 4, 3, '-'],
  [4, 3, 5, 3, 'a'], [2, 2, 2, 3, 'w'], [4, 3, 4, 4, 'p'],
  // 1 → 2
  [0, 3, 0, 4, 'b', 1],
  // 2 수정 동굴
  [0, 4, 1, 4, '-'], [1, 4, 2, 4, '-'], [0, 4, 0, 5, '-'], [0, 5, 1, 5, '-'], [1, 5, 2, 5, '-'], [2, 5, 3, 5, '-'],
  [1, 5, 1, 6, '-'], [0, 6, 1, 6, '-'], [1, 6, 2, 6, '-'], [1, 6, 1, 7, '-'], [2, 6, 3, 6, 'a'],
  // 2 → 3
  [3, 6, 4, 6, 'd'],
  // 3 잠긴 물길
  [4, 6, 5, 6, '-'], [5, 6, 6, 6, '-'], [4, 6, 4, 7, '-'], [4, 7, 5, 7, '-'], [5, 7, 6, 7, 's'], [6, 7, 7, 7, '-'],
  [6, 6, 7, 6, 's'], [7, 6, 8, 6, '-'], [5, 5, 5, 6, '-'], [5, 5, 6, 5, '-'], [6, 5, 7, 5, '-'],
  // 3 → 4
  [8, 6, 9, 6, 'b', 3],
  // 4 불씨 대장간
  [9, 5, 9, 6, '-'], [9, 5, 10, 5, '-'], [10, 4, 10, 5, 'w'], [10, 4, 11, 4, '-'], [9, 4, 10, 4, '-'], [8, 4, 9, 4, '-'],
  [8, 3, 8, 4, '-'], [7, 3, 8, 3, '-'], [7, 3, 7, 4, 'p'], [7, 4, 8, 4, 'f'], [8, 3, 9, 3, 'f'],
  // 4 → 5
  [9, 2, 9, 3, 'b', 4],
  // 5 바람 첨탑
  [9, 2, 10, 2, '-'], [10, 2, 11, 2, '-'], [10, 2, 10, 3, '-'], [11, 1, 11, 2, 'd'], [10, 1, 11, 1, '-'],
  [9, 1, 9, 2, 'w'], [9, 1, 10, 1, '-'], [8, 1, 9, 1, '-'], [8, 0, 8, 1, '-'], [8, 0, 9, 0, '-'], [9, 0, 10, 0, 'a'], [11, 0, 11, 1, '-'],
  // 5 → 6
  [7, 0, 8, 0, 'k'],
  // 6 별 심장
  [6, 0, 7, 0, '-'], [7, 0, 7, 1, '-'], [5, 0, 6, 0, 'd'], [4, 0, 5, 0, '-'], [4, 0, 4, 1, '-'], [5, 0, 5, 1, 'w'],
];

// 방 안 특징. item: 능력·열쇠 받침돌, up: 숨은 강화(hp=체력 조각, shot=탄 강화)와 숨긴 방식(nook)
export const FEATURES = {
  '2,3': { start: true, save: true, name: '우물 바닥' },
  '0,3': { item: 'climb' },
  '1,2': { save: true },
  '4,2': { boss: 1 },
  '5,3': { up: { kind: 'hp', nook: 'plain' } },
  '4,4': { up: { kind: 'shot', nook: 'plain' } },
  '0,2': { up: { kind: 'hp', nook: 'double' } },
  '3,3': { up: { kind: 'shot', nook: 'hidden' } },

  '0,5': { save: true },
  '1,7': { item: 'dash' },
  '3,6': { boss: 2 },
  '0,6': { up: { kind: 'hp', nook: 'climb' } },
  '2,4': { up: { kind: 'shot', nook: 'hidden' } },
  '3,5': { up: { kind: 'shot', nook: 'double' } },
  '2,6': { up: { kind: 'hp', nook: 'fire' } },

  '5,6': { save: true },
  '6,5': { item: 'swim' },
  '8,6': { boss: 3 },
  '7,7': { up: { kind: 'hp', nook: 'plain' } },
  '7,5': { up: { kind: 'shot', nook: 'climb' } },
  '4,7': { up: { kind: 'hp', nook: 'pound' } },

  '9,5': { save: true },
  '7,4': { item: 'fire' },
  '9,3': { boss: 4 },
  '11,4': { up: { kind: 'hp', nook: 'fire' } },
  '8,4': { up: { kind: 'shot', nook: 'pound' } },
  '10,5': { up: { kind: 'hp', nook: 'dash' } },

  '8,1': { save: true, up: { kind: 'shot', nook: 'fire' } },
  '10,0': { boss: 5 },
  '11,2': { up: { kind: 'hp', nook: 'swim' } },
  '10,3': { up: { kind: 'hp', nook: 'pound' } },
  '11,0': { up: { kind: 'shot', nook: 'double' } },

  '7,1': { save: true },
  '4,1': { boss: 6 },
  '5,1': { up: { kind: 'shot', nook: 'plain' } },
  '6,0': { up: { kind: 'hp', nook: 'dash' } },
};

// 보스: 이름, 체력, 처치 보상
export const BOSSES = [
  null,
  { id: 1, name: '가시두꺼비 왕 투둑', hp: 22, reward: { kind: 'hp' }, color: '#6f9a3c' },
  { id: 2, name: '수정박쥐 여왕 리엔', hp: 30, reward: { item: 'double' }, color: '#b99cff' },
  { id: 3, name: '물뱀 무랑', hp: 38, reward: { item: 'pound' }, color: '#3fa6c9' },
  { id: 4, name: '풀무 거인 가마', hp: 46, reward: { kind: 'hp' }, color: '#e0703a' },
  { id: 5, name: '회오리매 시로', hp: 52, reward: { item: 'key' }, color: '#cfeee6' },
  { id: 6, name: '검은 별 그림자', hp: 84, reward: { ending: true }, color: '#ffd86b' },
];

export const cellKey = (x, y) => `${x},${y}`;
export const zoneAt = (x, y) => (y >= 0 && y < MAP_H && x >= 0 && x < MAP_W ? Number(LAYOUT[y][x]) || 0 : 0);
