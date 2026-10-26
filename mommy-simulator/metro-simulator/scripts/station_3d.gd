class_name MetroStation3D
extends Node3D

var station_sign: Label3D
var wall_material: StandardMaterial3D
var floor_material: StandardMaterial3D
var lamps: Array[Light3D] = []
var route_labels: Array[Label3D] = []
var sign_material: StandardMaterial3D
var clock_sign: Label3D
var local_decor: Node3D
var station_id := ""

func build() -> void:
	name = "BakuMetroStation"
	wall_material = MetroMesh.pbr("marble", Color("c6bea9"), 1.0, 0.62)
	floor_material = MetroMesh.pbr("marble", Color("c0bcae"), 3.0, 0.36)
	var ceiling := MetroMesh.pbr("plaster", Color("aaa995"), 1.4, 0.9)
	var slate := MetroMesh.pbr("concrete", Color("373d40"), 6, 0.9)
	var brass := MetroMesh.material(Color("a89a74"), 0.3, 0.7)
	var dark := MetroMesh.material(Color("1c2930"), 0.78)
	var chrome := MetroMesh.material(Color("93a4a6"), 0.3, 0.72)
	var glow := MetroMesh.material(Color("fff0ce"), 0.3, 0, 2.5)
	var stripe := MetroMesh.material(Color("b7a264"), 0.7, 0.1)
	# Platform is full human scale, with actual track trench, two steel rails and ties.
	MetroMesh.box(self, Vector3(0, -0.17, 7.5), Vector3(54, 0.34, 14.6), floor_material, 0.025)
	MetroMesh.box(self, Vector3(0, -0.48, -1.63), Vector3(58, 0.7, 3.75), slate)
	for z in [-0.86, -2.34]:
		MetroMesh.box(self, Vector3(0, -0.26, z), Vector3(56, 0.13, 0.095), chrome, 0.015)
	for x in range(-26, 27):
		MetroMesh.box(self, Vector3(x, -0.39, -1.64), Vector3(0.24, 0.18, 2.70), dark, 0.018)
	MetroMesh.box(self, Vector3(0, 0.017, 0.74), Vector3(54, 0.033, 0.23), stripe, 0.007)
	for x in range(-52, 53):
		for z in [0.68, 0.77]:
			MetroMesh.cylinder(self, Vector3(x * 0.5, 0.04, z), 0.024, 0.012, stripe)
	# Fine grout lines, alternating granite bands and heavy platform curb.
	var grout := MetroMesh.material(Color("7c7c6d"), 0.86)
	for z in range(1, 16):
		MetroMesh.box(self, Vector3(0, 0.007, z), Vector3(54, 0.008, 0.014), grout)
	for x in range(-27, 28):
		MetroMesh.box(self, Vector3(x, 0.007, 7.6), Vector3(0.012, 0.008, 14.5), grout)
	for z in [3.1, 8.1, 13.1]:
		MetroMesh.box(self, Vector3(0, 0.012, z), Vector3(54, 0.018, 0.30), MetroMesh.pbr("marble", Color("777d79"), 6, 0.5), 0.008)
	MetroMesh.box(self, Vector3(0, -0.05, 0.25), Vector3(54, 0.30, 0.18), dark, 0.03)
	# High barrel-vault ceiling with repeating structural ribs, inset strip lights.
	MetroMesh.box(self, Vector3(0, 5.0, 7), Vector3(54, 0.26, 17), ceiling, 0.035)
	for x in range(-24, 25, 4):
		for z in [2.6, 10.9]:
			if x == 0: continue
			MetroMesh.box(self, Vector3(x, 2.20, z), Vector3(0.68, 4.4, 0.62), wall_material, 0.045)
			MetroMesh.box(self, Vector3(x, 0.15, z), Vector3(0.82, 0.30, 0.75), MetroMesh.material(Color("686d66"), 0.4), 0.035)
			MetroMesh.box(self, Vector3(x, 4.37, z), Vector3(0.95, 0.18, 0.83), brass, 0.025)
			for yy in [0.46, 4.12]:
				MetroMesh.box(self, Vector3(x, yy, z + 0.321), Vector3(0.71, 0.035, 0.01), brass, 0.003)
		# Arch ribs use curved human-scale segments instead of ceiling decals.
		for section in range(12):
			var t0 := PI * section / 12
			var t1 := PI * (section + 1) / 12
			var a := Vector3(x, 4.0 + sin(t0) * 1.3, 6.75 + cos(t0) * 4.15)
			var b := Vector3(x, 4.0 + sin(t1) * 1.3, 6.75 + cos(t1) * 4.15)
			MetroMesh.rod(self, a, b, 0.105, ceiling)
	for z in [1.82, 4.45, 9.35, 12.15]:
		MetroMesh.box(self, Vector3(0, 4.64, z), Vector3(51, 0.065, 0.28), dark, 0.03)
		MetroMesh.box(self, Vector3(0, 4.58, z), Vector3(50.7, 0.04, 0.10), glow, 0.012)
	# A deep opposite wall, stone pilasters and mosaic panels around the signage.
	MetroMesh.box(self, Vector3(0, 2.30, -4.12), Vector3(56, 4.6, 0.34), wall_material, 0.045)
	MetroMesh.box(self, Vector3(0, 2.20, 15.0), Vector3(56, 4.4, 0.3), wall_material, 0.04)
	for x in range(-24, 25, 4):
		MetroMesh.box(self, Vector3(x, 2.3, -3.91), Vector3(0.42, 4.6, 0.14), brass, 0.03)
		_mosaic(Vector3(x + 1.85, 2.05, -3.915), wall_material.albedo_color)
	sign_material = MetroMesh.material(Color("183e45"), 0.54)
	MetroMesh.box(self, Vector3(0, 4.01, -3.86), Vector3(9.3, 0.80, 0.17), sign_material, 0.06)
	MetroMesh.box(self, Vector3(0, 4.41, -3.86), Vector3(9.35, 0.035, 0.20), brass, 0.01)
	station_sign = MetroMesh.text(self, "HƏZİ ASLANOV", Vector3(0, 4.05, -3.755), 75, Color("f7ead1"), 0.0065)
	# Suspended wayfinding sign, arrow directions and real line strip map.
	var overhead := Node3D.new()
	overhead.position = Vector3(-3.2, 3.7, 5.0)
	add_child(overhead)
	MetroMesh.box(overhead, Vector3.ZERO, Vector3(4.1, 0.50, 0.17), dark, 0.035)
	for side in [-1, 1]: MetroMesh.rod(overhead, Vector3(side * 1.2, 0.20, 0), Vector3(side * 1.2, 1.05, 0), 0.013, chrome)
	route_labels.append(MetroMesh.text(overhead, "01  •  DƏRNƏGÜL  →", Vector3(0, 0.04, 0.101), 35, Color("dcebbd"), 0.004))
	MetroMesh.text(overhead, "ÇIXIŞ  ↑", Vector3(0, -0.16, 0.101), 20, Color("dddccf"), 0.003)
	# Wall-mounted clock and arrival display, locally authored metro posters.
	MetroMesh.box(self, Vector3(6.6, 3.1, -3.86), Vector3(2.2, 0.83, 0.14), dark, 0.045)
	clock_sign = MetroMesh.text(self, "08:47  •  00:09", Vector3(6.6, 3.17, -3.77), 43, Color("f0b35e"), 0.0044)
	MetroMesh.text(self, "NÖVBƏTİ QATAR", Vector3(6.6, 2.89, -3.76), 21, Color("bfc8c5"), 0.003)
	for side in [-1, 1]:
		var poster := Node3D.new()
		poster.position = Vector3(side * 9.0, 1.9, -3.84)
		add_child(poster)
		MetroMesh.box(poster, Vector3.ZERO, Vector3(1.38, 1.80, 0.10), brass, 0.018)
		MetroMesh.box(poster, Vector3(0, 0, 0.059), Vector3(1.29, 1.7, 0.025), MetroMesh.material(Color("2f5967") if side == 1 else Color("945b36"), 0.9))
		MetroMesh.text(poster, "BAKI" if side == 1 else "ŞƏHƏR\nSƏNİNDİR", Vector3(0, 0.32, 0.081), 48, Color("f3e4bb"), 0.0046)
		MetroMesh.text(poster, "BİR ŞƏHƏR. MİN HEKAYƏ." if side == 1 else "METRO İLƏ KƏŞF ET", Vector3(0, -0.58, 0.082), 16, Color("d5d9c9"), 0.003)
	# Benches, station bins, electrical cabinets, safety signs and emergency gear.
	for x in [-7.1, 7.2]:
		_bench(Vector3(x, 0, 8.2), chrome, MetroMesh.material(Color("765e45"), 0.82))
		MetroMesh.cylinder(self, Vector3(x + 2.0, 0.46, 9.8), 0.23, 0.84, chrome)
		MetroMesh.cylinder(self, Vector3(x + 2.0, 0.91, 9.8), 0.25, 0.09, dark)
		MetroMesh.box(self, Vector3(x + 2.0, 0.95, 9.8), Vector3(0.17, 0.012, 0.11), rubber_mat(), 0.02)
	MetroMesh.box(self, Vector3(-12.8, 1.14, -3.76), Vector3(0.74, 1.60, 0.19), chrome, 0.026)
	MetroMesh.box(self, Vector3(-11.6, 0.70, -3.72), Vector3(0.51, 1.10, 0.15), MetroMesh.material(Color("7c342a"), 0.54), 0.025)
	MetroMesh.text(self, "YANĞIN", Vector3(-11.6, 1.03, -3.62), 20, Color("eee2cf"), 0.0025)
	# Distant stairs and portals give the station an actual continuation.
	for side in [-1, 1]:
		var x: float = side * 20.0
		MetroMesh.box(self, Vector3(x, 2.4, 14.74), Vector3(3.8, 4.8, 0.26), dark, 0.09)
		for step in range(10):
			MetroMesh.box(self, Vector3(x, step * 0.17 - 0.08, 11.6 + step * 0.32), Vector3(3.2, 0.17, 0.34), floor_material, 0.012)
		for side_rail in [-1, 1]: MetroMesh.rod(self, Vector3(x + side_rail * 1.55, 0.95, 11.5), Vector3(x + side_rail * 1.55, 2.55, 14.7), 0.035, chrome)
	# Shadowed, layered illumination: warm overheads and cool carriage spill.
	for index in range(7):
		var light := OmniLight3D.new()
		light.position = Vector3(-12 + index * 4, 4.05, 5.7)
		light.light_color = Color("ffebc6")
		light.light_energy = 1.65
		light.omni_range = 8.2
		light.omni_attenuation = 1.6
		light.shadow_enabled = index == 3
		add_child(light)
		lamps.append(light)
	for x in [-4.8, 0.0, 4.8]:
		var light := OmniLight3D.new()
		light.position = Vector3(x, 2.4, -1.4)
		light.light_color = Color("cbdce6")
		light.light_energy = 1.3
		light.omni_range = 5.5
		light.shadow_enabled = false
		add_child(light)
	var key := DirectionalLight3D.new()
	key.rotation_degrees = Vector3(-67, -22, 0)
	key.light_color = Color("ffeccc")
	key.light_energy = 0.72
	key.shadow_enabled = true
	key.directional_shadow_max_distance = 24
	key.directional_shadow_mode = DirectionalLight3D.SHADOW_PARALLEL_2_SPLITS
	add_child(key)
	MetroMesh.batch_direct(self)

