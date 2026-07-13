import { SCORE_CATEGORIES, type GameView, type ScoreCategory } from "@brain-arena/shared";
import { scoreDice } from "../games/secretDiceEngine.js";

export interface BotDecision { type: string; payload?: Record<string, unknown> }

const noisyPick = <T>(ranked: T[]) => ranked[Math.random() < .7 ? 0 : Math.random() < .67 ? Math.min(1, ranked.length - 1) : Math.floor(Math.random() * ranked.length)];

function longest(board: Array<number | null>) {
  let best = 0, run = 0, previous: number | null = null;
  for (const value of board) {
    if (value === null) { run = 0; previous = null; continue; }
    run = previous === null || previous <= value ? run + 1 : 1;
    previous = value;
    best = Math.max(best, run);
  }
  return best;
}

function boardScore(board: Array<number | null>) {
  let flexibility = 0, breaks = 0;
  for (let index = 0; index < board.length; index++) {
    if (board[index] === null) {
      const left = board.slice(0, index).reverse().find(value => value !== null);
      const right = board.slice(index + 1).find(value => value !== null);
      flexibility += left === undefined || right === undefined ? 5 : Math.max(0, right - left);
    } else if (index && board[index - 1] !== null && board[index - 1]! > board[index]!) breaks++;
  }
  return longest(board) * 5 + flexibility * .08 - breaks * 3;
}

function bestPlacement(board: Array<number | null>, card: number) {
  return board.map((value, position) => ({ value, position })).filter(item => item.value === null).map(item => {
    const next = [...board]; next[item.position] = card;
    return { position: item.position, score: boardScore(next) };
  }).sort((a, b) => b.score - a.score);
}

function decideBlackWhite(view: Extract<GameView, { kind: "BLACK_AND_WHITE" }>, botId: string): BotDecision | null {
  if (view.phase !== "SELECT" || view.currentPlayerId !== botId || view.hasSelected) return null;
  const candidates = view.myRemainingTiles.map(tile => {
    let utility = -tile * .025;
    if (view.leadColor) {
      const possible = [0,1,2,3,4,5,6,7,8].filter(value => (value % 2 === 0 ? "BLACK" : "WHITE") === view.leadColor);
      utility += possible.reduce((sum, opponent) => sum + (tile > opponent ? 1 : tile === opponent ? .2 : -1), 0) / possible.length;
    } else utility += (4 - Math.abs(tile - 4)) * .04;
    return { tile, score: utility + (Math.random() - .5) * .3 };
  }).sort((a, b) => b.score - a.score);
  return { type: "SELECT_TILE", payload: { tile: noisyPick(candidates).tile } };
}

function decideAscending(view: Extract<GameView, { kind: "ASCENDING" }>, botId: string): BotDecision | null {
  if (view.phase === "CHOOSE") {
    if (view.chooserId !== botId) return null;
    const choices = view.offeredCards.map((card, cardIndex) => ({ cardIndex, score: bestPlacement(view.myBoard, card)[0]?.score ?? -99 })).sort((a, b) => b.score - a.score);
    return { type: "CHOOSE_CARD", payload: { cardIndex: noisyPick(choices).cardIndex } };
  }
  if (view.hasPlaced || view.myAssignedCard === null) return null;
  const placements = bestPlacement(view.myBoard, view.myAssignedCard);
  return placements.length ? { type: "PLACE_CARD", payload: { position: noisyPick(placements).position } } : null;
}

function allSecretValues(count: number) {
  let values: number[][] = [[]];
  for (let index = 0; index < count; index++) values = values.flatMap(prefix => [1,2,3,4,5,6].map(value => [...prefix, value]));
  return values;
}

function bestOpenScore(dice: number[], sheet: Partial<Record<ScoreCategory, number>>) {
  return Math.max(...SCORE_CATEGORIES.filter(category => sheet[category] === undefined).map(category => scoreDice(dice, category)), 0);
}

