extends Node

var world: Node3D
var hud: WorldHUD
var id := ""
var stage := 0
var required := 0
var completed := 0
var selected := -1
var timer: Timer
var counters: Dictionary = {}
var source_id := ""
var quality := 100.0
var finish_button: Button

func setup(scene: Node3D, ui: WorldHUD) -> void:
	world = scene
	hud = ui

func open(activity_id: String) -> void:
	id = activity_id
	stage = 0
	completed = 0
	selected = -1
	counters = {}
	quality = 100
	source_id = ""
	hud.open_panel(Life.tr_copy(Life.activities[id].title))
	hud.paragraph(Life.tr_copy(Life.activities[id].description))
	match id:
		"cook": cooking()
		"groceries": groceries()
		"laundry": laundry()
		"clean": cleaning()
		"test": pregnancy_test()
		"scan": scan()
		"assemble": assembly()
		"pack": packing()
		"appointment": appointment()
		"name": names()
		"birthplan": birth_plan()
		"feed", "diaper", "sterilise": care()
		"breathe", "stretch", "kick", "soothe": breathing()
		"lullaby": lullaby()
		"play": discovery()
		"routine": routine()
		"contractions": contractions()
		"carseat": carseat()
		"coffee": coffee()
		"lakesideWalk": lakeside()
		_:
			hud.button("Başlayaq", func() -> void: world.begin_activity(id, 0), hud.panel_content)

func clear_content() -> void:
	if timer:
		timer.stop()
		timer.queue_free()
		timer = null
	for child in hud.panel_content.get_children():
		hud.panel_content.remove_child(child)
		child.queue_free()

func result() -> void:
	clear_content()
	hud.label("✦  ✦  ✦", 40, hud.panel_content)
	hud.label(hud.c("Əla!", "Lovely!", "Harika!"), 28, hud.panel_content)
	hud.paragraph(Life.tr_copy(Life.activities[id].result))
	hud.button(hud.c("Dünyada tamamla", "Complete in the world", "Dünyada tamamla"), func() -> void: world.begin_activity(id, quality, source_id), hud.panel_content)

func steps(titles: Array, callback: Callable = result) -> void:
	completed = 0
	var count := titles.size()
	for title in titles:
		var b := hud.button(str(title), func() -> void: pass, hud.panel_content)
		b.pressed.connect(func() -> void:
			if b.disabled:
				return
			b.disabled = true
			b.text = "✓  " + str(title)
			completed += 1
			if completed == count:
				callback.call()
		)

func cooking() -> void:
	var recipe: Dictionary = Life.catalogue.recipes[0]
	source_id = recipe.id
	hud.paragraph(str(recipe.get("title_az", recipe.get("title", "Ailə yeməyi"))))
	var ingredients: Variant = recipe.get("ingredients_az", recipe.get("ingredients", []))
	if ingredients is String:
		var parsed: Variant = JSON.parse_string(ingredients)
		ingredients = parsed if parsed is Array else ingredients.split("\n")
	var titles: Array = []
	for ingredient in ingredients:
		titles.append(str(ingredient.get("name", ingredient)) if ingredient is Dictionary else str(ingredient))
	if titles.is_empty():
		titles = ["Tərəvəz", "Süd", "Çörək", "Ədviyyat"]
	hud.label("1 / 4  ·  Ərzaqları hazırla", 18, hud.panel_content)
	steps(titles.slice(0, 4), chop)

func chop() -> void:
	clear_content()
	hud.label("2 / 4  ·  Doğrama", 22, hud.panel_content)
	hud.paragraph("Taxta lövhədə ərzaqları doğra. Səkkiz yüngül toxunuş.")
	completed = 0
	var board := hud.button("🔪  0 / 8", func() -> void: pass, hud.panel_content)
	board.custom_minimum_size.y = 190
	board.pressed.connect(func() -> void:
		completed += 1
		board.text = "🔪  %d / 8" % completed
		if completed >= 8:
			stove()
	)

func stove() -> void:
	clear_content()
	hud.label("3 / 4  ·  Ocağın istiliyi", 22, hud.panel_content)
	hud.paragraph("İstiliyi orta zonada saxla. Qazan həqiqi dünyada mətbəx ocağındadır.")
	var heat := HSlider.new()
	heat.min_value = 0
	heat.max_value = 100
	heat.value = 52
	var progress := ProgressBar.new()
	progress.max_value = 100
	progress.custom_minimum_size.y = 22
	hud.panel_content.add_child(heat)
	hud.panel_content.add_child(progress)
	var serve := hud.button("4 / 4  ·  Süfrəyə ver", result, hud.panel_content)
	serve.disabled = true
	timer = Timer.new()
	timer.wait_time = .20
	add_child(timer)
	timer.timeout.connect(func() -> void:
		if not is_instance_valid(serve):
			timer.stop()
			return
		if heat.value >= 38 and heat.value <= 68:
			progress.value += 3
		if progress.value >= 100:
			serve.disabled = false
			timer.stop()
	)
	timer.start()

