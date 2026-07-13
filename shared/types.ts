export const GAME_TYPES = ["BLACK_AND_WHITE", "ASCENDING", "SECRET_DICE", "INDIAN_POKER"] as const;
export type GameType = (typeof GAME_TYPES)[number];
export type RoomStatus = "WAITING" | "PLAYING" | "FINISHED";

export interface Player {
  id: string;
  nickname: string;
  isReady: boolean;
  isConnected: boolean;
  isHost: boolean;
}

export interface GameViewBase {
  kind: GameType;
  winnerId: string | null;
  isDraw: boolean;
  deadline: number | null;
}

export interface BlackAndWhiteRoundView {
  set: number;
  round: number;
  myTile: number;
  myColor: TileColor;
  opponentColor: TileColor;
  result: "WIN" | "LOSE" | "DRAW";
  opponentTile?: number;
}
export type TileColor = "BLACK" | "WHITE";
export interface BlackAndWhiteView extends GameViewBase {
  kind: "BLACK_AND_WHITE";
  set: number;
  round: number;
  scores: Record<string, number>;
  myRemainingTiles: number[];
  opponentRemainingCount: number;
  leaderId: string;
  currentPlayerId: string;
  leadColor: TileColor | null;
  hasSelected: boolean;
  history: BlackAndWhiteRoundView[];
}

export interface AscendingResult { longest: number; longestCount: number; longestSum: number; ascendingPairs: number }
export interface AscendingRoundView { round: number; offeredCards: [number,number]; myCard: number; opponentCard: number; myPosition: number; opponentPosition: number; chooserId: string }
export interface AscendingView extends GameViewBase {
  kind: "ASCENDING";
  round: number;
  phase: "CHOOSE" | "PLACE";
  chooserId: string;
  offeredCards: [number,number];
  myAssignedCard: number | null;
  opponentAssignedCard: number | null;
  myBoard: Array<number | null>;
  opponentBoard: Array<number | null>;
  hasPlaced: boolean;
  opponentHasPlaced: boolean;
  history: AscendingRoundView[];
  results: Record<string, AscendingResult> | null;
}

export const SCORE_CATEGORIES = ["ONES", "TWOS", "THREES", "FOURS", "FIVES", "SIXES", "FULL_HOUSE", "SMALL_STRAIGHT", "LARGE_STRAIGHT", "FOUR_KIND", "FIVE_KIND", "JOKER"] as const;
export type ScoreCategory = (typeof SCORE_CATEGORIES)[number];
export type DicePhase = "KEEP" | "SECRET" | "SCORE";
export interface SecretDiceView extends GameViewBase {
  kind: "SECRET_DICE";
  turn: number;
  attackerId: string;
  phase: DicePhase;
  publicDice: number[];
  keptIndices: number[];
  requiredSecretCount: number;
  mySecretSelection: number[] | null;
  opponentHasSelected: boolean;
  finalDice: number[] | null;
  scoreSheets: Record<string, Partial<Record<ScoreCategory, number>>>;
  totals: Record<string, number>;
  threeKeepAvailable: Record<string, boolean>;
}

export type PokerActionName = "CALL" | "RAISE" | "FOLD" | "ALL_IN";
export interface PokerRoundView { round: number; winnerId: string | null; pot: number; myCard?: number; opponentCard?: number; folded: boolean }
export interface IndianPokerView extends GameViewBase {
  kind: "INDIAN_POKER";
  round: number;
  phase: "BETTING" | "ROUND_END";
  chips: Record<string, number>;
  pot: number;
  currentPlayerId: string;
  currentBet: number;
  playerBets: Record<string, number>;
  opponentCard: number | null;
  myCard: null;
  legalActions: PokerActionName[];
  maxRaiseTo: number;
  history: PokerRoundView[];
}

export type GameView = BlackAndWhiteView | AscendingView | SecretDiceView | IndianPokerView;
export interface RoomView {
  code: string;
  hostId: string;
  gameType: GameType;
  players: Player[];
  status: RoomStatus;
  gameState: GameView | null;
}

export interface Ack<T = undefined> { ok: boolean; data?: T; error?: string }
export interface CreateRoomPayload { nickname: string; gameType: GameType; playerId?: string }
export interface JoinRoomPayload { nickname: string; roomCode: string; playerId?: string }
export interface PlayerRoomPayload { roomCode: string; playerId: string }
export interface GameActionPayload extends PlayerRoomPayload { type: string; payload?: unknown }

export const GAME_INFO: Record<GameType, { name: string; description: string; duration: string; difficulty: string; available: boolean }> = {
  BLACK_AND_WHITE: { name: "흑과 백", description: "색으로 숫자를 추리하는 순차 심리전", duration: "5~10분", difficulty: "쉬움", available: true },
  ASCENDING: { name: "배틀 오름차순", description: "두 카드 중 하나를 고르고 비내림차순을 완성하세요", duration: "5~10분", difficulty: "보통", available: true },
  SECRET_DICE: { name: "시크릿 다이스", description: "공격과 수비가 함께 만드는 주사위 족보", duration: "15~25분", difficulty: "보통", available: true },
  INDIAN_POKER: { name: "인디언 포커", description: "상대 카드만 보고 벌이는 베팅", duration: "10~20분", difficulty: "어려움", available: true }
};
