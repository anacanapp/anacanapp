class_name MetroSession
extends RefCounted

var mode := "idle"
var previous_mode := "playing"
var route_id := "green"
var station_id := "hazi"
var station_index := 0
var difficulty := 0
var door_index := 0
var doors_total := 3
var hazard := "none"
var stats: Dictionary = {}
var obstacles: Array = []
var obstacle_index := 0
var lane := 1
var time_left := 9.5
var initial_time := 9.5
var elapsed := 0.0
var countdown := 1.5
var last_tap_time := -100.0
var combo := 0
var best_combo := 0
var taps := 0
var energy := 0.0
var burst_left := 0.0
var burst_cooldown := 0.0
var stun_left := 0.0
var hazard_hits := 0
var wave_penalized_cycle := -1
var bonus_seconds := 0.0
var obstacle_coins := 0
var reward_claimed := false
var reward := 0
var stars := 0
var station_elapsed := 0.0
var station_hazard_hits := 0
var station_combo := 0
var station_stars := 3
var events: Array = []

func configure(route: Dictionary, station: Dictionary, index: int, player_stats: Dictionary) -> void:
	route_id = route.id
	station_id = station.id
	station_index = index
	difficulty = index + int(route.difficulty_offset)
	doors_total = MetroRules.door_count(route, index)
	hazard = station.hazard
	stats = player_stats.duplicate(true)
	door_index = 0
	station_elapsed = 0.0
	station_hazard_hits = 0
	station_combo = 0
	station_stars = 3
	prepare_door()

func prepare_door() -> void:
	mode = "idle"
	obstacles = MetroRules.obstacles(difficulty, door_index, station_id, hazard)
	obstacle_index = 0
	lane = 1
	initial_time = MetroRules.door_duration(difficulty, door_index, float(stats.get("time", 0)))
	time_left = initial_time
	elapsed = 0.0
	countdown = 1.5
	last_tap_time = -100.0
	combo = 0
	best_combo = 0
	taps = 0
	energy = 0.0
	burst_left = 0.0
	burst_cooldown = 0.0
	stun_left = 0.0
	hazard_hits = 0
	wave_penalized_cycle = -1
	bonus_seconds = 0.0
	obstacle_coins = 0
	reward_claimed = false
	reward = 0
	stars = 0
	events.clear()

func start() -> bool:
	if mode != "idle": return false
	mode = "countdown"
	return true

func tick(delta: float) -> void:
	if delta <= 0.0 or not is_finite(delta): return
	if mode == "countdown":
		countdown = maxf(0, countdown - delta)
		if countdown <= 0:
			mode = "playing"
			events.append({"type": "go", "text": "QAPILAR AÇIQDIR!"})
		return
	if mode != "playing": return
	elapsed += delta
	time_left = maxf(0, time_left - delta)
	burst_left = maxf(0, burst_left - delta)
	burst_cooldown = maxf(0, burst_cooldown - delta)
	stun_left = maxf(0, stun_left - delta)
	if combo > 0 and elapsed - last_tap_time > 0.56 + float(stats.get("rhythm", 0)):
		combo = 0
	if time_left <= 0:
		mode = "lost"
		combo = 0
		events.append({"type": "lost", "text": "Qatar getdi. Növbətisinə çat!"})

func wave_active() -> bool:
	return hazard == "wave" and difficulty > 0 and fmod(elapsed, 3.4) > 2.5 and mode == "playing"

func active_obstacle() -> Dictionary:
	if obstacle_index >= obstacles.size(): return {}
	return obstacles[obstacle_index]

func progress() -> float:
	if obstacles.is_empty(): return 0.0
	if obstacle_index >= obstacles.size(): return 1.0
	var obstacle: Dictionary = obstacles[obstacle_index]
	return (obstacle_index + 1.0 - obstacle.hp / obstacle.max_hp) / obstacles.size()

