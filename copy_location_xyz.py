bl_info = {
    "name": "Copy Active Object Location (axis remap)",
    "blender": (4, 4, 0),
    "category": "3D View",
}

import bpy
from mathutils import Vector

def fmt(v: Vector, precision=6) -> str:
    """Formatta Vector in 'x,y,z' con precisione configurabile."""
    f = f"{{:.{precision}f}}"
    return ",".join((f.format(v.x), f.format(v.y), f.format(v.z)))

class VIEW3D_OT_copy_location_remap(bpy.types.Operator):
    bl_idname = "view3d.copy_location_remap"
    bl_label = "Copia posizione (rimappata)"
    bl_description = "Copia negli appunti la posizione mondo rimappata: x'=x, y'=-z, z'=y"

    precision: bpy.props.IntProperty(
        name="Precisione",
        default=6, min=0, max=10,
        description="Cifre decimali"
    )

    def execute(self, context):
        obj = context.view_layer.objects.active
        if not obj:
            self.report({'ERROR'}, "Nessun oggetto attivo selezionato")
            return {'CANCELLED'}

        # posizione in spazio mondo
        world_pos = obj.matrix_world.translation

        # conversione assi richiesta
        converted = Vector((
            world_pos.x,      # x' = x
            -world_pos.z,     # y' = -z
            world_pos.y       # z' = y
        ))

        s = fmt(converted, self.precision)

        # copia negli appunti e salva in scena
        context.window_manager.clipboard = s
        context.scene["last_xyz_remap"] = s

        self.report({'INFO'}, f"Posizione rimappata copiata: {s}")
        print(f"[Copy Location Remap] {obj.name}: {s}")
        return {'FINISHED'}

class VIEW3D_PT_copy_location_remap(bpy.types.Panel):
    bl_label = "Copy Posizione Rimappata"
    bl_idname = "VIEW3D_PT_copy_location_remap"
    bl_space_type = 'VIEW_3D'
    bl_region_type = 'UI'
    bl_category = 'Item'

    def draw(self, context):
        layout = self.layout
        col = layout.column(align=True)
        op = col.operator("view3d.copy_location_remap", text="Copia posizione (rimappata)")
        op.precision = 6
        col.separator()
        col.prop(context.scene, 'tools_last_xyz_remap', text="Ultimo valore", emboss=True)

# proprietà helper per mostrare il valore nel pannello
def _get_last_xyz_remap(self):
    return self.get("last_xyz_remap", "")

def register():
    bpy.utils.register_class(VIEW3D_OT_copy_location_remap)
    bpy.utils.register_class(VIEW3D_PT_copy_location_remap)
    bpy.types.Scene.tools_last_xyz_remap = bpy.props.StringProperty(
        name="Ultimo xx,yy,zz (rimappato)",
        get=_get_last_xyz_remap
    )

def unregister():
    del bpy.types.Scene.tools_last_xyz_remap
    bpy.utils.unregister_class(VIEW3D_PT_copy_location_remap)
    bpy.utils.unregister_class(VIEW3D_OT_copy_location_remap)

if __name__ == "__main__":
    register()
