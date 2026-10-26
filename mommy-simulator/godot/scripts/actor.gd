class_name FamilyActor
extends Node3D

var skeleton: Skeleton3D
var animator: AnimationPlayer
var body: MeshInstance3D
var baby: Node3D
var female := true
var playing := ""
var head_rest := Transform3D.IDENTITY
var attire: ShaderMaterial
var garments: Array[ShaderMaterial] = []
var hand_socket: BoneAttachment3D
var pose_socket: Node3D
var head_time := 0.0
var gesture_remaining := 0.0
var carrying_child := false
static var library: AnimationLibrary

func setup(is_female := true) -> void:
	female = is_female
	garments.clear()
	playing = ""
	var model: Node3D = load("res://assets/characters/%s.gltf" % ("mother" if female else "partner")).instantiate()
	add_child(model)
	skeleton = find_type(model, "Skeleton3D") as Skeleton3D
	for node in meshes(model):
		if "Super" in str(node.name):
			body = node
			attire = clothes()
			node.material_override = attire
		elif "Eyebrow" in str(node.name):
			var brow := StandardMaterial3D.new()
			brow.albedo_color = Color(Life.state.avatar.hair)
			brow.roughness = .8
			node.material_override = brow
		elif str(node.name) in ["Jersey", "Trousers"]:
			var cloth := ShaderMaterial.new()
			cloth.shader = load("res://shaders/textile.gdshader")
			cloth.set_shader_parameter("colour", Color(Life.state.avatar.outfit) if female and str(node.name) == "Jersey" else Color("6e8375") if str(node.name) == "Jersey" else Color("b4afa0") if female else Color("465765"))
			cloth.set_shader_parameter("weave_normal", load("res://assets/details/cotton-normal.png"))
			node.material_override = cloth
			garments.append(cloth)
	if library == null:
		build_library()
	animator = AnimationPlayer.new()
	model.add_child(animator)
	animator.root_node = animator.get_path_to(skeleton)
	animator.add_animation_library("", library)
	animator.callback_mode_process = AnimationMixer.ANIMATION_CALLBACK_MODE_PROCESS_PHYSICS
	animator.play("Idle")
	hand_socket = BoneAttachment3D.new()
	skeleton.add_child(hand_socket)
	hand_socket.bone_name = "hand_r"
	pose_socket = Node3D.new()
	add_child(pose_socket)
	pose_socket.position = Vector3(.02, 1.09, .25)
	var hair: Node3D = load("res://assets/characters/%s.gltf" % ("Hair_Buns" if female else "Hair_SimpleParted")).instantiate()
	var attachment := BoneAttachment3D.new()
	skeleton.add_child(attachment)
	attachment.bone_name = "Head"
	attachment.add_child(hair)
	head_rest = skeleton.get_bone_global_rest(skeleton.find_bone("Head"))
	hair.transform = head_rest.affine_inverse()
	for node in meshes(hair):
		var material: StandardMaterial3D = node.get_active_material(0).duplicate()
		material.albedo_color = Color(Life.state.avatar.hair)
		material.albedo_texture = null
		node.material_override = material
	shoes()

func shoes() -> void:
	for side in [-1, 1]:
		var socket := BoneAttachment3D.new()
		skeleton.add_child(socket)
		socket.bone_name = "foot_l" if side == 1 else "foot_r"
		var rest := skeleton.get_bone_global_rest(skeleton.find_bone(socket.bone_name))
		var shoe := Node3D.new()
		socket.add_child(shoe)
		shoe.transform = rest.affine_inverse()
		var mat := StandardMaterial3D.new()
		mat.albedo_color = Color("e0ddcf")
		mat.roughness = .94
		var upper := MeshInstance3D.new()
		var sphere := SphereMesh.new()
		sphere.radius = .5
		sphere.height = 1
		upper.mesh = sphere
		upper.scale = Vector3(.155, .115, .31)
		upper.position = Vector3(side * .10, .065, .08)
		upper.material_override = mat
		shoe.add_child(upper)
		var sole := MeshInstance3D.new()
		var box := BoxMesh.new()
		box.size = Vector3(.155, .024, .28)
		sole.mesh = box
		sole.position = Vector3(side * .10, .022, .08)
		sole.material_override = mat
		shoe.add_child(sole)

func clothes() -> ShaderMaterial:
	var material := ShaderMaterial.new()
	material.shader = load("res://shaders/clothing.gdshader")
	material.set_shader_parameter("skin_colour", Color(Life.state.avatar.skin))
	material.set_shader_parameter("shirt_colour", Color(Life.state.avatar.outfit) if female else Color("728b7a"))
	material.set_shader_parameter("trouser_colour", Color("c9c7b6") if female else Color("556573"))
	material.set_shader_parameter("body_normal", load("res://assets/characters/T_Superhero_%s_Normal.png" % ("Female" if female else "Male")))
	return material

