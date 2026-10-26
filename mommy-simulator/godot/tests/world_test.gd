extends Node

var scene: Node3D
var checks := 0
var failures: Array[String] = []
var on_device := OS.has_feature("ios") or OS.has_feature("android")
var output_directory := ""
var started_at := 0

func check(condition: bool, title: String) -> void:
	checks += 1
	if not condition:
		failures.append(title)
		push_error("FAILED: " + title)
	else:
		print("PASS: " + title)

func fresh() -> void:
	Life.state = Life.definitions.defaultState.duplicate(true)
	Life.dispatch({"type": "START", "chapter": 0}, false)
	Life.state.settings.speed = 1
	scene.player.paused = true

func finish(id: String, quality := 100.0) -> void:
	Life.dispatch({"type": "BEGIN", "id": id, "quality": quality}, false)
	for i in 10:
		Life.dispatch({"type": "TICK", "dt": 1}, false)

func solve_stage() -> void:
	var direct: DirectTasks = scene.sequence.direct
	if not direct.required:
		return
	await get_tree().physics_frame
	if direct.gesture == "cut":
		var center: Vector2 = direct.task_camera.unproject_position(direct.center)
		for i in direct.total:
			direct.swipe(center - Vector2(45, 0), center)
	else:
		for key in direct.items.keys():
			var record: Dictionary = direct.items[key]
			if record.valid:
				var screen: Vector2 = direct.task_camera.unproject_position(record.node.global_position)
				if direct.gesture == "wipe":
					direct.swipe(screen - Vector2(20, 0), screen)
				else:
					direct.tap_at(screen)
	check(direct.complete, "3D pointer interaction solves " + scene.sequence.id + " stage " + str(scene.sequence.stage))

