import WidgetKit
import SwiftUI

/// Widget extension-un giriş nöqtəsi.
/// Xcode-da AnacanTimerWidget target-i yaradılanda bu fayl onun @main-i olur.
@main
struct AnacanTimerWidgetBundle: WidgetBundle {
    var body: some Widget {
        if #available(iOS 16.1, *) {
            AnacanTimerWidgetLiveActivity()
        }
    }
}
