import XCTest

final class StartupIOUITests: XCTestCase {
    private let app = XCUIApplication(bundleIdentifier: "com.atlasoon.startupio")

    override func setUpWithError() throws {
        continueAfterFailure = false
        XCUIDevice.shared.orientation = .portrait
        app.launchEnvironment["STARTUP_UI_TEST"] = "1"
        app.launch()
        XCTAssertTrue(app.buttons["Ayarlar"].waitForExistence(timeout: 120), "The bundled game must finish loading before acceptance begins")
        Thread.sleep(forTimeInterval: 1)
    }

    private func button(_ title: String, timeout: TimeInterval = 35, scroll: Bool = false, anyControl: Bool = false) -> XCUIElement {
        let query = (anyControl ? app.descendants(matching: .any) : app.buttons).matching(NSPredicate(format: "label CONTAINS %@", title))
        let deadline = Date().addingTimeInterval(timeout)
        var scrolls = 0
        var lastScroll = Date.distantPast
        repeat {
            if let element = query.allElementsBoundByIndex.first(where: {
                $0.exists && $0.isHittable && $0.isEnabled && (!scroll || ($0.frame.minY > 60 && $0.frame.maxY < app.frame.height - 105))
            }) { Thread.sleep(forTimeInterval: 0.35); return element }
            if scroll && scrolls < 6 && Date().timeIntervalSince(lastScroll) > 1.5 {
                let start = app.coordinate(withNormalizedOffset: CGVector(dx: 0.6, dy: 0.72))
                let end = app.coordinate(withNormalizedOffset: CGVector(dx: 0.6, dy: 0.32))
                start.press(forDuration: 0.05, thenDragTo: end)
                Thread.sleep(forTimeInterval: 0.7)
                scrolls += 1
                lastScroll = Date()
            }
            Thread.sleep(forTimeInterval: 0.3)
        } while Date() < deadline
        let diagnostic = XCTAttachment(string: app.debugDescription)
        diagnostic.name = "Missing control hierarchy: \(title)"
        diagnostic.lifetime = .keepAlways
        add(diagnostic)
        screenshot("Missing control: \(title)")
        XCTFail("Missing visible startup.io control: \(title)")
        return query.firstMatch
    }

    private func screenshot(_ title: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = title
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    private func startRun() {
        for _ in 0..<3 {
            button("Arenaya gir").tap()
            let tutorial = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Başlayaq")).firstMatch
            if tutorial.waitForExistence(timeout: 5) { tutorial.tap() }
            if app.buttons["Fasilə"].waitForExistence(timeout: 10) { return }
        }
        XCTAssertTrue(app.buttons["Fasilə"].exists, "Launch must actually open the native arena")
    }

    private func openStudio() {
        for _ in 0..<3 {
            button("Özəlləşdir").tap()
            if app.staticTexts["Sənin üslubun"].waitForExistence(timeout: 5) { return }
        }
        XCTFail("The native customization tab must actually open")
    }

    func testNativeGameplayPauseAndLandscape() throws {
        screenshot("01-startupio-native-home")
        startRun()
        screenshot("02-startupio-native-arena")
        let portraitFrame = app.frame
        let portraitPauseFrame = app.buttons["Fasilə"].frame
        let portraitPausePoint = app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: portraitPauseFrame.midX - portraitFrame.minX, dy: portraitPauseFrame.midY - portraitFrame.minY))
        // A real drag in the middle of the screen exercises the free-position joystick.
        let joystick = app.coordinate(withNormalizedOffset: CGVector(dx: 0.25, dy: 0.58))
        let end = joystick.withOffset(CGVector(dx: 48, dy: 28))
        joystick.press(forDuration: 0.15, thenDragTo: end, withVelocity: .slow, thenHoldForDuration: 1.1)
        button("Pivot — qaçış sipəri").tap()
        let pivotCooldown = XCTNSPredicateExpectation(predicate: NSPredicate(format: "enabled == false"), object: app.buttons["Pivot — qaçış sipəri"])
        XCTAssertEqual(XCTWaiter.wait(for: [pivotCooldown], timeout: 5), .completed, "The native PIVOT control must activate and enter cooldown")
        portraitPausePoint.tap()
        XCTAssertTrue(app.staticTexts["Nəfəs dər."].waitForExistence(timeout: 5))
        let valuation = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "$")).firstMatch.label
        XCTAssertNotEqual(valuation, "$10K", "Dragging in the native arena must actually collect funding")
        screenshot("04-startupio-native-paused")
        // Rotate while paused so UI automation time cannot expose an idle company to rivals.
        XCUIDevice.shared.orientation = .landscapeLeft
        Thread.sleep(forTimeInterval: 1)
        XCTAssertTrue(app.staticTexts["Nəfəs dər."].exists)
        screenshot("05b-startupio-native-landscape-pause")
        // Resolve the pause hit point while time is stopped. Repeated accessibility
        // lookups during active play can leave an idle company exposed to rivals.
        let pauseFrame = app.buttons["Fasilə"].frame
        let applicationFrame = app.frame
        let pausePoint = app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: pauseFrame.midX - applicationFrame.minX, dy: pauseFrame.midY - applicationFrame.minY))
        button("Oyuna qayıt").tap()
        XCTAssertTrue(button("Sürətlənmə").isHittable)
        pausePoint.tap()
        XCTAssertTrue(app.staticTexts["Nəfəs dər."].waitForExistence(timeout: 5))
        // WebKit's accessibility activation points settle after the dialog's entrance animation.
        Thread.sleep(forTimeInterval: 0.4)
        screenshot("05-startupio-native-landscape")
        button("Saxla və çıx").tap()
        XCUIDevice.shared.orientation = .portrait
        screenshot("06-startupio-native-return")
        XCTAssertTrue(button("Davam et").exists, "The endless company must stay resumable")
        app.terminate()
        app.launchEnvironment["STARTUP_UI_RELAUNCH"] = "1"
        app.launch()
        for _ in 0..<3 {
            button("Davam et").tap()
            if app.buttons["Fasilə"].waitForExistence(timeout: 5) { break }
        }
        XCTAssertTrue(app.buttons["Fasilə"].exists, "Continue must actually reopen the saved arena")
        portraitPausePoint.tap()
        XCTAssertFalse(app.staticTexts["Garage"].exists, "Level UI must be removed")
        screenshot("07-startupio-native-endless-restored")
    }

    func testNativeMarketplacePurchaseAndLogoPersistence() throws {
        button("Marketplace").tap()
        screenshot("07-startupio-native-marketplace")
        button("Lotus AI", scroll: true).tap()
        XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Al və seç")).firstMatch.waitForExistence(timeout: 10))
        screenshot("08-startupio-native-shop-preview")
        button("Al və seç").tap()
        button("Marketplace").tap()
        XCTAssertTrue(button("Oyun xalları").label.contains("70"), "180 credits must be deducted from the 250 starter balance")
        openStudio()
        XCTAssertTrue(button("Seç Lotus AI", scroll: true, anyControl: true).exists)
        screenshot("09-startupio-native-customization")
        app.terminate()
        app.launchEnvironment["STARTUP_UI_RELAUNCH"] = "1"
        app.launch()
        XCTAssertTrue(app.buttons["Ayarlar"].waitForExistence(timeout: 120))
        Thread.sleep(forTimeInterval: 1)
        openStudio()
        XCTAssertTrue(button("Seç Lotus AI", scroll: true, anyControl: true).exists, "The purchased logo must remain owned after relaunch")
        screenshot("10-startupio-native-restored-logo")
    }

    func testNativeSettingsPersistAfterRelaunchAndBackgroundPauses() throws {
        button("Ayarlar").tap()
        button("EN").tap()
        button("Close").tap()
        app.terminate()
        app.launchEnvironment["STARTUP_UI_RELAUNCH"] = "1"
        app.launch()
        XCTAssertTrue(button("Enter the arena").isHittable, "The game's isolated local settings must persist on relaunch")
        button("Enter the arena").tap()
        let tutorial = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Let’s go")).firstMatch
        if tutorial.waitForExistence(timeout: 3) { tutorial.tap() }
        XCTAssertTrue(app.buttons["Pause"].waitForExistence(timeout: 15))
        XCUIDevice.shared.press(.home)
        Thread.sleep(forTimeInterval: 0.8)
        app.activate()
        XCTAssertTrue(app.staticTexts["Take a breather."].waitForExistence(timeout: 10))
        screenshot("10-startupio-native-background-pause")
        button("Back to the arena").tap()
        XCTAssertTrue(app.buttons["Pause"].waitForExistence(timeout: 10))
        let resumed = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: app.staticTexts["Take a breather."])
        XCTAssertEqual(XCTWaiter.wait(for: [resumed], timeout: 5), .completed, "Resume must actually dismiss the pause screen")
        screenshot("11-startupio-native-resumed")
        app.terminate()
        app.launchEnvironment.removeAll()
    }
}