func station(id: Dictionary, route: Dictionary) -> void:
	station_sign.text = id.short.to_upper()
	wall_material.albedo_color = Color("cac5b9") if id.id not in ["nizami", "ichari"] else Color("c7b798")
	for label in route_labels: label.text = "01  •  " + route.to.to_upper() + "  →"
	if station_id != id.id:
		station_id = id.id
		if local_decor != null:
			remove_child(local_decor)
			local_decor.queue_free()
		local_decor = Node3D.new()
		local_decor.name = "StationIdentity"
		add_child(local_decor)
		var accent := Color(id.theme).darkened(0.2)
		var material := MetroMesh.material(accent, 0.58, 0.15)
		for side in [-1, 1]:
			var x: float = side * 4.9
			MetroMesh.box(local_decor, Vector3(x, 3.10, -3.90), Vector3(0.14, 1.14, 0.10), material, 0.018)
			MetroMesh.box(local_decor, Vector3(x + side * 0.25, 3.10, -3.90), Vector3(0.09, 1.14, 0.10), material, 0.018)
		if id.id in ["nizami", "ichari", "may28"]:
			for side in [-1, 1]:
				for section in range(9):
					var angle := section * PI / 8
					var point := Vector3(side * 6.1 + cos(angle) * 1.1, 2.55 + sin(angle) * 1.05, -3.85)
					MetroMesh.sphere(local_decor, point, Vector3(0.17, 0.16, 0.05), MetroMesh.material(Color("b59d70"), 0.48, 0.35))
		elif id.id in ["koroglu", "darnagul", "noyabr8", "khojasan", "ajami2"]:
			for x in [-7.8, -6.6, -5.4, 5.4, 6.6, 7.8]:
				MetroMesh.box(local_decor, Vector3(x, 3.2, -3.84), Vector3(0.82, 0.035, 0.025), MetroMesh.material(Color("bcd6da"), 0.3, 0, 0.65), 0.012)
		MetroMesh.batch_direct(local_decor)

