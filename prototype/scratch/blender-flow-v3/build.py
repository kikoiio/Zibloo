"""Editable quad form study, deterministic segment rig and four baked actions.

Run with Blender 4.5 LTS on the authorized cloud runner, not the desktop GPU.
"""
import argparse
import importlib.util
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Matrix, Vector
from mathutils.kdtree import KDTree

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("flow2", HERE.parent / "blender-flow-v2/build.py")
v2 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v2)
from geometry import sweep, catmull, dot, sub

CLIPS = {"Idle": 96, "Greeting": 64, "Focus": 96, "Celebrate": 64}
SEGMENTS = 9


def source_arms():
    arms = []
    for i, (name, points, widths) in enumerate(v2.ARMS):
        points = [list(p) for p in points]
        # Depth is a real shape change, rather than a camera trick. Background
        # arms sit behind the two foreground gesture lines in the hero view.
        for j, p in enumerate(points):
            t = j / (len(points)-1)
            if i >= 4:
                p[1] += .62 * math.sin(t*math.pi*.7)
                if i == 7:
                    p[0] = p[0]*(1-.15*t)
                    p[2] -= .20*t
            elif i == 1:
                p[1] -= .18*math.sin(t*math.pi)
            elif i == 2:
                p[1] -= .18*t
        arms.append((name, points, widths))
    return arms


ARMS = source_arms()


def resample(points, count=SEGMENTS+1):
    dense = [Vector(p) for p in catmull(points, 14)]
    lengths = [0.]
    for a, b in zip(dense, dense[1:]):
        lengths.append(lengths[-1]+(b-a).length)
    result = []
    j = 0
    for i in range(count):
        distance = lengths[-1]*i/(count-1)
        while j < len(dense)-2 and lengths[j+1] < distance:
            j += 1
        t = (distance-lengths[j])/max(lengths[j+1]-lengths[j], 1e-8)
        result.append(dense[j].lerp(dense[j+1], t))
    return result


def frame(head, tail):
    return Matrix.Translation(head) @ (tail-head).to_track_quat("Y", "Z").to_matrix().to_4x4()


