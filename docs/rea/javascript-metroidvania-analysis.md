# REA 분석: MIT 메트로배니아 웹 게임 2개 → 별우물 아래

- 분석일: 2026-11-26 · 도구: REA(rea-agents 6.8.0, `npx -y rea-agents@6.8.0`, setup·MCP 등록 없이 CLI만)
- 결과물: 이 저장소의 게임 「별우물 아래(Starwell Below)」 — `web/`
- 다시 하기: `bash docs/rea/scripts/run-rea.sh <작업 폴더>` (기록: `docs/rea/evidence/rea-runs.json`)

## 1. 무엇을, 왜 분석했나

과제는 "메트로배니아 장르(이어진 큰 지도, 능력을 얻어야 열리는 길, 저장 지점, 지도 화면, 보스, 숨은 강화)의 오리지널 웹 게임"이다.
장르 규칙은 저작권 대상이 아니므로, 같은 장르를 JavaScript 로 만든 **허용 라이선스(MIT)** 공개 코드를 REA 로 정적 분석해
방 전환·능력 문·충돌·카메라를 어떤 상태 값과 흐름으로 구현했는지 확인했다. 코드는 한 줄도 옮기지 않았고,
이름·세계관·캐릭터·그림·지도는 모두 새로 만들었다(주인공 흙인형 **모아**, 지역 6곳, 보스 6마리는 이 저장소의 창작).

## 2. 분석 대상 고르기

GitHub 저장소 검색(`metroidvania` + JavaScript/TypeScript, MIT)에서 후보를 이렇게 걸렀다.

| 후보 | 판단 |
|---|---|
| **JSLegendDev/JavaScript-Metroidvania** (MIT, kaboom.js) | 방 2개 사이 출구 구역·카메라 구역·통과 발판·보스 장벽·보스 처치 → 이단 점프 해금이 모두 있음 → **주 대상** |
| **attilahorvath/gib** (MIT, js13k 2018, WebGL) | 능력 6개(이동·점프·이단 점프·드릴·사격·순간이동)를 아이템으로 하나씩 되찾는 구조, 타일 문자 지도, 부술 수 있는 벽돌 → **비교 대상** |
| tmptrash/gra | 라이선스 MIT 이지만 실험 코드(엔진 위주) — 능력 문이 없어 제외 |
| HorrellTech/echo-genesis, Mothlight 등 | 별 수가 적고 규모 대비 규칙이 흩어져 있어 제외 |

### 받은 범위(sparse·shallow clone, 빌드·설치·실행 없음)

| 대상 | 커밋 | 라이선스 | 받은 경로 | 받지 않은 것 |
|---|---|---|---|---|
| JSLegendDev/JavaScript-Metroidvania | `5a2ef84de097` | MIT (Copyright (c) 2024 JSLegend) | `src/` `index.html` `README.MD` `LICENSE` (13 JS) | `assets/`(그림·글꼴·소리), `maps/`(Tiled 방 JSON), `lib/`(kaboom.js) |
| attilahorvath/gib | `2ecea116da3e` | MIT (Copyright (c) 2018 Attila Horváth) | `src/` `index.html` `README.md` `LICENSE` `package.json` (39 JS) | `assets/`(그림·`map.txt` 지도), `shaders/`, `build/`, `package-lock.json` |

## 3. REA 실행 기록

모두 종료 코드 0, 합계 25회 52.8초. 큰 결과(앱 분석 5.4 MB·10.6 MB, 기능 추적 0.35~1.0 MB)는 저장소에 넣지 않고
`evidence/rea-runs.json` 에 크기와 SHA-256 만 적었다. 요약은 `evidence/*.summary.json`, `trace-summaries.json`.

