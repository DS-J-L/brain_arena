// 벽바둑 판 규칙. 서버 엔진·연습 봇·화면·설명서가 같은 계산을 쓰도록 여기에 둔다.

export const WALL_GO_SIZE = 7;
export const WALL_GO_CELLS = WALL_GO_SIZE * WALL_GO_SIZE;
/** 한 번에 움직일 수 있는 최대 칸 수(0칸 이동 포함) */
export const WALL_GO_MAX_STEPS = 2;
export const WALL_SIDES = ["UP", "DOWN", "LEFT", "RIGHT"] as const;
export type WallSide = (typeof WALL_SIDES)[number];
export const WALL_SIDE_NAMES: Record<WallSide, string> = { UP: "위", DOWN: "아래", LEFT: "왼쪽", RIGHT: "오른쪽" };

export const wallGoCell = (row: number, col: number) => row * WALL_GO_SIZE + col;
export const wallGoRow = (cell: number) => Math.floor(cell / WALL_GO_SIZE);
export const wallGoCol = (cell: number) => cell % WALL_GO_SIZE;
/** 칸 이름. 열은 A~G, 행은 1~7 */
export const wallGoCellName = (cell: number) => `${"ABCDEFG"[wallGoCol(cell)]}${wallGoRow(cell) + 1}`;

/** 선공(0번 자리)과 후공(1번 자리)의 고정 시작 칸. 서로 대각선으로 마주 본다. */
export const WALL_GO_START_CELLS: [number[], number[]] = [[wallGoCell(1, 1), wallGoCell(5, 5)], [wallGoCell(1, 5), wallGoCell(5, 1)]];
/** 시작 칸 다음에 빈칸에 놓는 말의 순서(자리 번호): 선공 → 후공 → 후공 → 선공 */
export const WALL_GO_PLACE_ORDER = [0, 1, 1, 0];

export interface WallGoPiece { id: number; ownerId: string; cell: number }
/** 세워진 벽. 키는 wallKey(), 값은 세운 플레이어 */
export type WallGoWalls = Record<string, string>;
export interface WallGoMoveOption { pieceId: number; to: number; wall: WallSide }

const DELTA: Record<WallSide, [number, number]> = { UP: [-1, 0], DOWN: [1, 0], LEFT: [0, -1], RIGHT: [0, 1] };
const inBoard = (row: number, col: number) => row >= 0 && row < WALL_GO_SIZE && col >= 0 && col < WALL_GO_SIZE;
export const isWallGoCell = (cell: unknown): cell is number => Number.isInteger(cell) && (cell as number) >= 0 && (cell as number) < WALL_GO_CELLS;

/** 칸의 한 변을 가리키는 키. 판 바깥 테두리는 이미 벽이므로 null. h r-c = r행과 r+1행 사이, v r-c = c열과 c+1열 사이. */
export function wallKey(cell: number, side: WallSide): string | null {
  const row = wallGoRow(cell), col = wallGoCol(cell);
  switch (side) {
    case "UP": return row > 0 ? `h${row - 1}-${col}` : null;
    case "DOWN": return row < WALL_GO_SIZE - 1 ? `h${row}-${col}` : null;
    case "LEFT": return col > 0 ? `v${row}-${col - 1}` : null;
    case "RIGHT": return col < WALL_GO_SIZE - 1 ? `v${row}-${col}` : null;
  }
}

/** 벽이 없다면 건너갈 수 있는 이웃 칸. 테두리나 벽에 막히면 null. */
export function wallGoStep(walls: WallGoWalls, cell: number, side: WallSide): number | null {
  const key = wallKey(cell, side);
  if (key === null || key in walls) return null;
  const [dr, dc] = DELTA[side], row = wallGoRow(cell) + dr, col = wallGoCol(cell) + dc;
  return inBoard(row, col) ? wallGoCell(row, col) : null;
}

