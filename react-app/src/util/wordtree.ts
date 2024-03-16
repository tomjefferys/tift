/**
 * Holds word objects in a tree form, with words that follow on stored as children
 * Used when processing keyboard input to handle partial word completions
 */
import { Word } from "tift-types/src/messages/word";
import { Optional } from "tift-types/src/util/optional";
import _ from "lodash";

const WILD_CARD = "?";

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
        if (headId === WILD_CARD) {
            for(const word of words) {
                let branch = findBranch(children, word);
                if (!branch) {
                    branch = create(word);
                    children.push(branch);
                }
                // FIXME don't do this if the word is an Option
                set(branch, path.slice(1), []);
            }
            return;
        }
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

function findBranch(branches : WordTree[], word : Word) : Optional<WordTree> {
    return branches.find(([w, _]) => w.id === word.id);
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

/**
 * Find all word lists that match
 * @param tree 
 * @param path 
 * @returns 
 */
export function getAll(tree : WordTree, path : Word[]) : Word[][] {
    const [word, children] = tree;
    const head = path[0];
    const tail = path.slice(1);
    let result : Word[][] = []
    if (word === ROOT) {
        result = children.flatMap(child => getAll(child, path));
    } else if (word.id === head.id || head.id === WILD_CARD) {
        if (tail.length === 0) {
            result = [[word]];
        } else {
            const childResults = children.flatMap(child => getAll(child, tail));
            result = childResults.map(result => [word, ...result]);
        }
    }
    return result;
}

/**
 * Get all wildcard matches
 * @param tree 
 * @param path 
 * @returns a list of lists of words for each wildcard match
 */
export function getWildCardMatches(tree : WordTree, path : Word[]) : Word[][] {
    const sentenceMatches = getAll(tree, path);
    const wildCardIndexes = getWildCardIndexes(path);
    const wildCardMatches = wildCardIndexes.map(index => 
        _.uniqBy(sentenceMatches.map(sentence => sentence[index]), word => word.id));
    return wildCardMatches;
}

function getWildCardIndexes(path : Word[]) : number[] {
    return path.map((word, index) => word.id === WILD_CARD? index : -1)
               .filter(index => index !== -1);
}

/**
 * Returns a tree containing only the items on th given path, 
 * taking into account any wild cards
 * @param tree
 * @param path 
 */
export function getSubTree(tree : WordTree, path : Word[]) : WordTree {
    const sentences = getAll(tree, path);
    const newTree = createRoot();
    sentences.forEach(sentence => setSentence(newTree, sentence));
    return newTree;
}

/**
 * Set a sentence in the tree
 * @param tree 
 * @param sentence 
 */
function setSentence(tree : WordTree, sentence : Word[]) {
    const [_, children] = tree;
    if (sentence.length > 0) {
        const head = sentence[0];
        let branch = children.find(([word, _]) => word.id === head.id); 
        if (!branch) {
            branch = create(head);
            children.push(branch);
        }
        setSentence(branch, sentence.slice(1));
    }
}

/**
 * Takes a string prefix, and returns matches from the tree that start with that prefix
 * @param tree 
 * @param prefix 
 * @param accumulator 
 * @returns 
 */
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