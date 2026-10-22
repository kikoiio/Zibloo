"""Blender 4.5 LTS: isolated B2 form study; CPU render, never touches base assets.

blender -b -t 2 --python build.py -- --output <directory> --samples 24
"""
import argparse
import importlib.util
import json
import math
import os
from pathlib import Path
import sys

import bpy
from mathutils import Vector
from mathutils.kdtree import KDTree

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from geometry import sweep, dot, sub

spec = importlib.util.spec_from_file_location("base", HERE.parents[2] / "docs/brand/3d/build_zibloo.py")
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)


def linear(hex_color):
    values = [int(hex_color[i:i+2], 16)/255 for i in (0, 2, 4)]
    return tuple(v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in values)


TEAL, MINT = linear("236E69"), linear("A3D9C9")

# X across the image, -Y toward the face, Z up. The back arms deliberately overlap.
ARMS = [
    ("Left_Sweep", [(-.32,.12,.27),(-.90,.05,-.02),(-1.82,.04,-.12),(-2.45,.02,.10),(-2.65,.03,.65)], [.31,.30,.26,.23,.18]),
    ("Front_S", [(-.16,-.22,.20),(-.65,-.36,-.60),(-.52,-.48,-1.18),(.00,-.50,-1.77),(-.27,-.54,-2.20),(-.88,-.50,-2.12),(-1.03,-.47,-1.77)], [.33,.31,.29,.26,.23,.20,.16]),
    ("Right_Cradle",[(.27,-.15,.25),(.92,-.24,-.30),(1.65,-.25,-.26),(2.24,-.22,.12),(2.42,-.18,.60)], [.30,.29,.26,.23,.17]),
    ("Orb_Arch",[(.34,.22,.28),(.95,.18,.23),(1.36,.10,.72),(1.40,.06,1.39),(1.76,.02,1.69),(2.04,.00,1.56)], [.27,.26,.24,.22,.20,.16]),
    ("Back_Left_Low",[(-.26,.38,.17),(-.90,.40,-.58),(-1.42,.39,-1.10),(-1.93,.32,-1.12),(-2.12,.28,-.82)], [.29,.27,.24,.21,.16]),
    ("Back_Right_Low",[(.18,.44,.20),(.76,.39,-.58),(1.43,.34,-.85),(1.88,.27,-1.22),(1.69,.20,-1.62)], [.28,.26,.23,.21,.16]),
    ("Back_Center",[(.02,.46,.16),(-.05,.43,-.62),(.37,.39,-1.22),(.64,.30,-1.78),(.46,.22,-2.08)], [.27,.25,.23,.20,.15]),
    ("Back_Left_Fold",[(-.35,.44,.23),(-.98,.53,-.02),(-1.61,.48,-.15),(-2.06,.40,.08),(-2.14,.34,.42)], [.26,.24,.22,.19,.15]),
]


def mesh_object(name, vertices, faces):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    for face in mesh.polygons:
        face.use_smooth = True
    return obj


def mantle():
    # Ring profile preserves a full upper mantle and a real neck into the roots.
    profile = [(-.18,.34),(.04,.42),(.30,.43),(.55,.48),(.82,.64),
               (1.12,.87),(1.48,1.01),(1.85,1.04),(2.17,.95),(2.45,.74),(2.65,.43)]
    vertices, faces = [], []
    sides = 40
    for z, r in profile:
        for j in range(sides):
            a = j*2*math.pi/sides
            vertices.append((r*math.cos(a)-.08*max(z-.6,0), r*.84*math.sin(a),z))
    for i in range(len(profile)-1):
        for j in range(sides):
            nj=(j+1)%sides
            faces.append((i*sides+j,i*sides+nj,(i+1)*sides+nj,(i+1)*sides+j))
    bottom, top = len(vertices), len(vertices)+1
    vertices.extend(((0,0,-.22),(-.17,0,2.73)))
    end = (len(profile)-1)*sides
    for j in range(sides):
        nj=(j+1)%sides
        faces.extend(((bottom,nj,j),(top,end+j,end+nj)))
    obj = mesh_object("Mantle_Source",vertices,faces)
    bpy.context.view_layer.objects.active=obj
    modifier=obj.modifiers.new("Low cage smoothing","SUBSURF")
    modifier.levels=2
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    return obj


