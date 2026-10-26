class_name InteriorDetails
extends Node

var b: WorldBuilder
var washing_drum: Node3D
var wash_light: MeshInstance3D
var cooker_light: MeshInstance3D
var refrigerator_door: Node3D
var taps: Array[Node3D] = []
var dust_spots: Array[MeshInstance3D] = []
var drying_rack: Node3D
var mobile: Node3D
var task_props: Node3D

func build(builder: WorldBuilder) -> void:
	b = builder
	room_finish()
	living()
	kitchen()
	nursery()
	bedroom()
	bathroom()
	terrace()
	town()

func soft_box(size: Vector3, at: Vector3, material: Material, parent: Node3D = b.parent) -> MeshInstance3D:
	var sphere := SphereMesh.new()
	sphere.radius = .5
	sphere.height = 1.0
	sphere.radial_segments = 24
	sphere.rings = 12
	var node := b.mesh(sphere, at, material, parent)
	node.scale = size
	return node

func torus(radius: float, thickness: float, at: Vector3, material: Material, parent: Node3D = b.parent) -> MeshInstance3D:
	var shape := TorusMesh.new()
	shape.inner_radius = radius - thickness
	shape.outer_radius = radius + thickness
	shape.rings = 20
	shape.ring_segments = 8
	return b.mesh(shape, at, material, parent)

func print_frame(at: Vector3, width: float, height: float, angle := 0.0) -> void:
	var group := Node3D.new()
	group.position = at
	group.rotation.y = angle
	b.parent.add_child(group)
	b.box(Vector3(width + .08, height + .08, .046), Vector3.ZERO, b.wood, false, group)
	var shape := QuadMesh.new()
	shape.size = Vector2(width, height)
	var artwork := StandardMaterial3D.new()
	artwork.albedo_texture = load("res://assets/details/alpine-print.jpg")
	artwork.roughness = 1
	b.mesh(shape, Vector3(0, 0, .029), artwork, group)

func towel(at: Vector3, colour: Color, parent: Node3D = b.parent) -> void:
	var material: StandardMaterial3D = b.linen.duplicate()
	material.albedo_color = colour
	soft_box(Vector3(.43, .067, .30), at, material, parent)
	b.box(Vector3(.34, .008, .25), at + Vector3(0, .026, 0), material, false, parent)

func label3d(text: String, at: Vector3, size := 20, parent: Node3D = b.parent) -> Label3D:
	var node := Label3D.new()
	node.text = text
	node.position = at
	node.font_size = size
	node.pixel_size = .0023
	node.modulate = Color("526451")
	node.outline_size = 0
	parent.add_child(node)
	return node

func room_finish() -> void:
	var trim := b.material("e8e4d9")
	for x in [-6.86, 6.86]:
		b.box(Vector3(.055, .20, 12.6), Vector3(x, .19, .1), trim)
		b.box(Vector3(.09, .045, 12.6), Vector3(x, 3.08, .1), trim)
	for z in [-6.13, 6.31]:
		b.box(Vector3(13.7, .20, .046), Vector3(0, .18, z), trim)
		b.box(Vector3(13.7, .06, .10), Vector3(0, 3.08, z), trim)
	# Differentiated matte paint in the nursery and bedroom.
	var sage := b.material("c3ccb9")
	b.box(Vector3(5.74, .96, .022), Vector3(4.0, .63, -6.13), sage)
	for x in [1.27, 2.07, 2.87, 3.67, 4.47, 5.27, 6.07, 6.73]:
		b.box(Vector3(.028, .92, .017), Vector3(x, .62, -6.105), trim)
	b.box(Vector3(5.74, .05, .039), Vector3(4.0, 1.13, -6.10), trim)
	print_frame(Vector3(-6.85, 1.99, 3.9), 1.16, .81, PI * .5)
	print_frame(Vector3(6.84, 1.91, 3.8), .98, .70, -PI * .5)
	print_frame(Vector3(1.94, 1.96, -6.12), .58, .75)
	# Actual clear glazing. Surface is deliberately excluded from shadow casting.
	var glass := StandardMaterial3D.new()
	glass.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	glass.albedo_color = Color(.83, .94, .95, .07)
	glass.roughness = .12
	glass.cull_mode = BaseMaterial3D.CULL_DISABLED
	for at in [Vector3(-4.625, 1.66, -6.20), Vector3(4.305, 1.66, -6.20), Vector3(-5.455, 1.66, 6.47), Vector3(4.825, 1.66, 6.47)]:
		var plane := QuadMesh.new()
		plane.size = Vector2(2.20 if at.z < 0 else 1.48, 1.77)
		var pane := b.mesh(plane, at, glass)
		pane.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	# Long runner grounds the hallway and makes navigation legible.
	var runner: StandardMaterial3D = b.linen.duplicate()
	runner.albedo_color = Color("b8b29c")
	b.box(Vector3(1.32, .019, 4.34), Vector3(0, .078, 1.83), runner)
	for x in [-.65, .65]:
		b.box(Vector3(.028, .003, 4.30), Vector3(x, .089, 1.83), trim)

