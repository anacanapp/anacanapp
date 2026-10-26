class_name MetroMesh
extends RefCounted

static var materials := {}
static var meshes := {}

static func material(color: Color, roughness: float = 0.65, metal: float = 0.0, emission: float = 0.0) -> StandardMaterial3D:
	var key := str(color) + ":" + str(roughness) + ":" + str(metal) + ":" + str(emission)
	if materials.has(key): return materials[key]
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.roughness = roughness
	mat.metallic = metal
	if emission > 0:
		mat.emission_enabled = true
		mat.emission = color
		mat.emission_energy_multiplier = emission
	materials[key] = mat
	return mat

static func pbr(id: String, color: Color = Color.WHITE, uv: float = 1.0, roughness: float = 0.65, metallic: float = 0.0) -> StandardMaterial3D:
	var mat := material(color, roughness, metallic).duplicate() as StandardMaterial3D
	mat.albedo_texture = load("res://assets/materials/" + id + "/albedo.jpg")
	mat.normal_enabled = true
	mat.normal_texture = load("res://assets/materials/" + id + "/normal.jpg")
	mat.normal_scale = 0.22 if id == "marble" else 0.45
	mat.roughness_texture = load("res://assets/materials/" + id + "/roughness.jpg")
	mat.roughness_texture_channel = BaseMaterial3D.TEXTURE_CHANNEL_RED
	mat.uv1_scale = Vector3(uv, uv, 1)
	mat.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
	return mat

static func box(parent: Node3D, position: Vector3, dimensions: Vector3, mat: Material, bevel: float = 0.0) -> MeshInstance3D:
	var node := MeshInstance3D.new()
	var key := str(dimensions) + ":" + str(bevel)
	if not meshes.has(key):
		if bevel <= 0:
			var mesh := BoxMesh.new()
			mesh.size = dimensions
			meshes[key] = mesh
		else:
			meshes[key] = _beveled_box(dimensions, minf(bevel, minf(dimensions.x, minf(dimensions.y, dimensions.z)) * 0.47))
	node.mesh = meshes[key]
	node.material_override = mat
	node.position = position
	parent.add_child(node)
	return node

static func cylinder(parent: Node3D, position: Vector3, radius: float, height: float, mat: Material, top_radius: float = -1) -> MeshInstance3D:
	var node := MeshInstance3D.new()
	var mesh := CylinderMesh.new()
	mesh.bottom_radius = radius
	mesh.top_radius = radius if top_radius < 0 else top_radius
	mesh.height = height
	mesh.radial_segments = 16
	mesh.rings = 1
	node.mesh = mesh
	node.position = position
	node.material_override = mat
	parent.add_child(node)
	return node

static func sphere(parent: Node3D, position: Vector3, dimensions: Vector3, mat: Material) -> MeshInstance3D:
	var node := MeshInstance3D.new()
	var mesh := SphereMesh.new()
	mesh.radius = 0.5
	mesh.height = 1
	mesh.radial_segments = 24
	mesh.rings = 12
	node.mesh = mesh
	node.scale = dimensions
	node.position = position
	node.material_override = mat
	parent.add_child(node)
	return node

static func rod(parent: Node3D, a: Vector3, b: Vector3, radius: float, mat: Material) -> MeshInstance3D:
	var node := cylinder(parent, (a + b) * 0.5, radius, a.distance_to(b), mat)
	var direction := (b - a).normalized()
	if absf(direction.dot(Vector3.UP)) < 0.999:
		node.quaternion = Quaternion(Vector3.UP, direction)
	return node

static func text(parent: Node3D, copy: String, position: Vector3, size: int = 44, color: Color = Color("f3ede2"), pixel_size: float = 0.005, rotation: Vector3 = Vector3.ZERO) -> Label3D:
	var label := Label3D.new()
	label.text = copy
	label.position = position
	label.rotation_degrees = rotation
	label.font = load("res://assets/fonts/NotoSans.ttf")
	label.font_size = size
	label.pixel_size = pixel_size
	label.modulate = color
	label.outline_size = 0
	label.no_depth_test = false
	label.shaded = false
	label.alpha_cut = Label3D.ALPHA_CUT_OPAQUE_PREPASS
	parent.add_child(label)
	return label

static func contact_shadow(parent: Node3D, radius: Vector2, position: Vector3 = Vector3(0, 0.01, 0)) -> MeshInstance3D:
	var node := MeshInstance3D.new()
	var plane := PlaneMesh.new()
	plane.size = radius
	node.mesh = plane
	var mat := StandardMaterial3D.new()
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.albedo_texture = load("res://assets/materials/contact-shadow.png")
	mat.albedo_color = Color(1, 1, 1, 0.56)
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	node.material_override = mat
	node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	node.position = position
	parent.add_child(node)
	return node

static func batch_direct(parent: Node3D) -> int:
	# Merge only static, direct geometry. Skeletons, door roots, labels and all
	# gameplay transforms remain independent. This removes hundreds of tiny
	# tactile-dot/tile/seat draw calls on mobile without dropping their detail.
	var buckets := {}
	var originals: Array[MeshInstance3D] = []
	for child in parent.get_children():
		if not child is MeshInstance3D or child.mesh == null or child.skin != null: continue
		var mesh: Mesh = child.mesh
		for surface_index in range(mesh.get_surface_count()):
			var mat: Material = child.material_override if child.material_override != null else mesh.surface_get_material(surface_index)
			if mat == null: continue
			var id: int = mat.get_instance_id()
			if not buckets.has(id):
				var builder := SurfaceTool.new()
				builder.begin(Mesh.PRIMITIVE_TRIANGLES)
				buckets[id] = {"builder": builder, "material": mat}
			buckets[id].builder.append_from(mesh, surface_index, child.transform)
		originals.append(child)
	for id in buckets:
		var bucket: Dictionary = buckets[id]
		var merged := MeshInstance3D.new()
		merged.name = "BatchedStaticDetail"
		merged.mesh = bucket.builder.commit()
		merged.material_override = bucket.material
		parent.add_child(merged)
	for original in originals:
		parent.remove_child(original)
		original.queue_free()
	return buckets.size()

static func _beveled_box(dimensions: Vector3, radius: float) -> ArrayMesh:
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	var half := dimensions * 0.5
	var inner := half - Vector3.ONE * radius
	var normals := [Vector3.RIGHT, Vector3.LEFT, Vector3.UP, Vector3.DOWN, Vector3.BACK, Vector3.FORWARD]
	for face in range(6):
		var n: Vector3 = normals[face]
		var u := Vector3.BACK if face < 2 else Vector3.RIGHT
		var v := n.cross(u)
		var axis := n.abs().dot(half)
		var u_half := u.abs().dot(half)
		var v_half := v.abs().dot(half)
		var us := [-u_half, -u_half + radius, u_half - radius, u_half]
		var vs := [-v_half, -v_half + radius, v_half - radius, v_half]
		for x in range(3):
			for y in range(3):
				for corner in [Vector2i(0, 0), Vector2i(0, 1), Vector2i(1, 0), Vector2i(1, 0), Vector2i(0, 1), Vector2i(1, 1)]:
					var point: Vector3 = n * axis + u * float(us[x + corner.x]) + v * float(vs[y + corner.y])
					var clamped := point.clamp(-inner, inner)
					var normal := (point - clamped).normalized()
					surface.set_normal(normal)
					surface.set_uv(Vector2((float(us[x + corner.x]) + u_half) / (2 * u_half), (float(vs[y + corner.y]) + v_half) / (2 * v_half)))
					surface.add_vertex(clamped + normal * radius)
	return surface.commit()