| # | 명령 | 대상 | 초 | 결과 |
|---|---|---|---|---|
| 1 | import-reference-source | jsmv 전체 | 1.5 | 파일 16개(HTML·JS·MD), ES import 관계 27, 파싱 실패 0 |
| 2 | import-reference-source `--detail summary --outline-depth 3` | jsmv | 1.3 | 4.5 KB 요약 |
| 3 | import-reference-source | gib 전체 | 1.4 | 파일 43개, 관계 70, 파싱 실패 0 |
| 4 | analyze-javascript-application | jsmv `src/` 13개 | 3.8 | 파싱 실패 0, AST 4,543, 함수 94(이름 33), 리스너 7, 관계 resolved 1,154·candidate 1,332, modules 0 |
| 5 | analyze-javascript-application | gib `src/` 39개 | 5.6 | 파싱 실패 0, AST 12,451, 함수 205(이름 136), 관계 resolved 2,323·candidate 1,137, modules 0 |
| 6–11 | inspect-analysis-view | 두 대상 summary·modules·javascript-facts | 1.6–2.3 | 요약 12 KB, 모듈 참조 15·25 KB, 파일별 사실 61·101 KB |
| 12–15 | trace-application-feature | `roomUtils.js`·`player.js`·`Gib.js`·`Map.js` 양방향 | 1.6–2.3 | jsmv 노드 55·간선 119(두 씨앗 모두 같은 그래프), gib 노드 261·간선 260 |
| 16 | trace-javascript-semantics | `setExitZones` 호출자 | 1.6 | 씨앗 `roomUtils.js:173` 만 — 다른 모듈(room1·room2)에서의 호출은 못 이음 |
| 17 | 〃 | `setCameraZones` 호출자 | 1.8 | 씨앗 `roomUtils.js:149` 만 |
| 18 | 〃 | `enableDoubleJump` 호출자 | 1.8 | 씨앗 `player.js:162` 만(실제 호출은 `enemyBoss.js` 117행 — 직접 읽어 확인) |
| 19 | 〃 | `setMapColliders` 호출자 | 1.8 | 씨앗 `roomUtils.js:11`, unknown 22 |
| 20 | 〃 | 속성 `isDoubleJumpUnlocked` 영향 | 1.8 | ambiguous, `player.js:12` 등 노드 5 |
| 21 | 〃 | 속성 `isBossDefeated` 영향 | 1.7 | ambiguous, 노드 9·관계 4(`room1.js:82` 보스 생성 조건 포함) |
| 22 | 〃 | 속성 `abilities` 영향(gib) | 2.3 | `Gib.js:18` 1곳만(읽기 쪽은 못 이음) |
| 23 | 〃 | 속성 `jumps` 영향(gib) | 2.3 | ambiguous, `Gib.js` 42·87·196·198행 |
| 24 | 〃 | 속성 `tiles` 영향(gib) | 2.2 | `Map.js:25` 1곳 |
| 25 | 〃 | 속성 `drill` 영향(gib) | 2.2 | ambiguous, 씨앗 8·`Gib.js` 109·133·161·167행 |

## 4. 알아낸 것 → 별우물 아래에서 한 것

