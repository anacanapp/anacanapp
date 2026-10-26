class_name MetroAudio
extends Node

var players: Array[AudioStreamPlayer] = []
var pointer := 0
var samples: Dictionary = {}

func _ready() -> void:
	for index in range(5):
		var player := AudioStreamPlayer.new()
		player.volume_db = -15
		add_child(player)
		players.append(player)
	samples.tap = _tone([240.0, 170.0], 0.045, 0.28)
	samples.clear = _tone([650.0, 900.0], 0.095, 0.25)
	samples.time = _tone([660.0, 880.0, 1100.0], 0.19, 0.25)
	samples.won = _tone([523.25, 659.25, 783.99, 1046.5], 0.36, 0.3)
	samples.lost = _tone([330.0, 220.0, 165.0], 0.30, 0.22)
	samples.burst = _tone([120.0, 240.0, 480.0], 0.18, 0.25)
	samples.go = _tone([880.0, 1100.0], 0.15, 0.25)
	samples.ui = _tone([600.0], 0.04, 0.15)

func play(kind: String) -> void:
	if not Metro.profile.settings.sound or not samples.has(kind) or players.is_empty(): return
	var player := players[pointer % players.size()]
	pointer += 1
	player.stream = samples[kind]
	player.play()

func _tone(notes: Array, duration: float, amplitude: float) -> AudioStreamWAV:
	var rate := 22050
	var data := PackedByteArray()
	var count := int(rate * duration)
	data.resize(count * 2)
	for index in range(count):
		var time := float(index) / rate
		var segment := mini(notes.size() - 1, int(float(index) / count * notes.size()))
		var envelope := pow(1.0 - float(index) / count, 1.7) * minf(1.0, time * 220)
		var value := sin(TAU * float(notes[segment]) * time) * envelope * amplitude
		data.encode_s16(index * 2, int(value * 32767))
	var stream := AudioStreamWAV.new()
	stream.format = AudioStreamWAV.FORMAT_16_BITS
	stream.mix_rate = rate
	stream.stereo = false
	stream.data = data
	return stream
