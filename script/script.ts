import { Engine } from "./engine.js";
import { Board } from "./game/board.js";


let board = new Board(30, 16, 99);
export let engine = new Engine(board);

// Reset functionality
document.getElementById("reset")?.addEventListener("click", () => {
    board.resetTimer();
    board = new Board(30, 16, 99);
})

// Flag
document.getElementById("flag")?.addEventListener("click", () => {
    engine = new Engine(board);
    engine.flagBombs();
})

// Reveal one
document.getElementById("reveal-one")?.addEventListener("click", () => {
    engine = new Engine(board);
    engine.revealOne();
})

// Reveal all
document.getElementById("reveal")?.addEventListener("click", () => {
    engine = new Engine(board);
    engine.revealRevealable();
})