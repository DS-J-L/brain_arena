export const GAME_TYPES = ["BLACK_AND_WHITE", "ASCENDING", "SECRET_DICE", "INDIAN_POKER", "FIND_THE_NUMBER", "GYEOL_HAP_1", "GYEOL_HAP", "MEMORY_HOLDEM", "ATLAS"] as const;
export type GameType = (typeof GAME_TYPES)[number];
export type RoomStatus = "WAITING" | "PLAYING" | "FINISHED";

export interface Player {
  id: string;
  nickname: string;
  isReady: boolean;
  isConnected: boolean;
  isHost: boolean;
  isBot: boolean;
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
  phase: "SELECT" | "ROUND_RESULT";
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
export interface AscendingRoundView { round: number; offeredCards: [number,number]; myCard: number; opponentCard?: number; myPosition: number; opponentPosition?: number; chooserId: string }
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
/** 공격자가 고정한 주사위 수에 따라 각자 비공개로 내는 숫자 개수. 최종 주사위는 항상 5개가 된다. */
export const secretDiceCount = (kept: number, attacker: boolean) => kept === 1 ? 2 : kept === 2 ? (attacker ? 1 : 2) : 1;
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
export interface PokerRoundView { round: number; winnerId: string | null; pot: number; myCard?: number; opponentCard?: number; folded: boolean; foldedPlayerId?: string; foldPenalty?: number }
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

export type NumberOperator = "+" | "-" | "×" | "÷";
export type NumberCardValue = number | NumberOperator;
export type FindNumberPhase = "MEMORIZE" | "BUZZER" | "ANSWER_FIRST" | "ANSWER_SECOND" | "SOLO_ANSWER" | "REVEAL" | "SOLUTION";
export interface FindNumberRevealView { playerId: string | null; indices: number[]; values: NumberCardValue[]; expression: string; correct: boolean; target: number; reason: "ANSWER" | "NO_BUZZ" }
export interface FindNumberHistoryView { round: number; target: number; playerId: string | null; expression: string; correct: boolean }
export interface FindTheNumberView extends GameViewBase {
  kind: "FIND_THE_NUMBER";
  phase: FindNumberPhase;
  playerIds: string[];
  targetScore: number;
  /** 이번 목표 숫자에서 이미 오답을 내 부저를 누를 수 없는 플레이어 */
  lockedOutIds: string[];
  round: number;
  scores: Record<string, number>;
  target: number | null;
  answererId: string | null;
  board: Array<NumberCardValue | null>;
  reveal: FindNumberRevealView | null;
  history: FindNumberHistoryView[];
  practiceSolo: boolean;
  mistakes: number;
  maxMistakes: number;
}

export const HAP_SHAPES = ["CIRCLE", "STAR", "TRIANGLE", "SQUARE", "SUN"] as const;
export const HAP_COLORS = ["PURPLE", "GREEN", "ORANGE", "YELLOW"] as const;
export const HAP_BACKGROUNDS = ["BLACK", "GRAY", "WHITE"] as const;
export interface HapTile {
  shape: (typeof HAP_SHAPES)[number];
  shapeColor: (typeof HAP_COLORS)[number];
  backgroundColor: (typeof HAP_BACKGROUNDS)[number];
}
export type HapGameType = "GYEOL_HAP_1" | "GYEOL_HAP";
export const HAP_ROUNDS = 3;
export const HAP_STALL_TURNS = 4;
/** 인원이 늘면 모두가 한 번씩 선공하도록 라운드를 늘린다. */
export const hapRounds = (players: number) => Math.max(HAP_ROUNDS, players);
/** 인원이 늘어도 각자 두 번의 기회를 갖도록 정체 판정 턴을 늘린다. */
export const hapStallTurns = (players: number) => Math.max(HAP_STALL_TURNS, players * 2);
export const HAP_MODES = {
  GYEOL_HAP_1: { shapes: HAP_SHAPES.slice(0, 3), colors: HAP_COLORS.slice(0, 3), backgrounds: HAP_BACKGROUNDS },
  GYEOL_HAP: { shapes: HAP_SHAPES, colors: HAP_COLORS, backgrounds: HAP_BACKGROUNDS },
} as const;
export type HapAttribute = keyof HapTile;
export type HapCheck = Record<HapAttribute, "SAME" | "DIFFERENT" | "TWO_SAME">;
export interface FoundHap { numbers: number[]; playerId: string }
export interface HapAttempt {
  playerId: string;
  reason: "NEW_HAP" | "NOT_HAP" | "DUPLICATE" | "GYEOL" | "WRONG_GYEOL" | "PASS" | "TIMEOUT";
  numbers: number[];
  delta: number;
  checks: HapCheck | null;
}
export interface HapRoundReview {
  round: number;
  board: HapTile[];
  foundHaps: FoundHap[];
  missedHaps: Array<{ numbers: number[]; checks: HapCheck }>;
  attempts: HapAttempt[];
  endReason: "GYEOL" | "STALLED" | "FORFEIT";
}
export interface GyeolHapView extends GameViewBase {
  kind: HapGameType;
  phase: "TURN" | "SELECT" | "RESULT" | "ROUND_END";
  /** 차례 순서 */
  playerIds: string[];
  totalRounds: number;
  stallTurns: number;
  round: number;
  turnId: number;
  currentPlayerId: string;
  board: HapTile[];
  scores: Record<string, number>;
  foundHaps: FoundHap[];
  unsuccessfulTurns: number;
  lastResult: HapAttempt | null;
  history: HapRoundReview[];
}

export type CardSuit = "S" | "H" | "D" | "C";
/** rank: 2~14 (J=11, Q=12, K=13, A=14) */
export interface PlayingCard { rank: number; suit: CardSuit }
export type HoldemRole = "FIRST" | "SECOND";
export const HOLDEM_TARGET_WINS = 3;
export const cardRankName = (rank: number) => rank === 14 ? "A" : rank === 13 ? "K" : rank === 12 ? "Q" : rank === 11 ? "J" : String(rank);
export const cardText = (card: PlayingCard) => `${cardRankName(card.rank)}${{ S: "♠", H: "♥", D: "♦", C: "♣" }[card.suit]}`;
export interface HoldemSeatReview { indices: number[]; cards: PlayingCard[]; label: string }
export interface HoldemHandReview {
  hand: number;
  board: PlayingCard[];
  community: PlayingCard[];
  firstPlayerId: string;
  seats: Record<string, HoldemSeatReview>;
  winnerId: string | null;
  reason: string;
}
export interface MemoryHoldemView extends GameViewBase {
  kind: "MEMORY_HOLDEM";
  phase: "COIN" | "MEMORIZE" | "PICK" | "SHOWDOWN";
  hand: number;
  wins: Record<string, number>;
  targetWins: number;
  chooserId: string;
  firstPlayerId: string | null;
  currentPlayerId: string | null;
  /** 1~4: 이번 판에서 지금 확정할 선택 순번 */
  pickNumber: number;
  board: Array<PlayingCard | null>;
  owners: Array<string | null>;
  community: PlayingCard[];
  showdown: HoldemHandReview | null;
  history: HoldemHandReview[];
}

export const ATLAS_COLORS = ["RED", "GREEN", "BLUE"] as const;
export type AtlasColor = (typeof ATLAS_COLORS)[number];
/** 무지개 토큰은 블록을 올릴 차례에 아무 거인이나 고를 수 있다. */
export const ATLAS_TOKENS = [...ATLAS_COLORS, "RAINBOW"] as const;
export type AtlasToken = (typeof ATLAS_TOKENS)[number];
export const ATLAS_COLOR_NAMES: Record<AtlasToken, string> = { RED: "빨강", GREEN: "초록", BLUE: "파랑", RAINBOW: "무지개" };
export const ATLAS_ROUNDS = 14;
/** 블록은 0부터 이 숫자까지 하나씩(0~6, 7개) */
export const ATLAS_MAX_NUMBER = 6;
/** 이 라운드가 시작될 때 블록과 토큰을 새로 받는다. 블록 7개·토큰 7개로 7라운드를 두 번 치른다. */
export const ATLAS_REFILL_ROUND = 8;
/** 거인이 버티는 합의 한계. 합이 이 값을 넘으면 무너진다: 2인 8 이상, 3인 10 이상, 4인 12 이상. */
export const atlasLimit = (players: number) => players >= 4 ? 11 : players === 3 ? 9 : 7;
export interface AtlasHand { numbers: number[]; tokens: Record<AtlasToken, number> }
export interface AtlasSubmission { playerId: string; number: number; token: AtlasToken }
export interface AtlasPlacement {
  playerId: string;
  number: number;
  token: AtlasToken;
  /** 실제로 올린 거인 */
  color: AtlasColor;
  /** 이번 라운드에서 놓인 순서(1부터) */
  order: number;
  /** 블록을 올린 직후 거인이 든 블록. 무너졌다면 무너지기 직전 모습이다. */
  blocks: number[];
  total: number;
  collapsed: boolean;
  penalty: number;
  /** 제한 시간이 지나 자동으로 처리되었는지 */
  auto: boolean;
}
export interface AtlasRoundReview { round: number; leadPlayerId: string; submissions: AtlasSubmission[]; passedIds: string[]; placements: AtlasPlacement[] }
export interface AtlasView extends GameViewBase {
  kind: "ATLAS";
  /** SUBMIT: 비공개 제출 · PLACE: 공개 후 차례대로 올리기(패스·무지개 선택) · RESULT: 라운드 결과 */
  phase: "SUBMIT" | "PLACE" | "RESULT";
  playerIds: string[];
  round: number;
  totalRounds: number;
  limit: number;
  maxNumber: number;
  refillRound: number;
  /** 선 플레이어. 같은 숫자끼리는 선부터 오른쪽 순서로 올린다. 블록을 먹은 사람이 다음 선이 된다. */
  leadPlayerId: string;
  giants: Record<AtlasColor, number[]>;
  /** 내 남은 블록과 토큰. 다른 사람의 손은 알 수 없다. */
  myHand: AtlasHand;
  /** 벌점. 낮을수록 좋다. */
  scores: Record<string, number>;
  submittedIds: string[];
  mySubmission: { number: number; token: AtlasToken } | null;
  /** 공개된 이번 라운드 제출. SUBMIT 단계에서는 null */
  submissions: AtlasSubmission[] | null;
  /** 아직 올리지 않은 플레이어. 앞에서부터 올린다. */
  queue: string[];
  currentPlacerId: string | null;
  canPass: boolean;
  needsColor: boolean;
  passedIds: string[];
  placements: AtlasPlacement[];
  /** 지난 라운드 기록. 게임이 끝난 뒤에만 공개한다. */
  history: AtlasRoundReview[];
}

export type GameView = BlackAndWhiteView | AscendingView | SecretDiceView | IndianPokerView | FindTheNumberView | GyeolHapView | MemoryHoldemView | AtlasView;
export interface RoomView {
  code: string;
  hostId: string;
  gameType: GameType;
  players: Player[];
  status: RoomStatus;
  gameState: GameView | null;
  isPractice: boolean;
  /** 게임 도중 나간 플레이어의 닉네임. 기록과 순위에 이름을 남기기 위해 쓴다. */
  departedNames: Record<string, string>;
}

export interface Ack<T = undefined> { ok: boolean; data?: T; error?: string }
export interface CreateRoomPayload { nickname: string; gameType: GameType; playerId?: string }
export interface CreatePracticePayload { nickname: string; gameType: GameType; playerId?: string }
export interface JoinRoomPayload { nickname: string; roomCode: string; playerId?: string }
export interface PlayerRoomPayload { roomCode: string; playerId: string }
export interface GameActionPayload extends PlayerRoomPayload { type: string; payload?: unknown }

export const findNumberTargetScore = (players: number) => players > 2 ? 5 : 6;
export const MIN_PLAYERS = 2;
export const GAME_INFO: Record<GameType, { name: string; description: string; duration: string; difficulty: string; available: boolean; maxPlayers: number }> = {
  BLACK_AND_WHITE: { name: "흑과 백", description: "색으로 숫자를 추리하는 순차 심리전", duration: "5~10분", difficulty: "쉬움", available: true, maxPlayers: 2 },
  ASCENDING: { name: "배틀 오름차순", description: "두 카드 중 하나를 고르고 가장 긴 오름차순을 완성하세요", duration: "5~10분", difficulty: "보통", available: true, maxPlayers: 2 },
  SECRET_DICE: { name: "시크릿 다이스", description: "공격과 수비가 함께 만드는 주사위 족보", duration: "15~25분", difficulty: "보통", available: true, maxPlayers: 2 },
  INDIAN_POKER: { name: "인디언 포커", description: "상대 카드만 보고 벌이는 베팅", duration: "10~20분", difficulty: "어려움", available: true, maxPlayers: 2 },
  FIND_THE_NUMBER: { name: "숫자를 찾아라", description: "카드 위치를 기억하고 목표 숫자의 수식을 먼저 완성하세요", duration: "5~15분", difficulty: "보통", available: true, maxPlayers: 4 },
  GYEOL_HAP_1: { name: "결! 합! 1", description: "모양·도형 색·배경 색 각 3종으로 합을 찾는 3라운드 대결", duration: "3~10분", difficulty: "쉬움", available: true, maxPlayers: 4 },
  GYEOL_HAP: { name: "결! 합! 2", description: "모양 5종·도형 색 4종·배경 색 3종의 확장 합 찾기", duration: "3~10분", difficulty: "보통", available: true, maxPlayers: 4 },
  MEMORY_HOLDEM: { name: "메모리 홀덤", description: "카드 위치를 기억해 두 장으로 족보를 겨루는 5판 3선승 대결", duration: "5~10분", difficulty: "보통", available: true, maxPlayers: 2 },
  ATLAS: { name: "아틀라스의 형벌", description: "세 거인 위에 숫자 블록을 쌓되, 한계를 넘겨 무너뜨리면 블록 수만큼 벌점", duration: "10~15분", difficulty: "보통", available: true, maxPlayers: 4 }
};
