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

function combination(n: number, k: number) {
  if (k < 0 || k > n) return 0;
  let result = 1;
  for (let index = 1; index <= k; index++) result = result * (n - index + 1) / index;
  return result;
}

function multinomial3(total: number, less: number, equal: number, greater: number) {
  if (less + equal + greater !== total) return 0;
  return combination(total, less) * combination(total - less, equal);
}

export function rankFitProbability(board: Array<number | null>, card: number, position: number) {
  if (board[position] !== null) return 0;
  const futureCardCount = board.filter(value => value === null).length - 1;
  const knownLess = board.filter(value => value !== null && value < card).length;
  const knownEqual = board.filter(value => value === card).length;
  const lessProbability = (card - 1) / 10;
  const equalProbability = 1 / 10;
  const greaterProbability = (10 - card) / 10;
  const targetRank = position + 1;
  let probability = 0;
  for (let futureLess = 0; futureLess <= futureCardCount; futureLess++) {
    for (let futureEqual = 0; futureEqual <= futureCardCount - futureLess; futureEqual++) {
      const futureGreater = futureCardCount - futureLess - futureEqual;
      const lowerRank = knownLess + futureLess;
      const upperRank = lowerRank + knownEqual + futureEqual + 1;
      if (lowerRank < targetRank && targetRank <= upperRank) probability += multinomial3(futureCardCount, futureLess, futureEqual, futureGreater) * lessProbability ** futureLess * equalProbability ** futureEqual * greaterProbability ** futureGreater;
    }
  }
  return probability;
}

function nearestLeft(board: Array<number | null>, position: number) {
  for (let index = position - 1; index >= 0; index--) if (board[index] !== null) return board[index];
  return null;
}

function nearestRight(board: Array<number | null>, position: number) {
  for (let index = position + 1; index < board.length; index++) if (board[index] !== null) return board[index];
  return null;
}

function feasibleLongest(board: Array<number | null>) {
  let best = 0;
  for (let start = 0; start < board.length; start++) {
    for (let end = start; end < board.length; end++) {
      let previous: number | null = null, feasible = true;
      for (let index = start; index <= end; index++) if (board[index] !== null) {
        if (previous !== null && previous > board[index]!) { feasible = false; break; }
        previous = board[index];
      }
      if (feasible) best = Math.max(best, end - start + 1);
    }
  }
  return best;
}

function placementBaseScore(board: Array<number | null>, card: number, position: number) {
  if (board[position] !== null) return -Infinity;
  const progress = board.filter(value => value !== null).length / board.length;
  const left = nearestLeft(board, position), right = nearestRight(board, position);
  const keepsOrder = (left === null || left <= card) && (right === null || card <= right);
  const next = [...board]; next[position] = card;
  const adjacentConnections = (position > 0 && next[position - 1] !== null && next[position - 1]! <= card ? 1 : 0) + (position + 1 < next.length && next[position + 1] !== null && card <= next[position + 1]! ? 1 : 0);
  const rankWeight = 100 - progress * 45;
  const score = rankFitProbability(board, card, position) * rankWeight + longest(next) * (4 + progress * 7) + feasibleLongest(next) * (2.5 - progress) + adjacentConnections * (4 + progress * 5);
  return keepsOrder ? score : score * .12;
}

function seededCard(seed: number) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return Math.floor((value - Math.floor(value)) * 10) + 1;
}

function rolloutScore(board: Array<number | null>, sample: number) {
  const simulation = [...board];
  for (let step = 0; simulation.some(value => value === null); step++) {
    const card = seededCard(sample * 31 + step * 17 + 1);
    const placement = simulation.map((value, position) => value === null ? { position, score: placementBaseScore(simulation, card, position) } : null).filter((item): item is { position: number; score: number } => item !== null).sort((a, b) => b.score - a.score)[0];
    simulation[placement.position] = card;
  }
  let pairs = 0;
  for (let index = 1; index < simulation.length; index++) if (simulation[index - 1]! <= simulation[index]!) pairs++;
  return longest(simulation) + pairs * .08;
}

export function rankAscendingPlacements(board: Array<number | null>, card: number, rolloutCount = 40) {
  return board.map((value, position) => value === null ? { position, baseScore: placementBaseScore(board, card, position) } : null).filter((item): item is { position: number; baseScore: number } => item !== null).map(item => {
    const next = [...board]; next[item.position] = card;
    let future = 0;
    for (let sample = 0; sample < rolloutCount; sample++) future += rolloutScore(next, sample);
    return { position: item.position, score: item.baseScore + future / Math.max(1, rolloutCount) * 5, rankProbability: rankFitProbability(board, card, item.position) };
  }).sort((a, b) => b.score - a.score);
}

function chooseAscending<T>(ranked: T[]) {
  const roll = Math.random();
  if (roll < .9 || ranked.length === 1) return ranked[0];
  if (roll < .98 || ranked.length === 2) return ranked[1];
  return ranked[2 + Math.floor(Math.random() * Math.max(1, ranked.length - 2))] ?? ranked[0];
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
    const choices = view.offeredCards.map((card, cardIndex) => {
      const myBest = rankAscendingPlacements(view.myBoard, card, 24)[0]?.score ?? -999;
      const otherCard = view.offeredCards[cardIndex === 0 ? 1 : 0];
      const genericOpponentValue = rankAscendingPlacements(Array(10).fill(null), otherCard, 0)[0]?.score ?? 0;
      return { cardIndex, score: myBest - genericOpponentValue * .12 };
    }).sort((a, b) => b.score - a.score);
    return { type: "CHOOSE_CARD", payload: { cardIndex: chooseAscending(choices).cardIndex } };
  }
  if (view.hasPlaced || view.myAssignedCard === null) return null;
  const placements = rankAscendingPlacements(view.myBoard, view.myAssignedCard);
  return placements.length ? { type: "PLACE_CARD", payload: { position: chooseAscending(placements).position } } : null;
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
