import { GameState, CellState } from "./enums.js";

class Cell {
    id: number;
    adjacentBombs: number;
    private state: CellState;
    isBomb: boolean;

    public constructor(id: number) {
        this.id = id;
        this.adjacentBombs = 0;
        this.state = CellState.NORMAL;
        this.isBomb = false;
    }

    public getCellHtml() : HTMLDivElement {
        let out = document.createElement("div");
        out.classList.add("cell");
        out.classList.add(CellState[this.state]);
        out.id = "cell" + this.id.toString();
        return out;
    }

    public reveal(): boolean {
        if (this.state !== CellState.NORMAL) {
            return true;
        }

        if (this.isBomb) {
            this.setState(CellState.EXPLODED);
            return false;
        }

        this.setState(CellState.REVEALED);

        return true;
    }

    public flag() {
        if (this.state === CellState.NORMAL) {
            this.setState(CellState.FLAGGED);
            return;
        }

        if (this.state === CellState.FLAGGED) {
            this.setState(CellState.NORMAL);
            return;
        }
    }

    private setText(text: string) {
        let cellHtml = document.getElementById("cell" + this.id.toString());
        if (cellHtml === null) throw "Could not find cell element";
        cellHtml.innerHTML = text;
    }

    public getState(): CellState {
        return this.state;
    }

    private setState(state: CellState) {
        let cellDiv = document.getElementById("cell" + this.id);
        if (cellDiv === null) {
            throw "Oh no...!";
        }

        cellDiv.classList.remove(CellState[this.state]);
        cellDiv.classList.add(CellState[state]);

        if (state === CellState.EXPLODED) this.setText("*");
        if (state === CellState.REVEALED && this.adjacentBombs) this.setText(this.adjacentBombs.toString());
        if (state === CellState.NORMAL) this.setText("");
        if (state === CellState.FLAGGED) this.setText("F");

        this.state = state;
    }
}

class Coordinate {
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

export class Board {
    readonly width: number;
    readonly height: number;
    readonly bombs: number;
    private intervalId: number = 0;
    private elapsedSeconds: number = 0;
    private unflaggedBombs: number = -1;
    private revealedCells: number;
    private gameState: GameState;

    private cells: Array<Cell>

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


    private revealCell(coordinate: Coordinate) {
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

    private revealRevealedCell(coordinate: Coordinate) {
        if (this.getCell(coordinate).adjacentBombs > this.calculateAdjacentFlags(coordinate)) return;

        this.getAdjacentCells(coordinate)
            .forEach(c => {if (this.getCell(c).getState() === CellState.NORMAL) this.revealCell(c);});
    }

    private revealAllBombs() {
        this.cells.forEach( (cell) => {
            if (cell.getState() === CellState.NORMAL && cell.isBomb) {
                cell.reveal();
            }
        })
    }

    private flagCell(coordinate: Coordinate) {
        let cell = this.getCell(coordinate);
        if (![CellState.NORMAL, CellState.FLAGGED].includes(cell.getState())) {
            return;
        }

        cell.getState() == CellState.NORMAL ? 
            this.setUnflaggedBombs(this.unflaggedBombs - 1) : this.setUnflaggedBombs(this.unflaggedBombs + 1);

        cell.flag();
    }

    private getTimerElement() : HTMLElement {
        const timer = document.getElementById("timer");
        if (timer === null) throw "Someone deleted the timer";

        return timer;
    }

    public resetTimer() {
        this.stopTimer();
        this.intervalId = 0;

        let timer = this.getTimerElement();
        this.elapsedSeconds = 0;
        timer.innerHTML = "0";
    }

    private startTimer() {
        let timer = this.getTimerElement();

        this.elapsedSeconds = 0;
        this.intervalId = setInterval((timer: HTMLElement) => {
            ++this.elapsedSeconds;
            timer.innerHTML = this.elapsedSeconds.toString();
        }, 1000, timer);
    }

    private stopTimer() {
        if (this.intervalId !== 0) clearInterval(this.intervalId);
    }

    private getAdjacentCells(coordinate: Coordinate) : Array<Coordinate> {
        let out = new Array<Coordinate>();
        for (let x = -1; x <= 1; ++x) {
            for (let y = -1; y <= 1; ++y) {
                out.push(new Coordinate(coordinate.x + x, coordinate.y + y));
            }
        }

        return out.filter(c => this.isAdjacent(coordinate, c))
    }

    private calculateAdjacentFlags(coordinate: Coordinate) : number {
        return this.getAdjacentCells(coordinate)
            .map(c => {return this.getCell(c)})
            .filter(c => {return c.getState() === CellState.FLAGGED}).length 
    }

    private isInBounds(candidate: Coordinate) : boolean {
        if (candidate.x < 0 || candidate.y < 0) {
            return false;
        }

        if (candidate.x >= this.width || candidate.y >= this.height) {
            return false;
        }

        return true;
    }

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

    private getCell(coordinate: Coordinate) : Cell {
        if (!this.isInBounds(coordinate)) {
            throw "Cell is out of bounds!";
        }        

        return this.cells[this.coordinateToId(coordinate)];
    }

    private idToCoordinate(id: number) : Coordinate {
        return new Coordinate(id % this.width, Math.floor(id / this.width))
    }

    private coordinateToId(coordinate: Coordinate) : number {
        return coordinate.x + coordinate.y * this.width;
    }

    private setUnflaggedBombs(unflaggedBombs: number) {
        let unflaggedElement = document.getElementById("remaining-bombs");
        if (unflaggedElement === null) throw "Someone deleted the unflagged bombs counter";

        unflaggedElement.innerHTML = unflaggedBombs.toString();
        this.unflaggedBombs = unflaggedBombs
    }
}