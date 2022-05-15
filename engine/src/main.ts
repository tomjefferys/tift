
export interface Engine {
    getWords : () => string[];
    submit: (command : string[]) => string;
}

export function getEngine() : Engine {
    return {
        getWords : () => ["one", "two", "three", "four"],
        submit : (command : string[] ) => "Submitted: " + command.join(" ")
    }
}