func groceries() -> void:
	counters = {}
	hud.paragraph("CHF %.2f  ·  Ərzaqlar evimizə əlavə olunur." % (float(Life.state.household.cash) / 100))
	var summary := hud.label("CHF 0.00", 25, hud.panel_content)
	var pay := hud.button("Alış-verişi tamamla", func() -> void:
		if Life.dispatch({"type": "SHOP", "basket": counters}):
			result()
		else:
			hud.toast(Life.error)
	, hud.panel_content)
	pay.disabled = true
	for product in Life.definitions.groceries:
		var product_id: String = product.id
		var row := HBoxContainer.new()
		hud.panel_content.add_child(row)
		var title := hud.label("%s\nCHF %.2f  ·  Evdə %d" % [Life.tr_copy(product.title), float(product.price) / 100, int(Life.state.household.groceries[product_id])], 14, row)
		title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var quantity := hud.label("0", 20, row)
		var update := func(delta: int) -> void:
			counters[product_id] = clampi(int(counters.get(product_id, 0)) + delta, 0, mini(6, 40 - int(Life.state.household.groceries[product_id])))
			quantity.text = str(counters[product_id])
			var total := 0
			for p in Life.definitions.groceries:
				total += int(p.price) * int(counters.get(p.id, 0))
			summary.text = "CHF %.2f" % (float(total) / 100)
			pay.disabled = total <= 0 or total > int(Life.state.household.cash)
		hud.button("−", func() -> void: update.call(-1), row)
		hud.button("+", func() -> void: update.call(1), row)

func laundry() -> void:
	clear_content()
	var count := mini(6, int(Life.state.household.laundry.dirty))
	if count == 0:
		dry_laundry()
		return
	hud.label("1 / 5  ·  Rəngləri ayır", 22, hud.panel_content)
	hud.paragraph("Əvvəl paltarı, sonra uyğun rəng səbətini seç.")
	selected = -1
	completed = 0
	counters = {}
	var clothes := [0, 1, 0, 1, 1, 0]
	for i in count:
		var b := hud.button("👕  %d  ·  %s" % [i + 1, "Açıq" if clothes[i] == 0 else "Rəngli"], func() -> void: selected = i, hud.panel_content)
		counters[str(i)] = b
	for basket in 2:
		hud.button("Açıq rənglər" if basket == 0 else "Rəngli paltarlar", func() -> void:
			if selected < 0 or not is_instance_valid(counters.get(str(selected))) or counters[str(selected)].disabled:
				return
			if clothes[selected] != basket:
				hud.toast("Uyğun rəng səbətini seç.")
				return
			counters[str(selected)].disabled = true
			completed += 1
			selected = -1
			if completed == count:
				wash_laundry()
		, hud.panel_content)

func wash_laundry() -> void:
	clear_content()
	hud.label("2 / 5  ·  Yuma proqramı", 22, hud.panel_content)
	for degree in [30, 40]:
		hud.button("%d°  ·  %s" % [degree, "Yumşaq yuma" if degree == 30 else "Gündəlik yuma"], func() -> void:
			quality = 100 if degree == 30 else 90
			clear_content()
			hud.label("3 / 5  ·  Yuyulur…", 22, hud.panel_content)
			var progress := ProgressBar.new()
			progress.custom_minimum_size.y = 28
			hud.panel_content.add_child(progress)
			var tween := create_tween()
			tween.tween_property(progress, "value", 100.0, 3.4)
			tween.tween_callback(dry_laundry)
		, hud.panel_content)

func dry_laundry() -> void:
	clear_content()
	hud.label("4 / 5  ·  Qurutma", 22, hud.panel_content)
	var clothes: Array = []
	for i in Life.laundry_load():
		clothes.append("Paltarı as  %d" % (i + 1))
	steps(clothes, fold_laundry)

func fold_laundry() -> void:
	clear_content()
	hud.label("5 / 5  ·  Qatlama", 22, hud.panel_content)
	var clothes: Array = []
	for i in Life.laundry_load():
		clothes.append("Paltarı qatla  %d" % (i + 1))
	steps(clothes)

