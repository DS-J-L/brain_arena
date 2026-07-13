export const EVENTS = {
  ROOM_CREATE: "room:create", ROOM_JOIN: "room:join", ROOM_LEAVE: "room:leave",
  ROOM_READY: "room:ready", ROOM_RESTART: "room:restart", PLAYER_RECONNECT: "player:reconnect",
  GAME_ACTION: "game:action", ROOM_UPDATED: "room:updated", ROOM_ERROR: "room:error",
  GAME_STARTED: "game:started", GAME_UPDATED: "game:updated", GAME_FINISHED: "game:finished"
} as const;
