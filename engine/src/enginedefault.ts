import { AnyObj, VarType, EnvFn, Env } from "./env";
import { TextBuffer, createTextBuffer } from "./textbuffer";

const PLAYER = "__PLAYER__";
const BUFFER = "__BUFFER__";

export interface Player {
    location : string, 
    score : number,
    setLocation : EnvFn
}

export const getPlayer : ((env:Env) => Player) = env => env.get(VarType.OBJECT, PLAYER) as Player;
export const getBuffer : ((env:Env) => TextBuffer) = env => env.get(VarType.OBJECT, BUFFER) as TextBuffer;

const DEFAULT_FUNCTIONS : {[key:string]:EnvFn} = {
    setLocation : env => {
        const dest = env.get(VarType.STRING, "dest");
        getPlayer(env).location = env.get(VarType.STRING, "dest");
        env.set("__PLAYER__.location", dest); // FIXME this looks like it's setting at the wrong level
    },
    
    moveTo : env => DEFAULT_FUNCTIONS.setLocation(env),
    getLocation : env => getPlayer(env).location,
    getEntity : env => env.get(VarType.OBJECT, env.get(VarType.STRING, "id")),
    write : env => getBuffer(env).write(env.get(VarType.STRING, "value"))
}

export function makePlayer(obj : AnyObj, start : string) {
    const player : Player = {
        location : start,
        score : 0,
        setLocation : env => player.location = env.get(VarType.STRING, "dest")
    };
    obj[PLAYER] = player;
}

export function makeDefaultFunctions(obj : AnyObj) {
    for(const [name, value] of Object.entries(DEFAULT_FUNCTIONS)) {
        obj[name] = value;
    }
}

export function makeBuffer(obj : AnyObj) {
    obj[BUFFER] = createTextBuffer();
}