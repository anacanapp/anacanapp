class_name WorldBuilder
extends RefCounted

var parent: Node3D
var wall: StandardMaterial3D
var wood: StandardMaterial3D
var fabric: StandardMaterial3D
var cream: StandardMaterial3D
var sage: StandardMaterial3D
var gold: StandardMaterial3D
var stone: StandardMaterial3D
var lawn: StandardMaterial3D
var floor_material: StandardMaterial3D
var room_bounds: Dictionary = {}
var objects: Dictionary = {}
var dynamic := Node3D.new()
var lights: Array[OmniLight3D] = []
var environment: Environment
var sunlight: DirectionalLight3D
var household_key := ""
var material_cache: Dictionary = {}
var baby: Node3D
var toddler: FamilyActor
var linen: StandardMaterial3D
var details: InteriorDetails
var static_batches := 0

func build(root: Node3D) -> void:
	parent = root
	wall = pbr("painted_plaster_wall", Color("f1efe6"), 1.5)
	wall.normal_scale = .035
	wood = pbr("wood_floor", Color("dcc8a5"), 2.0)
	wood.normal_scale = .20
	wood.roughness = .72
	floor_material = pbr("wood_floor", Color("f4e6c6"), 6.0)
	lawn = pbr("grass_ground", Color("a5b78e"), 45.0)
	linen = pbr("rough_linen", Color("f3eee0"), 2.0)
	linen.normal_scale = .28
	fabric = linen.duplicate()
	fabric.albedo_color = Color("c7c4ae")
	cream = material("efe9dc")
	sage = material("9fac95")
	gold = material("b39a70", .38, .65)
	stone = pbr("concrete_pavement", Color("d9d8c5"), 5.0)
	make_environment()
	landscape()
	house()
	living()
	kitchen()
	nursery()
	bedroom()
	bathroom()
	terrace()
	neighbourhood()
	details = InteriorDetails.new()
	parent.add_child(details)
	details.build(self)
	baby = make_baby()
	parent.add_child(baby)
	toddler = FamilyActor.new()
	toddler.position = Vector3(3.45, .11, -1.66)
	toddler.scale = Vector3.ONE * .46
	parent.add_child(toddler)
	toddler.setup(false)
	toddler.visible = false
	parent.add_child(dynamic)
	room_bounds = {"living": Rect2(-7, .3, 6.0, 6.0), "kitchen": Rect2(-7, -6, 6, 5.6), "nursery": Rect2(1.1, -6, 5.7, 5.6),
		"bedroom": Rect2(1.1, .4, 5.7, 5.9), "bathroom": Rect2(-.9, -6, 1.8, 3.7), "garden": Rect2(-7, 6.7, 14, 5.5),
		"market": Rect2(13, -6, 8, 8), "cafe": Rect2(-22, -6, 9, 8), "clinic": Rect2(12, 10, 10, 9), "lakeside": Rect2(-28, 12, 29, 14)}
	batch_static_geometry()

func material(colour: String, roughness := .85, metallic := 0.0) -> StandardMaterial3D:
	var key := "%s:%.2f:%.2f" % [colour, roughness, metallic]
	if material_cache.has(key):
		return material_cache[key]
	var result := StandardMaterial3D.new()
	result.albedo_color = Color(colour)
	result.roughness = roughness
	result.metallic = metallic
	material_cache[key] = result
	return result

func pbr(id: String, colour: Color, repeat := 1.0) -> StandardMaterial3D:
	var result := StandardMaterial3D.new()
	result.albedo_color = colour
	result.albedo_texture = load("res://assets/materials/%s/albedo.jpg" % id)
	result.normal_enabled = true
	result.normal_texture = load("res://assets/materials/%s/normal.jpg" % id)
	result.normal_scale = .75
	result.roughness_texture = load("res://assets/materials/%s/roughness.jpg" % id)
	result.roughness = .9
	result.uv1_scale = Vector3.ONE * repeat
	result.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
	return result

func mesh(shape: Mesh, at: Vector3, mat: Material, group: Node3D = parent) -> MeshInstance3D:
	var node := MeshInstance3D.new()
	node.mesh = shape
	node.material_override = mat
	node.position = at
	group.add_child(node)
	return node

func box(size: Vector3, at: Vector3, mat: Material, collision := false, group: Node3D = parent) -> Node3D:
	var shape := BoxMesh.new()
	shape.size = size
	if not collision:
		return mesh(shape, at, mat, group)
	var body := StaticBody3D.new()
	body.position = at
	group.add_child(body)
	mesh(shape, Vector3.ZERO, mat, body)
	var collider := CollisionShape3D.new()
	var bounds := BoxShape3D.new()
	bounds.size = size
	collider.shape = bounds
	body.add_child(collider)
	return body

func cylinder(radius: float, height: float, at: Vector3, mat: Material, group: Node3D = parent) -> MeshInstance3D:
	var shape := CylinderMesh.new()
	shape.top_radius = radius
	shape.bottom_radius = radius
	shape.height = height
	shape.radial_segments = 16
	return mesh(shape, at, mat, group)

