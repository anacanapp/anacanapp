// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "AnacanCustomerioDataIn",
    platforms: [.iOS(.v16)],
    products: [.library(name: "AnacanCustomerioDataIn", targets: ["CustomerIoDataInPlugin"])],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.0.1"),
        .package(url: "https://github.com/customerio/customerio-ios.git", exact: "4.9.0")
    ],
    targets: [.target(
        name: "CustomerIoDataInPlugin",
        dependencies: [
            .product(name: "Capacitor", package: "capacitor-swift-pm"),
            .product(name: "Cordova", package: "capacitor-swift-pm"),
            .product(name: "DataPipelines", package: "customerio-ios")
        ],
        path: "ios/Sources/CustomerIoDataInPlugin"
    )]
)
