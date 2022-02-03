
export enum Special {
    ROOT,
    TERMINAL
}

type NodeValue<T> = T | Special;
export type Node<T> = [NodeValue<T>, Node<T>[]];

export function newRoot<T>() : Node<T> {
    return newNode(Special.ROOT);
}

export function fromArrays<T>(arrays : T[][]) : Node<T> {
    const root = newRoot<T>();
    for(const arr of arrays) {
        addPath(root, [...arr].reverse());
    }
    return root;
}

function newNode<T>(value : NodeValue<T>) : Node<T> {
    return [value, [] ];
}

export function addPath<T>(node : Node<T>, path : T[] ) {
   const next = path.length? path.pop() as T : Special.TERMINAL;
   const [value, children] = node;
   const child = getOrCreateChild(node, next);
   if (next != Special.TERMINAL) {
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
