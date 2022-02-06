import { Optional } from "./optional"
import * as Opt from "./optional"

export const ROOT = Symbol("ROOT");
export const TERMINAL = Symbol("TERMINAL");

type NodeValue<T> = T | typeof ROOT | typeof TERMINAL;
export type Node<T> = [NodeValue<T>, Node<T>[]];
export type ValueNode<T> = [T, Node<T>[]];
export type RootNode<T> = [typeof ROOT, Node<T>[]];
export type TerminalNode<T> = [typeof TERMINAL, Node<T>[]];

export function newRoot<T>() : Node<T> {
    return newNode(ROOT);
}

export function fromArrays<T>(arrays : T[][]) : Node<T> {
    const root = newRoot<T>();
    for(const arr of arrays) {
        addPath(root, [...arr].reverse());
    }
    return root;
}

export function getValue<T>(node : ValueNode<T>) : T {
    return node[0];
}

function getChildren<T>(node : Node<T>) : Node<T>[] {
    return node[1];
}

export function isRoot<T>(node : Node<T>) {
    return getValue(node) === ROOT;
}

export function isTerminal<T>(node : Node<T>) {
    const terminalNode = getChildren(node).find(child => 
                                getValue(child) == TERMINAL)
    return terminalNode != undefined;
}

function isValueNode<T>(node : Node<T>) : node is ValueNode<T> {
    const value = getValue(node);
    return value !== ROOT && value !== TERMINAL;
}

//function isValueNode<T>(value : NodeValue<T>) : value is T {
//    return value !== ROOT && value !== TERMINAL;
//}

export function forEachChild<T>(node : Node<T>, fn : (t:ValueNode<T>) => void) {
    const [_, children] = node;
    children.forEach(child => {
        if (isValueNode(child)) {
            fn(child);
        }
    });
}

function newNode<T>(value : NodeValue<T>) : Node<T> {
    return [value, [] ];
}

export function addPath<T>(node : Node<T>, path : T[] ) {
   const next = path.length? path.pop() as T : TERMINAL;
   const [value, children] = node;
   const child = getOrCreateChild(node, next);
   if (next !== TERMINAL) {
      addPath(child, path);
   }
}

function getOrCreateChild<T>(node : Node<T>, value : NodeValue<T>) {
   const [nodeValue, children] = node;
   let child = children.find(node => node[0] == value);
   if (!child) {
       child = newNode(value);
       children.push(child);
   }
   return child;
}