def build_skin():
    source = bpy.data.collections.new("EDITABLE_Source_Forms")
    bpy.context.scene.collection.children.link(source)
    parts = [v2.mantle()]
    samples = []
    for name, points, widths in ARMS:
        vertices, faces, frames = sweep(points, widths, sides=20, steps=10, depth=.78)
        parts.append(v2.mesh_object(name, vertices, faces))
        samples.extend(frames)
        curve = bpy.data.curves.new(name+"_Path", "CURVE")
        curve.dimensions = "3D"
        spline = curve.splines.new("BEZIER")
        spline.bezier_points.add(len(points)-1)
        for bp, point, radius in zip(spline.bezier_points, points, widths):
            bp.co = point
            bp.handle_left_type = bp.handle_right_type = "AUTO"
            bp.radius = radius
        obj = bpy.data.objects.new(name+"_Path", curve)
        source.objects.link(obj)
    for part in parts:
        copy = part.copy()
        copy.data = part.data.copy()
        copy.name = "Source_"+part.name
        source.objects.link(copy)
    source.hide_render = True
    source.hide_viewport = True
    bpy.ops.object.select_all(action="DESELECT")
    for part in parts:
        part.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    body = bpy.context.object
    body.name = "Zibloo_Quad_Skin"
    remesh = body.modifiers.new("Continuous root union", "REMESH")
    remesh.mode = "VOXEL"
    remesh.voxel_size = .034
    remesh.use_smooth_shade = True
    bpy.ops.object.modifier_apply(modifier=remesh.name)
    smooth = body.modifiers.new("Relax arm junctions", "SMOOTH")
    smooth.factor, smooth.iterations = .65, 6
    bpy.ops.object.modifier_apply(modifier=smooth.name)
    # QuadriFlow is an automatic starting cage, not an artist-approved final
    # deformation topology. Preserve it in the .blend for further loop editing.
    bpy.ops.object.quadriflow_remesh(target_faces=4800, seed=17)
    quad_count = sum(len(p.vertices)==4 for p in body.data.polygons)
    assert quad_count/max(len(body.data.polygons),1) > .95, "QuadriFlow did not produce a quad cage"
    cage_faces = len(body.data.polygons)
    # Store smooth color on the cage; subdivision interpolates it continuously.
    tree = KDTree(len(samples))
    for i, (center, _, _) in enumerate(samples):
        tree.insert(center, i)
    tree.balance()
    color = body.data.color_attributes.new(name="BellyColor", type="FLOAT_COLOR", domain="POINT")
    for vertex in body.data.vertices:
        co = tuple(vertex.co)
        _, index, distance = tree.find(co)
        center, radius, (side, belly) = samples[index]
        delta = sub(co, center)
        value = .94*dot(delta, side)/radius + .34*dot(delta, belly)/(radius*.78)
        amount = max(0., min(1., (value-.20)/.70))
        amount = amount*amount*(3-2*amount)
        fade = max(0., min(1., max((.15-co[2])/.40, (math.hypot(center[0], center[1])-.40)/.55)))
        gate = max(0., min(1., (1.45-distance/radius)/.35))
        amount *= fade*gate
        color.data[vertex.index].color = tuple(a*(1-amount)+b*amount for a,b in zip(v2.TEAL,v2.MINT))+(1.,)
    material = v2.base.mat_principled("Teal_Mint_Smooth_PBR", (1,1,1), roughness=.47, sss=.10, sheen=.06)
    node = material.node_tree.nodes.new("ShaderNodeVertexColor")
    node.layer_name = "BellyColor"
    shader = next(n for n in material.node_tree.nodes if n.type=="BSDF_PRINCIPLED")
    material.node_tree.links.new(node.outputs["Color"], shader.inputs["Base Color"])
    body.data.materials.clear()
    body.data.materials.append(material)
    for p in body.data.polygons:
        p.use_smooth = True
    body["quad_cage_faces"] = cage_faces
    return body, source, samples


def make_rig(body, samples):
    data = bpy.data.armatures.new("Zibloo_Prototype_Rig")
    rig = bpy.data.objects.new("Zibloo_Rig", data)
    bpy.context.collection.objects.link(rig)
    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")
    root = data.edit_bones.new("Root")
    root.head, root.tail = (0,0,0), (0,0,.35)
    head = data.edit_bones.new("Head")
    head.head, head.tail, head.parent = (0,0,.50), (0,0,2.1), root
    orb = data.edit_bones.new("Orb")
    orb.head, orb.tail, orb.parent = (2.12,-.04,1.01), (2.12,-.04,1.26), root
    chains = []
    for arm_index, (_, points, _) in enumerate(ARMS):
        line = resample(points)
        chain = []
        for i, (a,b) in enumerate(zip(line,line[1:])):
            bone = data.edit_bones.new(f"Arm{arm_index+1:02}_{i+1:02}")
            bone.head, bone.tail = a,b
            bone.matrix = frame(a,b)
            bone.length = (b-a).length
            # Independent deform segments follow sampled path controls. Their
            # transforms are baked, so the GLB needs no Blender IK constraints.
            bone.parent = root
            chain.append((bone.name,a.copy(),b.copy()))
        chains.append(chain)
    bpy.ops.object.mode_set(mode="OBJECT")
    rig.show_in_front = True
    rig.data.display_type = "STICK"
    for bone in rig.pose.bones:
        bone.rotation_mode = "QUATERNION"
    groups = {bone.name:body.vertex_groups.new(name=bone.name) for bone in rig.data.bones}
    points = []
    for arm_index, chain in enumerate(chains):
        for segment, (name,a,b) in enumerate(chain):
            for j in range(5):
                points.append((a.lerp(b,j/4), arm_index, segment, j/4))
    tree = KDTree(len(points))
    for i, (p,*_) in enumerate(points): tree.insert(p,i)
    tree.balance()
    max_error = 0.
    for vertex in body.data.vertices:
        co = vertex.co
        _, index, distance = tree.find(co)
        _, arm_index, segment, t = points[index]
        widths = ARMS[arm_index][2]
        radius = sum(widths)/len(widths)
        surface = max(0.,min(1.,(1.6-distance/radius)/.6))
        fade = max(0., min(1., max((.18-co.z)/.55,(math.hypot(co.x,co.y)-.38)/.65)))
        arm_weight = surface*fade
        # Interpolate between segment centers to avoid rigid ring boundaries.
        coordinate = segment+t-.5
        lo = max(0,min(SEGMENTS-1,math.floor(coordinate)))
        hi = max(0,min(SEGMENTS-1,math.floor(coordinate)+1))
        fraction = coordinate-math.floor(coordinate)
        weights = {}
        for part, amount in [(lo,1-fraction),(hi,fraction)]:
            name = chains[arm_index][part][0]
            weights[name] = weights.get(name,0)+arm_weight*amount
        head_weight = max(0.,min(1.,(co.z-.40)/.55))*(1-arm_weight)
        weights["Head"] = head_weight
        weights["Root"] = 1-arm_weight-head_weight
        for name,weight in weights.items():
            if weight>1e-7: groups[name].add([vertex.index],weight,"REPLACE")
        max_error=max(max_error,abs(sum(weights.values())-1))
    modifier = body.modifiers.new("Skin deformation", "ARMATURE")
    modifier.object = rig
    modifier.use_deform_preserve_volume = False
    # Deform the low quad cage first; finish the surface after deformation.
    finish = body.modifiers.new("Surface finish", "SUBSURF")
    finish.levels = finish.render_levels = 1
    body.parent = rig
    return rig, chains, max_error


