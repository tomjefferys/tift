import * as Logger from "../../src/util/logger";

test("test log levels", () => {
    const messages : string[] = [];
    Logger.setConfig(["foo", Logger.INFO], ["bar", Logger.TRACE]);
    Logger.setConsumer(entry => messages.push(entry.level + " " + entry.message));

    const fooLogger = Logger.getLogger("foo");
    const barLogger = Logger.getLogger("bar");
    const bazLogger = Logger.getLogger("baz");

    fooLogger.error(() => "foo error");
    fooLogger.warn(() => "foo warn");
    fooLogger.info(() => "foo info");
    fooLogger.debug(() => { throw new Error("Must not debug") } );
    fooLogger.trace(() => { throw new Error("Must not trace") } );

    barLogger.error(() => "bar error");
    barLogger.warn(() => "bar warn");
    barLogger.info(() => "bar info");
    barLogger.debug(() => "bar debug");
    barLogger.trace(() => "bar trace");

    bazLogger.error(() => "baz error");
    bazLogger.warn(() => "baz warn");
    bazLogger.info(() => { throw new Error("Must not info") });
    bazLogger.debug(() => { throw new Error("Must not debug") });
    bazLogger.trace(() => { throw new Error("Must not trace") });

    expect(messages).toContain("ERROR foo error");
    expect(messages).toContain("WARN foo warn");
    expect(messages).toContain("INFO foo info");
    expect(messages).not.toContain("DEBUG foo debug");
    expect(messages).not.toContain("TRACE foo trace");

    expect(messages).toContain("ERROR bar error");
    expect(messages).toContain("WARN bar warn");
    expect(messages).toContain("INFO bar info");
    expect(messages).toContain("DEBUG bar debug");
    expect(messages).toContain("TRACE bar trace");

    expect(messages).toContain("ERROR baz error");
    expect(messages).toContain("WARN baz warn");
    expect(messages).not.toContain("INFO baz info");
    expect(messages).not.toContain("DEBUG baz debug");
    expect(messages).not.toContain("TRACE baz trace");
})