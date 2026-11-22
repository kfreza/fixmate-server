import { Router } from "express";
import { cs_imageUpload } from "../config/cs_upload";
import { cs_uploadImage } from "../controllers/cs_uploadController";
import { verifyToken } from "../middlewares/cs_authMiddleware";

const cs_uploadRouter = Router();

cs_uploadRouter.post("/", verifyToken, cs_imageUpload.single("image"), cs_uploadImage);

export default cs_uploadRouter;
