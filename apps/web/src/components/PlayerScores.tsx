/** 3~4인 게임용 점수판. 현재 차례·답변 중인 플레이어를 강조하고, 이번 문제에서 빠진 플레이어를 흐리게 표시한다. */
export function PlayerScores({ playerIds, scores, playerId, nameOf, activeId, dimmedIds = [], unit = "점" }: {
  playerIds: string[]; scores: Record<string, number>; playerId: string; nameOf: (id: string) => string;
  activeId?: string | null; dimmedIds?: string[]; unit?: string;
}) {
  return <ol className="player-scores" aria-label="플레이어 점수">
    {playerIds.map(id => <li key={id} className={[id === playerId ? "is-me" : "", id === activeId ? "is-active" : "", dimmedIds.includes(id) ? "is-dimmed" : ""].join(" ").trim()}>
      <small>{nameOf(id)}</small><strong>{scores[id] ?? 0}<em>{unit}</em></strong>
    </li>)}
  </ol>;
}
