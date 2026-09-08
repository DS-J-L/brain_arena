# 1대1 두뇌게임 모음 웹사이트 개발 계획

## 1. 프로젝트 개요

피의 게임과 더 지니어스에 등장한 게임에서 아이디어를 얻어, 친구와 실시간으로 즐길 수 있는 **1대1 두뇌게임 웹사이트**를 개발한다.

첫 번째 버전에서는 다음 네 가지 게임을 제공한다.

* 인디언 포커
* 흑과 백
* 오름차순 게임
* 시크릿 다이스

사용자는 회원가입 없이 닉네임을 입력하고 방을 만들거나, 친구가 전달한 방 코드로 입장할 수 있다.

방 하나에는 최대 두 명만 참여할 수 있다.

---

## 2. 프로젝트 목표

### 핵심 목표

* 친구와 링크 또는 방 코드로 쉽게 1대1 대전을 시작할 수 있어야 한다.
* 게임에 필요한 카드, 숫자, 주사위 결과는 서버에서 관리한다.
* 상대방에게 공개하면 안 되는 정보는 프론트엔드로 전송하지 않는다.
* 모바일과 PC 환경에서 모두 플레이할 수 있어야 한다.
* 하나의 공통 방 시스템으로 여러 게임을 실행할 수 있어야 한다.

### MVP에서 제외할 기능

첫 번째 버전에서는 다음 기능을 구현하지 않는다.

* 회원가입
* 친구 목록
* 공개 매칭
* 랭킹
* 관전
* 게임 리플레이
* 채팅
* 서버 여러 대 운영
* Redis
* 유료 결제

---

## 3. 기술 스택

### Frontend

* React
* TypeScript
* Vite
* React Router
* Socket.IO Client
* CSS Modules 또는 Tailwind CSS
* Vercel 배포

### Backend

* Node.js
* TypeScript
* Express
* Socket.IO
* Render Free 배포

### 데이터 저장

초기 버전에서는 데이터베이스를 사용하지 않는다.

진행 중인 방과 게임 상태는 서버 메모리에 저장한다.

```ts
const rooms = new Map<string, GameRoom>();
```

서버가 재시작되면 진행 중이던 게임은 종료된다.

---

## 4. 서비스 이용 흐름

```text
메인 화면
→ 닉네임 입력
→ 게임 선택
→ 방 만들기 또는 방 참가
→ 상대방 입장 대기
→ 두 플레이어 준비
→ 게임 시작
→ 게임 결과 확인
→ 다시 하기 또는 나가기
```

### 방 만들기

1. 사용자가 닉네임을 입력한다.
2. 플레이할 게임을 선택한다.
3. 서버가 6자리 방 코드를 생성한다.
4. 사용자는 방 코드를 친구에게 전달한다.
5. 두 번째 사용자가 방 코드로 입장한다.
6. 두 명이 모두 준비하면 게임을 시작한다.

### 방 참가

1. 사용자가 닉네임을 입력한다.
2. 전달받은 6자리 방 코드를 입력한다.
3. 서버가 방 존재 여부를 확인한다.
4. 방에 이미 두 명이 있다면 입장을 차단한다.
5. 정상 입장하면 대기실로 이동한다.

---

## 5. 화면 구성

## 5.1 메인 화면

표시 항목:

* 서비스 로고
* 닉네임 입력
* 방 만들기 버튼
* 방 참가 버튼
* 게임 목록
* 게임 규칙 보기

## 5.2 게임 선택 화면

게임 카드 네 개를 보여준다.

각 카드에는 다음 내용을 표시한다.

* 게임 이름
* 간단한 설명
* 예상 플레이 시간
* 난이도
* 게임 시작 버튼

## 5.3 대기실

표시 항목:

* 방 코드
* 초대 링크 복사
* 선택한 게임
* 참가자 목록
* 준비 버튼
* 방 나가기

방장은 게임을 변경하거나 방을 닫을 수 있다.

## 5.4 게임 화면

공통 요소:

* 내 닉네임
* 상대방 닉네임
* 현재 라운드
* 제한시간
* 게임 진행 상황
* 나가기 버튼
* 규칙 보기 버튼

## 5.5 결과 화면

표시 항목:

* 승자
* 최종 점수
* 라운드별 결과
* 다시 하기
* 다른 게임 선택
* 메인으로 이동

---

## 6. 공통 게임 방 구조

