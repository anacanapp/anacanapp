class_name DirectTasks
extends Node3D

signal solved
signal feedback(message: String)
signal progress_changed(done: int, total: int)

var world: Node3D
var sequence: WorldSequence
var task_camera: Camera3D
var items: Dictionary = {}
var action := ""
var stage := 0
var total := 0
var done := 0
var complete := false
var required := false
var gesture := "tap"
var last_pointer := Vector2.ZERO
var pressed := false
var cut_distance := 0.0
var cuts := 0
var cutter: Node3D
var sponge: Node3D
var task_root: Node3D
var center := Vector3.ZERO
var score := 100.0
var generation := 0
var elapsed := 0.0

func setup(scene: Node3D, owner: WorldSequence) -> void:
	world = scene
	sequence = owner
	task_camera = Camera3D.new()
	task_camera.fov = 44
	task_camera.near = .035
	task_camera.far = 200
	add_child(task_camera)

func open(id: String, index: int) -> void:
	clear_stage()
	action = id
	stage = index
	generation += 1
	done = 0
	total = 0
	complete = false
	required = true
	pressed = false
	gesture = "tap"
	elapsed = 0.0
	if stage == 0:
		score = 100.0
	task_root = Node3D.new()
	add_child(task_root)
	var b: WorldBuilder = world.builder
	match action:
		"cook": cooking(b)
		"laundry": laundry(b)
		"clean", "tidy": cleaning(b)
		"test": pregnancy_test(b)
		"feed", "diaper", "sterilise": care(b)
		"play": play(b)
		"assemble": assembly(b)
		"pack", "carseat": packing(b)
		_:
			required = false
			focus(world.active_object.global_position + Vector3(0, 1, 0) if world.active_object else world.player.position + Vector3(0, 1, 0), Vector3(.5, .65, 1.3))
	progress_changed.emit(done, total)
	world.player.camera.current = false
	task_camera.current = true

func focus(at: Vector3, offset: Vector3) -> void:
	center = at
	task_camera.position = at + offset
	task_camera.look_at(at, Vector3.UP)

func collision(root: Node3D, key: String, at: Vector3, size: Vector3) -> void:
	var body := StaticBody3D.new()
	body.collision_layer = 8
	body.collision_mask = 0
	body.position = at
	body.set_meta("task_item", key)
	root.add_child(body)
	var collider := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = size
	collider.shape = shape
	body.add_child(collider)

func item(key: String, title: String, at: Vector3, size: Vector3, shape := "cloth", valid := true) -> Node3D:
	var root := Node3D.new()
	root.position = at
	task_root.add_child(root)
	var b: WorldBuilder = world.builder
	match shape:
		"apple": b.imported("food_apple_01", Vector3.ZERO, .2, 1.0, root)
		"milk":
			b.cylinder(.035, .14, Vector3(0, .04, 0), b.cream, root)
			b.cylinder(.025, .017, Vector3(0, .12, 0), b.sage, root)
			b.box(Vector3(.054, .049, .006), Vector3(0, .045, .036), b.sage, false, root)
		"bread": b.details.soft_box(Vector3(.21, .093, .12), Vector3.ZERO, b.material("c49c69"), root)
		"carrot":
			var carrot := b.ball(Vector3(.025, .105, .025), Vector3.ZERO, b.material("bf915a"), root)
			carrot.rotation.z = PI * .5
			for i in 3:
				b.ball(Vector3(.032, .008, .009), Vector3(-.109, .025 + i * .008, 0), b.sage, root)
		"dust":
			b.details.soft_box(size, Vector3.ZERO, b.material("b3a38b"), root)
		"plate":
			b.cylinder(.14, .015, Vector3.ZERO, b.cream, root)
			b.details.torus(.115, .008, Vector3(0, .005, 0), b.cream, root)
		"panel": b.box(size, Vector3.ZERO, b.wood, false, root)
		"kit":
			b.box(size, Vector3.ZERO, b.cream, false, root)
		"toy": b.box(size, Vector3.ZERO, b.sage, false, root)
		_:
			var cloth: Material = b.sage if shape == "colour_cloth" else b.linen
			b.box(size, Vector3.ZERO, cloth, false, root)
			b.box(Vector3(size.x * .45, size.y, size.z * .65), Vector3(-size.x * .6, 0, -size.z * .25), cloth, false, root).rotation.y = -.28
			b.box(Vector3(size.x * .45, size.y, size.z * .65), Vector3(size.x * .6, 0, -size.z * .25), cloth, false, root).rotation.y = .28
	collision(root, key, Vector3.ZERO, size + Vector3(.055, .035, .04))
	items[key] = {"node": root, "valid": valid, "done": false, "title": title}
	if valid:
		total += 1
	return root