func living() -> void:
	var sofa: WorldInteractable = b.objects.sofa
	for side in [-1, 1]:
		var cushion := soft_box(Vector3(.60, .43, .18), Vector3(side * .74, .70, .12), b.linen, sofa)
		cushion.rotation = Vector3(.10, 0, side * .13)
	var throw: StandardMaterial3D = b.linen.duplicate()
	throw.albedo_color = Color("aebc9f")
	soft_box(Vector3(.52, .067, .78), Vector3(.81, .50, -.08), throw, sofa)
	b.box(Vector3(.47, .38, .019), Vector3(.83, .28, -.41), throw, false, sofa)
	# Cabinet and small meaningful props turn a sparse room into a lived-in home.
	var shelf: WorldInteractable = b.objects.books
	for z in [-.62, .62]:
		b.box(Vector3(.055, 2.23, .055), Vector3(-.23, 1.15, z), b.wood, false, shelf)
	b.box(Vector3(.04, 2.17, 1.19), Vector3(-.21, 1.14, 0), b.wood, false, shelf)
	var vase := b.imported("ceramic_vase_01", Vector3(-4.35, .57, 2.00), 0, .50)
	for i in 5:
		var stem := b.cylinder(.003, .28, Vector3(-4.35 + sin(i * 2.4) * .045, .91, 2.0 + cos(i * 2.4) * .045), b.material("748865"))
		stem.rotation.z = sin(i) * .13
		soft_box(Vector3(.051, .020, .048), stem.position + Vector3(0, .15, 0), b.material("d8c4a0"))
	b.box(Vector3(.45, .40, 1.52), Vector3(-6.37, .30, 5.8), b.wood, true)
	towel(Vector3(-6.29, .56, 5.92), Color("dad5bf"))
	var remote := b.prop("remote", "Pult", Vector3(-4.69, .56, 1.49))
	b.box(Vector3(.052, .025, .19), Vector3.ZERO, b.material("3b433d"), false, remote)
	for row in 4:
		b.cylinder(.005, .003, Vector3(0, .014, -.054 + row * .025), b.cream, remote)
	label3d("LEYLA'S HOME", Vector3(-6.05, .62, 5.81), 12)

