class_name MetroRules
extends RefCounted

const SAVE_SCHEMA := 1
const BASE_POWER := 8.0
const OBSTACLE_NAMES := {
	"passenger": "Sərnişin axını", "suitcase": "Böyük çamadan",
	"crowd": "Sıx izdiham", "clock": "Vaxt fürsəti", "barrier": "Dar keçid",
	"phone": "Diqqətsiz sərnişin", "wetfloor": "Sürüşkən döşəmə"
}

static func fresh_profile(routes: Array) -> Dictionary:
	var progress := {}
	for route in routes:
		progress[route.id] = 0
	return {
		"schema": SAVE_SCHEMA, "coins": 0, "xp": 0, "total_doors": 0,
		"best_combo": 0, "upgrades": {"strength": 0, "speed": 0, "stamina": 0},
		"owned": [], "equipped": {}, "route_progress": progress,
		"station_results": {}, "door_records": {}, "route_medals": [],
		"last_route": "green", "settings": {"sound": true, "haptics": true, "reduced_motion": false}
	}

static func integer(value: Variant, minimum: int, maximum: int, fallback: int = 0) -> int:
	if not (value is int or value is float) or not is_finite(float(value)):
		return fallback
	return clampi(int(value), minimum, maximum)

static func validate_profile(raw: Variant, routes: Array, items: Array) -> Dictionary:
	if not raw is Dictionary or integer(raw.get("schema"), 0, 999) != SAVE_SCHEMA:
		return {}
	var profile := fresh_profile(routes)
	for key in ["coins", "xp", "total_doors", "best_combo"]:
		profile[key] = integer(raw.get(key), 0, 99999999)
	var upgrades: Variant = raw.get("upgrades", {})
	if upgrades is Dictionary:
		for item in items:
			if item.kind == "upgrade":
				profile.upgrades[item.id] = integer(upgrades.get(item.id), 0, int(item.max_rank))
	var owned: Variant = raw.get("owned", [])
	if owned is Array:
		for item in items:
			if item.kind == "gear" and item.id in owned:
				profile.owned.append(item.id)
	var equipped: Variant = raw.get("equipped", {})
	if equipped is Dictionary:
		for item in items:
			if item.kind == "gear" and item.id in profile.owned and equipped.get(item.slot) == item.id:
				profile.equipped[item.slot] = item.id
	var progress: Variant = raw.get("route_progress", {})
	if progress is Dictionary:
		for route in routes:
			profile.route_progress[route.id] = integer(progress.get(route.id), 0, route.stations.size() - 1)
	var results: Variant = raw.get("station_results", {})
	var records: Variant = raw.get("door_records", {})
	var medals: Variant = raw.get("route_medals", [])
	for route in routes:
		for station_id in route.stations:
			var key: String = route.id + ":" + station_id
			if results is Dictionary and results.get(key) is Dictionary:
				var entry: Dictionary = results[key]
				profile.station_results[key] = {
					"stars": integer(entry.get("stars"), 1, 3, 1),
					"best_ms": integer(entry.get("best_ms"), 1, 300000, 300000)
				}
			if records is Dictionary:
				for door in range(4):
					var door_key := key + ":" + str(door)
					if records.get(door_key) == true:
						profile.door_records[door_key] = true
		if medals is Array and route.id in medals:
			profile.route_medals.append(route.id)
	var settings: Variant = raw.get("settings", {})
	if settings is Dictionary:
		for key in profile.settings:
			if settings.get(key) is bool:
				profile.settings[key] = settings[key]
	for route in routes:
		if raw.get("last_route") == route.id:
			profile.last_route = route.id
	return profile

static func stats(profile: Dictionary, items: Array) -> Dictionary:
	var result := {
		"power": BASE_POWER * (1.0 + profile.upgrades.strength * 0.18),
		"speed": 1.0 + profile.upgrades.speed * 0.08,
		"energy": 1.0 + profile.upgrades.stamina * 0.12,
		"burst_duration": 1.4 + profile.upgrades.stamina * 0.10,
		"size": 1.0 + profile.upgrades.strength * 0.032,
		"time": 0.0, "guard": 0.0, "grip": 0.0, "rhythm": 0.0
	}
	for item in items:
		if item.kind != "gear" or profile.equipped.get(item.slot) != item.id:
			continue
		result.power *= 1.0 + float(item.get("power", 0))
		result.speed += float(item.get("speed", 0))
		result.energy += float(item.get("energy", 0))
		for key in ["time", "guard", "grip", "rhythm"]:
			result[key] += float(item.get(key, 0))
	return result

static func item_price(item: Dictionary, profile: Dictionary) -> int:
	if item.kind == "gear":
		return int(item.cost)
	return int(round(float(item.cost) * pow(1.65, float(profile.upgrades.get(item.id, 0)))))

static func door_count(route: Dictionary, station_index: int) -> int:
	return 4 if station_index == route.stations.size() - 1 else 3

static func door_duration(difficulty: int, door_index: int, equipment_time: float) -> float:
	return clampf(9.5 - difficulty * 0.20 - door_index * 0.25 + equipment_time, 5.0, 10.0)

static func obstacles(difficulty: int, door_index: int, station_id: String, hazard: String) -> Array:
	var count := 5 + mini(3, int(difficulty / 5.0)) + (1 if door_index > 1 else 0)
	var result: Array = []
	var seed_value: int = absi((station_id + str(door_index)).hash())
	for index in range(count):
		var kind := "passenger"
		if index == 1:
			kind = "suitcase"
		elif index == 2 or index == count - 2:
			kind = "clock"
		elif index == count - 1:
			kind = "crowd"
		elif difficulty > 1 and index == 3:
			kind = {"slip": "wetfloor", "phone": "phone", "barrier": "barrier"}.get(hazard, "crowd")
		var hp := 19.0 + float(difficulty) * 1.65 + door_index * 3.0
		if kind == "crowd":
			hp *= 1.35
		if kind == "suitcase" or kind == "barrier":
			hp *= 1.15
		var bonus := 0.0
		if kind == "clock":
			bonus = 1.0 if index == 2 else 2.0
		result.append({
			"kind": kind, "name": OBSTACLE_NAMES[kind], "hp": hp, "max_hp": hp,
			"time_bonus": bonus, "lane": (seed_value + index * 7) % 3,
			"coins": 4 + mini(difficulty, 12), "cleared": false
		})
	return result

static func rank_name(xp: int) -> String:
	if xp >= 12000: return "Metro əfsanəsi"
	if xp >= 5000: return "Pik saat ustası"
	if xp >= 1500: return "Şəhər sprinteri"
	if xp >= 400: return "Ritm ovçusu"
	return "Yeni sərnişin"
