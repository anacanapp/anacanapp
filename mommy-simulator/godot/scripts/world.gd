extends Node3D

var builder: WorldBuilder
var player: WorldPlayer
var hud: WorldHUD
var partner: FamilyActor
var doctor: FamilyActor
var target: WorldInteractable
var held: WorldInteractable
var active_object: WorldInteractable
var games: Node
var last_zone := ""
var last_location := ""
var tick := 0.0
var fps_values: Array[float] = []
var frames := 0
var actor_identity := ""
var activity_id := ""
var last_activity_object: WorldInteractable
var sequence: WorldSequence
var navigator: WorldNavigator
var graphics_quality := ""
var state_dirty := false
var companion: FamilyCompanion
var object_sound: AudioStreamPlayer
var inspect_web := false
var inspect_clock := 0.0

func _ready() -> void:
	builder = WorldBuilder.new()
	builder.build(self)
	player = WorldPlayer.new()
	player.name = "Mother"
	add_child(player)
	var saved: Array = Life.world.position
	player.position = Vector3(float(saved[0]), float(saved[1]) + .02, float(saved[2]))
	player.yaw = float(Life.world.get("yaw", 0))
	player.actor.rotation.y = player.yaw + PI
	player.set_camera()
	navigator = WorldNavigator.new(get_world_3d())
	partner = FamilyActor.new()
	partner.position = Vector3(-2.60, .08, 3.67)
	partner.rotation.y = -.70
	add_child(partner)
	partner.setup(false)
	companion = FamilyCompanion.new()
	add_child(companion)
	companion.setup(self, partner)
	var partner_object := WorldInteractable.new()
	partner_object.position = partner.position
	add_child(partner_object)
	partner_object.setup("partner", "Həyat yoldaşım", "talk")
	builder.objects.partner = partner_object
	doctor = FamilyActor.new()
	doctor.position = Vector3(16.0, .08, 12.30)
	doctor.rotation.y = .56
	add_child(doctor)
	doctor.setup(false)
	hud = WorldHUD.new()
	add_child(hud)
	hud.move_changed.connect(func(value: Vector2) -> void: player.move_input = value)
	hud.look_changed.connect(player.look)
	hud.jump.connect(func() -> void: player.jump_requested = true)
	hud.crouch.connect(player.toggle_crouch)
	hud.camera_changed.connect(player.toggle_view)
	hud.sprint.connect(func(value: bool) -> void: player.running = value)
	hud.interact.connect(interact)
	player.interaction_requested.connect(interact)
	hud.mission_requested.connect(mission)
	hud.action_play.connect(open_action)
	hud.destination_requested.connect(travel)
	hud.capture_requested.connect(capture)
	hud.panel_changed.connect(func(open: bool) -> void: player.paused = open; Life.paused = open)
	Life.changed.connect(func() -> void: state_dirty = true)
	Life.completed.connect(func(_id: String) -> void:
		if last_activity_object and last_activity_object.kind == "chair":
			player.stand()
		active_object = null
		last_activity_object = null
	)
	games = load("res://scripts/world_games.gd").new()
	add_child(games)
	games.setup(self, hud)
	sequence = WorldSequence.new()
	add_child(sequence)
	sequence.setup(self, hud)
	object_sound = AudioStreamPlayer.new()
	object_sound.stream = load("res://assets/details/object-tap.wav")
	object_sound.volume_db = -13
	add_child(object_sound)
	update_state()
	if OS.is_debug_build() and OS.has_feature("web"):
		inspect_web = bool(JavaScriptBridge.eval("window.MOMMY_TEST_INSPECT === true"))
	for object_id in Life.world.props:
		if builder.objects.has(object_id) and Life.world.props[object_id] is Array:
			var p: Array = Life.world.props[object_id]
			if p.size() == 3:
				builder.objects[object_id].position = Vector3(float(p[0]), float(p[1]), float(p[2]))
	if OS.is_debug_build() and ("--self-test" in OS.get_cmdline_user_args() or OS.get_environment("MOMMY_ENGINE_ACCEPTANCE") == "1"):
		var testing: Node = load("res://tests/world_test.gd").new()
		add_child(testing)
		testing.run(self)
	elif "--capture" in OS.get_cmdline_user_args():
		capture_preview()

