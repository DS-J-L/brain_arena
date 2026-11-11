import { useState } from "react";
import { isMuted, setMuted } from "../sound";

export function SoundToggle() {
  const [muted, setMutedState] = useState(isMuted());
  const toggle = () => { setMuted(!muted); setMutedState(!muted); };
  return <button className={`sound-toggle${muted ? " is-muted" : ""}`} aria-pressed={!muted} aria-label={muted ? "효과음 켜기" : "효과음 끄기"} onClick={toggle}><i aria-hidden="true">♪</i>{muted ? "효과음 꺼짐" : "효과음 켜짐"}</button>;
}
