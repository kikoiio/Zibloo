"""Render v4 at the identical 90-degree camera, entirely on the cloud runner."""
from pathlib import Path
import importlib.util
import json
import bpy

root=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('volume_study',root/'build.py')
study=importlib.util.module_from_spec(spec);spec.loader.exec_module(study)
bpy.ops.wm.open_mainfile(filepath=str(root/'previous/zibloo_flow_v4.blend'))
scene=bpy.context.scene
rig=bpy.data.objects['Zibloo_Rig']
body=bpy.data.objects['Zibloo_Quad_Skin']
previous=study.volume_measurements(body)
current=json.loads((root/'output/report.json').read_text())['volume']
comparison={'v4':previous,'v5':current,'ratios':{part:{key:current[part][key]/previous[part][key] for key in ['width','depth','height']} for part in current}}
assert comparison['ratios']['head_band']['depth']>1.28,comparison
assert comparison['ratios']['body']['depth']>1.45,comparison
(root/'output/volume-comparison.json').write_text(json.dumps(comparison,indent=2)+'\n')
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=24
scene.render.threads_mode='FIXED';scene.render.threads=2
scene.render.resolution_x=scene.render.resolution_y=768
scene.render.resolution_percentage=100
scene.camera.data.type='ORTHO';scene.camera.data.ortho_scale=6.8
scene.camera.location=(14,0,1.3);study.v2.base.look_at(scene.camera,(0,0,.15))
for name in ['Focus','Idle']:
 rig.animation_data.action=bpy.data.actions[name]
 scene.frame_set(49 if name=='Focus' else 1)
 scene.render.filepath=str(root/'output'/f'v4-{name.lower()}-profile.png')
 bpy.ops.render.render(write_still=True)
print(json.dumps(comparison))