func _physics_process(delta: float) -> void:
	tick += delta
	frames += 1
	if tick > .12:
		tick = 0
		if state_dirty:
			state_dirty = false
			update_state()
		update_target()
		var zone := builder.zone(player.global_position)
		hud.set_room(zone)
		if zone != last_zone:
			last_zone = zone
			var location: String = zone if zone in ["market", "clinic", "cafe", "lakeside"] else "home" if zone in ["living", "kitchen", "nursery", "bedroom", "bathroom", "garden"] else str(Life.state.location)
			if location != Life.state.location and Life.state.activity == null:
				Life.dispatch({"type": "TRAVEL", "location": location})
		builder.update_light()
		doctor.animate_state(0, "talk" if Life.state.location == "clinic" else "")
		builder.details.tick(delta * 8)
	if not player.paused and frames % 60 == 0:
		fps_values.append(float(Engine.get_frames_per_second()))
		if fps_values.size() > 120:
			fps_values.pop_front()
	if inspect_web:
		inspect_clock += delta
		if inspect_clock > .15:
			inspect_clock = 0
			web_telemetry()

func web_telemetry() -> void:
	var controls := {}
	for name in ["Top", "Actions", "Mission"]:
		var root: Control = hud.root.get_node(name)
		for button in root.find_children("*", "Button", true, false):
			if button.is_visible_in_tree():
				var center: Vector2 = button.get_global_rect().get_center()
				controls[button.text] = [center.x, center.y]
	if hud.panel:
		for button in hud.panel.find_children("*", "Button", true, false):
			if button.is_visible_in_tree():
				var center: Vector2 = button.get_global_rect().get_center()
				controls[button.text] = [center.x, center.y]
	if sequence.working:
		var center: Vector2 = sequence.button.get_global_rect().get_center()
		controls["task-next"] = [center.x, center.y]
		var cancel: Button = sequence.button.get_parent().get_child(1)
		center = cancel.get_global_rect().get_center()
		controls["task-cancel"] = [center.x, center.y]
	var items := {}
	if sequence.working and sequence.direct.required:
		for key in sequence.direct.items:
			var record: Dictionary = sequence.direct.items[key]
			var at: Vector2 = sequence.direct.task_camera.unproject_position(record.node.global_position)
			items[key] = {"screen": [at.x, at.y], "done": record.done, "valid": record.valid}
	var payload := {"ready": true, "started": Life.state.started, "location": Life.state.location, "room": last_zone,
		"player": [player.position.x, player.position.y, player.position.z], "camera": [player.yaw, player.pitch, player.camera_distance],
		"controls": controls, "taskItems": items, "task": sequence.id if sequence.working else "", "stage": sequence.stage,
		"actions": int(Life.state.totalActions), "taskLocked": hud.task_locked, "viewport": [hud.root.size.x, hud.root.size.y]}
	JavaScriptBridge.eval("window.MOMMY_WORLD_INSPECT = " + JSON.stringify(payload) + ";", true)

