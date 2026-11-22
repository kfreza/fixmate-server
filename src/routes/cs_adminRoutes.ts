import { Router } from "express";
import { cs_getAdminStats } from "../controllers/cs_statsController";
import { verifyAdmin, verifyToken } from "../middlewares/cs_authMiddleware";

const cs_adminRouter = Router();

// Every route here is admin-only
cs_adminRouter.use(verifyToken, verifyAdmin);

cs_adminRouter.get("/stats", cs_getAdminStats);

export default cs_adminRouter;
