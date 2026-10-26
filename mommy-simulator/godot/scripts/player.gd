class_name WorldPlayer
extends CharacterBody3D

signal interaction_requested

var actor: FamilyActor
var pivot: Node3D
var spring: SpringArm3D
var camera: Camera3D
var move_input := Vector2.ZERO
var yaw := 0.0
var pitch := -.12
var running := false
var crouched := false
var seated := false
var first_person := false
var jump_requested := false
var paused := false
var walk_target := Vector3.ZERO
var auto_walk := false
var capsule: CollisionShape3D
var stand_position := Vector3.ZERO
var last_save := 0.0
var path: Array[Vector3] = []
var arrival: Callable
var camera_distance := 3.5
var footsteps: AudioStreamPlayer3D
var step_distance := 0.0
var focus_camera: Camera3D
var camera_lateral := .25
var safe_position := Vector3(0, .12, 3)

func _ready() -> void:
	collision_layer = 2
	collision_mask = 1
	floor_snap_length = .30
	var shape := CapsuleShape3D.new()
	shape.radius = .28
	shape.height = 1.72
	capsule = CollisionShape3D.new()
	capsule.shape = shape
	capsule.position.y = .88
	add_child(capsule)
	actor = FamilyActor.new()
	add_child(actor)
	actor.setup(true)
	pivot = Node3D.new()
	add_child(pivot)
	pivot.position.y = 1.5
	spring = SpringArm3D.new()
	spring.spring_length = 3.5
	spring.margin = .18
	spring.collision_mask = 1
	var sphere := SphereShape3D.new()
	sphere.radius = .18
	spring.shape = sphere
	pivot.add_child(spring)
	spring.add_excluded_object(get_rid())
	camera = Camera3D.new()
	camera.fov = 65
	camera.near = .08
	camera.far = 420
	camera.current = true
	spring.add_child(camera)
	camera.set_as_top_level(true)
	set_camera()
	footsteps = AudioStreamPlayer3D.new()
	footsteps.stream = load("res://assets/details/step.wav")
	footsteps.volume_db = -19
	footsteps.max_distance = 8
	add_child(footsteps)

func _physics_process(delta: float) -> void:
	update_camera(delta)
	if paused or not Life.state.started:
		return
	if not Life.acceptance and Input.is_key_pressed(KEY_E) and not get_meta("interact_key", false):
		interaction_requested.emit()
	set_meta("interact_key", Input.is_key_pressed(KEY_E))
	if not Life.acceptance and Input.is_key_pressed(KEY_SPACE) and not get_meta("jump_key", false):
		jump_requested = true
	set_meta("jump_key", Input.is_key_pressed(KEY_SPACE))
	if seated or Life.state.activity != null:
		velocity = Vector3.ZERO
		actor.animate_state(0.0, "rest" if seated else str(Life.state.activity.id))
		return
	var keyboard := Vector2.ZERO if Life.acceptance else Vector2(float(Input.is_key_pressed(KEY_D)) - float(Input.is_key_pressed(KEY_A)), float(Input.is_key_pressed(KEY_S)) - float(Input.is_key_pressed(KEY_W)))
	var input := keyboard if keyboard.length() > .01 else move_input
	var movement := Vector3(input.x, 0, input.y).rotated(Vector3.UP, yaw)
	if input.length() > .1:
		auto_walk = false
		path.clear()
		arrival = Callable()
	if auto_walk:
		if not path.is_empty():
			walk_target = path[0]
		var direction := walk_target - global_position
		direction.y = 0
		if direction.length() < .18:
			if not path.is_empty():
				path.pop_front()
			if path.is_empty():
				auto_walk = false
				if arrival.is_valid():
					var callback := arrival
					arrival = Callable()
					callback.call_deferred()
		else:
			movement = direction.normalized()
	var sprinting := running or not Life.acceptance and Input.is_key_pressed(KEY_SHIFT)
	var speed := 1.0 if crouched else 3.45 if sprinting else 1.65
	if not Life.state.pregnancy.born and Life.week() >= 28:
		speed *= .82
	var desired := movement.limit_length(1.0) * speed
	velocity.x = move_toward(velocity.x, desired.x, delta * 9)
	velocity.z = move_toward(velocity.z, desired.z, delta * 9)
	if not is_on_floor():
		velocity.y -= 13 * delta
	elif jump_requested:
		velocity.y = 4.4
		actor.gesture("Jump_Start")
	jump_requested = false
	move_and_slide()
	if is_on_floor() and global_position.y < 2.0:
		safe_position = global_position
	elif global_position.y < -4:
		global_position = safe_position + Vector3(0, .12, 0)
		velocity = Vector3.ZERO
		path.clear()
		auto_walk = false
	step_distance += Vector2(velocity.x, velocity.z).length() * delta
	if is_on_floor() and step_distance > .74:
		step_distance = 0
		if Life.state.settings.sound:
			footsteps.play()
	update_camera(delta)
	if movement.length() > .05:
		actor.rotation.y = lerp_angle(actor.rotation.y, atan2(movement.x, movement.z), delta * 10)
	actor.animate_state(Vector2(velocity.x, velocity.z).length(), "", crouched)
	last_save += delta
	if last_save > 1.0:
		last_save = 0.0
		Life.world.position = [global_position.x, global_position.y, global_position.z]
		Life.world.yaw = yaw

