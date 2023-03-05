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

    expect(messages).toContain("error foo error");
    expect(messages).toContain("warn foo warn");
    expect(messages).toContain("info foo info");
    expect(messages).not.toContain("debug foo debug");
    expect(messages).not.toContain("trace foo trace");

    expect(messages).toContain("error bar error");
    expect(messages).toContain("warn bar warn");
    expect(messages).toContain("info bar info");
    expect(messages).toContain("debug bar debug");
    expect(messages).toContain("trace bar trace");

    expect(messages).toContain("error baz error");
    expect(messages).toContain("warn baz warn");
    expect(messages).not.toContain("info baz info");
    expect(messages).not.toContain("debug baz debug");
    expect(messages).not.toContain("trace baz trace");
})