import * as fs from "fs";

export class FileWatcher {
    private filePath : string;
    private callback : () => void;
    private lastModifiedTime : Date;
    private intervalId : NodeJS.Timeout | null = null;
    private checkIntervalMs : number;

    constructor(filePath : string, callback : () => void, checkIntervalMs = 1000) {
        this.filePath = filePath;
        this.callback = callback;
        this.checkIntervalMs = checkIntervalMs;

        const stats = fs.statSync(this.filePath);
        this.lastModifiedTime = stats.mtime;
    }

    start() {
        this.intervalId = setInterval(() => this.checkFile(), this.checkIntervalMs);
    }
    
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    private checkFile() {
        fs.stat(this.filePath, (err, stats) => {
            if (err) {
                console.error(`Error checking file ${this.filePath}:`, err);
                return;
            }
            const modifiedTime = stats.mtime;
            if (modifiedTime > this.lastModifiedTime) {
                this.lastModifiedTime = modifiedTime;
                this.callback();
            }
        });
    }

    private getFileModifiedTime(): Date {
        const stats = fs.statSync(this.filePath);
        return stats.mtime;
    }
}