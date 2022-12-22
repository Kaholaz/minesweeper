export enum CellState {
    NORMAL,
    REVEALED,
    FLAGGED,
    EXPLODED,
};

export class Cell {
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