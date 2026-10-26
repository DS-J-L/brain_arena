import type { HapCheck, HapTile } from "./types.js";

export function checkHap(tiles: HapTile[]): HapCheck {
  if (tiles.length !== 3) throw new Error("타일 3개가 필요합니다.");
  const check = (attribute: keyof HapTile) => {
    const count = new Set(tiles.map(tile => tile[attribute])).size;
    return count === 1 ? "SAME" : count === 3 ? "DIFFERENT" : "TWO_SAME";
  };
  return { shape: check("shape"), shapeColor: check("shapeColor"), backgroundColor: check("backgroundColor") };
}

export function isHap(tiles: HapTile[]): boolean {
  return tiles.length === 3 && Object.values(checkHap(tiles)).every(value => value !== "TWO_SAME");
}

// Public tile numbers are 1-based. Sorting makes every permutation the same answer.
export const hapKey = (numbers: number[]) => [...numbers].sort((a, b) => a - b).join(",");

export function findAllHaps(board: HapTile[]): number[][] {
  const answers: number[][] = [];
  for (let a = 0; a < board.length - 2; a++)
    for (let b = a + 1; b < board.length - 1; b++)
      for (let c = b + 1; c < board.length; c++)
        if (isHap([board[a], board[b], board[c]])) answers.push([a + 1, b + 1, c + 1]);
  return answers;
}
