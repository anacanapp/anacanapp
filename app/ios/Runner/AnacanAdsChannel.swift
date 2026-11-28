import Flutter
import UIKit
#if canImport(GoogleMobileAds)
import GoogleMobileAds
#endif

/// The parts of the patched `@capacitor-community/admob` 8.1.0 (patches/@capacitor-community+admob+8.1.0.patch) that
/// google_mobile_ads has no Dart API for. Banners, interstitials, rewarded ads and UMP run through google_mobile_ads
/// (services/ads/google_mobile_ads_sdk.dart); GoogleMobileAds comes with that plugin's Swift package.
///
///  - `appId`: Info.plist `GADApplicationIdentifier` (from $(ANACAN_ADMOB_APP_ID)), React's compiled
///    `VITE_ADMOB_IOS_APP_ID`.
///  - The full-screen native story ad, a port of the patch's NativeStoryExecutor.swift / NativeStoryController.
///    Without GoogleMobileAds importable here every story call rejects (the adapter then skips story ads).
///
/// Channel "anacan/admob": appId, prepareNativeStoryAd {adId, isTesting, npa, videoOnly} -> {adUnitId, hasVideo},
/// showNativeStoryAd {adId}, removeNativeStoryAd. Native -> Dart: event {name}.
final class AnacanAdsChannel: NSObject {
  static let channelName = "anacan/admob"

  private let channel: FlutterMethodChannel
  #if canImport(GoogleMobileAds)
  private let story = NativeStoryExecutor()
  #endif

  init(messenger: FlutterBinaryMessenger) {
    channel = FlutterMethodChannel(name: AnacanAdsChannel.channelName, binaryMessenger: messenger)
    super.init()
    #if canImport(GoogleMobileAds)
    story.notify = { [weak self] name in self?.channel.invokeMethod("event", arguments: ["name": name]) }
    #endif
    channel.setMethodCallHandler { [weak self] call, result in
      self?.handle(call, result: result)
    }
  }

  private func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
    let args = call.arguments as? [String: Any] ?? [:]
    switch call.method {
    case "appId":
      result(Bundle.main.object(forInfoDictionaryKey: "GADApplicationIdentifier") as? String)
    case "prepareNativeStoryAd":
      #if canImport(GoogleMobileAds)
      let videoOnly = args["videoOnly"] as? Bool ?? false
      let test = videoOnly ? "ca-app-pub-3940256099942544/2521693316" : "ca-app-pub-3940256099942544/3986624511"
      let id = (args["isTesting"] as? Bool ?? false) ? test : (args["adId"] as? String ?? test)
      let request = Request()
      if args["npa"] as? Bool ?? false {
        let extras = Extras()
        extras.additionalParameters = ["npa": "1"]
        request.register(extras)
      }
      story.prepare(result, request, id, videoOnly)
      #else
      result(FlutterError(code: "UNAVAILABLE", message: "Native story ad unavailable", details: nil))
      #endif
    case "showNativeStoryAd":
      #if canImport(GoogleMobileAds)
      story.show(result, args["adId"] as? String)
      #else
      result(FlutterError(code: "NOT_READY", message: "Native story ad not ready", details: nil))
      #endif
    case "removeNativeStoryAd":
      #if canImport(GoogleMobileAds)
      story.clear()
      #endif
      result(nil)
    default:
      result(FlutterMethodNotImplemented)
    }
  }
}

/// The key window's root view controller (Capacitor: `plugin.getRootVC()`).
private func anacanRootViewController() -> UIViewController? {
  let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
  let windows = scenes.flatMap { $0.windows }
  return (windows.first { $0.isKeyWindow } ?? windows.first)?.rootViewController
}

#if canImport(GoogleMobileAds)
private final class NativeStoryExecutor: NSObject, NativeAdLoaderDelegate, NativeAdDelegate {
  var notify: ((String) -> Void)?
  private var loader: AdLoader?
  private var pending: FlutterResult?
  private var ad: NativeAd?
  private var adId = ""
  private var videoOnly = false
  private var controller: NativeStoryController?

