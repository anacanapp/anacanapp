class_name MetroCommuter3D
extends Node3D

static var library: AnimationLibrary
var skeleton: Skeleton3D
var animator: AnimationPlayer
var garment_materials: Array[ShaderMaterial] = []
var accessories: Node3D
var player := false
var seed_value := 0
var playing := ""
var motion := 0.0
var animation_accumulator := 0.0
var detail_rate := 0.05
var base_scale := 1.0
var gender := false
var portrait := false
var body_material: ShaderMaterial

func setup(index: int = 0, is_player: bool = false) -> void:
	seed_value = index
	player = is_player
	gender = index % 3 == 1 and not player
	var model: Node3D = load("res://assets/characters/%s.gltf" % ("mother" if gender else "partner")).instantiate()
	model.name = "SkinnedCommuter"
	add_child(model)
	skeleton = find_type(model, "Skeleton3D") as Skeleton3D
	var skin_colors := [Color("d5a783"), Color("bb8868"), Color("e3b799"), Color("c39172"), Color("9c6a50")]
	var outfits := [Color("304959"), Color("a28c72"), Color("55674e"), Color("6a514c"), Color("737b84"), Color("c0b1a0"), Color("404f52"), Color("817069")]
	var skin: Color = skin_colors[posmod(index, skin_colors.size())]
	var outfit: Color = Color("456979") if player else outfits[posmod(index, outfits.size())]
	var pants: Color = Color("25313d") if player else [Color("363c42"), Color("514a42"), Color("282e36")][posmod(index, 3)]
	for mesh in meshes(model):
		mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
		if "Super" in str(mesh.name):
			var mat := ShaderMaterial.new()
			mat.shader = load("res://shaders/commuter.gdshader")
			mat.set_shader_parameter("skin_colour", skin)
			mat.set_shader_parameter("shirt_colour", outfit)
			mat.set_shader_parameter("trouser_colour", pants)
			mat.set_shader_parameter("body_normal", load("res://assets/characters/T_Superhero_%s_Normal.png" % ("Female" if gender else "Male")))
			mat.set_shader_parameter("fabric_normal", load("res://assets/materials/fabric-normal.png"))
			mesh.material_override = mat
			body_material = mat
		elif str(mesh.name) in ["Jersey", "Trousers"]:
			var mat := ShaderMaterial.new()
			mat.shader = load("res://shaders/cloth.gdshader")
			mat.set_shader_parameter("colour", outfit if str(mesh.name) == "Jersey" else pants)
			mat.set_shader_parameter("weave_normal", load("res://assets/materials/fabric-normal.png"))
			mesh.material_override = mat
			garment_materials.append(mat)
			if str(mesh.name) == "Jersey":
				# Trim noisy anatomical shell triangles, retaining a clean knit top.
				mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	if library == null: build_library()
	animator = AnimationPlayer.new()
	model.add_child(animator)
	animator.root_node = animator.get_path_to(skeleton)
	animator.add_animation_library("", library)
	animator.callback_mode_process = AnimationMixer.ANIMATION_CALLBACK_MODE_PROCESS_MANUAL
	animate("Idle")
	animator.seek(fmod(index * 0.31, 1.5), true)
	var hair: Node3D = load("res://assets/characters/%s.gltf" % ("Hair_Buns" if gender else "Hair_SimpleParted")).instantiate()
	var hair_socket := socket("Head")
	hair_socket.add_child(hair)
	var head_index := skeleton.find_bone("Head")
	hair.transform = skeleton.get_bone_global_rest(head_index).affine_inverse()
	for mesh in meshes(hair):
		var mat := MetroMesh.material([Color("241f1a"), Color("473428"), Color("312b27"), Color("756253")][posmod(index, 4)], 0.75)
		mesh.material_override = mat
	accessories = Node3D.new()
	accessories.name = "Equipment"
	add_child(accessories)
	base_scale = 1.0 if player else 0.93 + (index % 5) * 0.028
	scale = Vector3.ONE * base_scale
	detail_rate = 0.0 if player else 0.045 + (index % 3) * 0.025
	_build_shoes({})
	if not player and index % 4 == 0: _backpack(Color("79614f"))
	if not player and index % 6 == 2: _phone()
	if player: equip(Metro.profile.equipped)

func socket(bone: String) -> BoneAttachment3D:
	var attach := BoneAttachment3D.new()
	attach.bone_name = bone
	skeleton.add_child(attach)
	return attach

func geometry_socket(bone: String, tag: String) -> Node3D:
	var attach := socket(bone)
	attach.name = tag
	var group := Node3D.new()
	attach.add_child(group)
	group.transform = skeleton.get_bone_global_rest(skeleton.find_bone(bone)).affine_inverse()
	return group

