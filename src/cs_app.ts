import express from "express";
import cors from "cors";
import { cs_corsOptions } from "./config/cs_cors";
import { cs_errorHandler, cs_notFoundHandler } from "./middlewares/cs_errorHandler";
import cs_healthRouter from "./routes/cs_healthRoutes";

const cs_app = express();

cs_app.use(cors(cs_corsOptions));
cs_app.use(express.json());

cs_app.get("/", (_req, res) => {
  res.json({ success: true, message: "FixMate server is running" });
});

cs_app.use("/api/health", cs_healthRouter);

// Keep last
cs_app.use(cs_notFoundHandler);
cs_app.use(cs_errorHandler);

export default cs_app;
