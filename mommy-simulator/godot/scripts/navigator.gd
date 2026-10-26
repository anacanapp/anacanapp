class_name WorldNavigator
extends RefCounted

const CELL := .40
var world: World3D
var occupancy: Dictionary = {}
var obstacle_version := ""
var shape := CylinderShape3D.new()

func _init(space: World3D) -> void:
	world = space
	shape.radius = .31
	shape.height = 1.50

func cell(at: Vector3) -> Vector2i:
	return Vector2i(roundi(at.x / CELL), roundi(at.z / CELL))

func point(at: Vector2i) -> Vector3:
	return Vector3(at.x * CELL, .10, at.y * CELL)

func clear(at: Vector2i) -> bool:
	if occupancy.has(at):
		return occupancy[at]
	var query := PhysicsShapeQueryParameters3D.new()
	query.shape = shape
	query.transform = Transform3D(Basis.IDENTITY, point(at) + Vector3(0, .84, 0))
	query.collision_mask = 1
	query.margin = .01
	var value := world.direct_space_state.intersect_shape(query, 1).is_empty()
	occupancy[at] = value
	return value

func route(start: Vector3, target: WorldInteractable) -> Array[Vector3]:
	var version := JSON.stringify(Life.world.doors)
	if version != obstacle_version:
		occupancy.clear()
		obstacle_version = version
	var origin := cell(start)
	var goal := cell(target.global_position)
	var open: Array[Vector2i] = [origin]
	var previous: Dictionary = {}
	var cost := {origin: 0.0}
	var closed: Dictionary = {}
	var end := origin
	var found := false
	var near := maxi(1, floori((target.radius - .3) / CELL))
	for iteration in 9000:
		if open.is_empty():
			break
		open.sort_custom(func(a: Vector2i, b: Vector2i) -> bool: return float(cost[a]) + Vector2(a).distance_to(Vector2(goal)) < float(cost[b]) + Vector2(b).distance_to(Vector2(goal)))
		var current: Vector2i = open.pop_front()
		if closed.has(current):
			continue
		closed[current] = true
		if Vector2(current).distance_to(Vector2(goal)) <= near and clear(current):
			end = current
			found = true
			break
		for direction in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1), Vector2i(1, 1), Vector2i(-1, 1), Vector2i(1, -1), Vector2i(-1, -1)]:
			var next: Vector2i = current + direction
			if next.x < -76 or next.x > 62 or next.y < -20 or next.y > 120 or closed.has(next) or not clear(next):
				continue
			if direction.x != 0 and direction.y != 0 and (not clear(current + Vector2i(direction.x, 0)) or not clear(current + Vector2i(0, direction.y))):
				continue
			var score := float(cost[current]) + (1.4142 if direction.x != 0 and direction.y != 0 else 1.0)
			if score >= float(cost.get(next, INF)):
				continue
			cost[next] = score
			previous[next] = current
			open.append(next)
	var points: Array[Vector3] = []
	if not found:
		return points
	while end != origin:
		points.push_front(point(end))
		end = previous[end]
	return points
