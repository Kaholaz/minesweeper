import { Board } from "./classes.js";


let board = new Board(30, 16, 99);

// Reset functionality
document.getElementById("reset")?.addEventListener("click", () => {
    board.resetTimer();
    board = new Board(30, 16, 99);
})