func kitchen() -> void:
	var counter: WorldInteractable = b.objects.counter
	# Oven with a real inset, handles and readable controls.
	b.box(Vector3(.68, .53, .024), Vector3(-1.08, .46, .399), b.material("323d37", .21, .25), false, counter)
	b.box(Vector3(.56, .35, .014), Vector3(-1.08, .43, .417), b.material("59685e", .18, .40), false, counter)
	b.box(Vector3(.56, .024, .045), Vector3(-1.08, .72, .446), b.gold, false, counter)
	for x in [-1.33, -1.08, -.83]:
		var knob := b.cylinder(.022, .023, Vector3(x, .78, .424), b.material("b4b7a7", .35, .65), counter)
		knob.rotation.x = PI * .5
	# Herringbone backsplash has physical seams, restrained texture scale.
	for row in 5:
		for column in 14:
			var tile := b.box(Vector3(.35, .082, .012), Vector3(-2.45 + column * .35, 1.08 + row * .085, -.39), b.material("e4e3d8", .42), false, counter)
	b.box(Vector3(1.04, .12, .59), Vector3(-1.08, 2.38, -.04), b.cream, false, counter)
	b.box(Vector3(.41, .68, .30), Vector3(-1.08, 2.74, -.20), b.cream, false, counter)
	var sink := b.material("a9b8ae", .28, .6)
	soft_box(Vector3(.71, .039, .49), Vector3(1.41, .985, -.05), sink, counter)
	torus(.23, .011, Vector3(-1.08, 1.008, 0), b.material("4b5c52", .28), counter)
	cooker_light = b.box(Vector3(.036, .008, .021), Vector3(-1.38, 1.011, .18), b.material("867665"), false, counter)
	var pot: WorldInteractable = b.objects["cooking-pot"]
	for side in [-1, 1]:
		b.box(Vector3(.10, .022, .038), Vector3(side * .18, .026, 0), b.material("545e52"), false, pot)
	# A fixed prep board and knife are also the interaction targets for cooking.
	var prep := b.interact("prep-board", "Ərzaqları hazırla", "cook", Vector3(-4.17, 1.005, -5.38), "activity", Vector3(.52, .05, .38))
	b.box(Vector3(.52, .029, .38), Vector3.ZERO, b.wood, false, prep)
	var knife := b.prop("knife", "Mətbəx bıçağı", Vector3(-4.06, 1.044, -5.40))
	b.box(Vector3(.027, .014, .18), Vector3.ZERO, b.material("c2c6be", .2, .8), false, knife)
	b.box(Vector3(.033, .021, .11), Vector3(0, 0, .135), b.material("677056"), false, knife)
	b.imported("wooden_bowl_02", Vector3(-3.73, .965, -2.60), 0, .85)
	for i in 3:
		b.imported("food_apple_01", Vector3(-3.72 + sin(i * 2.4) * .07, 1.08, -2.60 + cos(i * 2.4) * .07), i * .4, .92)
	# Upper oak shelving and pantry jars.
	for y in [1.71, 2.13]:
		b.box(Vector3(1.50, .034, .25), Vector3(-5.97, y, -5.93), b.wood)
		for i in 4:
			b.cylinder(.061, .19, Vector3(-6.50 + i * .32, y + .115, -5.94), b.material("ddd5bd", .38))
			b.cylinder(.064, .020, Vector3(-6.50 + i * .32, y + .22, -5.94), b.wood)
	label3d("OATS  /  TEA  /  RICE", Vector3(-5.96, 1.50, -5.50), 16)

func nursery() -> void:
	var crib: WorldInteractable = b.objects.crib
	var mobile_mat := b.material("c2a47b")
	b.cylinder(.013, 1.50, Vector3(-.58, 1.65, -.64), b.gold, crib)
	mobile = Node3D.new()
	mobile.set_meta("keep_dynamic", true)
	mobile.position = Vector3(5.67, 2.41, -4.30)
	b.parent.add_child(mobile)
	torus(.24, .009, Vector3.ZERO, mobile_mat, mobile)
	for i in 4:
		var at := Vector3(sin(i * PI * .5) * .21, -.14, cos(i * PI * .5) * .21)
		b.cylinder(.002, .25, at, b.cream, mobile)
		soft_box(Vector3(.078, .081, .018), at - Vector3(0, .15, 0), mobile_mat, mobile)
	var dresser: WorldInteractable = b.objects.dresser
	towel(Vector3(-.60, 1.047, 0), Color("bdc8af"), dresser)
	towel(Vector3(-.60, 1.092, 0), Color("e4dcc7"), dresser)
	for i in 3:
		b.cylinder(.031, .12, Vector3(.61, 1.08, -.15 + i * .11), b.cream, dresser)
	var basket := b.imported("wicker_basket_02", Vector3(5.99, .10, -1.28), .2, .86)
	print_frame(Vector3(6.86, 1.82, -2.83), .65, .87, -PI * .5)
	soft_box(Vector3(.43, .44, .095), Vector3(2.28, .78, -4.95), b.linen)

