import { Router } from "express";
import { cs_createBooking } from "../controllers/cs_bookingController";
import { verifyCustomer, verifyToken } from "../middlewares/cs_authMiddleware";

const cs_bookingRouter = Router();

cs_bookingRouter.post("/", verifyToken, verifyCustomer, cs_createBooking);

export default cs_bookingRouter;
