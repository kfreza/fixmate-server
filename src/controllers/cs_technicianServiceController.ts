import type { Request, RequestHandler } from "express";
import { cs_bookingsCollection, cs_servicesCollection } from "../config/cs_db";
import type { Cs_Service } from "../cs_types";
import { Cs_AppError } from "../utils/cs_appError";
import { CS_ACTIVE_BOOKING_STATUSES } from "../utils/cs_constants";
import { cs_toObjectId } from "../utils/cs_query";
import { cs_getAuthUser } from "../utils/cs_request";
import { cs_validateServiceInput, type Cs_ServiceInput } from "../validators/cs_serviceValidator";

// 404 if missing, 403 if someone else's
const cs_findOwnedService = async (req: Request) => {
  const cs_user = cs_getAuthUser(req);
  const cs_serviceId = cs_toObjectId(req.params.id, "Service not found");
  const cs_service = await (await cs_servicesCollection()).findOne({ _id: cs_serviceId });
  if (!cs_service) throw new Cs_AppError(404, "Service not found");
  if (cs_service.technicianEmail !== cs_user.email) {
    throw new Cs_AppError(403, "Forbidden: you can only manage your own services");
  }
  return cs_service;
};

// POST /api/services
export const cs_createService: RequestHandler = async (req, res) => {
  const cs_user = cs_getAuthUser(req);
  const cs_input = cs_validateServiceInput(req.body) as Cs_ServiceInput;

  const cs_service: Cs_Service = {
    ...cs_input,
    technicianName: cs_user.name,
    technicianEmail: cs_user.email,
    approvalStatus: "pending",
    isAvailable: true,
    createdAt: new Date(),
  };
  const { insertedId: cs_insertedId } = await (await cs_servicesCollection()).insertOne(cs_service);

  res.status(201).json({
    success: true,
    message: "Service submitted for admin approval",
    service: { ...cs_service, _id: cs_insertedId },
  });
};

// GET /api/technician/services
export const cs_getMyServices: RequestHandler = async (req, res) => {
  const cs_user = cs_getAuthUser(req);
  const cs_items = await (await cs_servicesCollection())
    .find({ technicianEmail: cs_user.email })
    .sort({ createdAt: -1, _id: -1 })
    .toArray();

  res.json({ success: true, items: cs_items });
};

// PATCH /api/services/:id (any edit needs re-approval)
export const cs_updateService: RequestHandler = async (req, res) => {
  const cs_service = await cs_findOwnedService(req);
  const cs_input = cs_validateServiceInput(req.body, true);

  const cs_updated = await (await cs_servicesCollection()).findOneAndUpdate(
    { _id: cs_service._id, technicianEmail: cs_service.technicianEmail },
    { $set: { ...cs_input, approvalStatus: "pending", updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (!cs_updated) throw new Cs_AppError(404, "Service not found");

  res.json({ success: true, message: "Service updated and sent for re-approval", service: cs_updated });
};

// DELETE /api/services/:id
export const cs_deleteService: RequestHandler = async (req, res) => {
  const cs_service = await cs_findOwnedService(req);

  const cs_activeCount = await (await cs_bookingsCollection()).countDocuments({
    serviceId: cs_service._id!.toString(),
    status: { $in: [...CS_ACTIVE_BOOKING_STATUSES] },
  });
  if (cs_activeCount) {
    throw new Cs_AppError(409, "This service has active bookings. Finish or close them first, or mark it unavailable.");
  }

  await (await cs_servicesCollection()).deleteOne({ _id: cs_service._id, technicianEmail: cs_service.technicianEmail });
  res.json({ success: true, message: "Service deleted" });
};

// PATCH /api/services/:id/availability (atomic flip)
export const cs_toggleAvailability: RequestHandler = async (req, res) => {
  const cs_service = await cs_findOwnedService(req);

  const cs_updated = await (await cs_servicesCollection()).findOneAndUpdate(
    { _id: cs_service._id, technicianEmail: cs_service.technicianEmail },
    [{ $set: { isAvailable: { $not: "$isAvailable" }, updatedAt: "$$NOW" } }],
    { returnDocument: "after" },
  );
  if (!cs_updated) throw new Cs_AppError(404, "Service not found");

  res.json({
    success: true,
    message: cs_updated.isAvailable ? "Service is now available" : "Service is now unavailable",
    service: cs_updated,
  });
};
