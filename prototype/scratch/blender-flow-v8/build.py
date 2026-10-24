"""Editable quad form study, deterministic segment rig and four baked actions.

Run with Blender 4.5 LTS on the authorized cloud runner, not the desktop GPU.
"""
import argparse
from collections import Counter
import importlib.util
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Matrix, Vector
from mathutils.kdtree import KDTree
from mathutils.bvhtree import BVHTree

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("flow2", HERE.parent / "blender-flow-v2/build.py")
v2 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v2)
from geometry import sweep, catmull, dot, sub

CLIPS = {"Idle": 96, "Greeting": 64, "Focus": 96, "Celebrate": 64}
SEGMENTS = 12
HEAD_DEPTH_SCALE = 1.32
HEAD_WIDTH_SCALE = .92
ARM_DEPTH = .98
PALETTES = {
    'teal': ('236E69','A3D9C9'),
    'sand': ('B69A68','F1E4C9'),
    'rust': ('A45338','E6B58A'),
    'ink': ('433D35','B8ADA0'),
}


def source_arms():
    arms = []
    for i, (name, points, widths) in enumerate(v2.ARMS):
        points = [list(p) for p in points]
        # The eight gesture lines occupy a volume around the body, with real
        # forward and backward reach instead of nearly parallel X/Z curves.
        depth_offsets = [-.60,-.85,-.85,.55,.95,1.15,1.30,1.10]
        origin = points[0].copy()
        for j, p in enumerate(points):
            t = j / (len(points)-1)
            spread = t*t*(3-2*t)
            p[1] = p[1]*1.25+depth_offsets[i]*spread
            reach = 1+.12*spread if i<4 else 1-.06*spread
            p[0] = origin[0]+(p[0]-origin[0])*reach
            p[2] = origin[2]+(p[2]-origin[2])*reach
            if i == 7:
                p[0] *= 1-.15*t
                p[2] -= .20*t
        # Keep fleshy roots while the middle and rounded tips become finer.
        root_scale,tip_scale = (.94,.60) if i<4 else (.86,.54)
        widths = [r*(root_scale+(tip_scale-root_scale)*(j/(len(widths)-1))**.65)
                  for j,r in enumerate(widths)]
        arms.append((name, points, widths))
    return arms


ARMS = source_arms()
EYE_CENTERS = [Vector((x*HEAD_WIDTH_SCALE,-1.045,1.43)) for x in (-.34,.30)]
FACE_TREE = None


def face_front(x,z):
    hit,_,_,_=FACE_TREE.ray_cast(Vector((x,-6,z)),Vector((0,1,0)))
    assert hit is not None, f'Eye left the mantle surface: {x}, {z}'
    return hit.y


def calibrate_eyes(body):
    global FACE_TREE
    FACE_TREE=BVHTree.FromPolygons([v.co for v in body.data.vertices],
                                  [list(p.vertices) for p in body.data.polygons])
    for center in EYE_CENTERS:
        center.y=face_front(center.x,center.z)-.036




def root_influence(co):
    radial = max(0., min(1., (1.35-math.hypot(co.x,co.y))/0.65))
    vertical = max(0., min(1., (.90-co.z)/.45, (co.z+1.05)/.45))
    return radial*radial*(3-2*radial)*vertical


def adjacency(mesh):
    neighbors = [set() for _ in mesh.vertices]
    for edge in mesh.edges:
        a,b = edge.vertices
        neighbors[a].add(b);neighbors[b].add(a)
    return neighbors


def relax_junctions(body):
    neighbors = adjacency(body.data)
    original = [v.co.copy() for v in body.data.vertices]
    factors = [root_influence(v.co) for v in body.data.vertices]
    # Local positive/negative relaxation reduces voxel/quad ripples without
    # shrinking every arm and head. This is fairing, not manual retopology.
    for _ in range(8):
        for strength in (.45,-.47):
            previous = [v.co.copy() for v in body.data.vertices]
            for i,vertex in enumerate(body.data.vertices):
                if factors[i] and neighbors[i]:
                    average = sum((previous[j] for j in neighbors[i]),Vector())/len(neighbors[i])
                    vertex.co = previous[i]+(average-previous[i])*strength*factors[i]
    body.data.update()
    body['junction_fairing_max_displacement'] = max((v.co-original[i]).length for i,v in enumerate(body.data.vertices))


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


def transported_frames(line, initial):
    """Carry the same cross-section along a whole chain without roll flips."""
    tangent = (line[1]-line[0]).normalized()
    first_rotation = initial.col[1].rotation_difference(tangent)
    side = first_rotation @ initial.col[0]
    previous = tangent
    frames = []
    for a,b in zip(line,line[1:]):
        tangent = (b-a).normalized()
        side = previous.rotation_difference(tangent) @ side
        side = (side-tangent*side.dot(tangent)).normalized()
        normal = side.cross(tangent).normalized()
        frames.append(Matrix((side,tangent,normal)).transposed())
        previous = tangent
    return frames


def volume_measurements(body):
    def dimensions(vertices):
        spans = [max(v.co[i] for v in vertices)-min(v.co[i] for v in vertices) for i in range(3)]
        return {'width':spans[0],'depth':spans[1],'height':spans[2],'depth_to_width':spans[1]/spans[0]}
    vertices = list(body.data.vertices)
    head = [v for v in vertices if 1.05<v.co.z<2.4 and abs(v.co.x)<1.1]
    return {'body':dimensions(vertices),'head_band':dimensions(head)}


