class_name MetroWorld3D
extends Node3D

var camera: Camera3D
var station: MetroStation3D
var train: MetroTrain3D
var player: MetroCommuter3D
var crowd: Array[MetroCommuter3D] = []
var obstacles: Array[Node3D] = []
var world_environment: WorldEnvironment
var mode := "home"
var time := 0.0
var shake := 0.0
var last_route := ""
var last_station := ""
var last_door := -1
var last_equipment := ""
var progress_visual := 0.0
var portrait := false
var world_ready := false
var mesh_count := 0
var live_frame_ms: Array = []
var boot_delay := 0.0
var view_changed := true

func _ready() -> void:
	_environment()
	station = MetroStation3D.new()
	add_child(station)
	station.build()
	train = MetroTrain3D.new()
	add_child(train)
	train.build()
	player = MetroCommuter3D.new()
	player.name = "Player"
	add_child(player)
	player.setup(0, true)
	player.position = Vector3(0, 0.02, 7.7)
	player.rotation.y = PI
	MetroMesh.contact_shadow(player, Vector2(0.95, 0.8))
	_populate()
	camera = Camera3D.new()
	camera.name = "FollowCamera"
	camera.current = true
	camera.fov = 57
	camera.near = 0.08
	camera.far = 75
	add_child(camera)
	camera.position = Vector3(3.9, 2.55, 8.6)
	camera.look_at(Vector3(0, 1.7, 0.45))
	update_station()
	_build_obstacles()
	mesh_count = MetroCommuter3D.meshes(self).size()
	world_ready = true
	print("METRO_WORLD_READY | " + str(mesh_count) + " meshes | " + str(crowd.size()) + " rigged commuters")

func _environment() -> void:
	world_environment = WorldEnvironment.new()
	var environment := Environment.new()
	environment.background_mode = Environment.BG_COLOR
	environment.background_color = Color("1c2e35")
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color("c4d7dc")
	environment.ambient_light_energy = 0.40
	environment.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	environment.tonemap_exposure = 1.12
	environment.glow_enabled = not OS.has_feature("web")
	environment.glow_intensity = 0.27
	environment.glow_bloom = 0.04
	environment.fog_enabled = true
	environment.fog_light_color = Color("42565b")
	environment.fog_density = 0.009
	environment.fog_height = 0
	environment.fog_height_density = 0
	world_environment.environment = environment
	add_child(world_environment)
	var attributes := CameraAttributesPractical.new()
	attributes.dof_blur_far_enabled = false
	attributes.dof_blur_near_enabled = false
	world_environment.camera_attributes = attributes

func _populate() -> void:
	# A moving platform crowd and occupied carriage. Each person uses a real
	# skeleton and distinct clothing, height, skin, hair and idle animation phase.
	var locations := [
		Vector3(-1.75, 0.02, 4.2), Vector3(1.8, 0.02, 4.6), Vector3(-2.9, 0.02, 2.4), Vector3(2.9, 0.02, 2.1),
		Vector3(-4.7, 0.02, 1.1), Vector3(4.6, 0.02, 1.2), Vector3(-3.6, 0.02, 6.6), Vector3(4.6, 0.02, 7.1),
		Vector3(-6.5, 0.02, 6.2), Vector3(6.5, 0.02, 3.4), Vector3(-8.2, 0.02, 1.3), Vector3(8.1, 0.02, 0.95),
		Vector3(-1.0, 0.20, -1.6), Vector3(0.64, 0.20, -1.5), Vector3(-0.38, 0.20, -2.28), Vector3(0.23, 0.20, -0.83),
		Vector3(-4.2, 0.20, -2.0), Vector3(4.2, 0.20, -2.12), Vector3(6.5, 0.20, -1.5), Vector3(-6.7, 0.20, -1.3)
	]
	for index in range(locations.size()):
		var commuter := MetroCommuter3D.new()
		commuter.name = "Commuter%02d" % index
		var parent: Node3D = train if index >= 12 else self
		parent.add_child(commuter)
		commuter.setup(index + 3)
		commuter.position = locations[index]
		commuter.rotation.y = (0.3 if index >= 12 else PI + (index % 5 - 2) * 0.22)
		commuter.set_meta("home", locations[index])
		crowd.append(commuter)
		MetroMesh.contact_shadow(commuter, Vector2(0.8, 0.7))
		if index % 3 == 0: commuter.animate("Idle_Talking", 0.7)
		if index in [4, 10, 18]: _suitcase(commuter, Vector3(0.42, 0, 0.02), index)