func update_state() -> void:
	builder.update_household()
	var identity := JSON.stringify(Life.state.avatar)
	if identity != actor_identity and not actor_identity.is_empty():
		if held:
			put_down()
		if builder.baby.get_parent() == player.actor.pose_socket:
			builder.baby.reparent(self, true)
		for node in [player.actor, partner]:
			if is_instance_valid(node):
				for child in node.get_children():
					node.remove_child(child)
					child.queue_free()
				node.setup(node == player.actor)
	actor_identity = identity
	var active: String = str(Life.state.activity.id) if Life.state.activity != null else ""
	if active != activity_id:
		if active.is_empty() and active_object and active_object.kind == "chair":
			player.stand()
		activity_id = active
	var holding: bool = Life.state.pregnancy.born and (active in ["feed", "skin", "lullaby", "soothe", "read"] or int(Life.state.chapter) < 12 and Life.state.location in ["market", "cafe", "lakeside"])
	player.actor.carrying_child = holding
	if holding:
		if builder.baby.get_parent() != player.actor.pose_socket:
			builder.baby.reparent(player.actor.pose_socket, false)
		builder.baby.position = Vector3.ZERO
		builder.baby.rotation = Vector3(.2, 0, -1.10)
		builder.baby.visible = true
	elif builder.baby.get_parent() != self:
		builder.baby.reparent(self, false)
		builder.baby.position = Vector3(19, .93, 15.5) if Life.state.location == "clinic" else Vector3(5.70, .73, -3.90)
		builder.baby.rotation = Vector3(PI * .5, 0, 0)
	if str(Life.state.location) != last_location:
		last_location = str(Life.state.location)
	if str(Life.world.quality) != graphics_quality:
		graphics_quality = str(Life.world.quality)
		var high: bool = graphics_quality == "high"
		get_viewport().msaa_3d = Viewport.MSAA_4X if high else Viewport.MSAA_2X
		get_viewport().scaling_3d_scale = 1.0 if high else .85

func update_target() -> void:
	if player.paused or Life.state.activity != null:
		return
	var best: WorldInteractable
	var distance := 5.0
	for object: WorldInteractable in get_tree().get_nodes_in_group("interactables"):
		if object.held:
			continue
		var difference := object.global_position - player.global_position
		difference.y = 0
		var length := difference.length()
		if length > object.radius or length >= distance:
			continue
		var camera_direction := -player.camera.global_basis.z
		camera_direction.y = 0
		if length > .6 and camera_direction.normalized().dot(difference.normalized()) < -.25:
			continue
		var origin := player.global_position + Vector3(0, 1.22, 0)
		var destination := object.global_position + Vector3(0, .75, 0)
		var ray := PhysicsRayQueryParameters3D.create(origin, destination, 1, [player.get_rid()])
		if object.body:
			ray.exclude.append(object.body.get_rid())
		var hit := get_world_3d().direct_space_state.intersect_ray(ray)
		if not hit.is_empty() and hit.collider is StaticBody3D and (not hit.collider.has_meta("interactable") or hit.collider.get_meta("interactable") != object) and float(hit.position.distance_to(destination)) > .35:
			continue
		best = object
		distance = length
	if target != best:
		if target:
			target.highlight(false)
		target = best
		if target:
			target.highlight(true)
	hud.set_target(target, player.seated, held != null)

func interact() -> void:
	if player.paused or Life.state.activity != null:
		return
	if player.seated:
		player.stand()
		return
	if held:
		put_down()
		return
	if not target:
		return
	match target.kind:
		"door":
			if not target.toggle_door(player):
				hud.toast("Qapını bağlamaq üçün bir addım geri çəkil.")
		"prop":
			if target.action == "test" and int(Life.state.chapter) == 0:
				open_action("test")
			elif target.action == "journal":
				open_action("journal")
			else:
				pick_up(target)
		"pantry":
			hud.show_panel("day")
		"family":
			hud.show_panel("family")
		_:
			open_action(target.action, target)

func pick_up(object: WorldInteractable) -> void:
	held = object
	object.held = true
	object.marker.visible = false
	object.reparent(player.actor.hand_socket, true)
	object.position = Vector3(0, -.04, .06)
	object.rotation = Vector3(0, 0, PI * .5)
	player.actor.gesture("PickUp_Table")
	if Life.state.settings.sound:
		object_sound.play()
	hud.toast("Əşya qucağındadır. İstədiyin yerə apar və yenidən toxunaraq qoy.")