def build_skin():
    source = bpy.data.collections.new("EDITABLE_Source_Forms")
    bpy.context.scene.collection.children.link(source)
    mantle = v2.mantle()
    for vertex in mantle.data.vertices:
        vertex.co.x *= HEAD_WIDTH_SCALE
        vertex.co.y = vertex.co.y*HEAD_DEPTH_SCALE+.08
    mantle.data.update()
    parts = [mantle]
    samples = []
    for name, points, widths in ARMS:
        vertices, faces, frames = sweep(points, widths, sides=20, steps=10, depth=ARM_DEPTH)
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
    remesh.voxel_size = .028
    remesh.use_smooth_shade = True
    bpy.ops.object.modifier_apply(modifier=remesh.name)
    smooth = body.modifiers.new("Relax arm junctions", "SMOOTH")
    smooth.factor, smooth.iterations = .65, 6
    bpy.ops.object.modifier_apply(modifier=smooth.name)
    # QuadriFlow is an automatic starting cage, not an artist-approved final
    # deformation topology. Preserve it in the .blend for further loop editing.
    bpy.ops.object.quadriflow_remesh(target_faces=4800, seed=17)
    relax_junctions(body)
    quad_count = sum(len(p.vertices)==4 for p in body.data.polygons)
    assert quad_count/max(len(body.data.polygons),1) > .95, "QuadriFlow did not produce a quad cage"
    edges = Counter(tuple(sorted((a,b))) for p in body.data.polygons
                    for a,b in zip(p.vertices,list(p.vertices)[1:]+[p.vertices[0]]))
    assert all(count==2 for count in edges.values()), "Open or non-manifold quad cage"
    neighbors = adjacency(body.data)
    reached = {0};pending = [0]
    while pending:
        for index in neighbors[pending.pop()]:
            if index not in reached:
                reached.add(index);pending.append(index)
    assert len(reached)==len(body.data.vertices), 'Detached arm after depth expansion'
    cage_faces = len(body.data.polygons)
    body['quad_cage_vertices'] = len(body.data.vertices)
    # Store smooth color on the cage; subdivision interpolates it continuously.
    tree = KDTree(len(samples))
    for i, (center, _, _) in enumerate(samples):
        tree.insert(center, i)
    tree.balance()
    color = body.data.color_attributes.new(name="BellyColor", type="FLOAT_COLOR", domain="POINT")
    colors = []
    for vertex in body.data.vertices:
        co = tuple(vertex.co)
        _, index, distance = tree.find(co)
        center, radius, (side, belly) = samples[index]
        delta = sub(co, center)
        value = .94*dot(delta, side)/radius + .34*dot(delta, belly)/(radius*ARM_DEPTH)
        amount = max(0., min(1., (value-.20)/.70))
        amount = amount*amount*(3-2*amount)
        fade = max(0., min(1., max((.15-co[2])/.40, (math.hypot(center[0], center[1])-.40)/.55)))
        gate = max(0., min(1., (1.45-distance/radius)/.35))
        amount *= fade*gate
        colors.append(Vector(tuple(a*(1-amount)+b*amount for a,b in zip(v2.TEAL,v2.MINT))+(1.,)))
    neighbors = adjacency(body.data)
    for _ in range(4):
        previous = colors
        colors = [value.lerp(sum((previous[j] for j in neighbors[i]),Vector((0,0,0,0)))/len(neighbors[i]),.42*root_influence(body.data.vertices[i].co)) for i,value in enumerate(previous)]
    for i,value in enumerate(colors):
        color.data[i].color = value
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
    body["non_manifold_edges"] = sum(count!=2 for count in edges.values())
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
    crown = data.edit_bones.new("Crown")
    crown.head, crown.tail, crown.parent = (0,0,-.12), (0,0,.38), root
    head = data.edit_bones.new("Head")
    head.head, head.tail, head.parent = (0,0,.50), (0,0,2.1), root
    orb = data.edit_bones.new("Orb")
    orb.head, orb.tail, orb.parent = (2.12,-.04,1.01), (2.12,-.04,1.26), root
    for index,center in enumerate(EYE_CENTERS):
        for kind in ('Eye','Smile'):
            eye = data.edit_bones.new(f'{kind}_{index}')
            eye.head,eye.tail,eye.parent = center,center+Vector((0,0,.16)),head
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
    segments = []
    for arm_index, chain in enumerate(chains):
        for segment, (name,a,b) in enumerate(chain):
            direction = b-a
            segments.append((arm_index,segment,a,direction,direction.length_squared))
    def continuous_weights(co):
        nearest = None
        for candidate_arm,candidate_segment,a,direction,length_squared in segments:
            fraction = max(0.,min(1.,(co-a).dot(direction)/length_squared))
            distance_squared = (co-a-direction*fraction).length_squared
            if nearest is None or distance_squared < nearest[0]:
                nearest = (distance_squared,candidate_arm,candidate_segment,fraction)
        distance_squared,arm_index,segment,t = nearest
        distance = math.sqrt(distance_squared)
        widths = ARMS[arm_index][2]
        radius = sum(widths)/len(widths)
        surface = max(0.,min(1.,(1.6-distance/radius)/.6))
        # Below the neck this is already the connected arm surface. A radial
        # proximity gate there would leave distal surface vertices attached to
        # Root, creating spikes when the arm folds into the Focus cradle.
        neck_gate = max(0.,min(1.,(co.z-.35)/.5))
        neck_gate = neck_gate*neck_gate*(3-2*neck_gate)
        surface = 1-(1-surface)*neck_gate
        fade = max(0., min(1., max((.18-co.z)/.55,(math.hypot(co.x,co.y)-.38)/.65)))
        arm_weight = surface*fade
        # Cubic weights vary continuously between segment centers; a nearest
        # sampled point would create small plateaus and visible skin wrinkles.
        coordinate = segment+t-.5
        lo = math.floor(coordinate)
        fraction = coordinate-math.floor(coordinate)
        f = fraction
        cubic = [((1-f)**3)/6,(3*f**3-6*f*f+4)/6,
                 (-3*f**3+3*f*f+3*f+1)/6,f**3/6]
        weights = {}
        for part, amount in zip(range(lo-1,lo+3),cubic):
            part = max(0,min(SEGMENTS-1,part))
            name = chains[arm_index][part][0]
            weights[name] = weights.get(name,0)+arm_weight*amount
        head_weight = max(0.,min(1.,(co.z-.40)/.55))*(1-arm_weight)
        weights["Head"] = head_weight
        # The arm web is soft tissue, not a rigid chassis. Its own control
        # overlaps the first arm segments and the neck's Head transition.
        weights["Crown"] = 1-arm_weight-head_weight
        weights = dict(sorted(weights.items(),key=lambda item:item[1],reverse=True)[:4])
        total = sum(weights.values())
        weights = {name:weight/total for name,weight in weights.items()}
        return weights
    all_weights = [continuous_weights(vertex.co) for vertex in body.data.vertices]
    neighbors = adjacency(body.data)
    for _ in range(8):
        previous = all_weights
        all_weights = []
        for i,weights in enumerate(previous):
            blend = .48*root_influence(body.data.vertices[i].co)
            mixed = {name:weight*(1-blend) for name,weight in weights.items()}
            for j in neighbors[i]:
                for name,weight in previous[j].items():
                    mixed[name] = mixed.get(name,0)+weight*blend/len(neighbors[i])
            all_weights.append(mixed)
    for i,weights in enumerate(all_weights):
        for name,weight in weights.items():
            if weight>1e-7: groups[name].add([i],weight,"REPLACE")
    finish = body.modifiers.new("Shared rest surface", "SUBSURF")
    finish.levels = finish.render_levels = 1
    cage = body.copy();cage.data = body.data.copy();cage.name = "EDITABLE_Weighted_Quad_Cage"
    bpy.data.collections['EDITABLE_Source_Forms'].objects.link(cage)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.modifier_apply(modifier=finish.name)
    # Applying a modifier may replace the underlying deform-group list. Do not
    # retain pre-apply RNA group wrappers when looking up final mesh indices.
    final_group_indices = {group.name:group.index for group in body.vertex_groups}
    # glTF has a fixed triangle mesh. Both Blender and the browser now skin the
    # same subdivided rest surface with the same four normalized influences.
    max_error = 0.
    for vertex in body.data.vertices:
        if root_influence(vertex.co)<.01:
            # Re-evaluate the continuous four-bone field on the final surface.
            # Truncating interpolated cage weights would create tiny ridges
            # where five or six interpolated bone influences trade rank.
            direct = continuous_weights(vertex.co)
            weights = [(final_group_indices[name],weight) for name,weight in direct.items() if weight>1e-8]
        else:
            weights = sorted(((g.group,g.weight) for g in vertex.groups),key=lambda item:item[1],reverse=True)[:4]
        total = sum(weight for _,weight in weights)
        old_indices = [g.group for g in vertex.groups]
        for index in old_indices:
            body.vertex_groups[index].remove([vertex.index])
        for index,weight in weights:
            body.vertex_groups[index].add([vertex.index],weight/total,"REPLACE")
    for vertex in body.data.vertices:
        max_error = max(max_error,abs(sum(g.weight for g in vertex.groups)-1))
        assert 1<=len(vertex.groups)<=4, f'Invalid influence count at vertex {vertex.index}'
    assert max_error<1e-6, f'Unnormalized runtime skin weights: {max_error}'
    modifier = body.modifiers.new("Shared linear skin deformation", "ARMATURE")
    modifier.object = rig
    modifier.use_deform_preserve_volume = False
    cage_modifier = cage.modifiers.new("Preview cage deformation", "ARMATURE")
    cage_modifier.object = rig
    body.parent = rig
    return rig, chains, max_error