func ball(size: Vector3, at: Vector3, mat: Material, group: Node3D = parent) -> MeshInstance3D:
	var shape := SphereMesh.new()
	shape.radial_segments = 20
	shape.rings = 12
	shape.radius = .5
	shape.height = 1
	var node := mesh(shape, at, mat, group)
	node.scale = size * 2
	return node

func imported(id: String, at: Vector3, angle := 0.0, scale := 1.0, group: Node3D = parent) -> Node3D:
	var node: Node3D = load("res://assets/%s/%s.gltf" % [id, id]).instantiate()
	node.position = at
	node.rotation.y = angle
	node.scale = Vector3.ONE * scale
	group.add_child(node)
	for part in FamilyActor.meshes(node):
		part.visibility_range_end = 45
		if id == "sofa_02" and "Seat" in str(part.name):
			part.material_override = linen
		elif id == "modern_arm_chair_01" and part.mesh.get_surface_count() > 1:
			part.set_surface_override_material(1, linen)
	return node

func interact(id: String, title: String, action: String, position: Vector3, type := "activity", size := Vector3(.8, .8, .8)) -> WorldInteractable:
	var object := WorldInteractable.new()
	object.position = position
	parent.add_child(object)
	object.setup(id, title, action, type)
	var body := StaticBody3D.new()
	object.add_child(body)
	var collider := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = size
	collider.shape = shape
	collider.position.y = size.y * .5
	body.add_child(collider)
	object.body = body
	body.set_meta("interactable", object)
	objects[id] = object
	return object

func plant(position: Vector3, scale := 1.0) -> void:
	imported("potted_plant_04", position, 0, scale)

func lamp(position: Vector3, ceiling := false) -> void:
	if ceiling:
		cylinder(.009, .42, position + Vector3(0, .16, 0), gold)
		cylinder(.27, .25, position - Vector3(0, .15, 0), cream)
	else:
		cylinder(.17, .04, position + Vector3(0, .025, 0), gold)
		cylinder(.012, 1.18, position + Vector3(0, .62, 0), gold)
		cylinder(.27, .32, position + Vector3(0, 1.28, 0), cream)
	var light := OmniLight3D.new()
	light.position = position + Vector3(0, -.3 if ceiling else 1.2, 0)
	light.light_color = Color("ffe0ae")
	light.light_energy = .9
	light.omni_range = 4.5
	light.shadow_enabled = false
	parent.add_child(light)
	lights.append(light)

func cup(position: Vector3, group: Node3D = parent) -> void:
	cylinder(.063, .105, position + Vector3(0, .05, 0), cream, group)
	cylinder(.05, .003, position + Vector3(0, .105, 0), material("84634b"), group)
	var torus := TorusMesh.new()
	torus.inner_radius = .025
	torus.outer_radius = .043
	var handle := mesh(torus, position + Vector3(.074, .06, 0), cream, group)
	handle.rotation.x = PI * .5

func make_environment() -> void:
	var world := WorldEnvironment.new()
	environment = Environment.new()
	var sky := Sky.new()
	var sky_mat := PanoramaSkyMaterial.new()
	sky_mat.panorama = load("res://assets/environments/kloofendal_48d_partly_cloudy_puresky.hdr")
	sky_mat.energy_multiplier = .65
	sky.sky_material = sky_mat
	environment.background_mode = Environment.BG_SKY
	environment.sky = sky
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	environment.ambient_light_energy = .38
	environment.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	environment.tonemap_mode = Environment.TONE_MAPPER_ACES
	environment.tonemap_exposure = .88
	environment.fog_enabled = true
	environment.fog_light_color = Color("bed0d0")
	environment.fog_density = .0014
	environment.glow_enabled = true
	environment.glow_intensity = .12
	world.environment = environment
	parent.add_child(world)
	sunlight = DirectionalLight3D.new()
	sunlight.rotation_degrees = Vector3(-35, -30, 0)
	sunlight.light_color = Color("fff0d3")
	sunlight.light_energy = 1.15
	sunlight.shadow_enabled = true
	sunlight.directional_shadow_mode = DirectionalLight3D.SHADOW_PARALLEL_2_SPLITS
	sunlight.directional_shadow_max_distance = 45
	sunlight.shadow_bias = .06
	parent.add_child(sunlight)
	var fill := DirectionalLight3D.new()
	fill.rotation_degrees = Vector3(-48, 138, 0)
	fill.light_color = Color("d3e5df")
	fill.light_energy = .24
	parent.add_child(fill)

func landscape() -> void:
	box(Vector3(100, .20, 70), Vector3(0, -.10, -11), lawn, true)
	box(Vector3(45, .07, 5), Vector3(0, -.08, 7.6), stone, true)
	box(Vector3(5, .07, 39), Vector3(10, -.08, 2), stone, true)
	var lake := PlaneMesh.new()
	lake.size = Vector2(130, 80)
	lake.subdivide_width = 48
	lake.subdivide_depth = 32
	var water := ShaderMaterial.new()
	water.shader = load("res://shaders/water.gdshader")
	mesh(lake, Vector3(-2, -.28, 64), water)
	AlpineLandscape.new().build(self)

