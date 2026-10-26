extends Node

signal changed
signal completed(id: String)

const SAVE_PATH := "user://mommy-native-world-v1.json"
const BACKUP_PATH := "user://mommy-native-world-v1-backup.json"
const LEGACY_PATH := "user://capacitor-save-v3.json"
const NEEDS := ["energy", "food", "mood", "babyFood", "babySleep", "comfort", "bond"]
const EARLIEST := {"name": 3, "kick": 3, "assemble": 6, "birthplan": 7, "contractions": 8, "call": 8, "birth": 8}
const LOCATIONS := {"home": 15, "market": 12, "cafe": 18, "clinic": 25, "lakeside": 15}
const MEAL := ["vegetables", "milk", "bread"]
const SKINS := ["#f4cbae", "#e3ae87", "#bd8059", "#8c573f", "#623e30"]
const HAIRS := ["#53372e", "#241e25", "#966349", "#d5a66b", "#b96550"]
const OUTFITS := ["#ad94cd", "#dc9fac", "#8cb8a3", "#d6a377", "#82a8bd"]

var definitions: Dictionary
var catalogue: Dictionary
var state: Dictionary
var world := {"schema": "mommy-world-v1", "position": [0.0, 0.11, 3.0], "yaw": 0.0, "doors": {}, "props": {}, "quality": "balanced"}
var activities: Dictionary = {}
var persist := true
var paused := false
var error := ""
var autosave := 0.0
var notification_time := 0.0
var acceptance := false

func _ready() -> void:
	definitions = JSON.parse_string(FileAccess.get_file_as_string("res://data/simulation.json"))
	catalogue = JSON.parse_string(FileAccess.get_file_as_string("res://data/catalogue.json"))
	for activity in definitions.activities:
		activities[activity.id] = activity
	state = definitions.defaultState.duplicate(true)
	acceptance = OS.is_debug_build() and ("--self-test" in OS.get_cmdline_user_args() or OS.get_environment("MOMMY_ENGINE_ACCEPTANCE") == "1")
	if acceptance:
		persist = false
		return
	for path in [SAVE_PATH, BACKUP_PATH, LEGACY_PATH]:
		if not FileAccess.file_exists(path):
			continue
		var data: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
		var game: Variant = data.get("game", data) if data is Dictionary else null
		if load_game(game):
			if data is Dictionary and data.get("world") is Dictionary and valid_world(data.world):
				world = data.world
			break

func _process(delta: float) -> void:
	if not state.get("started", false) or paused:
		return
	dispatch({"type": "TICK", "dt": delta}, false)
	autosave += delta
	if autosave > 6.0:
		autosave = 0.0
		save_game()

func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_PAUSED or what == NOTIFICATION_WM_CLOSE_REQUEST:
		save_game()

func tr_copy(value: Array) -> String:
	return str(value[1 if state.language == "en" else 2 if state.language == "tr" else 0])

func copy3(az: String, en: String, tr: String) -> Array:
	return [az, en, tr]

func chapter() -> Dictionary:
	return definitions.chapters[int(state.chapter)]

func current_step() -> Dictionary:
	for step in chapter().mission.steps:
		if step.id not in state.missions.completed:
			return step
	return {}

func progress() -> Vector2i:
	var done := 0
	for step in chapter().mission.steps:
		if step.id in state.missions.completed:
			done += 1
	return Vector2i(done, chapter().mission.steps.size())

func week() -> int:
	var done := progress()
	return roundi(float(chapter().week) + float(chapter().endWeek - chapter().week) * done.x / done.y)

func activity_location(id: String) -> String:
	if id in ["talk", "help", "read", "breathe", "water"] and state.location in ["lakeside", "cafe"]:
		return state.location
	if id in ["feed", "diaper", "skin", "journal", "rest", "water", "breathe", "help", "talk", "name"] and state.location == "clinic":
		return "clinic"
	return str(activities[id].get("location", "clinic" if id == "checkup" else "home"))