static func build_library() -> void:
	library = AnimationLibrary.new()
	var source: Node = load("res://assets/characters/animations.glb").instantiate()
	var animation_player: AnimationPlayer = find_type(source, "AnimationPlayer") as AnimationPlayer
	for name in ["Idle", "Walk", "Jog_Fwd", "Sprint", "Interact", "PickUp_Table", "Sitting_Enter", "Sitting_Exit", "Sitting_Idle", "Idle_Talking", "Sitting_Talking", "Fixing_Kneeling", "Crouch_Idle", "Crouch_Fwd", "Jump", "Jump_Start", "Jump_Land", "Push", "Dance"]:
		var clip: Animation = animation_player.get_animation(name).duplicate(true)
		for track in clip.get_track_count():
			var path: NodePath = clip.track_get_path(track)
			clip.track_set_path(track, NodePath(":" + path.get_concatenated_subnames()))
		clip.loop_mode = Animation.LOOP_LINEAR if name in ["Idle", "Walk", "Jog_Fwd", "Sprint", "Sitting_Idle", "Idle_Talking", "Sitting_Talking", "Fixing_Kneeling", "Crouch_Idle", "Crouch_Fwd"] else Animation.LOOP_NONE
		library.add_animation(name, clip)
	source.free()

func animate_state(speed: float, activity := "", crouched := false) -> void:
	var belly := clampf(float(Life.week() - 7) / 32, 0, 1) * .15 if female and not Life.state.pregnancy.born else 0.0
	if attire:
		attire.set_shader_parameter("bump", belly)
	for cloth in garments:
		cloth.set_shader_parameter("bump", belly)
	if gesture_remaining > 0 and speed < .1:
		return
	var name := "Idle"
	if activity in ["rest", "feed", "skin", "lullaby", "soothe", "scan", "birth"]:
		name = "Sitting_Idle"
	elif activity in ["talk", "help", "call", "appointment"]:
		name = "Idle_Talking"
	elif activity in ["clean", "tidy", "laundry", "plant", "assemble"]:
		name = "Fixing_Kneeling"
	elif activity in ["cook", "diaper", "pack", "sterilise"]:
		name = "Interact"
	elif crouched:
		name = "Crouch_Fwd" if speed > .1 else "Crouch_Idle"
	elif speed > 2.7:
		name = "Jog_Fwd"
	elif speed > .12:
		name = "Walk"
	if playing != name:
		playing = name
		animator.play(name, .20)
	animator.speed_scale = clampf(speed / 1.55, .65, 1.4) if name == "Walk" else 1.0
	if baby:
		baby.visible = Life.state.pregnancy.born and activity in ["feed", "skin", "lullaby", "soothe", "read"]

func gesture(name: String) -> void:
	if animator and library.has_animation(name):
		playing = name
		animator.play(name, .12)
		gesture_remaining = minf(1.5, library.get_animation(name).length)

func _process(delta: float) -> void:
	gesture_remaining = maxf(0.0, gesture_remaining - delta)
	head_time += delta
	if pose_socket and not Life.state.settings.reducedMotion:
		pose_socket.rotation.z = sin(head_time * 1.35) * .015
	if carrying_child and skeleton:
		for bone in ["upperarm_l", "upperarm_r"]:
			var index := skeleton.find_bone(bone)
			var rest := skeleton.get_bone_rest(index).basis.get_rotation_quaternion()
			skeleton.set_bone_pose_rotation(index, rest * Quaternion(Vector3.FORWARD, -.38 if bone.ends_with("_l") else .38) * Quaternion(Vector3.RIGHT, -.37))
		for bone in ["lowerarm_l", "lowerarm_r"]:
			var index := skeleton.find_bone(bone)
			var rest := skeleton.get_bone_rest(index).basis.get_rotation_quaternion()
			skeleton.set_bone_pose_rotation(index, rest * Quaternion(Vector3.RIGHT, -1.23))

static func find_type(node: Node, type: String) -> Node:
	if node.is_class(type):
		return node
	for child in node.get_children():
		var found := find_type(child, type)
		if found:
			return found
	return null

static func meshes(node: Node) -> Array[MeshInstance3D]:
	var result: Array[MeshInstance3D] = []
	if node is MeshInstance3D:
		result.append(node)
	for child in node.get_children():
		result.append_array(meshes(child))
	return result
