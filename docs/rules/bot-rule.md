가장 중요한 원칙은 봇에게 서버의 전체 게임 상태를 넘기지 않는 거야.

const botAction = bot.decide(createPlayerView(gameState, botPlayerId));

gameState를 직접 넘기면 봇이 상대의 숨겨진 숫자를 볼 수 있다. 반드시 실제 플레이어에게 보내는 정보와 같은 형태의 PlayerView만 전달해야 해.

1. 흑과 백 봇
1.1 봇이 볼 수 있는 정보

봇은 다음 정보만 사용한다.

interface BlackWhiteBotView {
  myRemainingTiles: number[];

  score: {
    me: number;
    opponent: number;
  };

  history: {
    myTile: number;
    opponentColor: "BLACK" | "WHITE";
    result: "WIN" | "LOSE" | "DRAW";
    myRole: "FIRST" | "SECOND";
  }[];

  currentRound: {
    role: "FIRST" | "SECOND";
    opponentColor?: "BLACK" | "WHITE";
  };
}

다음 정보는 절대 전달하지 않는다.

interface ForbiddenBotData {
  opponentCurrentTile: number;
  opponentRemainingTiles: number[];
  opponentSelections: number[];
}

서버가 정답을 알고 있더라도 봇 모듈에서는 접근할 수 없도록 타입과 파일을 분리하는 게 좋아.

1.2 상대 타일 후보 추론

상대가 낸 타일의 색과 승패를 이용하면 후보 숫자를 줄일 수 있다.

예를 들어 봇이 5를 냈고 다음 결과가 나왔다고 하자.

상대 색상: 검은색
결과: 승리

검은색 숫자는 다음과 같다.

0, 2, 4, 6, 8

봇의 5가 이겼으므로 상대가 냈을 가능성이 있는 숫자는 다음 셋이다.

0, 2, 4

하지만 어떤 숫자를 사용했는지는 확정할 수 없다.

1.3 가능 상태를 확률로 저장하기

상대의 남은 타일을 하나로 단정하지 말고, 가능한 상태를 여러 개 유지한다.

숫자가 0~8까지 9개뿐이므로 비트마스크를 사용하면 편하다.

type TileMask = number;

interface BeliefState {
  possibleMasks: Map<TileMask, number>;
}

초기에는 모든 타일이 남아 있다.

상대 남은 타일 후보:
{0,1,2,3,4,5,6,7,8} 확률 100%

라운드가 끝날 때마다 다음 순서로 후보를 갱신한다.

상대가 낸 색과 일치하는 숫자를 찾는다.
봇이 낸 숫자와 승패가 일치하는지 확인한다.
조건을 만족하는 숫자를 상대의 남은 타일에서 제거한다.
같은 결과로 이어지는 후보 상태의 확률을 합친다.
function updateBelief(
  belief: BeliefState,
  myTile: number,
  opponentColor: "BLACK" | "WHITE",
  result: "WIN" | "LOSE" | "DRAW",
): BeliefState {
  const next = new Map<number, number>();

  for (const [mask, weight] of belief.possibleMasks) {
    const candidates = getTiles(mask).filter((tile) => {
      return (
        getColor(tile) === opponentColor &&
        compareTiles(myTile, tile) === result
      );
    });

    for (const tile of candidates) {
      const nextMask = removeTile(mask, tile);
      const probability = weight / candidates.length;

      next.set(
        nextMask,
        (next.get(nextMask) ?? 0) + probability,
      );
    }
  }

  return normalizeBelief(next);
}

상대가 같은 색의 후보 중 무엇을 냈는지 모른다고 가정하고 균등하게 나누면 된다. 이것만으로도 충분히 추론하는 것처럼 보인다.

1.4 후공일 때 타일 선택

후공 봇은 상대가 제출한 타일의 색을 본다.

각 타일을 냈을 때의 승리·패배 확률을 계산한다.

내가 5를 냈을 때

승리 확률: 55%
무승부 확률: 10%
패배 확률: 35%

기본 평가식은 다음 정도면 된다.

타일 점수
= 승리 확률
- 패배 확률
+ 무승부 확률 × 0.2
- 타일 보존 비용

높은 타일을 무조건 쓰지 않도록 타일 보존 비용을 넣는다.

function preservationCost(tile: number): number {
  return tile / 8 * 0.18;
}

예를 들어 5와 7이 모두 이길 확률이 높다면 5를 선택하게 만든다.