func tree(position: Vector3, size: float) -> void:
	var group := Node3D.new()
	group.position = position
	group.scale = Vector3.ONE * size
	parent.add_child(group)
	cylinder(.13, 2.5, Vector3(0, 1.20, 0), material("887357"), group)
	for i in 5:
		ball(Vector3(1.07, .98, 1.04), Vector3(sin(i * 2.4) * .67, 2.52 + i % 2 * .54, cos(i * 2.4) * .50), material("718562" if i % 2 else "8b9d72"), group)

func house() -> void:
	box(Vector3(14.2, .16, 13), Vector3(0, -.02, .1), floor_material, true)
	box(Vector3(14.2, .18, 6), Vector3(0, -.02, 9.5), wood, true)
	box(Vector3(.20, 3.2, 12.8), Vector3(-7, 1.55, .1), wall, true)
	box(Vector3(.20, 3.2, 12.8), Vector3(7, 1.55, .1), wall, true)
	wall_with_windows(-7.0, 7.0, -6.3, [[-5.75, 2.25], [3.18, 2.25]])
	wall_with_windows(-7.0, -4.0, 6.5, [[-6.23, 1.55]])
	wall_with_windows(4.0, 7.0, 6.5, [[4.05, 1.55]])
	box(Vector3(5.2, 3.2, .2), Vector3(0, 1.6, 6.5), wall, true)
	door("terrace-left", Vector3(-4.0, .08, 6.5), 1.4)
	door("terrace-right", Vector3(2.6, .08, 6.5), 1.4)
	for x in [-1.0, 1.0]:
		var section := Node3D.new()
		section.position.x = x
		section.rotation.y = PI * .5
		parent.add_child(section)
		for values in [[-6.5, -3.15], [-1.95, 1.55], [2.75, 6.3]]:
			var start: float = values[0]
			var end: float = values[1]
			box(Vector3(end - start, 3.2, .15), Vector3((start + end) * .5, 1.6, 0), wall, true, section)
		for z in [-3.15, 1.55]:
			box(Vector3(1.2, 1.02, .15), Vector3(z + .6, 2.69, 0), wall, true, section)
			var d := door("hall-%s-%s" % [str(x), str(z)], Vector3(x, .08, -(z + 1.2)), 1.2)
			d.rotation.y = PI * .5
	for x in [-4.0, 4.0]:
		box(Vector3(6.0, 3.2, .14), Vector3(x, 1.6, 0), wall, true)
	box(Vector3(.58, 3.2, .14), Vector3(-.71, 1.6, -2.28), wall, true)
	box(Vector3(.42, 3.2, .14), Vector3(.79, 1.6, -2.28), wall, true)
	box(Vector3(1.0, 1.02, .14), Vector3(.08, 2.69, -2.28), wall, true)
	door("bathroom", Vector3(-.42, .08, -2.28), 1.0)
	box(Vector3(2, 3.2, .15), Vector3(0, 1.6, -6.3), wall, true)
	for x in [-6.88, 6.88]:
		box(Vector3(.06, .16, 12.6), Vector3(x, .14, .1), cream)
	box(Vector3(14, .16, .06), Vector3(0, .14, -6.15), cream)
	# Ceiling panels are visible from inside; the mobile camera remains below them.
	box(Vector3(14.2, .14, 12.8), Vector3(0, 3.24, .1), cream)
	for x in [-4.3, 4.3]:
		var probe := ReflectionProbe.new()
		probe.position = Vector3(x, 1.5, 3)
		probe.size = Vector3(6, 3, 6)
		probe.interior = true
		probe.box_projection = true
		probe.intensity = .55
		parent.add_child(probe)

func wall_with_windows(start: float, end: float, z: float, windows: Array) -> void:
	var current := start
	for values in windows:
		var left: float = values[0]
		var width: float = values[1]
		if left > current:
			box(Vector3(left - current, 3.2, .2), Vector3((current + left) * .5, 1.6, z), wall, true)
		box(Vector3(width, .76, .2), Vector3(left + width * .5, .38, z), wall, true)
		box(Vector3(width, .64, .2), Vector3(left + width * .5, 2.88, z), wall, true)
		window(Vector3(left + width * .5, 1.66, z), width)
		current = left + width
	if current < end:
		box(Vector3(end - current, 3.2, .2), Vector3((current + end) * .5, 1.6, z), wall, true)

func window(at: Vector3, width: float) -> void:
	# Open geometry is used for the glazing rather than an opaque backdrop.
	for x in [-width * .5, 0.0, width * .5]:
		box(Vector3(.048, 1.8, .07), at + Vector3(x, 0, .14), cream)
	for y in [-.90, .90]:
		box(Vector3(width + .10, .055, .12), at + Vector3(0, y, .14), cream)
	box(Vector3(width + .18, .045, .30), at + Vector3(0, -.92, .12), wood)
	for side in [-1, 1]:
		for fold in 7:
			cylinder(.034, 2.05, at + Vector3(side * (width * .5 + .09) + (fold - 3) * .039, -.02, .32), linen)