func run(world: Node3D) -> void:
	scene = world
	output_directory = "user://engine-acceptance" if on_device else "res://../artifacts"
	DirAccess.make_dir_recursive_absolute(output_directory)
	started_at = Time.get_ticks_msec()
	write_checkpoint("started")
	Life.persist = false
	Life.paused = true
	scene.hud.close_panel()
	scene.hud.process_mode = Node.PROCESS_MODE_DISABLED
	fresh()
	Life.paused = true
	check(Life.valid_state(Life.state), "native initial save validates")
	check(Life.definitions.chapters.size() == 14 and Life.catalogue.recipes.size() > 200, "same story and public catalogue loaded")
	check(not Life.dispatch({"type": "BIRTH_COMPLETE", "quality": 100}, false), "premature birth rejected")
	check(not Life.dispatch({"type": "SHOP", "basket": {"milk": 1}}, false), "checkout away from market rejected")
	var money: int = Life.state.household.cash
	Life.dispatch({"type": "TRAVEL", "location": "market"}, false)
	check(Life.dispatch({"type": "SHOP", "basket": {"vegetables": 2, "milk": 1, "bread": 1}}, false), "real CHF checkout accepted")
	check(int(Life.state.household.cash) == money - 1670 and int(Life.state.household.groceries.vegetables) == 5, "checkout changes exact centimes and supplies")
	Life.dispatch({"type": "TRAVEL", "location": "home"}, false)
	finish("cook")
	check(int(Life.state.household.meals) == 1 and int(Life.state.household.groceries.vegetables) == 4, "cooking consumes pantry")
	Life.state.household.laundry = {"dirty": 3, "clean": 0, "folded": 0}
	finish("laundry")
	check(Life.state.household.laundry == {"dirty": 0, "clean": 0, "folded": 3}, "partial laundry load conserved")
	check(not Life.dispatch({"type": "BEGIN", "id": "laundry"}, false), "empty laundry blocked")
	Life.state.household.laundry = {"dirty": 3, "clean": 0, "folded": 0}
	scene.active_object = scene.builder.objects.laundry
	scene.sequence.start("laundry")
	check(scene.sequence.working and scene.player.paused, "laundry runs as an in-world 3D sequence")
	check(scene.sequence.button.disabled, "laundry requires garment interaction before advancing")
	check(not scene.sequence.direct.select("cloth-1"), "wrong laundry colour does not sort a garment")
	for step_index in 5:
		if scene.sequence.stage == 2:
			await get_tree().create_timer(3.7).timeout
		await solve_stage()
		scene.sequence.advance()
	for i in 6:
		Life.dispatch({"type": "TICK", "dt": 1}, false)
	check(Life.state.household.laundry == {"dirty": 0, "clean": 0, "folded": 3}, "3D laundry sequence changes the actual save")
	write_checkpoint("laundry")
	scene.active_object = scene.builder.objects.counter
	scene.sequence.start("cook")
	check(scene.sequence.button.disabled, "cooking requires real 3D ingredients")
	await solve_stage()
	scene.sequence.advance()
	await solve_stage()
	scene.sequence.advance()
	scene.sequence.heat_slider.value = 90
	await get_tree().create_timer(.5).timeout
	check(scene.sequence.progress.value < 1 and scene.sequence.button.disabled, "in-world cooking requires controlled stove heat")
	scene.sequence.heat_slider.value = 52
	await get_tree().create_timer(5.5).timeout
	check(not scene.sequence.button.disabled, "balanced stove heat cooks the 3D meal")
	scene.sequence.advance()
	await solve_stage()
	scene.sequence.advance()
	for i in 9:
		Life.dispatch({"type": "TICK", "dt": 1}, false)
	check(int(Life.state.household.meals) == 2, "in-world meal consumes real pantry and finishes")
	write_checkpoint("cooking")
	var before_cancel: Dictionary = Life.state.household.duplicate(true)
	scene.sequence.start("clean")
	check(scene.sequence.button.disabled, "cleaning requires surface wiping")
	await solve_stage()
	scene.sequence.cancel()
	check(Life.state.household == before_cancel, "cancelled cleaning preserves household state")
	check(scene.player.camera.current and not scene.hud.task_locked, "cancel restores player camera and controls")
	check(scene.builder.static_batches > 0, "static environment is batched for mobile rendering")
	check(scene.player.actor.garments.size() == 2 and scene.partner.garments.size() == 2, "mother and partner have separately skinned clothing geometry")
	var original: Dictionary = Life.state.duplicate(true)
	var corrupt: Dictionary = Life.state.duplicate(true)
	corrupt.household.cash = -1
	check(not Life.load_game(corrupt) and Life.state == original, "corrupt save rejected atomically")
	check(not Life.dispatch({"type": "SETTINGS", "settings": {"speed": 99}}, false) and Life.state == original, "invalid settings preserve the current save")
	for patch in [{"time": -1}, {"settings": {"speed": 50}}, {"pregnancy": {"born": false}}, {"missions": {"completed": ["unknown"], "quality": {}, "rewards": []}}]:
		var bad: Dictionary = original.duplicate(true)
		bad.merge(patch, true)
		check(not Life.load_game(bad), "malformed native save field rejected")
	fresh()
	for chapter_index in 14:
		for step in Life.definitions.chapters[chapter_index].mission.steps:
			if step.has("travelTo"):
				Life.dispatch({"type": "TRAVEL", "location": step.travelTo}, false)
			elif step.action == "birth":
				for stage in range(1, 5):
					Life.dispatch({"type": "BIRTH_STAGE", "stage": stage}, false)
				Life.dispatch({"type": "BIRTH_COMPLETE", "quality": 85}, false)
			else:
				if step.action == "birthplan":
					Life.dispatch({"type": "BIRTH_PLAN", "plan": "vaginal"}, false)
				if not Life.supplies(step.action) and step.action == "cook":
					Life.dispatch({"type": "TRAVEL", "location": "market"}, false)
					Life.dispatch({"type": "SHOP", "basket": {"vegetables": 3, "milk": 3, "bread": 3}}, false)
					Life.dispatch({"type": "TRAVEL", "location": "home"}, false)
				finish(step.action, 80 if step.get("interactive", false) else 0)
			check(step.id in Life.state.missions.completed, "native story step " + step.id)
		check(Life.valid_state(Life.state), "save validates after chapter %d" % chapter_index)
		Life.dispatch({"type": "CLAIM_MISSION"}, false)
		if chapter_index < 13:
			Life.dispatch({"type": "ADVANCE_CHAPTER"}, false)
	fresh()
	scene.player.paused = false
	Life.paused = true
	await get_tree().physics_frame
	var player: WorldPlayer = scene.player
	player.position = Vector3(-3.0, .12, 4.90)
	player.yaw = 0
	player.set_camera()
	player.move_input = Vector2(0, -1)
	var before := player.position
	for i in 45:
		await get_tree().physics_frame
	player.move_input = Vector2.ZERO
	check(player.position.distance_to(before) > .7, "continuous player movement")
	check(player.is_on_floor(), "player rests on collision floor")
	player.position = Vector3(.08, .12, -1.45)
	player.move_input = Vector2(0, -1)
	for i in 150:
		await get_tree().physics_frame
	player.move_input = Vector2.ZERO
	check(player.position.z > -2.05, "closed bathroom door blocks the character")
	var door: WorldInteractable = scene.builder.objects.bathroom
	check(door.toggle_door(player), "door interaction opens the hinge")
	await get_tree().create_timer(.50).timeout
	player.move_input = Vector2(0, -1)
	for i in 105:
		await get_tree().physics_frame
	player.move_input = Vector2.ZERO
	check(player.position.z < -2.62, "open door can be walked through")
	player.position = Vector3(.08, .10, -2.95)
	player.velocity = Vector3.ZERO
	player.yaw = PI * .5
	player.set_camera()
	for i in 3:
		await get_tree().physics_frame
	check(player.camera_distance < 1.1, "camera collision prevents wall clipping")
	player.position = Vector3(0, .12, 3)
	player.toggle_crouch()
	check(is_equal_approx((player.capsule.shape as CapsuleShape3D).height, 1.15), "crouch changes collision height")
	player.toggle_crouch()
	player.jump_requested = true
	await get_tree().physics_frame
	check(player.velocity.y > 0, "jump has physical vertical velocity")
	var toy: WorldInteractable = scene.builder.objects["toy-0"]
	scene.pick_up(toy)
	check(toy.held and toy.get_parent() == player.actor.hand_socket, "pickup attaches object to rigged hand")
	scene.put_down()
	check(not toy.held and Life.world.props.has("toy-0"), "put down persists object position")
	var destination: WorldInteractable = scene.builder.objects.books
	var points: Array[Vector3] = scene.navigator.route(Vector3(-3.0, .12, 4.9), destination)
	check(not points.is_empty(), "object navigation finds a collision-aware route")
	check(player.actor.skeleton.get_bone_count() >= 60 and player.actor.library.has_animation("Walk"), "rigged humanoid and motion-captured walk loaded")
	check(player.actor.body.mesh.surface_get_arrays(0)[Mesh.ARRAY_COLOR].size() > 0 and scene.partner.body.mesh.surface_get_arrays(0)[Mesh.ARRAY_COLOR].size() > 0, "mother and partner carry their clothing masks")
	scene.travel("market")
	check(player.position.distance_to(Vector3(17, .11, .5)) < .01 and Life.state.location == "market", "market map route and physical world agree")
	scene.travel("home")
	scene.sequence.cancel() if scene.sequence.working else null
	player.position = Vector3(-3.3, .12, 4.7)
	player.actor.rotation.y = 0
	player.yaw = .55
	player.pitch = -.18
	player.set_camera()
	player.move_input = Vector2.ZERO
	player.paused = true
	Life.paused = true
	if DisplayServer.get_name() != "headless":
		await get_tree().create_timer(1.2).timeout
		await RenderingServer.frame_post_draw
		get_viewport().get_texture().get_image().save_png(output_directory + "/native-world-tested.png")
	write_checkpoint("world-complete")
	var fps: Dictionary = {}
	if on_device:
		fps = await measure_device()
	var output := {"at": Time.get_datetime_string_from_system(true), "version": ProjectSettings.get_setting("application/config/version"), "checks": checks, "failures": failures, "renderer": RenderingServer.get_current_rendering_method(), "physicalDevice": on_device, "performance": fps, "durationMS": Time.get_ticks_msec() - started_at, "staticBatches": scene.builder.static_batches}
	var file := FileAccess.open(output_directory + "/native-world-acceptance.json", FileAccess.WRITE)
	file.store_string(JSON.stringify(output, "  "))
	file.close()
	print("NATIVE WORLD: %d checks / %d failures" % [checks, failures.size()])
	get_tree().quit(0 if failures.is_empty() else 1)

