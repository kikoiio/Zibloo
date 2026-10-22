import bpy
import math
import os
from mathutils import Vector


ROOT = os.path.dirname(os.path.abspath(__file__))
OUT_BLEND = os.path.join(ROOT, "zibloo_3d_base.blend")
OUT_RENDER = os.path.join(ROOT, "zibloo_3d_base.png")
OUT_GLB = os.path.join(ROOT, "zibloo_3d_base.glb")


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.curves, bpy.data.meshes, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for block in list(datablocks):
            if block.users == 0:
                datablocks.remove(block)


def mat_principled(name, color, roughness=0.42, sss=0.0, sheen=0.12, transmission=0.0, emission=None):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1.0)
    mat.use_nodes = True
    bsdf = next((node for node in mat.node_tree.nodes if node.bl_idname == "ShaderNodeBsdfPrincipled"), None)
    if bsdf is None:
        raise RuntimeError("Principled BSDF node unavailable")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = 0.0
    if "Subsurface Weight" in bsdf.inputs:
        bsdf.inputs["Subsurface Weight"].default_value = sss
        if "Subsurface Radius" in bsdf.inputs:
            bsdf.inputs["Subsurface Radius"].default_value = (0.7, 0.35, 0.25)
    if "Sheen Weight" in bsdf.inputs:
        bsdf.inputs["Sheen Weight"].default_value = sheen
    if "Transmission Weight" in bsdf.inputs:
        bsdf.inputs["Transmission Weight"].default_value = transmission
    if emission:
        if "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
        if "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = 1.4
    return mat


def mat_tentacle_mix(teal, mint):
    mat = bpy.data.materials.new("Tentacle_DualTone_NormalBlend")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()
    out = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Roughness"].default_value = 0.42
    bsdf.inputs["Metallic"].default_value = 0.0
    if "Subsurface Weight" in bsdf.inputs:
        bsdf.inputs["Subsurface Weight"].default_value = 0.18
    if "Sheen Weight" in bsdf.inputs:
        bsdf.inputs["Sheen Weight"].default_value = 0.12
    geo = nodes.new("ShaderNodeNewGeometry")
    sep = nodes.new("ShaderNodeSeparateXYZ")
    remap = nodes.new("ShaderNodeMapRange")
    remap.inputs["From Min"].default_value = -1.0
    remap.inputs["From Max"].default_value = 1.0
    remap.inputs["To Min"].default_value = 0.0
    remap.inputs["To Max"].default_value = 1.0
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.interpolation = "EASE"
    ramp.color_ramp.elements[0].position = 0.18
    ramp.color_ramp.elements[0].color = (*mint.diffuse_color[:3], 1.0)
    ramp.color_ramp.elements[1].position = 0.46
    ramp.color_ramp.elements[1].color = (*teal.diffuse_color[:3], 1.0)
    links.new(geo.outputs["Normal"], sep.inputs[0])
    links.new(sep.outputs["Z"], remap.inputs["Value"])
    links.new(remap.outputs["Result"], ramp.inputs[0])
    links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    links.new(bsdf.outputs[0], out.inputs[0])
    return mat


def add_uv(name, loc, scale, mat, segments=48, rings=32):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bpy.ops.object.shade_smooth()
    if mat:
        obj.data.materials.append(mat)
    return obj


def add_body(mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=40, location=(0.0, 0.0, 1.25))
    obj = bpy.context.object
    obj.name = "Zibloo_Mantle"
    obj.scale = (1.16, 1.06, 1.72)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    # Pull the lower third inward to create the soft teardrop neck.
    for v in obj.data.vertices:
        z = v.co.z / 1.72
        if z < -0.10:
            t = max(0.0, min(1.0, (-z - 0.10) / 0.90))
            factor = 1.0 - 0.34 * (t ** 0.72)
            v.co.x *= factor
            v.co.y *= factor
        if z < -0.72:
            # Keep the underside rounded and collar-like instead of ending in a
            # pointed egg tip.
            t = max(0.0, min(1.0, (-z - 0.72) / 0.28))
            v.co.z = -1.24 - 0.12 * (t ** 1.5)
    bpy.ops.object.shade_smooth()
    obj.data.materials.append(mat)
    return obj