func cleaning() -> void:
	hud.label("Altı səthi təmizlə", 22, hud.panel_content)
	steps(["Masa", "Rəf", "Oyuncaq guşəsi", "Divan", "Döşəmə", "Dəftər guşəsi"])

func pregnancy_test() -> void:
	clear_content()
	var titles := ["Testi qutudan çıxar", "Test dəstini hazırla", "Nəticəni gözlə"]
	hud.label("Bir test. İki xətt. Yeni bir həyat.", 23, hud.panel_content)
	for i in titles.size():
		var b := hud.button(titles[i], func() -> void: pass, hud.panel_content)
		b.disabled = i > stage
		b.pressed.connect(func() -> void:
			stage += 1
			if stage < 3:
				pregnancy_test()
			else:
				clear_content()
				var waiting := hud.label("Sakit bir neçə saniyə…", 22, hud.panel_content)
				get_tree().create_timer(4).timeout.connect(func() -> void:
					if is_instance_valid(waiting) and hud.modal:
						waiting.text = "Ⅱ   Hamiləlik hekayən başlayır"
						hud.button("Bu anı yadda saxla", result, hud.panel_content)
				)
		)

func scan() -> void:
	clear_content()
	hud.label("Ultrasəs  ·  %d / 3" % (stage + 1), 22, hud.panel_content)
	hud.paragraph("Probu işarəyə gətir və dərinliyi uyğunlaşdır. Üç fokuslanmış kadr saxla.")
	var pad := Control.new()
	pad.custom_minimum_size = Vector2(420, 235)
	pad.mouse_filter = Control.MOUSE_FILTER_STOP
	hud.panel_content.add_child(pad)
	var position := Vector2(30, 190)
	var aim: Vector2 = [Vector2(250, 90), Vector2(150, 170), Vector2(290, 155)][stage]
	pad.draw.connect(func() -> void:
		pad.draw_rect(Rect2(Vector2.ZERO, pad.size), Color("122c27"))
		pad.draw_arc(Vector2(210, 60), 118, .20, PI - .20, 48, Color("b7bfb0"), 3, true)
		pad.draw_circle(Vector2(190, 120), 40, Color(.47, .59, .51, .7))
		pad.draw_circle(aim, 17, Color(.63, .83, .62, .7))
		pad.draw_circle(position, 9, Color("faf6e2"))
	)
	var depth := HSlider.new()
	depth.min_value = 0
	depth.max_value = 100
	depth.value = 45
	hud.panel_content.add_child(depth)
	var capture_button := hud.button("Fokuslu kadrı saxla", func() -> void:
		stage += 1
		if stage == 3:
			result()
		else:
			scan()
	, hud.panel_content)
	capture_button.disabled = true
	var update := func() -> void:
		capture_button.disabled = position.distance_to(aim) > 26 or absf(depth.value - float([58, 42, 68][stage])) > 6
	pad.gui_input.connect(func(event: InputEvent) -> void:
		if event is InputEventMouseButton and event.pressed or event is InputEventScreenTouch and event.pressed:
			position = event.position
		elif event is InputEventScreenDrag or event is InputEventMouseMotion and Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT):
			position = event.position
		pad.queue_redraw()
		update.call()
	)
	depth.value_changed.connect(func(_v: float) -> void: update.call())

func assembly() -> void:
	clear_content()
	hud.label("Beşiyi hissə-hissə qur", 22, hud.panel_content)
	steps(["Baş paneli döndər və birləşdir", "Döşək bazasını yerləşdir", "Son paneli birləşdir", "Yan məhəccəri bərkit"])

func packing() -> void:
	var titles: Array = []
	for row in Life.catalogue.bag:
		if row.get("is_essential", false):
			titles.append(str(row.get("item_name_az", row.get("item_name", "Çanta əşyası"))))
		if titles.size() == 6:
			break
	steps(titles)

func appointment() -> void:
	clear_content()
	hud.label("Ailə təqvimi", 23, hud.panel_content)
	for hour in ["09:00", "10:30", "13:00", "15:30"]:
		hud.button(hour + "  ·  Sabah", func() -> void:
			Life.dispatch({"type": "BOOK_APPOINTMENT", "appointment": {"day": int(Life.state.day) + 1, "time": hour, "supportPerson": "partner"}})
			result()
		, hud.panel_content)

