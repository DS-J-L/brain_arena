import express from "express";
import cors from "cors";

export const app = express();
const origins = (process.env.CLIENT_URL ?? "http://localhost:5173").split(",").map(v => v.trim());
app.use(cors({ origin: origins, credentials: true }));
app.use(express.json());
app.get("/health", (_req, res) => res.json({ status: "ok", timestamp: Date.now() }));
app.get("/", (_req, res) => res.json({ name: "Brain Arena API", status: "running" }));
