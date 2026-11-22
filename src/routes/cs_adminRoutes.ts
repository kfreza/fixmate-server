import { Router } from "express";
import {
  cs_getAllBookings,
  cs_getAllPayments,
  cs_getAllServices,
  cs_getUsers,
  cs_updateServiceApproval,
  cs_updateUserRole,
} from "../controllers/cs_adminController";
import { cs_getAdminStats } from "../controllers/cs_statsController";
import { verifyAdmin, verifyToken } from "../middlewares/cs_authMiddleware";

const cs_adminRouter = Router();

// Every route here is admin-only
cs_adminRouter.use(verifyToken, verifyAdmin);

cs_adminRouter.get("/stats", cs_getAdminStats);
cs_adminRouter.get("/users", cs_getUsers);
cs_adminRouter.patch("/users/:id/role", cs_updateUserRole);
cs_adminRouter.get("/services", cs_getAllServices);
cs_adminRouter.patch("/services/:id/approval", cs_updateServiceApproval);
cs_adminRouter.get("/bookings", cs_getAllBookings);
cs_adminRouter.get("/payments", cs_getAllPayments);

export default cs_adminRouter;
