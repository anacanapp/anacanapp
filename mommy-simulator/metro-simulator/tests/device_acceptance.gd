extends RefCounted

var checks: Array = []
var failures: Array = []
var directory := "user://metro-acceptance"
var game: Node
var diagnostics := {}

func checkpoint(stage: String, host: Control) -> void:
	var file := FileAccess.open(directory + "/progress.json", FileAccess.WRITE)
	file.store_string(JSON.stringify({"stage": stage, "mode": game.session.mode, "taps": game.session.taps, "time": game.session.time_left, "view": host.view, "checks": checks.size(), "failures": failures}))
	file.close()

func check(condition: bool, name: String) -> void:
	checks.append({"check": name, "passed": condition})
	if not condition: failures.append(name)

func wait_mode(host: Control, desired: String, timeout_ms: int = 5000) -> bool:
	var deadline := Time.get_ticks_msec() + timeout_ms
	while game.session.mode != desired and Time.get_ticks_msec() < deadline:
		await host.get_tree().create_timer(0.05).timeout
	return game.session.mode == desired

func tap_control(host: Control, id: String) -> bool:
	await host.get_tree().process_frame
	if not host.controls.has(id): return false
	var button: Button = host.controls[id]
	if button.disabled or not button.is_visible_in_tree(): return false
	var ancestor: Node = button.get_parent()
	while ancestor != null:
		if ancestor is ScrollContainer:
			ancestor.ensure_control_visible(button)
			await host.get_tree().process_frame
			await host.get_tree().process_frame
			break
		ancestor = ancestor.get_parent()
	# Touch positions use physical viewport pixels, exactly like the native input.
	var point := button.get_global_rect().get_center()
	if id == "pause": diagnostics.pause_point = str(point)
	var press := InputEventScreenTouch.new()
	press.index = 0
	press.position = point
	press.pressed = true
	Input.parse_input_event(press)
	await host.get_tree().create_timer(0.035).timeout
	if id == "pause":
		diagnostics.pause_after_press = game.session.mode
		var hovered := host.get_viewport().gui_get_hovered_control()
		diagnostics.pause_hover = hovered.name if hovered != null else "none"
	var release := InputEventScreenTouch.new()
	release.index = 0
	release.position = point
	release.pressed = false
	Input.parse_input_event(release)
	await host.get_tree().create_timer(0.095).timeout
	return true

func screenshot(host: Control, name: String) -> void:
	await host.get_tree().create_timer(0.55).timeout
	await RenderingServer.frame_post_draw
	var image := host.get_viewport().get_texture().get_image()
	if image.get_width() > 1284:
		image.resize(1284, int(image.get_height() * 1284.0 / image.get_width()), Image.INTERPOLATE_LANCZOS)
	image.save_png(directory + "/" + name + ".png")