사람 같은 추가 규칙
승리 확률이 75% 이상인 타일 중 가장 작은 타일을 선호한다.
승리 가능성이 낮으면 가장 작은 타일을 버린다.
현재 지고 있으면 높은 타일 보존 비용을 낮춘다.
현재 이기고 있으면 높은 타일을 더 아낀다.
1.5 선공일 때 타일 선택

선공은 상대 타일의 색을 볼 수 없기 때문에 추론보다 자원 관리가 중요하다.

다음 요소를 사용해 점수를 계산하면 된다.

선공 타일 점수
= 예상 승률
+ 상대의 높은 타일 소모 유도
- 내 타일 가치
- 패턴 반복 페널티

상대가 봇 타일의 색을 보고 대응한다고 가정해 간단히 시뮬레이션한다.

function evaluateFirstMove(
  myTile: number,
  view: BlackWhiteBotView,
  belief: BeliefState,
): number {
  let expectedUtility = 0;

  for (const sample of sampleOpponentStates(belief, 40)) {
    const opponentTile = predictOpponentResponse(
      getColor(myTile),
      sample.remainingTiles,
      view,
    );

    expectedUtility += utility(
      compareTiles(myTile, opponentTile),
    );
  }

  return expectedUtility / 40 - preservationCost(myTile);
}

상대 대응 모델은 완벽할 필요가 없다.

상대가 이길 확률이 높은 가장 작은 타일을 선택
→ 그런 타일이 없으면 낮은 타일을 희생

이 정도만 적용해도 선공 봇이 무작위로 내는 것보다 훨씬 자연스럽다.

1.6 너무 잘하지 않게 만드는 방법

가장 좋은 수만 고르면 봇이 지나치게 기계적으로 보인다. 계산된 점수를 확률로 바꿔 선택해야 한다.

function chooseWithSoftmax(
  actions: ScoredAction[],
  temperature: number,
): ScoredAction {
  // temperature가 높을수록 다양한 행동 선택
}

기본 봇은 다음처럼 설정하는 것을 추천한다.

최선의 수 선택: 약 65%
두 번째 수 선택: 약 25%
나머지 수 선택: 약 10%

또는 평가값에 작은 노이즈를 추가한다.

adjustedScore = originalScore + random(-0.12, 0.12);
추천 기본 난이도
상대 추론은 수행
미래 탐색은 현재 라운드까지만 수행
상대 선택 정책은 단순하게 예상
10% 확률로 상위 3개가 아닌 행동 선택
같은 전략을 연속 3번 사용하지 않음
2. 배틀 오름차순 봇

오름차순 게임은 숨겨진 패가 없다. 봇은 다음 공개 정보만 사용하면 된다.

interface AscendingBotView {
  myBoard: Array<number | null>;
  opponentBoard: Array<number | null>;

  currentCards: [number, number];

  role: "CHOOSER" | "RECEIVER";

  turn: number;
}

다음 정보는 봇에게 전달하지 않는다.

interface ForbiddenAscendingData {
  futureCardPairs: Array<[number, number]>;
  opponentCurrentPlacement: number;
}

다음에 나올 카드 순서를 서버가 미리 생성했더라도 봇에게 넘기면 안 된다.

2.1 카드 배치 평가

봇은 받은 카드를 빈칸마다 넣어보고 보드의 상태가 얼마나 좋아지는지 계산한다.

평가 요소는 네 가지면 충분하다.

현재 연결 길이

이미 숫자가 채워진 구간 중 비내림차순 길이를 계산한다.

1, 3, 3, 7

길이 4로 계산한다.

연결 가능한 최대 구간

빈칸을 포함하더라도 이미 놓인 숫자의 순서가 깨지지 않는 가장 긴 구간을 계산한다.

1 | 빈칸 | 빈칸 | 6

앞으로 1~6 사이 숫자가 들어오면 연결할 수 있으므로 가치가 높다.

반면 다음 구간은 이미 깨졌다.

8 | 빈칸 | 3

중간에 어떤 숫자를 넣어도 8 ≤ 숫자 ≤ 3을 만족할 수 없다.

빈칸의 허용 범위

각 빈칸에 들어갈 수 있는 값의 범위를 계산한다.

왼쪽 숫자: 3
오른쪽 숫자: 8

허용 범위: 3~8

허용 범위가 넓을수록 앞으로 들어오는 카드를 배치하기 쉽다.

역전 발생 페널티

