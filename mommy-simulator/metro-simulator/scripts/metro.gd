extends Node

signal profile_changed
signal purchase_result(message: String, success: bool)

var network: Dictionary = {}
var routes: Array = []
var stations: Array = []
var items: Array = []
var profile: Dictionary = {}
var session: MetroSession = MetroSession.new()
var selected_route := "green"
var selected_station := 0
var save_ok := true
var test_mode := false

func _ready() -> void:
	test_mode = "--self-test" in OS.get_cmdline_user_args() or "--acceptance" in OS.get_cmdline_user_args() or OS.get_environment("METRO_DEVICE_ACCEPTANCE") == "1"
	network = JSON.parse_string(FileAccess.get_file_as_string("res://data/network.json"))
	routes = network.routes
	stations = network.stations
	items = JSON.parse_string(FileAccess.get_file_as_string("res://data/shop.json")).items
	profile = MetroRules.fresh_profile(routes) if test_mode else MetroStore.load_profile(routes, items)
	selected_route = profile.last_route
	selected_station = int(profile.route_progress.get(selected_route, 0))
	prepare_station()

func route_by_id(id: String) -> Dictionary:
	for route in routes:
		if route.id == id: return route
	return routes[0]

func station_by_id(id: String) -> Dictionary:
	for station in stations:
		if station.id == id: return station
	return stations[0]

func item_by_id(id: String) -> Dictionary:
	for item in items:
		if item.id == id: return item
	return {}

func current_route() -> Dictionary:
	return route_by_id(selected_route)

func current_station() -> Dictionary:
	return station_by_id(current_route().stations[selected_station])

func player_stats() -> Dictionary:
	return MetroRules.stats(profile, items)

func choose_route(id: String) -> void:
	var route := route_by_id(id)
	selected_route = route.id
	selected_station = int(profile.route_progress[selected_route])
	profile.last_route = selected_route
	prepare_station()
	persist()

func choose_station(index: int) -> bool:
	if index < 0 or index >= current_route().stations.size() or index > int(profile.route_progress[selected_route]): return false
	selected_station = index
	prepare_station()
	return true

func prepare_station() -> void:
	session = MetroSession.new()
	session.configure(current_route(), current_station(), selected_station, player_stats())

func buy(id: String) -> bool:
	var item := item_by_id(id)
	if item.is_empty(): return false
	if item.kind == "gear" and id in profile.owned:
		return equip(id)
	if item.kind == "upgrade" and int(profile.upgrades.get(id, 0)) >= int(item.max_rank):
		purchase_result.emit("Bu bacarıq artıq maksimumdadır.", false)
		return false
	var price := MetroRules.item_price(item, profile)
	if int(profile.coins) < price:
		purchase_result.emit("Daha %d jeton lazımdır. Stansiyalarda qazan!" % (price - int(profile.coins)), false)
		return false
	profile.coins -= price
	if item.kind == "upgrade":
		profile.upgrades[id] += 1
	else:
		profile.owned.append(id)
		profile.equipped[item.slot] = id
	persist()
	profile_changed.emit()
	purchase_result.emit(item.name + " hazırdır!", true)
	return true

func equip(id: String) -> bool:
	var item := item_by_id(id)
	if item.is_empty() or item.kind != "gear" or not id in profile.owned: return false
	if profile.equipped.get(item.slot) == id:
		profile.equipped.erase(item.slot)
	else:
		profile.equipped[item.slot] = id
	persist()
	profile_changed.emit()
	purchase_result.emit(item.name + (" taxıldı." if profile.equipped.get(item.slot) == id else " çıxarıldı."), true)
	return true

func claim_win() -> int:
	if session.mode != "won" or session.reward_claimed: return 0
	var key := session.route_id + ":" + session.station_id
	var door_key := key + ":" + str(session.door_index)
	var first_clear: bool = not profile.door_records.get(door_key, false)
	var base := 42 + session.difficulty * 7 + int(ceil(session.time_left * 4)) + session.obstacle_coins
	var reward := base if first_clear else maxi(25, int(base * 0.45))
	profile.door_records[door_key] = true
	profile.total_doors += 1
	profile.xp += 65 + session.difficulty * 10
	profile.best_combo = maxi(int(profile.best_combo), session.best_combo)
	if session.door_index + 1 == session.doors_total:
		var first_station: bool = not profile.station_results.has(key)
		var best_ms := int(round(session.station_elapsed * 1000))
		var old: Dictionary = profile.station_results.get(key, {})
		profile.station_results[key] = {
			"stars": maxi(int(old.get("stars", 0)), session.station_stars),
			"best_ms": mini(int(old.get("best_ms", 300000)), best_ms)
		}
		if first_station: reward += 140 + session.difficulty * 10
		profile.route_progress[session.route_id] = maxi(int(profile.route_progress[session.route_id]), mini(session.station_index + 1, current_route().stations.size() - 1))
		if session.station_index == current_route().stations.size() - 1 and not session.route_id in profile.route_medals:
			profile.route_medals.append(session.route_id)
			reward += 500
	profile.coins += reward
	session.reward = reward
	session.reward_claimed = true
	persist()
	profile_changed.emit()
	return reward

func advance_station() -> bool:
	if session.mode != "won" or not session.reward_claimed or session.door_index + 1 != session.doors_total: return false
	if selected_station + 1 >= current_route().stations.size(): return false
	selected_station += 1
	prepare_station()
	session.start()
	return true

func setting(key: String, value: bool) -> void:
	if not profile.settings.has(key): return
	profile.settings[key] = value
	persist()
	profile_changed.emit()

func completed_stations(route_id: String = "") -> int:
	var count := 0
	for key in profile.station_results:
		if route_id.is_empty() or key.begins_with(route_id + ":"): count += 1
	return count

func unique_stations() -> int:
	var ids := {}
	for key in profile.station_results:
		ids[key.split(":")[1]] = true
	return ids.size()

func persist() -> void:
	if not test_mode:
		save_ok = MetroStore.save_profile(profile, routes, items)
