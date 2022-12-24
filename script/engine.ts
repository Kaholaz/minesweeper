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
            if (this.board.cells[id].getState() !== CellState.REVEALED) continue;
            if (this.board.cells[id].adjacentBombs === 0) continue;
            
            let set = new Set(
                this.board.getAdjacentCells(this.board.idToCoordinate(id))
                .filter(c => this.board.getCell(c).getState() !== CellState.REVEALED)
                .map(c => {return this.board.coordinateToId(c)}));
            this.groups.insert(this.board.cells[id].adjacentBombs, set);
            if (this.groups.safeSpots.length) return;
        }
    }

    public revealRevealable() {
        let progress = true;
        while (progress) {
            // Recalculate moves
            this.initGroups();
            progress = false;
            while (true) {
                let nextMove = this.nextMove();

                // No safe cell
                if (nextMove === null) break;

                // Cell is revealed and progress is made
                this.board.revealCell(nextMove);
                progress = true;

                // Don't loop on starting move
                if (nextMove.x === 0 && nextMove.y === 0) break
            }
        }
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
        if (cellId !== null) return this.board.idToCoordinate(cellId);
        
        this.initGroups();
        cellId = this.groups.popSafeCell();

        if (cellId === null) return null;
        return this.board.idToCoordinate(cellId);
    }
}

class Groups {
    private groups: Array<Array<Set<number>>>
    private indexBounds: Array<Array<number>>
    private board: Board // Temporary for debugging purposes

    public safeSpots: Array<number>

    public constructor(board: Board) {
        this.board = board;
        this.groups = new Array(9);
        for (let i = 1; i < 9; ++i) this.groups[i] = new Array();
        this.indexBounds = Array(9);
        for (let i = 0; i < 9; ++i) this.indexBounds[i] = [...[0, 0, 0, 0, 0, 0, 0, 0, 0]];

        this.safeSpots = new Array();
    }

    public insert(bombs: number, set: Set<number>) {
        if (set.size === 0) return;

        // All elements of sets that have 0 adjacent bombs are safe.
        if (bombs === 0) {
            set.forEach((k, _) => this.safeSpots.push(k));
            set.forEach((id, _) => {
                let cell = this.board.cells[id]
                if (cell.isBomb) throw "A bomb was marked as safe!"
            });
            
            return;
        }

        if (bombs === 1 && set.size === 1) {
            for (let id of set.values()) {
                console.log("Bomb:", id);
                let cell = this.board.cells[id]
                
                if (cell.getState() === CellState.NORMAL) this.board.flagCell(this.board.idToCoordinate(id));
                if (!cell.isBomb) throw "Safe space marked as bomb!!!"
            }
        }

        // Split sets where bombs and the size matches
        if (bombs > 1 && bombs === set.size) {
            set.forEach((k, _) => this.insert(1, new Set([k])));
            return;
        }
        
        // Handle inserted supersets.
        for (let bombsExamined = bombs; bombsExamined >= 1; --bombsExamined) {
            let i = this.indexBounds[bombsExamined][set.size] - 1;
            for (; i >= 0; --i) {
                let unique = this.leftOuter(set, this.groups[bombsExamined][i])
                if (unique.size === set.size - this.groups[bombsExamined][i].size) {
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
            for (; i < this.groups[bombsExamined].length; ++i) {
                let unique = this.leftOuter(this.groups[bombsExamined][i], set);
                if (unique.size > this.groups[bombsExamined][i].size - set.size) continue;

                let setSize = this.groups[bombsExamined][i].size;
                delete this.groups[bombsExamined][i];
                this.groups[bombsExamined] = this.groups[bombsExamined].filter(n => 1);
                for (let j = setSize; j < 9; ++j) --this.indexBounds[bombsExamined][j];
                --i;
                
                insertQueue.push([bombsExamined - bombs, unique]);
            }
        }

        // Insert from queue
        insertQueue.forEach((e) => this.insert(e[0], e[1]));
    }    

    public popSafeCell() : number | null {
        // Top left is best move at the start of the game.
        if (this.groups.every((group) => group.length === 0)) return 0;

        let out = this.safeSpots.shift();
        if (out === undefined) return null;
        return out;
    }

    private leftOuter(a: Set<number>, b: Set<number>): Set<number> {
        return new Set([...a].filter(v => !b.has(v)));
    }
}