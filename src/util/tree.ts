
export const ROOT = Symbol("ROOT");
export const TERMINAL = Symbol("TERMINAL");

type NodeValue<T> = T | typeof ROOT | typeof TERMINAL;
export type Node<T> = [NodeValue<T>, Node<T>[]];

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

export function isRoot<T>(node : Node<T>) {
    const [value, children] = node;
    return value === ROOT;
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