카드를 놓았을 때 왼쪽 숫자가 더 커지거나 오른쪽 숫자가 더 작아지면 감점한다.

2.2 보드 평가 함수

다음처럼 시작하면 된다.

function evaluateBoard(board: Array<number | null>): number {
  const currentLongest = getLongestCompletedRun(board);
  const feasibleLongest = getLongestFeasibleRun(board);
  const flexibility = getTotalPlacementFlexibility(board);
  const brokenConnections = countBrokenConnections(board);

  return (
    currentLongest * 4 +
    feasibleLongest * 2 +
    flexibility * 0.15 -
    brokenConnections * 3
  );
}

카드 하나를 각 빈칸에 넣은 뒤 평가값 차이를 비교한다.

function getBestPlacements(
  board: Array<number | null>,
  card: number,
): ScoredPlacement[] {
  return board
    .map((value, index) => ({ value, index }))
    .filter(({ value }) => value === null)
    .map(({ index }) => {
      const nextBoard = [...board];
      nextBoard[index] = card;

      return {
        index,
        score: evaluateBoard(nextBoard) - evaluateBoard(board),
      };
    });
}
2.3 두 카드 중 하나 선택하기

선택권이 있는 봇은 다음 두 경우를 비교한다.

경우 A
내가 첫 번째 카드 획득
상대에게 두 번째 카드 지급

경우 B
내가 두 번째 카드 획득
상대에게 첫 번째 카드 지급

각 경우에서 자신의 최적 배치 효과와 상대의 예상 배치 효과를 계산한다.

선택 점수
= 내 보드 개선값
- 상대 보드 개선값 × 견제 계수
function evaluateCardChoice(
  myBoard: Array<number | null>,
  opponentBoard: Array<number | null>,
  myCard: number,
  opponentCard: number,
): number {
  const myGain = getBestPlacements(myBoard, myCard)[0].score;
  const opponentGain =
    getBestPlacements(opponentBoard, opponentCard)[0].score;

  const aggression = 0.7;

  return myGain - opponentGain * aggression;
}

예를 들어 다음 카드가 공개됐다고 하자.

공개 카드: 3, 9

내 보드에는 낮은 숫자가 부족하고 상대 보드는 마지막 부분에 높은 숫자가 필요한 상황이라면 3을 가져가고 상대에게 9를 주는 선택이 나쁠 수 있다.

봇은 양쪽 보드를 평가해 다음처럼 판단한다.

3을 가져가는 가치: +4.2
상대에게 9를 주는 가치: +5.5

종합: 4.2 - 5.5 × 0.7 = 0.35

반대 선택도 계산한 뒤 더 높은 쪽을 고른다.

2.4 제한된 미래 시뮬레이션

한 턴만 평가하면 중간 숫자를 지나치게 선호할 수 있다. 남은 턴을 전부 탐색하지 말고, 무작위 미래를 20회 정도만 시뮬레이션하면 좋다.

function rolloutChoice(
  view: AscendingBotView,
  option: CardChoice,
): number {
  let total = 0;

  for (let i = 0; i < 20; i++) {
    const simulation = cloneStateWithChoice(view, option);

    simulateRandomFutureTurns(simulation, {
      depth: 3,
      placementPolicy: "GREEDY",
    });

    total +=
      getLongestRun(simulation.myBoard) -
      getLongestRun(simulation.opponentBoard);
  }

  return total / 20;
}

여기서 미래 카드는 서버의 실제 예정 카드를 보면 안 된다.

게임에서 사용하는 카드 분포에 따라 새로 무작위 표본을 만들어야 한다.

const sampledFuturePair = drawFromPublicCardDistribution();
권장 설정
시뮬레이션 횟수: 15~25회
미래 탐색: 다음 2~3턴
상대는 단순 탐욕 배치로 가정
실제 예정 카드는 참조하지 않음
2.5 카드 배치 선택

카드를 받은 뒤에는 빈칸 평가값이 높은 위치를 고른다.

다만 항상 최고 위치를 선택하지는 않는다.

1위 위치 선택: 70%
2위 위치 선택: 20%
3위 이하 선택: 10%

초반에는 보드 유연성을 중시하고, 후반에는 실제 최장 구간을 중시하도록 가중치를 바꾼다.

