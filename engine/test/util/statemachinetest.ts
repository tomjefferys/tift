import { buildStateMachine, TERMINATE } from "../../src/util/statemachine";

test("test basic state machine", () => {
    const output : string[] = [];
    const stateMachine = buildStateMachine<string, string[]>(
        "state1", ["state1", { onEnter : (out) => out.push("start1"), 
                               onAction : (str, out) => { out.push(str + 1); return "state2" },
                               onLeave : (out) => out.push("end1") }],
                  ["state2", { onEnter : (out) => out.push("start2"), 
                               onAction : (str, out) => { out.push(str + 2); return TERMINATE },
                               onLeave : (out) => out.push("end2") }]);
    
    expect(stateMachine.getStatus()).toEqual("NOT_STARTED");
    expect(output).toEqual([]);

    stateMachine.start(output);
    expect(stateMachine.getStatus()).toEqual("RUNNING");
    expect(output).toEqual(["start1"]);

    stateMachine.send("foo", output);
    expect(stateMachine.getStatus()).toEqual("RUNNING");
    expect(output).toEqual(["start1", "foo1", "end1", "start2"]);

    stateMachine.send("bar", output);
    expect(stateMachine.getStatus()).toEqual("FINISHED");
    expect(output).toEqual(["start1", "foo1", "end1", "start2", "bar2", "end2"]);

    // Test can restart
    stateMachine.start(output);
    expect(stateMachine.getStatus()).toEqual("RUNNING");
    expect(output).toEqual(["start1", "foo1", "end1", "start2", "bar2", "end2", "start1"]);
});

test("test don't change state", () => {
    const output : string[] = [];
    const stateMachine = buildStateMachine<string, string[]>(
        "state1", ["state1", { onEnter : (out) => out.push("start1"), 
                               onAction : (str, out) => { out.push(str + 1); return str === "foo" ? undefined : "state2"},
                               onLeave : (out) => out.push("end1") }],
                  ["state2", { onEnter : (out) => out.push("start2"), 
                               onAction : (str, out) => { out.push(str + 2); return TERMINATE },
                               onLeave : (out) => out.push("end2") }]);
    
    expect(stateMachine.getStatus()).toEqual("NOT_STARTED");
    expect(output).toEqual([]);

    stateMachine.start(output);
    expect(stateMachine.getStatus()).toEqual("RUNNING");
    expect(output).toEqual(["start1"]);

    stateMachine.send("foo", output);
    expect(stateMachine.getStatus()).toEqual("RUNNING");
    expect(output).toEqual(["start1", "foo1" ]);

    stateMachine.send("bar", output);
    expect(stateMachine.getStatus()).toEqual("RUNNING");
    expect(output).toEqual(["start1", "foo1", "bar1", "end1", "start2" ]);

    stateMachine.send("baz", output);
    expect(stateMachine.getStatus()).toEqual("FINISHED");
    expect(output).toEqual(["start1", "foo1", "bar1", "end1", "start2", "baz2", "end2" ]);
});