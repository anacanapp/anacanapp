// Ported from: src/components/ToolsHub.tsx (the lazy tool imports of the AI & media tools: BabyPhotoshoot,
//              CryTranslator, PoopScanner, FairyTaleGenerator, HoroscopeCompatibility, WeatherClothing, WhiteNoise,
//              NoiseMeter)
import '../../shell/shell.dart';
import 'cry/cry_translator.dart';
import 'fairy_tale/fairy_tale_generator.dart';
import 'horoscope/horoscope_compatibility.dart';
import 'noise_meter/noise_meter.dart';
import 'photoshoot/baby_photoshoot.dart';
import 'poop/poop_scanner.dart';
import 'weather/weather_clothing.dart';
import 'whitenoise/white_noise.dart';

/// Registers the AI & media tools (phase 4).
void registerMediaTools(FeatureRegistry r) {
  r.registerTool(ToolId.photoshoot, (context, a) => BabyPhotoshoot(onBack: a.onBack));
  r.registerTool(ToolId.cryTranslator, (context, a) => CryTranslator(onBack: a.onBack));
  r.registerTool(ToolId.poopScanner, (context, a) => PoopScanner(onBack: a.onBack));
  r.registerTool(ToolId.fairyTale, (context, a) => FairyTaleGenerator(onBack: a.onBack));
  r.registerTool(ToolId.horoscope, (context, a) => HoroscopeCompatibility(onBack: a.onBack));
  r.registerTool(ToolId.weatherClothing, (context, a) => WeatherClothing(onBack: a.onBack));
  r.registerTool(ToolId.whitenoise, (context, a) => WhiteNoise(onBack: a.onBack));
  r.registerTool(ToolId.noiseMeter, (context, a) => NoiseMeter(onBack: a.onBack));
}
