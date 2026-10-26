import Capacitor
import WebKit

@objc(GameViewController)
final class GameViewController: CAPBridgeViewController {
    override var prefersStatusBarHidden: Bool { true }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        UIApplication.shared.isIdleTimerDisabled = true
        webView?.scrollView.bounces = false
        webView?.scrollView.contentInsetAdjustmentBehavior = .never
    }

    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)
        UIApplication.shared.isIdleTimerDisabled = false
    }

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        #if DEBUG
        let environment = ProcessInfo.processInfo.environment
        if environment["STARTUP_UI_TEST"] == "1" {
            // Native UI acceptance has its own storage key; a user's campaign is preserved.
            let reset = environment["STARTUP_UI_RELAUNCH"] != "1"
            let source = """
            (() => {
              const key = 'startup.io.progress.v1', isolated = 'startup.io.ui-test.v1';
              const proto = Storage.prototype;
              const get = proto.getItem, set = proto.setItem, remove = proto.removeItem;
              if (\(reset ? "true" : "false")) remove.call(localStorage, isolated);
              proto.getItem = function(k) { return get.call(this, this === localStorage && k === key ? isolated : k); };
              proto.setItem = function(k, v) { return set.call(this, this === localStorage && k === key ? isolated : k, v); };
              proto.removeItem = function(k) { return remove.call(this, this === localStorage && k === key ? isolated : k); };
            })();
            """
            webView?.configuration.userContentController.addUserScript(WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
        #endif
    }
}
