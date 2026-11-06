import XCTest

final class TouchUITests: XCTestCase {
    func testRealTouchesMoveAndFire() throws {
        let app = XCUIApplication(bundleIdentifier: "studio.pricop.pricopbum")
        app.launchArguments = ["-pbProbe"]
        XCUIDevice.shared.orientation = .landscapeLeft
        app.launch()
        XCUIDevice.shared.orientation = .landscapeLeft
        XCTAssertGreaterThan(app.frame.width, app.frame.height)
        XCTAssertTrue(waitLog("\"stage\":\"menu\"", 45))
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.82, dy: 0.16)).tap()
        XCTAssertTrue(waitLog("\"stage\":\"ready-touch\"", 30))
        let move = app.coordinate(withNormalizedOffset: CGVector(dx: 0.18, dy: 0.75))
        let moved = app.coordinate(withNormalizedOffset: CGVector(dx: 0.34, dy: 0.48))
        move.press(forDuration: 0.15, thenDragTo: moved)
        let aim = app.coordinate(withNormalizedOffset: CGVector(dx: 0.82, dy: 0.75))
        let aimed = app.coordinate(withNormalizedOffset: CGVector(dx: 0.66, dy: 0.48))
        aim.press(forDuration: 0.15, thenDragTo: aimed)
        app.pinch(withScale: 1.6, velocity: 1)
        XCTAssertTrue(waitLog("\"stage\":\"touch\"", 25))
        let line = try touchLine()
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