func cooking(b: WorldBuilder) -> void:
	var board: Vector3 = b.objects["prep-board"].position + Vector3(0, .056, 0)
	if stage == 0:
		focus(board, Vector3(.12, .71, 1.06))
		b.imported("wooden_bowl_02", board + Vector3(.23, .025, -.16), 0, .92, task_root)
		for i in 4:
			var shape: String = ["carrot", "apple", "milk", "bread"][i]
			item(shape, ["Kök", "Tərəvəz", "Süd", "Çörək"][i], board + Vector3(-.19 + (i % 2) * .19, .045, .11 + (i / 2) * .19), Vector3(.13, .15, .14), shape)
	elif stage == 1:
		focus(board, Vector3(.15, .67, .97))
		gesture = "cut"
		total = 6
		for i in 4:
			b.ball(Vector3(.026, .10, .028), board + Vector3(-.17 + i * .11, .029, .025), b.material("bf9664"), task_root).rotation.z = PI * .5
		cutter = Node3D.new()
		cutter.position = board + Vector3(0, .13, 0)
		task_root.add_child(cutter)
		b.box(Vector3(.011, .07, .18), Vector3.ZERO, b.material("bac1b7", .2, .8), false, cutter)
		b.box(Vector3(.028, .024, .12), Vector3(0, .04, .13), b.material("617252"), false, cutter)
		collision(task_root, "board", board, Vector3(.60, .06, .47))
	elif stage == 2:
		required = false
		focus(b.objects["cooking-pot"].position + Vector3(0, .03, 0), Vector3(.31, .69, 1.10))
		for i in 7:
			b.ball(Vector3(.03, .02, .03), center + Vector3(sin(i * 2.4) * .09, .074, cos(i * 2.4) * .09), b.material("b3ae78"), task_root)
	else:
		focus(b.objects.island.position + Vector3(0, .97, 0), Vector3(.30, .65, 1.12))
		for i in 2:
			item("plate-%d" % i, "Yeməyi boşqaba yerləşdir", center + Vector3(-.35 + i * .68, .022, 0), Vector3(.25, .024, .25), "plate")

func laundry(b: WorldBuilder) -> void:
	if stage in [0, 1]:
		focus(b.objects.bed.position + Vector3(-.28, .72, .70), Vector3(.12, .85, 1.29))
		var count := mini(6 - mini(6, int(Life.state.household.laundry.clean)), int(Life.state.household.laundry.dirty))
		var colours := [true, false, true, false, false, true]
		for i in count:
			if stage == 1 and colours[i]:
				continue
			item("cloth-%d" % i, "Açıq paltar" if colours[i] else "Rəngli paltar", center + Vector3(-.30 + i % 3 * .28, .02, -.20 + i / 3 * .28), Vector3(.18, .025, .19), "cloth" if colours[i] else "colour_cloth", colours[i] == (stage == 0))
		if total == 0:
			required = false
	elif stage == 2:
		required = false
		focus(b.objects.washer.position + Vector3(0, .48, .33), Vector3(.27, .16, 1.45))
		b.details.wash_running(true)
	elif stage == 3:
		focus(b.details.drying_rack.position + Vector3(0, .86, 0), Vector3(.32, .71, 1.72))
		for i in Life.laundry_load():
			var cloth := item("dry-%d" % i, "Paltarı as", center + Vector3(-.37 + i % 3 * .34, -.01, -.13 + i / 3 * .26), Vector3(.20, .025, .23), "cloth")
	else:
		focus(b.objects.bed.position + Vector3(-.25, .71, .76), Vector3(.33, .90, 1.18))
		for i in Life.laundry_load():
			item("fold-%d" % i, "Paltarı qatla", center + Vector3(-.32 + i % 3 * .29, .02, -.17 + i / 3 * .27), Vector3(.18, .025, .20), "cloth")