def character():
    parts=[mantle()]
    samples=[]
    for name,points,widths in ARMS:
        vertices,faces,frames=sweep(points,widths)
        parts.append(mesh_object(name,vertices,faces))
        samples.extend(frames)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in parts: obj.select_set(True)
    bpy.context.view_layer.objects.active=parts[0]
    bpy.ops.object.join()
    obj=bpy.context.object
    obj.name="Zibloo_Continuous_Skin"
    # The source cage remains in the reproducible script; this union is a form
    # prototype, not the future deformation cage used for the final rig.
    remesh=obj.modifiers.new("Fuse neck and arm roots","REMESH")
    remesh.mode="VOXEL"
    remesh.voxel_size=.048
    remesh.use_smooth_shade=True
    bpy.ops.object.modifier_apply(modifier=remesh.name)
    smooth=obj.modifiers.new("Relax junctions","SMOOTH")
    smooth.factor=1.1
    smooth.iterations=4
    bpy.ops.object.modifier_apply(modifier=smooth.name)
    decimate=obj.modifiers.new("Web study budget","DECIMATE")
    decimate.ratio=min(1.,16000/max(1,len(obj.data.polygons)*2))
    bpy.ops.object.modifier_apply(modifier=decimate.name)
    for face in obj.data.polygons: face.use_smooth=True

    # Color lives on the mesh, independent of camera/light/world orientation.
    # Point colors also survive the union and are included as glTF COLOR_0.
    tree=KDTree(len(samples))
    for i,(center,_,_) in enumerate(samples): tree.insert(center,i)
    tree.balance()
    attribute=obj.data.color_attributes.new(name="BellyColor",type="FLOAT_COLOR",domain="POINT")
    for vertex in obj.data.vertices:
        co=tuple(vertex.co)
        _,index,distance=tree.find(co)
        center,radius,(side,belly)=samples[index]
        # Place the stripe on the turning edge of the flattened arm, leaving
        # the broad camera-facing surface predominantly teal.
        offset=sub(co,center)
        outward=.94*dot(offset,side)/max(radius,.01)+.34*dot(offset,belly)/max(radius*.72,.01)
        # Reveal mint along the local belly; taper it out inside the neck.
        amount=max(0.,min(1.,(outward-.28)/.48))
        amount=amount*amount*(3-2*amount)
        root_fade=max(0.,min(1.,max((.15-co[2])/.35,(math.hypot(center[0],center[1])-.40)/.50)))
        # Nearest centerline alone is not enough: the mantle also has a nearest
        # arm. Restrict paint to a narrow neighborhood of the actual sweep.
        surface_gate=max(0.,min(1.,(1.45-distance/radius)/.35))
        amount*=root_fade*surface_gate
        attribute.data[vertex.index].color=tuple(a*(1-amount)+b*amount for a,b in zip(TEAL,MINT))+(1.,)
    mat=base.mat_principled("Teal_Mint_Vertex_PBR",(1,1,1),roughness=.48,sss=.09,sheen=.08)
    node=mat.node_tree.nodes.new("ShaderNodeVertexColor")
    node.layer_name="BellyColor"
    bsdf=next(n for n in mat.node_tree.nodes if n.type=="BSDF_PRINCIPLED")
    mat.node_tree.links.new(node.outputs["Color"],bsdf.inputs["Base Color"])
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    return obj


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--output",default=str(HERE/"output"))
    parser.add_argument("--samples",type=int,default=24)
    parser.add_argument("--size",type=int,default=768)
    args=parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    output=Path(args.output).resolve();output.mkdir(parents=True,exist_ok=True)
    base.clear_scene()
    body=character()
    ink=base.mat_principled("Ink",linear("0E1D1E"),roughness=.29)
    ivory=base.mat_principled("Ivory",linear("F3F8F5"),roughness=.30)
    for x in (-.34,.30):
        base.add_uv("Eye",(x,-.837,1.40),(.083,.048,.17),ink,24,16)
        base.add_uv("Eye_Highlight",(x-.020,-.881,1.46),(.022,.012,.038),ivory,16,10)
    orb_mat=base.mat_principled("Jade_Orb",linear("EAF8F5"),roughness=.23,sss=.08,
                                transmission=.12,emission=(.10,.20,.17))
    base.add_uv("Focus_Orb",(2.12,-.04,1.01),(.30,.30,.30),orb_mat,32,20)
    assets=[obj for obj in bpy.context.scene.objects if obj.type=="MESH"]
    ground_mat=base.mat_principled("Warm_Ivory_Studio",linear("EFECE4"),roughness=.8)
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-2.62))
    ground=bpy.context.object;ground.name="Studio_Ground";ground.data.materials.append(ground_mat)
    base.add_light("Key",(-3,-4,7),650,(1,.96,.90),5)
    base.add_light("Fill",(4,-2,3),240,(.88,.96,1),4)
    base.add_light("Rim",(1,4,5),700,(.85,1,.96),3)
    scene=bpy.context.scene
    scene.world.use_nodes=True
    bg=scene.world.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value=(*linear("EFECE4"),1)
    bg.inputs["Strength"].default_value=.3
    camera_data=bpy.data.cameras.new("Review_Camera")
    camera=bpy.data.objects.new("Review_Camera",camera_data)
    bpy.context.collection.objects.link(camera)
    scene.camera=camera;camera_data.type="ORTHO";camera_data.ortho_scale=6.7
    scene.render.engine="CYCLES"
    scene.cycles.device="CPU"
    scene.cycles.samples=args.samples
    scene.cycles.use_denoising=True
    scene.render.threads_mode="FIXED";scene.render.threads=2
    scene.render.resolution_x=args.size;scene.render.resolution_y=args.size
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format="PNG"
    scene.render.image_settings.color_mode="RGBA"
    scene.view_settings.view_transform="AgX"
    scene.view_settings.look="AgX - Medium High Contrast"
    scene["design_basis"]="B2/C3; flow-v2 isolated form study; no rig or animation approval"
    scene["material_note"]="SSS is Blender-only; glTF uses vertex color and PBR fallback"
    views={"hero":((3,-14,3.1),(0,0,.15)),"front":((0,-14,1.3),(0,0,.15)),
           "side":((12,-3,2),(0,0,.15))}
    camera.location=views["hero"][0];base.look_at(camera,views["hero"][1])
    bpy.ops.wm.save_as_mainfile(filepath=str(output/"zibloo_flow_v2.blend"))
    bpy.ops.object.select_all(action="DESELECT")
    for obj in assets: obj.select_set(True)
    bpy.context.view_layer.objects.active=body
    bpy.ops.export_scene.gltf(filepath=str(output/"zibloo_flow_v2.glb"),export_format="GLB",use_selection=True,
                              export_apply=True,export_cameras=False,export_lights=False,
                              export_vertex_color="NAME",export_vertex_color_name="BellyColor",
                              export_draco_mesh_compression_enable=False)
    for name,(position,target) in views.items():
        camera.location=position;base.look_at(camera,target)
        scene.render.filepath=str(output/(name+".png"))
        bpy.ops.render.render(write_still=True)
    # Transparent version shares framing and material with the hero image.
    camera.location=views["hero"][0];base.look_at(camera,views["hero"][1])
    ground.hide_render=True;scene.render.film_transparent=True
    scene.render.filepath=str(output/"hero-transparent.png")
    bpy.ops.render.render(write_still=True)
    triangles=sum(len(p.vertices)-2 for obj in assets for p in obj.data.polygons)
    report={"blender":bpy.app.version_string,"triangles":triangles,"arm_count":len(ARMS),
            "body_vertices":len(body.data.vertices),"glb_bytes":(output/"zibloo_flow_v2.glb").stat().st_size,
            "vertex_color":"BellyColor","render_device":"CPU","samples":args.samples,
            "views":list(views),"rigged":False,"animated":False}
    (output/"report.json").write_text(json.dumps(report,indent=2)+"\n")
    print(json.dumps(report))


if __name__=="__main__":main()
