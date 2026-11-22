import { Router } from "express";
import {
  cs_cancelBooking,
  cs_createBooking,
  cs_getMyBookings,
  cs_getTechnicianBookings,
  cs_updateBookingStatus,
} from "../controllers/cs_bookingController";
import { cs_addReview } from "../controllers/cs_reviewController";
import { verifyCustomer, verifyTechnician, verifyToken } from "../middlewares/cs_authMiddleware";

const cs_bookingRouter = Router();

// Customer
cs_bookingRouter.post("/", verifyToken, verifyCustomer, cs_createBooking);
cs_bookingRouter.get("/my", verifyToken, verifyCustomer, cs_getMyBookings);
cs_bookingRouter.patch("/:id/cancel", verifyToken, verifyCustomer, cs_cancelBooking);
cs_bookingRouter.patch("/:id/review", verifyToken, verifyCustomer, cs_addReview);

// Technician
cs_bookingRouter.get("/technician", verifyToken, verifyTechnician, cs_getTechnicianBookings);
cs_bookingRouter.patch("/:id/status", verifyToken, verifyTechnician, cs_updateBookingStatus);

export default cs_bookingRouter;
