export type PrintHandler = (message : string) => void;
export type Result = "SUCCESS" | "FAILURE";

export type Format = "bold" | "italic" | "bold-italic" | "code" | "plain";
export type Hue = "red" | "green" | "blue" | "yellow" | "cyan" | "magenta" | "white" | "black";
export type Brightness = "bright" | "normal";
export type Space = "space" | "tabbed" | "no-space";

export interface Colour {
    hue : Hue;
    brightness : Brightness;
}

export interface FormattedToken {
    text : string;
    format? : Format;
    colour? : Colour;
    space? : Space;
}
