import XCTest

final class MommySimulatorUITests: XCTestCase {
    private let app = XCUIApplication(bundleIdentifier: "com.atlasoon.mommysimulator")

    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    private func button(_ title: String, timeout: TimeInterval = 25) -> XCUIElement {
        let query = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", title))
        let deadline = Date().addingTimeInterval(timeout)
        var lastScroll = Date.distantPast
        repeat {
            if let element = query.allElementsBoundByIndex.first(where: { $0.exists && $0.isHittable && $0.isEnabled }) { return element }
            if query.allElementsBoundByIndex.contains(where: { $0.exists && !$0.isHittable && $0.isEnabled }) && Date().timeIntervalSince(lastScroll) > 2 {
                app.swipeUp()
                lastScroll = Date()
            }
            Thread.sleep(forTimeInterval: 0.25)
        } while Date() < deadline
        XCTFail("Missing visible game control: \(title)")
        return query.firstMatch
    }

    private func screenshot(_ name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    func testPhysicalGameOnboardingCookingAndPhoto() throws {
        app.launchEnvironment["MOMMY_UI_TEST"] = "1"
        app.launch()
        let welcome = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Davam et")).firstMatch
        if welcome.waitForExistence(timeout: 8) {
            screenshot("01-native-welcome")
            welcome.tap()
            button("Davam et").tap()
            button("Hekayəmi başlat").tap()
            button("Hazıram!").tap()
        }
        screenshot("02-native-world")
        button("Hamiləlik testini hazırla").tap()
        button("Səhnəni oyna").tap()
        button("Testi qutudan çıxar").tap()
        button("Test səhnəsini başlat").tap()
        button("Bu anı yadda saxla", timeout: 15).tap()
        button("Tamamla").tap()
        let testCompletion = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "Balaca bir an daha sevgi ilə")).firstMatch
        XCTAssertTrue(testCompletion.waitForExistence(timeout: 25))
        button("Özün üçün səhər yeməyi hazırla").tap()
        button("Səhnəni oyna").tap()
        screenshot("03-native-cooking")
        for ingredient in ["Toyuq budu", "Kök", "Kərəviz", "Vermişel"] {
            button(ingredient).tap()
        }
        for _ in 0..<8 { button("Bir hissə doğra").tap() }
        button("Bişirməyə başla").tap()
        button("Süfrəyə ver", timeout: 30).tap()
        button("Tamamla").tap()
        let completion = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "Balaca bir an daha sevgi ilə")).firstMatch
        XCTAssertTrue(completion.waitForExistence(timeout: 30), "The native game activity must actually finish")
        button("Foto rejimi").tap()
        button("Xatirəni çək").tap()
        screenshot("04-native-photo")
        button("Bağla").tap()
        button("Xatirələr").tap()
        screenshot("05-native-album")
        XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Yuvamdan bir an")).firstMatch.waitForExistence(timeout: 10))
        button("Bağla").tap()
        screenshot("06-native-playable")
        button("Anacan kitabxanası").tap()
        button("Google-dan yenilə").tap()
        let refreshed = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "Google kitabxanası yeniləndi")).firstMatch
        XCTAssertTrue(refreshed.waitForExistence(timeout: 45), "Physical WKWebView must read the live Google catalogue")
        screenshot("07-native-google-catalogue")
        button("Bağla").tap()
        Thread.sleep(forTimeInterval: 7)
        app.terminate()
        app.launchEnvironment["MOMMY_UI_RELAUNCH"] = "1"
        app.launch()
        button("Xatirələr").tap()
        XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Yuvamdan bir an")).firstMatch.waitForExistence(timeout: 10), "Native Preferences must restore this isolated test's photo after relaunch")
        screenshot("08-native-restored-album")
        button("Bağla").tap()
        app.terminate()
        app.launchEnvironment.removeAll()
        app.launch()
        screenshot("09-native-restored-user-world")
    }

    func testPhysicalBirthPathAndFirstEmbrace() throws {
        let fixture = try String(contentsOfFile: "\(Bundle(for: type(of: self)).bundlePath)/birth.json", encoding: .utf8)
        app.launchEnvironment["MOMMY_UI_TEST"] = "1"
        app.launchEnvironment["MOMMY_UI_FIXTURE"] = fixture
        app.launch()
        button("Balacanla görüş").tap()
        for title in ["Planım komanda ilə paylaşıldı", "Dəstəyim yanımdadır", "Rahatlıq seçimim hazırdır"] { button(title).tap() }
        button("Davam et").tap()
        for title in ["Komanda ilə hazırlıq", "Dəstəyimlə göz təması", "Sakit musiqi anı"] { button(title).tap() }
        screenshot("09-native-caesarean-preparation")
        button("Davam et").tap()
        let next = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Davam et")).firstMatch
        for _ in 0..<12 {
            if next.exists && next.isEnabled { break }
            let open = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "İşıq gəldi")).firstMatch
        XCTAssertTrue(open.waitForExistence(timeout: 8))
            button("Doğuş ritmi").tap()
            Thread.sleep(forTimeInterval: 1.5)
        }
        button("Davam et").tap()
        screenshot("10-native-first-embrace")
        button("Davam et", timeout: 10).tap()
        button("İlk qayğı günlərinə keç").tap()
        button("Missiyalar").tap()
        button("Yeni fəsilə keç").tap()
        button("Hazıram!").tap()
        screenshot("11-native-newborn-clinic")
        app.terminate()
        app.launchEnvironment.removeAll()
        app.launch()
    }
}
