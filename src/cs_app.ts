import express from "express";

const cs_app = express();

cs_app.use(express.json());

cs_app.get("/", (_req, res) => {
  res.json({ success: true, message: "FixMate server is running" });
});

export default cs_app;
