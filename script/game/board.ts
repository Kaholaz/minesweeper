import { Cell, CellState } from "./cell.js";

/**
 * The current state of the game.
 */
export enum GameState {
    INIT,
    READY,
    PLAYING,
    LOST,
    WON,
}

/**
 * A pair of numbers that unambiguously refers to a single cell on the board.
 */
export class Coordinate {
    readonly x: number;
    readonly y: number;

    public constructor (x: number, y: number) {
        this.x = x;
        this.y = y;
    }

    public equals(other: Coordinate) {
        return this.x === other.x && this.y === other.y;
    }
}

/**
 * Represents the game board in a Minesweeper game.
 */
export class Board {
    readonly width: number;
    readonly height: number;
    readonly bombs: number;
    private intervalId: number = 0;
    private elapsedSeconds: number = 0;
    private unflaggedBombs: number = -1;
    private revealedCells: number;
    private gameState: GameState;

    public cells: Array<Cell>

    /**
     * @param width The width of the board.
     * @param height The height of the board.
     * @param bombs The number of bombs to place on the board.
     */
    public constructor (width: number, height: number, bombs: number) {
        this.width = width;
        this.height = height;
        this.bombs = bombs;
        this.revealedCells = 0;
        this.gameState = GameState.INIT;
        this.cells = new Array(width * height);
        this.setUnflaggedBombs(bombs);
        this.resetTimer();
        this.initBoard();
    }

    /**
     * Creates a new board in the DOM with the correct eventlisteners and
     * functionality.  After this method is called, the game state is READY.
     */
    private initBoard() {
        if (this.gameState !== GameState.INIT) {
            return;
        }
        
        let htmlBoard = document.getElementById("game-board");

        if (htmlBoard === null) {
            throw "Oh no...";
        }

        this.revealedCells = 0;
        htmlBoard.innerHTML = "";

        // Create empty row
        let row = document.createElement("div");
        row.classList.add("grid-row");

        for (let i = 0; i < this.width * this.height; ++i) {
            let newCell = new Cell(i);
            let cellHtml = newCell.getCellHtml();

            let coordinate = this.idToCoordinate(i);
            cellHtml.addEventListener("click", () => {this.revealCell(coordinate)});
            cellHtml.addEventListener("contextmenu", () => {this.flagCell(coordinate)})
            cellHtml.oncontextmenu = function(e: MouseEvent){e.preventDefault(); e.stopPropagation();}

            row.appendChild(cellHtml);
            this.cells[i] = newCell

            if (i % this.width === this.width - 1) {
                htmlBoard.appendChild(row);
                row = document.createElement("div")
                row.classList.add("grid-row");
            }
        }

        this.gameState = GameState.READY
    }

    /**
     * Places bombs randomly on the board. The bombs can be placed anywhere on
     * the board, except directly besides a specified cell to avoid. This method
     * should only be called if the game state is READY.
     * @param avoid The cell to avoid.
     */
    private placeBombs(avoid: Coordinate) {
        if (this.gameState !== GameState.READY) {
            return;
        }

        for (let n = 0; n < this.bombs;) {
            let x = Math.floor(Math.random() * this.width);
            let y = Math.floor(Math.random() * this.height);

            let bomb = new Coordinate(x, y);
            if (this.isAdjacent(avoid, bomb) || avoid.equals(bomb)) {
                continue;
            }

            if (this.getCell(bomb).isBomb) {
                continue;
            }

            this.getCell(bomb).isBomb = true;
            this.getAdjacentCells(bomb)
                .map(c => {return this.getCell(c)})
                .forEach(c => {++c.adjacentBombs});
            ++n;
        }
    }


    /**
     * Reveals a single cell.
     * @param coordinate The cell to reveal.
     */
    public revealCell(coordinate: Coordinate) {
        if ([GameState.LOST, GameState.WON].includes(this.gameState)) {
            return;
        }

        if (this.gameState === GameState.READY) {
            // Initialize bombs
            this.placeBombs(coordinate);

            this.startTimer();

            // We are now playing :)
            this.gameState = GameState.PLAYING;
        }
        // Game state is now PLAYING.

        let cell = this.getCell(coordinate);
        if (![CellState.NORMAL, CellState.REVEALED].includes(cell.getState())) {
            return;
        }
        
        if (cell.getState() === CellState.REVEALED) {
            this.revealRevealedCell(coordinate);
            return;
        }

        // Cell state is NORMAL
        ++this.revealedCells;
        let lost = !cell.reveal()
        if (lost) {
            this.revealAllBombs();
            this.gameState = GameState.LOST;
            this.stopTimer();
            return;
        }

        // Recursively reveal cells where adjacent bombs is 0 and their neighbors.
        if (cell.adjacentBombs === 0) this.revealRevealedCell(coordinate);

        if (this.revealedCells === this.width * this.height - this.bombs) {
            this.gameState = GameState.WON;
            this.stopTimer();
        }
    }

    /**
     * Reveals the neighbors of a cell if the number of flags adjacent to the
     * cell is greater than the specified number of adjacent bombs to this cell.
     * @param coordinate The coordinates of the cell to reveal the neighbors of.
     */
    private revealRevealedCell(coordinate: Coordinate) {
        if (this.getCell(coordinate).adjacentBombs > this.calculateAdjacentFlags(coordinate)) return;

        this.getAdjacentCells(coordinate)
            .forEach(c => {if (this.getCell(c).getState() === CellState.NORMAL) this.revealCell(c);});
    }

