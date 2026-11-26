"""REA 결과 요약: 작업 폴더의 REA JSON 만 읽어 docs/rea/evidence/ 에 요약 파일을 쓴다.

분석 대상은 MIT 지만 코드를 옮기지 않는 원칙에 따라 대상 코드 조각(식·문장)은 남기지 않는다. 남기는 것은
개수, 파일 경로·줄 번호, 식별자 이름(함수·속성), REA 가 붙인 관계 종류와 한계 문구뿐이다.
사용법: python3 -I facts.py <작업 폴더> <evidence 폴더>
"""
import collections, hashlib, json, os, sys

W, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
J = lambda f: json.load(open(os.path.join(W, f)))


def dump(name, obj):
    with open(os.path.join(OUT, name), 'w', encoding='utf-8') as fh:
        json.dump(obj, fh, ensure_ascii=False, indent=1)
        fh.write('\n')


def line(n):
    sr = (n.get('identity') or {}).get('source_range')
    return sr['start']['line'] if sr else None


def loc(n):
    v = ((n.get('evidence') or {}).get('location') or {}).get('value') or {}
    s = v.get('start') or {}
    return f"{v.get('source')}:{s.get('line')}" if s else None


# 1) 소스 목록(파일 경로·언어·크기·해시)
ref = {}
for t in ('jsmv', 'gib'):
    d = J(f'ref-source-{t}.json')
    ref[t] = {
        'schema': d.get('schema'), 'inventory_state': d.get('inventory_state'), 'languages': d.get('languages'),
        'files': [{k: e.get(k) for k in ('path', 'language', 'size', 'sha256', 'classifications')} for e in d['entries'] if e.get('kind') == 'file'],
        'relationships': len(d.get('relationships') or []), 'parse_failures': len(d.get('parse_failures') or []),
        'vcs_head': (d.get('vcs') or {}).get('head'),
    }
dump('reference-source.summary.json', ref)

# 2) 앱 분석 요약
apps = {}
for t in ('jsmv', 'gib'):
    ev = J(f'app-{t}.json')
    nr = ev['normalized_result']
    sg = nr['semantic_graph']
    g = nr['graph']
    fns = collections.defaultdict(list)
    for n in sg['nodes']:
        if n['kind'] == 'function':
            fns[n['identity']['module_path']].append({'name': (n.get('properties') or {}).get('name'), 'line': line(n)})
    for v in fns.values():
        v.sort(key=lambda x: x['line'] or 0)
    props = collections.Counter()
    for n in sg['nodes']:
        if n['kind'] == 'property-slot':
            nm = (n.get('properties') or {}).get('name')
            if isinstance(nm, str) and nm.isidentifier():
                props[(n['identity']['module_path'], nm)] += 1
    apps[t] = {
        'evidence_id': ev['evidence_id'],
        'statistics': nr['statistics'],
        'application_graph': {'nodes': dict(collections.Counter(n['kind'] for n in g['nodes'])),
                              'edges': dict(collections.Counter((e.get('properties') or {}).get('kind') or 'contains' for e in g['edges'])),
                              'limitations': g.get('limitations')},
        'semantic_graph': {
            'nodes': dict(collections.Counter(n['kind'] for n in sg['nodes'])),
            'relations': dict(collections.Counter(r['relation'] for r in sg['relations'])),
            'resolution': dict(collections.Counter(r['resolution'] for r in sg['relations'])),
            'fingerprints': len(sg['fingerprints']),
            'unknowns': {f'{a}/{b}': c for (a, b), c in collections.Counter((u.get('family'), u.get('reason')) for u in sg['unknowns']).most_common()},
        },
        'functions': fns,
        'functions_named': sum(1 for v in fns.values() for f in v if f['name']),
        'functions_total': sum(len(v) for v in fns.values()),
        'listeners': [{'module': n['identity']['module_path'], 'line': line(n), 'event': (n.get('properties') or {}).get('event_name'),
                       'method': (n.get('properties') or {}).get('method')} for n in sg['nodes'] if n['kind'] == 'listener'],
        'timers': [{'module': n['identity']['module_path'], 'line': line(n), 'method': (n.get('properties') or {}).get('method')}
                   for n in sg['nodes'] if n['kind'] == 'timer'],
        'state_properties_top': [{'module': m, 'name': nm, 'slots': c} for (m, nm), c in props.most_common(80)],
        'require_like_edges': sum(1 for e in g['edges'] if (e.get('properties') or {}).get('kind') == 'require'),
    }
