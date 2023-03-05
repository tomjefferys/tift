/**
 * A very simple logging library
 * Uses global state, and is not threadsafe
 */
type MessageSrc  = () => string;
type LogFn = (messageSrc : MessageSrc) => void;
const LEVELS = ["error", "warn", "info", "debug", "trace"] as const;
export type Level = 0 | 1 | 2 | 3 | 4;
export type LevelName = typeof LEVELS[Level];

export type LogConsumer = (logEntry : LogEntry) => void;

export const ERROR = LEVELS.indexOf("error") as Level;
export const WARN = LEVELS.indexOf("warn") as Level;
export const INFO = LEVELS.indexOf("info") as Level;
export const DEBUG = LEVELS.indexOf("debug") as Level;
export const TRACE = LEVELS.indexOf("trace") as Level;

export interface ConfigEntry  {
    logger : string, 
    level : LevelName,
}

export interface LogEntry {
    logger : string,
    level : LevelName,
    message : string
}

interface LoggingState {
    defaultLevel : Level,
    levels : {[key:string]:Level},
    consumer : LogConsumer
}

interface Logger {
    error : LogFn,
    warn : LogFn,
    info : LogFn,
    debug : LogFn,
    trace : LogFn
}

const NO_OP_LOG : LogFn = _message => { /* do nothing */ };
const CONSOLE_LOGGER : LogConsumer = entry => console.log(`${entry.logger}, ${entry.level}: ${entry.message}`);

const loggingState : LoggingState = {
    defaultLevel : WARN,
    levels : {},
    consumer : CONSOLE_LOGGER
}

export function setConsumer(consumer : LogConsumer) {
    loggingState.consumer = consumer;
}

export function setConfig(...config : [string, Level][]) {
    config.forEach(([logger, level]) => loggingState.levels[logger] = level);
}

export function getLogger(name : string, logLevel? : Level) : Logger {
    const leval = (logLevel !== undefined)? logLevel : loggingState.levels[name] ?? loggingState.defaultLevel;
    return createLogger(name, leval);
}

function createLogger(name : string, level : number) : Logger {
    const logger = (level : LevelName) => logFn(name, level);
    return {
        error : (level >= ERROR)? logger("error") : NO_OP_LOG,
        warn :  (level >= WARN)?  logger("warn")  : NO_OP_LOG,
        info :  (level >= INFO)?  logger("info")  : NO_OP_LOG,
        debug : (level >= DEBUG)? logger("debug") : NO_OP_LOG,
        trace : (level >= TRACE)? logger("trace") : NO_OP_LOG,
    }
}

function logFn(logger : string, level : LevelName) : LogFn {
    return messageSrc => loggingState.consumer({logger, level, message : messageSrc()});
}