func names() -> void:
	clear_content()
	hud.label("Bir adın hekayəsi", 23, hud.panel_content)
	var search := LineEdit.new()
	search.placeholder_text = "Ad axtar…"
	hud.panel_content.add_child(search)
	var list := VBoxContainer.new()
	hud.panel_content.add_child(list)
	var update := func(value: String) -> void:
		for child in list.get_children():
			list.remove_child(child)
			child.queue_free()
		var count := 0
		for row in Life.catalogue.names:
			var name: String = str(row.get("name", row.get("name_az", "")))
			if not value.is_empty() and value.to_lower() not in name.to_lower():
				continue
			hud.button(name, func() -> void:
				var avatar: Dictionary = Life.state.avatar.duplicate(true)
				avatar.babyName = name.left(24)
				Life.dispatch({"type": "AVATAR", "avatar": avatar})
				source_id = row.id
				result()
			, list)
			count += 1
			if count >= 25:
				break
	search.text_changed.connect(update)
	update.call("")

func birth_plan() -> void:
	clear_content()
	hud.label("Mənim doğuş yolum", 22, hud.panel_content)
	for plan in ["vaginal", "cesarean"]:
		hud.button("Vaginal doğuş" if plan == "vaginal" else "Planlı keysəriyyə", func() -> void:
			Life.dispatch({"type": "BIRTH_PLAN", "plan": plan, "supportPerson": "partner", "comfort": "music"})
			result()
		, hud.panel_content)

func care() -> void:
	clear_content()
	if id == "feed":
		hud.label("Qidalandırma seçimi", 22, hud.panel_content)
		for method in ["breast", "bottle", "combination"]:
			hud.button({"breast": "Əmizdirmə", "bottle": "Butulka", "combination": "Qarışıq"}[method], func() -> void:
				Life.dispatch({"type": "FEEDING", "method": method})
				clear_content()
				steps(["Rahat guşəni hazırla", "Balacanı qucağına al", "Qayğı ritmini tut", "İsti yaxınlıq"])
			, hud.panel_content)
	else:
		steps(["Təmiz əşyaları hazırla", "Yumşaq qayğı", "Təmizlə və geyimi düzəlt", "Rahat bir qucaq"])

func breathing() -> void:
	clear_content()
	hud.label("Üç sakit nəfəs dalğası", 22, hud.panel_content)
	hud.paragraph("Dairə böyüyəndə basıb saxla, kiçiləndə burax.")
	var control := hud.button("Nəfəs almağa başla", func() -> void: pass, hud.panel_content)
	control.custom_minimum_size.y = 170
	var elapsed := 0.0
	var held := false
	var good := 0.0
	control.button_down.connect(func() -> void: held = true)
	control.button_up.connect(func() -> void: held = false)
	var progress := ProgressBar.new()
	hud.panel_content.add_child(progress)
	timer = Timer.new()
	timer.wait_time = .1
	add_child(timer)
	timer.timeout.connect(func() -> void:
		if not is_instance_valid(control):
			timer.stop()
			return
		elapsed += .1
		var inhale: bool = fmod(elapsed, 5.0) < 2.4
		control.text = "Nəfəs al" if inhale else "Nəfəsi burax"
		if held == inhale:
			good += .1
		progress.value = elapsed / 15 * 100
		if elapsed >= 15:
			quality = maxf(30, good / 15 * 100)
			result()
	)
	control.pressed.connect(func() -> void: if timer.is_stopped(): timer.start())

func lullaby() -> void:
	clear_content()
	hud.label("İşıq ortada olanda ritmi tut", 22, hud.panel_content)
	var track := ProgressBar.new()
	track.custom_minimum_size.y = 25
	hud.panel_content.add_child(track)
	var elapsed := 0.0
	completed = 0
	quality = 0
	timer = Timer.new()
	timer.wait_time = .04
	add_child(timer)
	timer.timeout.connect(func() -> void:
		if is_instance_valid(track):
			elapsed += .04
			track.value = 50 + sin(elapsed * 2) * 44
	)
	timer.start()
	hud.button("♥  Layla ritmi", func() -> void:
		quality += maxf(20, 100 - absf(track.value - 50) * 2.4) / 5
		completed += 1
		if completed == 5:
			result()
	, hud.panel_content)

func discovery() -> void:
	clear_content()
	hud.label("Oyuncaq cütlərini tap", 22, hud.panel_content)
	var order := [0, 2, 1, 3, 2, 0, 3, 1]
	var revealed: Array[int] = []
	var matched: Array[int] = []
	var buttons: Array[Button] = []
	var grid := GridContainer.new()
	grid.columns = 4
	hud.panel_content.add_child(grid)
	for i in 8:
		var b := hud.button("?", func() -> void: pass, grid)
		b.custom_minimum_size = Vector2(100, 95)
		buttons.append(b)
		b.pressed.connect(func() -> void:
			if revealed.size() == 2 or i in revealed or order[i] in matched:
				return
			revealed.append(i)
			b.text = ["✿", "☾", "♧", "✦"][order[i]]
			if revealed.size() == 2:
				if order[revealed[0]] == order[revealed[1]]:
					matched.append(order[i])
					for index in revealed:
						buttons[index].disabled = true
					revealed.clear()
					if matched.size() == 4:
						result()
				else:
					get_tree().create_timer(.8).timeout.connect(func() -> void:
						for index in revealed:
							if is_instance_valid(buttons[index]):
								buttons[index].text = "?"
						revealed.clear()
					)
		)