def attach(obj, rig, bone):
    group = obj.vertex_groups.new(name=bone)
    group.add(list(range(len(obj.data.vertices))),1.,"REPLACE")
    modifier = obj.modifiers.new("Rigid bone follow", "ARMATURE")
    modifier.object = rig
    obj.parent = rig


def add_color_controls(body):
    """Editable Blender preview; the exported base GLB keeps core vertex colors."""
    body['skin_stage'] = 0.
    body.id_properties_ui('skin_stage').update(min=0.,max=3.,description='0 teal, 1 sand, 2 rust, 3 ink; fractional values reveal the color wave')
    colors = [Vector(value.color[:3]) for value in body.data.color_attributes['BellyColor'].data]
    delta = Vector(v2.MINT)-Vector(v2.TEAL)
    coordinates = [v.co for v in body.data.vertices]
    bottom,top = min(p.z for p in coordinates),max(p.z for p in coordinates)
    wave_attribute = body.data.attributes.new(name='SkinWave',type='FLOAT',domain='POINT')
    for i,p in enumerate(coordinates):
        wave_attribute.data[i].value = max(0.,min(1.,(top-p.z)/(top-bottom)+.05*math.sin(3*p.x+2*p.y)))
    for name,(back,belly) in list(PALETTES.items())[1:]:
        layer = body.data.color_attributes.new(name='Skin_'+name,type='FLOAT_COLOR',domain='POINT')
        a,b = Vector(v2.linear(back)),Vector(v2.linear(belly))
        for i,p in enumerate(coordinates):
            mask = max(0.,min(1.,(colors[i]-Vector(v2.TEAL)).dot(delta)/delta.length_squared))
            patch = .965+.035*math.sin(p.x*3.1+p.z*1.8)*math.sin(p.y*3.7-p.z*2.1)
            color = a.lerp(b,mask)*patch
            layer.data[i].color = (*color,1.)
    material = v2.base.mat_principled('Editable_Chromatophore_Preview',(1,1,1),roughness=.49,sss=.10,sheen=.06)
    nodes,links = material.node_tree.nodes,material.node_tree.links
    shader = next(n for n in nodes if n.type=='BSDF_PRINCIPLED')
    stage = nodes.new('ShaderNodeValue');stage.label='Skin stage: custom property on body'
    curve = stage.outputs[0].driver_add('default_value')
    variable = curve.driver.variables.new();variable.name='stage';variable.type='SINGLE_PROP'
    variable.targets[0].id=body;variable.targets[0].data_path='["skin_stage"]'
    curve.driver.expression='stage'
    wave = nodes.new('ShaderNodeAttribute');wave.attribute_name='SkinWave'
    delay = nodes.new('ShaderNodeMath');delay.operation='MULTIPLY';delay.inputs[1].default_value=.35
    links.new(wave.outputs['Fac'],delay.inputs[0])
    base = nodes.new('ShaderNodeVertexColor');base.layer_name='BellyColor'
    output = base.outputs['Color']
    for index,name in enumerate(['sand','rust','ink']):
        offset = nodes.new('ShaderNodeMath');offset.operation='SUBTRACT';offset.inputs[1].default_value=index
        links.new(stage.outputs[0],offset.inputs[0])
        speed = nodes.new('ShaderNodeMath');speed.operation='MULTIPLY';speed.inputs[1].default_value=1.35
        links.new(offset.outputs[0],speed.inputs[0])
        front = nodes.new('ShaderNodeMath');front.operation='SUBTRACT'
        links.new(speed.outputs[0],front.inputs[0]);links.new(delay.outputs[0],front.inputs[1])
        easing = nodes.new('ShaderNodeMapRange');easing.interpolation_type='SMOOTHSTEP';easing.clamp=True
        links.new(front.outputs[0],easing.inputs['Value'])
        color = nodes.new('ShaderNodeVertexColor');color.layer_name='Skin_'+name
        mix = nodes.new('ShaderNodeMixRGB');mix.blend_type='MIX'
        links.new(easing.outputs[0],mix.inputs[0]);links.new(output,mix.inputs[1]);links.new(color.outputs['Color'],mix.inputs[2])
        output = mix.outputs[0]
    links.new(output,shader.inputs['Base Color'])
    body.data.materials[0] = material
    return stage


