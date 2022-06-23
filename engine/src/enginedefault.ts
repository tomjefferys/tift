import { Obj, AnyArray, EnvFn, Env } from "./env";
import { TextBuffer, createTextBuffer } from "./textbuffer";

const PLAYER = Symbol("__PLAYER__");
const BUFFER = Symbol("__BUFFER__");

export interface Player {
    location : string, 
    score : number,
    inventory : AnyArray,
    setLocation : EnvFn
}

export const getPlayer : ((env:Env) => Player) = env => env.get(PLAYER) as Player;
export const getBuffer : ((env:Env) => TextBuffer) = env => env.get(BUFFER) as TextBuffer;

const DEFAULT_FUNCTIONS : {[key:string]:EnvFn} = {
    setLocation : env => {
        const dest = env.getStr("dest");
        getPlayer(env).location = env.getStr("dest");
        env.set("__PLAYER__.location", dest); // FIXME this looks like it's setting at the wrong level
    },
    
    moveTo : env => DEFAULT_FUNCTIONS.setLocation(env),
    getLocation : env => getPlayer(env).location,
    getEntity : env => env.get(env.getStr("id")),
    write : env => getBuffer(env).write(env.getStr("value"))
}

export function makePlayer(obj : Obj, start : string) {
    const player : Player = {
        location : start,
        score : 0,
        inventory : [],
        setLocation : env => player.location = env.getStr("dest")
    };
    obj[PLAYER] = player;
}

export function makeDefaultFunctions(obj : Obj) {
    for(const [name, value] of Object.entries(DEFAULT_FUNCTIONS)) {
        obj[name] = value;
    }
}

export function makeBuffer(obj : Obj) {
    obj[BUFFER] = createTextBuffer();
}