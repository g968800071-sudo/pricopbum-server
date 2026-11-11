import XCTest

final class TouchUITests: XCTestCase {
    func testRealTouchesMoveAndFire() throws {
        let app = XCUIApplication(bundleIdentifier: "studio.pricop.pricopbum")
        app.launchArguments = ["-pbProbe"]
        XCUIDevice.shared.orientation = .landscapeLeft
        app.launch()
        XCUIDevice.shared.orientation = .landscapeLeft
        XCTAssertGreaterThan(app.frame.width, app.frame.height, "expected a landscape app frame, got \(app.frame)")
        XCTAssertTrue(waitLog("\"stage\":\"menu\"", 90))
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.82, dy: 0.16)).tap()
        Thread.sleep(forTimeInterval: 1.2)
        try XCUIScreen.main.screenshot().pngRepresentation.write(to: URL(fileURLWithPath: "/tmp/pb-shop.png"))
        XCTAssertTrue(waitLog("\"stage\":\"ready-touch\"", 40), "duel did not reach play")
        // Documented XCUICoordinate drags. One finger at a time: the public API
        // has no way to hold two independent sticks down together.
        let move = app.coordinate(withNormalizedOffset: CGVector(dx: 0.18, dy: 0.78))
        move.press(forDuration: 0.2, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.36, dy: 0.42)), withVelocity: .slow, thenHoldForDuration: 0.4)
        let aim = app.coordinate(withNormalizedOffset: CGVector(dx: 0.82, dy: 0.78))
        aim.press(forDuration: 0.2, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.62, dy: 0.42)), withVelocity: .slow, thenHoldForDuration: 0.4)
        try XCUIScreen.main.screenshot().pngRepresentation.write(to: URL(fileURLWithPath: "/tmp/pb-during-touch.png"))
        XCTAssertTrue(waitLog("\"stage\":\"touch\"", 30))
        let line = try touchLine()
        try line.write(toFile: "/tmp/pb-touch-line.txt", atomically: true, encoding: .utf8)
        XCTAssertTrue(line.contains("play=1"), line)
        XCTAssertTrue(line.contains("\"moved\":true"), line)
        XCTAssertFalse(line.contains("\"coins\":0"), line)
        XCTAssertTrue(line.contains("\"watch\":true"), line)
    }

    func testStoreKitBuyRestoreAndCancel() throws {
        let app = XCUIApplication(bundleIdentifier: "studio.pricop.pricopbum")
        app.launchArguments = ["-pbProbe", "-pbIap", "buy", "-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
        print("iap-launch")
        app.launch()
        XCTAssertTrue(waitLog("\"stage\":\"iap-before\"", 40), "purchase setup did not start")
        _ = tapSheet(app, ["Purchase", "Buy", "Купить", "500 coins", "0.99", "$0.99", "0,99"])
        XCTAssertTrue(waitLog("\"stage\":\"iap-buy\"", 20), "purchase did not finish")
        let before = try probe("iap-before")
        let buy = try probe("iap-buy")
        let beforeServer = num(before["serverCoins"])
        let boughtServer = num(buy["serverCoins"])
        XCTAssertEqual(boughtServer, beforeServer + 500, "server coins \(before) \(buy)")
        XCTAssertEqual(num(buy["coins"]), num(before["coins"]), "device wallet changed")
        XCTAssertEqual(buy["status"] as? String, "purchased")

        XCTAssertTrue(waitLog("\"stage\":\"iap-restore\"", 25), "restore did not finish")
        let restored = try probe("iap-restore")
        XCTAssertEqual(num(restored["serverCoins"]), boughtServer, "restore credited coins again")
        XCTAssertEqual(restored["replay"] as? Bool, true)

        postStep("cancel")
        XCTAssertTrue(tapSheet(app, ["Cancel", "Отмена", "Annuler", "Abbrechen"]), "StoreKit cancel button did not appear")
        XCTAssertTrue(waitLog("\"stage\":\"iap-cancel\"", 25), "cancel did not finish")
        let cancelled = try probe("iap-cancel")
        XCTAssertEqual(cancelled["status"] as? String, "cancelled", "\(cancelled)")
        XCTAssertEqual(num(cancelled["serverCoins"]), boughtServer)
        XCTAssertEqual(num(cancelled["coins"]), num(before["coins"]))
        try XCUIScreen.main.screenshot().pngRepresentation.write(to: URL(fileURLWithPath: "/tmp/pb-iap-cancel.png"))
    }

    func postStep(_ step: String) {
        guard let url = URL(string: "http://127.0.0.1:8799/api/iap/test-step") else { return }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "content-type")
        req.httpBody = Data("{\"step\":\"\(step)\"}".utf8)
        let done = DispatchSemaphore(value: 0)
        URLSession.shared.dataTask(with: req) { _, _, _ in done.signal() }.resume()
        _ = done.wait(timeout: .now() + 5)
    }

    func probe(_ stage: String) throws -> [String: Any] {
        let text = try String(contentsOfFile: "/tmp/pb-probe.jsonl", encoding: .utf8)
        let line = text.split(separator: "\n").last { $0.contains("\"stage\":\"\(stage)\"") }.map(String.init) ?? ""
        let data = Data(line.utf8)
        return (try JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:]
    }

    func num(_ value: Any?) -> Int {
        if let n = value as? Int { return n }
        if let n = value as? Double { return Int(n) }
        if let n = value as? NSNumber { return n.intValue }
        return -1
    }

    func tapSheet(_ app: XCUIApplication, _ labels: [String]) -> Bool {
        let end = Date().addingTimeInterval(20)
        while Date() < end {
            let pools = [app.buttons, app.sheets.buttons, app.alerts.buttons]
            for label in labels {
                for pool in pools {
                    let button = pool[label]
                    if button.exists && button.isHittable { button.tap(); return true }
                    let match = pool.matching(NSPredicate(format: "label CONTAINS[c] %@", label)).firstMatch
                    if match.exists && match.isHittable { match.tap(); return true }
                }
            }
            RunLoop.current.run(until: Date().addingTimeInterval(0.3))
        }
        let names = app.buttons.allElementsBoundByIndex.prefix(40).map { $0.label }.joined(separator: " | ")
        print("iap-buttons \(names)")
        return false
    }

    func waitLog(_ needle: String, _ seconds: TimeInterval) -> Bool {
        let path = "/tmp/pb-probe.jsonl"
        let end = Date().addingTimeInterval(seconds)
        while Date() < end {
            if let text = try? String(contentsOfFile: path, encoding: .utf8), text.contains(needle) { return true }
            RunLoop.current.run(until: Date().addingTimeInterval(0.3))
        }
        return false
    }

    func touchLine() throws -> String {
        let text = try String(contentsOfFile: "/tmp/pb-probe.jsonl", encoding: .utf8)
        return text.split(separator: "\n").last { $0.contains("\"stage\":\"touch\"") }.map(String.init) ?? text
    }
}
