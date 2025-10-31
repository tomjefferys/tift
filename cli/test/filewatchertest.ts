import { FileWatcher } from "../src/filewatcher";
import * as fs from "fs";

describe("FileWatcher", () => {
    let fileWatcher : FileWatcher;
    const filePath = "test.txt";
    let callback : jest.Mock;

    beforeEach(() => {
        callback = jest.fn();
        fs.writeFileSync(filePath, "Initial content");
        fileWatcher = new FileWatcher(filePath, callback, 100);
    });

    afterEach(() => {
        fileWatcher.stop();
        fs.unlinkSync(filePath);
    });

    test("should start watching a file", () => {
        fileWatcher.start();
        // Simulate file change (and use a timestamp that is definitely in the future)
        const futureTime = new Date(Date.now() + 2000);
        fs.utimesSync(filePath, futureTime, futureTime);
        // Wait 100ms for the watcher to detect the change
        return new Promise((resolve) => {
            setTimeout(() => {
                expect(callback).toHaveBeenCalled();
                resolve(true);
            }, 200);
        });
    });

    test("should stop watching a file", () => {
        fileWatcher.start();
        fileWatcher.stop();
        // Simulate file change
        fs.utimesSync(filePath, new Date(), new Date());
        expect(callback).not.toHaveBeenCalled();
    });
});