func available(id: String) -> bool:
	if not activities.has(id) or id in ["travel", "birth"]:
		return false
	var activity: Dictionary = activities[id]
	return (not activity.get("babyOnly", false) or state.pregnancy.born) and (not activity.get("pregnancyOnly", false) or not state.pregnancy.born) and int(state.chapter) >= EARLIEST.get(id, 0) and (id != "test" or int(state.chapter) == 0) and activity_location(id) == state.location

func supplies(id: String) -> bool:
	error = ""
	if id == "cook":
		for product in MEAL:
			if int(state.household.groceries[product]) < 1:
				error = "Ərzaq çatmır. Marketdə tərəvəz, süd və çörək al."
				return false
	if id == "laundry" and laundry_load() == 0:
		error = "Paltar səbəti artıq səliqəlidir."
		return false
	return true

func laundry_load() -> int:
	return mini(6, int(state.household.laundry.dirty + state.household.laundry.clean))

func daily_goals() -> Array:
	var laundry: bool = int(state.day) % 2 == 1 and (laundry_load() > 0 or "laundry" in state.household.chores)
	return ["cook", "laundry" if laundry else "clean", "coffee" if state.household.weather == "rain" else "lakesideWalk", "help"]

func change() -> void:
	state.revision = int(state.revision) + 1
	changed.emit()

