import express from "express";
import cors from "cors";
import { cs_corsOptions } from "./config/cs_cors";
import { cs_handleStripeWebhook } from "./controllers/cs_webhookController";
import { cs_errorHandler, cs_notFoundHandler } from "./middlewares/cs_errorHandler";
import cs_adminRouter from "./routes/cs_adminRoutes";
import cs_bookingRouter from "./routes/cs_bookingRoutes";
import cs_healthRouter from "./routes/cs_healthRoutes";
import cs_paymentRouter from "./routes/cs_paymentRoutes";
import cs_serviceRouter from "./routes/cs_serviceRoutes";
import cs_statsRouter from "./routes/cs_statsRoutes";
import cs_technicianRouter from "./routes/cs_technicianRoutes";
import cs_uploadRouter from "./routes/cs_uploadRoutes";
import cs_userRouter from "./routes/cs_userRoutes";

const cs_app = express();

cs_app.use(cors(cs_corsOptions));

// Before express.json(): Stripe signs the exact raw bytes
cs_app.post("/api/payments/webhook", express.raw({ type: "application/json", limit: "1mb" }), cs_handleStripeWebhook);

cs_app.use(express.json());

cs_app.get("/", (_req, res) => {
  res.json({ success: true, message: "FixMate server is running" });
});

cs_app.use("/api/health", cs_healthRouter);
cs_app.use("/api/services", cs_serviceRouter);
cs_app.use("/api/technician", cs_technicianRouter);
cs_app.use("/api/bookings", cs_bookingRouter);
cs_app.use("/api/payments", cs_paymentRouter);
cs_app.use("/api/stats", cs_statsRouter);
cs_app.use("/api/admin", cs_adminRouter);
cs_app.use("/api/upload", cs_uploadRouter);
cs_app.use("/api/users", cs_userRouter);

// Keep last
cs_app.use(cs_notFoundHandler);
cs_app.use(cs_errorHandler);

export default cs_app;
