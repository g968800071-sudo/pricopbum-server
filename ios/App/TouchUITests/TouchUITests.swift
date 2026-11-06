import XCTest

final class TouchUITests: XCTestCase {
    func testRealTouchesMoveAndFire() throws {
        let app = XCUIApplication(bundleIdentifier: "studio.pricop.pricopbum")
        app.launchArguments = ["-pbProbe"]
        XCUIDevice.shared.orientation = .landscapeLeft
        app.launch()
        XCUIDevice.shared.orientation = .landscapeLeft
        XCTAssertGreaterThan(app.frame.width, app.frame.height, "expected a landscape app frame, got \(app.frame)")
        XCTAssertTrue(waitLog("\"stage\":\"menu\"", 45))
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.82, dy: 0.16)).tap()
        Thread.sleep(forTimeInterval: 1.2)
        try XCUIScreen.main.screenshot().pngRepresentation.write(to: URL(fileURLWithPath: "/tmp/pb-shop.png"))
        XCTAssertTrue(waitLog("\"stage\":\"ready-touch\"", 40), "duel did not reach play")
        func pt(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
            app.coordinate(withNormalizedOffset: CGVector(dx: x, dy: y)).screenPoint
        }
        let exp = expectation(description: "two-sticks")
        pbInjectTwoSticks(pt(0.18, 0.78), pt(0.32, 0.50), pt(0.82, 0.78), pt(0.66, 0.50), 1.4) { err in
            try? (err ?? "ok").write(toFile: "/tmp/pb-inject.txt", atomically: true, encoding: .utf8)
            exp.fulfill()
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
            try? XCUIScreen.main.screenshot().pngRepresentation.write(to: URL(fileURLWithPath: "/tmp/pb-during-touch.png"))
        }
        wait(for: [exp], timeout: 12)
        XCTAssertTrue(waitLog("\"stage\":\"touch\"", 20))
        let line = try touchLine()
        let inject = (try? String(contentsOfFile: "/tmp/pb-inject.txt", encoding: .utf8)) ?? ""
        XCTAssertTrue(line.contains("play=1"), inject + " " + line)
        XCTAssertTrue(line.contains("\"moved\":true"), inject + " " + line)
        XCTAssertFalse(line.contains("\"coins\":0"), inject + " " + line)
        XCTAssertTrue(line.contains("\"watch\":true"), inject + " " + line)
        XCTAssertTrue(line.contains("both=1"), inject + " " + line)
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