| 기능 | 대상의 방식(REA·직접 읽기) | 별우물 아래 | 상태 |
|---|---|---|---|
| 방 전환 | jsmv: 지도 JSON 의 출구 사각형마다 충돌 구역을 만들고, 닿으면 화면 덮개를 0.3초 밀어 넣은 뒤 다음 장면으로 `exitName` 을 넘김. 새 방은 그 이름에 맞는 시작 자리에 주인공을 둠 | 방 = 지도 한 칸(30×17타일). 몸 가운데가 방 밖으로 나가면 그 쪽(L/R/T/B) 이웃 방을 불러오고, 반대쪽 문 자리(`spawnPoint`)에 세움. 0.25초 어둡게 넘김. 위로 나가면 위 방 바닥 구멍 옆에 섬 | 구현 |
| 능력 문 | jsmv: 보스 처치 → `isDoubleJumpUnlocked`·`isBossDefeated` 를 켜고 장벽 충돌체를 끔. gib: 아이템이 `abilities.xxx` 를 켜고, 이동·점프·드릴·사격 코드가 그 깃발을 매 프레임 확인 | 문 종류 7가지(벽 타기 기둥, 이단 점프 높은 문, 금 간 바위벽, 물굴, 금 간 바닥, 얼음, 보스·열쇠 문). 물리 함수가 능력 깃발을 직접 보고(벽 타기·이단 점프·대시·수영·내려찍기), 부수는 칸은 타일 종류로 표시 | 구현 |
| 충돌 | jsmv: kaboom 정적 몸체 + 통과 발판은 점프 중 충돌 해소를 건너뜀. gib: 타일 배열을 옆·위·아래 한 칸씩 확인 | 축 분리 이동(가로 → 세로), 한쪽 발판은 "이전 발밑이 발판 위였을 때만" 막음, ↓+점프로 내려가기, 코요테 0.08초·점프 기억 0.12초 | 구현 |
| 카메라 | jsmv: 가로는 주인공을 따라가되 방 끝에서 반 화면 폭으로 고정, 세로는 카메라 구역에 들어가면 0.8초 동안 목표 높이로 옮김 | 방 한 칸이 한 화면이라 카메라는 고정하고, 대신 방 넘김 연출과 흔들림만 둠. 큰 방 따라가기는 보류 | 일부(보류) |
| 이단 점프 | jsmv: 점프 횟수 1 → 2. gib: `jumps` 를 땅에서 0 으로, 누를 때 +1, 능력에 따라 1·2회 | 공중에서 한 번 더, 땅·벽에 붙으면 다시 채움 | 구현 |
| 부수는 벽 | gib: 벽돌 타일에 붙어 드릴 단추 | 대시로 금 간 바위벽, 내려찍기로 금 간 바닥, 불탄으로 얼음 | 구현 |
| 보스 | jsmv: 보스 방 들어가면 싸움 상태·장벽, 처치 → 보상·장벽 해제 | 보스 방에 들어서면 모든 문을 닫고, 쓰러뜨리면 열고 보상(능력·체력 조각·열쇠) 놓음. 보스 6마리 각자 다른 무늬 | 구현 |
| 체력 회복·강화 | jsmv: 체력 카트리지로 최대치까지 회복 | 별돌(저장·회복), 숨은 체력 조각(최대 +1), 탄 강화(세기 +0.5), 적이 가끔 떨구는 회복 방울 | 구현 |
| 지도 화면 | 두 대상 모두 없음 | 다녀온 방을 지역 색으로, 문 종류 색, 별돌·보스·남은 물건 표시, 수집 % | 구현(새로) |
| 저장 | jsmv: 메모리 상태만. gib: 없음 | localStorage(이어하기), 별돌에서 기록, 능력·물건은 얻는 즉시 기록 | 구현(새로) |
| 도달 검사 | 두 대상 모두 없음 | 게임과 같은 물리로 동작 묶음을 흉내 내는 검사기: 방마다 잠금, 지도 전체 순서, 갇힘 | 구현(새로) |

## 5. REA 로 알 수 없던 것(한계)

- ES 모듈 사이 호출을 앱 분석에서 잇지 못함: `import-reference-source` 는 import 관계 27·70 을 찾았지만 `analyze-javascript-application` 의 modules 는 0.
  그래서 `setExitZones`·`enableDoubleJump` 호출자 추적은 씨앗 하나만 돌려줌 — 실제 호출 자리는 파일을 직접 읽어 확인.
- kaboom 의 `k.add([...])` 구성 요소 배열과 `onCollide` 콜백 안 함수가 이름 없는 함수로 남아 jsmv 함수 94개 중 33개만 이름이 잡힘.
- 속성 추적은 대부분 ambiguous(객체 흐름 후보). 프레임마다 바뀌는 값(속도·타이머)의 크기는 알려 주지 않음.
- 지도(Tiled JSON·`map.txt`)를 받지 않았으므로 방 배치·능력 순서 설계는 비교하지 않음 — 이 저장소의 지도는 처음부터 새로 짬.
- 정적 분석이라 손맛(점프 높이·대시 거리)은 볼 수 없음 — 별우물 아래는 물리 단위 시험과 도달 검사기로 확인.

## 6. 남긴 것

- `evidence/rea-runs.json` — 25회 실행의 명령·시간·종료 코드·결과 크기·SHA-256
- `evidence/reference-source.summary.json` — 받은 파일 목록(경로·크기·해시)
- `evidence/app-analysis.summary.json` — 앱 분석 통계·함수 이름과 줄·리스너·상태 속성 순위
- `evidence/trace-summaries.json` — 기능·의미 추적의 씨앗 위치·닿은 줄·관계 종류
- `scripts/run-rea.sh`, `scripts/trace_inputs.py`, `scripts/facts.py` — 다시 만들기