func bedroom() -> void:
	var bed: WorldInteractable = b.objects.bed
	var blanket: StandardMaterial3D = b.linen.duplicate()
	blanket.albedo_color = Color("b0bdad")
	b.box(Vector3(2.24, .046, 1.87), Vector3(0, .653, .33), blanket, false, bed)
	# Slightly irregular folds silhouette rather than a solid flat cuboid.
	for i in 11:
		soft_box(Vector3(.10, .035, 1.88), Vector3(-1.02 + i * .2, .67 + sin(i) * .006, .33), blanket, bed)
	for x in [-.57, .57]:
		soft_box(Vector3(.79, .155, .47), Vector3(x, .70, -.89), b.linen, bed)
	var hamper: WorldInteractable = b.objects.laundry
	b.imported("wicker_basket_02", Vector3.ZERO, .10, .96, hamper)
	print_frame(Vector3(4.09, 1.91, .08), .82, 1.07, PI)
	var journal := b.prop("bedside-book", "Bir kitab vaxtı", Vector3(2.61, .676, 3.34), "read")
	b.box(Vector3(.27, .037, .36), Vector3.ZERO, b.material("a9b296"), false, journal)
	towel(Vector3(6.33, 1.27, 1.7), Color("d3cab5"))

func bathroom() -> void:
	# Washer faces the player in the hallway instead of being hidden in a panel.
	var washer := b.interact("washer", "Yuma maşını", "laundry", Vector3(2.0, .10, 1.15), "activity", Vector3(.65, .86, .67))
	b.box(Vector3(.65, .86, .67), Vector3(0, .43, 0), b.cream, false, washer)
	b.box(Vector3(.59, .107, .013), Vector3(0, .76, .346), b.material("d8ded0"), false, washer)
	label3d("30°  ECO", Vector3(-.12, .765, .357), 17, washer)
	washing_drum = Node3D.new()
	washing_drum.position = Vector3(0, .40, .353)
	washer.add_child(washing_drum)
	var rim := torus(.20, .025, Vector3.ZERO, b.material("afb9ad", .28, .6), washing_drum)
	rim.rotation.x = PI * .5
	var drum := b.cylinder(.177, .017, Vector3.ZERO, b.material("42564e", .22, .5), washing_drum)
	drum.rotation.x = PI * .5
	for i in 3:
		soft_box(Vector3(.11, .046, .036), Vector3(sin(i * 2.1) * .09, cos(i * 2.1) * .09, .02), b.linen, washing_drum)
	wash_light = b.box(Vector3(.024, .009, .009), Vector3(.23, .76, .355), b.material("879577"), false, washer)
	for y in [.64, 1.03, 1.42, 1.81, 2.20]:
		b.box(Vector3(.029, .017, 3.25), Vector3(-.84, y, -4.35), b.material("d8ddd2"))
	var towel_rail := b.box(Vector3(.032, .034, .73), Vector3(-.75, 1.38, -3.50), b.gold)
	b.box(Vector3(.023, .42, .48), Vector3(-.71, 1.17, -3.48), b.linen)
	var soap := b.prop("soap", "Yumşaq sabun", Vector3(.58, 1.025, -3.20))
	soft_box(Vector3(.095, .026, .068), Vector3.ZERO, b.material("c3d0bd"), soap)
	b.cylinder(.011, .27, Vector3(.31, 1.05, -3.45), b.gold)
	b.box(Vector3(.012, .021, .10), Vector3(.31, 1.19, -3.40), b.gold)

