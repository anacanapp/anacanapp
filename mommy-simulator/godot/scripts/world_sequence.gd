class_name WorldSequence
extends Node

var world: Node3D
var hud: WorldHUD
var id := ""
var stage := 0
var working := false
var steps: Array[String] = []
var objects: Array[Node3D] = []
var progress: ProgressBar
var card: PanelContainer
var title: Label
var step_label: Label
var button: Button
var source_id := ""
var score := 100.0
var cook_heat := 52.0
var rhythm := 0.0
var total_samples := 0
var correct_samples := 0
var holding := false
var cooking := false
var heat_slider: HSlider
var input_timer := 0.0
var direct: DirectTasks
var original_position := Vector3.ZERO
var original_rotation := 0.0
var run_generation := 0

func setup(scene: Node3D, ui: WorldHUD) -> void:
	world = scene
	hud = ui
	direct = DirectTasks.new()
	add_child(direct)
	direct.setup(scene, self)
	direct.solved.connect(func() -> void:
		if working and is_instance_valid(button):
			button.disabled = false
			button.text = "Növbəti addım →" if stage < steps.size() - 1 else "Qayğını tamamla ✓"
	)
	direct.progress_changed.connect(func(done: int, total: int) -> void:
		if working and is_instance_valid(progress) and total > 0:
			progress.value = float(done) / total * 100
	)
	direct.feedback.connect(hud.toast)

func start(activity: String) -> void:
	if working or not Life.available(activity) or not Life.supplies(activity):
		return
	run_generation += 1
	id = activity
	stage = 0
	working = true
	score = 100.0
	rhythm = 0.0
	total_samples = 0
	correct_samples = 0
	holding = false
	cooking = false
	steps.clear()
	objects.clear()
	source_id = ""
	original_position = world.player.position
	original_rotation = world.player.actor.rotation.y
	match id:
		"cook": steps.assign(["Tərəvəzləri qaba yerləşdir", "Taxta lövhədə doğra", "Qazanı ocağa qoy", "Yeməyi süfrəyə ver"])
		"laundry": steps.assign(["Açıq rəngləri ayır", "Rəngli paltarları ayır", "Yuma maşınına yerləşdir", "Qurumağa as", "Təmiz paltarları qatla"])
		"clean", "tidy": steps.assign(["Masanı sil", "Rəfi səliqəyə sal", "Oyuncaqları yerinə qoy", "Döşəməni təmizlə"])
		"feed", "diaper", "sterilise": steps.assign(["Qayğı əşyalarını hazırla", "Rahat guşəni seç", "Balacanın qayğısını tamamla", "Yumşaq yaxınlıq"])
		"assemble": steps.assign(["Baş paneli birləşdir", "Döşək bazasını yerləşdir", "Yan məhəccəri bərkit", "Beşiyi tamamla"])
		"lullaby", "soothe", "breathe", "stretch", "kick": steps.assign(["Nəfəs al və basılı saxla", "Nəfəsi burax", "Sakit ritmi təkrarla", "Bir an da özünə vaxt"])
		"play": steps.assign(["Taxta oyuncağı göstər", "Rəngləri birləşdir", "Balacanla kəşf et", "Bu gülüşü yadda saxla"])
		"pack": steps.assign(["Sənədləri çantaya qoy", "Ana əşyalarını hazırla", "Körpə əşyalarını yerləşdir", "Çantanı bağla"])
		"carseat": steps.assign(["Oturacağı hazırla", "Sol kəməri yerləşdir", "Sağ kəməri yerləşdir", "Tokanı birləşdir"])
		"test": steps.assign(["Testi rəfdən götür", "Test səhnəsini hazırla", "İki xətti gözlə", "Bu anı yadda saxla"])
		_:
			working = false
			return
	hud.close_panel()
	hud.set_task_lock(true)
	if world.held:
		world.put_down()
	world.player.move_input = Vector2.ZERO
	world.player.velocity = Vector3.ZERO
	world.player.paused = true
	Life.paused = true
	world.player.actor.gesture("Interact")
	create_card()
	show_stage()

func create_card() -> void:
	card = PanelContainer.new()
	card.add_theme_stylebox_override("panel", hud.style(Color(.10, .18, .13, .94)))
	hud.root.add_child(card)
	card.position = Vector2(hud.root.size.x * .5 - 200, hud.root.size.y - 174)
	card.size = Vector2(400, 118)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 9)
	card.add_child(column)
	title = hud.label(Life.tr_copy(Life.activities[id].title), 18, column)
	step_label = hud.label("", 14, column)
	progress = ProgressBar.new()
	progress.custom_minimum_size.y = 6
	progress.show_percentage = false
	column.add_child(progress)
	var row := HBoxContainer.new()
	column.add_child(row)
	button = hud.button("Tamamla", advance, row)
	button.button_down.connect(func() -> void: holding = true)
	button.button_up.connect(func() -> void: holding = false)
	button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	hud.button("×", cancel, row)
	hud.prompt_button.visible = false
	world.player.actor.animate_state(0, id)