```ts
type GameType =
  | "INDIAN_POKER"
  | "BLACK_AND_WHITE"
  | "ASCENDING"
  | "SECRET_DICE";

type RoomStatus =
  | "WAITING"
  | "READY"
  | "PLAYING"
  | "FINISHED";

interface Player {
  id: string;
  socketId: string;
  nickname: string;
  isReady: boolean;
  isConnected: boolean;
}

interface GameRoom {
  code: string;
  hostId: string;
  gameType: GameType;
  players: Player[];
  status: RoomStatus;
  gameState: unknown;
  createdAt: number;
}
```

### 방 생성 규칙

* 방 코드는 숫자와 영문 대문자를 조합한 6자리로 생성한다.
* 같은 방 코드가 존재하면 다시 생성한다.
* 방에는 최대 두 명만 입장할 수 있다.
* 방장이 나가면 상대방에게 알리고 방을 종료한다.
* 게임 종료 후 일정 시간이 지나면 방을 삭제한다.

---

## 7. Socket.IO 이벤트 설계

## 7.1 공통 이벤트

### 클라이언트 → 서버

```text
room:create
room:join
room:leave
room:ready
room:restart
game:action
player:reconnect
```

### 서버 → 클라이언트

```text
room:created
room:joined
room:updated
room:error
game:started
game:updated
game:finished
player:disconnected
player:reconnected
```

## 7.2 게임 행동 이벤트

모든 게임은 `game:action` 이벤트를 사용한다.

```ts
interface GameAction {
  roomCode: string;
  playerId: string;
  type: string;
  payload: unknown;
}
```

예시:

```ts
{
  roomCode: "A3F9K2",
  playerId: "player-1",
  type: "SELECT_TILE",
  payload: {
    tile: 7
  }
}
```

서버는 행동의 유효성을 검사한 뒤 게임 상태를 갱신한다.

---

## 8. 게임별 개발 계획

# 8.1 흑과 백

## 핵심 규칙

* 각 플레이어는 1부터 9까지의 숫자 타일을 가진다.
* 각 숫자는 한 번만 사용할 수 있다.
* 홀수와 짝수는 서로 다른 색으로 표시한다.
* 두 플레이어가 숫자 타일을 한 장씩 비공개로 제출한다.
* 높은 숫자를 제출한 플레이어가 라운드에서 승리한다.
* 먼저 5승을 얻은 플레이어가 게임에서 승리한다.
* 게임이 끝난 뒤 제출했던 숫자를 모두 공개한다.

## 플레이어에게 공개되는 정보

* 내가 보유한 숫자
* 상대방이 사용한 타일의 색상
* 라운드 승패
* 현재 점수
* 남은 타일 수

## 공개하지 않는 정보

* 상대방이 제출한 실제 숫자
* 상대방이 보유한 숫자 목록

## 게임 상태

```ts
interface BlackAndWhiteState {
  round: number;
  scores: Record<string, number>;
  remainingTiles: Record<string, number[]>;
  selections: Record<string, number | null>;
  history: BlackAndWhiteRound[];
  winnerId: string | null;
}
```

## 개발 난이도

낮음

## 우선순위

첫 번째로 개발한다.

흑과 백을 통해 방 생성, 동시 선택, 라운드 처리, 승패 판정 구조를 완성한다.

---

# 8.2 오름차순 게임

## 핵심 규칙

* 두 플레이어는 같은 순서의 숫자 카드를 받는다.
* 보드에는 일정 개수의 빈칸이 있다.
* 매 라운드 공개된 숫자를 빈칸 하나에 배치한다.
* 한 번 배치한 숫자는 이동할 수 없다.
* 모든 숫자를 배치하면 가장 긴 연속 오름차순 구간을 계산한다.
* 더 긴 오름차순 구간을 만든 플레이어가 승리한다.

## 예시

```text
2 | 5 | 8 | 3 | 4 | 7 | 9
```

가장 긴 연속 오름차순 구간:

```text
3 → 4 → 7 → 9
```

길이:

```text
4
```

## 동점 처리

1. 가장 긴 오름차순 길이
2. 오름차순 구간에 포함된 숫자의 합
3. 전체 오름차순 구간 개수
4. 모든 조건이 같으면 무승부

## 공정성

두 플레이어에게 반드시 같은 숫자 순서를 제공한다.

서버는 게임을 시작할 때 랜덤 시드를 생성하고 숫자 순서를 결정한다.

## 게임 상태