function getTurnWeights(turn: number) {
  const progress = turn / 10;

  return {
    completedRunWeight: 2 + progress * 4,
    feasibleRunWeight: 4 - progress * 2,
    flexibilityWeight: 1 - progress * 0.7,
  };
}
1~4턴: 빈칸 활용 범위와 장기 가능성 중시
5~7턴: 연결 가능한 구간 중시
8~10턴: 확정 최장 구간 중시
3. 난이도 설정

두 게임 모두 별도의 알고리즘을 만들기보다 같은 모델의 탐색량과 무작위성을 조절하면 된다.

설정	쉬움	보통	어려움
최선 행동 확률	45%	70%	90%
미래 탐색	없음	2~3턴	4~5턴
시뮬레이션	0~5회	20회	100회
추론 상태	단순 후보	확률 후보	정교한 가중치
실수 확률	25%	10%	2%

기본 모드는 보통이 적당하다.

흑과 백 기본 봇
상대 후보 추론 사용
현재 라운드 기대 승률 계산
미래 탐색 없음
최선 행동 확률 65~70%
오름차순 기본 봇
보드 휴리스틱 사용
미래 2턴 시뮬레이션
시뮬레이션 20회
최선 행동 확률 70%
4. 봇이 사람처럼 보이게 만드는 요소

판단 로직만큼 행동 연출도 중요하다.

행동 전 0.7~2.0초 무작위 대기
어려운 상황일수록 생각 시간을 길게 표시
항상 같은 시간에 행동하지 않기
최선의 수가 비슷하면 무작위 선택
같은 숫자나 위치를 반복 선호하지 않기
낮은 확률로 단순한 실수 허용
const delay = randomBetween(700, 2000);

setTimeout(() => {
  executeBotAction(action);
}, delay);

봇이 실제로 서버에서 기다리게 할 필요는 없다. 행동은 먼저 계산하고 클라이언트 연출만 지연해도 된다.

5. 추천 구현 순서
1단계: 오름차순 봇

오름차순 봇이 더 쉽다.

보드 평가 함수
→ 받은 카드 배치
→ 두 카드 선택
→ 상위 후보 확률 선택
→ 제한된 미래 시뮬레이션
2단계: 흑과 백 후공 봇
상대 색 확인
→ 가능한 숫자 추론
→ 각 내 타일의 승률 계산
→ 타일 보존 비용 반영
3단계: 흑과 백 선공 봇
상대 남은 타일 확률 모델
→ 상대 후공 대응 예상
→ 타일별 기대 결과 계산
4단계: 난이도 조정

플레이테스트 결과를 보고 다음 값만 조절하면 된다.

interface BotDifficulty {
  optimalActionRate: number;
  rolloutCount: number;
  rolloutDepth: number;
  evaluationNoise: number;
  thinkTimeMin: number;
  thinkTimeMax: number;
}

추천 기본값:

const normalDifficulty: BotDifficulty = {
  optimalActionRate: 0.7,
  rolloutCount: 20,
  rolloutDepth: 2,
  evaluationNoise: 0.12,
  thinkTimeMin: 700,
  thinkTimeMax: 1800,
};

핵심은 봇이 정답 상태를 보지 못하게 만드는 것과 최고 점수 행동을 무조건 선택하지 않게 만드는 것이다. 흑과 백은 확률 후보 추론, 오름차순은 보드 휴리스틱과 짧은 롤아웃만 적용해도 실제 플레이어와 대결하는 느낌을 만들 수 있다.

시크릿다이스와 인디언포커도 만들수 있을거같은데?
27s 동안 처리함

가능해. 네 게임 모두 실제 머신러닝 없이 규칙 기반 추론 봇으로 만들 수 있어.

공통 원칙은 하나야.

const view = createPlayerView(gameState, botPlayerId);
const action = bot.decide(view, difficulty);

봇에는 전체 gameState를 넘기지 않고, **사람 플레이어가 화면에서 볼 수 있는 정보만 담은 view**를 전달해야 해.

1. 시크릿 다이스 봇

시크릿 다이스 봇은 공격과 수비를 나눠 설계하면 돼.

봇이 볼 수 있는 정보
interface SecretDiceBotView {
  role: "ATTACKER" | "DEFENDER";

  publicDice: [number, number, number];
  fixedDice: number[];

  myScoreSheet: ScoreSheet;
  opponentScoreSheet: ScoreSheet;

  myTotalScore: number;
  opponentTotalScore: number;

  threeDiceChanceUsed: boolean;
  turn: number;
}

다음 정보는 넘기면 안 돼.

