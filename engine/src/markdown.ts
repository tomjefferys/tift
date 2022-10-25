
const ITALIC = "*";
const BOLD = "**";
const STRIKE_THROUGH = "~~";

export function bold(text : string) : string {
    return wrap(text, BOLD);
}

export function italic(text : string) : string {
    return wrap(text, ITALIC);
}

export function strikeThrough(text : string) : string {
    return wrap(text, STRIKE_THROUGH);
}

function wrap(text : string, wrapper : string) : string { 
    return wrapper + text + wrapper;
}