extends RefCounted

var checks: Array = []
var failures: Array = []

func check(condition: bool, name: String) -> void:
	checks.append({"check": name, "passed": condition})
	if not condition: failures.append(name)

func play_door(session: MetroSession, cadence: float = 0.17) -> void:
	if session.mode == "idle": session.start()
	while session.mode == "countdown": session.tick(0.1)
	var iterations := 0
	while session.mode == "playing" and iterations < 1000:
		var obstacle := session.active_obstacle()
		if not obstacle.is_empty(): session.change_lane((int(obstacle.lane) + 1) % 3)
		if session.energy >= 60: session.burst()
		session.tick(cadence)
		session.tap()
		iterations += 1

func run(game: Node) -> Dictionary:
	checks.clear()
	failures.clear()
	check(game.stations.size() == 27, "All 27 distinct Baku Metro station platforms are present")
	check(game.routes.size() == 5, "Five playable main/branch itineraries")
	var route_green: Dictionary = game.route_by_id("green")
	var route_red: Dictionary = game.route_by_id("red")
	check(route_green.stations.size() == 18 and route_green.stations.front() == "hazi" and route_green.stations.back() == "darnagul", "Həzi Aslanov–Dərnəgül station order")
	check(route_red.stations.size() == 12 and route_red.stations.front() == "hazi" and route_red.stations.back() == "ichari", "Həzi Aslanov–İçərişəhər station order")
	check(route_green.stations.slice(0, 10) == route_red.stations.slice(0, 10), "Shared trunk follows the same ten station platforms")
	var ids := {}
	var itinerary_count := 0
	var total_doors := 0
	for station in game.stations:
		check(not ids.has(station.id), "Unique station id: " + station.name)
		ids[station.id] = true
	for route in game.routes:
		itinerary_count += route.stations.size()
		for index in range(route.stations.size()):
			check(ids.has(route.stations[index]), "Route station exists: " + route.id + "/" + route.stations[index])
			total_doors += MetroRules.door_count(route, index)
	check(itinerary_count == 37 and total_doors == 116, "Campaign has 37 station stages and 116 doors")
	var durations_ok := true
	for difficulty in range(30):
		for door in range(4):
			for equipment_time in [0.0, 1.0]:
				var duration := MetroRules.door_duration(difficulty, door, equipment_time)
				durations_ok = durations_ok and duration >= 5 and duration <= 10
	check(durations_ok, "Every opening duration is within 5–10 seconds, including watch")
	game.profile = MetroRules.fresh_profile(game.routes)
	game.choose_route("green")
	check(game.profile.coins == 0 and game.profile.total_doors == 0, "Fresh profile starts with honest zero balances")
	check(not game.choose_station(1), "Future station cannot be entered before previous completion")
	check(not game.buy("strength") and game.profile.upgrades.strength == 0, "Insufficient jetons cannot purchase strength")
	var idle: MetroSession = game.session
	check(not idle.tap() and not idle.burst(), "Idle state cannot tap or activate burst")
	check(idle.start() and not idle.start(), "A door has a single start transition")
	check(not idle.tap(), "Countdown cannot be tapped")
	idle.tick(1.6)
	check(idle.mode == "playing" and is_equal_approx(idle.time_left, idle.initial_time), "Countdown leaves the opening timer untouched")
	var time_before := idle.time_left
	idle.pause()
	idle.tick(300)
	check(idle.mode == "paused" and is_equal_approx(time_before, idle.time_left), "Pause freezes the timer over a long suspension")
	check(not idle.tap() and not idle.burst(), "Paused game cannot gain progress or energy")
	idle.resume()
	idle.tick(0.17)
	check(idle.tap(), "A playing tap advances the obstacle")
	var progress_before := idle.progress()
	check(not idle.tap() and is_equal_approx(idle.progress(), progress_before), "Same-frame duplicate input is rejected")
	idle.tick(0.17)
	idle.tap()
	check(idle.combo == 2, "Rhythmic taps build a combo")
	idle.tick(0.7)
	check(idle.combo == 0, "Combo expires when rhythm stops")
	check(not idle.burst(), "Burst cannot activate below 60 energy")
	idle.energy = 60
	check(idle.burst() and idle.energy == 0 and idle.burst_left > 0, "Burst spends 60 energy and boosts power")
	check(not idle.burst(), "Burst cannot repeat during cooldown")
	var failed := MetroSession.new()
	failed.configure(route_green, game.station_by_id("hazi"), 0, game.player_stats())
	failed.start()
	failed.tick(1.6)
	failed.tick(11)
	check(failed.mode == "lost" and failed.time_left == 0, "Door closes and run loses at zero time")
	check(not failed.tap(), "Closed door never accepts a last-minute tap")
	game.session = failed
	check(game.claim_win() == 0 and game.profile.coins == 0, "A loss cannot claim currency")
	check(failed.retry() and failed.mode == "countdown", "Retry restarts the failed door")
	var bonus := MetroSession.new()
	bonus.configure(route_green, game.station_by_id("hazi"), 0, game.player_stats())
	bonus.start()
	bonus.tick(1.6)
	while bonus.obstacle_index < 3 and bonus.mode == "playing":
		bonus.change_lane((int(bonus.active_obstacle().lane) + 1) % 3)
		bonus.tick(0.17)
		bonus.tap()
	check(is_equal_approx(bonus.bonus_seconds, 1.0), "First time opportunity grants exactly +1 second")
	while bonus.mode == "playing":
		bonus.tick(0.17)
		bonus.change_lane((int(bonus.active_obstacle().lane) + 1) % 3)
		bonus.tap()
	check(bonus.mode == "won" and is_equal_approx(bonus.bonus_seconds, 3.0), "Both opportunities grant +1 and +2 seconds once")
	game.session = bonus
	var reward: int = game.claim_win()
	var balance: int = game.profile.coins
	check(reward > 0 and bonus.reward_claimed, "Cleared door earns a real jeton reward")
	check(game.claim_win() == 0 and game.profile.coins == balance, "Double-claim cannot duplicate rewards")
	check(int(game.profile.route_progress.green) == 0, "One door does not unlock the next station")
	check(bonus.next_door() and bonus.door_index == 1, "Claimed door advances to the next door")
	play_door(bonus)
	game.claim_win()
	bonus.next_door()
	play_door(bonus)
	game.claim_win()
	check(int(game.profile.route_progress.green) == 1 and game.profile.station_results.has("green:hazi"), "Only the final door unlocks Əhmədli")
	check(game.choose_station(0), "Completed stations remain replayable")
	play_door(game.session)
	var replay_reward: int = game.claim_win()
	check(replay_reward > 0 and replay_reward < reward, "Replay earns reduced currency")
	game.profile.coins = 10000
	var base_stats: Dictionary = game.player_stats()
	var cost := MetroRules.item_price(game.item_by_id("strength"), game.profile)
	var pre_purchase: int = game.profile.coins
	check(game.buy("strength") and game.profile.coins == pre_purchase - cost, "Strength purchase deducts exactly its price")
	check(game.player_stats().power > base_stats.power and game.player_stats().size > base_stats.size, "Strength changes TAP power and body size")
	check(MetroRules.item_price(game.item_by_id("strength"), game.profile) > cost, "Upgrade price scales after purchase")
	check(game.buy("speed") and game.player_stats().speed > base_stats.speed, "Speed affects actual statistics")
	check(game.buy("sneakers") and game.profile.equipped.feet == "sneakers" and game.player_stats().grip > 0, "Sprint shoes equip and resist sliding")
	check(game.buy("helmet") and game.player_stats().guard == 0.5, "Helmet equips obstacle stun resistance")
	check(game.buy("headphones") and game.profile.equipped.head == "headphones" and game.player_stats().guard == 0, "Head-slot replacement never stacks helmet and headphones")
	check(game.equip("helmet") and game.profile.equipped.head == "helmet", "Owned helmet can be re-equipped")
	check(game.buy("watch") and game.player_stats().time == 1, "Watch adds one second before the duration cap")
	var balance_before: int = game.profile.coins
	game.buy("watch")
	check(game.profile.coins == balance_before and not game.profile.equipped.has("accessory"), "Owned item toggles without duplicate spending")
	game.profile.upgrades.strength = 8
	check(not game.buy("strength") and game.profile.upgrades.strength == 8, "Maximum upgrade rank is enforced")
	check(not game.equip("not-an-item"), "Unknown gear cannot equip")
	var raw: Dictionary = game.profile.duplicate(true)
	raw.coins = -200
	raw.upgrades.strength = 900
	raw.owned.append("unknown-item")
	raw.equipped.back = "unknown-item"
	raw.route_progress.green = 9999
	var valid := MetroRules.validate_profile(raw, game.routes, game.items)
	check(valid.coins == 0 and valid.upgrades.strength == 8 and valid.route_progress.green == 17, "Save validation clamps balances, ranks and route bounds")
	check(not "unknown-item" in valid.owned and not valid.equipped.has("back"), "Save validation drops unknown/unowned gear")
	check(MetroRules.validate_profile({"schema": 90}, game.routes, game.items).is_empty(), "Unknown save versions are rejected")
	check(MetroRules.validate_profile("corrupt", game.routes, game.items).is_empty(), "Malformed save payloads are rejected")
	var path := "user://metro-acceptance-isolated.json"
	for suffix in ["", ".bak", ".tmp"]:
		if FileAccess.file_exists(path + suffix): DirAccess.remove_absolute(path + suffix)
	check(MetroStore.save_profile(game.profile, game.routes, game.items, path), "Profile saves with a hashed envelope")
	var first_balance: int = game.profile.coins
	game.profile.coins += 123
	check(MetroStore.save_profile(game.profile, game.routes, game.items, path), "Atomic replacement retains prior valid save")
	check(MetroStore.load_profile(game.routes, game.items, path).coins == first_balance + 123, "Reload keeps the exact new balance")
	var file := FileAccess.open(path, FileAccess.WRITE)
	file.store_string("{broken json}")
	file.close()
	check(MetroStore.load_profile(game.routes, game.items, path).coins == first_balance, "Corrupt primary recovers valid backup")
	for suffix in ["", ".bak", ".tmp"]:
		if FileAccess.file_exists(path + suffix): DirAccess.remove_absolute(path + suffix)
	# Complete campaign uses earned currency and public transitions.
	game.profile = MetroRules.fresh_profile(game.routes)
	for route in game.routes:
		game.choose_route(route.id)
		for index in range(route.stations.size()):
			check(game.choose_station(index), "Unlocked station: " + route.id + "/" + str(index + 1))
			for door in range(MetroRules.door_count(route, index)):
				play_door(game.session)
				check(game.session.mode == "won", "Playable door: %s/%d/%d" % [route.id, index + 1, door + 1])
				game.claim_win()
				if door + 1 < game.session.doors_total: game.session.next_door()
			for id in ["strength", "speed", "stamina", "gloves", "sneakers", "helmet", "watch", "jacket", "backpack"]:
				var item: Dictionary = game.item_by_id(id)
				if item.kind == "gear" and id in game.profile.owned: continue
				if item.kind == "upgrade" and int(game.profile.upgrades[id]) >= 4: continue
				if game.profile.coins >= MetroRules.item_price(item, game.profile): game.buy(id)
		check(route.id in game.profile.route_medals, "Route medal: " + route.id)
	check(game.unique_stations() == 27, "Campaign reaches all 27 unique station platforms")
	check(game.profile.total_doors == 116 and game.completed_stations() == 37, "All 116 doors and 37 station stages complete")
	check(game.profile.coins >= 0 and game.profile.route_medals.size() == 5, "Full campaign economy remains valid")
	return {"engine": "Godot", "version": ProjectSettings.get_setting("application/config/version"), "checks": checks, "failures": failures, "stations": 27, "stages": 37, "doors": 116, "physical_device": false}