func door(id: String, at: Vector3, width: float) -> WorldInteractable:
	var object := WorldInteractable.new()
	object.position = at
	parent.add_child(object)
	object.setup(id, "Qapı", "", "door")
	object.marker.position.y = 1.45
	var pivot := Node3D.new()
	object.add_child(pivot)
	object.door_pivot = pivot
	box(Vector3(width, 2.18, .06), Vector3(width * .5, 1.1, 0), wood, true, pivot)
	box(Vector3(width - .16, 1.40, .018), Vector3(width * .5, 1.34, .04), sage, false, pivot)
	cylinder(.027, .15, Vector3(width - .13, 1.05, .085), gold, pivot).rotation.x = PI * .5
	for x in [-.055, width + .055]:
		box(Vector3(.075, 2.30, .14), Vector3(x, 1.14, 0), cream, false, object)
	box(Vector3(width + .18, .075, .14), Vector3(width * .5, 2.29, 0), cream, false, object)
	object.open = Life.world.doors.get(id, false)
	pivot.rotation.y = deg_to_rad(-98) if object.open else 0.0
	objects[id] = object
	for child in pivot.get_children():
		if child is StaticBody3D:
			child.set_meta("interactable", object)
	return object

func living() -> void:
	var sofa := interact("sofa", "Bir az dincəl", "rest", Vector3(-5.28, 0, 3.50), "chair", Vector3(2.30, .72, .92))
	imported("sofa_02", Vector3.ZERO, PI, 1.25, sofa)
	sofa.seat = Vector3(-5.28, -.46, 3.46)
	sofa.seat_yaw = PI
	imported("modern_coffee_table_01", Vector3(-4.50, 0, 1.80), 0, 1.05)
	box(Vector3(2.6, .024, 3.4), Vector3(-4.4, .09, 2.80), fabric)
	var chair := interact("living-chair", "Nağıl oxu", "read", Vector3(-2.0, 0, 4.10), "chair", Vector3(.9, .7, 1.0))
	imported("modern_arm_chair_01", Vector3.ZERO, -.85, 1, chair)
	chair.seat = Vector3(-2.0, -.45, 4.10)
	chair.seat_yaw = -.85
	lamp(Vector3(-6.37, 0, 4.94))
	plant(Vector3(-6.1, 0, .67), 1.4)
	var shelf := interact("books", "Bir nağıl vaxtı", "read", Vector3(-6.55, 0, 1.62), "activity", Vector3(.45, 1.9, 1.24))
	for y in [.22, .70, 1.17, 1.64, 2.12]:
		box(Vector3(.48, .045, 1.22), Vector3(0, y, 0), wood, false, shelf)
		for i in 7:
			box(Vector3(.25, .27 + i % 2 * .04, .075), Vector3(.04, y + .16, -.44 + i * .13), material(["9ba889", "c7ac8b", "c9cbb8"][i % 3]), false, shelf)
	var journal := prop("journal-prop", "Xatirə dəftəri", Vector3(-4.4, .51, 1.7), "journal")
	box(Vector3(.31, .035, .40), Vector3.ZERO, sage, false, journal)
	cup(Vector3(-4.73, .52, 1.73))
	cup(Vector3(-4.33, .52, 2.00))
	interact("cleaning", "Evimizi təzələyək", "clean", Vector3(-2.3, 0, 1.40), "activity", Vector3(.25, .1, .25))
	lamp(Vector3(-4.6, 3.0, 2.8), true)

func kitchen() -> void:
	var counter := interact("counter", "Sevgi ilə bişir", "cook", Vector3(-4.0, 0, -5.60), "activity", Vector3(5.5, .9, .75))
	box(Vector3(5.5, .87, .75), Vector3(0, .46, 0), sage, false, counter)
	box(Vector3(5.60, .065, .84), Vector3(0, .94, 0), cream, false, counter)
	for i in 7:
		var x := -2.33 + i * .76
		box(Vector3(.66, .68, .020), Vector3(x, .47, .386), material("bdc7af"), false, counter)
		box(Vector3(.19, .016, .026), Vector3(x, .75, .41), gold, false, counter)
	box(Vector3(.9, .025, .50), Vector3(-1.1, .99, 0), material("354941", .22), false, counter)
	for x in [-1.32, -.88]:
		for z in [-.15, .15]:
			cylinder(.085, .01, Vector3(x, 1.01, z), material("7e9588", .4), counter)
	var pot := prop("cooking-pot", "Qazan", Vector3(-5.1, 1.04, -5.65), "cook")
	cylinder(.16, .19, Vector3.ZERO, material("98a79f", .24, .72), pot)
	cylinder(.17, .015, Vector3(0, .11, 0), gold, pot)
	box(Vector3(1.45, .93, .70), Vector3(-6.18, .48, -2.60), sage, true)
	var island := interact("island", "Su fasiləsi", "water", Vector3(-3.95, 0, -2.50), "activity", Vector3(2.4, .85, 1.1))
	box(Vector3(2.4, .85, 1.1), Vector3(0, .43, 0), wood, false, island)
	box(Vector3(2.56, .07, 1.2), Vector3(0, .91, 0), cream, false, island)
	for x in [-4.67, -3.20]:
		lamp(Vector3(x, 2.91, -2.54), true)
		cylinder(.21, .055, Vector3(x, .58, -1.64), wood)
		for dx in [-.12, .12]:
			box(Vector3(.035, .54, .035), Vector3(x + dx, .27, -1.65), wood)
	var tap := interact("tap", "Sərin su fasiləsi", "water", Vector3(-2.57, .92, -5.7), "activity", Vector3(.18, .33, .18))
	cylinder(.016, .36, Vector3(0, .14, 0), gold, tap)
	box(Vector3(.015, .018, .19), Vector3(0, .33, .07), gold, false, tap)
	plant(Vector3(-6.15, .98, -5.60), .45)
	var fridge := interact("fridge", "Ərzaq ehtiyatı", "", Vector3(-1.80, 0, -4.70), "pantry", Vector3(.74, 1.9, .80))
	box(Vector3(.74, 1.9, .80), Vector3(0, .95, 0), cream, false, fridge)
	box(Vector3(.025, .50, .04), Vector3(.26, 1.2, .42), gold, false, fridge)

