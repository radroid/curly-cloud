"""Optional Blender render of the exported GLB. Arguments after --: input.glb output.png yaw_degrees."""
import bpy, math, sys
from mathutils import Vector
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
args=sys.argv[sys.argv.index('--')+1:]
bpy.ops.import_scene.gltf(filepath=args[0])
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
root=bpy.data.objects.new('Turntable',None); bpy.context.collection.objects.link(root)
for o in meshes:
    o.parent=root
angle=float(args[2]) if len(args)>2 else 0
root.rotation_euler.z=math.radians(angle)
world=bpy.context.scene.world
world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(0.12,0.15,0.14,1)
world.node_tree.nodes['Background'].inputs[1].default_value=0.6
bpy.ops.object.camera_add(location=(0,-2.3,0.01))
cam=bpy.context.object; cam.rotation_euler=(Vector((0,0,0.01))-cam.location).to_track_quat('-Z','Y').to_euler(); cam.data.type='ORTHO'; cam.data.ortho_scale=1.25
bpy.context.scene.camera=cam
for loc,power,size in [((-1,-1.5,2),75,2),((1,-0.5,0.5),30,1.5),((0,1,1.5),70,1.2)]:
    bpy.ops.object.light_add(type='AREA',location=loc); light=bpy.context.object; light.data.energy=power; light.data.shape='DISK';light.data.size=size;light.rotation_euler=(Vector((0,0,0))-light.location).to_track_quat('-Z','Y').to_euler()
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24
scene.render.resolution_x=800;scene.render.resolution_y=800;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.film_transparent=True
scene.view_settings.view_transform='Standard';scene.render.filepath=args[1]

bpy.ops.render.render(write_still=True)