func _build_obstacles() -> void:
	for node in obstacles:
		remove_child(node)
		node.queue_free()
	obstacles.clear()
	for index in range(Metro.session.obstacles.size()):
		var obstacle: Dictionary = Metro.session.obstacles[index]
		var group := Node3D.new()
		group.name = "Obstacle%02d" % index
		group.position = Vector3((int(obstacle.lane) - 1) * 0.78, 0.025, 6.4 - index * 0.92)
		group.set_meta("origin", group.position)
		group.set_meta("cleared", false)
		add_child(group)
		obstacles.append(group)
		match obstacle.kind:
			"passenger", "crowd", "phone":
				var actor := MetroCommuter3D.new()
				group.add_child(actor)
				actor.setup(index + 26)
				actor.rotation.y = 0.15 + (index % 3) * 0.22
				MetroMesh.contact_shadow(group, Vector2(0.8, 0.68))
				if obstacle.kind == "phone": actor.animate("Interact", 0.55)
			"suitcase", "clock":
				_suitcase(group, Vector3.ZERO, index)
				if obstacle.kind == "clock":
					var marker := Node3D.new()
					marker.name = "BonusClock"
					marker.position = Vector3(0, 0.97, 0)
					group.add_child(marker)
					var ring_mesh := TorusMesh.new()
					ring_mesh.inner_radius = 0.095
					ring_mesh.outer_radius = 0.125
					var ring := MeshInstance3D.new()
					ring.mesh = ring_mesh
					ring.rotation.x = PI / 2
					ring.material_override = MetroMesh.material(Color("e8bf6b"), 0.27, 0.64, 0.65)
					marker.add_child(ring)
					MetroMesh.rod(marker, Vector3.ZERO, Vector3(0, 0.075, 0), 0.006, ring.material_override)
					MetroMesh.rod(marker, Vector3.ZERO, Vector3(0.047, -0.027, 0), 0.006, ring.material_override)
			"barrier":
				for side in [-1, 1]:
					MetroMesh.cylinder(group, Vector3(side * 0.33, 0.47, 0), 0.03, 0.92, MetroMesh.material(Color("8e9694"), 0.35, 0.70))
					MetroMesh.box(group, Vector3(side * 0.33, 0.04, 0), Vector3(0.26, 0.08, 0.28), MetroMesh.material(Color("28383c"), 0.88), 0.02)
				MetroMesh.box(group, Vector3(0, 0.82, 0), Vector3(0.90, 0.13, 0.08), MetroMesh.material(Color("d6b05f"), 0.6), 0.022)
				for x in [-0.3, -0.1, 0.1, 0.3]:
					var stripe := MetroMesh.box(group, Vector3(x, 0.82, 0.046), Vector3(0.065, 0.13, 0.005), MetroMesh.material(Color("3a4544"), 0.7))
					stripe.rotation.z = -0.35
			"wetfloor":
				var sign := MetroMesh.box(group, Vector3(0, 0.26, 0), Vector3(0.37, 0.53, 0.025), MetroMesh.material(Color("e2bb58"), 0.55), 0.017)
				sign.rotation.x = -0.18
				MetroMesh.text(group, "!\nDİQQƏT", Vector3(0, 0.31, 0.10), 28, Color("3f3d31"), 0.0026)
				var puddle := MetroMesh.box(group, Vector3(0.15, -0.012, -0.17), Vector3(0.65, 0.035, 0.45), MetroMesh.material(Color("839997"), 0.10, 0.48), 0.028)

func _suitcase(parent: Node3D, point: Vector3, index: int) -> Node3D:
	var group := Node3D.new()
	group.position = point
	parent.add_child(group)
	var color: Color = [Color("445a65"), Color("986d4c"), Color("303b48")][posmod(index, 3)]
	var mat := MetroMesh.material(color, 0.64)
	MetroMesh.box(group, Vector3(0, 0.34, 0), Vector3(0.43, 0.59, 0.25), mat, 0.047)
	for xx in [-0.14, -0.07, 0.0, 0.07, 0.14]:
		MetroMesh.box(group, Vector3(xx, 0.34, 0.133), Vector3(0.012, 0.47, 0.013), MetroMesh.material(color.lightened(0.13), 0.49), 0.004)
	var steel := MetroMesh.material(Color("909d9b"), 0.35, 0.8)
	for side in [-1, 1]:
		MetroMesh.rod(group, Vector3(side * 0.09, 0.53, -0.065), Vector3(side * 0.09, 0.91, -0.065), 0.011, steel)
		var wheel := MetroMesh.cylinder(group, Vector3(side * 0.15, 0.045, 0), 0.047, 0.022, MetroMesh.material(Color("19262d"), 0.87))
		wheel.rotation.z = PI / 2
	MetroMesh.box(group, Vector3(0, 0.91, -0.065), Vector3(0.22, 0.04, 0.04), MetroMesh.material(Color("23333d"), 0.89), 0.012)
	MetroMesh.contact_shadow(group, Vector2(0.72, 0.6))
	return group

func set_view(id: String) -> void:
	view_changed = mode != id
	mode = id
	if id == "play":
		player.rotation.y = PI
	else:
		player.rotation.y = 0.08
	update_station()

func update_station() -> void:
	if station == null: return
	var current_station := Metro.current_station()
	station.station(current_station, Metro.current_route())
	if last_station != current_station.id or last_route != Metro.selected_route or last_door != Metro.session.door_index:
		last_station = current_station.id
		last_route = Metro.selected_route
		last_door = Metro.session.door_index
		progress_visual = 0
		if player != null: player.position = Vector3(0, 0.02, 7.3)
		if world_ready: _build_obstacles()