  func prepare(_ result: @escaping FlutterResult, _ request: Request, _ id: String, _ onlyVideo: Bool) {
    guard controller == nil, let root = anacanRootViewController() else {
      result(FlutterError(code: "BUSY", message: "Story ad is busy", details: nil))
      return
    }
    pending?(FlutterError(code: "REPLACED", message: "Story ad preparation replaced", details: nil))
    ad?.delegate = nil
    ad = nil
    adId = id
    videoOnly = onlyVideo
    pending = result
    let media = NativeAdMediaAdLoaderOptions()
    media.mediaAspectRatio = .portrait
    let video = VideoOptions()
    video.shouldStartMuted = true
    let value = AdLoader(adUnitID: id, rootViewController: root, adTypes: [.native], options: [media, video])
    loader = value
    value.delegate = self
    value.load(request)
  }

  func adLoader(_ adLoader: AdLoader, didReceive nativeAd: NativeAd) {
    guard adLoader === loader, let result = pending else { return }
    pending = nil
    if videoOnly && !nativeAd.mediaContent.hasVideoContent {
      result(FlutterError(code: "UNAVAILABLE", message: "Native video ad unavailable", details: nil))
      return
    }
    ad = nativeAd
    nativeAd.delegate = self
    result(["adUnitId": adId, "hasVideo": nativeAd.mediaContent.hasVideoContent])
  }

  func adLoader(_ adLoader: AdLoader, didFailToReceiveAdWithError error: Error) {
    guard adLoader === loader else { return }
    pending?(FlutterError(code: "UNAVAILABLE", message: "Native story ad unavailable", details: nil))
    pending = nil
  }

  func show(_ result: @escaping FlutterResult, _ requestedId: String?) {
    guard controller == nil, let root = anacanRootViewController(), root.presentedViewController == nil,
          let ad = ad, requestedId == adId else {
      result(FlutterError(code: "NOT_READY", message: "Native story ad not ready", details: nil))
      return
    }
    let page = NativeStoryController(ad: ad)
    page.modalPresentationStyle = .fullScreen
    page.closed = { [weak self] in self?.close() }
    controller = page
    root.present(page, animated: true) { [weak self] in
      self?.notify?("nativeStoryAdShowed")
      result(nil)
    }
  }

  private func close() {
    guard let page = controller else { return }
    controller = nil
    page.dismiss(animated: true) { [weak self] in self?.notify?("nativeStoryAdDismissed") }
    ad?.delegate = nil
    ad = nil
  }

  func clear() {
    pending?(FlutterError(code: "CANCELLED", message: "Native story ad cancelled", details: nil))
    pending = nil
    loader?.delegate = nil
    loader = nil
    close()
    ad?.delegate = nil
    ad = nil
  }

  func nativeAdDidRecordImpression(_ nativeAd: NativeAd) {
    guard nativeAd === ad else { return }
    notify?("nativeStoryAdImpression")
  }
}

private final class NativeStoryController: UIViewController {
  let ad: NativeAd
  var closed: (() -> Void)?
  private var timer: Timer?

  init(ad: NativeAd) {
    self.ad = ad
    super.init(nibName: nil, bundle: nil)
  }