def attach(obj, rig, bone):
    group = obj.vertex_groups.new(name=bone)
    group.add(list(range(len(obj.data.vertices))),1.,"REPLACE")
    modifier = obj.modifiers.new("Rigid bone follow", "ARMATURE")
    modifier.object = rig
    obj.parent = rig


def pose_points(arm_index, clip, phase):
    points = [Vector(p) for p in ARMS[arm_index][1]]
    wave = math.sin(phase*2*math.pi)
    envelope = math.sin(phase*math.pi)**2
    for j, p in enumerate(points):
        t = j/(len(points)-1)
        influence = t*t*(3-2*t)
        p.y += .045*influence*math.sin(phase*2*math.pi+arm_index*.55)
        p.z += .035*influence*wave
        if clip == "Greeting" and arm_index == 0:
            p.z += 1.05*influence*envelope
            p.x += .22*influence*envelope*math.sin(phase*6*math.pi)
            p.y -= .18*influence*envelope
        elif clip == "Focus":
            # Front left and front right gather around a low central orb.
            if arm_index == 1:
                p.x += 1.85*influence
                p.z += 2.00*influence
                p.y -= .12*influence
            if arm_index == 2:
                p.x -= 1.05*influence
                p.z -= .35*influence
                p.y -= .20*influence
            if arm_index == 3:
                p.x -= .45*influence
                p.z -= .35*influence
            p.z += .018*influence*wave
        elif clip == "Celebrate":
            p.x *= 1+.10*envelope*t
            p.z += .45*influence*envelope
            p.y += .20*influence*math.sin(phase*2*math.pi+arm_index)
    return resample(points)


