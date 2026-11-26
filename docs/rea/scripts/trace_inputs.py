"""REA 추적 입력 만들기: 저장한 분석 결과(app-jsmv.json·app-gib.json)만 읽어 trace-*-input.json 을 쓴다."""
import json, os, sys

W = sys.argv[1]
os.chdir(W)
ev = {k: json.load(open(f'app-{k}.json')) for k in ('jsmv', 'gib')}


def fp(e, name, suffix):
    sg = e['normalized_result']['semantic_graph']
    node = next(n for n in sg['nodes'] if n['kind'] == 'function' and (n.get('properties') or {}).get('name') == name
                and n['identity']['module_path'].endswith(suffix))
    return next(f['fingerprint_sha256'] for f in sg['fingerprints'] if f['function_node_id'] == node['node_id'])


feature = {
    'jsmv-roomutils': ('jsmv', 'src/scenes/roomUtils.js'),
    'jsmv-player': ('jsmv', 'src/entities/player.js'),
    'gib-gib': ('gib', 'src/Gib.js'),
    'gib-map': ('gib', 'src/Map.js'),
}
for name, (k, module) in feature.items():
    json.dump({'application': ev[k], 'seed': {'kind': 'module', 'value': module, 'match': 'exact'}, 'direction': 'both'},
              open(f'trace-feature-{name}-input.json', 'w'))

semantic = {
    'jsmv-exitzones-callers': ('jsmv', {'kind': 'function', 'fingerprint_sha256': fp(ev['jsmv'], 'setExitZones', 'src/scenes/roomUtils.js')}, 'callers'),
    'jsmv-camerazones-callers': ('jsmv', {'kind': 'function', 'fingerprint_sha256': fp(ev['jsmv'], 'setCameraZones', 'src/scenes/roomUtils.js')}, 'callers'),
    'jsmv-doublejump-callers': ('jsmv', {'kind': 'function', 'fingerprint_sha256': fp(ev['jsmv'], 'enableDoubleJump', 'src/entities/player.js')}, 'callers'),
    'jsmv-colliders-callers': ('jsmv', {'kind': 'function', 'fingerprint_sha256': fp(ev['jsmv'], 'setMapColliders', 'src/scenes/roomUtils.js')}, 'callers'),
    'jsmv-doublejump-property': ('jsmv', {'kind': 'property', 'name': 'isDoubleJumpUnlocked'}, 'forward-influence'),
    'jsmv-bossdefeated-property': ('jsmv', {'kind': 'property', 'name': 'isBossDefeated'}, 'forward-influence'),
    'gib-abilities-property': ('gib', {'kind': 'property', 'name': 'abilities'}, 'forward-influence'),
    'gib-jumps-property': ('gib', {'kind': 'property', 'name': 'jumps'}, 'forward-influence'),
    'gib-tiles-property': ('gib', {'kind': 'property', 'name': 'tiles'}, 'forward-influence'),
    'gib-drill-callers': ('gib', {'kind': 'property', 'name': 'drill'}, 'forward-influence'),
}
for name, (k, seed, direction) in semantic.items():
    json.dump({'application': ev[k], 'query': {'seed': seed, 'direction': direction, 'include_ambiguous_dynamic_edges': True}},
              open(f'trace-semantics-{name}-input.json', 'w'))
print('ok', list(feature), list(semantic))