func show_stage() -> void:
	step_label.text = "%d / %d  ·  %s" % [stage + 1, steps.size(), steps[stage]]
	button.text = steps[stage] + "  →"
	progress.value = float(stage) / steps.size() * 100
	if id in ["lullaby", "soothe", "breathe", "stretch", "kick"]:
		button.text = "Ritmi tutmaq üçün basılı saxla"
		direct.close()
		return
	if id == "test" and stage == 2:
		button.disabled = true
		var wait := get_tree().create_timer(4)
		var generation := run_generation
		wait.timeout.connect(func() -> void:
			if working and generation == run_generation and id == "test" and stage == 2 and is_instance_valid(button):
				button.disabled = false
				button.text = "Ⅱ   İki xətt. Yeni bir həyat."
		)
	elif id == "laundry" and stage == 2:
		button.disabled = true
		step_label.text = "3 / 5  ·  30° yumşaq yuma…"
		var tween := create_tween()
		var generation := run_generation
		tween.tween_property(progress, "value", 60.0, 3.5)
		tween.tween_callback(func() -> void:
			if working and generation == run_generation and id == "laundry" and stage == 2 and is_instance_valid(button):
				button.disabled = false
				button.text = "Təmiz paltarları çıxar →"
		)
	elif id == "cook" and stage == 2:
		cooking = true
		progress.value = 0
		button.disabled = true
		heat_slider = HSlider.new()
		heat_slider.min_value = 0
		heat_slider.max_value = 100
		heat_slider.value = 52
		(card.get_child(0) as VBoxContainer).add_child(heat_slider)
		button.text = "İstiliyi orta zonada saxla"
	direct.open(id, stage)
	if id == "cook" and stage == 0:
		source_id = Life.catalogue.recipes[0].id
	if direct.required:
		button.disabled = true
		step_label.text += "  ·  " + ("Əşyalara toxun" if direct.gesture == "tap" else "Səthdə sürüşdür")

func advance() -> void:
	if not working or button.disabled:
		return
	if id in ["lullaby", "soothe", "breathe", "stretch", "kick"]:
		return
	world.player.actor.gesture("PickUp_Table" if id in ["cook", "laundry", "pack", "feed", "diaper"] else "Interact")
	if id == "cook" and stage == 2:
		cooking = false
		if is_instance_valid(heat_slider):
			heat_slider.queue_free()
	if id in ["clean", "tidy"]:
		world.builder.household_key = ""
	stage += 1
	if stage >= steps.size():
		finish()
	else:
		show_stage()

func _process(delta: float) -> void:
	if not working:
		return
	if id in ["lullaby", "soothe", "breathe", "stretch", "kick"]:
		rhythm += delta
		var inhale := fmod(rhythm, 5.0) < 2.4
		input_timer += delta
		if input_timer > .10:
			input_timer = 0
			total_samples += 1
			if inhale == holding:
				correct_samples += 1
		stage = mini(3, floori(rhythm / 5.0))
		step_label.text = "Nəfəs al · basılı saxla" if inhale else "Nəfəsi burax · barmağını qaldır"
		progress.value = minf(100, rhythm / 15.0 * 100)
		if rhythm > 15:
			score = maxf(30, float(correct_samples) / maxi(1, total_samples) * 100)
			finish()
	elif cooking and is_instance_valid(heat_slider):
		if heat_slider.value > 38 and heat_slider.value < 68:
			progress.value += delta * 19
		if progress.value >= 100:
			button.disabled = false
			button.text = "Yemək hazırdır · Süfrəyə ver →"

func finish() -> void:
	score = minf(score, direct.score)
	working = false
	cleanup()
	world.player.paused = false
	Life.paused = false
	world.builder.household_key = ""
	world.begin_activity(id, score, source_id)

func cancel() -> void:
	working = false
	cleanup()
	world.player.paused = false
	Life.paused = false
	world.player.actor.playing = ""
	world.builder.household_key = ""
	world.builder.update_household()

func cleanup() -> void:
	direct.close()
	hud.set_task_lock(false)
	world.player.position = original_position
	world.player.actor.rotation.y = original_rotation
	if is_instance_valid(card):
		card.queue_free()
	for object in objects:
		if is_instance_valid(object):
			object.queue_free()
	objects.clear()
	hud.prompt_button.visible = true
