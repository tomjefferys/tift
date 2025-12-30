import { parseArgs } from "node:util";

export interface Options {
    silent : boolean;
    saveFile : string | undefined;
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
        }
    } as const;

    const { values, positionals } = parseArgs({args, options, allowPositionals : true });

    return {
        silent : values.silent ?? false,
        saveFile : values.saveFile,
        dataFiles : positionals
    }
}