func dispatch(action: Dictionary, save := true) -> bool:
	var accepted := true
	var kind: String = action.get("type", "")
	var previous: Dictionary = state.duplicate(true) if kind in ["START", "AVATAR", "SETTINGS"] else {}
	match kind:
		"START":
			var index := 10 if int(action.get("chapter", 0)) in [4, 10] else 0
			state = definitions.defaultState.duplicate(true)
			state.started = true
			state.avatar = action.get("avatar", state.avatar).duplicate(true)
			state.language = action.get("language", "az")
			state.chapter = index
			state.unlockedChapter = index
			state.location = "clinic" if index == 10 else "home"
			state.memories = [chapter_memory(index)]
			for c in definitions.chapters.slice(0, index):
				state.missions.rewards.append(c.id)
				for step in c.mission.steps:
					state.missions.completed.append(step.id)
			state.pregnancy.born = index >= 9
			state.pregnancy.birthPlan = "vaginal" if index >= 9 else "undecided"
			state.pregnancy.birthStage = 4 if index >= 9 else 0
		"TICK":
			var elapsed := clampf(float(action.get("dt", 0.0)), 0.0, 1.1) * int(state.settings.speed)
			if not state.started or elapsed == 0.0:
				return false
			var fatigue := 1.5 if not state.pregnancy.born and week() >= 28 else 1.0
			var effects := {"energy": -.06 * fatigue, "food": -.07, "mood": -.025}
			if state.pregnancy.born:
				effects.merge({"babyFood": -.06, "babySleep": -.04, "comfort": -.045})
			needs_after(effects, elapsed)
			state.time = minf(1380.0, float(state.time) + elapsed * 1.25)
			if state.activity != null:
				state.activity.elapsed += elapsed
				if float(state.activity.elapsed) >= float(activities[state.activity.id].seconds):
					finish_activity()
					change()
					if save:
						save_game()
					return true
			state.household.cleanliness = maxf(10.0, float(state.household.cleanliness) - elapsed * .009)
		"BEGIN":
			var id: String = action.get("id", "")
			if not state.started or state.activity != null or not available(id) or not supplies(id):
				return false
			if id == "groceries" and (float(action.get("quality", 0)) <= 0 or int(state.household.purchases) == 0):
				return false
			state.activity = {"id": id, "elapsed": 0.0, "quality": clampf(float(action.get("quality", 0)), 0.0, 100.0)}
			if action.has("sourceId"):
				state.activity.sourceId = str(action.sourceId).left(100)
		"CANCEL_ACTIVITY":
			if state.activity == null:
				return false
			state.activity = null
		"TRAVEL":
			var location: String = action.get("location", "")
			if state.activity != null or state.location == location or not LOCATIONS.has(location):
				return false
			var step := current_step()
			if step.get("action") == "travel" and step.get("travelTo") == location and step.location == state.location:
				state.missions.completed.append(step.id)
				state.missions.quality[step.id] = 100
			state.location = location
			state.time = minf(1380.0, float(state.time) + LOCATIONS[location])
		"SHOP":
			if not state.started or state.activity != null or state.location != "market":
				return false
			var basket: Variant = action.get("basket")
			if not basket is Dictionary or basket.is_empty():
				return false
			var total := 0
			for id in basket:
				if not state.household.groceries.has(id) or not integer(basket[id], 0, 6) or int(state.household.groceries[id]) + int(basket[id]) > 40:
					return false
			for product in definitions.groceries:
				total += int(product.price) * int(basket.get(product.id, 0))
			if total == 0 or total > int(state.household.cash):
				error = "CHF büdcəsi bu səbətə çatmır."
				return false
			for id in basket:
				state.household.groceries[id] = int(state.household.groceries[id]) + int(basket[id])
			state.household.cash = int(state.household.cash) - total
			state.household.purchases = int(state.household.purchases) + 1
		"SLEEP":
			if int(state.dailyActions) < 3 or state.activity != null:
				return false
			day_end()
		"ADVANCE_CHAPTER":
			if not current_step().is_empty() or int(state.chapter) >= 13 or state.activity != null or int(state.chapter) == 8 and not state.pregnancy.born:
				return false
			day_end()
			state.chapter = int(state.chapter) + 1
			state.unlockedChapter = state.chapter
			state.chapterDay = 1
			state.stars = int(state.stars) + 1
			state.coins = int(state.coins) + 80
			state.xp = int(state.xp) + 45
			state.memories.push_front(chapter_memory(int(state.chapter)))
			state.memories = state.memories.slice(0, 120)
			state.needs.merge({"babyFood": 82, "babySleep": 85, "comfort": 88}, true)
			state.location = chapter().mission.steps[0].location
		"CLAIM_MISSION":
			if not current_step().is_empty() or chapter().id in state.missions.rewards:
				return false
			state.coins = int(state.coins) + int(chapter().mission.reward)
			state.xp = int(state.xp) + 60
			state.stars = int(state.stars) + 2
			state.missions.rewards.append(chapter().id)
		"CLAIM_LIFE_DAY":
			if int(state.household.dailyRewardDay) == int(state.day):
				return false
			for id in daily_goals():
				if id not in state.household.chores:
					return false
			state.household.dailyRewardDay = int(state.day)
			state.coins = int(state.coins) + 45
			state.xp = int(state.xp) + 35
		"BIRTH_PLAN":
			if state.pregnancy.born or action.get("plan") not in ["vaginal", "cesarean"]:
				return false
			state.pregnancy.birthPlan = action.plan
			for key in ["supportPerson", "comfort"]:
				if action.has(key):
					state.pregnancy[key] = action[key]
		"BOOK_APPOINTMENT":
			state.pregnancy.appointment = action.appointment.duplicate(true)
		"FEEDING":
			if action.get("method") not in ["breast", "bottle", "combination"]:
				return false
			state.pregnancy.feeding = action.method
		"BIRTH_STAGE":
			var stage := int(action.get("stage", 0))
			if not birth_ready() or stage != int(state.pregnancy.birthStage) + 1 or stage > 4:
				return false
			state.pregnancy.birthStage = stage
		"BIRTH_COMPLETE":
			if not birth_ready() or int(state.pregnancy.birthStage) != 4:
				return false
			state.pregnancy.born = true
			state.missions.completed.append(current_step().id)
			state.missions.quality["meet-baby"] = clampf(float(action.get("quality", 100)), 0, 100)
			state.coins = int(state.coins) + 100
			state.xp = int(state.xp) + 80
			state.totalActions = int(state.totalActions) + 1
			state.memories.push_front({"id": "birth-story", "kind": "milestone", "chapter": state.chapter, "day": state.day,
				"title": copy3("Xoş gəldin, balacam", "Welcome, little one", "Hoş geldin, bebeğim"), "description": copy3(str(state.avatar.babyName) + " ilə ilk qucaq.", "The first embrace with " + str(state.avatar.babyName) + ".", str(state.avatar.babyName) + " ile ilk kucak."), "icon": "baby"})
		"MEMORY":
			var memory: Dictionary = action.get("memory", {})
			if not valid_memory(memory):
				return false
			for item in state.memories:
				if item.id == memory.id:
					return false
			state.memories.push_front(memory)
			state.memories = state.memories.slice(0, 120)
		"LANGUAGE":
			if action.get("language") not in ["az", "en", "tr"]:
				return false
			state.language = action.language
		"SETTINGS":
			state.settings.merge(action.get("settings", {}), true)
		"AVATAR":
			state.avatar = action.avatar.duplicate(true)
		"LOAD":
			return load_game(action.get("state"))
		_:
			accepted = false
	if accepted:
		if kind in ["START", "AVATAR", "SETTINGS"] and not valid_state(state):
			state = previous
			return false
		if kind == "TICK":
			state.revision = int(state.revision) + 1
			notification_time += float(action.get("dt", 0))
			if notification_time >= .2:
				notification_time = 0.0
				changed.emit()
		else:
			change()
		if save and kind != "TICK":
			save_game()
	return accepted

