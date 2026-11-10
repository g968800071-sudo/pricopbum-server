import UIKit
import Capacitor
import StoreKit
import WebKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}

class PbBridgeViewController: CAPBridgeViewController, WKScriptMessageHandler {
    private var storeInstalled = false
    private var pluginRegistered = false
    private var reloadedForStore = false

    override func viewDidLoad() {
        super.viewDidLoad()
        prepareStore()
    }

    override open func capacitorDidLoad() {
        super.capacitorDidLoad()
        prepareStore()
    }

    func prepareStore() {
        if !pluginRegistered, let bridge = self.bridge {
            bridge.registerPluginInstance(StoreKitPlugin())
            pluginRegistered = true
        }
        installStore()
        if pluginRegistered && !reloadedForStore {
            reloadedForStore = true
            webView?.reload()
        }
    }

    func installStore() {
        guard let webView = self.webView, !storeInstalled else { return }
        storeInstalled = true
        let raw = UserDefaults.standard.dictionary(forKey: "pbStore") as? [String: String] ?? [:]
        let data = (try? JSONSerialization.data(withJSONObject: raw, options: [])) ?? Data("{}".utf8)
        let json = String(data: data, encoding: .utf8) ?? "{}"
        let args = ProcessInfo.processInfo.arguments
        let probe = args.contains("-pbProbe")
        var scenario = ""
        if let idx = args.firstIndex(of: "-pbIap"), idx + 1 < args.count { scenario = args[idx + 1] }
        let scenarioJson = (try? JSONEncoder().encode(scenario)).flatMap { String(data: $0, encoding: .utf8) } ?? "\"\""
        let source = "window.__pbBootStore=\(json);window.__pbProbe=\(probe ? "true" : "false");window.__pbIapScenario=\(scenarioJson);"
        webView.configuration.userContentController.addUserScript(WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        webView.configuration.userContentController.add(self, name: "pbStore")
        webView.configuration.userContentController.add(self, name: "pbIap")
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.name == "pbIap" { handleIap(message); return }
        guard message.name == "pbStore" else { return }
        var key = ""
        var value = ""
        if let body = message.body as? [String: Any] {
            key = body["key"] as? String ?? ""
            value = body["value"] as? String ?? ""
        }
        if key.isEmpty { return }
        var store = UserDefaults.standard.dictionary(forKey: "pbStore") as? [String: String] ?? [:]
        if value.isEmpty { store.removeValue(forKey: key) } else { store[key] = value }
        UserDefaults.standard.set(store, forKey: "pbStore")
    }

    func replyIap(_ id: String, _ body: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: body, options: []),
              let json = String(data: data, encoding: .utf8) else { return }
        let js = "window.__pbIapResult && window.__pbIapResult(" + id.jsonQuoted() + "," + json + ")"
        webView?.evaluateJavaScript(js, completionHandler: nil)
    }

    func handleIap(_ message: WKScriptMessage) {
        let body = message.body as? [String: Any] ?? [:]
        let id = body["id"] as? String ?? ""
        let op = body["op"] as? String ?? ""
        guard #available(iOS 15.0, *) else { replyIap(id, ["status": "unavailable"]); return }
        Task {
            let result = await PbIap.run(op, body)
            await MainActor.run { self.replyIap(id, result) }
        }
    }
}

private extension String {
    func jsonQuoted() -> String {
        let data = try? JSONSerialization.data(withJSONObject: [self], options: [])
        let text = data.flatMap { String(data: $0, encoding: .utf8) } ?? "[\"\"]"
        return String(text.dropFirst().dropLast())
    }
}

@available(iOS 15.0, *)
enum PbIap {
    static func run(_ op: String, _ body: [String: Any]) async -> [String: Any] {
        do {
            switch op {
            case "load":
                let ids = body["ids"] as? [String] ?? []
                let products = try await Product.products(for: Set(ids))
                let rows: [[String: String]] = products.map { ["id": $0.id, "displayPrice": $0.displayPrice, "displayName": $0.displayName] }
                return ["products": rows]
            case "purchase":
                let id = body["productId"] as? String ?? ""
                guard let product = try await Product.products(for: [id]).first else { return ["status": "unavailable"] }
                let result = try await product.purchase()
                switch result {
                case .success(let verification):
                    guard case .verified(let tx) = verification else { return ["status": "unverified"] }
                    return ["status": "purchased", "jws": verification.jwsRepresentation, "transactionId": String(tx.id), "productId": tx.productID]
                case .userCancelled:
                    return ["status": "cancelled"]
                case .pending:
                    return ["status": "pending"]
                @unknown default:
                    return ["status": "error"]
                }
            case "restore":
                try? await AppStore.sync()
                var unfinished: [[String: String]] = []
                for await result in Transaction.unfinished {
                    if case .verified(let tx) = result {
                        unfinished.append(["jws": result.jwsRepresentation, "transactionId": String(tx.id), "productId": tx.productID])
                    }
                }
                var entitlements: [[String: String]] = []
                for await result in Transaction.currentEntitlements {
                    if case .verified(let tx) = result {
                        entitlements.append(["jws": result.jwsRepresentation, "transactionId": String(tx.id), "productId": tx.productID])
                    }
                }
                return ["unfinished": unfinished, "entitlements": entitlements]
            case "finish":
                let wanted = body["transactionId"] as? String ?? ""
                for await result in Transaction.unfinished {
                    if case .verified(let tx) = result, String(tx.id) == wanted { await tx.finish() }
                }
                return ["ok": true]
            default:
                return ["status": "error"]
            }
        } catch {
            return ["status": "error", "message": error.localizedDescription]
        }
    }
}