```ts
interface AscendingState {
  currentRound: number;
  numberSequence: number[];
  boards: Record<string, Array<number | null>>;
  currentNumber: number | null;
  placements: Record<string, number | null>;
  results: Record<string, AscendingResult> | null;
  winnerId: string | null;
}
```

## 개발 난이도

낮음에서 중간

## 우선순위

두 번째로 개발한다.

---

# 8.3 시크릿 다이스

## 핵심 규칙

* 각 플레이어는 자신의 턴에 주사위 5개를 굴린다.
* 한 턴에 최대 세 번까지 굴릴 수 있다.
* 플레이어는 원하는 주사위를 잠글 수 있다.
* 마지막에는 점수 항목 하나를 선택한다.
* 사용한 점수 항목은 다시 사용할 수 없다.
* 모든 점수 항목을 사용한 뒤 총점이 높은 플레이어가 승리한다.

## 기본 점수 항목

* Ones
* Twos
* Threes
* Fours
* Fives
* Sixes
* Choice
* Four of a Kind
* Full House
* Small Straight
* Large Straight
* Five of a Kind

## 시크릿 요소

MVP에서는 상대방에게 다음 정보만 공개한다.

* 상대방의 현재 총점
* 사용한 점수 항목
* 턴 종료 여부

상대방이 굴린 주사위와 잠근 주사위는 턴이 끝날 때까지 숨긴다.

## 주사위 생성

주사위 결과는 서버에서 생성한다.

```ts
function rollDice(): number {
  return Math.floor(Math.random() * 6) + 1;
}
```

클라이언트가 주사위 결과를 직접 생성하지 않는다.

## 게임 상태

```ts
interface SecretDiceState {
  currentPlayerId: string;
  turnNumber: number;
  rollsLeft: number;
  dice: Record<string, number[]>;
  lockedDice: Record<string, boolean[]>;
  scoreSheets: Record<string, ScoreSheet>;
  winnerId: string | null;
}
```

## 개발 난이도

중간

## 우선순위

세 번째로 개발한다.

---

# 8.4 인디언 포커

## 핵심 규칙

* 1부터 10까지의 카드가 각각 두 장씩 존재한다.
* 각 플레이어는 자신의 카드를 볼 수 없다.
* 상대방의 카드만 확인할 수 있다.
* 두 플레이어는 칩을 걸고 베팅한다.
* 높은 숫자의 카드를 가진 플레이어가 판돈을 가져간다.
* 한 플레이어의 칩이 0개가 되면 게임이 끝난다.

## 기본 행동

* 체크
* 콜
* 레이즈
* 폴드
* 올인

## 카드 공개 정책

내 화면:

```ts
{
  myCard: null,
  opponentCard: 8
}
```

상대방 화면:

```ts
{
  myCard: null,
  opponentCard: 3
}
```

서버는 각 플레이어에게 서로 다른 정보를 전송한다.

## 게임 상태

```ts
type BettingPhase =
  | "ANTE"
  | "DEAL"
  | "BETTING"
  | "SHOWDOWN"
  | "ROUND_END"
  | "GAME_END";

interface IndianPokerState {
  phase: BettingPhase;
  deck: number[];
  cards: Record<string, number>;
  chips: Record<string, number>;
  pot: number;
  currentPlayerId: string;
  currentBet: number;
  playerBets: Record<string, number>;
  foldedPlayerId: string | null;
  round: number;
  history: IndianPokerRound[];
  winnerId: string | null;
}
```

## 구현 시 주의할 점

* 자신의 카드를 브라우저에 전달하지 않는다.
* 베팅 가능한 금액을 서버가 검증한다.
* 상대방이 레이즈한 뒤에는 콜, 레이즈, 폴드만 허용한다.
* 동점일 때 판돈 처리 규칙을 미리 정한다.
* 올인 상황에서 추가 행동을 제한한다.
* 플레이어가 연결을 끊었을 때 베팅 상태를 보존한다.

## 개발 난이도

높음

## 우선순위

마지막으로 개발한다.

---

## 9. 게임 엔진 공통 인터페이스

각 게임의 서버 로직은 같은 인터페이스를 사용한다.

```ts
interface GameEngine<State, Action> {
  createInitialState(playerIds: string[]): State;

  validateAction(
    state: State,
    playerId: string,
    action: Action
  ): boolean;

  applyAction(
    state: State,
    playerId: string,
    action: Action
  ): State;

  getPlayerView(
    state: State,
    playerId: string
  ): unknown;

  getResult(
    state: State
  ): GameResult | null;
}
```