dump('app-analysis.summary.json', apps)

# 3) 추적 요약(씨앗·도달한 줄·관계 종류·모르는 것)
traces = {}
for f in sorted(os.listdir(W)):
    if not f.startswith('trace-') or f.endswith('-input.json') or not f.endswith('.json'):
        continue
    d = J(f)
    nr = d['normalized_result']
    name = f[len('trace-'):-len('.json')]
    if f.startswith('trace-semantics-'):
        nodes = {n['node_id']: n for n in nr['nodes']}
        traces[name] = {
            'seed': nr.get('seed'), 'direction': nr.get('direction'), 'status': nr.get('status'), 'summary': nr.get('summary'),
            'seed_locations': sorted({loc(nodes[i]) for i in nr['seed_node_ids'] if i in nodes and loc(nodes[i])}),
            'reached_locations': sorted({loc(n) for n in nr['nodes'] if loc(n)}),
            'relations': dict(collections.Counter(f"{r['relation']}/{r['resolution']}" for r in nr['relations'])),
            'unknowns': dict(collections.Counter(f"{u.get('family')}/{u.get('reason')}" for u in nr['unknowns'])),
        }
    else:
        traces[name] = {'kind': 'trace-application-feature', 'keys': sorted(nr.keys()),
                        'summary': nr.get('summary'), 'coverage': nr.get('coverage'),
                        'limitations': nr.get('limitations')}
dump('trace-summaries.json', traces)

# 4) 실행 기록(크기·SHA-256)
runs = [json.loads(l) for l in open(os.path.join(W, 'runs.jsonl'))]
committed = {'ref-source-jsmv.summary.json': 'reference-source.summary.json (요약에 포함)'}
dump('rea-runs.json', {
    'tool': 'rea-agents 6.8.0 (npx, 전역 설치·MCP 설정·setup 없음)',
    'node': os.popen('node --version').read().strip(),
    'targets': {
        'jsmv': {'repo': 'https://github.com/JSLegendDev/JavaScript-Metroidvania', 'commit': '5a2ef84de0978e790b0edf035cf5a5a1901fa44c', 'license': 'MIT (Copyright (c) 2024 JSLegend)',
                 'sparse_paths': ['/src/', '/index.html', '/README.MD', '/LICENSE'],
                 'excluded': ['assets/(그림·글꼴·소리)', 'maps/(Tiled 방 지도 JSON)', 'lib/(kaboom.js 라이브러리)']},
        'gib': {'repo': 'https://github.com/attilahorvath/gib', 'commit': '2ecea116da3e1ae0a2aafe774b63e06ea197f4c7', 'license': 'MIT (Copyright (c) 2018 Attila Horváth)',
                'sparse_paths': ['/src/', '/index.html', '/README.md', '/LICENSE', '/package.json'],
                'excluded': ['assets/(그림·map.txt 지도)', 'shaders/', 'build/(번들)', 'package-lock.json']},
    },
    'note': '큰 결과와 대상 코드 조각이 든 결과는 저장소에 넣지 않았다(bytes·sha256 만). 같은 명령(scripts/run-rea.sh)으로 다시 만들어 SHA-256 으로 대조한다. trace-*-input.json 은 app-*.json 을 그대로 감싼 입력이라 따로 적지 않았다.',
    'runs': [{'label': r['label'], 'command': 'npx -y rea-agents@6.8.0 ' + r['cmd'].split('rea-agents@6.8.0 ', 1)[-1].replace(W, '<work>').replace(os.path.dirname(W) + '/mv-target', '<target>'),
              'exit': r['exit'], 'seconds': r['seconds'], 'output': {'file': r['out'], 'bytes': r['bytes'], 'sha256': r['sha256']}} for r in runs],
})
print('wrote', sorted(os.listdir(OUT)))