func cleaning(b: WorldBuilder) -> void:
	var positions := [Vector3(-4.50, .57, 1.80), Vector3(-6.45, 1.20, 1.60), Vector3(3.48, .14, -1.66), Vector3(-3.17, .096, 3.75)]
	focus(positions[stage], Vector3(.20, .72, 1.10))
	gesture = "wipe" if action == "clean" else "tap"
	for i in 4:
		item("dust-%d" % i, "Səthi sil", center + Vector3(-.23 + i % 2 * .35, .015, -.13 + i / 2 * .29), Vector3(.16, .018, .12), "dust")
	sponge = b.box(Vector3(.105, .047, .073), center + Vector3(.27, .05, .28), b.sage, false, task_root)

func pregnancy_test(b: WorldBuilder) -> void:
	focus(b.objects["pregnancy-test"].position + Vector3(-.10, .06, .09), Vector3(.16, .47, .65))
	var kit := b.box(Vector3(.27, .021, .040), center, b.cream, false, task_root)
	if stage == 0:
		item("test-box", "Testi qutudan çıxar", center + Vector3(.10, .065, .13), Vector3(.22, .05, .13), "kit")
	elif stage == 1:
		item("test-cap", "Qapağı çıxar", center + Vector3(-.119, .015, 0), Vector3(.064, .027, .046), "kit")
	else:
		required = false
		if stage == 3:
			for x in [.016, .049]:
				b.box(Vector3(.008, .002, .024), center + Vector3(x, .013, 0), b.material("ac8191"), false, task_root)

func care(b: WorldBuilder) -> void:
	var at: Vector3 = b.objects.dresser.position + Vector3(0, 1.06, 0)
	if Life.state.location == "clinic":
		at = b.objects["clinic-changing"].position + Vector3(0, .97, 0)
	focus(at, Vector3(.35, .73, 1.1))
	if stage == 0:
		for i in 3:
			item("care-%d" % i, ["Təmiz bez", "Yumşaq dəsmal", "Qayğı əşyası"][i], at + Vector3(-.32 + i * .29, .06, .14), Vector3(.15, .05, .16), "cloth" if i < 2 else "milk")
	else:
		var child: Node3D = b.make_baby()
		task_root.add_child(child)
		child.position = at + Vector3(.0, .10, -.12)
		child.rotation.x = PI * .5
		item("care-touch", "Yumşaq qayğını tamamla", at + Vector3(.0, .12, -.02), Vector3(.19, .06, .23), "cloth")

func play(b: WorldBuilder) -> void:
	focus(b.objects.playmat.position + Vector3(0, .14, 0), Vector3(.36, .75, 1.17))
	for i in 3:
		item("toy-%d" % i, "Taxta oyuncağı göstər", center + Vector3(-.26 + i * .27, .06, .07), Vector3(.13, .13, .13), "toy")

func assembly(b: WorldBuilder) -> void:
	focus(b.objects.crib.position + Vector3(0, .96, .15), Vector3(1.09, .74, 1.6))
	var at := center + Vector3(-.23, .35, .02)
	item("crib-panel", "Hissəni düzgün yuvaya birləşdir", at, Vector3(.72, .051, .11), "panel")

func packing(b: WorldBuilder) -> void:
	focus(world.active_object.position + Vector3(0, .86, .10) if world.active_object else world.player.position + Vector3(0, 1.0, .10), Vector3(.3, .8, 1.21))
	for i in 2:
		item("bag-%d" % i, "Əşyanı yerinə yerləşdir", center + Vector3(-.22 + i * .42, .07, 0), Vector3(.19, .04, .22), "cloth")

