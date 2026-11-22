import { Router } from "express";
import { cs_getMyServices } from "../controllers/cs_technicianServiceController";
import { verifyTechnician, verifyToken } from "../middlewares/cs_authMiddleware";

const cs_technicianRouter = Router();

// Every route here is technician-only
cs_technicianRouter.use(verifyToken, verifyTechnician);

cs_technicianRouter.get("/services", cs_getMyServices);

export default cs_technicianRouter;