def animate(rig, chains):
    rig.animation_data_create()
    actions = {}
    for clip, length in CLIPS.items():
        action = bpy.data.actions.new(clip)
        action.use_fake_user = True
        rig.animation_data.action = action
        for step in range(17):
            phase = step/16
            frame_number = 1+length*phase
            wave = math.sin(phase*2*math.pi)
            envelope = math.sin(phase*math.pi)**2
            lift = .055*wave if clip!="Celebrate" else .35*envelope
            turn = .025*wave if clip!="Celebrate" else .12*wave
            root_matrix = Matrix.Translation((0,0,lift)) @ Matrix.Rotation(turn,4,"Z")
            rig.pose.bones["Root"].matrix = root_matrix @ rig.data.bones["Root"].matrix_local
            bpy.context.view_layer.update()
            head = rig.pose.bones["Head"]
            head.matrix = root_matrix @ rig.data.bones["Head"].matrix_local @ Matrix.Rotation(.025*wave,4,"X")
            for arm_index, chain in enumerate(chains):
                line = pose_points(arm_index,clip,phase)
                for i,(name,a,b) in enumerate(chain):
                    ratio = (line[i+1]-line[i]).length/(b-a).length
                    rig.pose.bones[name].matrix = root_matrix @ frame(line[i],line[i+1]) @ Matrix.Diagonal((1,ratio,1,1))
            orb = rig.pose.bones["Orb"]
            orb_center = Vector((1.10,-.62,.48+.025*wave))
            orb.matrix = root_matrix @ Matrix.Translation(orb_center) @ Matrix.Diagonal((1,1,1,1) if clip=="Focus" else (.001,.001,.001,1))
            for bone in rig.pose.bones:
                bone.keyframe_insert("location",frame=frame_number,group=bone.name)
                bone.keyframe_insert("rotation_quaternion",frame=frame_number,group=bone.name)
                bone.keyframe_insert("scale",frame=frame_number,group=bone.name)
        actions[clip] = action
    return actions


