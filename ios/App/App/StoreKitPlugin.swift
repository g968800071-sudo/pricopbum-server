import Capacitor
import Foundation
import StoreKit

@objc(StoreKitPlugin)
public class StoreKitPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "StoreKitPlugin"
    public let jsName = "StoreKit"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "load", returnType: "promise"),
        CAPPluginMethod(name: "purchase", returnType: "promise"),
        CAPPluginMethod(name: "restore", returnType: "promise"),
        CAPPluginMethod(name: "finish", returnType: "promise"),
    ]

    @objc func load(_ call: CAPPluginCall) {
        guard #available(iOS 15.0, *) else { call.resolve(["products": [], "status": "unavailable"]); return }
        let ids = call.getArray("ids", String.self) ?? []
        Task {
            do {
                let products = try await Product.products(for: Set(ids))
                let rows: [[String: String]] = products.map { p in
                    ["id": p.id, "displayPrice": p.displayPrice, "displayName": p.displayName, "type": String(describing: p.type)]
                }
                await MainActor.run { call.resolve(["products": rows]) }
            } catch {
                await MainActor.run { call.resolve(["products": [], "status": "error", "message": error.localizedDescription]) }
            }
        }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        guard #available(iOS 15.0, *) else { call.resolve(["status": "unavailable"]); return }
        let id = call.getString("productId") ?? ""
        Task {
            do {
                let products = try await Product.products(for: [id])
                guard let product = products.first else {
                    await MainActor.run { call.resolve(["status": "unavailable"]) }
                    return
                }
                let result = try await product.purchase()
                switch result {
                case .success(let verification):
                    switch verification {
                    case .verified(let tx):
                        let body: [String: String] = ["status": "purchased", "jws": verification.jwsRepresentation, "transactionId": String(tx.id), "productId": tx.productID]
                        await MainActor.run { call.resolve(body) }
                    case .unverified:
                        await MainActor.run { call.resolve(["status": "unverified"]) }
                    }
                case .userCancelled:
                    await MainActor.run { call.resolve(["status": "cancelled"]) }
                case .pending:
                    await MainActor.run { call.resolve(["status": "pending"]) }
                @unknown default:
                    await MainActor.run { call.resolve(["status": "error"]) }
                }
            } catch {
                await MainActor.run { call.resolve(["status": "error", "message": error.localizedDescription]) }
            }
        }
    }

    @objc func restore(_ call: CAPPluginCall) {
        guard #available(iOS 15.0, *) else { call.resolve(["unfinished": [], "entitlements": []]); return }
        Task {
            do { try await AppStore.sync() } catch {}
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
            await MainActor.run { call.resolve(["unfinished": unfinished, "entitlements": entitlements]) }
        }
    }

    @objc func finish(_ call: CAPPluginCall) {
        guard #available(iOS 15.0, *) else { call.resolve([:]); return }
        let wanted = call.getString("transactionId") ?? ""
        Task {
            for await result in Transaction.unfinished {
                if case .verified(let tx) = result, String(tx.id) == wanted {
                    await tx.finish()
                }
            }
            await MainActor.run { call.resolve(["ok": true]) }
        }
    }
}