func nursery() -> void:
	var crib := interact("crib", "Beşik", "assemble", Vector3(5.70, 0, -3.88), "activity", Vector3(1.20, 1.1, 1.95))
	box(Vector3(1.12, .10, 1.95), Vector3(0, .46, 0), wood, false, crib)
	box(Vector3(1.05, .10, 1.82), Vector3(0, .56, 0), cream, false, crib)
	for x in [-.56, .56]:
		for i in 12:
			cylinder(.015, .65, Vector3(x, .92, -.89 + i * .16), wood, crib)
		box(Vector3(.052, .044, 1.96), Vector3(x, 1.27, 0), wood, false, crib)
	for z in [-.96, .96]:
		box(Vector3(1.18, .055, .052), Vector3(0, 1.27, z), wood, false, crib)
		for x in [-.52, .52]:
			box(Vector3(.04, 1.18, .04), Vector3(x, .63, z), wood, false, crib)
	var chair := interact("nursery-chair", "Qayğı kreslosu", "feed", Vector3(2.22, 0, -4.65), "chair", Vector3(.85, .68, 1.0))
	imported("modern_arm_chair_01", Vector3.ZERO, .40, 1.10, chair)
	chair.seat = Vector3(2.22, -.40, -4.60)
	chair.seat_yaw = .4
	imported("modern_coffee_table_01", Vector3(3.45, 0, -4.67), 0, .60)
	lamp(Vector3(1.47, 0, -5.3))
	var dresser := interact("dresser", "Dəyişmə guşəsi", "diaper", Vector3(4.25, 0, -5.70), "activity", Vector3(1.7, .91, .68))
	box(Vector3(1.7, .91, .68), Vector3(0, .46, 0), cream, false, dresser)
	box(Vector3(1.76, .07, .74), Vector3(0, .96, 0), wood, false, dresser)
	for y in [.23, .49, .76]:
		box(Vector3(1.54, .20, .025), Vector3(0, y, .35), material("ddd6c3"), false, dresser)
		for x in [-.45, .45]:
			cylinder(.027, .026, Vector3(x, y, .38), gold, dresser).rotation.x = PI * .5
	box(Vector3(1.03, .045, .50), Vector3(0, 1.02, 0), fabric, false, dresser)
	var mat := interact("playmat", "Balacamla oyun", "play", Vector3(3.48, 0, -1.66), "activity", Vector3(1.26, .04, 1.26))
	box(Vector3(1.26, .025, 1.26), Vector3(0, .085, 0), fabric, false, mat)
	for i in 3:
		var toy := prop("toy-%d" % i, "Taxta oyuncaq", Vector3(3.12 + i * .23, .15, -1.78))
		box(Vector3(.13, .13, .13), Vector3.ZERO, material(["c7ae89", "9bae8c", "d7c7a7"][i]), false, toy)
	plant(Vector3(6.23, 0, -5.62), 1.25)
	lamp(Vector3(3.83, 2.95, -3.60), true)

func bedroom() -> void:
	var bed := interact("bed", "Dincəl", "rest", Vector3(4.3, 0, 4.2), "chair", Vector3(2.3, .66, 2.7))
	box(Vector3(2.3, .26, 2.7), Vector3(0, .21, 0), wood, false, bed)
	box(Vector3(2.20, .25, 2.6), Vector3(0, .45, 0), cream, false, bed)
	box(Vector3(2.2, .07, 1.82), Vector3(0, .62, .33), fabric, false, bed)
	box(Vector3(2.34, 1.03, .13), Vector3(0, .74, -1.34), wood, false, bed)
	for x in [-.57, .57]:
		ball(Vector3(.41, .08, .24), Vector3(x, .66, -.84), cream, bed)
	bed.seat = Vector3(4.3, -.35, 4.1)
	bed.seat_yaw = 0
	for x in [2.65, 5.98]:
		box(Vector3(.67, .62, .57), Vector3(x, .32, 3.27), wood, true)
		lamp(Vector3(x, .63, 3.27))
	var laundry := interact("laundry", "Paltarların qayğısı", "laundry", Vector3(1.67, 0, 4.10), "activity", Vector3(.55, .47, .55))
	cylinder(.29, .45, Vector3(0, .25, 0), fabric, laundry)
	var wardrobe := interact("wardrobe", "Geyim / ailə", "", Vector3(6.4, 0, 1.6), "family", Vector3(.7, 2.2, 2.0))
	box(Vector3(.7, 2.2, 2.0), Vector3(0, 1.1, 0), wood, false, wardrobe)
	plant(Vector3(2.12, 0, 5.53), 1.1)
	lamp(Vector3(4.1, 2.95, 2.7), true)