func tap() -> bool:
	if mode != "playing" or time_left <= 0.0 or stun_left > 0.0: return false
	var interval := elapsed - last_tap_time
	if interval < 0.065 / float(stats.get("speed", 1.0)): return false
	var obstacle := active_obstacle()
	if obstacle.is_empty(): return false
	combo = combo + 1 if interval <= 0.56 + float(stats.get("rhythm", 0)) else 1
	best_combo = maxi(best_combo, combo)
	last_tap_time = elapsed
	taps += 1
	var damage := float(stats.get("power", 8.0)) * (1.0 + minf(combo, 20) * 0.035)
	damage *= 1.0 + (float(stats.get("speed", 1.0)) - 1.0) * 0.45
	var bad_lane: bool = lane == int(obstacle.lane)
	damage *= 0.78 if bad_lane else 1.12
	if burst_left > 0.0: damage *= 2.6
	if wave_active():
		damage *= 0.6 if bad_lane else 0.92
		var cycle := int(elapsed / 3.4)
		if bad_lane and wave_penalized_cycle != cycle and burst_left <= 0:
			wave_penalized_cycle = cycle
			_apply_stun(0.32, "İzdiham dalğası! Zolağı dəyiş.")
	if obstacle.kind == "wetfloor" and interval < 0.13 and bad_lane and burst_left <= 0.0:
		_apply_stun(0.42 * (1.0 - float(stats.get("grip", 0))), "Döşəmə sürüşkəndir! Yan zolaqdan keç.")
	if obstacle.kind == "phone" and interval < 0.115 and bad_lane and burst_left <= 0.0:
		combo = 1
		damage *= 0.7
		events.append({"type": "hazard", "text": "Diqqət! Bir az ritmik TAP et."})
	obstacle.hp = maxf(0.0, float(obstacle.hp) - damage)
	energy = minf(100.0, energy + 5.2 * float(stats.get("energy", 1.0)))
	events.append({"type": "tap", "damage": damage, "combo": combo, "lane": lane})
	if obstacle.hp <= 0:
		obstacle.cleared = true
		obstacle_coins += int(obstacle.coins)
		var bonus: float = float(obstacle.time_bonus)
		time_left += bonus
		bonus_seconds += bonus
		events.append({"type": "clear", "index": obstacle_index, "bonus": bonus, "kind": obstacle.kind})
		obstacle_index += 1
		if obstacle_index >= obstacles.size():
			mode = "won"
			stars = 3 if time_left >= 3.0 and hazard_hits == 0 else (2 if time_left >= 1.25 else 1)
			station_stars = mini(station_stars, stars)
			station_elapsed += elapsed
			station_hazard_hits += hazard_hits
			station_combo = maxi(station_combo, best_combo)
			events.append({"type": "won", "text": "VAQONDASAN!", "stars": stars})
	return true

func _apply_stun(duration: float, text: String) -> void:
	stun_left = maxf(stun_left, duration * (1.0 - float(stats.get("guard", 0))))
	hazard_hits += 1
	events.append({"type": "hazard", "text": text})

func change_lane(new_lane: int) -> bool:
	if not mode in ["idle", "playing", "countdown"]: return false
	lane = clampi(new_lane, 0, 2)
	return true

func burst() -> bool:
	if mode != "playing" or energy < 60.0 or burst_cooldown > 0.0: return false
	energy -= 60.0
	burst_left = float(stats.get("burst_duration", 1.4))
	burst_cooldown = 3.0
	stun_left = 0.0
	events.append({"type": "burst", "text": "YOL AÇ! ×2.6 GÜC"})
	return true

func pause() -> bool:
	if not mode in ["playing", "countdown"]: return false
	previous_mode = mode
	mode = "paused"
	return true

func resume() -> bool:
	if mode != "paused": return false
	mode = previous_mode
	return true

func retry() -> bool:
	if mode != "lost": return false
	prepare_door()
	start()
	return true

func next_door() -> bool:
	if mode != "won" or not reward_claimed or door_index + 1 >= doors_total: return false
	door_index += 1
	prepare_door()
	start()
	return true

func snapshot() -> Dictionary:
	return {
		"mode": mode, "route": route_id, "station": station_id, "station_index": station_index,
		"door": door_index, "doors": doors_total, "time": time_left, "initial_time": initial_time,
		"elapsed": elapsed, "progress": progress(), "combo": combo, "best_combo": best_combo,
		"energy": energy, "lane": lane, "bonus_seconds": bonus_seconds, "taps": taps,
		"wave": wave_active(), "obstacle": active_obstacle(), "reward": reward,
		"reward_claimed": reward_claimed, "stars": stars
	}
