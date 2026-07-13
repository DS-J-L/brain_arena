import { createServer } from "node:http";
import { Server } from "socket.io";
import { app } from "./app.js";
import { RoomManager } from "./rooms/roomManager.js";
import { registerHandlers } from "./socket/handlers.js";

const httpServer = createServer(app);
const origins = (process.env.CLIENT_URL ?? "http://localhost:5173").split(",").map(v => v.trim());
const io = new Server(httpServer, { cors: { origin: origins, credentials: true } });
const rooms = new RoomManager();
io.on("connection", socket => { console.log(`[socket] connected ${socket.id}`); registerHandlers(io, socket, rooms); });
setInterval(() => {
  for (const room of rooms.processDeadlines()) {
    const event = room.status === "FINISHED" ? "game:finished" : "game:updated";
    for (const player of room.players) io.to(player.socketId).emit(event, rooms.view(room, player.id));
  }
}, 500).unref();
const port = Number(process.env.PORT ?? 3000);
httpServer.listen(port, "0.0.0.0", () => console.log(`Brain Arena server running on ${port}`));