func bathroom() -> void:
	box(Vector3(1.82, .045, 3.8), Vector3(0, .08, -4.40), stone)
	var bath := interact("bath", "Hamam", "bath", Vector3(0, 0, -5.35), "activity", Vector3(1.15, .7, 1.55))
	box(Vector3(1.1, .57, 1.54), Vector3(0, .34, 0), cream, false, bath)
	box(Vector3(.86, .015, 1.27), Vector3(0, .64, 0), material("a8c4bc", .17), false, bath)
	var test := prop("pregnancy-test", "Hamiləlik testi", Vector3(.38, 1.0, -3.30), "test")
	box(Vector3(.20, .024, .035), Vector3.ZERO, cream, false, test)
	box(Vector3(.05, .003, .027), Vector3(.035, .016, 0), sage, false, test)
	box(Vector3(.67, .91, .54), Vector3(.34, .48, -3.25), wood, true)
	ball(Vector3(.23, .056, .17), Vector3(.34, .98, -3.25), cream)
	var mirror := cylinder(.38, .021, Vector3(.75, 1.8, -3.26), material("b2c5bd", .06, .65))
	mirror.rotation.z = PI * .5
	lamp(Vector3(0, 2.95, -4.3), true)

func terrace() -> void:
	for x in [-7.0, 7.0]:
		box(Vector3(.09, 1.12, 5.8), Vector3(x, .55, 9.35), wood, true)
	box(Vector3(14, .04, .10), Vector3(0, 1.05, 12.2), gold)
	for x in [-6.0, -4.0, -2.0, 0.0, 2.0, 4.0, 6.0]:
		box(Vector3(.035, 1.03, .035), Vector3(x, .51, 12.2), gold)
	var table := interact("terrace-table", "Nəfəs və ailə vaxtı", "breathe", Vector3(-3.3, 0, 9.6), "activity", Vector3(1.1, .7, 1.1))
	imported("modern_coffee_table_01", Vector3.ZERO, 0, 1.1, table)
	cup(Vector3(-3.20, .56, 9.59))
	imported("modern_arm_chair_01", Vector3(-4.8, 0, 10.2), PI * .6)
	imported("modern_arm_chair_01", Vector3(-1.8, 0, 10.2), -PI * .6)
	var planter := interact("planter", "Çiçəklərin qayğısı", "plant", Vector3(5.60, 0, 10.45), "activity", Vector3(.95, .45, .55))
	box(Vector3(.95, .38, .55), Vector3(0, .23, 0), wood, false, planter)
	for i in 4:
		plant(Vector3(5.24 + i * .22, .4, 10.45), .34)
	interact("garden-walk", "Bağda gəzinti", "walk", Vector3(.5, 0, 10.2), "activity", Vector3(.3, .01, .3))
	for x in [-6.2, 6.3]:
		plant(Vector3(x, 0, 7.6), 1.4)

