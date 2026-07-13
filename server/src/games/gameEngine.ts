export interface GameResult { winnerId: string | null; isDraw: boolean }

export interface GameEngine<State, Action, View> {
  createInitialState(playerIds: string[]): State;
  validateAction(state: State, playerId: string, action: Action): boolean;
  applyAction(state: State, playerId: string, action: Action): State;
  getPlayerView(state: State, playerId: string): View;
  getResult(state: State): GameResult | null;
}
