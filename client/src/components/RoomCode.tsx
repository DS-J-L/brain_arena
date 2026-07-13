import { useState } from "react";
export function RoomCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() { await navigator.clipboard.writeText(`${location.origin}/join/${code}`); setCopied(true); setTimeout(() => setCopied(false), 1500); }
  return <div className="room-code"><span>ROOM CODE</span><strong>{code}</strong><button className="icon-button" onClick={copy}>{copied ? "복사됨" : "초대 링크 복사"}</button></div>;
}
