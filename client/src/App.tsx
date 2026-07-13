import { useCallback, useEffect, useState } from "react";
import type { Ack, GameType, RoomView } from "@brain-arena/shared";
import { HomePage } from "./pages/HomePage";
import { RoomPage } from "./pages/RoomPage";
import { ConnectionBadge } from "./components/ConnectionBadge";
import { SERVER_CONFIGURED, SERVER_URL, socket } from "./socket/socket";

interface Session { playerId: string; roomCode: string }
const loadSession = (): Session | null => { try { return JSON.parse(localStorage.getItem("brain-arena-session") ?? "null"); } catch { return null; } };

export default function App() {
  const [connected, setConnected] = useState(socket.connected); const [room, setRoom] = useState<RoomView | null>(null);
  const [playerId, setPlayerId] = useState(loadSession()?.playerId ?? ""); const [nickname, setNickname] = useState(localStorage.getItem("brain-arena-nickname") ?? "");
  const [error, setError] = useState(""); const [busy, setBusy] = useState(true);
  const save = useCallback((id: string, nextRoom: RoomView) => { setPlayerId(id); setRoom(nextRoom); localStorage.setItem("brain-arena-session", JSON.stringify({ playerId: id, roomCode: nextRoom.code })); }, []);
  useEffect(() => {
    const clearSession = (message: string) => { setRoom(null); setPlayerId(""); localStorage.removeItem("brain-arena-session"); setError(message); };
    const update = (next: RoomView) => setRoom(next);
    const fail = (message: string) => {
      const staleRoom = message.includes("존재하지 않는 방") || message.includes("플레이어를 확인") || message.includes("방장이 방을 종료");
      if (staleRoom) clearSession(message.includes("존재하지 않는 방") ? "게임 서버가 재시작되어 이전 방이 종료되었습니다. 새 방을 만들어 주세요." : message);
      else setError(message);
    };
    socket.on("connect", () => { setConnected(true); setBusy(false); setError(""); const session = loadSession(); if (session) socket.emit("player:reconnect", session, (ack: Ack<{room: RoomView}>) => { if (ack.ok && ack.data) { setPlayerId(session.playerId); setRoom(ack.data.room); } else clearSession(ack.error?.includes("존재하지 않는 방") ? "게임 서버가 재시작되어 이전 방이 종료되었습니다. 새 방을 만들어 주세요." : ack.error ?? "이전 게임에 다시 연결하지 못했습니다."); }); });
    socket.on("disconnect", () => setConnected(false));
    ["room:updated", "game:started", "game:updated", "game:finished", "player:disconnected", "player:reconnected"].forEach(event => socket.on(event, update)); socket.on("room:error", fail);
    const warmup = async () => {
      if (!SERVER_CONFIGURED) {
        setError("배포 설정 오류: Vercel에 VITE_SERVER_URL을 설정한 뒤 다시 배포해 주세요.");
        setBusy(false);
        return;
      }
      try { await fetch(`${SERVER_URL}/health`); socket.connect(); }
      catch { setError("게임 서버가 깨어나는 중입니다. 잠시 후 자동으로 다시 시도합니다."); socket.connect(); }
      finally { setBusy(false); }
    };
    warmup(); return () => { socket.off(); socket.disconnect(); };
  }, []);
  function create(gameType: GameType) { setError(""); setBusy(true); localStorage.setItem("brain-arena-nickname", nickname); socket.emit("room:create", { nickname, gameType }, (ack: Ack<{room: RoomView; playerId: string}>) => { setBusy(false); if (ack.ok && ack.data) save(ack.data.playerId, ack.data.room); else setError(ack.error ?? "방을 만들지 못했습니다."); }); }
  function join(roomCode: string) { setError(""); setBusy(true); localStorage.setItem("brain-arena-nickname", nickname); socket.emit("room:join", { nickname, roomCode }, (ack: Ack<{room: RoomView; playerId: string}>) => { setBusy(false); if (ack.ok && ack.data) save(ack.data.playerId, ack.data.room); else setError(ack.error ?? "방에 참가하지 못했습니다."); }); }
  function exitLocal() { setRoom(null); setPlayerId(""); setError(""); localStorage.removeItem("brain-arena-session"); }
  function leave() { if (room) socket.emit("room:leave", { roomCode: room.code, playerId }); exitLocal(); }
  return <><ConnectionBadge connected={connected}/>{room ? <RoomPage room={room} playerId={playerId} onLeave={leave} onExitLocal={exitLocal} setError={setError}/> : <HomePage nickname={nickname} setNickname={setNickname} onCreate={create} onJoin={join} busy={busy} error={error}/>} {error && room && <button className="toast" onClick={() => setError("")}>{error} <b>×</b></button>}</>;
}