def select_action(rig, action, frame_number):
    rig.animation_data.action = action
    bpy.context.scene.frame_set(frame_number)
    bpy.context.view_layer.update()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default=str(HERE/"output"))
    args = parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    output = Path(args.output).resolve()
    output.mkdir(parents=True,exist_ok=True)
    v2.base.clear_scene()
    body, source, samples = build_skin()
    rig, chains, weight_error = make_rig(body,samples)
    ink = v2.base.mat_principled("Ink",v2.linear("0E1D1E"),roughness=.30)
    ivory = v2.base.mat_principled("Ivory",v2.linear("F3F8F5"),roughness=.32)
    for x in (-.34,.30):
        attach(v2.base.add_uv("Eye",(x,-.837,1.40),(.083,.048,.17),ink,24,16),rig,"Head")
        attach(v2.base.add_uv("Highlight",(x-.02,-.881,1.46),(.022,.012,.038),ivory,16,10),rig,"Head")
    orb_mat = v2.base.mat_principled("Jade_Orb",v2.linear("EAF8F5"),roughness=.25,
                                    sss=.08,transmission=.10,emission=(.12,.22,.19))
    attach(v2.base.add_uv("Focus_Orb",(2.12,-.04,1.01),(.30,.30,.30),orb_mat,28,18),rig,"Orb")
    assets = [obj for obj in bpy.context.scene.objects if obj.type=="MESH" and obj.parent==rig]
    actions = animate(rig,chains)
    ground_mat = v2.base.mat_principled("Warm_Studio",v2.linear("EFECE4"),roughness=.85)
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-2.62))
    ground = bpy.context.object
    ground.name="Studio_Ground"
    ground.data.materials.append(ground_mat)
    v2.base.add_light("Key",(-3,-4,7),650,(1,.96,.90),5)
    v2.base.add_light("Fill",(4,-2,3),240,(.88,.96,1),4)
    v2.base.add_light("Rim",(1,4,5),700,(.85,1,.96),3)
    scene=bpy.context.scene
    scene.world.use_nodes=True
    scene.world.node_tree.nodes.get("Background").inputs["Color"].default_value=(*v2.linear("EFECE4"),1)
    scene.world.node_tree.nodes.get("Background").inputs["Strength"].default_value=.3
    camera_data=bpy.data.cameras.new("Review_Camera")
    camera=bpy.data.objects.new("Review_Camera",camera_data)
    bpy.context.collection.objects.link(camera)
    scene.camera=camera
    camera_data.type="ORTHO";camera_data.ortho_scale=6.8
    camera.location=(3,-14,3.1);v2.base.look_at(camera,(0,0,.15))
    scene.render.engine="CYCLES";scene.cycles.device="CPU"
    scene.cycles.samples=24;scene.cycles.use_denoising=True
    scene.render.threads_mode="FIXED";scene.render.threads=2
    scene.render.resolution_x=scene.render.resolution_y=768
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format="PNG";scene.render.image_settings.color_mode="RGBA"
    scene.view_settings.view_transform="AgX";scene.view_settings.look="AgX - Medium High Contrast"
    scene.render.fps=24
    scene["prototype_note"]="Automatic quad cage and baked segment rig; manual production retopology remains"
    select_action(rig,actions["Idle"],1)
    scene.frame_start,scene.frame_end=1,97
    bpy.ops.wm.save_as_mainfile(filepath=str(output/"zibloo_flow_v3.blend"))
    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    for obj in assets:obj.select_set(True)
    bpy.context.view_layer.objects.active=rig
    bpy.ops.export_scene.gltf(filepath=str(output/"zibloo_flow_v3.glb"),export_format="GLB",use_selection=True,
        export_apply=True,export_cameras=False,export_lights=False,export_skins=True,
        export_vertex_color="NAME",export_vertex_color_name="BellyColor",
        export_animations=True,export_animation_mode="ACTIONS",export_force_sampling=True,
        export_frame_range=False,export_anim_single_armature=True,export_optimize_animation_size=True)
    evaluated_stats={}
    for clip,length in CLIPS.items():
        selected_frame=1+round(length*(.42 if clip=="Greeting" else .5))
        select_action(rig,actions[clip],selected_frame)
        evaluated=body.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh()
        bounds=[(min(v.co[i] for v in evaluated.vertices),max(v.co[i] for v in evaluated.vertices)) for i in range(3)]
        assert all(math.isfinite(x) for axis in bounds for x in axis),"Invalid deformed vertices"
        assert max(b-a for a,b in bounds)<9,"Exploding skin"
        evaluated_stats[clip]={"bounds":bounds,"vertices":len(evaluated.vertices)}
        body.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh_clear()
        scene.render.filepath=str(output/(clip.lower()+".png"))
        bpy.ops.render.render(write_still=True)
    select_action(rig,actions["Focus"],49)
    camera.location=(12,-3,2);v2.base.look_at(camera,(0,0,.15))
    scene.render.filepath=str(output/"focus-side.png");bpy.ops.render.render(write_still=True)
    camera.location=(3,-14,3.1);v2.base.look_at(camera,(0,0,.15))
    ground.hide_render=True;scene.render.film_transparent=True
    scene.render.filepath=str(output/"focus-transparent.png");bpy.ops.render.render(write_still=True)
    ground.hide_render=False;scene.render.film_transparent=False
    scene.render.resolution_x=scene.render.resolution_y=320
    scene.cycles.samples=8
    for clip,length in CLIPS.items():
        folder=output/"frames"/clip.lower();folder.mkdir(parents=True,exist_ok=True)
        for i in range(16):
            select_action(rig,actions[clip],1+round(length*i/16))
            scene.render.filepath=str(folder/f"{i:02}.png")
            bpy.ops.render.render(write_still=True)
    report={"blender":bpy.app.version_string,"quad_cage_faces":body["quad_cage_faces"],
        "quad_cage_vertices":len(body.data.vertices),"bones":len(rig.data.bones),
        "clips":CLIPS,"weight_normalization_error":weight_error,"evaluated":evaluated_stats,
        "glb_bytes":(output/"zibloo_flow_v3.glb").stat().st_size,
        "rig_method":"independent deform segments driven by sampled 3D paths; baked transforms",
        "topology_method":"automatic QuadriFlow cage, subdivision after skinning",
        "source_collection":"EDITABLE_Source_Forms"}
    (output/"report.json").write_text(json.dumps(report,indent=2)+"\n")
    print(json.dumps(report))


if __name__=="__main__":main()
