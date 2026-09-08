import { io } from "socket.io-client";

const configuredServerUrl = import.meta.env.VITE_SERVER_URL?.trim().replace(/\/$/, "");
export const SERVER_URL = configuredServerUrl || (import.meta.env.DEV ? "http://localhost:3000" : "");
export const SERVER_CONFIGURED = Boolean(SERVER_URL);
export const socket = io(SERVER_URL || "http://invalid.local", {
  autoConnect: false,
  transports: ["websocket", "polling"]
});