func birth_ready() -> bool:
	return int(state.chapter) == 8 and state.location == "clinic" and not state.pregnancy.born and state.pregnancy.birthPlan != "undecided" and current_step().get("action") == "birth"

func needs_after(effects: Dictionary, multiplier := 1.0) -> void:
	for key in effects:
		state.needs[key] = clampf(float(state.needs[key]) + float(effects[key]) * multiplier, 0.0, 100.0)

func chapter_memory(index: int) -> Dictionary:
	var c: Dictionary = definitions.chapters[index]
	return {"id": "chapter-%d" % index, "kind": "chapter", "chapter": index, "day": state.day, "title": c.title, "description": c.subtitle, "icon": c.icon}

func finish_activity() -> void:
	var active: Dictionary = state.activity
	var id: String = active.id
	var activity: Dictionary = activities[id]
	var repeats: int = state.completedToday.count(id)
	var reward_scale := .4 if repeats >= 2 else 1.0
	var bonus := 1.0 + clampf(float(active.quality), 0.0, 100.0) / 200.0
	needs_after(activity.effect, bonus)
	var step := current_step()
	if step.get("action") == id and step.location == state.location and (not step.get("interactive", false) or float(active.quality) > 0):
		state.missions.completed.append(step.id)
		state.missions.quality[step.id] = active.quality
	if id == "scan" and week() not in state.pregnancy.appointments:
		state.pregnancy.appointments.append(week())
	if id in ["help", "talk"]:
		state.pregnancy.support = clampf(float(state.pregnancy.support) + 8, 0, 100)
	if id in ["test", "scan", "assemble", "name", "skin"]:
		var memory_id := "%s-%d" % [id, int(state.chapter)]
		if not state.memories.any(func(m: Dictionary) -> bool: return m.id == memory_id):
			state.memories.push_front({"id": memory_id, "kind": "milestone", "chapter": state.chapter, "day": state.day, "title": activity.title, "description": activity.result, "icon": activity.icon})
	if id == "journal":
		var memory_id := "journal-%d" % int(state.day)
		if not state.memories.any(func(m: Dictionary) -> bool: return m.id == memory_id):
			state.memories.push_front({"id": memory_id, "kind": "day", "chapter": state.chapter, "day": state.day, "title": copy3("Bu günün kiçik sevinci", "Today’s little joy", "Bugünün küçük sevinci"), "description": chapter().subtitle, "icon": "pen"})
	if id == "play":
		var memory_id := "discovery-%d" % int(state.chapter)
		if not state.memories.any(func(m: Dictionary) -> bool: return m.id == memory_id):
			state.memories.push_front({"id": memory_id, "kind": "milestone", "chapter": state.chapter, "day": state.day, "title": chapter().title, "description": activity.result, "icon": "sparkles"})
	state.time = minf(1380.0, float(state.time) + float(activity.minutes))
	state.xp = int(state.xp) + roundi(float(activity.xp) * bonus * reward_scale)
	state.coins = int(state.coins) + roundi(float(activity.coins) * bonus * reward_scale)
	state.skills[activity.skill] = mini(9999, int(state.skills[activity.skill]) + roundi(8 * bonus))
	state.completedToday = state.completedToday.slice(maxi(0, state.completedToday.size() - 60))
	state.completedToday.append(id)
	state.dailyActions = int(state.dailyActions) + 1
	state.totalActions = int(state.totalActions) + 1
	state.memories = state.memories.slice(0, 120)
	if id not in state.household.chores:
		state.household.chores.append(id)
	if id == "laundry":
		var clean := mini(6, int(state.household.laundry.clean))
		var dirty := mini(6 - clean, int(state.household.laundry.dirty))
		state.household.laundry.clean = int(state.household.laundry.clean) - clean
		state.household.laundry.dirty = int(state.household.laundry.dirty) - dirty
		state.household.laundry.folded = int(state.household.laundry.folded) + clean + dirty
	if id in ["clean", "tidy"]:
		state.household.cleanliness = minf(100.0, float(state.household.cleanliness) + 23)
	if id in ["talk", "help"]:
		state.household.relationship = mini(100, int(state.household.relationship) + 6)
	if id == "help":
		state.household.cleanliness = minf(100.0, float(state.household.cleanliness) + 5)
	if id == "diaper":
		state.household.laundry.dirty = mini(36, int(state.household.laundry.dirty) + 1)
	if id == "cook":
		for product in MEAL:
			state.household.groceries[product] = int(state.household.groceries[product]) - 1
		state.household.cleanliness = maxf(10.0, float(state.household.cleanliness) - 3)
		state.household.meals = int(state.household.meals) + 1
		state.household.moodlet = "nourished"
	elif id == "lakesideWalk":
		state.household.moodlet = "inspired"
	elif id in ["rest", "coffee"]:
		state.household.moodlet = "rested"
	elif id in ["feed", "skin", "help"]:
		state.household.moodlet = "connected"
	state.activity = null
	completed.emit(id)

