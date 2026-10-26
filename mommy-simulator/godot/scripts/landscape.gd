class_name AlpineLandscape
extends RefCounted

var builder: WorldBuilder
var noise := FastNoiseLite.new()
var random := RandomNumberGenerator.new()
var foliage: ShaderMaterial

func build(world: WorldBuilder) -> void:
	builder = world
	noise.seed = 7449
	noise.frequency = .033
	noise.fractal_octaves = 4
	noise.fractal_gain = .52
	noise.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
	random.seed = 47027
	foliage = ShaderMaterial.new()
	foliage.shader = load("res://shaders/foliage.gdshader")
	foliage.set_shader_parameter("leaf_texture", load("res://assets/details/leaf.png"))
	foliage.set_shader_parameter("leaf_colour", Color("9aaa72"))
	mountains()
	for index in 23:
		var at := Vector3(-37.0 + float(index % 8) * 10.8, 0, -14.0 - float(index / 8) * 12)
		tree(at, 1.0 + float(index % 4) * .13)
	for x in [-28.0, -23.5, -18.0, -12.7, -7.4]:
		tree(Vector3(x, 0, 15.8), .78)
	for i in 12:
		var rock := builder.imported("rock_face_01", Vector3(-34 + i * 5.3, -.30, 24.6), random.randf_range(-PI, PI), random.randf_range(.12, .24))
		rock.rotation.z = random.randf_range(-.18, .18)
	shoreline()

func elevation(x: float, z: float) -> float:
	var peaks := [[-68.0, 149.0, 34.0, 32.0], [-35.0, 160.0, 47.0, 30.0], [0.0, 143.0, 36.0, 26.0], [32.0, 162.0, 51.0, 32.0], [72.0, 148.0, 39.0, 30.0]]
	var height := 0.0
	for peak in peaks:
		var distance := pow((x - float(peak[0])) / float(peak[3]), 2) + pow((z - float(peak[1])) / 35.0, 2)
		height = maxf(height, float(peak[2]) * exp(-distance * .73))
	var ridge := 1.0 - absf(noise.get_noise_2d(x * 1.2, z * .84))
	return maxf(-1.0, (height * (.77 + ridge * .34) + noise.get_noise_2d(x * 2, z * 2) * minf(2.8, height * .12)) * smoothstep(69.0, 96.0, z) - 1.1)

func mountains() -> void:
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	var width := 144
	var depth := 64
	for row in depth:
		for column in width:
			for offset in [Vector2i(0, 0), Vector2i(1, 0), Vector2i(0, 1), Vector2i(1, 0), Vector2i(1, 1), Vector2i(0, 1)]:
				var x: float = -134.0 + (column + offset.x) * 1.9
				var z: float = 65.0 + (row + offset.y) * 2.15
				surface.set_uv(Vector2(x, z) * .07)
				surface.set_normal(Vector3(elevation(x - .4, z) - elevation(x + .4, z), .8, elevation(x, z - .4) - elevation(x, z + .4)).normalized())
				surface.add_vertex(Vector3(x, elevation(x, z), z))
	surface.index()
	var material := ShaderMaterial.new()
	material.shader = load("res://shaders/terrain.gdshader")
	material.set_shader_parameter("rock_albedo", load("res://assets/materials/cliff_side/albedo.jpg"))
	material.set_shader_parameter("rock_normal", load("res://assets/materials/cliff_side/normal.jpg"))
	var mesh := builder.mesh(surface.commit(), Vector3.ZERO, material)
	mesh.name = "AlpineRidgeline"
	mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

func tree(at: Vector3, scale: float) -> void:
	var group := Node3D.new()
	group.position = at
	group.scale = Vector3.ONE * scale
	builder.parent.add_child(group)
	var bark := builder.pbr("bark_brown_02", Color("d0c4ab"), 2.3)
	builder.cylinder(.13, 2.8, Vector3(0, 1.35, 0), bark, group)
	for i in 7:
		var angle := i * 2.4
		var branch := builder.cylinder(.041, 1.1, Vector3(sin(angle) * .37, 2.0 + i * .13, cos(angle) * .37), bark, group)
		branch.rotation = Vector3(cos(angle) * .75, angle, sin(angle) * .75)
	var cards := MultiMesh.new()
	cards.transform_format = MultiMesh.TRANSFORM_3D
	cards.use_custom_data = true
	var leaf := QuadMesh.new()
	leaf.size = Vector2(.30, .52)
	cards.mesh = leaf
	cards.instance_count = 340
	for index in cards.instance_count:
		var point := Vector3(random.randf_range(-1, 1), random.randf_range(-1, 1), random.randf_range(-1, 1))
		point = point.normalized() * pow(random.randf(), .33)
		point *= Vector3(1.63, 1.17, 1.48)
		point += Vector3(0, 3.15, 0)
		var basis := Basis.from_euler(Vector3(random.randf_range(-PI, PI), random.randf_range(-PI, PI), random.randf_range(-PI, PI)))
		cards.set_instance_transform(index, Transform3D(basis.scaled(Vector3.ONE * random.randf_range(.64, 1.35)), point))
		cards.set_instance_custom_data(index, Color(random.randf(), 0, 0, 1))
	var node := MultiMeshInstance3D.new()
	node.multimesh = cards
	node.material_override = foliage
	node.visibility_range_end = 78
	group.add_child(node)

func shoreline() -> void:
	var border := builder.material("bbb7a6")
	builder.box(Vector3(64, .24, .72), Vector3(-7, -.07, 23.4), border, true)
	for i in 33:
		builder.box(Vector3(1.78, .09, .83), Vector3(-38 + i * 1.95, .065, 23.35), builder.stone)
	# A low parapet and safe gaps make the lakeside route a walkable promenade.
	for x in [-30.0, -22.0, -14.0, -6.0, 2.0]:
		builder.box(Vector3(.075, .86, .075), Vector3(x, .47, 23.18), builder.gold, true)
	builder.box(Vector3(36, .047, .047), Vector3(-14, .91, 23.18), builder.gold)