func routine() -> void:
	clear_content()
	hud.label("Ailə günü: səhərdən axşama", 22, hud.panel_content)
	steps(["Səhər qidalandırma", "Günorta oyun və gəzinti", "Ananın öz fasiləsi", "Axşam layla və yuxu"])

func contractions() -> void:
	clear_content()
	hud.label("Dalğaların başlanğıcını və sonunu tut", 22, hud.panel_content)
	completed = 0
	var elapsed := 0.0
	var progress := ProgressBar.new()
	hud.panel_content.add_child(progress)
	var record := hud.button("Dalğanı qeyd et", func() -> void: pass, hud.panel_content)
	record.pressed.connect(func() -> void:
		if progress.value < 65:
			hud.toast("İşıq dalğasının yuxarı zonasını gözlə.")
			return
		completed += 1
		if completed == 4:
			result()
	)
	timer = Timer.new()
	timer.wait_time = .05
	add_child(timer)
	timer.timeout.connect(func() -> void:
		if is_instance_valid(progress):
			elapsed += .05
			progress.value = 50 + sin(elapsed * 1.4) * 45
	)
	timer.start()

func carseat() -> void:
	steps(["Oturacaq bazası", "Sol kəmər", "Sağ kəmər", "Tokanı birləşdir"])

func coffee() -> void:
	clear_content()
	hud.label("Bir fincan özümə vaxt", 22, hud.panel_content)
	var fill := ProgressBar.new()
	hud.panel_content.add_child(fill)
	var pour := hud.button("Basılı saxlayaraq doldur", func() -> void: pass, hud.panel_content)
	var held := false
	pour.button_down.connect(func() -> void: held = true)
	pour.button_up.connect(func() -> void: held = false)
	var finish := hud.button("Bu anı yaşa", func() -> void: quality = maxf(60, 100 - absf(fill.value - 72)); result(), hud.panel_content)
	finish.disabled = true
	timer = Timer.new()
	timer.wait_time = .08
	add_child(timer)
	timer.timeout.connect(func() -> void:
		if not is_instance_valid(fill):
			timer.stop()
			return
		if held:
			fill.value = minf(100, fill.value + 3)
		finish.disabled = fill.value < 55
	)
	timer.start()

func lakeside() -> void:
	steps(["Taxta körpünü kəşf et", "Gölün işığını yadda saxla", "Yaşıl guşəni tap"])

func birth() -> void:
	id = "birth"
	stage = int(Life.state.pregnancy.birthStage)
	hud.open_panel("Balacamla görüş")
	birth_stage()

func birth_stage() -> void:
	clear_content()
	var titles := ["Hazırlıq və dəstək", "Komanda ilə sakit ritm", "İlk görüşə doğru", "İlk qucaq", "Yeni bir ailə"]
	hud.label("%d / 5  ·  %s" % [stage + 1, titles[stage]], 23, hud.panel_content)
	if stage == 0:
		steps(["Planım komanda ilə paylaşıldı", "Dəstəyim yanımdadır", "Rahat guşə hazırdır"], advance_birth)
	elif stage == 1:
		steps(["Komanda ilə göz təması", "Nəfəs və dəstək", "Sakit ritm"], advance_birth)
	elif stage == 2:
		steps(["Bir dalğa", "Yenə bir nəfəs", "Əllərimiz birlikdə", "Yeni həyata doğru", "Balacam hazırdır"], advance_birth)
	elif stage == 3:
		hud.paragraph("Balacan indi qucağındadır. Bir ad, bir nəfəs, bir ailə.")
		hud.button("İlk qucağı yadda saxla", advance_birth, hud.panel_content)
	else:
		hud.button("İlk qayğı günlərinə keç", func() -> void:
			Life.dispatch({"type": "BIRTH_COMPLETE", "quality": 100})
			hud.close_panel()
			world.mission()
		, hud.panel_content)

func advance_birth() -> void:
	stage += 1
	Life.dispatch({"type": "BIRTH_STAGE", "stage": stage})
	birth_stage()