interface ForbiddenSecretDiceData {
  opponentSecretNumbers: number[];
  serverGeneratedFutureDice: number[];
}
1.1 공격 봇

공격 봇은 다음 세 가지를 결정해야 해.

공개 주사위 몇 개를 고정할지
어떤 공개 주사위를 고정할지
비공개 숫자로 무엇을 선택할지

가능한 행동 수가 많지 않아서 전부 계산할 수 있어.

비공개 숫자 후보

숫자 두 개를 선택해야 한다면 최대 경우의 수는 다음과 같아.

6 × 6 = 36가지

중복을 순서 없는 조합으로 처리하면 더 줄일 수 있어.

1,1
1,2
1,3
...
6,6
공격 행동 평가

각 행동에 대해 수비 플레이어가 낼 수 있는 숫자를 가정하고 최종 주사위를 만든다.

공격 행동 점수
= 예상 획득 점수
- 사용 점수 칸의 미래 가치
+ 상대보다 뒤지고 있을 때 공격 보너스
function evaluateAttackResult(
  dice: number[],
  scoreSheet: ScoreSheet,
): number {
  const availableScores = getAvailableScores(dice, scoreSheet);

  return Math.max(
    ...availableScores.map(({ category, score }) => {
      const futureCost = getCategoryFutureValue(category);

      return score - futureCost;
    }),
  );
}

예를 들어 5다이스·조커 칸이 남아 있다고 해서 주사위 합 18점을 바로 기록하면, 나중에 5다이스 50점을 얻을 기회를 잃어. 그래서 점수 칸마다 미래 가치를 뺀다.

const categoryFutureValue = {
  ONES: 2,
  TWOS: 3,
  THREES: 4,
  FOURS: 5,
  FIVES: 6,
  SIXES: 7,
  FULL_HOUSE: 6,
  SMALL_STRAIGHT: 7,
  LARGE_STRAIGHT: 10,
  FOUR_DICE: 9,
  FIVE_DICE_JOKER: 13,
};

처음에는 대략적인 값으로 두고 플레이테스트 후 조절하면 돼.

1.2 수비 행동까지 고려하기

공격 봇이 상대의 실제 선택을 보면 안 되므로, 수비 행동을 여러 개 가정해야 해.

function evaluateAttackAction(
  view: SecretDiceBotView,
  action: AttackAction,
): number {
  const defenderActions = generateDefenderActions(action.fixedDice.length);

  let total = 0;

  for (const defense of defenderActions) {
    const finalDice = makeFinalDice(
      action.fixedDice,
      action.secretNumbers,
      defense.secretNumbers,
    );

    total += evaluateAttackResult(finalDice, view.myScoreSheet);
  }

  return total / defenderActions.length;
}

이건 수비가 무작위로 선택한다고 가정한 평균값이야.

조금 더 강하게 만들려면 수비가 공격자를 방해하는 선택을 한다고 가정해.

평균 모델: 모든 수비 행동의 평균
보수적 모델: 수비 행동 중 최악의 결과
혼합 모델: 평균 70% + 최악 30%

추천 기본 봇:

공격 평가값
= 평균 결과 × 0.7
+ 최악의 결과 × 0.3
1.3 수비 봇

수비 봇은 공개 주사위와 공격자가 고정한 주사위를 본다.

여기서 공격자의 목표를 추정할 수 있어.

예시:

공개: 2, 3, 4
공격자가 2, 3, 4를 모두 고정

공격자는 높은 확률로 다음 조합을 노린다.

1, 5 추가 → 5연속
4, 5 추가 → 4연속

수비 봇은 공격자의 가능한 비공개 선택을 가정하고, 공격자가 얻는 최고 점수를 낮추는 숫자를 고른다.

function evaluateDefenseAction(
  view: SecretDiceBotView,
  defense: DefenseAction,
): number {
  const possibleAttacks = generatePossibleAttackSecrets(
    view.fixedDice.length,
  );

  let attackerExpectedScore = 0;

  for (const attack of possibleAttacks) {
    const finalDice = makeFinalDice(
      view.fixedDice,
      attack.secretNumbers,
      defense.secretNumbers,
    );

    attackerExpectedScore += getBestScore(
      finalDice,
      view.opponentScoreSheet,
    );
  }

  return -attackerExpectedScore / possibleAttacks.length;
}

수비 봇이 너무 강해지는 걸 막으려면 공격자의 모든 선택을 완벽하게 분석하지 않고 일부만 샘플링하면 돼.

