"""Render v8 actions with a transparent film for sprite-sheet studies."""
from pathlib import Path
import json
import bpy

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
SOURCE = ROOT / 'output' / 'zibloo_flow_v8.blend'
OUT = HERE / 'frames'
OUT.mkdir(parents=True, exist_ok=True)

# Keep only the character rig family, lights, and camera visible. The archived
# review scene includes unnamed studio geometry that otherwise blocks alpha.
character_prefixes = ('Zibloo_', 'Source_', 'Eye_', 'HappyEye_', 'Key', 'Fill', 'Rim')
for item in bpy.data.objects:
    keep = item.type in {'LIGHT', 'CAMERA', 'ARMATURE'} or item.name.startswith(character_prefixes)
    item.hide_render = not keep
    item.hide_viewport = not keep

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 16
scene.render.resolution_x = scene.render.resolution_y = 640
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.image_settings.color_depth = '8'
scene.view_settings.view_transform = 'Standard'
scene.render.fps = 16
scene.render.threads_mode = 'FIXED'
scene.render.threads = 2

camera = scene.camera
if camera is None:
    raise RuntimeError('v8 blend has no active camera')
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 7.6
camera.location = (3.0, -12.0, 1.35)
camera.rotation_euler = (1.35, 0.0, 0.0)

clips = {}
for action in bpy.data.actions:
    name = action.name.lower()
    for clip in ('idle', 'greeting', 'focus', 'celebrate'):
        if clip in name:
            clips[clip] = action
if set(clips) != {'idle', 'greeting', 'focus', 'celebrate'}:
    raise RuntimeError(f'missing actions: {sorted(set(clips))}')

# Every clip has more source samples than needed; uniformly take 16 loop samples.
sampled = {}
for clip, action in clips.items():
    target = OUT / clip
    target.mkdir(exist_ok=True)
    end = int(action.frame_range[1])
    frames = [round(1 + i * (end - 1) / 16) for i in range(16)]
    sampled[clip] = frames
    # Assign action to the rendered rig through the scene's animation data.
    if scene.animation_data is None:
        scene.animation_data_create()
    scene.animation_data.action = None
    for obj in bpy.context.scene.objects:
        if obj.animation_data is not None and action in {a.action for a in obj.animation_data.nla_tracks if a.action}:
            obj.animation_data.action = action
    for frame in frames:
        scene.frame_set(frame)
        scene.render.filepath = str(target / f'{frames.index(frame):02d}.png')
        bpy.ops.render.render(write_still=True)

(HERE / 'render-report.json').write_text(json.dumps({
    'source': str(SOURCE),
    'resolution': 640,
    'film_transparent': True,
    'clips': {clip: {'frames': sampled[clip], 'action': clips[clip].name} for clip in sorted(clips)},
}, indent=2))
