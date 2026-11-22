import { Router } from "express";
import { cs_updateProfile } from "../controllers/cs_userController";
import { verifyToken } from "../middlewares/cs_authMiddleware";

const cs_userRouter = Router();

cs_userRouter.patch("/profile", verifyToken, cs_updateProfile);

export default cs_userRouter;