func terrace() -> void:
	drying_rack = Node3D.new()
	drying_rack.set_meta("keep_dynamic", true)
	drying_rack.position = Vector3(3.45, .10, 9.54)
	b.parent.add_child(drying_rack)
	for x in [-.57, .57]:
		for z in [-.40, .40]:
			var leg := b.box(Vector3(.014, 1.0, .014), Vector3(x, .48, z), b.gold, false, drying_rack)
			leg.rotation.x = .18 if z > 0 else -.18
	for z in [-.38, -.20, -.02, .16, .34]:
		b.box(Vector3(1.16, .014, .014), Vector3(0, .98, z), b.gold, false, drying_rack)
	var table := b.objects["terrace-table"] as WorldInteractable
	b.imported("ceramic_vase_01", table.position + Vector3(0, .59, 0), .2, .41)
	var outdoor := b.material("a8b49c")
	b.box(Vector3(3.4, .017, 2.32), Vector3(-3.3, .11, 9.6), outdoor)
	for i in 12:
		b.box(Vector3(.026, .002, 2.32), Vector3(-4.86 + i * .28, .121, 9.6), b.cream)

func town() -> void:
	# Store produce is recognisable model geometry and batched by the scene builder.
	for x in [14.0, 20.0]:
		for i in 6:
			b.imported("food_apple_01", Vector3(x, 1.06, -4.67 + i * .50), i * .42, 1.04)
		label3d("SEASONAL FRUIT   CHF 3.60", Vector3(x, 1.38, -2.80), 16)
	# Entry mat, canopy, mullions and pavement edging avoid the blocky building look.
	for info in [[Vector3(17, 0, -2), 8.0, 8.0], [Vector3(-17.5, 0, -2), 9.0, 8.0], [Vector3(17, 0, 14.5), 10.0, 9.0]]:
		var at: Vector3 = info[0]
		var width: float = info[1]
		var depth: float = info[2]
		b.box(Vector3(2.5, .11, 1.45), at + Vector3(0, 2.50, depth * .5 + .62), b.sage)
		b.box(Vector3(1.83, .014, 1.09), at + Vector3(0, .08, depth * .5 + .74), b.material("929d82"))
		for x in [-width * .5 + .15, width * .5 - .15]:
			b.box(Vector3(.12, .25, depth), at + Vector3(x, .22, 0), b.cream)
		b.box(Vector3(width + .22, .12, depth + .20), at + Vector3(0, 3.45, 0), b.material("beb5a1"))
	# Real crib station and changing pad at the clinic.
	var birth: WorldInteractable = b.objects.birthbed
	for x in [-.58, .58]:
		soft_box(Vector3(.20, .15, .49), Vector3(x, .82, -.75), b.linen, birth)
		b.box(Vector3(.041, .041, 1.85), Vector3(x * 1.30, 1.02, 0), b.gold, false, birth)
	var changing := b.interact("clinic-changing", "Bez qayğısı", "diaper", Vector3(20.66, .06, 17.55), "activity", Vector3(1.30, .91, .66))
	b.box(Vector3(1.30, .86, .66), Vector3(0, .46, 0), b.cream, false, changing)
	towel(Vector3(0, .93, 0), Color("c6ceb5"), changing)
	print_frame(Vector3(17.25, 2.00, 10.10), 1.18, .78, PI)

func tick(delta: float) -> void:
	if mobile and not Life.state.settings.reducedMotion:
		mobile.rotation.y += delta * .12
	if washing_drum and Life.state.activity != null and Life.state.activity.id == "laundry":
		washing_drum.rotation.z += delta * 1.4

func wash_running(value: bool) -> void:
	if wash_light:
		var material: StandardMaterial3D = b.material("9ead85").duplicate()
		material.emission_enabled = value
		material.emission = Color("87af60")
		wash_light.material_override = material