쉬움: 공격 후보 5개 무작위 샘플
보통: 공격 후보 15개 샘플
어려움: 모든 공격 후보 계산
1.4 3개 고정 찬스 사용

3개 고정 찬스를 아무 때나 쓰지 않도록 예상 가치를 둔다.

다음 조건에서 사용 확률을 높이면 자연스러워.

공개 주사위만으로 연속 숫자 3개가 만들어짐
같은 숫자가 3개 나옴
높은 점수를 얻을 확률이 60% 이상
후반인데 좋은 점수 칸이 남아 있음
function shouldUseThreeDiceChance(
  publicDice: number[],
  scoreSheet: ScoreSheet,
  turn: number,
): boolean {
  const potential = estimateThreeDicePotential(publicDice, scoreSheet);

  const threshold = turn >= 8 ? 0.45 : 0.65;

  return potential >= threshold;
}
1.5 너무 잘하지 않게 만들기

시크릿 다이스는 완전 탐색이 쉬워서 봇이 지나치게 강해질 수 있어.

최선 행동 선택: 65%
두 번째 행동: 25%
나머지 상위 행동: 10%

또는 계산 점수에 노이즈를 넣는다.

adjustedScore =
  calculatedScore + randomBetween(-3, 3);

점수 범위가 크므로 흑과 백보다 노이즈를 크게 둬도 돼.

2. 인디언 포커 봇

인디언 포커 봇은 자신의 카드를 보지 못하므로 자신의 카드 확률 분포를 계산해야 해.

봇이 볼 수 있는 정보
interface IndianPokerBotView {
  opponentCard: number;

  myChips: number;
  opponentChips: number;
  pot: number;

  currentBet: number;
  myRoundBet: number;
  opponentRoundBet: number;

  isMyTurn: boolean;
  canCheck: boolean;

  publicHistory: IndianPokerPublicRound[];
}

봇에게 넘기면 안 되는 정보:

interface ForbiddenIndianPokerData {
  myCard: number;
  exactRemainingDeck: number[];
  hiddenFoldedCards: number[];
}
2.1 자신의 카드 확률 계산

초기 덱은 숫자별 두 장이야.

const initialCounts = {
  1: 2,
  2: 2,
  3: 2,
  4: 2,
  5: 2,
  6: 2,
  7: 2,
  8: 2,
  9: 2,
  10: 2,
};

현재 상대 카드가 7이라면 공개된 카드 한 장을 제거한다.

7의 남은 공개 가능 장수: 1장
나머지 숫자: 각 2장

이 상태에서 자신의 카드가 각 숫자일 확률을 계산한다.

function getOwnCardDistribution(
  knownCounts: Record<number, number>,
  opponentCard: number,
): Record<number, number> {
  const counts = { ...knownCounts };
  counts[opponentCard] -= 1;

  const total = Object.values(counts).reduce(
    (sum, count) => sum + count,
    0,
  );

  return Object.fromEntries(
    Object.entries(counts).map(([card, count]) => [
      Number(card),
      count / total,
    ]),
  );
}
2.2 승리 확률

상대 카드가 공개되어 있으므로 자신의 확률 분포에서 바로 계산할 수 있어.

function calculateHandStrength(
  distribution: Record<number, number>,
  opponentCard: number,
) {
  let win = 0;
  let tie = 0;
  let lose = 0;

  for (const [cardText, probability] of Object.entries(distribution)) {
    const card = Number(cardText);

    if (card > opponentCard) win += probability;
    else if (card === opponentCard) tie += probability;
    else lose += probability;
  }

  return { win, tie, lose };
}

상대 카드가 3이면 승률이 높고, 상대 카드가 9이면 승률이 낮아.

하지만 상대 카드만 보고 행동하면 너무 단순하므로 베팅 정보도 함께 봐야 해.

2.3 공개된 카드 카운팅

쇼다운에서 공개된 카드는 덱 후보에서 제거한다.

interface IndianPokerPublicRound {
  opponentCard: number;
  revealedMyCard: number | null;
  result: "WIN" | "LOSE" | "DRAW" | "FOLD";
  pot: number;
}

카드가 모두 공개되는 라운드는 정확하게 카운팅할 수 있어.

function updateKnownCounts(
  counts: Record<number, number>,
  round: IndianPokerPublicRound,
) {
  counts[round.opponentCard] -= 1;

  if (round.revealedMyCard !== null) {
    counts[round.revealedMyCard] -= 1;
  }
}
2.4 폴드 카드가 공개되지 않는 경우

