import Capacitor
import WebKit

@objc(GameViewController)
final class GameViewController: CAPBridgeViewController {
    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        UIApplication.shared.isIdleTimerDisabled = true
    }

    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)
        UIApplication.shared.isIdleTimerDisabled = false
    }

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        #if DEBUG
        let environment = ProcessInfo.processInfo.environment
        if environment["MOMMY_UI_TEST"] == "1" {
            let defaults = UserDefaults.standard
            let key = "CapacitorStorage.mommy-simulator-save-v1"
            let backup = key + "-backup"
            let isolation = "mommy-ui-test-isolation-v1"
            if defaults.bool(forKey: isolation) == false {
                if let saved = defaults.string(forKey: key) { defaults.set(saved, forKey: "mommy-ui-test-user-save") }
                if let saved = defaults.string(forKey: backup) { defaults.set(saved, forKey: "mommy-ui-test-user-backup") }
                defaults.set(true, forKey: isolation)
            }
            if environment["MOMMY_UI_RELAUNCH"] != "1" {
                defaults.removeObject(forKey: key)
                defaults.removeObject(forKey: backup)
                if let json = environment["MOMMY_UI_FIXTURE"] { defaults.set(json, forKey: key) }
            }
        }
        #endif
    }
}