func event(entry: Dictionary) -> void:
	if entry.type == "tap":
		shake = 0.025
		player.animate("Push", 1.4)
	elif entry.type == "clear":
		var index: int = int(entry.index)
		if index < obstacles.size():
			obstacles[index].set_meta("cleared", true)
			for child in obstacles[index].get_children():
				if child is MetroCommuter3D: child.animate("Walk", 0.85)
	elif entry.type == "burst":
		shake = 0.075
		player.animate("Sprint", 1.2)

func _process(delta: float) -> void:
	if not world_ready: return
	time += delta
	boot_delay += delta
	if live_frame_ms.size() < 240 and mode == "play" and boot_delay > 2: live_frame_ms.append(delta * 1000.0)
	var equipment_key := JSON.stringify(Metro.profile.equipped) + str(Metro.profile.upgrades.strength)
	if equipment_key != last_equipment:
		last_equipment = equipment_key
		player.equip(Metro.profile.equipped)
	var session: MetroSession = Metro.session
	portrait = get_viewport().get_visible_rect().size.x < get_viewport().get_visible_rect().size.y
	progress_visual = lerpf(progress_visual, session.progress() if mode == "play" else 0.0, minf(1, delta * 5))
	if mode == "play":
		var target_z := 7.3 - progress_visual * 6.45
		if session.mode == "won": target_z = -0.85
		player.position.z = lerpf(player.position.z, target_z, minf(1, delta * 4))
		player.position.x = lerpf(player.position.x, (session.lane - 1) * 0.74, minf(1, delta * 12))
		player.position.y = lerpf(player.position.y, 0.22 if player.position.z < 0.5 else 0.02, minf(1, delta * 5))
		var walking := absf(player.position.z - target_z) > 0.035
		if player.playing == "Push" and player.animator.is_playing(): pass
		else: player.animate("Jog_Fwd" if session.burst_left > 0 else ("Walk" if walking else "Idle"), 1.0 + (float(Metro.player_stats().speed) - 1) * 0.5)
		var camera_target := Vector3(player.position.x * 0.32 + 0.54, 2.38, player.position.z + (3.9 if portrait else 4.8))
		camera.position = camera.position.lerp(camera_target, minf(1, delta * 3.0))
		camera.look_at(Vector3(player.position.x * 0.25, 1.43, player.position.z - 3.9))
		camera.fov = lerpf(camera.fov, (62.0 if portrait else 57.0) + (3.0 if session.burst_left > 0 else 0.0), minf(1, delta * 2))
	else:
		var wardrobe_mode: bool = mode in ["profile", "shop"]
		var lobby_position := Vector3(0.0, 0.02, 5.2 if wardrobe_mode else 5.75)
		player.position = lobby_position if view_changed else player.position.lerp(lobby_position, minf(1, delta * 4))
		player.animate("Idle")
		var camera_target := Vector3(0.42, 1.73, 9.8) if wardrobe_mode else Vector3(0.90 + sin(time * 0.13) * 0.10, 2.35, 10.6)
		camera.position = camera_target if view_changed else camera.position.lerp(camera_target, minf(1, delta * 3))
		camera.look_at(Vector3(0.0, 0.52 if wardrobe_mode else 1.15, 5.2 if wardrobe_mode else 0.15))
		camera.fov = lerpf(camera.fov, (44.0 if wardrobe_mode else 50.0) if portrait else 53.0, minf(1, delta * 2))
	view_changed = false
	shake = maxf(0, shake - delta * 0.24)
	if shake > 0 and not Metro.profile.settings.reduced_motion:
		camera.position.x += sin(time * 65) * shake
		camera.position.y += cos(time * 48) * shake * 0.5
	train.update_doors(session.mode if mode == "play" else "idle", session.time_left, delta)
	for index in range(obstacles.size()):
		var node := obstacles[index]
		node.visible = mode == "play"
		if node.get_meta("cleared", false):
			var origin: Vector3 = node.get_meta("origin")
			node.position.x = lerpf(node.position.x, origin.x + (1.7 if origin.x >= 0 else -1.7), minf(1, delta * 3.5))
			node.rotation.y = lerp_angle(node.rotation.y, -PI * 0.5 if origin.x >= 0 else PI * 0.5, minf(1, delta * 4))
		var clock := node.get_node_or_null("BonusClock") as Node3D
		if clock != null: clock.rotation.y = sin(time * 1.6) * 0.3
	for index in range(mini(12, crowd.size())):
		var person := crowd[index]
		person.visible = mode == "play" or index in [4, 5, 9, 10, 11]
		var base: Vector3 = person.get_meta("home")
		person.position.x = base.x + sin(time * 0.23 + index) * 0.075
		person.rotation.y = PI + (index % 5 - 2) * 0.22 + sin(time * 0.20 + index) * 0.10

func snapshot() -> Dictionary:
	return {"ready": world_ready, "kind": "native_3d", "meshes": mesh_count, "rigged_commuters": crowd.size(),
		"player": {"x": player.position.x, "y": player.position.y, "z": player.position.z},
		"camera": {"x": camera.position.x, "y": camera.position.y, "z": camera.position.z},
		"doors_open": train.opened, "frame_samples": live_frame_ms.size()}
