import * as fs from "fs";

// StatePersister interface and implementations
export interface StatePersister {
    saveState(state : string) : void;
    loadState() : string | undefined;
}

// In-memory implementation of StatePersister
export class InMemoryStatePersister implements StatePersister {
    private state? : string;

    saveState(state : string) : void {
        this.state = state;
    }

    loadState() : string | undefined {
        return this.state;
    }
}

// Factory function for in-memory StatePersister
export function getInMemoryStatePersister() : StatePersister {
    return new InMemoryStatePersister();
}

// File-based implementation of StatePersister
export class FileStatePersister implements StatePersister {
    private filePath : string;

    constructor(filePath : string) {
        this.filePath = filePath;
    }

    saveState(state : string) : void {
        fs.writeFileSync(this.filePath, state);
    }

    loadState() : string | undefined {
        if (fs.existsSync(this.filePath)) {
            return fs.readFileSync(this.filePath, "utf-8");
        } else {
            return undefined;
        }
    }
}

// Factory function for file-based StatePersister
export function getFileStatePersister(filePath : string) : StatePersister {
    return new FileStatePersister(filePath);
}