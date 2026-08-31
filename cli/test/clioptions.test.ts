import { describe, test, expect } from "vitest";
import { getCommandLineOptions } from "../src/clioptions";

describe("getCommandLineOptions", () => {

    test("should parse silent and saveFile options", () => {
        const args = ["-s", "-f", "savefile.json", "data1.tift", "data2.tift"];
        const options = getCommandLineOptions(args);
        expect(options.silent).toBe(true);
        expect(options.saveFile).toBe("savefile.json");
        expect(options.dataFiles).toEqual(["data1.tift", "data2.tift"]);
    });

    test("should use default values when options are not provided", () => {
        const args = ["data1.tift"];
        const options = getCommandLineOptions(args);
        expect(options.silent).toBe(false);
        expect(options.saveFile).toBeUndefined();
        expect(options.developer).toBe(false);
        expect(options.dataFiles).toEqual(["data1.tift"]);
    });

    test("should parse the developer option via --dev", () => {
        const args = ["--dev", "data1.tift"];
        const options = getCommandLineOptions(args);
        expect(options.developer).toBe(true);
    });

    test("should parse the developer option via -d shorthand", () => {
        const args = ["-d", "data1.tift"];
        const options = getCommandLineOptions(args);
        expect(options.developer).toBe(true);
    });
});