봇이 이전에 폴드했고 자신의 카드가 공개되지 않았다면, 그 카드가 무엇인지 봇도 몰라야 해.

이 경우 정확한 덱 하나를 저장하면 안 돼. 가능한 덱 상태를 여러 개 유지해야 해.

간단한 방식: 기대 개수

숨겨진 카드가 한 장 버려졌다면 각 숫자의 확률만큼 개수를 줄인다.

카드 1 확률 10% → 기대 개수 0.1 감소
카드 2 확률 10% → 기대 개수 0.1 감소
...
function removeUnknownCardByExpectation(
  counts: Record<number, number>,
  distribution: Record<number, number>,
) {
  for (const card of Object.keys(counts)) {
    counts[Number(card)] -= distribution[Number(card)] ?? 0;
  }
}

MVP에서는 이 방식으로 충분해.

더 정확한 방식: 파티클 필터

가능한 덱 상태를 100~300개 정도 유지한다.

interface DeckParticle {
  counts: Record<number, number>;
  weight: number;
}

숨겨진 카드가 버려질 때 각 파티클에서 확률에 따라 카드 하나를 제거한다.

파티클 1: 숨겨진 카드가 4였다고 가정
파티클 2: 숨겨진 카드가 7이었다고 가정
파티클 3: 숨겨진 카드가 9였다고 가정

현재 상황에서 모든 파티클의 승률을 평균 내면 돼.

보통 난이도에는 기대 개수 방식이 더 단순하고 충분히 자연스러워.

3. 인디언 포커 베팅 판단

봇은 다음 요소를 사용해서 행동을 선택하면 돼.

베팅 점수
= 승리 확률
+ 무승부 확률 일부
- 콜 비용
+ 블러프 보너스
+ 상대 성향 보정
3.1 콜 판단

현재 콜에 필요한 칩과 팟 크기를 사용한다.

function getPotOdds(callAmount: number, pot: number): number {
  return callAmount / (pot + callAmount);
}

예를 들어,

현재 팟: 8
콜 비용: 2

필요 승률 = 2 / (8 + 2)
          = 20%

봇의 예상 승률이 20%보다 충분히 높으면 콜할 가치가 있어.

const effectiveWinRate = winRate + tieRate * 0.5;

if (effectiveWinRate > potOdds + safetyMargin) {
  return "CALL";
}

보통 봇의 safetyMargin은 0.05~0.1 정도로 두면 돼.

3.2 레이즈 판단

다음 조건에서 레이즈 확률을 높인다.

상대 카드가 낮음
예상 승률이 높음
팟이 큼
상대가 자주 폴드함
봇 칩이 충분함
function shouldRaise(context: BettingContext): boolean {
  const strength =
    context.winRate +
    context.tieRate * 0.3;

  const foldEquity =
    context.opponentFoldRate * 0.25;

  return strength + foldEquity > 0.7;
}

레이즈 금액은 고정 단위가 구현하기 쉬워.

작은 레이즈: 현재 베팅 + 1
중간 레이즈: 현재 베팅 + 3
큰 레이즈: 현재 베팅 + 5
올인

봇은 높은 승률일수록 큰 금액을 선택한다.

3.3 블러핑

블러프가 전혀 없으면 상대 카드만 보고 행동하는 티가 나.

다음 조건에서 낮은 확률로 블러프 레이즈를 한다.

상대 카드가 중간 숫자
팟이 작음
상대가 최근 자주 폴드함
봇의 칩이 상대보다 많음
function getBluffProbability(
  opponentFoldRate: number,
  chipAdvantage: number,
): number {
  const base = 0.06;

  return Math.min(
    0.18,
    base +
      opponentFoldRate * 0.08 +
      chipAdvantage * 0.04,
  );
}

보통 난이도 블러프 확률은 5~12% 정도가 좋아.

상대 카드가 10인데 레이즈하는 식의 무리한 블러프는 피해야 해.

3.4 상대 성향 학습

봇은 머신러닝 없이도 현재 게임에서 상대의 행동을 기록할 수 있어.

interface OpponentProfile {
  roundsPlayed: number;
  folds: number;
  calls: number;
  raises: number;
  largeRaises: number;
}
const foldRate =
  profile.roundsPlayed === 0
    ? 0.3
    : profile.folds / profile.roundsPlayed;