게임별 로직은 `getPlayerView()`에서 플레이어에게 공개할 정보만 반환한다.

---

## 10. 폴더 구조

```text
project/
├─ apps/
│  ├─ web/
│  │  └─ src/
│  │     ├─ components/
│  │     ├─ pages/
│  │     └─ socket/
│  └─ server/
│     └─ src/
│        ├─ bots/
│        ├─ config/
│        ├─ games/
│        ├─ rooms/
│        └─ socket/
├─ packages/
│  └─ shared/
│     └─ src/
│        ├─ events.ts
│        ├─ index.ts
│        └─ types.ts
├─ docs/
│  ├─ audits/
│  └─ rules/
└─ README.md
```

---

## 11. 재접속 처리

Socket.IO 연결이 잠시 끊길 수 있으므로 플레이어 ID와 방 코드를 브라우저에 저장한다.

```ts
localStorage.setItem("playerId", playerId);
localStorage.setItem("roomCode", roomCode);
```

연결이 복구되면 다음 정보를 서버로 보낸다.

```ts
socket.emit("player:reconnect", {
  playerId,
  roomCode
});
```

### 재접속 규칙

* 연결이 끊기면 게임을 즉시 종료하지 않는다.
* 상대방 화면에 연결 끊김 상태를 표시한다.
* 30초 동안 재접속을 기다린다.
* 시간 안에 돌아오면 게임을 이어간다.
* 돌아오지 않으면 남은 플레이어가 승리한다.

---

## 12. 제한시간

각 행동에는 제한시간을 설정한다.

| 게임      | 권장 제한시간 |
| ------- | ------: |
| 흑과 백    |     40초 |
| 오름차순    |     40초 |
| 시크릿 다이스 |     50초 |
| 인디언 포커  |     50초 |

시간이 끝났을 때 처리:

* 흑과 백: 남은 타일 중 무작위 제출
* 오름차순: 가능한 빈칸 중 무작위 배치
* 시크릿 다이스: 현재 주사위로 자동 점수 선택
* 인디언 포커: 체크 가능 시 체크, 불가능하면 폴드

자동 행동 규칙은 게임 시작 전에 사용자에게 알린다.

---

## 13. 서버 보안 원칙

### 서버에서 처리할 항목

* 카드 섞기
* 숫자 생성
* 주사위 굴리기
* 게임 행동 검증
* 턴 확인
* 점수 계산
* 승패 판정
* 제한시간
* 비공개 정보 관리

### 클라이언트에서 처리할 항목

* 화면 표시
* 버튼 입력
* 애니메이션
* 효과음
* 서버에서 받은 정보 렌더링

클라이언트가 보낸 점수나 게임 결과를 신뢰하지 않는다.

---

## 14. Render와 Vercel 배포

## Backend: Render

환경변수:

```env
CLIENT_URL=https://프로젝트명.vercel.app
NODE_ENV=production
```

서버 실행:

```ts
const port = Number(process.env.PORT ?? 3000);

httpServer.listen(port, "0.0.0.0", () => {
  console.log(`Server running on ${port}`);
});
```

상태 확인 API:

```ts
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: Date.now()
  });
});
```

## Frontend: Vercel

환경변수:

```env
VITE_SERVER_URL=https://프로젝트명.onrender.com
```

첫 접속 시 서버 상태를 확인한다.

```ts
await fetch(
  `${import.meta.env.VITE_SERVER_URL}/health`
);

socket.connect();
```

Render 서버가 준비될 때까지 다음 화면을 표시한다.

```text
게임 서버를 준비하고 있습니다.
연결되면 자동으로 시작합니다.
```

---

## 15. 개발 단계

# Phase 1. 프로젝트 기본 설정

* React와 Vite 프로젝트 생성
* Express와 Socket.IO 서버 생성
* TypeScript 설정
* 공통 타입 작성
* 클라이언트와 서버 Socket.IO 연결
* `/health` API 구현

완료 조건:

* 브라우저에서 서버 연결 상태를 확인할 수 있다.
* 연결과 해제 로그가 서버에 출력된다.

---

# Phase 2. 방 시스템

* 닉네임 입력
* 방 생성
* 6자리 방 코드 발급
* 방 코드 참가
* 최대 두 명 제한
* 준비 상태
* 방 나가기
* 방 삭제
* 초대 링크 복사

완료 조건:

