// Utilities for storing a hex grid

// Basic hexagonal cube coordinate
export type Cube = { q: number, r: number, s: number };

// Represent different types of hex coordinates
export type HexCoord = Axial | Cube | [number, number] | [number, number, number];

// Axial coordinates.  Like cube coordinates, but only q and r are stored.
// The s coordinate is derived from q and r.
export class Axial {
    constructor(public q: number, public r: number) {}
    
    static from(hex : HexCoord) : Axial {
        if (Array.isArray(hex)) {
            if (hex.length === 2) {
                return new Axial(hex[0], hex[1]);
            } else if (hex.length === 3) {
                if (!isValidHex({ q: hex[0], r: hex[1], s: hex[2] })) {
                    throw new Error("Invalid hex coordinates");
                }
                return new Axial(hex[0], hex[1]);
            }
        } else if (typeof hex === 'object') {
            if ('q' in hex && 'r' in hex && 's' in hex) {
                if (!isValidHex(hex)) {
                    throw new Error("Invalid hex coordinates");
                }
                return new Axial(hex.q, hex.r);
            } else if ('q' in hex && 'r' in hex) {
                return new Axial(hex.q, hex.r);
            }
        }
        throw new Error("Invalid hex coordinates");
    }

    static ZERO = new Axial(0, 0);

    // Directions that are neighbours to the origin hexagon
    static NORTH_WEST = new Axial(0, -1);
    static NORTH_EAST = new Axial(1, -1);
    static EAST = new Axial(1, 0);
    static SOUTH_EAST = new Axial(0,1);
    static SOUTH_WEST = new Axial(-1, 1);
    static WEST = new Axial(-1, 0);

    // North and south are not neighbours to the origin hexagon
    static NORTH = new Axial(1, -2);
    static SOUTH = new Axial(-1, 2);

    // The order of the directions describes a anti-clockwise rotation
    static DIRECTION_VECTORS : Axial[] = [
        Axial.EAST, Axial.NORTH_EAST, Axial.NORTH_WEST,
        Axial.WEST, Axial.SOUTH_WEST, Axial.SOUTH_EAST
    ];

    toString(): string {
        return `Axial(${this.q}, ${this.r})`;
    }

    toCube(): Cube {
        return { q: this.q, r: this.r, s: -this.q - this.r };
    }

    add(other: Axial): Axial {
        return new Axial(this.q + other.q, this.r + other.r);
    }

    toHex(): Cube {
        return { q: this.q, r: this.r, s: -this.q - this.r };
    }

    neighbour(direction: number): Axial {
        return this.add(Axial.DIRECTION_VECTORS[direction]);
    }

    northWest(): Axial {
        return this.add(Axial.NORTH_WEST);
    }

    northEast(): Axial {
        return this.add(Axial.NORTH_EAST);
    }

    east(): Axial {
        return this.add(Axial.EAST);
    }
    
    southEast(): Axial {
        return this.add(Axial.SOUTH_EAST);
    }

    southWest(): Axial {
        return this.add(Axial.SOUTH_WEST);
    }   

    west(): Axial {
        return this.add(Axial.WEST);
    }

    scale(scalar: number): Axial {
        return new Axial(this.q * scalar, this.r * scalar);
    }

    toCartesian = (): [number, number] => {
        const col = this.q + (this.r - (this.r & 1)) / 2;
        const row = this.r;
        return [col, row];
    }

    static fromCartesian = (col: number, row: number): Axial => {
        const q = col - (row - (row & 1)) / 2;
        const r = row;
        return new Axial(q, r);
    }
}

export class HexMap<V> {

    private grid: Map<string, [Axial, V]>;
    constructor() {
        this.grid = new Map<string, [Axial, V]>();
    }

    static fromArray<V>(topLeft: HexCoord, arr: V[][]): HexMap<V> {
        const map = new HexMap<V>();
        map.setArray(topLeft, arr);
        return map;
    }

    static fromSpiral<V>(centre: HexCoord, values: V[]): HexMap<V> {
        const map = new HexMap<V>();
        map.setSpiral(centre, values);
        return map;
    }

    setArray(topLeft: HexCoord, arr: V[][]): void {
        let rowStart = Axial.from(topLeft);
        let hex = rowStart;
        for (let row = 0; row < arr.length; row++) {
            for (let col = 0; col < arr[row].length; col++) {
                this.set(hex, arr[row][col]);
                hex = hex.add(Axial.EAST);
            }
            rowStart = (row % 2 === 0)
                            ? rowStart.add(Axial.SOUTH_EAST)
                            : rowStart.add(Axial.SOUTH_WEST);
            hex = rowStart;
        }
    }

    set(hex: HexCoord, value: V): void {
        const axialHex = Axial.from(hex);
        const key = this.getKey(axialHex);
        this.grid.set(key, [axialHex, value]);
    }

    get(hex: HexCoord): V | undefined {
        const axialHex = Axial.from(hex);
        const key = this.getKey(axialHex);
        const result = this.grid.get(key);
        return result ? result[1] : undefined;
    }

