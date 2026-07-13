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

export interface RoundView {
  round: number;
  myTile: number;
  opponentColor: "BLACK" | "WHITE";
  result: "WIN" | "LOSE" | "DRAW";
  opponentTile?: number;
}

export interface BlackAndWhiteView {
  kind: "BLACK_AND_WHITE";
  round: number;
  scores: Record<string, number>;
  myRemainingTiles: number[];
  opponentRemainingCount: number;
  opponentUsedColors: Array<"BLACK" | "WHITE">;
  hasSelected: boolean;
  opponentHasSelected: boolean;
  history: RoundView[];
  winnerId: string | null;
  deadline: number | null;
}

export interface RoomView {
  code: string;
  hostId: string;
  gameType: GameType;
  players: Player[];
  status: RoomStatus;
  gameState: BlackAndWhiteView | null;
}

export interface Ack<T = undefined> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface CreateRoomPayload { nickname: string; gameType: GameType; playerId?: string }
export interface JoinRoomPayload { nickname: string; roomCode: string; playerId?: string }
export interface PlayerRoomPayload { roomCode: string; playerId: string }
export interface GameActionPayload extends PlayerRoomPayload { type: string; payload?: unknown }

export const GAME_INFO: Record<GameType, { name: string; description: string; duration: string; difficulty: string; available: boolean }> = {
  BLACK_AND_WHITE: { name: "흑과 백", description: "숫자의 색만 공개되는 심리전", duration: "약 10분", difficulty: "쉬움", available: true },
  ASCENDING: { name: "오름차순", description: "같은 숫자를 전략적으로 배치하세요", duration: "약 15분", difficulty: "보통", available: false },
  SECRET_DICE: { name: "시크릿 다이스", description: "감춰진 주사위로 만드는 족보", duration: "약 20분", difficulty: "보통", available: false },
  INDIAN_POKER: { name: "인디언 포커", description: "상대 카드만 보고 벌이는 베팅", duration: "약 20분", difficulty: "어려움", available: false }
};