func day_end() -> void:
	var day := int(state.day)
	var memory := {"id": "day-%d" % day, "kind": "day", "day": day, "chapter": state.chapter, "icon": "sun",
		"title": copy3("Bir gün də sevgi ilə", "Another day with love", "Bir gün daha sevgiyle"),
		"description": copy3("%d kiçik an, bir isti yuva." % int(state.dailyActions), "%d little moments, one cosy home." % int(state.dailyActions), "%d küçük an, sıcak bir yuva." % int(state.dailyActions))}
	state.day = day + 1
	state.chapterDay = int(state.chapterDay) + 1
	state.time = 510.0
	state.needs.merge({"energy": 92, "food": maxf(52, float(state.needs.food) - 12), "babyFood": maxf(55, float(state.needs.babyFood) - 10), "babySleep": 90,
		"comfort": maxf(65, float(state.needs.comfort)), "mood": maxf(72, float(state.needs.mood))}, true)
	state.completedToday = []
	state.dailyActions = 0
	state.dailyRewardClaimed = false
	state.coins = int(state.coins) + 12
	state.memories = state.memories.filter(func(m: Dictionary) -> bool: return m.id != memory.id)
	state.memories.push_front(memory)
	state.memories = state.memories.slice(0, 120)
	state.household.chores = []
	state.household.cleanliness = maxf(10, float(state.household.cleanliness) - 8)
	state.household.cash = mini(10000000, int(state.household.cash) + (85000 if day % 7 == 0 else 0))
	state.household.laundry.dirty = mini(36, int(state.household.laundry.dirty) + (5 if state.pregnancy.born else 3))
	state.household.weather = ["sunny", "cloudy", "sunny", "rain", "sunny", "cloudy", "sunny"][day % 7]
	state.household.moodlet = "home"

func integer(value: Variant, minimum: int, maximum: int) -> bool:
	return (value is float or value is int) and is_finite(float(value)) and float(value) == int(value) and int(value) >= minimum and int(value) <= maximum

