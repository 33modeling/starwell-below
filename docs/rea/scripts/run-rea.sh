#!/usr/bin/env bash
# 별우물 아래 REA 분석 다시 하기: MIT 메트로배니아 웹 게임 두 개를 REA(rea-agents 6.8.0)로 정적 분석한다.
# 대상 코드는 내려받아 읽기만 한다(빌드·설치·실행 없음). 그림·소리·지도 데이터·엔진 폴더는 받지 않는다.
# 사용법: bash docs/rea/scripts/run-rea.sh <작업 폴더>   (Node 22, git, python3, bc 필요)
set -euo pipefail
WORK=${1:?작업 폴더를 지정하세요}
HERE=$(cd "$(dirname "$0")" && pwd)
REA="nice -n 10 npx -y rea-agents@6.8.0"
mkdir -p "$WORK/mv-target" "$WORK/mv-work"
T="$WORK/mv-target"

sparse() {  # sparse <폴더> <저장소> <커밋> <경로...>
  local dir=$1 repo=$2 commit=$3; shift 3
  [ -d "$T/$dir" ] && return 0
  git init -q "$T/$dir"
  git -C "$T/$dir" remote add origin "$repo"
  git -C "$T/$dir" sparse-checkout set --no-cone "$@"
  git -C "$T/$dir" fetch -q --depth 1 --filter=blob:none origin "$commit"
  git -C "$T/$dir" checkout -q FETCH_HEAD
}
# 1) 대상: 코드 경로만(지도 JSON·그림·소리·kaboom 라이브러리·셰이더·빌드 결과는 받지 않음)
sparse jsmv https://github.com/JSLegendDev/JavaScript-Metroidvania.git 5a2ef84de0978e790b0edf035cf5a5a1901fa44c \
  /src/ /index.html /README.MD /LICENSE
sparse gib https://github.com/attilahorvath/gib.git 2ecea116da3e1ae0a2aafe774b63e06ea197f4c7 \
  /src/ /index.html /README.md /LICENSE /package.json

cd "$WORK/mv-work"
rm -f runs.jsonl
rr() {  # rr <이름> <출력 파일> <명령...> : 시간·종료 코드·크기·SHA-256 을 runs.jsonl 에 남긴다
  local label=$1 out=$2; shift 2
  local start end code
  start=$(date +%s.%N)
  set +e; "$@" > "$out" 2> "${out%.json}.err"; code=$?; set -e
  end=$(date +%s.%N)
  python3 -I -c 'import json,sys,hashlib,os; p=sys.argv[5]; print(json.dumps({"label":sys.argv[1],"cmd":sys.argv[2],"exit":int(sys.argv[3]),"seconds":round(float(sys.argv[4]),1),"out":p,"bytes":os.path.getsize(p),"sha256":hashlib.sha256(open(p,"rb").read()).hexdigest()}, ensure_ascii=False))' \
    "$label" "$*" "$code" "$(echo "$end - $start" | bc)" "$out" >> runs.jsonl
  echo "[$label] exit=$code"
}

# 2) 소스 목록과 모듈 관계
rr ref-jsmv ref-source-jsmv.json $REA import-reference-source "$T/jsmv" --format json
rr ref-jsmv-summary ref-source-jsmv.summary.json $REA import-reference-source "$T/jsmv" --detail summary --outline-depth 3 --format json
rr ref-gib ref-source-gib.json $REA import-reference-source "$T/gib" --format json

# 3) JS 정적 분석(실행 없음)
( cd "$T/jsmv" && find src -name '*.js' | sort | python3 -I -c 'import json,sys; print(json.dumps([l.strip() for l in sys.stdin]))' ) > selection-jsmv.json
( cd "$T/gib" && find src -name '*.js' | sort | python3 -I -c 'import json,sys; print(json.dumps([l.strip() for l in sys.stdin]))' ) > selection-gib.json
for t in jsmv gib; do
  NODE_OPTIONS=--max-old-space-size=4096 rr "app-$t" "app-$t.json" $REA analyze-javascript-application "$T/$t" \
    --source-paths-json "$PWD/selection-$t.json" --max-semantic-nodes 300000 --max-semantic-unknowns 300000 --format json
done

# 4) 보기(view): 요약·모듈 참조·파일별 사실
for t in jsmv gib; do
  E="{\"kind\":\"evidence-file\",\"path\":\"app-$t.json\"}"
  echo "{\"source\":$E,\"view\":{\"kind\":\"summary\"}}" > "view-$t-summary.json"
  echo "{\"source\":$E,\"view\":{\"kind\":\"javascript\",\"collection\":\"modules\",\"projection\":\"references\",\"where\":{\"kind\":\"javascript-asset\"},\"offset\":0,\"limit\":64}}" > "view-$t-modules.json"
done
python3 -I - <<'PY'
import json
for t, paths in (('jsmv', ['src/scenes/roomUtils.js', 'src/entities/player.js', 'src/entities/enemyBoss.js', 'src/state/globalStateManager.js']),
                 ('gib', ['src/Gib.js', 'src/Map.js', 'src/SpriteController.js', 'src/items/Item.js'])):
    json.dump({'source': {'kind': 'evidence-file', 'path': f'app-{t}.json'},
               'view': {'kind': 'javascript-facts', 'where': {'paths': paths},
                        'property_keys': ['path', 'parse_status', 'bytes', 'analysis_status', 'syntax_status', 'semantic_status'],
                        'include_available_property_keys': True, 'offset': 0, 'limit': 64}}, open(f'view-{t}-facts.json', 'w'))
PY
for t in jsmv gib; do for v in summary modules facts; do
  NODE_OPTIONS=--max-old-space-size=4096 rr "view-$t-$v" "app-$t-$v-view.json" $REA inspect-analysis-view "view-$t-$v.json" --format json
done; done

# 5) 추적: 모듈 기준 기능 추적과 의미 추적(함수 호출자·상태 속성 영향)
python3 -I "$HERE/trace_inputs.py" "$WORK/mv-work"
for n in jsmv-roomutils jsmv-player gib-gib gib-map; do
  NODE_OPTIONS=--max-old-space-size=4096 rr "feature-$n" "trace-feature-$n.json" $REA trace-application-feature "trace-feature-$n-input.json" --format json
done
for n in jsmv-exitzones-callers jsmv-camerazones-callers jsmv-doublejump-callers jsmv-colliders-callers \
         jsmv-doublejump-property jsmv-bossdefeated-property gib-abilities-property gib-jumps-property gib-tiles-property gib-drill-callers; do
  NODE_OPTIONS=--max-old-space-size=4096 rr "sem-$n" "trace-semantics-$n.json" $REA trace-javascript-semantics "trace-semantics-$n-input.json" --format json
done

# 6) 요약(대상 코드 조각은 옮기지 않음)
python3 -I "$HERE/facts.py" "$WORK/mv-work" "$HERE/../evidence"
