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
