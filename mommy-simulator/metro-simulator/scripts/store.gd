class_name MetroStore
extends RefCounted

const SAVE_PATH := "user://metro-progress-v1.json"

static func decode(path: String, routes: Array, items: Array) -> Dictionary:
	if not FileAccess.file_exists(path): return {}
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null or file.get_length() > 1048576: return {}
	var parser := JSON.new()
	if parser.parse(file.get_as_text()) != OK: return {}
	var envelope: Variant = parser.data
	if not envelope is Dictionary or envelope.get("format") != "metro-save-v1": return {}
	var payload: Variant = envelope.get("payload")
	if not payload is String or payload.sha256_text() != envelope.get("sha256"): return {}
	if parser.parse(payload) != OK: return {}
	return MetroRules.validate_profile(parser.data, routes, items)

static func load_profile(routes: Array, items: Array, path: String = SAVE_PATH) -> Dictionary:
	var profile := decode(path, routes, items)
	if profile.is_empty(): profile = decode(path + ".bak", routes, items)
	return MetroRules.fresh_profile(routes) if profile.is_empty() else profile

static func save_profile(profile: Dictionary, routes: Array, items: Array, path: String = SAVE_PATH) -> bool:
	var validated := MetroRules.validate_profile(profile, routes, items)
	if validated.is_empty(): return false
	var payload := JSON.stringify(validated)
	var envelope := {"format": "metro-save-v1", "sha256": payload.sha256_text(), "payload": payload}
	var file := FileAccess.open(path + ".tmp", FileAccess.WRITE)
	if file == null: return false
	file.store_string(JSON.stringify(envelope))
	file.flush()
	file.close()
	if not decode(path, routes, items).is_empty():
		if DirAccess.copy_absolute(path, path + ".bak") != OK: return false
	return DirAccess.rename_absolute(path + ".tmp", path) == OK
