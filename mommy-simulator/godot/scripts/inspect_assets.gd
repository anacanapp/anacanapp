extends SceneTree

func _initialize() -> void:
	for path in ["res://assets/characters/mother.gltf", "res://assets/characters/partner.gltf", "res://assets/characters/animations.glb", "res://assets/characters/Hair_Buns.gltf"]:
		var scene: PackedScene = load(path)
		if scene == null:
			push_error("Missing model: " + path)
			continue
		var node: Node = scene.instantiate()
		print(path)
		inspect(node)
		node.free()
	quit()

func inspect(node: Node) -> void:
	if node is Skeleton3D:
		var names: Array[String] = []
		for index in node.get_bone_count():
			names.append(node.get_bone_name(index))
		print("BONES ", names)
	if node is MeshInstance3D:
		print("MESH ", node.name, " ", node.get_aabb(), " transform ", node.transform)
	if node is AnimationPlayer:
		print("ANIMATIONS ", node.get_animation_list())
		if node.get_animation_list().size() > 0:
			var animation: Animation = node.get_animation(node.get_animation_list()[0])
			for track in mini(4, animation.get_track_count()):
				print("TRACK ", animation.track_get_path(track))
	for child in node.get_children():
		inspect(child)