func measure_device() -> Dictionary:
	var results := {}
	for location in ["home", "market", "lakeside"]:
		scene.travel(location)
		scene.player.paused = true
		await get_tree().create_timer(1).timeout
		var samples: Array[float] = []
		var started := Time.get_ticks_msec()
		while Time.get_ticks_msec() - started < 3000:
			var before := Time.get_ticks_usec()
			await get_tree().process_frame
			samples.append(float(Time.get_ticks_usec() - before) / 1000.0)
		samples.sort()
		var sum := 0.0
		for sample in samples:
			sum += sample
		results[location] = {"frames": samples.size(), "averageFPS": 1000.0 / (sum / samples.size()), "engineFPS": Engine.get_frames_per_second(), "sampling": "process frame interval / 3-second stationary view", "p95FrameMS": samples[floori(samples.size() * .95)], "position": [scene.player.position.x, scene.player.position.y, scene.player.position.z], "drawCalls": Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME), "renderedObjects": Performance.get_monitor(Performance.RENDER_TOTAL_OBJECTS_IN_FRAME)}
		await get_tree().process_frame
		get_viewport().get_texture().get_image().save_png(output_directory + "/native-world-%s.png" % location)
		write_checkpoint("measured-" + location)
	return results

func write_checkpoint(stage: String) -> void:
	var file := FileAccess.open(output_directory + "/test-progress.json", FileAccess.WRITE)
	if file:
		file.store_string(JSON.stringify({"at": Time.get_datetime_string_from_system(true), "stage": stage, "checks": checks, "failures": failures, "durationMS": Time.get_ticks_msec() - started_at}))
		file.close()