func put_down() -> void:
	var object := held
	held = null
	object.held = false
	object.reparent(self, true)
	var direction := -player.camera.global_basis.z
	direction.y = 0
	var aim := player.global_position + direction.normalized() * .64
	var ray := PhysicsRayQueryParameters3D.create(aim + Vector3(0, 1.8, 0), aim - Vector3(0, 1.0, 0), 1, [player.get_rid()])
	var hit := get_world_3d().direct_space_state.intersect_ray(ray)
	object.global_position = hit.position + Vector3(0, .055, 0) if not hit.is_empty() else aim + Vector3(0, .10, 0)
	object.rotation = Vector3.ZERO
	Life.world.props[object.object_id] = [object.position.x, object.position.y, object.position.z]
	Life.save_game()

func open_action(id: String, object: WorldInteractable = null) -> void:
	if sequence.working or Life.state.activity != null:
		return
	if id.is_empty():
		return
	if id == "birth":
		if Life.birth_ready():
			games.birth()
		else:
			hud.toast("Əvvəl doğuş planı və hekayə addımlarını tamamla.")
		return
	if not Life.available(id):
		if Life.activities.has(id) and Life.activity_location(id) != Life.state.location:
			hud.show_panel("map")
		else:
			hud.toast("Bu fəaliyyət hekayənin uyğun mərhələsində açılır.")
		return
	if not Life.supplies(id):
		hud.toast(Life.error)
		hud.show_panel("map" if id == "cook" else "day")
		return
	active_object = object
	if not active_object:
		var nearest := INF
		for candidate: WorldInteractable in get_tree().get_nodes_in_group("interactables"):
			var distance := player.global_position.distance_to(candidate.global_position)
			var location := builder.zone(candidate.global_position)
			var in_location: bool = location == Life.state.location if Life.state.location != "home" else location in ["living", "kitchen", "nursery", "bedroom", "bathroom", "garden"]
			if candidate.action == id and in_location and distance < nearest:
				active_object = candidate
				nearest = distance
	if active_object and player.global_position.distance_to(active_object.global_position) > active_object.radius + .1:
		hud.toast("Əşyaya yaxınlaş. Hərəkət joystick-i ilə gedə bilərsən.")
		var points := navigator.route(player.global_position, active_object)
		if not points.is_empty():
			var destination := active_object
			player.follow_path(points, func() -> void: open_action(id, destination))
		else:
			hud.toast("Qapı bağlıdır. Əvvəl qapını aç, sonra əşyanın yanına get.")
		if not get_tree().get_nodes_in_group("world-waypoint").is_empty():
			for waypoint in get_tree().get_nodes_in_group("world-waypoint"):
				waypoint.queue_free()
		var waypoint := Label3D.new()
		waypoint.text = Life.tr_copy(Life.activities[id].title) + "\n▼"
		waypoint.font_size = 40
		waypoint.pixel_size = .008
		waypoint.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		waypoint.position = active_object.global_position + Vector3(0, 1.9, 0)
		waypoint.modulate = Color("e4ecb9")
		waypoint.add_to_group("world-waypoint")
		add_child(waypoint)
		return
	for waypoint in get_tree().get_nodes_in_group("world-waypoint"):
		waypoint.queue_free()
	if id in ["cook", "laundry", "clean", "tidy", "feed", "diaper", "sterilise", "assemble", "lullaby", "soothe", "breathe", "stretch", "kick", "play", "pack", "carseat", "test"]:
		sequence.start(id)
	else:
		games.open(id)

func begin_activity(id: String, quality := 100.0, source := "") -> void:
	hud.close_panel()
	last_activity_object = active_object
	if active_object and active_object.kind == "chair":
		player.sit(active_object.seat, active_object.seat_yaw)
		player.seated = false
	Life.dispatch({"type": "SETTINGS", "settings": {"speed": 1}})
	var action := {"type": "BEGIN", "id": id, "quality": quality}
	if not source.is_empty():
		action.sourceId = source
	if not Life.dispatch(action):
		hud.toast(Life.error)