func neighbourhood() -> void:
	building("market", Vector3(17, 0, -2), Vector2(8, 8), Color("cad1b9"))
	building("cafe", Vector3(-17.5, 0, -2), Vector2(9, 8), Color("dbd5c3"))
	building("clinic", Vector3(17, 0, 14.5), Vector2(10, 9), Color("c3d0c5"))
	var market := interact("market-checkout", "Ərzaq al", "groceries", Vector3(17, 0, -3.7), "activity", Vector3(5, .9, .80))
	box(Vector3(5, .9, .80), Vector3(0, .47, 0), sage, false, market)
	box(Vector3(5.1, .055, .87), Vector3(0, .96, 0), wood, false, market)
	for x in [14.0, 20.0]:
		for y in [.34, .92, 1.50, 2.08]:
			box(Vector3(.67, .05, 5.2), Vector3(x, y, -2.8), wood)
			for i in 10:
				ball(Vector3(.075, .075, .075), Vector3(x, y + .11, -4.90 + i * .45), material("bba06c" if i % 2 else "93a274"))
	var cafe := interact("coffee-machine", "Qəhvə ritualı", "coffee", Vector3(-17.5, 0, -4), "activity", Vector3(4.5, .94, .75))
	box(Vector3(4.5, .94, .75), Vector3(0, .47, 0), wood, false, cafe)
	box(Vector3(.93, .45, .50), Vector3(0, 1.18, 0), material("7e8e82", .3, .5), false, cafe)
	for x in [-20.0, -15.5]:
		imported("modern_coffee_table_01", Vector3(x, 0, .15), 0, .8)
		imported("modern_arm_chair_01", Vector3(x, 0, 1.1), PI)
		cup(Vector3(x, .42, .15))
	var clinic := interact("scanner", "Ultrasəs / klinika", "scan", Vector3(15.0, 0, 15.3), "activity", Vector3(1.3, .72, 2.2))
	box(Vector3(1.3, .30, 2.2), Vector3(0, .43, 0), sage, false, clinic)
	box(Vector3(1.25, .17, 2.12), Vector3(0, .68, 0), cream, false, clinic)
	var birth := interact("birthbed", "Doğuş və körpə qayğısı", "birth", Vector3(19.0, 0, 15.5), "activity", Vector3(1.60, .90, 2.4))
	box(Vector3(1.60, .28, 2.4), Vector3(0, .48, 0), sage, false, birth)
	box(Vector3(1.50, .19, 2.3), Vector3(0, .72, 0), cream, false, birth)
	interact("doctor", "Həkimin qeydləri", "checkup", Vector3(16.0, 0, 12.0), "activity", Vector3(1.1, .8, .60))
	interact("carseat", "İlk yolculuq", "carseat", Vector3(20.0, 0, 11.2), "activity", Vector3(.58, .50, .68))
	for position in [Vector3(14, 0, -5.2), Vector3(-21, 0, -5.2), Vector3(21, 0, 18)]:
		plant(position, 1.3)
	var promenade := interact("promenade", "Luzern göl gəzintisi", "lakesideWalk", Vector3(-9, 0, 21), "activity", Vector3(.15, .02, .15))
	promenade.radius = 3.0
	box(Vector3(32, .09, 4), Vector3(-12, -.02, 21), stone, true)
	for x in [-23.0, -15.0, -7.0]:
		box(Vector3(2.1, .10, .60), Vector3(x, .50, 19.8), wood, true)
		box(Vector3(2.1, .55, .065), Vector3(x, .80, 19.56), wood)
		lamp(Vector3(x + 2, 0, 20.8))
	# A wooden lakeside footbridge is built as real geometry.
	box(Vector3(2.3, .13, 24), Vector3(-25, .10, 36), wood, true)
	for z in range(25, 49, 3):
		for x in [-26.1, -23.9]:
			box(Vector3(.12, 3.0, .12), Vector3(x, 1.40, z), wood)
		box(Vector3(2.5, .10, .10), Vector3(-25, 2.84, z), wood)
	box(Vector3(2.7, .10, 24), Vector3(-25, 3.01, 36), material("7d715d"))

func building(id: String, at: Vector3, size: Vector2, colour: Color) -> void:
	var mat := wall.duplicate()
	mat.albedo_color = colour
	box(Vector3(size.x, .12, size.y), at, wood, true)
	for x in [-size.x * .5, size.x * .5]:
		box(Vector3(.18, 3.4, size.y), at + Vector3(x, 1.7, 0), mat, true)
	box(Vector3(size.x, 3.4, .18), at + Vector3(0, 1.7, -size.y * .5), mat, true)
	for x in [-size.x * .32, size.x * .32]:
		box(Vector3(size.x * .32, 3.4, .18), at + Vector3(x, 1.7, size.y * .5), mat, true)
	box(Vector3(size.x, .12, size.y), at + Vector3(0, 3.45, 0), cream)
	door(id + "-door", at + Vector3(-.68, 0, size.y * .5), 1.36)
	var sign := Label3D.new()
	sign.text = {"market": "QUARTIERMARKT", "cafe": "LAKE CAFÉ", "clinic": "ANACAN CLINIC"}[id]
	sign.font_size = 48
	sign.pixel_size = .008
	sign.position = at + Vector3(0, 2.62, size.y * .5 + .12)
	parent.add_child(sign)
	lamp(at + Vector3(0, 3.12, 0), true)

func prop(id: String, title: String, at: Vector3, activity := "") -> WorldInteractable:
	var object := WorldInteractable.new()
	object.position = at
	parent.add_child(object)
	object.setup(id, title, activity, "prop")
	object.marker.position.y = .17
	object.carry_origin = object.transform
	objects[id] = object
	return object

