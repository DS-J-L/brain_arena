import { GAME_INFO, type GameType } from "@brain-arena/shared";
const rules:Record<GameType,string[]>={
 BLACK_AND_WHITE:["각자 0~8 타일을 한 번씩 사용합니다. 짝수는 검정, 홀수는 흰색입니다.","선공이 먼저 비공개 제출하면 후공은 색만 확인하고 제출합니다.","큰 숫자가 1점을 얻고, 라운드 승자가 다음 선공이 됩니다.","먼저 5점을 얻거나 9라운드 후 앞선 플레이어가 승리합니다. 9라운드 동점이면 새 타일로 연장합니다."],
 ASCENDING:["매 턴 1~10 카드 두 장이 공개되고, 선택권을 가진 플레이어가 한 장을 가져갑니다.","남은 카드는 상대에게 자동 지급되며, 양쪽은 받은 카드를 동시에 빈칸에 배치합니다.","선택권은 매 턴 교대하며 각자 정확히 5번 선택합니다.","10턴 후 가장 긴 인접 비내림차순(왼쪽 ≤ 오른쪽)을 비교합니다. 같은 숫자도 연결됩니다."],
 SECRET_DICE:["공격자가 공개 주사위 3개 중 1~3개를 고정합니다.","공격자와 수비자가 필요한 숫자를 비공개로 골라 최종 주사위 5개를 만듭니다.","공격자는 미사용 점수 칸 하나에 점수를 기록하고 역할을 교대합니다.","5다이스와 조커를 포함한 각자 12개 점수 칸을 모두 사용한 뒤 총점이 높은 플레이어가 승리합니다."],
 INDIAN_POKER:["각자 칩 20개로 시작하며 1~10 카드 두 벌을 사용합니다.","내 카드는 볼 수 없고 상대 카드만 볼 수 있습니다.","콜, +1 레이즈, 올인, 폴드 중 선택합니다. 콜하면 카드를 비교합니다.","카드 10으로 폴드하면 상대에게 칩을 최대 10개 추가로 줍니다. 상대 칩을 모두 얻으면 승리합니다."]
};
export function RuleModal({gameType,onClose}:{gameType:GameType;onClose:()=>void}){return <div className="modal-backdrop" onClick={onClose}><section className="modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={onClose}>×</button><p className="eyebrow">HOW TO PLAY</p><h2>{GAME_INFO[gameType].name}</h2><ol>{rules[gameType].map(rule=><li key={rule}>{rule}</li>)}</ol><p className="rule-time">시간 초과 시 서버가 규칙에 맞는 자동 행동을 실행합니다.</p><button className="primary full" onClick={onClose}>확인</button></section></div>}
