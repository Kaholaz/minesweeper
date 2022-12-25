import { Board, Coordinate } from "./game/board.js";
import { CellState } from "./game/cell.js";

/**
 * Objects of this class finds and reveals safe cells.
 */
export class Engine {
    private board: Board;
    private groups: Groups; 
    
    /**
     * Constructor for the Engine class. A board is used to retrieve the
     * current state of the game, and to reveal safe cells.
     * @param board The board to find safe cells on. 
     */
    constructor(board: Board) {
        this.board = board;
        this.groups = new Groups(board);
    }

    /**
     * Initialize the current groups for the sate of the board. (See the Groups
     * documentation for an explanation.)
     */
    private initGroups() {
        this.groups = new Groups(this.board);
        for (let id = 0; id < this.board.cells.length; ++id) {
            this.insertAdjacent(this.board.idToCoordinate(id))
        }
    }

    /**
     * Insert all adjacent cells to a revealed cell to it's relevant group.
     * @param cell The cell to use.
     */
    private insertAdjacent(cell: Coordinate) {
        if (this.board.getCell(cell).getState() !== CellState.REVEALED) return;
        if (this.board.getCell(cell).adjacentBombs === 0) return;
            

        let set = new Set(
            this.board.getAdjacentCells(cell)
            .filter(c => this.board.getCell(c).getState() !== CellState.REVEALED)
            .map(c => {return this.board.coordinateToId(c)}));
        this.groups.insert(this.board.getCell(cell).adjacentBombs, set);
    }

    /**
     * Reveal all safe cells in order of discovery.
     */
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

    /**
     * Finds the boarder of a region of cells with zero adjacent cells, and adds
     * their sets to their correct group. If the cell has a non-zero number of
     * adjacent bombs, only the set of the adjacent cells to the cell is added
     * to its correct group.
     * @param cell The cell's neighbors to investigate.
     */
    private insertRecursively(cell: Coordinate) {
        [...this.findAdjacentToZero(cell, new Set())]
            .map(c => this.board.idToCoordinate(c))
            .forEach(c => this.insertAdjacent(c));
    } 

    /**
     * Finds the border region of a region with cells that have no adjacent
     * bombs using a recursive search. If the cell has a non-zero number of
     * adjacent bombs, the boarder is defined as just the starting cell.
     * @param cell The cell to start the search of the region with.
     * @param seen All cells that are already searched. 
     * @returns A set of the ids of the cells that are in the boarder region of
     * cells that have no adjacent bombs.
     */
    private findAdjacentToZero(cell: Coordinate, seen: Set<number>) : Set<number> {
        if (seen.has(this.board.coordinateToId(cell))) return seen;

        seen.add(this.board.coordinateToId(cell))                
        if (this.board.getCell(cell).adjacentBombs !== 0) return seen;

        this.board.getAdjacentCells(cell).forEach((c) => {return this.findAdjacentToZero(c, seen)})
        return seen;
    }

    /**
     * Flags all guaranteed bombs without revealing anything.
     */
    public flagBombs() {
        this.initGroups();
    }

    /**
     * Reveal one guaranteed safe cell.
     */
    public revealOne() {
        this.initGroups();
        let nextMove = this.nextMove();
        if (nextMove === null) return;
        this.board.revealCell(nextMove);
    }

    /**
     * @returns Returns the next move determined by the current sate of the
     * groups. If no safe move is found, null is returned.
     */
    private nextMove() : Coordinate | null {
        let cellId = this.groups.popSafeCell();
        if (cellId === null) return null;
        
        let coordinate = this.board.idToCoordinate(cellId);
        if (this.board.getCell(coordinate).getState() === CellState.FLAGGED)
            this.board.flagCell(coordinate);
        return coordinate
    }
}

/**
 * Groups keeps track of the current state of the board and eliminates all
 * redundant information. Thus finding all cells that are guaranteed to no
 * contain any bombs. This is done by keeping track of multiple sets of sets,
 * these will be refereed to as groups. 
 * 
 * The sets contained in a group have a common set of bombs between them. As an
 * example, a set of three cells in the second group (zero-indexed), indicates
 * the three cells share a common two adjacent bombs. 
 */
class Groups {
    private groups: Array<Array<Set<number>>>
    private indexBounds: Array<Array<number>>
    private hasSuggested: boolean
    private board: Board // Temporary for debugging purposes

    /**
     * The constructor for the Groups class.  
     * @param board This is included for raising errors and debugging. Since
     * this class only functions using set manipulations, the state of the
     * board, and thus this parameter, is not needed.
     */
    public constructor(board: Board) {
        this.board = board;
        this.hasSuggested = false;
        this.groups = new Array(9);
        for (let i = 0; i < 9; ++i) this.groups[i] = new Array();
        this.indexBounds = Array(9);
        for (let i = 0; i < 9; ++i) this.indexBounds[i] = [...[0, 0, 0, 0, 0, 0, 0, 0, 0]];
    }

    /**
     * Insert a set into the correct group and remove any redundant information
     * in the groups.
     * @param bombs The number of bombs that are common for the set.
     * @param set A set of cells that share a number of common bombs.
     */
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
                
                if (cell.getState() === CellState.NORMAL)
                    this.board.flagCell(this.board.idToCoordinate(id));
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
                --i;

                for (let j = groupSize; j < 9; ++j)
                    --this.indexBounds[bombsExamined][j];
                
                // Remove empty slots.
                groupToExaminate = this.groups[bombsExamined] =
                groupToExaminate.filter(n => 1);
                
                insertQueue.push([bombsExamined - bombs, unique]);
            }
        }

        // Insert from queue
        insertQueue.forEach((e) => this.insert(e[0], e[1]));
    }    

    /**
     * Returns a guaranteed safe cell from the groups. Please reveal this cell.
     * If it is not revealed, adding this cell again will mess up the safe cell
     * generation.
     * @returns A guaranteed safe cell to reveal.
     */
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

    /**
     * Finds the elements of a set that is unique to the left set.
     * @param a The left set.
     * @param b The right set.
     * @returns The elements unique to the left set.
     */
    private leftOuter(a: Set<number>, b: Set<number>): Set<number> {
        return new Set([...a].filter(v => !b.has(v)));
    }
}