def add_curve(name, points, radii, mat, bevel=0.27, y_offset=0.0, z_offset=0.0):
    curve = bpy.data.curves.new(name, type="CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 14
    curve.bevel_depth = bevel
    curve.bevel_resolution = 5
    curve.resolution_u = 16
    curve.fill_mode = "FULL"
    curve.use_fill_caps = True
    spline = curve.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for bp, co, radius in zip(spline.bezier_points, points, radii):
        bp.co = (co[0], co[1] + y_offset, co[2] + z_offset)
        bp.handle_left_type = "AUTO"
        bp.handle_right_type = "AUTO"
        bp.radius = radius
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    curve.materials.append(mat)
    return obj


def catmull_rom(p0, p1, p2, p3, t):
    t2 = t * t
    t3 = t2 * t
    return 0.5 * ((2.0 * p1) + (-p0 + p2) * t +
                  (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t2 +
                  (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * t3)


def add_tube_mesh(index, points, radii, teal, mint):
    """Build one continuous rounded tube with teal upper and mint lower faces."""
    controls = [Vector(p) for p in points]
    sampled = []
    sampled_r = []
    steps = 8
    for i in range(len(controls) - 1):
        p0 = controls[max(0, i - 1)]
        p1 = controls[i]
        p2 = controls[i + 1]
        p3 = controls[min(len(controls) - 1, i + 2)]
        for j in range(steps):
            t = j / steps
            sampled.append(catmull_rom(p0, p1, p2, p3, t))
            sampled_r.append(radii[i] * (1.0 - t) + radii[i + 1] * t)
    sampled.append(controls[-1])
    sampled_r.append(radii[-1])

    # Add a short hemispherical terminal cap instead of a flat slice.
    tangent = (sampled[-1] - sampled[-2]).normalized()
    cap_center = sampled[-1]
    cap_radius = sampled_r[-1] * 0.315
    for q in range(1, 5):
        a = (math.pi * 0.5) * q / 4.0
        sampled.append(cap_center + tangent * (cap_radius * math.sin(a)))
        sampled_r.append((sampled_r[-1]) * math.cos(a))

    sides = 20
    verts = []
    frames = []
    for i, center in enumerate(sampled):
        if i == 0:
            tangent = (sampled[1] - sampled[0]).normalized()
        elif i == len(sampled) - 1:
            tangent = (sampled[-1] - sampled[-2]).normalized()
        else:
            tangent = (sampled[i + 1] - sampled[i - 1]).normalized()
        ref = Vector((0.0, 0.0, 1.0))
        if abs(tangent.dot(ref)) > 0.92:
            ref = Vector((0.0, 1.0, 0.0))
        n1 = tangent.cross(ref).normalized()
        n2 = tangent.cross(n1).normalized()
        frames.append((n1, n2))
        for j in range(sides):
            theta = 2.0 * math.pi * j / sides
            radial = n1 * math.cos(theta) + n2 * math.sin(theta)
            verts.append(tuple(center + radial * (sampled_r[i] * 0.315)))

    faces = []
    face_mats = []
    for i in range(len(sampled) - 1):
        for j in range(sides):
            nj = (j + 1) % sides
            faces.append((i * sides + j, i * sides + nj, (i + 1) * sides + nj, (i + 1) * sides + j))
            radial = frames[i][0] * math.cos(2.0 * math.pi * (j + 0.5) / sides) + frames[i][1] * math.sin(2.0 * math.pi * (j + 0.5) / sides)
            face_mats.append(1 if radial.z < -0.08 else 0)
    # Root cap is hidden in the mantle but keeps the exported mesh watertight.
    root_center = len(verts)
    verts.append(tuple(sampled[0]))
    for j in range(sides):
        nj = (j + 1) % sides
        faces.append((root_center, nj, j))
        face_mats.append(0)

    mesh = bpy.data.meshes.new(f"Tentacle_{index:02d}_Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(f"Tentacle_{index:02d}", mesh)
    bpy.context.collection.objects.link(obj)
    mesh.materials.append(teal)
    mesh.materials.append(mint)
    for poly, mat_index in zip(mesh.polygons, face_mats):
        poly.material_index = mat_index
        poly.use_smooth = True
    return obj


def add_tentacle(index, points, radii, teal, mint, front=False):
    obj = add_curve(f"Tentacle_{index:02d}", points, radii, teal, bevel=0.315)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.object
    # One continuous tube. The material itself blends by surface normal, so the
    # teal-to-mint boundary remains smooth around bends and curls.
    for poly in obj.data.polygons:
        poly.use_smooth = True
    obj.select_set(False)
    return obj


def look_at(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def add_light(name, loc, energy, color, size):
    data = bpy.data.lights.new(name, type="AREA")
    data.energy = energy
    data.color = color
    data.shape = "DISK"
    data.size = size
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = loc
    look_at(obj, (0.0, 0.0, 0.4))
    return obj


def build_scene():
    clear_scene()
    teal = mat_principled("Deep Ocean Teal #236E69", (0.0168, 0.145, 0.130), roughness=0.45, sss=0.12)
    mint = mat_principled("Pale Mint #A3D9C9", (0.36, 0.74, 0.66), roughness=0.40, sss=0.18)
    tentacle_mix = mat_tentacle_mix(teal, mint)
    ink = mat_principled("Ink Obsidian #0E1D1E", (0.004, 0.012, 0.013), roughness=0.30, sheen=0.16)
    ivory = mat_principled("Soft Ivory #F3F8F5", (0.88, 0.96, 0.93), roughness=0.25, sheen=0.2)
    orb_mat = mat_principled("Luminous Orb #EAF8F5", (0.72, 0.94, 0.89), roughness=0.16, sss=0.18,
                              sheen=0.22, transmission=0.22, emission=(0.42, 0.9, 0.78))

    add_body(teal)

    # Eyes: small vertical capsules with restrained ivory highlights.
    for x in (-0.38, 0.38):
        add_uv("Eye_L" if x < 0 else "Eye_R", (x, -0.995, 1.37), (0.118, 0.080, 0.225), ink, 32, 24)
        add_uv("Eye_Highlight_L" if x < 0 else "Eye_Highlight_R", (x - 0.036, -1.080, 1.45),
               (0.030, 0.015, 0.056), ivory, 24, 16)

    # Curves are intentionally grouped with a few foreground arms and quieter rear arms.
    tentacles = [
        [(-0.52, 0.26, -0.08), (-1.22, 0.25, -0.22), (-2.05, 0.16, -0.03), (-2.55, 0.02, 0.38), (-2.32, -0.04, 0.64)],
        [(-0.38, 0.52, -0.20), (-0.94, 0.46, -0.76), (-1.70, 0.35, -1.34), (-2.06, 0.26, -1.23), (-2.13, 0.20, -0.88)],
        [(-0.38, -0.28, -0.22), (-0.82, -0.48, -0.88), (-1.03, -0.58, -1.55), (-0.70, -0.64, -1.82), (-0.28, -0.66, -1.58)],
        [(-0.10, -0.46, -0.22), (-0.18, -0.70, -0.88), (-0.03, -0.80, -1.64), (0.37, -0.82, -1.88), (0.59, -0.74, -1.55)],
        [(0.24, -0.38, -0.20), (0.65, -0.56, -0.76), (1.05, -0.62, -1.36), (0.87, -0.66, -1.74), (0.45, -0.66, -1.62)],
        [(0.47, 0.38, -0.10), (1.12, 0.32, -0.38), (1.90, 0.25, -0.57), (2.35, 0.16, -0.32), (2.15, 0.10, -0.04)],
        [(0.50, -0.28, -0.02), (0.94, -0.70, 0.24), (1.45, -1.00, 0.68), (1.61, -1.12, 1.23), (1.25, -1.15, 1.53)],
        [(-0.48, 0.70, -0.04), (-1.15, 0.76, 0.12), (-1.92, 0.66, 0.28), (-2.42, 0.50, 0.62), (-2.38, 0.42, 0.92)],
    ]
    for i, pts in enumerate(tentacles, 1):
        radii = [1.05, 1.04, 0.98, 0.92, 0.86]
        add_tentacle(i, pts, radii, tentacle_mix, mint, front=(i in (3, 4, 5, 6, 7)))

    # Hero orb embraced by the raised right arm.
    orb = add_uv("Luminous_Orb", (1.88, -1.30, 1.02), (0.32, 0.32, 0.32), orb_mat, 40, 24)
    orb.data.materials.clear()
    orb.data.materials.append(orb_mat)
    light_data = bpy.data.lights.new("Orb_Glow", type="POINT")
    light_data.energy = 38
    light_data.color = (0.62, 1.0, 0.88)
    light_data.shadow_soft_size = 0.8
    orb_light = bpy.data.objects.new("Orb_Glow", light_data)
    bpy.context.collection.objects.link(orb_light)
    orb_light.location = orb.location

    # Ground and studio backdrop.
    ground_mat = mat_principled("Warm Studio Ground", (0.74, 0.71, 0.66), roughness=0.58, sheen=0.05)
    bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 0, -2.22))
    ground = bpy.context.object
    ground.name = "Studio_Ground"
    ground.data.materials.append(ground_mat)

    add_light("Key_Softbox", (-4.8, -5.5, 7.5), 900, (1.0, 0.91, 0.82), 5.0)
    add_light("Fill_Softbox", (5.5, -3.0, 4.0), 520, (0.75, 0.90, 1.0), 4.0)
    add_light("Rim_Softbox", (2.0, 3.8, 7.0), 1000, (0.70, 0.96, 0.90), 3.0)

    world = bpy.context.scene.world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = (0.74, 0.71, 0.66, 1.0)
    bg.inputs["Strength"].default_value = 0.24

    cam_data = bpy.data.cameras.new("Hero_Camera")
    cam = bpy.data.objects.new("Hero_Camera", cam_data)
    bpy.context.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    cam.location = (6.6, -14.8, 3.55)
    cam_data.lens = 63
    look_at(cam, (0.0, 0.0, 0.05))

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = 900
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = OUT_RENDER
    scene.render.film_transparent = False
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.render.image_settings.color_depth = "8"
    scene.render.use_file_extension = True

    # Keep the asset organized for later pose work.
    for obj in bpy.context.scene.objects:
        if obj.name.startswith("Tentacle"):
            obj["zibloo_role"] = "tentacle"
        elif obj.name == "Zibloo_Mantle":
            obj["zibloo_role"] = "mantle"
    scene["zibloo_design_basis"] = "B2/C3; docs/brand/3D-character-guidelines.md"
    scene["zibloo_pose"] = "idle-hero-base"
    scene["zibloo_palette"] = "#236E69 #A3D9C9 #0E1D1E #F3F8F5 #EAF8F5"

    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
    bpy.ops.render.render(write_still=True)
    # Export only the character and orb; exclude the studio ground and lights.
    for obj in bpy.context.scene.objects:
        obj.select_set(obj.type in {"MESH", "CURVE"} and obj.name != "Studio_Ground")
    bpy.context.view_layer.objects.active = bpy.data.objects.get("Zibloo_Mantle")
    bpy.ops.export_scene.gltf(filepath=OUT_GLB, export_format="GLB", use_selection=True,
                              export_apply=True, export_materials="EXPORT", export_cameras=False,
                              export_lights=False, export_draco_mesh_compression_enable=True,
                              export_draco_mesh_compression_level=6)


if __name__ == "__main__":
    build_scene()