func valid_memory(memory: Variant) -> bool:
	return memory is Dictionary and memory.get("id") is String and str(memory.id).length() <= 100 and memory.get("kind") in ["chapter", "milestone", "photo", "story", "day"] and integer(memory.get("chapter"), 0, 13) and integer(memory.get("day"), 1, 100000) and valid_copy(memory.get("title")) and valid_copy(memory.get("description")) and (not memory.has("nativePhoto") or str(memory.nativePhoto).begins_with("user://photos/") and ".." not in str(memory.nativePhoto))

func valid_copy(value: Variant) -> bool:
	return value is Array and value.size() == 3 and value.all(func(item: Variant) -> bool: return item is String and item.length() < 5000)

func valid_world(data: Dictionary) -> bool:
	if data.get("schema") != "mommy-world-v1" or not valid_position(data.get("position")) or not data.get("doors") is Dictionary or not data.get("props") is Dictionary:
		return false
	if data.doors.size() > 80 or data.props.size() > 120 or data.get("quality", "balanced") not in ["balanced", "high"]:
		return false
	for key in data.doors:
		if not key is String or key.length() > 100 or not data.doors[key] is bool:
			return false
	for key in data.props:
		if not key is String or key.length() > 100 or not valid_position(data.props[key]):
			return false
	return true

func valid_position(value: Variant) -> bool:
	return value is Array and value.size() == 3 and value.all(func(v: Variant) -> bool: return (v is float or v is int) and is_finite(float(v)) and absf(float(v)) < 200)