def smooth(value):
    value = max(0.,min(1.,value))
    return value*value*(3-2*value)


def pulse(phase, center, width):
    return smooth(1-abs(phase-center)/width)


def crown_matrix(clip, phase):
    beat = phase*2*math.pi
    amount = {'Idle':.75,'Greeting':1.,'Focus':.45,'Celebrate':1.25}[clip]
    center = Vector((0,0,-.12))
    return (Matrix.Translation(center+Vector((.065*amount*math.sin(beat),
            .055*amount*math.sin(beat-.65),.07*amount*math.sin(beat+.4))))
            @ Matrix.Rotation(.13*amount*math.sin(beat),4,'Y')
            @ Matrix.Rotation(.10*amount*math.sin(beat-.65),4,'X')
            @ Matrix.Rotation(.08*amount*math.sin(beat+.4),4,'Z')
            @ Matrix.Translation(-center))


def pose_points(arm_index, clip, phase):
    rest = resample(ARMS[arm_index][1])
    wave = math.sin(phase*2*math.pi)
    envelope = math.sin(phase*math.pi)**2
    line = [p.copy() for p in rest]
    if clip == 'Greeting' and arm_index == 0:
        # An entire raised S silhouette, with a wide distal hand-like wave.
        target = resample([ARMS[0][1][0],(-.85,-.06,.18),(-1.62,-.32,.68),
                           (-2.24,-.52,1.46),(-2.08,-.67,2.30),(-1.73,-.72,2.50)])
        line = [a.lerp(b,smooth(envelope*1.5)) for a,b in zip(rest,target)]
    elif clip == 'Celebrate' and arm_index in (0,3):
        targets = {
            0:[ARMS[0][1][0],(-1.0,.10,.05),(-1.9,-.15,.60),(-2.50,-.30,1.55),(-2.20,-.40,2.22)],
            3:[ARMS[3][1][0],(.95,.25,.18),(1.8,.50,.85),(2.38,.55,1.70),(2.10,.30,2.30)]}
        burst = pulse(phase,.46,.37)
        target = resample(targets[arm_index])
        line = [a.lerp(b,burst) for a,b in zip(rest,target)]
    elif clip == 'Focus' and arm_index in (1,2):
        targets = {
            1:[ARMS[1][1][0],(-.65,-.70,-.40),(-.76,-1.00,-1.10),
               (-.25,-1.30,-1.36),(.40,-1.38,-1.03),(.77,-1.36,-.34),(.91,-1.22,.25)],
            2:[ARMS[2][1][0],(.80,-.68,-.35),(1.52,-1.00,-.46),
               (1.75,-1.32,-.03),(1.38,-1.22,.27)]}
        target = resample(targets[arm_index])
        line = [a.lerp(b,.82+.18*envelope) for a,b in zip(rest,target)]
    # Large authored poses determine the silhouette. Muscular secondary bends
    # rotate segment tangents and integrate them, preserving each segment's
    # length. Offsetting sampled points directly can fold a short tangent to
    # zero during a tight curl and cause a sudden 40-degree per-frame turn.
    for j,p in enumerate(line):
        t=j/(len(line)-1)
        influence=smooth(t)
        if clip=='Celebrate':
            anticipation=pulse(phase,.14,.14)
            burst=pulse(phase,.46,.37)
            p.x+=(p.x-line[0].x)*influence*(-.18*anticipation+.12*burst)
            p.z+=influence*(-.20*anticipation+.26*burst*math.sin(arm_index*.85))
            p.y+=.26*influence*burst*math.sin(arm_index*1.7)
        elif clip=='Focus' and arm_index==3:
            p.x-=.60*influence
            p.z-=.45*influence
    line=resample(line)
    initial=frame(line[0],line[1]).to_3x3()
    local_frames=transported_frames(line,initial)
    result=[line[0].copy()]
    amplitude={'Idle':.40,'Greeting':.44,'Focus':.24,'Celebrate':.55}[clip]
    base_amplitude={'Idle':.36,'Greeting':.46,'Focus':.29,'Celebrate':.58}[clip]
    # Distinct phases and roles keep the eight arms alive without eight
    # simultaneous lead gestures. Back arms balance; front arms perform.
    role=[1.,.78,.82,.90,.68,.76,.70,.72][arm_index]
    if clip=='Greeting' and arm_index in (1,2,3):role*=.70
    beat=phase*2*math.pi+arm_index*.94
    for j,(a,b) in enumerate(zip(line,line[1:])):
        t=(j+.5)/(len(line)-1)
        influence=smooth(t)
        theta=phase*2*math.pi-t*1.7*math.pi+arm_index*.94
        strength=amplitude*[1.,.85,.90,.75,.80,.90,.85,.70][arm_index]*influence
        yaw=strength*math.sin(theta)
        pitch=strength*.70*math.sin(theta+.95)
        curl=.40*math.sin(phase*2*math.pi+arm_index*.8)*smooth((t-.45)/.55)
        if clip=='Greeting' and arm_index==0:
            yaw+=.52*envelope*math.sin(phase*6*math.pi)*smooth((t-.35)/.65)
            pitch+=.20*envelope*math.cos(phase*6*math.pi)*influence
        if clip=='Focus' and arm_index in (1,2):
            yaw=pitch=curl=0.
        # Begin the bend at the body. The previous smooth(t) mask made the
        # first third almost rigid. A broad proximal sweep leads a delayed
        # travelling bend, while the fine distal wave follows afterwards.
        proximal=(1-t)**1.25
        lead=base_amplitude*role*proximal
        yaw+=lead*math.sin(beat-t*2.1)
        pitch+=lead*.72*math.sin(beat-t*2.1+1.1)
        cross=local_frames[j]
        rotation=Matrix.Rotation(yaw+curl,3,cross.col[0]) @ Matrix.Rotation(pitch,3,cross.col[2])
        result.append(result[-1]+rotation@(b-a))
    crown=crown_matrix(clip,phase)
    result=[crown @ p for p in result]
    # A soft radial reach moves each fleshy attachment through the web.
    # This is deliberately small relative to the broad tangent rotation.
    radial=Vector((rest[0].x,rest[0].y,0)).normalized()
    reach=radial*(.055*role*math.sin(beat-.35))
    result=[p+reach for p in result]
    if clip=='Focus' and arm_index in (1,2):
        # Cradle tips keep their task while the bases continue articulating.
        target_tip=line[-1]
        correction=target_tip-result[-1]
        result=[p+correction*smooth(i/SEGMENTS) for i,p in enumerate(result)]
    rest_length=sum((b-a).length for a,b in zip(rest,rest[1:]))
    length=sum((b-a).length for a,b in zip(result,result[1:]))
    ratio=max(.82,min(1.16,length/rest_length))/(length/rest_length)
    origin=result[0].copy()
    result=[origin+(p-origin)*ratio for p in result]
    if clip=='Focus' and arm_index in (1,2):
        # Length limiting must not undo the cradle's endpoint constraint.
        correction=line[-1]-result[-1]
        result=[p+correction*smooth(i/SEGMENTS) for i,p in enumerate(result)]
        assert (result[-1]-line[-1]).length<1e-6
    return result