func run(host: Control) -> Dictionary:
	game = host.get_tree().root.get_node("Metro")
	var started := Time.get_ticks_msec()
	DirAccess.make_dir_recursive_absolute(directory)
	await host.get_tree().create_timer(0.4).timeout
	checkpoint("start", host)
	game.set_block_signals(true)
	var simulated: Dictionary = load("res://tests/acceptance.gd").new().run(game)
	game.set_block_signals(false)
	checks = simulated.checks
	failures = simulated.failures
	game.profile = MetroRules.fresh_profile(game.routes)
	game.profile.settings.haptics = false
	game.choose_route("green")
	host.toast_left = 0
	host.view = "home"
	host._rebuild()
	await host.get_tree().create_timer(0.3).timeout
	check(OS.has_feature("ios"), "Acceptance runs inside the physical iOS application")
	check(DisplayServer.get_name() == "iOS", "iOS native display server is active")
	check(host.compact, "Portrait iPhone uses the mobile interface")
	check(host.logical_size.x >= 390 and host.logical_size.x < 500, "Native Retina viewport is scaled to usable iPhone points")
	await screenshot(host, "home")
	checkpoint("home", host)
	check(await tap_control(host, "start"), "Native touch starts the run from the home screen")
	diagnostics.after_start = game.session.mode
	check(await wait_mode(host, "playing"), "Native countdown transitions to active play")
	diagnostics.after_countdown = game.session.mode
	var safe := DisplayServer.get_display_safe_area()
	for id in ["tap", "burst", "lane:0", "lane:1", "lane:2", "pause"]:
		if not host.controls.has(id):
			check(false, "Native control exists: " + id)
			continue
		var button: Button = host.controls[id]
		var rect := button.get_global_rect()
		check(Rect2(safe).encloses(rect), "Native control is inside the notch/home safe area: " + id)
	await tap_control(host, "pause")
	await wait_mode(host, "paused", 800)
	var time_left: float = game.session.time_left
	diagnostics.pause_initial_mode = game.session.mode
	await host.get_tree().create_timer(0.7).timeout
	check(game.session.mode == "paused" and is_equal_approx(time_left, game.session.time_left), "Native pause freezes the real countdown")
	diagnostics.pause_final_mode = game.session.mode
	diagnostics.pause_initial_time = time_left
	diagnostics.pause_final_time = game.session.time_left
	checkpoint("pause-detail-" + game.session.mode + "-" + str(time_left) + "-" + str(game.session.time_left), host)
	await screenshot(host, "play-paused")
	await tap_control(host, "resume")
	await wait_mode(host, "playing")
	checkpoint("resumed", host)
	check(game.session.mode == "playing", "Native resume touch returns to play")
	var used_burst := false
	for door in range(3):
		if door > 0:
			await tap_control(host, "next")
			await wait_mode(host, "playing")
		var attempts := 0
		while game.session.mode == "playing" and attempts < 90:
			var obstacle: Dictionary = game.session.active_obstacle()
			var free_lane := (int(obstacle.lane) + 1) % 3
			if game.session.lane != free_lane: await tap_control(host, "lane:" + str(free_lane))
			if game.session.energy >= 60 and game.session.burst_cooldown <= 0:
				await tap_control(host, "burst")
				used_burst = true
			await tap_control(host, "tap")
			attempts += 1
			if attempts % 5 == 0: checkpoint("tap-door-" + str(door + 1), host)
		check(game.session.mode == "won", "Native repeated touch enters carriage door " + str(door + 1))
		check(game.session.bonus_seconds == 3, "Native door gains the real +1/+2 second bonuses")
		if game.session.mode != "won": break
		checkpoint("won-door-" + str(door + 1), host)
		await host.get_tree().create_timer(0.15).timeout
	check(game.profile.total_doors == 3 and game.profile.route_progress.green == 1, "Native three-door stage unlocks Əhmədli")
	check(used_burst, "Native energy button activates Yol aç during play")
	await screenshot(host, "station-clear")
	checkpoint("cleared", host)
	await tap_control(host, "result-shop")
	await host.get_tree().create_timer(0.2).timeout
	await tap_control(host, "buy:strength")
	checkpoint("strength-purchased", host)
	await tap_control(host, "filter:clothing")
	checkpoint("clothing-filter", host)
	await host.get_tree().create_timer(0.1).timeout
	await tap_control(host, "buy:helmet")
	checkpoint("helmet-purchased", host)
	await host.get_tree().create_timer(0.2).timeout
	check(game.profile.upgrades.strength == 1 and game.player_stats().power > 8, "Native shop purchase changes actual strength")
	check(game.profile.equipped.get("head") == "helmet", "Native shop equips the visible helmet")
	await tap_control(host, "nav:profile")
	await screenshot(host, "wardrobe")
	checkpoint("wardrobe", host)
	await tap_control(host, "nav:map")
	check(host.controls.has("station:17") and host.controls["station:17"].disabled, "Native station map enforces the final-station lock")
	await screenshot(host, "map")
	check(host.world.world_ready and host.world.crowd.size() >= 20, "Native scene contains live rigged 3D crowd")
	check(host.world.train.door_leaves.size() == 6, "Native 3D train has six independently sliding door leaves")
	check(host.world.mesh_count < 700, "Detailed station meshes are batched for mobile")
	var sorted_frames: Array = host.world.live_frame_ms.duplicate()
	sorted_frames.sort()
	var average := 0.0
	for frame in sorted_frames: average += float(frame)
	average = average / maxf(1, sorted_frames.size())
	var report := {
		"at": Time.get_datetime_string_from_system(true), "version": "1.1.0", "build": "2",
		"physical_device": OS.has_feature("ios"), "engine": Engine.get_version_info().string,
		"display_server": DisplayServer.get_name(), "renderer": RenderingServer.get_current_rendering_method(),
		"viewport": host.get_viewport_rect().size, "ui_points": host.logical_size,
		"safe_area": safe, "duration_ms": Time.get_ticks_msec() - started,
		"checks": checks, "failures": failures, "diagnostics": diagnostics,
		"world": host.world.snapshot(), "performance": {"samples": sorted_frames.size(), "mean_ms": average,
			"p95_ms": sorted_frames[mini(sorted_frames.size() - 1, int(sorted_frames.size() * 0.95))] if not sorted_frames.is_empty() else 0.0}
	}
	var file := FileAccess.open(directory + "/acceptance.json", FileAccess.WRITE)
	file.store_string(JSON.stringify(report))
	file.close()
	checkpoint("complete", host)
	return report
