class_name WorldInteractable
extends Node3D

var object_id := ""
var title := ""
var action := ""
var kind := "activity"
var body: PhysicsBody3D
var radius := 2.0
var open := false
var door_pivot: Node3D
var animated: Node3D
var seat := Vector3.ZERO
var seat_yaw := 0.0
var destination := ""
var carry_origin := Transform3D.IDENTITY
var held := false
var timer := 0.0
var marker: MeshInstance3D
var open_tween: Tween

func setup(id: String, label: String, activity: String, type := "activity") -> void:
	object_id = id
	title = label
	action = activity
	kind = type
	add_to_group("interactables")
	marker = MeshInstance3D.new()
	var ring := TorusMesh.new()
	ring.inner_radius = .075
	ring.outer_radius = .10
	marker.mesh = ring
	marker.position.y = 1.16
	var material := StandardMaterial3D.new()
	material.albedo_color = Color("f2d8a0")
	material.emission_enabled = true
	material.emission = Color("b3ab83")
	material.emission_energy_multiplier = .65
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	marker.material_override = material
	marker.visible = false
	add_child(marker)

func prompt() -> String:
	if kind == "door":
		return "Bağla" if open else "Aç"
	if kind == "prop":
		return "Yerə qoy" if held else "Götür"
	if kind == "chair":
		return "Otur / dincəl"
	return title

func toggle_door(player: WorldPlayer) -> bool:
	if open and player.global_position.distance_to(global_position) < .72:
		return false
	open = not open
	if open_tween:
		open_tween.kill()
	open_tween = create_tween()
	var side := door_pivot.global_basis.z.dot(player.global_position - global_position)
	var angle := deg_to_rad(98.0 if side >= 0 else -98.0)
	open_tween.tween_property(door_pivot, "rotation:y", angle if open else 0.0, .40).set_trans(Tween.TRANS_SINE)
	Life.world.doors[object_id] = open
	Life.save_game()
	return true

func highlight(value: bool) -> void:
	marker.visible = value

func _process(delta: float) -> void:
	timer += delta
	if marker and marker.visible:
		marker.position.y = 1.14 + sin(timer * 2) * .03