def eye_pose(clip,phase,index):
    wave=math.sin(phase*2*math.pi)
    envelope=math.sin(phase*math.pi)**2
    # Width, opening, lean, gaze X/Z, closed-smile mix.
    if clip=='Idle':
        blink=max(pulse(phase,.21,.065),pulse(phase,.78,.055))
        return (1.,1-.94*blink,.06*wave,.045*wave,.012*wave,0.)
    if clip=='Greeting':
        wink=pulse(phase,.42,.15) if index==1 else 0.
        return (1.05,1.12-.28*envelope-.78*wink,
                (-.18 if index==0 else .12)*envelope,-.025*envelope,.045*envelope,wink)
    if clip=='Focus':
        return (1.35,.30+.05*wave,(-.12 if index==0 else .12),.065,-.070,0.)
    happy=smooth(envelope*1.8)
    return (1.12,1.18-.45*happy,(-.12 if index==0 else .12),0.,.045*happy,happy)


def animate_eyes(rig,clip,phase):
    head=rig.pose.bones['Head'].matrix @ rig.data.bones['Head'].matrix_local.inverted()
    for index,center in enumerate(EYE_CENTERS):
        width,opening,lean,gaze_x,gaze_z,happy=eye_pose(clip,phase,index)
        for kind,visibility in [('Eye',1-happy),('Smile',happy)]:
            bone=rig.pose.bones[f'{kind}_{index}']
            factor=max(.001,visibility)
            # Eye-plane transforms: global X/Z; depth follows the curved mantle.
            gaze=Vector((gaze_x,face_front(center.x+gaze_x,center.z+gaze_z)-face_front(center.x,center.z)-.004,gaze_z))
            scale=(width*factor,factor, max(.07,opening)*factor) if kind=='Eye' else (factor,factor,factor)
            transform=Matrix.Translation(center+gaze) @ Matrix.Rotation(lean,4,'Y') @ Matrix.Diagonal((*scale,1)) @ Matrix.Translation(-center)
            bone.matrix=head @ transform @ rig.data.bones[bone.name].matrix_local


