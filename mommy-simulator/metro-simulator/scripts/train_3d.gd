class_name MetroTrain3D
extends Node3D

var door_leaves: Array[Node3D] = []
var door_sign: Label3D
var door_light: StandardMaterial3D
var opened := 1.0
var travel := 0.0
var warning := false
var metal: StandardMaterial3D
var paint: StandardMaterial3D
var dark: StandardMaterial3D
var glass: StandardMaterial3D
var rubber: StandardMaterial3D
var emissive: StandardMaterial3D

func build() -> void:
	name = "BakuMetroTrain"
	metal = MetroMesh.material(Color("a9b7bd"), 0.38, 0.62)
	metal.normal_enabled = true
	metal.normal_texture = load("res://assets/materials/metal/normal.jpg")
	metal.normal_scale = 0.045
	metal.uv1_scale = Vector3(0.18, 0.18, 1)
	paint = MetroMesh.material(Color("dfded4"), 0.37, 0.18)
	dark = MetroMesh.material(Color("203b48"), 0.44, 0.40)
	rubber = MetroMesh.material(Color("18262b"), 0.91)
	glass = MetroMesh.material(Color("293e46"), 0.14, 0.64)
	glass.clearcoat_enabled = true
	glass.clearcoat = 0.5
	emissive = MetroMesh.material(Color("fff2d4"), 0.28, 0, 2.4)
	var interior := MetroMesh.material(Color("e6e3d9"), 0.71)
	var floor := MetroMesh.pbr("concrete", Color("979d98"), 2.5, 0.8)
	var seats := MetroMesh.pbr("fabric", Color("315c77"), 1.2, 0.94)
	var trim := MetroMesh.material(Color("baaa87"), 0.4, 0.58)
	# Full car body: visible underside, rounded roof, rear wall and front cab.
	MetroMesh.box(self, Vector3(0, -0.12, -1.55), Vector3(20.4, 0.42, 3.15), dark, 0.15)
	MetroMesh.box(self, Vector3(0, 0.14, -1.56), Vector3(20.1, 0.13, 2.9), floor, 0.02)
	MetroMesh.box(self, Vector3(0, 3.16, -1.58), Vector3(20.2, 0.33, 3.1), paint, 0.15)
	MetroMesh.box(self, Vector3(0, 2.97, -1.58), Vector3(19.7, 0.14, 2.78), interior, 0.035)
	MetroMesh.box(self, Vector3(0, 1.55, -3.04), Vector3(20, 2.72, 0.14), interior, 0.06)
	MetroMesh.box(self, Vector3(-10.0, 1.58, -1.54), Vector3(0.22, 2.74, 2.9), paint, 0.07)
	MetroMesh.box(self, Vector3(10.0, 1.58, -1.54), Vector3(0.22, 2.74, 2.9), paint, 0.07)
	for side in [-1, 1]:
		var wheel_group := Node3D.new()
		wheel_group.position = Vector3(side * 6.5, -0.3, -1.5)
		add_child(wheel_group)
		MetroMesh.box(wheel_group, Vector3.ZERO, Vector3(2.4, 0.35, 2.3), rubber, 0.06)
		for xx in [-0.72, 0.72]:
			for zz in [-1.2, 1.2]:
				var wheel := MetroMesh.cylinder(wheel_group, Vector3(xx, -0.15, zz), 0.38, 0.15, metal)
				wheel.rotation.x = PI / 2
	# Exterior panels preserve physical door openings, with three actual door sets.
	var centres := [-6.7, 0.0, 6.7]
	var boundaries := [-10.0, -7.61, -5.79, -0.91, 0.91, 5.79, 7.61, 10.0]
	for segment in range(0, boundaries.size() - 1, 2):
		var from: float = boundaries[segment]
		var to: float = boundaries[segment + 1]
		var width := to - from
		var x := (from + to) * 0.5
		MetroMesh.box(self, Vector3(x, 0.59, 0.01), Vector3(width, 0.79, 0.16), paint, 0.045)
		MetroMesh.box(self, Vector3(x, 2.73, 0.01), Vector3(width, 0.48, 0.16), paint, 0.035)
		MetroMesh.box(self, Vector3(x, 1.02, 0.095), Vector3(width, 0.21, 0.06), dark, 0.015)
		MetroMesh.box(self, Vector3(x, 0.23, 0.085), Vector3(width, 0.075, 0.025), metal, 0.01)
		var window_count := maxi(1, int(width / 1.7))
		for index in range(window_count):
			var window_x := from + width * (index + 0.5) / window_count
			var window_width := width / window_count - 0.18
			MetroMesh.box(self, Vector3(window_x, 1.78, -0.012), Vector3(window_width + 0.075, 1.37, 0.16), rubber, 0.055)
			MetroMesh.box(self, Vector3(window_x, 1.80, 0.08), Vector3(window_width, 1.27, 0.028), glass, 0.045)
			# Inner reflection streak and window mullions, not opaque white glass.
			MetroMesh.box(self, Vector3(window_x + window_width * 0.28, 1.81, 0.104), Vector3(0.025, 1.10, 0.009), MetroMesh.material(Color("607582"), 0.25, 0.4), 0.003)
	for centre in centres:
		var doorway := Node3D.new()
		doorway.position.x = centre
		add_child(doorway)
		for side in [-1, 1]:
			MetroMesh.box(doorway, Vector3(side * 0.93, 1.6, 0.015), Vector3(0.12, 2.75, 0.17), metal, 0.035)
			var leaf := Node3D.new()
			leaf.name = "SlidingDoor"
			leaf.set_meta("side", side)
			leaf.set_meta("centre", centre)
			doorway.add_child(leaf)
			leaf.position = Vector3(side * 0.45, 1.58, 0.11)
			MetroMesh.box(leaf, Vector3.ZERO, Vector3(0.87, 2.64, 0.06), metal, 0.026)
			MetroMesh.box(leaf, Vector3(0, 0.28, 0.048), Vector3(0.60, 1.02, 0.035), rubber, 0.045)
			MetroMesh.box(leaf, Vector3(0, 0.28, 0.069), Vector3(0.54, 0.96, 0.012), glass, 0.04)
			MetroMesh.box(leaf, Vector3(0, -0.56, 0.046), Vector3(0.87, 0.22, 0.014), dark, 0.006)
			MetroMesh.box(leaf, Vector3(side * -0.34, -0.20, 0.055), Vector3(0.033, 0.18, 0.025), rubber, 0.01)
			MetroMesh.box(leaf, Vector3(side * -0.412, 0, 0.048), Vector3(0.02, 2.57, 0.014), rubber, 0.004)
			door_leaves.append(leaf)
		MetroMesh.box(doorway, Vector3(0, 2.93, 0.01), Vector3(2.02, 0.19, 0.17), metal, 0.025)
		MetroMesh.box(doorway, Vector3(0, 0.205, 0.08), Vector3(1.86, 0.11, 0.46), metal, 0.025)
		MetroMesh.box(doorway, Vector3(0, 0.262, 0.13), Vector3(1.82, 0.013, 0.018), MetroMesh.material(Color("e9ca67"), 0.61), 0.003)
		MetroMesh.box(doorway, Vector3(0, 2.70, -0.38), Vector3(1.75, 0.055, 0.12), emissive, 0.01)
		MetroMesh.text(doorway, "QAPILARA SÖYKƏNMƏYİN", Vector3(0, 2.92, 0.111), 25, Color("283c45"), 0.0031)
		for side in [-1, 1]:
			MetroMesh.rod(doorway, Vector3(side * 0.80, 0.24, -0.54), Vector3(side * 0.80, 2.75, -0.54), 0.026, metal)
	# Interior bench cushions, poles, overhead light strips, handles and ads.
	for index in range(12):
		var x := -9.1 + index * 1.65
		MetroMesh.box(self, Vector3(x, 0.53, -2.50), Vector3(1.52, 0.18, 0.61), seats, 0.08)
		MetroMesh.box(self, Vector3(x, 0.95, -2.77), Vector3(1.52, 0.64, 0.16), seats, 0.075)
		MetroMesh.box(self, Vector3(x, 0.24, -2.47), Vector3(1.40, 0.31, 0.5), metal, 0.025)
		MetroMesh.box(self, Vector3(x, 2.25, -2.945), Vector3(1.35, 0.42, 0.015), MetroMesh.material(Color("274b57") if index % 2 else Color("866d52"), 0.8), 0.015)
		MetroMesh.text(self, "BAKI  •  METRO" if index % 2 else "HƏR GÜN YENİ YOL", Vector3(x, 2.25, -2.93), 23, Color("e8e4d7"), 0.003)
		MetroMesh.rod(self, Vector3(x, 2.72, -1.19), Vector3(x, 2.35, -1.19), 0.009, rubber)
		var ring := TorusMesh.new()
		ring.inner_radius = 0.055
		ring.outer_radius = 0.072
		var mesh := MeshInstance3D.new()
		mesh.mesh = ring
		mesh.position = Vector3(x, 2.28, -1.19)
		mesh.rotation.x = PI / 2
		mesh.material_override = MetroMesh.material(Color("d9dcce"), 0.7)
		add_child(mesh)
	for z in [-0.72, -2.26]:
		MetroMesh.box(self, Vector3(0, 2.883, z), Vector3(19.2, 0.044, 0.11), emissive, 0.012)
	MetroMesh.rod(self, Vector3(-9.5, 2.63, -1.12), Vector3(9.5, 2.63, -1.12), 0.027, metal)
	for x in [-8.4, -4.3, 4.3, 8.4]:
		MetroMesh.rod(self, Vector3(x, 0.2, -1.20), Vector3(x, 2.68, -1.20), 0.025, metal)
	# Cab face and pantograph details are visible at the end of the carriage.
	MetroMesh.box(self, Vector3(10.05, 2.0, -1.56), Vector3(0.16, 1.30, 2.25), glass, 0.08)
	for z in [-2.58, -0.48]:
		MetroMesh.sphere(self, Vector3(10.18, 0.62, z), Vector3(0.04, 0.17, 0.21), emissive)
	MetroMesh.box(self, Vector3(0, 3.4, -1.65), Vector3(2.8, 0.16, 1.2), dark, 0.035)
	for x in [-0.95, -0.65, -0.35, -0.05, 0.25, 0.55, 0.85]:
		MetroMesh.box(self, Vector3(x, 3.51, -1.58), Vector3(0.16, 0.017, 0.93), metal, 0.005)
	# Centre-door status display; opening/closing follows actual game time.
	MetroMesh.box(self, Vector3(0, 3.017, 0.16), Vector3(1.40, 0.14, 0.07), rubber, 0.025)
	door_sign = MetroMesh.text(self, "QAPILAR AÇIQDIR", Vector3(0, 3.02, 0.208), 21, Color("c9eeaf"), 0.0028)
	door_light = MetroMesh.material(Color("89d7a7"), 0.4, 0, 1.6).duplicate()
	MetroMesh.box(self, Vector3(0, 2.97, 0.14), Vector3(1.68, 0.026, 0.045), door_light, 0.005)
	MetroMesh.text(self, "81–765.B  ·  BAKI", Vector3(2.75, 0.54, 0.107), 21, Color("304452"), 0.0027)
	for x in [-4.1, 4.1]:
		MetroMesh.text(self, "M", Vector3(x, 0.65, 0.11), 45, Color("2c5768"), 0.004)
	for leaf in door_leaves: MetroMesh.batch_direct(leaf)
	MetroMesh.batch_direct(self)
	set_doors(1.0)

func set_doors(value: float) -> void:
	opened = value
	for leaf in door_leaves:
		var side: int = leaf.get_meta("side")
		leaf.position.x = side * (0.45 + value * 0.89)

func update_doors(mode: String, seconds: float, delta: float) -> void:
	var target := 0.0 if mode == "lost" else (clampf(seconds / 1.6, 0.12, 1) if mode == "playing" else 1.0)
	set_doors(lerpf(opened, target, minf(1.0, delta * 7)))
	warning = mode == "playing" and seconds < 2.0
	door_sign.text = "QAPILAR BAĞLANIR" if warning or mode == "lost" else "QAPILAR AÇIQDIR"
	door_sign.modulate = Color("ffad6c") if warning else Color("c9eeaf")
	door_light.emission = Color("ff7d39") if warning else Color("80cfa5")
	if mode == "lost": travel += delta * delta * 0.8 + delta * 1.7
	else: travel = 0
	position.x = travel
