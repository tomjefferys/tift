import { FormattedToken } from "./formattedToken";
import pc from "picocolors";

export type TokenFormatter = (token : FormattedToken) => string;
export type TokenListFormatter = (tokens : FormattedToken[]) => string[];

const brightnessMap = {
    "bright": {
        "red": pc.redBright,
        "green": pc.greenBright,
        "blue": pc.blueBright,
        "yellow": pc.yellowBright,
        "cyan": pc.cyanBright,
        "magenta": pc.magentaBright,
        "white": pc.whiteBright,
        "black": pc.blackBright,
    },
    "normal": {
        "red": pc.red,
        "green": pc.green,
        "blue": pc.blue,
        "yellow": pc.yellow,
        "cyan": pc.cyan,
        "magenta": pc.magenta,
        "white": pc.white,
        "black": pc.black,
    },
};  


export const ANSI_TOKEN_FORMATTER : TokenFormatter = (token : FormattedToken) : string => {
    let formattedText = token.text;

    let colourFn : (text : string) => string = (text) => text;
    if (token.colour) {
        const { hue, brightness } = token.colour;
        colourFn = brightnessMap[brightness][hue];
    } 

    switch(token.format) {
        case "bold":
            formattedText = colourFn(pc.bold(token.text));
            break;
        case "italic":
            formattedText = colourFn(pc.italic(token.text));
            break;
        case "bold-italic":
            formattedText = colourFn(pc.bold(pc.italic(token.text)));
            break;
        case "inverse":
            formattedText = colourFn(pc.inverse(token.text));
            break;
        case "code":
            formattedText = colourFn(pc.blue(token.text));
            break;
        case "plain":
        default:
            formattedText = colourFn(token.text);
    }
    return formattedText;
};