def make_smile(center,material,rig,bone_name):
    # A rounded inverted-U is the closed smiling eye itself, not an eyebrow.
    points=[];radii=[]
    for i in range(13):
        t=i/12
        x=center.x-.14+.28*t
        z=center.z+.070*math.sin(math.pi*t)-.015
        points.append((x,face_front(x,z)-.014,z))
        radii.append(.033 if i not in (0,12) else .020)
    vertices,faces,_=sweep(points,radii,sides=12,steps=2,depth=.75)
    obj=v2.mesh_object('HappyEye',vertices,faces)
    obj.data.materials.append(material)
    attach(obj,rig,bone_name)


def animate(rig, chains):
    rig.animation_data_create()
    actions = {}
    rest_frames = []
    for chain in chains:
        line = [a for _,a,_ in chain]+[chain[-1][2]]
        initial = rig.data.bones[chain[0][0]].matrix_local.to_3x3()
        rest_frames.append(transported_frames(line,initial))
    for clip, length in CLIPS.items():
        action = bpy.data.actions.new(clip)
        action.use_fake_user = True
        rig.animation_data.action = action
        previous_quaternions = {}
        for step in range(49):
            phase = step/48
            frame_number = 1+length*phase
            wave = math.sin(phase*2*math.pi)
            envelope = math.sin(phase*math.pi)**2
            if clip=='Celebrate':
                anticipation=pulse(phase,.14,.14)
                burst=pulse(phase,.46,.37)
                lift=-.17*anticipation+.65*burst
                turn=.22*wave; sway=.15*wave
                squash=1-.07*anticipation+.035*burst
            else:
                lift={'Idle':.16,'Greeting':.20,'Focus':.085}[clip]*wave
                turn={'Idle':.10,'Greeting':.16,'Focus':.07}[clip]*wave
                sway={'Idle':.09,'Greeting':.13,'Focus':.045}[clip]*wave
                squash=1+.022*wave
            root_matrix = Matrix.Translation((sway,0,lift)) @ Matrix.Rotation(turn,4,'Z') @ Matrix.Rotation(-sway,4,'Y')
            rig.pose.bones['Root'].matrix = root_matrix @ rig.data.bones['Root'].matrix_local
            rig.pose.bones['Crown'].matrix = root_matrix @ crown_matrix(clip,phase) @ rig.data.bones['Crown'].matrix_local
            bpy.context.view_layer.update()
            head = rig.pose.bones['Head']
            breath = math.sin(phase*2*math.pi-.45)
            lean = (.16*envelope if clip=='Focus' else .10*breath)
            tilt = (-.13*envelope if clip=='Greeting' else .08*wave)
            head.matrix = root_matrix @ rig.data.bones['Head'].matrix_local @ Matrix.Rotation(lean,4,'X') @ Matrix.Rotation(tilt,4,'Z') @ Matrix.Diagonal((1/squash,squash,1/squash,1))
            bpy.context.view_layer.update()
            animate_eyes(rig,clip,phase)
            for arm_index, chain in enumerate(chains):
                line = pose_points(arm_index,clip,phase)
                target_frames = transported_frames(line,rest_frames[arm_index][0])
                for i,(name,a,b) in enumerate(chain):
                    ratio = (line[i+1]-line[i]).length/(b-a).length
                    # Compare transported rest/pose frames. Independent shortest
                    # arcs can pick opposite roll axes around a folded U-turn,
                    # collapsing the cross-section under linear skin blending.
                    bend = target_frames[i] @ rest_frames[arm_index][i].transposed()
                    orientation = (bend @ rig.data.bones[name].matrix_local.to_3x3()).to_4x4()
                    rig.pose.bones[name].matrix = root_matrix @ Matrix.Translation(line[i]) @ orientation @ Matrix.Diagonal((1,ratio,1,1))
            orb = rig.pose.bones["Orb"]
            orb_center = Vector((1.10,-1.22,.48+.025*wave))
            orb.matrix = root_matrix @ Matrix.Translation(orb_center) @ Matrix.Diagonal((1,1,1,1) if clip=="Focus" else (.001,.001,.001,1))
            for bone in rig.pose.bones:
                if bone.name in previous_quaternions and bone.rotation_quaternion.dot(previous_quaternions[bone.name])<0:
                    bone.rotation_quaternion.negate()
                previous_quaternions[bone.name] = bone.rotation_quaternion.copy()
                bone.keyframe_insert("location",frame=frame_number,group=bone.name)
                bone.keyframe_insert("rotation_quaternion",frame=frame_number,group=bone.name)
                bone.keyframe_insert("scale",frame=frame_number,group=bone.name)
        actions[clip] = action
    return actions


def select_action(rig, action, frame_number):
    rig.animation_data.action = action
    bpy.context.scene.frame_set(math.floor(frame_number),subframe=frame_number-math.floor(frame_number))
    bpy.context.view_layer.update()