func look(delta: Vector2) -> void:
	yaw -= delta.x * .004
	pitch = clampf(pitch - delta.y * .0035, -.72, .30)
	set_camera()

func set_camera() -> void:
	if not pivot:
		return
	pivot.rotation.y = yaw
	pivot.rotation.x = pitch
	spring.spring_length = 0.0 if first_person else 3.5
	actor.visible = not first_person
	if is_inside_tree():
		update_camera(1.0)

func update_camera(delta: float) -> void:
	if not camera or not is_inside_tree():
		return
	var origin := pivot.global_position
	var desired := pivot.global_basis.z * (0.0 if first_person else 3.05)
	if not first_person:
		desired += pivot.global_basis.x * camera_lateral
	var available := desired.length()
	if not first_person:
		var shape := SphereShape3D.new()
		shape.radius = .16
		var query := PhysicsShapeQueryParameters3D.new()
		query.shape = shape
		query.transform = Transform3D(Basis.IDENTITY, origin)
		query.motion = desired
		query.collision_mask = 1
		query.exclude = [get_rid()]
		var sweep := get_world_3d().direct_space_state.cast_motion(query)
		if sweep.size() == 2:
			available = maxf(.08, desired.length() * float(sweep[0]) - .08)
		if available < camera_distance:
			camera_distance = available
		else:
			camera_distance = lerpf(camera_distance, available, minf(1.0, delta * 12))
	else:
		camera_distance = 0.0
	camera.global_transform = Transform3D(pivot.global_basis, origin + desired.normalized() * camera_distance)
	actor.visible = not first_person and camera_distance > .56

func follow_path(points: Array[Vector3], callback: Callable) -> void:
	path = points
	arrival = callback
	auto_walk = not path.is_empty()
	if auto_walk:
		walk_target = path[0]

func toggle_view() -> void:
	first_person = not first_person
	set_camera()

func toggle_crouch() -> void:
	if crouched:
		var query := PhysicsShapeQueryParameters3D.new()
		var standing := CapsuleShape3D.new()
		standing.radius = .28
		standing.height = 1.72
		query.shape = standing
		query.transform = Transform3D(Basis.IDENTITY, global_position + Vector3(0, .88, 0))
		query.exclude = [get_rid()]
		query.collision_mask = 1
		if not get_world_3d().direct_space_state.intersect_shape(query, 1).is_empty():
			return
	crouched = not crouched
	(capsule.shape as CapsuleShape3D).height = 1.15 if crouched else 1.72
	capsule.position.y = .60 if crouched else .88
	pivot.position.y = 1.0 if crouched else 1.5

func sit(at: Vector3, rotation_y: float) -> void:
	stand_position = global_position
	global_position = at
	actor.rotation.y = rotation_y
	seated = true
	actor.gesture("Sitting_Enter")

func stand() -> void:
	seated = false
	global_position = stand_position
	actor.gesture("Sitting_Exit")