* 서로 다른 브라우저 두 개로 같은 방에 입장할 수 있다.
* 두 명이 준비하면 게임 시작 이벤트가 발생한다.

---

# Phase 3. 흑과 백

* 숫자 타일 UI
* 타일 선택
* 동시 제출
* 라운드 승패 판정
* 점수 표시
* 게임 종료
* 결과 화면
* 다시 하기

완료 조건:

* 두 사용자가 실제로 9라운드 게임을 완료할 수 있다.
* 상대방의 실제 숫자가 게임 종료 전에는 노출되지 않는다.

---

# Phase 4. 배포

* 서버를 Render에 배포
* 프론트엔드를 Vercel에 배포
* 환경변수 연결
* CORS 설정
* HTTPS 환경 Socket.IO 테스트
* 모바일 접속 테스트

완료 조건:

* 서로 다른 네트워크에서도 방을 만들고 게임할 수 있다.

---

# Phase 5. 오름차순 게임

* 공통 게임 엔진 적용
* 같은 숫자 순서 생성
* 숫자 배치
* 오름차순 계산
* 동점 처리
* 결과 화면

완료 조건:

* 동일한 카드 순서로 두 사용자가 경쟁할 수 있다.
* 서버가 점수를 정확히 계산한다.

---

# Phase 6. 시크릿 다이스

* 주사위 굴리기
* 주사위 잠금
* 재굴림
* 점수표
* 족보 계산
* 턴 교대
* 최종 점수 계산

완료 조건:

* 모든 점수 항목을 사용할 때까지 게임이 진행된다.
* 클라이언트가 주사위 결과를 조작할 수 없다.

---

# Phase 7. 인디언 포커

* 카드 덱
* 카드 분배
* 칩과 판돈
* 체크
* 콜
* 레이즈
* 폴드
* 올인
* 쇼다운
* 라운드 종료
* 최종 승패

완료 조건:

* 자신의 카드가 브라우저에 전달되지 않는다.
* 모든 베팅 상황에서 잘못된 행동을 서버가 차단한다.

---

# Phase 8. 마무리

* 반응형 디자인
* 로딩 화면
* 연결 끊김 처리
* 재접속
* 게임 규칙 화면
* 효과음
* 결과 공유
* 오류 메시지 개선

---

## 16. 테스트 계획

### 방 시스템 테스트

* 존재하지 않는 방 참가
* 정원이 찬 방 참가
* 같은 닉네임 사용
* 방장이 나가는 상황
* 대기 중 연결 종료
* 게임 중 연결 종료
* 재접속
* 다시 하기

### 게임 테스트

* 자신의 턴이 아닐 때 행동
* 이미 사용한 카드 재사용
* 존재하지 않는 타일 제출
* 제한시간 종료
* 동시에 행동 제출
* 게임 종료 후 행동
* 새로고침
* 모바일 브라우저 접속

### 보안 테스트

* 개발자 도구에서 상대방 카드 확인 시도
* Socket.IO 이벤트 직접 전송
* 잘못된 플레이어 ID 사용
* 다른 방 코드로 행동 전송
* 점수 조작 시도
* 주사위 결과 조작 시도

---

## 17. 개발 우선순위

```text
공통 서버 연결
→ 방 시스템
→ 흑과 백
→ Render·Vercel 배포
→ 오름차순
→ 시크릿 다이스
→ 인디언 포커
→ 재접속과 모바일 최적화
```

첫 번째 목표는 네 게임을 모두 만드는 것이 아니다.

**흑과 백 한 게임을 온라인에서 두 명이 끝까지 플레이할 수 있도록 완성하는 것을 첫 번째 목표로 잡는다.**

흑과 백에서 방 생성, 상태 관리, 동시 행동, 결과 판정 구조를 완성한 뒤 나머지 게임 엔진을 추가한다.

---

## 18. MVP 완료 기준

다음 조건을 모두 충족하면 첫 번째 버전을 완성한 것으로 판단한다.

* Vercel 사이트에 접속할 수 있다.
* Render 게임 서버와 연결된다.
* 닉네임을 입력할 수 있다.
* 방을 만들 수 있다.
* 방 코드로 참가할 수 있다.
* 방에 최대 두 명만 입장할 수 있다.
* 네 가지 게임을 선택할 수 있다.
* 상대방에게 비공개 정보가 노출되지 않는다.
* 게임 결과를 서버가 판정한다.
* 게임 종료 후 다시 대결할 수 있다.
* 모바일에서도 주요 버튼을 사용할 수 있다.
