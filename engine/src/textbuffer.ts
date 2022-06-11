
export interface TextBuffer {
    write: (str: string) => void;
    flush: () => string[];
}

export function createTextBuffer() {
    const buffer : string[] = [];
    return {
        write: (str: string) => buffer.push(str),
        flush: () => {
            const result = [...buffer];
            buffer.length = 0;
            return result;
        }
    }
}