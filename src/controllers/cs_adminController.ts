import type { RequestHandler } from "express";
import type { Filter } from "mongodb";
import { cs_bookingsCollection, cs_paymentsCollection, cs_servicesCollection, cs_usersCollection } from "../config/cs_db";
import type { Cs_ApprovalStatus, Cs_Booking, Cs_BookingStatus, Cs_Role, Cs_Service, Cs_User } from "../cs_types";
import { Cs_AppError } from "../utils/cs_appError";
import { CS_BOOKING_STATUSES } from "../utils/cs_constants";
import { cs_escapeRegex, cs_queryString, cs_toObjectId } from "../utils/cs_query";
import { cs_getAuthUser } from "../utils/cs_request";
import { cs_round } from "../utils/cs_stats";

const CS_ROLES: readonly Cs_Role[] = ["customer", "technician", "admin"];
const CS_APPROVAL_STATUSES: readonly Cs_ApprovalStatus[] = ["pending", "approved", "rejected"];

// Never send auth internals to the client
const CS_USER_PROJECTION = { name: 1, email: 1, image: 1, role: 1, phone: 1, area: 1, createdAt: 1 } as const;

// GET /api/admin/users?role=&search=
export const cs_getUsers: RequestHandler = async (req, res) => {
  const cs_role = cs_queryString(req.query.role);
  const cs_search = cs_queryString(req.query.search).slice(0, 100);
  const cs_filter: Filter<Cs_User> = {};

  if (CS_ROLES.includes(cs_role as Cs_Role)) {
    // Old accounts without a role count as customers
    cs_filter.role = (cs_role === "customer" ? { $in: ["customer", null] } : cs_role) as Filter<Cs_User>["role"];
  }
  if (cs_search) {
    const cs_pattern = { $regex: cs_escapeRegex(cs_search), $options: "i" };
    cs_filter.$or = [{ name: cs_pattern }, { email: cs_pattern }];
  }

  const cs_items = await (await cs_usersCollection())
    .find(cs_filter, { projection: CS_USER_PROJECTION })
    .sort({ createdAt: -1, _id: -1 })
    .toArray();
  res.json({ success: true, items: cs_items.map((cs_user) => ({ ...cs_user, role: cs_user.role ?? "customer" })) });
};

// PATCH /api/admin/users/:id/role { role }
export const cs_updateUserRole: RequestHandler = async (req, res) => {
  const cs_admin = cs_getAuthUser(req);
  const cs_userId = cs_toObjectId(req.params.id, "User not found");
  const cs_role = (req.body as { role?: unknown } | undefined)?.role;

  if (!CS_ROLES.includes(cs_role as Cs_Role)) {
    throw new Cs_AppError(400, `Role must be one of: ${CS_ROLES.join(", ")}`);
  }
  // Stops an admin from locking themselves out
  if (cs_userId.toString() === cs_admin._id) {
    throw new Cs_AppError(403, "You cannot change your own role");
  }

  const cs_updated = await (await cs_usersCollection()).findOneAndUpdate(
    { _id: cs_userId },
    { $set: { role: cs_role as Cs_Role, updatedAt: new Date() } },
    { returnDocument: "after", projection: CS_USER_PROJECTION },
  );
  if (!cs_updated) throw new Cs_AppError(404, "User not found");

  res.json({ success: true, message: `${cs_updated.name} is now ${cs_role === "admin" ? "an" : "a"} ${cs_role}`, user: cs_updated });
};

// GET /api/admin/services?status= (pending first)
export const cs_getAllServices: RequestHandler = async (req, res) => {
  const cs_status = cs_queryString(req.query.status);
  const cs_match: Filter<Cs_Service> = CS_APPROVAL_STATUSES.includes(cs_status as Cs_ApprovalStatus)
    ? { approvalStatus: cs_status as Cs_ApprovalStatus }
    : {};

  const cs_items = await (await cs_servicesCollection())
    .aggregate([
      { $match: cs_match },
      {
        $addFields: {
          sortRank: { $switch: { branches: [{ case: { $eq: ["$approvalStatus", "pending"] }, then: 0 }], default: 1 } },
        },
      },
      { $sort: { sortRank: 1, createdAt: -1, _id: -1 } },
      { $project: { sortRank: 0 } },
    ])
    .toArray();
  res.json({ success: true, items: cs_items });
};

// PATCH /api/admin/services/:id/approval { approvalStatus }
export const cs_updateServiceApproval: RequestHandler = async (req, res) => {
  const cs_serviceId = cs_toObjectId(req.params.id, "Service not found");
  const cs_status = (req.body as { approvalStatus?: unknown } | undefined)?.approvalStatus;

  if (cs_status !== "approved" && cs_status !== "rejected") {
    throw new Cs_AppError(400, "approvalStatus must be approved or rejected");
  }

  const cs_updated = await (await cs_servicesCollection()).findOneAndUpdate(
    { _id: cs_serviceId },
    { $set: { approvalStatus: cs_status, updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (!cs_updated) throw new Cs_AppError(404, "Service not found");

  res.json({ success: true, message: `Service ${cs_status}`, service: cs_updated });
};

// GET /api/admin/bookings?status= (read-only)
export const cs_getAllBookings: RequestHandler = async (req, res) => {
  const cs_status = cs_queryString(req.query.status);
  const cs_filter: Filter<Cs_Booking> = CS_BOOKING_STATUSES.includes(cs_status as Cs_BookingStatus)
    ? { status: cs_status as Cs_BookingStatus }
    : {};

  const cs_items = await (await cs_bookingsCollection()).find(cs_filter).sort({ createdAt: -1, _id: -1 }).toArray();
  res.json({ success: true, items: cs_items });
};

// GET /api/admin/payments
export const cs_getAllPayments: RequestHandler = async (_req, res) => {
  const cs_items = await (await cs_paymentsCollection()).find().sort({ paidAt: -1, _id: -1 }).toArray();
  const cs_totalRevenue = cs_round(cs_items.reduce((cs_sum, cs_payment) => cs_sum + (cs_payment.amount ?? 0), 0));
  res.json({ success: true, items: cs_items, totalRevenue: cs_totalRevenue, count: cs_items.length });
};
