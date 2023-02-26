/**
 * A very simple logging library
 * Uses global state, and is not threadsafe
 */
type MessageSrc  = () => string;
type LogFn = (messageSrc : MessageSrc) => void;
const LEVELS = ["ERROR", "WARN", "INFO", "DEBUG", "TRACE"] as const;
export type Level = 0 | 1 | 2 | 3 | 4;
export type LevelName = typeof LEVELS[Level];

type LogConsumer = (logEntry : LogEntry) => void;

export const ERROR = LEVELS.indexOf("ERROR") as Level;
export const WARN = LEVELS.indexOf("WARN") as Level;
export const INFO = LEVELS.indexOf("INFO") as Level;
export const DEBUG = LEVELS.indexOf("DEBUG") as Level;
export const TRACE = LEVELS.indexOf("TRACE") as Level;

export interface ConfigEntry  {
    logger : string, 
    level : LevelName,
}

interface LogEntry {
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
        error : (level >= ERROR)? logger("ERROR") : NO_OP_LOG,
        warn :  (level >= WARN)?  logger("WARN")  : NO_OP_LOG,
        info :  (level >= INFO)?  logger("INFO")  : NO_OP_LOG,
        debug : (level >= DEBUG)? logger("DEBUG") : NO_OP_LOG,
        trace : (level >= TRACE)? logger("TRACE") : NO_OP_LOG,
    }
}

function logFn(logger : string, level : LevelName) : LogFn {
    return messageSrc => loggingState.consumer({logger, level, message : messageSrc()});
}