func hit(screen: Vector2) -> Dictionary:
	if not task_camera or not task_camera.current:
		return {}
	var origin := task_camera.project_ray_origin(screen)
	var ray := PhysicsRayQueryParameters3D.create(origin, origin + task_camera.project_ray_normal(screen) * 10, 8)
	return get_world_3d().direct_space_state.intersect_ray(ray)

func tap_at(screen: Vector2) -> bool:
	if complete or not required:
		return false
	var result := hit(screen)
	if result.is_empty():
		return false
	var key: String = result.collider.get_meta("task_item", "")
	if gesture == "cut":
		return false
	return select(key)

func select(key: String) -> bool:
	if complete or not items.has(key) or items[key].done:
		return false
	var record: Dictionary = items[key]
	if not record.valid:
		score = maxf(60, score - 5)
		feedback.emit("İndi açıq rəngləri ayır; rəngli paltarlar növbəti səbət üçündür.")
		return false
	record.done = true
	done += 1
	for child in record.node.get_children():
		if child is CollisionObject3D:
			child.collision_layer = 0
	var tween := create_tween()
	if action == "cook" and stage == 0:
		tween.tween_property(record.node, "position", center + Vector3(.23, .15 + done * .014, -.16), .28)
	elif action == "laundry" and stage == 3:
		tween.tween_property(record.node, "rotation:x", PI * .5, .30)
		tween.parallel().tween_property(record.node, "position:y", center.y - .10, .30)
	elif action == "laundry" and stage == 4:
		tween.tween_property(record.node, "scale", Vector3(.8, 1.4, .45), .28)
	elif action in ["clean", "tidy"]:
		tween.tween_property(record.node, "scale", Vector3.ZERO, .20)
	else:
		tween.tween_property(record.node, "position", record.node.position + Vector3(0, .10, -.13), .25)
	if Life.state.settings.sound and world.object_sound:
		world.object_sound.play()
	world.player.actor.gesture("PickUp_Table")
	progress_changed.emit(done, total)
	if done >= total:
		complete = true
		solved.emit()
	return true

func swipe(from: Vector2, to: Vector2) -> bool:
	if complete or gesture not in ["cut", "wipe"]:
		return false
	var result := hit(to)
	if result.is_empty():
		return false
	if gesture == "wipe":
		if sponge:
			sponge.position = result.position + Vector3(0, .047, 0)
		return select(str(result.collider.get_meta("task_item", "")))
	cut_distance += from.distance_to(to)
	if cut_distance < 32:
		return false
	cut_distance = 0
	cuts += 1
	done = mini(total, cuts)
	if cutter:
		var tween := create_tween()
		tween.tween_property(cutter, "position:y", center.y + .036, .085)
		tween.tween_property(cutter, "position:y", center.y + .13, .085)
	world.player.actor.gesture("Interact")
	progress_changed.emit(done, total)
	if done >= total:
		complete = true
		solved.emit()
	return true

func _unhandled_input(event: InputEvent) -> void:
	if not sequence.working or not required or complete or Life.acceptance:
		return
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT or event is InputEventScreenTouch:
		pressed = event.pressed
		last_pointer = event.position
		if pressed and gesture == "tap":
			tap_at(event.position)
		elif pressed and gesture == "wipe":
			swipe(event.position, event.position)
	if event is InputEventScreenDrag or event is InputEventMouseMotion and pressed:
		if pressed:
			swipe(last_pointer, event.position)
			last_pointer = event.position

func _process(delta: float) -> void:
	if not sequence.working:
		return
	elapsed += delta
	if action == "laundry" and stage == 2 and world.builder.details.washing_drum:
		world.builder.details.washing_drum.rotation.z += delta * 2.5

func clear_stage() -> void:
	if task_root:
		remove_child(task_root)
		task_root.queue_free()
		task_root = null
	items.clear()
	cutter = null
	sponge = null
	cuts = 0
	cut_distance = 0
	complete = false

func close() -> void:
	clear_stage()
	task_camera.current = false
	world.player.camera.current = true
	world.player.set_camera()
	world.builder.details.wash_running(false)
