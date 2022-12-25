/**
 * Indicates the current state of a cell.
 */
export enum CellState {
    NORMAL,
    REVEALED,
    FLAGGED,
    EXPLODED,
};

/**
 * Represents a single cell on a Minesweeper-board.
 */
export class Cell {
    id: number;
    adjacentBombs: number;
    private state: CellState;
    isBomb: boolean;


    /**
     * @param id The id of a Cell. This is the same value as the index of the
     * cell in the Cell array in a Board-object.
     */
    public constructor(id: number) {
        this.id = id;
        this.adjacentBombs = 0;
        this.state = CellState.NORMAL;
        this.isBomb = false;
    }

    /**
     * @returns The html that represents a single cell.
     */
    public getCellHtml() : HTMLDivElement {
        let out = document.createElement("div");
        out.classList.add("cell");
        out.classList.add(CellState[this.state]);
        out.id = "cell" + this.id.toString();
        return out;
    }

    /**
     * Reveals a cell. If the state of the cell is not NORMAL, this method does
     * nothing.
     * @returns False if the reveal revealed a bomb, true if otherwise.
     */
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

    /**
     * Flags a cell. This flips the state of the between NORMAL and FLAGGED if
     * and only if the cells state currently is NORMAL or FLAGGED.
     */
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

    /**
     * Sets the text inside of the div in the DOM.
     * @param text The text to set the inside of the div to.
     */
    private setText(text: string) {
        let cellHtml = document.getElementById("cell" + this.id.toString());
        if (cellHtml === null) throw "Could not find cell element";
        cellHtml.innerHTML = text;
    }

    /**
     * @returns The current state of the cell.
     */
    public getState(): CellState {
        return this.state;
    }

    /**
     * Sets the state of the cell. This also does the correct changes to the DOM.
     * @param state The new state of the cell.
     */
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