func mission() -> void:
	var step := Life.current_step()
	if step.is_empty():
		hud.open_panel(Life.tr_copy(Life.chapter().title))
		hud.paragraph("Fəslin bütün addımları tamamlandı.")
		if Life.chapter().id not in Life.state.missions.rewards:
			hud.button("Missiya mükafatını al", func() -> void: Life.dispatch({"type": "CLAIM_MISSION"}); mission(), hud.panel_content)
		if int(Life.state.chapter) < 13:
			hud.button("Yeni fəsilə keç", func() -> void: Life.dispatch({"type": "ADVANCE_CHAPTER"}); hud.close_panel(); travel(str(Life.state.location)), hud.panel_content)
	elif step.action == "travel" or step.location != Life.state.location:
		hud.show_panel("map")
	else:
		open_action(step.action)

func travel(location: String) -> void:
	if Life.state.activity != null or sequence and sequence.working:
		return
	if held:
		put_down()
	Life.dispatch({"type": "TRAVEL", "location": location})
	var positions := {"home": Vector3(-.15, .11, 3), "market": Vector3(17, .11, .5), "cafe": Vector3(-17.5, .11, .6), "clinic": Vector3(17, .11, 12.7), "lakeside": Vector3(-10, .11, 21)}
	player.global_position = positions.get(location, Vector3.ZERO)
	player.velocity = Vector3.ZERO
	player.move_input = Vector2.ZERO
	player.jump_requested = false
	player.auto_walk = false
	player.path.clear()
	player.arrival = Callable()
	player.seated = false
	player.yaw = 0.0 if location != "lakeside" else PI
	player.actor.rotation.y = player.yaw + PI
	player.set_camera()
	Life.world.position = [player.position.x, player.position.y, player.position.z]
	Life.save_game()
	if companion:
		companion.follow_location(location)

func capture() -> void:
	if not Life.state.started or sequence.working:
		return
	hud.visible = false
	await get_tree().process_frame
	await get_tree().process_frame
	var image := get_viewport().get_texture().get_image()
	hud.visible = true
	var directory := "user://photos"
	DirAccess.make_dir_recursive_absolute(directory)
	var id := "world-photo-%d-%d" % [Time.get_unix_time_from_system(), Time.get_ticks_msec()]
	var path := "%s/%s.jpg" % [directory, id]
	image.resize(mini(image.get_width(), 1200), roundi(float(image.get_height()) * minf(1.0, 1200.0 / image.get_width())))
	if image.save_jpg(path, .82) == OK:
		Life.dispatch({"type": "MEMORY", "memory": {"id": id, "kind": "photo", "chapter": Life.state.chapter, "day": Life.state.day,
			"title": ["Yuvamdan bir an", "A moment from my home", "Yuvamdan bir an"], "description": Life.chapter().subtitle, "icon": "camera", "nativePhoto": path}})
		hud.toast("3D xatirə alboma əlavə olundu.")

func capture_preview() -> void:
	Life.persist = false
	if not Life.state.started:
		Life.dispatch({"type": "START", "chapter": 0}, false)
	hud.close_panel()
	player.position = Vector3(-3.3, .12, 4.7)
	Life.acceptance = true
	player.paused = true
	Life.paused = true
	player.yaw = .55
	player.pitch = -.18
	player.set_camera()
	companion.process_mode = Node.PROCESS_MODE_DISABLED
	await get_tree().create_timer(3).timeout
	var path := "res://../artifacts/native-world-preview.png"
	await get_tree().process_frame
	get_viewport().get_texture().get_image().save_png(path)
	for location in ["kitchen", "lakeside"]:
		if location == "lakeside":
			travel(location)
		else:
			player.position = Vector3(-3.8, .12, -1.0)
			player.yaw = .12
			player.pitch = -.16
			player.set_camera()
		await get_tree().create_timer(.7).timeout
		get_viewport().get_texture().get_image().save_png("res://../artifacts/realism-%s.png" % location)
	travel("home")
	active_object = builder.objects.counter
	sequence.start("cook")
	await get_tree().create_timer(.7).timeout
	get_viewport().get_texture().get_image().save_png("res://../artifacts/realism-direct-cooking.png")
	sequence.cancel()
	get_tree().quit()