  required init?(coder: NSCoder) { fatalError("Unavailable") }

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .black
    let adView = NativeAdView()
    adView.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(adView)
    NSLayoutConstraint.activate([
      adView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      adView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      adView.topAnchor.constraint(equalTo: view.topAnchor),
      adView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
    ])
    let media = MediaView()
    media.translatesAutoresizingMaskIntoConstraints = false
    media.contentMode = .scaleAspectFit
    adView.addSubview(media)
    adView.mediaView = media
    media.mediaContent = ad.mediaContent
    let footer = UIStackView()
    footer.axis = .vertical
    footer.spacing = 10
    footer.translatesAutoresizingMaskIntoConstraints = false
    footer.backgroundColor = UIColor.black.withAlphaComponent(0.75)
    footer.isLayoutMarginsRelativeArrangement = true
    footer.layoutMargins = UIEdgeInsets(top: 16, left: 20, bottom: 16, right: 20)
    adView.addSubview(footer)
    let disclosure = UILabel()
    disclosure.text = "REKLAM"
    disclosure.textColor = .lightGray
    disclosure.font = .boldSystemFont(ofSize: 11)
    footer.addArrangedSubview(disclosure)
    let advertiser = UILabel()
    advertiser.text = ad.advertiser
    advertiser.textColor = .lightGray
    advertiser.font = .systemFont(ofSize: 12)
    footer.addArrangedSubview(advertiser)
    adView.advertiserView = advertiser
    let headline = UILabel()
    headline.text = ad.headline
    headline.textColor = .white
    headline.font = .boldSystemFont(ofSize: 22)
    headline.numberOfLines = 2
    footer.addArrangedSubview(headline)
    adView.headlineView = headline
    let body = UILabel()
    body.text = ad.body
    body.textColor = .lightGray
    body.font = .systemFont(ofSize: 14)
    body.numberOfLines = 2
    footer.addArrangedSubview(body)
    adView.bodyView = body
    let cta = UIButton(type: .system)
    cta.setTitle(ad.callToAction ?? "Ətraflı", for: .normal)
    cta.backgroundColor = .white
    cta.setTitleColor(.black, for: .normal)
    cta.layer.cornerRadius = 12
    cta.heightAnchor.constraint(equalToConstant: 48).isActive = true
    cta.isUserInteractionEnabled = false
    footer.addArrangedSubview(cta)
    adView.callToActionView = cta
    let choices = AdChoicesView()
    choices.translatesAutoresizingMaskIntoConstraints = false
    adView.addSubview(choices)
    adView.adChoicesView = choices
    NSLayoutConstraint.activate([
      footer.leadingAnchor.constraint(equalTo: adView.leadingAnchor, constant: 12),
      footer.trailingAnchor.constraint(equalTo: adView.trailingAnchor, constant: -12),
      footer.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -58),
      media.leadingAnchor.constraint(equalTo: adView.leadingAnchor),
      media.trailingAnchor.constraint(equalTo: adView.trailingAnchor),
      media.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 52),
      media.bottomAnchor.constraint(equalTo: footer.topAnchor),
      choices.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -16),
      choices.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 12),
      choices.widthAnchor.constraint(equalToConstant: 30),
      choices.heightAnchor.constraint(equalToConstant: 30),
    ])
    let close = UIButton(type: .system)
    close.setTitle("✕", for: .normal)
    close.setTitleColor(.white, for: .normal)
    close.accessibilityLabel = "Reklamı bağla"
    close.translatesAutoresizingMaskIntoConstraints = false
    close.addTarget(self, action: #selector(finish), for: .touchUpInside)
    view.addSubview(close)
    let next = UIButton(type: .system)
    next.setTitle("Növbəti story ›", for: .normal)
    next.setTitleColor(.white, for: .normal)
    next.translatesAutoresizingMaskIntoConstraints = false
    next.addTarget(self, action: #selector(finish), for: .touchUpInside)
    view.addSubview(next)
    NSLayoutConstraint.activate([
      close.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 16),
      close.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 8),
      close.widthAnchor.constraint(equalToConstant: 44),
      close.heightAnchor.constraint(equalToConstant: 44),
      next.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -8),
      next.centerXAnchor.constraint(equalTo: view.centerXAnchor),
      next.heightAnchor.constraint(equalToConstant: 44),
    ])
    adView.nativeAd = ad
    if !ad.mediaContent.hasVideoContent {
      timer = Timer.scheduledTimer(withTimeInterval: 6, repeats: false) { [weak self] _ in self?.finish() }
    }
  }

  @objc private func finish() {
    timer?.invalidate()
    timer = nil
    closed?()
  }

  override func viewDidDisappear(_ animated: Bool) {
    super.viewDidDisappear(animated)
    timer?.invalidate()
    timer = nil
  }
}
#endif
