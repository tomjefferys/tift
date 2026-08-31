import { parseArgs } from "node:util";

export interface Options {
    silent : boolean;
    saveFile : string | undefined;
    developer : boolean;
    dataFiles : string[];
}

export function getCommandLineOptions(args : string[]) : Options {
    const options = {
        silent : {
            type : "boolean",
            short: "s",
            default : false
        },
        saveFile : {
            type : "string",
            short: "f",
        },
        dev : {
            type : "boolean",
            short: "d",
            default : false
        }
    } as const;

    const { values, positionals } = parseArgs({args, options, allowPositionals : true });

    return {
        silent : values.silent ?? false,
        saveFile : values.saveFile,
        developer : values.dev ?? false,
        dataFiles : positionals
    }
}