이를 이용해 상대를 세 가지 정도로 분류한다.

폴드 비율 높음 → 신중형
레이즈 비율 높음 → 공격형
콜 비율 높음 → 콜링형
대응
신중형: 블러프 빈도 증가
공격형: 중간 승률에서 콜 빈도 증가
콜링형: 블러프 감소, 좋은 상황에서 큰 레이즈
데이터 부족: 기본 성향 사용

처음 3라운드까지는 상대 성향을 강하게 반영하지 않는 편이 좋아.

4. 인디언 포커 행동 평가 예시

상대 카드가 8이라고 가정해.

내 예상 승률: 18%
무승부 확률: 8%
패배 확률: 74%

현재 팟:

팟: 12
콜 비용: 5
필요 승률: 5 / 17 ≈ 29.4%

유효 승률:

18% + 8% × 0.5 = 22%

필요 승률보다 낮으므로 폴드 가능성이 높아.

하지만 봇이 항상 같은 행동을 하지 않도록 확률을 둔다.

폴드: 80%
콜: 17%
레이즈: 3%

상대 카드가 2라면 반대로 처리한다.

콜: 25%
작은 레이즈: 45%
중간 레이즈: 25%
큰 레이즈: 5%
5. 공통 난이도 설정
interface BotDifficulty {
  optimalActionRate: number;
  sampleCount: number;
  evaluationNoise: number;
  bluffRateMultiplier: number;
  opponentModelWeight: number;
  thinkTimeMin: number;
  thinkTimeMax: number;
}
쉬움
const easyBot: BotDifficulty = {
  optimalActionRate: 0.45,
  sampleCount: 5,
  evaluationNoise: 0.3,
  bluffRateMultiplier: 0.5,
  opponentModelWeight: 0.1,
  thinkTimeMin: 500,
  thinkTimeMax: 1400,
};
보통
const normalBot: BotDifficulty = {
  optimalActionRate: 0.7,
  sampleCount: 20,
  evaluationNoise: 0.15,
  bluffRateMultiplier: 1,
  opponentModelWeight: 0.4,
  thinkTimeMin: 700,
  thinkTimeMax: 1900,
};
어려움
const hardBot: BotDifficulty = {
  optimalActionRate: 0.92,
  sampleCount: 100,
  evaluationNoise: 0.04,
  bluffRateMultiplier: 1.2,
  opponentModelWeight: 0.8,
  thinkTimeMin: 800,
  thinkTimeMax: 2400,
};
6. 게임별 봇 구조
bots/
├─ common/
│  ├─ BotDifficulty.ts
│  ├─ weightedChoice.ts
│  └─ randomDelay.ts
│
├─ black-and-white/
│  ├─ BlackWhiteBot.ts
│  └─ beliefModel.ts
│
├─ ascending/
│  ├─ AscendingBot.ts
│  └─ boardEvaluator.ts
│
├─ secret-dice/
│  ├─ SecretDiceBot.ts
│  ├─ attackEvaluator.ts
│  ├─ defenseEvaluator.ts
│  └─ scoreCalculator.ts
│
└─ indian-poker/
   ├─ IndianPokerBot.ts
   ├─ cardBelief.ts
   ├─ bettingPolicy.ts
   └─ opponentProfile.ts

공통 인터페이스는 다음처럼 만들면 돼.

interface BotPolicy<View, Action> {
  decide(
    view: View,
    difficulty: BotDifficulty,
  ): Action;
}

비동기 행동이 필요한 경우:

interface AsyncBotPolicy<View, Action> {
  decide(
    view: View,
    difficulty: BotDifficulty,
  ): Promise<Action>;
}
7. 구현 난이도 순서
1. 오름차순
2. 흑과 백
3. 시크릿 다이스
4. 인디언 포커

시크릿 다이스는 행동 수가 제한되어 있어 전부 탐색하기 쉽지만, 공격·수비·점수판 가치를 함께 계산해야 해.

인디언 포커는 계산 자체보다 다음 항목이 복잡해.

숨겨진 자신의 카드 확률
베팅 상태
팟 오즈
블러핑
상대 성향
폴드로 공개되지 않은 카드 처리

그래도 머신러닝 없이 충분히 구현할 수 있어. 기본 버전에서는 기대 개수 기반 카드 추론 + 단순 팟 오즈 + 5~10% 블러프만 적용해도 사람과 플레이하는 느낌이 난다.