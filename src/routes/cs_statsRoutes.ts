import { Router } from "express";
import { cs_getCustomerStats, cs_getTechnicianStats } from "../controllers/cs_statsController";
import { verifyCustomer, verifyTechnician, verifyToken } from "../middlewares/cs_authMiddleware";

const cs_statsRouter = Router();

cs_statsRouter.get("/customer", verifyToken, verifyCustomer, cs_getCustomerStats);
cs_statsRouter.get("/technician", verifyToken, verifyTechnician, cs_getTechnicianStats);

export default cs_statsRouter;
