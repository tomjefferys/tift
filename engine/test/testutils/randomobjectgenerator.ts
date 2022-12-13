import _ from "lodash"
import { Obj, PropType } from "../../src/util/objects"

/* eslint-disable @typescript-eslint/no-explicit-any */

type Generator = (chance : Chance.Chance) => any;

export class RandomObjectGenerator {

    chance : Chance.Chance;
    generators : Generator[];
    propCount = 0;

    constructor(chance : Chance.Chance, generators = allGens) {
        this.chance = chance;
        this.generators = generators;
    }

    get(numProps : number) : Obj {
        const obj = {};
        this.addProperties(obj, numProps);
        return obj;
    }
    
    getChance() : Chance.Chance {
        return this.chance;
    }

    update(obj : object, updates : number) {
        for(let i=0; i<updates; i++) {
            if (this.chance.bool()) {
                this.addProperty(obj);
            } else {
                this.changeProperty(obj);
            }
        }
    }

    addProperties(obj : object, numProps : number) {
        for(let i=0; i < numProps; i++) {
            this.addProperty(obj);
        }
    }

    addProperty(obj : object) {
        const objProps = getAllObjectProperties(obj);
        const objToChange = this.chance.pickone(objProps) as Obj;
        if (_.isArray(objToChange)) {
            objToChange.push(this.getValue());
        } else {
            const propName = "prop" + (this.propCount++);
            objToChange[propName] = this.getValue();
        }
    }

    changeProperty(obj : object) {
        const paths = getAllPropertyPaths(obj);
        const path = this.chance.pickone(paths);
        _.set(obj, path, this.getValue());
    }

    getValue() : any {
        return this.chance.pickone(this.generators)(this.chance);
    }

    createArray() : (number | object | string | boolean)[] {
        const length = this.chance.integer({min : 0, max : 5});
        const arr = [];
        for(let i = 0; i < length; i++) {
            arr.push(this.getValue());
        }
        return arr;
    }
}

const numGen : Generator = (chance) => chance.integer({min : 0, max : 1000});
const objGen : Generator = (chance) => new RandomObjectGenerator(chance, valueGens).get(chance.integer({min : 0, max : 5}));
const stringGen : Generator = (chance) => chance.string();
const boolGen : Generator = (chance) => chance.bool();
const arrayGen : Generator = (chance) => new RandomObjectGenerator(chance, valueGens).createArray()

const valueGens = [numGen, stringGen, boolGen];
const allGens = [...valueGens, objGen, arrayGen];


function getAllPropertyPaths(obj : object) : PropType[][] {
    const paths = Object.keys(obj)
                           .map(name => [name]);
    const childPaths = paths.flatMap(path => {
        const value = _.get(obj, path);
        const subPaths = _.isObject(value)? getAllPropertyPaths(value) : [];
        return subPaths.map(subPath => [...path, ...subPath])
    });
    return [...paths, ...childPaths];
}

function getAllObjectProperties(obj : object) : object[] {
    return [obj, 
            ...Object.values(obj)
                     .filter(value => _.isObject(value))
                     .flatMap(value => getAllObjectProperties(value))];
}