final class StartupIOStoreScreenshots: XCTestCase {
    private let app = XCUIApplication(bundleIdentifier: "com.atlasoon.startupio")

    private func tap(_ title: String) {
        let query = app.buttons.matching(NSPredicate(format: "label == %@", title))
        let deadline = Date().addingTimeInterval(45)
        repeat {
            if let element = query.allElementsBoundByIndex.first(where: { $0.exists && $0.isHittable && $0.isEnabled }) {
                Thread.sleep(forTimeInterval: 0.4)
                element.tap()
                return
            }
            Thread.sleep(forTimeInterval: 0.3)
        } while Date() < deadline
        let attachment = XCTAttachment(string: app.debugDescription)
        attachment.lifetime = .keepAlways
        add(attachment)
        XCTFail("Missing screenshot control: \(title)")
    }

    private func capture(_ name: String) {
        Thread.sleep(forTimeInterval: 0.8)
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = "store-\(name)"
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    func testStoreScreenshots() throws {
        continueAfterFailure = false
        XCUIDevice.shared.orientation = .portrait
        app.launchEnvironment["STARTUP_UI_TEST"] = "1"
        app.launch()
        XCTAssertTrue(app.buttons["Ayarlar"].waitForExistence(timeout: 120))
        Thread.sleep(forTimeInterval: 2)
        tap("Ayarlar")
        tap("EN")
        tap("Close")
        capture("01-home")
        tap("Enter the arena")
        tap("Let’s go")
        XCTAssertTrue(app.buttons["Pause"].waitForExistence(timeout: 30))
        capture("02-arena")
        let from = app.coordinate(withNormalizedOffset: CGVector(dx: 0.25, dy: 0.58))
        for _ in 0..<3 {
            from.press(forDuration: 0.15, thenDragTo: from.withOffset(CGVector(dx: 70, dy: 40)), withVelocity: .slow, thenHoldForDuration: 1.2)
            if app.buttons["Pivot — escape shield"].isEnabled { break }
        }
        XCTAssertTrue(app.buttons["Pivot — escape shield"].isEnabled, "A real native drag must start the screenshot company")
        tap("Pivot — escape shield")
        capture("03-pivot")
        tap("Pause")
        Thread.sleep(forTimeInterval: 0.4)
        tap("Save & leave")
        tap("Marketplace")
        capture("04-marketplace")
        tap("Customize")
        capture("05-customize")
        app.terminate()
    }
}