func update_household() -> void:
	var key := JSON.stringify([Life.state.household.groceries, Life.state.household.laundry, int(Life.state.household.cleanliness) / 10])
	if key == household_key:
		return
	household_key = key
	for child in dynamic.get_children():
		dynamic.remove_child(child)
		child.queue_free()
	for product in Life.definitions.groceries:
		for i in mini(5, int(Life.state.household.groceries[product.id])):
			var at := Vector3(-6.35 + float(i % 3) * .15, 1.00 + float(i / 3) * .08, -2.65 + float(Life.definitions.groceries.find(product)) * .14)
			if product.id in ["fruit", "vegetables"]:
				ball(Vector3(.07, .065, .065), at, material(str(product.colour)), dynamic)
			else:
				cylinder(.053, .18, at + Vector3(0, .05, 0), cream, dynamic)
	for i in mini(6, int(Life.state.household.laundry.dirty)):
		box(Vector3(.26, .035, .20), Vector3(1.67, .45 + i * .028, 4.1), fabric, false, dynamic).rotation.y = i * .7
	for i in mini(6, int(Life.state.household.laundry.folded)):
		box(Vector3(.33, .035, .27), Vector3(6.32, 1.2 + i * .043, 1.7), cream, false, dynamic)
	for i in mini(7, int((100.0 - float(Life.state.household.cleanliness)) / 12)):
		ball(Vector3(.055, .016, .042), Vector3(-3.0 - i % 3 * .4, .13, 3.0 + i * .33), material("bcb39a"), dynamic)
	objects.crib.action = "lullaby" if Life.state.pregnancy.born else "assemble" if int(Life.state.chapter) >= 6 else "read"
	objects.dresser.action = "diaper" if Life.state.pregnancy.born else "pack"
	objects["nursery-chair"].action = "feed" if Life.state.pregnancy.born else "read"
	objects.playmat.action = "play" if Life.state.pregnancy.born else "tidy"
	baby.visible = Life.state.pregnancy.born and int(Life.state.chapter) < 12
	if baby.get_parent() == parent:
		baby.position = Vector3(19.0, .93, 15.50) if Life.state.location == "clinic" else Vector3(5.70, .73, -3.90)
		baby.rotation.x = PI * .5
	toddler.visible = Life.state.pregnancy.born and int(Life.state.chapter) >= 12
	var child_positions := {"home": Vector3(3.45, .11, -1.66), "market": Vector3(18.24, .10, .88), "cafe": Vector3(-16.11, .10, .84), "clinic": Vector3(18.1, .11, 12.7), "lakeside": Vector3(-8.50, .10, 21.1)}
	toddler.position = child_positions.get(Life.state.location, toddler.position)
	toddler.animate_state(0.0, "rest" if int(Life.state.chapter) == 12 else "")

func make_baby() -> Node3D:
	var child := Node3D.new()
	var skin := material(str(Life.state.avatar.skin), .65)
	ball(Vector3(.105, .17, .085), Vector3(0, .14, 0), cream, child)
	ball(Vector3(.10, .105, .095), Vector3(0, .36, 0), skin, child)
	for x in [-.034, .034]:
		ball(Vector3(.017, .003, .006), Vector3(x, .374, .09), material("4a3c33"), child)
		ball(Vector3(.021, .01, .005), Vector3(x * 1.8, .34, .081), material("daa78d"), child)
	return child

func update_light() -> void:
	var day := maxf(0, sin((float(Life.state.time) - 360.0) / 840.0 * PI))
	var weather := .48 if Life.state.household.weather == "rain" else .72 if Life.state.household.weather == "cloudy" else 1.0
	sunlight.light_energy = .09 + day * weather * 1.10
	environment.ambient_light_energy = .20 + day * .26
	for light in lights:
		light.light_energy = .18 + (1.0 - day) * .75

func batch_static_geometry() -> void:
	var buckets: Dictionary = {}
	var meshes: Array[MeshInstance3D] = []
	collect_static(parent, meshes)
	for node in meshes:
		if not node.mesh or node.material_override is ShaderMaterial or node.mesh.get_surface_count() != 1:
			continue
		var material: Material = node.get_active_material(0)
		if material == null or material is BaseMaterial3D and material.transparency != BaseMaterial3D.TRANSPARENCY_DISABLED:
			continue
		var at := node.global_position
		var region := Vector2i(floori(at.x / 12.0), floori(at.z / 12.0))
		for surface in node.mesh.get_surface_count():
			material = node.get_active_material(surface)
			var bones: Variant = node.mesh.surface_get_arrays(surface)[Mesh.ARRAY_BONES]
			if material == null or bones != null and bones.size() > 0:
				continue
			var key := "%s:%d" % [str(region), material.get_instance_id()]
			if not buckets.has(key):
				var tool := SurfaceTool.new()
				tool.begin(Mesh.PRIMITIVE_TRIANGLES)
				buckets[key] = {"tool": tool, "material": material, "members": []}
			buckets[key].tool.append_from(node.mesh, surface, parent.global_transform.affine_inverse() * node.global_transform)
			buckets[key].members.append(node)
	var removed: Dictionary = {}
	for key in buckets:
		var bucket: Dictionary = buckets[key]
		if bucket.members.size() < 3:
			continue
		bucket.tool.set_material(bucket.material)
		var combined: ArrayMesh = bucket.tool.commit()
		var batch := mesh(combined, Vector3.ZERO, bucket.material)
		batch.name = "StaticBatch%d" % static_batches
		static_batches += 1
		for node in bucket.members:
			if not removed.has(node):
				removed[node] = true
				node.visible = false
				node.queue_free()

func collect_static(node: Node, found: Array[MeshInstance3D]) -> void:
	if node is WorldInteractable or node is FamilyActor or node == dynamic or node.has_meta("keep_dynamic"):
		return
	if node is MeshInstance3D and node.cast_shadow != GeometryInstance3D.SHADOW_CASTING_SETTING_OFF:
		found.append(node)
	for child in node.get_children():
		collect_static(child, found)

func zone(position: Vector3) -> String:
	for room in room_bounds:
		if room_bounds[room].has_point(Vector2(position.x, position.z)):
			return room
	return "town"