/** 이 칸에서 벽을 세울 수 있는 변: 테두리가 아니고 아직 벽이 없는 곳 */
export const openWallSides = (walls: WallGoWalls, cell: number) => WALL_SIDES.filter(side => { const key = wallKey(cell, side); return key !== null && !(key in walls); });

/** 말이 멈출 수 있는 칸(제자리 포함). 상하좌우로 최대 2칸, 꺾어도 되지만 벽을 넘거나 다른 말을 지나거나 그 위에 멈출 수 없다. */
export function wallGoReachable(walls: WallGoWalls, pieces: WallGoPiece[], pieceId: number): number[] {
  const piece = pieces.find(p => p.id === pieceId);
  if (!piece) return [];
  const occupied = new Set(pieces.filter(p => p.id !== pieceId).map(p => p.cell));
  const seen = new Set([piece.cell]);
  let frontier = [piece.cell];
  for (let step = 0; step < WALL_GO_MAX_STEPS; step++) {
    const next: number[] = [];
    for (const cell of frontier) for (const side of WALL_SIDES) {
      const to = wallGoStep(walls, cell, side);
      if (to === null || occupied.has(to) || seen.has(to)) continue;
      seen.add(to);
      next.push(to);
    }
    frontier = next;
  }
  return [...seen].sort((a, b) => a - b);
}

/** 한 플레이어가 지금 할 수 있는 모든 (말, 도착 칸, 벽) 조합 */
export function wallGoMoves(walls: WallGoWalls, pieces: WallGoPiece[], playerId: string): WallGoMoveOption[] {
  return pieces.filter(p => p.ownerId === playerId).flatMap(piece =>
    wallGoReachable(walls, pieces, piece.id).flatMap(to => openWallSides(walls, to).map(wall => ({ pieceId: piece.id, to, wall }))));
}

export interface WallGoRegion { cells: number[]; ownerIds: string[] }
/** 벽으로 나뉜 구역과 그 안에 말이 있는 플레이어들 */
export function wallGoRegions(walls: WallGoWalls, pieces: WallGoPiece[]): WallGoRegion[] {
  const regionOf = new Array<number>(WALL_GO_CELLS).fill(-1), regions: WallGoRegion[] = [];
  for (let start = 0; start < WALL_GO_CELLS; start++) {
    if (regionOf[start] >= 0) continue;
    const cells = [start];
    regionOf[start] = regions.length;
    for (let index = 0; index < cells.length; index++) for (const side of WALL_SIDES) {
      const to = wallGoStep(walls, cells[index], side);
      if (to !== null && regionOf[to] < 0) { regionOf[to] = regions.length; cells.push(to); }
    }
    const inside = new Set(cells);
    regions.push({ cells: cells.sort((a, b) => a - b), ownerIds: [...new Set(pieces.filter(p => inside.has(p.cell)).map(p => p.ownerId))] });
  }
  return regions;
}

export interface WallGoScore {
  /** 내 말만 있는 구역의 칸 수 합 */
  territory: Record<string, number>;
  /** 그중 가장 큰 단일 구역. 동점일 때 비교한다. */
  largest: Record<string, number>;
  /** 어느 구역에도 두 사람의 말이 함께 있지 않으면 true: 게임 종료 */
  separated: boolean;
  /** 아직 여러 사람의 말이 함께 있는 칸 수 */
  contested: number;
}
export function wallGoScore(walls: WallGoWalls, pieces: WallGoPiece[], playerIds: string[]): WallGoScore {
  const territory = Object.fromEntries(playerIds.map(id => [id, 0])), largest = Object.fromEntries(playerIds.map(id => [id, 0]));
  let contested = 0;
  for (const region of wallGoRegions(walls, pieces)) {
    if (region.ownerIds.length > 1) { contested += region.cells.length; continue; }
    const [owner] = region.ownerIds;
    if (owner === undefined || !(owner in territory)) continue;
    territory[owner] += region.cells.length;
    largest[owner] = Math.max(largest[owner], region.cells.length);
  }
  return { territory, largest, separated: contested === 0, contested };
}
