class_name FamilyCompanion
extends Node

var world: Node3D
var actor: FamilyActor
var path: Array[Vector3] = []
var idle := 3.0
var destination: WorldInteractable
var patrol := 0
var role := ""

func setup(scene: Node3D, character: FamilyActor) -> void:
	world = scene
	actor = character
	destination = WorldInteractable.new()
	destination.radius = .7
	add_child(destination)

func _physics_process(delta: float) -> void:
	if Life.acceptance or not Life.state.started or world.hud and world.hud.modal or world.sequence and world.sequence.working:
		return
	var activity: String = str(Life.state.activity.id) if Life.state.activity != null else ""
	if activity in ["talk", "help"]:
		actor.rotation.y = lerp_angle(actor.rotation.y, atan2(world.player.position.x - actor.position.x, world.player.position.z - actor.position.z), delta * 3)
		actor.animate_state(0, "talk" if activity == "talk" else "clean")
		return
	if path.is_empty():
		idle -= delta
		actor.animate_state(0, "")
		if idle < 0 and Life.state.location == "home":
			var goals := [Vector3(-2.8, .08, 4.5), Vector3(-3.3, .08, 1.1), Vector3(-2.4, .08, 3.7)]
			destination.global_position = goals[patrol % goals.size()]
			patrol += 1
			path = world.navigator.route(actor.position, destination)
			idle = 5.0
		return
	var point: Vector3 = path[0]
	var direction := point - actor.position
	direction.y = 0
	if direction.length() < .16:
		path.pop_front()
		return
	actor.position += direction.normalized() * delta * .82
	actor.rotation.y = lerp_angle(actor.rotation.y, atan2(direction.x, direction.z), delta * 5)
	actor.animate_state(.82, "")
	if world.builder.objects.has("partner"):
		world.builder.objects.partner.position = actor.position

func follow_location(location: String) -> void:
	path.clear()
	idle = 5
	var positions := {"home": Vector3(-2.6, .08, 3.67), "market": Vector3(18.25, .08, .50), "cafe": Vector3(-15.8, .08, .40), "clinic": Vector3(18.30, .08, 12.7), "lakeside": Vector3(-8.8, .08, 21.1)}
	actor.position = positions.get(location, actor.position)
	world.builder.objects.partner.position = actor.position
