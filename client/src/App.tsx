import { useCallback, useEffect, useState } from "react";
import type { Ack, GameType, RoomView } from "@brain-arena/shared";
import { HomePage } from "./pages/HomePage";
import { RoomPage } from "./pages/RoomPage";
import { ConnectionBadge } from "./components/ConnectionBadge";
import { SERVER_URL, socket } from "./socket/socket";

interface Session { playerId: string; roomCode: string }
const loadSession = (): Session | null => { try { return JSON.parse(localStorage.getItem("brain-arena-session") ?? "null"); } catch { return null; } };

export default function App() {
  const [connected, setConnected] = useState(socket.connected); const [room, setRoom] = useState<RoomView | null>(null);
  const [playerId, setPlayerId] = useState(loadSession()?.playerId ?? ""); const [nickname, setNickname] = useState(localStorage.getItem("brain-arena-nickname") ?? "");
  const [error, setError] = useState(""); const [busy, setBusy] = useState(true);
  const save = useCallback((id: string, nextRoom: RoomView) => { setPlayerId(id); setRoom(nextRoom); localStorage.setItem("brain-arena-session", JSON.stringify({ playerId: id, roomCode: nextRoom.code })); }, []);
  useEffect(() => {
    const update = (next: RoomView) => setRoom(next); const fail = (message: string) => { setError(message); if (message.includes("종료")) { setRoom(null); localStorage.removeItem("brain-arena-session"); } };
    socket.on("connect", () => { setConnected(true); setBusy(false); const session = loadSession(); if (session) socket.emit("player:reconnect", session, (ack: Ack<{room: RoomView}>) => { if (ack.ok && ack.data) { setPlayerId(session.playerId); setRoom(ack.data.room); } else localStorage.removeItem("brain-arena-session"); }); });
    socket.on("disconnect", () => setConnected(false));
    ["room:updated", "game:started", "game:updated", "game:finished", "player:disconnected", "player:reconnected"].forEach(event => socket.on(event, update)); socket.on("room:error", fail);
    const warmup = async () => { try { await fetch(`${SERVER_URL}/health`); socket.connect(); } catch { setError("게임 서버가 깨어나는 중입니다. 잠시 후 자동으로 다시 시도합니다."); socket.connect(); } finally { setBusy(false); } };
    warmup(); return () => { socket.off(); socket.disconnect(); };
  }, []);
  function create(gameType: GameType) { setError(""); setBusy(true); localStorage.setItem("brain-arena-nickname", nickname); socket.emit("room:create", { nickname, gameType }, (ack: Ack<{room: RoomView; playerId: string}>) => { setBusy(false); if (ack.ok && ack.data) save(ack.data.playerId, ack.data.room); else setError(ack.error ?? "방을 만들지 못했습니다."); }); }
  function join(roomCode: string) { setError(""); setBusy(true); localStorage.setItem("brain-arena-nickname", nickname); socket.emit("room:join", { nickname, roomCode }, (ack: Ack<{room: RoomView; playerId: string}>) => { setBusy(false); if (ack.ok && ack.data) save(ack.data.playerId, ack.data.room); else setError(ack.error ?? "방에 참가하지 못했습니다."); }); }
  function leave() { if (room) socket.emit("room:leave", { roomCode: room.code, playerId }); setRoom(null); setError(""); localStorage.removeItem("brain-arena-session"); }
  return <><ConnectionBadge connected={connected}/>{room ? <RoomPage room={room} playerId={playerId} onLeave={leave} setError={setError}/> : <HomePage nickname={nickname} setNickname={setNickname} onCreate={create} onJoin={join} busy={busy} error={error}/>} {error && room && <button className="toast" onClick={() => setError("")}>{error} <b>×</b></button>}</>;
}
