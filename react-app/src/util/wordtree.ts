/**
 * Holds word objects in a tree form, with words that follow on stored as children
 * Used when processing keyboard input to handle partial word completions
 */
import { Word } from "tift-types/src/messages/output";
import { Optional } from "tift-types/src/util/optional";

const ROOT : Word = { id : "ROOT", value : "", type : "control"}

export type WordTree = [Word, WordTree[]];

export function createRoot() : WordTree {
    return create(ROOT);
}

function create(word : Word) : WordTree {
    return [word, []];
}

export function set(tree : WordTree, path : (Word | string)[], words : Word[]) : void {
    const [_, children] = tree;
    if (path.length > 0) {
        const head = path[0];
        const headId = (typeof head === "string")? head : head.id;
        let branch = children.find(([word, _]) => word.id === headId);
        if (!branch) {
           if (typeof head === "string") {
              throw new Error(`Trying follow word path: ${headId} but it does not already exit`);
           }
           branch = create(head) 
           children.push(branch);
        }
        set(branch, path.slice(1), words);
    } else {
        const newBranch = words.filter(word => !children.find(([child, _]) => child.id === word.id))
                              .map(word => create(word));
        children.push(...newBranch);
    }
}


export function get(tree : WordTree, path : Word[]) : Word[] {
    const [_, children] = tree;
    let result : Word[];
    if (path.length > 0) {
        const head = path[0];
        const branch = children.find(([word, _]) => word.id === head.id) ?? create(head);
        result = get(branch, path.slice(1));
    } else {
        result = children.map(([word,_]) => word);
    }
    return result;
}

export function getWithPrefix(tree : WordTree, prefix : string, accumulator = "") : Word[] {
    const [word, children] = tree;
    let result : Word[] = [];
    if (word === ROOT) {
        result = children.flatMap(child => getWithPrefix(child, prefix, accumulator));
    } else if (word.value === prefix) {
        result = children.flatMap(child => getWithPrefix(child, "", accumulator + word.value + " "));
    } else if (word.value.startsWith(prefix)) {
        // eg Convert 'get down' to 'down'
        const prefixWord = prefix + " ";
        if (word.value.startsWith(prefixWord) && word.type === "word") {
            result = [{...word, value : word.value.slice(prefixWord.length), tags : ["truncated"] }];
        } else {
            result = [word];
        }
    } else if (prefix.startsWith(word.value)) {
        // Prefix may be several words, so we need to break it down
        const newPrefix = prefix.slice(word.value.length).trimStart();
        result = children.flatMap(child => getWithPrefix(child, newPrefix, prefix.slice(0, word.value.length) + " "));
    }
    return result;
}

export function matchPhrase(tree : WordTree, phrase : string, accumulator = "") : Optional<Word[]> {
    const [word,children] = tree;
    let result : Optional<Word[]> = undefined;
    const partial = (accumulator !== "" && word.value !== "")? accumulator + " " + word.value : accumulator + word.value;
    if (phrase === partial && children.length === 0) {
        result = [word];
    } else if (phrase.startsWith(partial)) {
        for(const child of children) {
            const childResult = matchPhrase(child, phrase, partial);
            if (childResult) {
                result = (word.value === "")? childResult : [word, ...childResult];
                break;
            }
        }
    }
    return result;
}

export function addLeaf(tree : WordTree, leaf : Word) {
    const [word, children] = tree;
    if (children.length) {
        if (word !== ROOT && children.find(([word, _]) => word.id === leaf.id) === undefined) {
            children.push(create(leaf));
        }
        children.forEach(child => addLeaf(child, leaf));
    }
}

export function flatten(tree : WordTree) : string[] {
    const [word, children] = tree;
    const words = [];
    words.push(word.id);
    for(const child of children) {
        words.push(...flatten(child))
    }
    return words;
}