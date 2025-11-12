
const FORMAT_TYPES = ["bold", "italic", "bold-italic", "code", "plain"] as const;
export type Format = typeof FORMAT_TYPES[number];

const HUE_TYPES = ["red", "green", "blue", "yellow", "cyan", "magenta", "white", "black"] as const;
export type Hue = typeof HUE_TYPES[number];

const BRIGHTNESS_TYPES = ["bright", "normal"] as const;
export type Brightness = typeof BRIGHTNESS_TYPES[number];

const SPACE_TYPES = ["space", "join", "tab"] as const;
export type Space = typeof SPACE_TYPES[number];

type ArgType  = Format | Hue | Brightness | Space;

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

const DEFAULT_COLOUR : Colour = {
    hue: "white",
    brightness: "normal"
};

export function token(text : string, ...args : ArgType[]) : FormattedToken {
    const formattedToken : FormattedToken = { text };
    args.forEach(arg => {
        if (isFormat(arg)) {
            formattedToken.format = arg;
        } else if (isHue(arg)) {
            if (!formattedToken.colour) {
                formattedToken.colour = {...DEFAULT_COLOUR};
            }
            formattedToken.colour.hue = arg;
        } else if (isBrightness(arg)) {
            if (!formattedToken.colour) {
                formattedToken.colour = {...DEFAULT_COLOUR};
            } 
            formattedToken.colour.brightness = arg;
        } else if (isSpace(arg)) {
            formattedToken.space = arg;
        }
    });
    return formattedToken;
}

function isFormat(arg : ArgType) : arg is Format {
    return FORMAT_TYPES.includes(arg as Format);
}

function isHue(arg : ArgType) : arg is Hue {
    return HUE_TYPES.includes(arg as Hue);
} 

function isBrightness(arg : ArgType) : arg is Brightness {
    return BRIGHTNESS_TYPES.includes(arg as Brightness);
}

function isSpace(arg : ArgType) : arg is Space {
    return SPACE_TYPES.includes(arg as Space);
}   