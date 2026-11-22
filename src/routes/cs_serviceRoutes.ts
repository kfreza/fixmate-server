import { Router } from "express";
import { cs_getFeaturedServices, cs_getServiceById, cs_getServices } from "../controllers/cs_serviceController";

const cs_serviceRouter = Router();

// Public (static paths before /:id)
cs_serviceRouter.get("/", cs_getServices);
cs_serviceRouter.get("/featured", cs_getFeaturedServices);
cs_serviceRouter.get("/:id", cs_getServiceById);

export default cs_serviceRouter;
