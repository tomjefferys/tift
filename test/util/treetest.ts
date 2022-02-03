import * as Tree from "../../src/util/tree";
import { Node } from "../../src/util/tree";

const ROOT = Tree.Special.ROOT;
const TERMINAL = Tree.Special.TERMINAL;

test("test empty tree", () => {
    const tree = Tree.fromArrays([]);
    expect(tree).toStrictEqual([ROOT, []]);
});

test("test single value", () => {
    const tree = Tree.fromArrays([["a"]]);
    expect(tree).toStrictEqual(
        [ROOT,
            [["a",
                [[TERMINAL, []]]
            ]]
        ]);
})

test("test short branch", () => {
    const tree = Tree.fromArrays([["a","b"]]);
    expect(tree).toStrictEqual(
        [ROOT,
            [["a",
                [["b",
                    [[TERMINAL, []]]
                ]]
            ]]
        ]);
})

test("test two branches", () => {
    const tree = Tree.fromArrays([["a","b"],["a","c"]]);
    expect(tree).toStrictEqual(
        [ROOT,
            [["a",
                [["b",
                    [[TERMINAL, []]]
                 ],
                 ["c",
                    [[TERMINAL, []]]
                 ]]
            ]]
        ]);
})

test("test two branches", () => {
    const tree = Tree.fromArrays([["a","b"],["c","d"]]);
    expect(tree).toStrictEqual(
        [ROOT,
            [["a",
                [["b",
                    [[TERMINAL, []]]
                ]],
             ],
             ["c",
                [["d",
                    [[TERMINAL, []]]
                 ]]
             ]]
        ]);
})

