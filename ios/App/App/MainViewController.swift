import Capacitor

/**
 * Xüsusi Bridge ViewController — yerli (npm paketi OLMAYAN, birbaşa Xcode
 * layihəsində yazılmış) plugin-ləri qeydə almaq üçün.
 *
 * KÖK SƏBƏB: Capacitor-un iOS körpüsü heç bir runtime "reflection"/skan
 * ETMİR — YALNIZ `capacitor.config.json`-dakı `packageClassList`-də (bu isə
 * YALNIZ npm-plugin-lər üçün `npx cap sync` tərəfindən avtomatik doldurulur,
 * app-ın öz mənbə qovluğu heç vaxt skan edilmir) adı keçən SİNİFLƏRİ VƏ YA
 * bu fayldakı kimi əl ilə `registerPluginInstance(...)` çağırışı ilə əlavə
 * edilən plugin-ləri tanıyır. `@objc(...)` + `CAPBridgedPlugin` uyğunluğu
 * VƏ Xcode target-in Compile Sources-a əlavə olunması TƏK BAŞINA KİFAYƏT
 * DEYİL — əks halda "X" plugin is not implemented on ios" (UNIMPLEMENTED)
 * xətası davam edir, hətta fayl düzgün compile olunsa belə.
 *
 * Rəsmi mənbə: https://capacitorjs.com/docs/ios/custom-code#register-the-plugin
 *
 * Bu class Base.lproj/Main.storyboard-da "Bridge View Controller" səhnəsinin
 * customClass-ı kimi təyin edilməlidir (əvvəllər sadəcə "CAPBridgeViewController"
 * idi) — artıq edilib.
 */
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        if #available(iOS 16.1, *) {
            bridge?.registerPluginInstance(LiveActivityPlugin())
        }
        bridge?.registerPluginInstance(HealthCyclePlugin())
        bridge?.registerPluginInstance(HealthVitalsPlugin())
        bridge?.registerPluginInstance(ScreenshotGuardPlugin())
    }
}
