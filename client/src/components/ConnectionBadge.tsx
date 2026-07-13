export function ConnectionBadge({ connected }: { connected: boolean }) { return <span className={`connection ${connected ? "online" : "offline"}`}><i />{connected ? "서버 연결됨" : "연결 중"}</span>; }