function decideSecretDice(view: Extract<GameView, { kind: "SECRET_DICE" }>, botId: string): BotDecision | null {
  const attacker = view.attackerId === botId;
  if (view.phase === "KEEP") {
    if (!attacker) return null;
    const options: number[][] = [[0],[1],[2],[0,1],[0,2],[1,2]];
    if (view.threeKeepAvailable[botId]) options.push([0,1,2]);
    const ranked = options.map(indices => {
      const dice = indices.map(index => view.publicDice[index]);
      const duplicates = dice.length - new Set(dice).size;
      return { indices, score: duplicates * 7 + dice.reduce((sum, value) => sum + value, 0) * .25 - indices.length * .4 + Math.random() };
    }).sort((a, b) => b.score - a.score);
    return { type: "KEEP_DICE", payload: { indices: noisyPick(ranked).indices } };
  }
  if (view.phase === "SECRET") {
    if (view.mySecretSelection !== null) return null;
    const fixed = view.keptIndices.map(index => view.publicDice[index]);
    const mySheet = view.scoreSheets[botId];
    const opponentId = Object.keys(view.scoreSheets).find(id => id !== botId)!;
    const opponentSheet = view.scoreSheets[opponentId];
    const ranked = allSecretValues(view.requiredSecretCount).map(values => ({ values, score: attacker ? bestOpenScore([...fixed, ...values, ...Array(view.requiredSecretCount).fill(3)], mySheet) : -bestOpenScore([...fixed, ...values, ...Array(view.requiredSecretCount).fill(4)], opponentSheet) })).sort((a, b) => b.score - a.score);
    return { type: "SELECT_SECRET", payload: { values: noisyPick(ranked.slice(0, Math.min(8, ranked.length))).values } };
  }
  if (view.phase === "SCORE" && attacker && view.finalDice) {
    const ranked = SCORE_CATEGORIES.filter(category => view.scoreSheets[botId][category] === undefined).map(category => ({ category, score: scoreDice(view.finalDice!, category) })).sort((a, b) => b.score - a.score);
    return ranked.length ? { type: "SCORE_CATEGORY", payload: { category: noisyPick(ranked).category } } : null;
  }
  return null;
}

function decidePoker(view: Extract<GameView, { kind: "INDIAN_POKER" }>, botId: string): BotDecision | null {
  if (view.phase !== "BETTING" || view.currentPlayerId !== botId) return null;
  const opponent = view.opponentCard ?? 5;
  const possible = [1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10];
  const removed = possible.indexOf(opponent); if (removed >= 0) possible.splice(removed, 1);
  const win = possible.filter(card => card > opponent).length / possible.length;
  const tie = possible.filter(card => card === opponent).length / possible.length;
  const callCost = Math.max(0, view.currentBet - view.playerBets[botId]);
  const potOdds = callCost / Math.max(1, view.pot + callCost);
  const strength = win + tie * .5;
  if (view.legalActions.includes("RAISE") && (strength > .7 || Math.random() < .07)) return { type: "RAISE" };
  if (view.legalActions.includes("CALL") && (callCost === 0 || strength > potOdds + .07 || Math.random() < .1)) return { type: "CALL" };
  if (view.legalActions.includes("FOLD")) return { type: "FOLD" };
  if (view.legalActions.includes("ALL_IN")) return { type: "ALL_IN" };
  return null;
}

export function decidePracticeBot(view: GameView, botId: string): BotDecision | null {
  if (view.winnerId) return null;
  switch (view.kind) {
    case "BLACK_AND_WHITE": return decideBlackWhite(view, botId);
    case "ASCENDING": return decideAscending(view, botId);
    case "SECRET_DICE": return decideSecretDice(view, botId);
    case "INDIAN_POKER": return decidePoker(view, botId);
    case "FIND_THE_NUMBER": return null;
  }
}

export function practiceBotDelay() { return 700 + Math.floor(Math.random() * 1_201); }
