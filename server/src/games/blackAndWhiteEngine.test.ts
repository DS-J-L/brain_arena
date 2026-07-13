import { describe, expect, it } from "vitest";
import { blackAndWhiteEngine } from "./blackAndWhiteEngine.js";

describe("blackAndWhiteEngine", () => {
  it("resolves a round and hides the opponent tile before finish", () => {
    let state = blackAndWhiteEngine.createInitialState(["a", "b"]);
    state = blackAndWhiteEngine.applyAction(state, "a", { type: "SELECT_TILE", tile: 3 });
    expect(blackAndWhiteEngine.getPlayerView(state, "b").opponentHasSelected).toBe(true);
    state = blackAndWhiteEngine.applyAction(state, "b", { type: "SELECT_TILE", tile: 2 });
    const view = blackAndWhiteEngine.getPlayerView(state, "b");
    expect(view.scores.a).toBe(1);
    expect(view.history[0].opponentColor).toBe("BLACK");
    expect(view.history[0].opponentTile).toBeUndefined();
  });
  it("rejects reused tiles and ends at five wins", () => {
    let state = blackAndWhiteEngine.createInitialState(["a", "b"]);
    for (const [a, b] of [[9,5],[8,4],[7,3],[6,2],[5,1]] as const) {
      state = blackAndWhiteEngine.applyAction(state, "a", { type: "SELECT_TILE", tile: a });
      state = blackAndWhiteEngine.applyAction(state, "b", { type: "SELECT_TILE", tile: b });
    }
    expect(state.winnerId).toBe("a");
    expect(blackAndWhiteEngine.getPlayerView(state, "b").history[0].opponentTile).toBe(9);
  });
  it("validates ownership", () => {
    const state = blackAndWhiteEngine.createInitialState(["a", "b"]);
    expect(blackAndWhiteEngine.validateAction(state, "a", { type: "SELECT_TILE", tile: 10 })).toBe(false);
    expect(blackAndWhiteEngine.validateAction(state, "x", { type: "SELECT_TILE", tile: 1 })).toBe(false);
  });
});
