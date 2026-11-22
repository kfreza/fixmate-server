import { Router } from "express";
import { cs_getFeaturedServices, cs_getServiceById, cs_getServices } from "../controllers/cs_serviceController";
import {
  cs_createService,
  cs_deleteService,
  cs_toggleAvailability,
  cs_updateService,
} from "../controllers/cs_technicianServiceController";
import { cs_getServiceReviews } from "../controllers/cs_reviewController";
import { verifyTechnician, verifyToken } from "../middlewares/cs_authMiddleware";

const cs_serviceRouter = Router();

// Public (static paths before /:id)
cs_serviceRouter.get("/", cs_getServices);
cs_serviceRouter.get("/featured", cs_getFeaturedServices);
cs_serviceRouter.get("/:id", cs_getServiceById);
cs_serviceRouter.get("/:id/reviews", cs_getServiceReviews);

// Technician (owner checks in the controller)
cs_serviceRouter.post("/", verifyToken, verifyTechnician, cs_createService);
cs_serviceRouter.patch("/:id", verifyToken, verifyTechnician, cs_updateService);
cs_serviceRouter.delete("/:id", verifyToken, verifyTechnician, cs_deleteService);
cs_serviceRouter.patch("/:id/availability", verifyToken, verifyTechnician, cs_toggleAvailability);

export default cs_serviceRouter;