    getNeighbors(hex: HexCoord): V[] {
        const axialHex = Axial.from(hex);
        const neighbors: V[] = [];
        for (const direction of Axial.DIRECTION_VECTORS) {
            const neighbourHex = axialHex.add(direction);
            const value = this.get(neighbourHex);
            if (value !== undefined) {
                neighbors.push(value);
            }
        }
        return neighbors;
    }

    // Get all hexes in a ring around the given hex
    getRing(centre: HexCoord, radius: number): V[] {
        const ringCoords = getRingCoords(centre, radius);
        return ringCoords.map(hex => this.get(hex))
                            .filter(value => value !== undefined) as V[];
    }

    setRing(centre: HexCoord, radius: number, values: V[]): void {
        const ringCoords = getRingCoords(centre, radius);
        ringCoords.forEach((hex, i) => {
            if (i < values.length) {
                this.set(hex, values[i]);
            }
        });
    }

    getSpiral(centre: HexCoord, size: number): V[] {
        const spiralCoords = getSpiralCoords(centre, size);
        return spiralCoords.map(hex => this.get(hex))
                           .filter(value => value !== undefined) as V[];
    }

    setSpiral(centre: HexCoord, values: V[]): void {
        const spiralCoords = getSpiralCoords(centre, values.length);
        spiralCoords.forEach((hex, i) => {
            if (i < values.length) {
                this.set(hex, values[i]);
            }
        });
    }

    // Convert the hex grid to a 2D array.
    // We first translate the hexes so that the minimum row is even,
    //  to be consistent about which rows will need to be indented.
    toArray(): (V | undefined)[][] {
        let minRow = Number.MAX_VALUE;
        let maxRow = Number.MIN_VALUE;
        let minCol = Number.MAX_VALUE;
        let maxCol = Number.MIN_VALUE;

        Array.from(this.grid.values())
             .map(([hex, _]) => getCartesian(hex))
             .forEach(([col, row]) => {
                 minRow = Math.min(minRow, row);
                 maxRow = Math.max(maxRow, row);
                 minCol = Math.min(minCol, col);
                 maxCol = Math.max(maxCol, col);
             });

        // Translate the hexes so that minRow will be even
        if (minRow % 2 !== 0) {
            const newGrid = new HexMap<V>();
            Array.from(this.grid.values())
                 .forEach(([hex, value]) => {
                        const newHex = hex.add(Axial.SOUTH_EAST);
                        newGrid.set(newHex, value);
                 });
            return newGrid.toArray();
        }
        
        const arr : (V | undefined)[][] = [];
        for(let row = minRow; row <= maxRow; row++) {
            const rowArr : (V | undefined)[] = [];
            arr.push(rowArr);
            for (let col = minCol; col <= maxCol; col++) {
                const hex = Axial.fromCartesian(col, row);
                const value = this.get(hex);
                rowArr.push(value);
            }
        }
        return arr;
    }

    toString(): string {
        const arr = this.toArray();
        const strArr = arr.map(row => row.map(item => (item)? item.toString() : " "));
        const maxLength = strArr.flat()
                                .reduce((acc, item) => Math.max(acc, item.length), 0);
        const paddedArr = strArr.map(row => row.map(item => item.padStart(maxLength/2)
                                                                .padEnd(maxLength)));

        let str = "";
        paddedArr.forEach((row, index) => {
            if (index % 2 === 1) {
                str += " ".repeat(maxLength/2 + 1);
            }
            str += row.join(" ");
            str += "\n";
        });
        return str;
    }

    private getKey(hex: Axial): string {
        return `${hex.q},${hex.r}`;
    }
}

const getCartesian = (hex: HexCoord): [number, number] => {
    const axial = Axial.from(hex);
    const col = axial.q + (axial.r - (axial.r & 1)) / 2;
    const row = axial.r;
    return [col, row];
}

export const getRingCoords = (centre: HexCoord, radius: number): Axial[] => {
    const ring: Axial[] = [];
    const centreHex = Axial.from(centre);
    if (radius === 0) {
        ring.push(centreHex);
        return ring;
    }
    let hex = centreHex.add(Axial.SOUTH_WEST.scale(radius));
    for (const direction of Axial.DIRECTION_VECTORS) {
        for (let i = 0; i < radius; i++) {
            ring.push(hex);
            hex = hex.add(direction);
        }
    }
    return ring;
}

export const getSpiralCoords = (centre: HexCoord, size: number): Axial[] => {
    const spiral: Axial[] = [];
    const centreHex = Axial.from(centre);
    let hexCount = 0;
    let radius = 0;
    while(hexCount < size) {
        const ring = getRingCoords(centreHex, radius);
        for (const ringHex of ring) {
            if (hexCount >= size) {
                break;
            }
            spiral.push(ringHex);
            hexCount++;
        }
        radius++;
    }
    return spiral;
}

const isValidHex = (hex : Cube) : hex is Cube => {
    return hex.q + hex.r + hex.s === 0;
};