    /**
     * Reveals all hidden bombs on the board. This should be called when the
     * player looses the game.
     */
    private revealAllBombs() {
        this.cells.forEach( (cell) => {
            if (cell.getState() === CellState.NORMAL && cell.isBomb) {
                cell.reveal();
            }
        })
    }

    /**
     * Flags a cell, indicating that the cell contains a bomb.
     * @param coordinate The coordinates of the cell to flag.
     */
    public flagCell(coordinate: Coordinate) {
        let cell = this.getCell(coordinate);
        if (![CellState.NORMAL, CellState.FLAGGED].includes(cell.getState())) {
            return;
        }

        if (cell.getState() == CellState.NORMAL)
            this.setUnflaggedBombs(this.unflaggedBombs - 1)
        else 
            this.setUnflaggedBombs(this.unflaggedBombs + 1);

        cell.flag();
    }

    /**
     * Finds and returns the HTMLElement of the timer.
     */
    private getTimerElement() : HTMLElement {
        const timer = document.getElementById("timer");
        if (timer === null) throw "Someone deleted the timer";

        return timer;
    }

    /**
     * Stops the current timer resets it to zero.
     */
    public resetTimer() {
        this.stopTimer();
        this.intervalId = 0;

        let timer = this.getTimerElement();
        this.elapsedSeconds = 0;
        timer.innerHTML = "0";
    }

    /**
     * Start a new timer. This timer counts up once every second.
     */
    private startTimer() {
        let timer = this.getTimerElement();

        this.elapsedSeconds = 0;
        this.intervalId = setInterval((timer: HTMLElement) => {
            ++this.elapsedSeconds;
            timer.innerHTML = this.elapsedSeconds.toString();
        }, 1000, timer);
    }

    /**
     * Stops the current timer.
     */
    private stopTimer() {
        if (this.intervalId !== 0) clearInterval(this.intervalId);
    }

    /**
     * Finds and returns the coordinates of all adjacent cells of a cell.
     * @param coordinate The coordinates of a cell to find adjacent cells of.
     * @returns An array of the coordinates of the adjacent cells.
     */
    public getAdjacentCells(coordinate: Coordinate) : Array<Coordinate> {
        let out = new Array<Coordinate>();
        for (let x = -1; x <= 1; ++x) {
            for (let y = -1; y <= 1; ++y) {
                out.push(new Coordinate(coordinate.x + x, coordinate.y + y));
            }
        }

        return out.filter(c => this.isAdjacent(coordinate, c))
    }

    /**
     * Finds the number of flagged cells adjacent to a given cell.
     * @param coordinate The coordinate of the cell to find adjacent flags of.
     * @returns The number of flagged cells adjacent to a given cell.
     */
    private calculateAdjacentFlags(coordinate: Coordinate) : number {
        return this.getAdjacentCells(coordinate)
            .map(c => {return this.getCell(c)})
            .filter(c => {return c.getState() === CellState.FLAGGED}).length 
    }

    /**
     * Checks to see if the coordinates of a cell is within the bounds of the board.
     * @param candidate The cell to check.
     * @returns True if it is within the bounds, false if not.
     */
    private isInBounds(candidate: Coordinate) : boolean {
        if (candidate.x < 0 || candidate.y < 0) {
            return false;
        }

        if (candidate.x >= this.width || candidate.y >= this.height) {
            return false;
        }

        return true;
    }

    /**
     * Checks if the coordinates of one cell is directly adjacent to another cell (either orthogonally or diagonally).
     * @param base The coordinates of one cell.
     * @param candidate The coordinates of the other cell.
     * @returns True if the cells are adjacent, false if not.
     */
    private isAdjacent(base: Coordinate, candidate: Coordinate) : boolean {
        if (!this.isInBounds(base) || !this.isInBounds(candidate)) {
            return false;
        }

        let d = Math.pow(candidate.x - base.x, 2) + Math.pow(candidate.y - base.y, 2);
        if (d < 1 || 2 < d) {
            return false;
        }
        
        return true;
    }

    /**
     * Finds the Cell object that is present at a given set of coordinates.
     * @param coordinate The coordinates of the cell.
     * @returns The Cell object.
     */
    public getCell(coordinate: Coordinate) : Cell {
        if (!this.isInBounds(coordinate)) {
            throw "Cell is out of bounds!";
        }        

        return this.cells[this.coordinateToId(coordinate)];
    }

    /**
     * Translates the id of a cell to its coordinates.
     * @param id The id of the cell.
     * @returns The coordinates of the cell.
     */
    public idToCoordinate(id: number) : Coordinate {
        return new Coordinate(id % this.width, Math.floor(id / this.width))
    }

    /**
     * Translates the coordinates of a cell to its id.
     * @param coordinate The coordinates of the cell.
     * @returns The id of the cell.
     */
    public coordinateToId(coordinate: Coordinate) : number {
        return coordinate.x + coordinate.y * this.width;
    }

    /**
     * Sets the total number of unflagged bombs.
     * @param unflaggedBombs The total number of unflagged bombs.
     */
    private setUnflaggedBombs(unflaggedBombs: number) {
        let unflaggedElement = document.getElementById("remaining-bombs");
        if (unflaggedElement === null) throw "Someone deleted the unflagged bombs counter";

        unflaggedElement.innerHTML = unflaggedBombs.toString();
        this.unflaggedBombs = unflaggedBombs
    }
}