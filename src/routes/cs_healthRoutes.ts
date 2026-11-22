import { Router } from "express";
import { cs_connectDb } from "../config/cs_db";

const cs_healthRouter = Router();

// GET /api/health
cs_healthRouter.get("/", async (_req, res) => {
  let cs_dbStatus = "connected";
  try {
    await (await cs_connectDb()).command({ ping: 1 });
  } catch {
    cs_dbStatus = "disconnected";
  }

  res.status(cs_dbStatus === "connected" ? 200 : 503).json({
    success: cs_dbStatus === "connected",
    server: "running",
    database: cs_dbStatus,
    timestamp: new Date().toISOString(),
  });
});

export default cs_healthRouter;