def measure_animation(rig,actions):
    result={}
    for name,length in CLIPS.items():
        previous={};largest=(0.,'');proximal={i:[] for i in range(8)};anchors={i:[] for i in range(8)}
        for frame_number in range(1,length+2):
            select_action(rig,actions[name],frame_number)
            for bone in rig.pose.bones:
                if not bone.name.startswith('Arm'):continue
                q=bone.rotation_quaternion.normalized()
                if bone.name in previous:
                    angle=math.degrees(2*math.acos(min(1.,abs(q.dot(previous[bone.name])))))
                    if angle>largest[0]:largest=(angle,bone.name)
                previous[bone.name]=q.copy()
            root_inverse=rig.pose.bones['Root'].matrix.inverted()
            for i in range(8):
                bone=rig.pose.bones[f'Arm{i+1:02}_01']
                relative=root_inverse @ bone.matrix
                proximal[i].append(relative.to_3x3().col[1].normalized())
                anchors[i].append(relative.translation.copy())
        excursions=[]
        for i in range(8):
            angle=max(math.degrees(a.angle(b)) for a in proximal[i] for b in proximal[i])
            distance=max((a-b).length for a in anchors[i] for b in anchors[i])
            excursions.append({'arm':i+1,'base_direction_excursion_degrees':angle,'attachment_travel':distance})
            assert angle>12.,f'Arm base remains rigid: {name} / {i+1}: {angle}'
        result[name]={'max_rotation_per_frame_degrees':largest[0],'bone':largest[1],'proximal':excursions}
        assert largest[0]<30.,f'Tentacle snaps during {name}: {largest}'
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default=str(HERE/"output"))
    args = parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    output = Path(args.output).resolve()
    output.mkdir(parents=True,exist_ok=True)
    v2.base.clear_scene()
    body, source, samples = build_skin()
    calibrate_eyes(body)
    rig, chains, weight_error = make_rig(body,samples)
    volume = volume_measurements(body)
    landmark_indices = list(range(0,len(body.data.vertices),max(1,len(body.data.vertices)//96)))[:96]
    rest_landmarks = [list(body.data.vertices[i].co) for i in landmark_indices]
    ink = v2.base.mat_principled("Ink",v2.linear("0E1D1E"),roughness=.30)
    ivory = v2.base.mat_principled("Ivory",v2.linear("F3F8F5"),roughness=.32)
    for index,center in enumerate(EYE_CENTERS):
        attach(v2.base.add_uv('Eye',tuple(center),(.090,.060,.185),ink,24,16),rig,f'Eye_{index}')
        attach(v2.base.add_uv('Highlight',tuple(center+Vector((-.022,-.052,.068))),(.023,.014,.038),ivory,16,10),rig,f'Eye_{index}')
        make_smile(center,ink,rig,f'Smile_{index}')
    orb_mat = v2.base.mat_principled("Jade_Orb",v2.linear("EAF8F5"),roughness=.25,
                                    sss=.08,transmission=.10,emission=(.12,.22,.19))
    attach(v2.base.add_uv("Focus_Orb",(2.12,-.04,1.01),(.30,.30,.30),orb_mat,28,18),rig,"Orb")
    assets = [obj for obj in bpy.context.scene.objects if obj.type=="MESH" and obj.parent==rig]
    actions = animate(rig,chains)
    temporal=measure_animation(rig,actions)
    ground_mat = v2.base.mat_principled("Warm_Studio",v2.linear("EFECE4"),roughness=.85)
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-3.06))
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
    camera_data.type="ORTHO";camera_data.ortho_scale=7.6
    camera.location=(3,-14,3.1);v2.base.look_at(camera,(0,0,.15))
    scene.render.engine="CYCLES";scene.cycles.device="CPU"
    scene.cycles.samples=20;scene.cycles.use_denoising=True
    scene.render.threads_mode="FIXED";scene.render.threads=2
    scene.render.resolution_x=scene.render.resolution_y=768
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format="PNG";scene.render.image_settings.color_mode="RGBA"
    scene.view_settings.view_transform="AgX";scene.view_settings.look="AgX - Medium High Contrast"
    scene.render.fps=24
    scene["prototype_note"]="Automatic quad cage and baked segment rig; manual production retopology remains"
    select_action(rig,actions["Idle"],1)
    scene.frame_start,scene.frame_end=1,97
    scene.render.filepath="//idle.png"
    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    for obj in assets:obj.select_set(True)
    bpy.context.view_layer.objects.active=rig
    bpy.ops.export_scene.gltf(filepath=str(output/"zibloo_flow_v8.glb"),export_format="GLB",use_selection=True,
        export_apply=True,export_cameras=False,export_lights=False,export_skins=True,
        export_vertex_color="NAME",export_vertex_color_name="BellyColor",
        export_animations=True,export_animation_mode="ACTIONS",export_force_sampling=True,
        export_frame_range=False,export_anim_single_armature=True,export_optimize_animation_size=True)
    add_color_controls(body)
    scene['color_preview_note']='Select Zibloo_Quad_Skin and adjust skin_stage 0..3. Runtime color changes are implemented in viewer.js; base GLB retains its standard BellyColor attribute.'
    bpy.ops.wm.save_as_mainfile(filepath=str(output/"zibloo_flow_v8.blend"))
    evaluated_stats={}
    parity = {'rest':[[x,z,-y] for x,y,z in rest_landmarks],'clips':{}}
    for clip,length in CLIPS.items():
        selected_frame=1+round(length*(.42 if clip=="Greeting" else .5))
        select_action(rig,actions[clip],selected_frame)
        evaluated=body.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh()
        assert all(math.isfinite(c) for vertex in evaluated.vertices for c in vertex.co), "Non-finite skin vertex"
        bounds=[(min(v.co[i] for v in evaluated.vertices),max(v.co[i] for v in evaluated.vertices)) for i in range(3)]
        assert all(math.isfinite(x) for axis in bounds for x in axis),"Invalid deformed vertices"
        assert max(b-a for a,b in bounds)<9,"Exploding skin"
        evaluated_stats[clip]={"bounds":bounds,"vertices":len(evaluated.vertices)}
        body.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh_clear()
        reference_frame = 1+length*.42
        select_action(rig,actions[clip],reference_frame)
        reference_body = body.evaluated_get(bpy.context.evaluated_depsgraph_get())
        reference_mesh = reference_body.to_mesh()
        parity['clips'][clip] = {'time':reference_frame/24,'points':[]}
        for i in landmark_indices:
            x,y,z = body.matrix_world @ reference_mesh.vertices[i].co
            parity['clips'][clip]['points'].append([x,z,-y])
        reference_body.to_mesh_clear()
        select_action(rig,actions[clip],selected_frame)
        scene.render.filepath=str(output/(clip.lower()+".png"))
        bpy.ops.render.render(write_still=True)
    scene.render.resolution_x=scene.render.resolution_y=512
    scene.cycles.samples=16
    camera_data.ortho_scale=2.85
    camera.location=(0,-14,2.0);v2.base.look_at(camera,(0,0,1.47))
    for clip,length in CLIPS.items():
        select_action(rig,actions[clip],1+length*.42)
        face_center=(rig.pose.bones['Head'].matrix @ rig.data.bones['Head'].matrix_local.inverted()) @ Vector((0,0,1.55))
        camera.location=face_center+Vector((0,-14,.20));v2.base.look_at(camera,face_center)
        scene.render.filepath=str(output/f'eyes-{clip.lower()}.png');bpy.ops.render.render(write_still=True)
    camera_data.ortho_scale=7.6
    scene.render.resolution_x=scene.render.resolution_y=768
    select_action(rig,actions["Focus"],49)
    camera.location=(14,0,1.3);v2.base.look_at(camera,(0,0,.15))
    scene.render.filepath=str(output/"focus-profile.png");bpy.ops.render.render(write_still=True)
    select_action(rig,actions["Idle"],1)
    scene.render.filepath=str(output/"idle-profile.png");bpy.ops.render.render(write_still=True)
    select_action(rig,actions["Focus"],49)
    camera.location=(0,-14,1.3);v2.base.look_at(camera,(0,0,.15))
    scene.render.filepath=str(output/"focus-front.png");bpy.ops.render.render(write_still=True)
    camera.location=(0,14,1.3);v2.base.look_at(camera,(0,0,.15))
    scene.render.filepath=str(output/"focus-back.png");bpy.ops.render.render(write_still=True)
    camera.location=(12,-3,2);v2.base.look_at(camera,(0,0,.15))
    scene.render.filepath=str(output/"focus-side.png");bpy.ops.render.render(write_still=True)
    camera.location=(3,-14,3.1);v2.base.look_at(camera,(0,0,.15))
    ground.hide_render=True;scene.render.film_transparent=True
    scene.render.filepath=str(output/"focus-transparent.png");bpy.ops.render.render(write_still=True)
    ground.hide_render=False;scene.render.film_transparent=False
    scene.render.resolution_x=scene.render.resolution_y=512
    scene.cycles.samples=16
    for stage,name in enumerate(['teal','sand','rust','ink']):
        body['skin_stage']=float(stage);body.update_tag();bpy.context.view_layer.update()
        scene.render.filepath=str(output/f'color-{name}.png')
        bpy.ops.render.render(write_still=True)
    body['skin_stage']=.45;body.update_tag();bpy.context.view_layer.update()
    scene.render.filepath=str(output/'color-transition.png');bpy.ops.render.render(write_still=True)
    body['skin_stage']=0.;body.update_tag();bpy.context.view_layer.update()
    scene.render.resolution_x=scene.render.resolution_y=320
    scene.cycles.samples=8
    for clip,length in CLIPS.items():
        folder=output/"frames"/clip.lower();folder.mkdir(parents=True,exist_ok=True)
        for i in range(16):
            select_action(rig,actions[clip],1+round(length*i/16))
            scene.render.filepath=str(folder/f"{i:02}.png")
            bpy.ops.render.render(write_still=True)
    # Dedicated front/back web views make proximal deformation reviewable.
    scene.render.resolution_x=scene.render.resolution_y=384
    camera_data.ortho_scale=4.5
    folder=output/'roots';folder.mkdir(exist_ok=True)
    for view,y in [('front',-14),('back',14)]:
        camera.location=(0,y,.6);v2.base.look_at(camera,(0,0,-.15))
        for i in range(4):
            select_action(rig,actions['Greeting'],1+CLIPS['Greeting']*i/4)
            scene.render.filepath=str(folder/f'{view}-{i}.png')
            bpy.ops.render.render(write_still=True)
    report={"blender":bpy.app.version_string,"quad_cage_faces":body["quad_cage_faces"],
        "quad_cage_vertices":body['quad_cage_vertices'],"runtime_vertices":len(body.data.vertices),"bones":len(rig.data.bones),
        "non_manifold_edges":body["non_manifold_edges"],
        "clips":CLIPS,"weight_normalization_error":weight_error,"evaluated":evaluated_stats,
        "glb_bytes":(output/"zibloo_flow_v8.glb").stat().st_size,
        "rig_method":"independent deform segments driven by sampled 3D paths; baked transforms",
        "topology_method":"automatic QuadriFlow cage, local junction fairing, subdivided rest surface before linear skinning",
        "junction_fairing_max_displacement":body['junction_fairing_max_displacement'],
        "source_collection":"EDITABLE_Source_Forms"}
    report['temporal'] = temporal
    report['eye_controls'] = 'Two capsule + two closed-smile bones; gaze, opening, tilt, blink and smile are baked into each GLB action'
    report['volume'] = volume
    report['palettes'] = PALETTES
    report['color_scope'] = 'Blender editable skin_stage shader and JavaScript runtime vertex-color transition; base GLB has static teal vertex colors'
    (output/'blender-landmarks.json').write_text(json.dumps(parity)+'\n')
    (output/"report.json").write_text(json.dumps(report,indent=2)+"\n")
    print(json.dumps(report))


if __name__=="__main__":main()