func valid_state(data: Variant) -> bool:
	if not data is Dictionary:
		return false
	for key in definitions.defaultState:
		if not data.has(key):
			return false
	if data.schema != 3 or not data.started is bool or data.language not in ["az", "en", "tr"] or not integer(data.chapter, 0, 13) or not integer(data.unlockedChapter, int(data.chapter), 13):
		return false
	for key in ["coins", "xp", "stars", "revision", "totalActions"]:
		if not integer(data[key], 0, 100000000):
			return false
	for key in ["day", "chapterDay"]:
		if not integer(data[key], 1, 100000):
			return false
	if not data.needs is Dictionary or not data.household is Dictionary or not data.avatar is Dictionary or not data.missions is Dictionary or not data.pregnancy is Dictionary or not data.settings is Dictionary:
		return false
	for key in NEEDS:
		if not data.needs.get(key) is float and not data.needs.get(key) is int:
			return false
		if not is_finite(float(data.needs[key])) or float(data.needs[key]) < 0 or float(data.needs[key]) > 100:
			return false
	if data.avatar.get("skin") not in SKINS or data.avatar.get("hair") not in HAIRS or data.avatar.get("outfit") not in OUTFITS or not data.avatar.get("name") is String or not data.avatar.get("babyName") is String or str(data.avatar.name).length() > 24 or str(data.avatar.babyName).length() > 24:
		return false
	if data.avatar.get("hairstyle") not in ["bob", "bun", "long"] or data.avatar.get("personality") not in ["dreamer", "maker", "gentle"] or data.avatar.get("outfitStyle") not in ["dress", "casual", "knit"]:
		return false
	if not data.time is float and not data.time is int or not is_finite(float(data.time)) or float(data.time) < 0 or float(data.time) > 1440:
		return false
	if not data.household.get("groceries") is Dictionary or not data.household.get("laundry") is Dictionary or not integer(data.household.get("cash"), 0, 10000000):
		return false
	for product in definitions.groceries:
		if not integer(data.household.groceries.get(product.id), 0, 40):
			return false
	for key in ["dirty", "clean", "folded"]:
		if not integer(data.household.laundry.get(key), 0, 100000):
			return false
	for key in ["relationship", "meals", "purchases", "dailyRewardDay"]:
		if not integer(data.household.get(key), 0, 100 if key == "relationship" else 100000):
			return false
	if data.household.get("weather") not in ["sunny", "cloudy", "rain"] or data.household.get("moodlet") not in ["home", "nourished", "inspired", "rested", "connected"]:
		return false
	if not data.household.get("chores") is Array or data.household.chores.size() > activities.size() or not data.household.chores.all(func(item: Variant) -> bool: return activities.has(item)):
		return false
	if not data.household.get("cleanliness") is float and not data.household.get("cleanliness") is int or not is_finite(float(data.household.cleanliness)) or float(data.household.cleanliness) < 0 or float(data.household.cleanliness) > 100:
		return false
	if data.location not in LOCATIONS or not integer(data.settings.get("speed"), 0, 2) or not data.memories is Array or data.memories.size() > 120 or not data.memories.all(valid_memory):
		return false
	if not data.missions.get("completed") is Array or not data.missions.get("quality") is Dictionary or not data.missions.get("rewards") is Array:
		return false
	var mission_ids: Array[String] = []
	var chapter_ids: Array[String] = []
	for c in definitions.chapters:
		chapter_ids.append(c.id)
		for step in c.mission.steps:
			mission_ids.append(step.id)
	if data.missions.completed.size() > mission_ids.size() or not data.missions.completed.all(func(item: Variant) -> bool: return item in mission_ids) or not data.missions.rewards.all(func(item: Variant) -> bool: return item in chapter_ids):
		return false
	for key in data.missions.quality:
		if key not in mission_ids or not data.missions.quality[key] is float and not data.missions.quality[key] is int or float(data.missions.quality[key]) < 0 or float(data.missions.quality[key]) > 100:
			return false
	for key in ["sound", "haptics", "reducedMotion"]:
		if not data.settings.get(key) is bool:
			return false
	for key in ["care", "cooking", "creativity", "balance"]:
		if not data.skills is Dictionary or not integer(data.skills.get(key), 0, 99999):
			return false
	if not data.completedToday is Array or data.completedToday.size() > 61 or not data.completedToday.all(func(item: Variant) -> bool: return activities.has(item)) or not integer(data.dailyActions, 0, 100000):
		return false
	if not data.dailyRewardClaimed is bool or data.theme not in ["lavender", "peach", "sage"] or not data.inventory is Array or not data.placements is Array or not data.favourites is Array or data.favourites.size() > 500:
		return false
	if data.pregnancy.get("birthPlan") not in ["undecided", "vaginal", "cesarean"] or not data.pregnancy.get("born") is bool or not integer(data.pregnancy.get("birthStage"), 0, 4):
		return false
	if data.pregnancy.get("feeding") not in ["breast", "bottle", "combination"] or data.pregnancy.get("supportPerson") not in ["partner", "family"] or data.pregnancy.get("comfort") not in ["music", "light"]:
		return false
	if not data.pregnancy.get("appointments") is Array or not data.pregnancy.appointments.all(func(value: Variant) -> bool: return integer(value, 0, 42)):
		return false
	return true

func load_game(data: Variant) -> bool:
	if not data is Dictionary:
		return false
	var next: Dictionary = data.duplicate(true)
	if next.get("schema") == 2:
		next.schema = 3
		next.household = definitions.defaultState.household.duplicate(true)
		next.pregnancy.merge({"supportPerson": "partner", "comfort": "music"})
	if not valid_state(next):
		return false
	next.activity = null
	next.settings.speed = 1 if int(next.settings.speed) == 0 else next.settings.speed
	state = next
	changed.emit()
	return true

func save_game() -> void:
	if not persist or not state.get("started", false):
		return
	state.lastSaved = Time.get_datetime_string_from_system(true) + "Z"
	var bytes := JSON.stringify({"schema": "mommy-native-world-save-v1", "game": state, "world": world})
	var temporary := SAVE_PATH + ".tmp"
	var file := FileAccess.open(temporary, FileAccess.WRITE)
	if file == null:
		error = "Oyun yaddaşı saxlanılmadı."
		return
	file.store_string(bytes)
	file.close()
	if FileAccess.file_exists(SAVE_PATH):
		var old: Variant = JSON.parse_string(FileAccess.get_file_as_string(SAVE_PATH))
		if old is Dictionary and valid_state(old.get("game")):
			DirAccess.copy_absolute(SAVE_PATH, BACKUP_PATH)
	DirAccess.rename_absolute(temporary, SAVE_PATH)
