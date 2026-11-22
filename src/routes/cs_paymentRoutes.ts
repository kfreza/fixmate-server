import { Router } from "express";
import { cs_createCheckoutSession, cs_getMyPayments, cs_verifyCheckoutSession } from "../controllers/cs_paymentController";
import { verifyCustomer, verifyToken } from "../middlewares/cs_authMiddleware";

const cs_paymentRouter = Router();

cs_paymentRouter.post("/create-checkout-session", verifyToken, verifyCustomer, cs_createCheckoutSession);
cs_paymentRouter.get("/verify", verifyToken, verifyCustomer, cs_verifyCheckoutSession);
cs_paymentRouter.get("/my", verifyToken, verifyCustomer, cs_getMyPayments);

export default cs_paymentRouter;
