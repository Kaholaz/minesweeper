import { Board, Coordinate } from "./game/board.js";
import { Cell, CellState } from "./game/cell.js";

export class Engine {
    private board: Board;
    private groups: Groups; 
    
    constructor(board: Board) {
        this.board = board;
        this.groups = new Groups(board);
    }

    private initGroups() {
        this.groups = new Groups(this.board);
        for (let id = 0; id < this.board.cells.length; ++id) {
            this.insertAdjacent(this.board.idToCoordinate(id))
        }
    }

    private insertAdjacent(cell: Coordinate) {
        if (this.board.getCell(cell).getState() !== CellState.REVEALED) return;
        if (this.board.getCell(cell).adjacentBombs === 0) return;
            

        let set = new Set(
            this.board.getAdjacentCells(cell)
            .filter(c => this.board.getCell(c).getState() !== CellState.REVEALED)
            .map(c => {return this.board.coordinateToId(c)}));
        this.groups.insert(this.board.getCell(cell).adjacentBombs, set);
    }

    public revealRevealable() {
        let progress = true;
        while (progress) {
            this.initGroups();

            progress = false
            let nextMove: Coordinate | null;
            while ((nextMove = this.nextMove()) !== null) {
                this.board.revealCell(nextMove);            
                this.insertRecursively(nextMove);
                progress = true
            }
        }
    }

    private insertRecursively(cell: Coordinate) {
        [...this.findAdjacentToZero(cell, new Set())]
            .map(c => this.board.idToCoordinate(c))
            .forEach(c => this.insertAdjacent(c));
    } 

    private findAdjacentToZero(cell: Coordinate, seen: Set<number>) : Set<number> {
        if (seen.has(this.board.coordinateToId(cell))) return seen;

        seen.add(this.board.coordinateToId(cell))                
        if (this.board.getCell(cell).adjacentBombs !== 0) return seen;

        this.board.getAdjacentCells(cell).forEach((c) => {return this.findAdjacentToZero(c, seen)})
        return seen;
    }

    public flagBombs() {
        this.initGroups();
    }

    public revealOne() {
        this.initGroups();
        let nextMove = this.nextMove();
        if (nextMove === null) return;
        this.board.revealCell(nextMove);
    }

    private nextMove() : Coordinate | null {
        let cellId = this.groups.popSafeCell();
        if (cellId === null) return null;
        return this.board.idToCoordinate(cellId);
    }
}

class Groups {
    private groups: Array<Array<Set<number>>>
    private indexBounds: Array<Array<number>>
    private hasSuggested: boolean
    private board: Board // Temporary for debugging purposes

    public constructor(board: Board) {
        this.board = board;
        this.hasSuggested = false;
        this.groups = new Array(9);
        for (let i = 0; i < 9; ++i) this.groups[i] = new Array();
        this.indexBounds = Array(9);
        for (let i = 0; i < 9; ++i) this.indexBounds[i] = [...[0, 0, 0, 0, 0, 0, 0, 0, 0]];
    }

    public insert(bombs: number, set: Set<number>) {
        if (set.size === 0) return;

        // All sets with 0 adjacent bombs can be split.
        if (bombs === 0 && set.size !== 1) {
            set.forEach((k, _) => this.insert(0, new Set([k])));
            return;
        }

        // All sets of size one and one adjacent bomb is a guaranteed bomb.
        if (bombs === 1 && set.size === 1) {
            for (let id of set.values()) {
                console.log("Bomb:", id);
                let cell = this.board.cells[id]
                
                if (cell.getState() === CellState.NORMAL) this.board.flagCell(this.board.idToCoordinate(id));
                if (!cell.isBomb) throw "Safe space marked as bomb!!!"
            }
        }

        // All sets where the number of bombs and element matches can be split.
        if (bombs > 1 && bombs === set.size) {
            set.forEach((k, _) => this.insert(1, new Set([k])));
            return;
        }
        
        // Handle inserted supersets.
        for (let bombsExamined = bombs; bombsExamined >= 0; --bombsExamined) {
            let i = this.indexBounds[bombsExamined][set.size] - 1;
            let groupToExaminate = this.groups[bombsExamined]
            for (; i >= 0; --i) {
                let unique = this.leftOuter(set, groupToExaminate[i])
                if (unique.size === set.size - groupToExaminate[i].size) {
                    this.insert(bombs - bombsExamined, unique);
                    return;
                }
            }
        }

        // Insert set into groups and increment the index bounds.
        for (let i = set.size; i < 9; ++i) ++this.indexBounds[bombs][i]; 
        this.groups[bombs].splice(this.indexBounds[bombs][set.size - 1], 0, set);

        // Handle inserted subsets.
        let insertQueue : Array<[number, Set<number>]> = new Array();
        for (let bombsExamined = bombs; bombsExamined < 9; ++bombsExamined) {
            let i = this.indexBounds[bombsExamined][set.size];
            let groupToExaminate = this.groups[bombsExamined]
            for (; i < groupToExaminate.length; ++i) {
                let unique = this.leftOuter(groupToExaminate[i], set);
                if (unique.size > groupToExaminate[i].size - set.size) continue;

                let groupSize = groupToExaminate[i].size;
                delete groupToExaminate[i];
                groupToExaminate = this.groups[bombsExamined] = groupToExaminate.filter(n => 1);
                for (let j = groupSize; j < 9; ++j) --this.indexBounds[bombsExamined][j];
                --i;
                
                insertQueue.push([bombsExamined - bombs, unique]);
            }
        }

        // Insert from queue
        insertQueue.forEach((e) => this.insert(e[0], e[1]));
    }    

    public popSafeCell() : number | null {
        // Top left is best move at the start of the game.
        if (!this.hasSuggested) {
            this.hasSuggested = true;
            if (this.groups.every((group) => group.length === 0)) return 0;
        }

        let nextSet = this.groups[0].shift();
        if (nextSet === undefined) return null;

        for (let i = 1; i < 9; ++i) --this.indexBounds[0][i];
        return [...nextSet.values()][0]
    }

    private leftOuter(a: Set<number>, b: Set<number>): Set<number> {
        return new Set([...a].filter(v => !b.has(v)));
    }
}