func _mosaic(point: Vector3, color: Color) -> void:
	var frame := MetroMesh.material(Color("8b815f"), 0.4, 0.6)
	MetroMesh.box(self, point, Vector3(1.78, 2.0, 0.045), frame, 0.015)
	for x in range(5):
		for y in range(6):
			var mat := MetroMesh.material([Color("917746"), Color("3c6469"), Color("b8aa7b"), Color("53736a")][posmod(x * 3 + y * 7, 4)], 0.6, 0.1)
			MetroMesh.box(self, point + Vector3((x - 2) * 0.32, (y - 2.5) * 0.3, 0.04), Vector3(0.29, 0.27, 0.03), mat, 0.004)

func _bench(point: Vector3, metal: Material, wood: Material) -> void:
	for index in range(7):
		MetroMesh.box(self, point + Vector3(0, 0.5, (index - 3) * 0.075), Vector3(2.45, 0.055, 0.06), wood, 0.018)
		MetroMesh.box(self, point + Vector3(0, 0.72 + index * 0.062, -0.31), Vector3(2.45, 0.054, 0.055), wood, 0.015)
	for x in [-0.97, 0.97]:
		MetroMesh.rod(self, point + Vector3(x, 0.05, -0.23), point + Vector3(x, 1.18, -0.26), 0.029, metal)
		MetroMesh.rod(self, point + Vector3(x, 0.05, 0.25), point + Vector3(x, 0.54, 0.25), 0.029, metal)
		MetroMesh.rod(self, point + Vector3(x, 0.78, 0.22), point + Vector3(x, 0.78, -0.24), 0.025, metal)

func rubber_mat() -> Material:
	return MetroMesh.material(Color("253136"), 0.95)