func equip(equipment: Dictionary) -> void:
	for tag in ["MetroHelmet", "MetroHeadphones", "MetroPack", "MetroWatch", "MetroGloveL", "MetroGloveR", "MetroShoesL", "MetroShoesR"]:
		var node := skeleton.get_node_or_null(tag)
		if node != null:
			skeleton.remove_child(node)
			node.queue_free()
	_build_shoes(equipment)
	if equipment.get("head") == "helmet":
		var group := geometry_socket("Head", "MetroHelmet")
		var gold := MetroMesh.material(Color("e8b24e"), 0.4)
		MetroMesh.sphere(group, Vector3(0, 1.745, 0.012), Vector3(0.35, 0.27, 0.34), gold)
		MetroMesh.box(group, Vector3(0, 1.715, 0.05), Vector3(0.40, 0.025, 0.39), gold, 0.025)
		MetroMesh.box(group, Vector3(0, 1.866, 0.035), Vector3(0.022, 0.014, 0.25), MetroMesh.material(Color("ffe0a2"), 0.4), 0.004)
	elif equipment.get("head") == "headphones":
		var group := geometry_socket("Head", "MetroHeadphones")
		for side in [-1, 1]:
			MetroMesh.sphere(group, Vector3(side * 0.145, 1.68, -0.002), Vector3(0.055, 0.12, 0.1), MetroMesh.material(Color("1d2a30"), 0.6))
		MetroMesh.box(group, Vector3(0, 1.81, -0.035), Vector3(0.31, 0.02, 0.055), MetroMesh.material(Color("637e85"), 0.35, 0.45), 0.01)
	if equipment.get("back") == "backpack": _backpack(Color("82684f"))
	if equipment.get("accessory") == "watch":
		var group := geometry_socket("hand_l", "MetroWatch")
		MetroMesh.box(group, Vector3(0.62, 1.36, 0.004), Vector3(0.04, 0.045, 0.085), MetroMesh.material(Color("242d33"), 0.4), 0.008)
	if equipment.get("hands") == "gloves":
		for side in [-1, 1]:
			var group := geometry_socket("hand_l" if side == 1 else "hand_r", "MetroGloveL" if side == 1 else "MetroGloveR")
			MetroMesh.sphere(group, Vector3(side * 0.77, 1.35, 0.0), Vector3(0.16, 0.09, 0.07), MetroMesh.material(Color("514436"), 0.9))
	if garment_materials.size() > 0:
		var shirt_color := Color("456979") if equipment.get("body") != "jacket" else Color("263d59")
		garment_materials[0].set_shader_parameter("colour", shirt_color)
		if body_material != null:
			body_material.set_shader_parameter("shirt_colour", shirt_color)
			body_material.set_shader_parameter("shoe_colour", Color("b8c0bf") if equipment.get("feet") == "sneakers" else Color("252b31"))
	var bulk := float(Metro.player_stats().size)
	scale = Vector3(bulk, 1.0 + (bulk - 1) * 0.28, bulk)

func _build_shoes(equipment: Dictionary) -> void:
	for side in [-1, 1]:
		var group := geometry_socket("foot_l" if side == 1 else "foot_r", "MetroShoesL" if side == 1 else "MetroShoesR")
		var color := Color("d0d2c8") if equipment.get("feet") == "sneakers" else Color("252b31")
		MetroMesh.sphere(group, Vector3(side * 0.114, 0.055, -0.005), Vector3(0.17, 0.12, 0.30), MetroMesh.material(color, 0.8))
		MetroMesh.box(group, Vector3(side * 0.114, 0.012, -0.005), Vector3(0.175, 0.032, 0.31), MetroMesh.material(Color("818b8e"), 0.8), 0.010)

func _backpack(color: Color) -> void:
	var group := geometry_socket("spine_03", "MetroPack")
	MetroMesh.box(group, Vector3(0, 1.31, -0.19), Vector3(0.34, 0.42, 0.18), MetroMesh.material(color, 0.86), 0.055)
	MetroMesh.box(group, Vector3(0, 1.2, -0.29), Vector3(0.26, 0.15, 0.045), MetroMesh.material(color.darkened(0.12), 0.9), 0.025)
	for side in [-1, 1]: MetroMesh.rod(group, Vector3(side * 0.13, 1.5, -0.12), Vector3(side * 0.13, 1.10, -0.06), 0.018, MetroMesh.material(Color("313033"), 0.9))

func _phone() -> void:
	var group := geometry_socket("hand_r", "Phone")
	MetroMesh.box(group, Vector3(-0.81, 1.37, 0.07), Vector3(0.07, 0.012, 0.14), MetroMesh.material(Color("15232e"), 0.35, 0.4), 0.007)

func animate(id: String, speed: float = 1.0) -> void:
	if animator == null or not library.has_animation(id): return
	if playing != id:
		playing = id
		animator.play(id, 0.15)
	animator.speed_scale = speed

func _process(delta: float) -> void:
	motion += delta
	animation_accumulator += delta
	if animator != null and animation_accumulator >= detail_rate:
		animator.advance(animation_accumulator)
		animation_accumulator = 0

static func build_library() -> void:
	library = AnimationLibrary.new()
	var source: Node = load("res://assets/characters/animations.glb").instantiate()
	var animation_player: AnimationPlayer = find_type(source, "AnimationPlayer") as AnimationPlayer
	for id in ["Idle", "Walk", "Jog_Fwd", "Sprint", "Push", "Idle_Talking", "Sitting_Idle", "Interact"]:
		if not animation_player.has_animation(id): continue
		var clip: Animation = animation_player.get_animation(id).duplicate(true)
		for track in range(clip.get_track_count()):
			var path := clip.track_get_path(track)
			clip.track_set_path(track, NodePath(":" + path.get_concatenated_subnames()))
		clip.loop_mode = Animation.LOOP_NONE if id in ["Push", "Interact"] else Animation.LOOP_LINEAR
		library.add_animation(id, clip)
	source.free()

static func find_type(node: Node, kind: String) -> Node:
	if node.is_class(kind): return node
	for child in node.get_children():
		var found := find_type(child, kind)
		if found != null: return found
	return null

static func meshes(node: Node) -> Array[MeshInstance3D]:
	var result: Array[MeshInstance3D] = []
	if node is MeshInstance3D: result.append(node)
	for child in node.get_children(): result.append_array(meshes(child))
	return result
