import { Router } from "express";
import { cs_createCheckoutSession } from "../controllers/cs_paymentController";
import { verifyCustomer, verifyToken } from "../middlewares/cs_authMiddleware";

const cs_paymentRouter = Router();

cs_paymentRouter.post("/create-checkout-session", verifyToken, verifyCustomer, cs_createCheckoutSession);

export default cs_paymentRouter;
