"""Render v7 at the identical 90-degree camera, entirely on the cloud runner."""
from pathlib import Path
import importlib.util
import json
import bpy

root=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('volume_study',root/'build.py')
study=importlib.util.module_from_spec(spec);spec.loader.exec_module(study)
bpy.ops.wm.open_mainfile(filepath=str(root/'previous/zibloo_flow_v7.blend'))
scene=bpy.context.scene
rig=bpy.data.objects['Zibloo_Rig']
body=bpy.data.objects['Zibloo_Quad_Skin']
previous=study.volume_measurements(body)
current=json.loads((root/'output/report.json').read_text())['volume']
comparison={'v7':previous,'v8':current,'ratios':{part:{key:current[part][key]/previous[part][key] for key in ['width','depth','height']} for part in current}}
assert comparison['ratios']['head_band']['depth']>.90,comparison
assert current['head_band']['depth_to_width']>1.05,comparison
(root/'output/volume-comparison.json').write_text(json.dumps(comparison,indent=2)+'\n')
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=16
scene.render.threads_mode='FIXED';scene.render.threads=2
scene.render.resolution_x=scene.render.resolution_y=768
scene.render.resolution_percentage=100
scene.camera.data.type='ORTHO';scene.camera.data.ortho_scale=7.6
scene.camera.location=(14,0,1.3);study.v2.base.look_at(scene.camera,(0,0,.15))
for name in ['Focus','Idle']:
 rig.animation_data.action=bpy.data.actions[name]
 scene.frame_set(49 if name=='Focus' else 1)
 scene.render.filepath=str(root/'output'/f'v7-{name.lower()}-profile.png')
 bpy.ops.render.render(write_still=True)
print(json.dumps(comparison))

scene.camera.location=(3,-14,3.1);study.v2.base.look_at(scene.camera,(0,0,.15))
rig.animation_data.action=bpy.data.actions['Focus'];scene.frame_set(49)
scene.render.filepath=str(root/'output/v7-focus.png');bpy.ops.render.render(write_still=True)
