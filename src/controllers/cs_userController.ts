import type { RequestHandler } from "express";
import { ObjectId } from "mongodb";
import { cs_servicesCollection, cs_usersCollection } from "../config/cs_db";
import { Cs_AppError } from "../utils/cs_appError";
import { cs_getAuthUser } from "../utils/cs_request";
import { cs_validateProfileInput } from "../validators/cs_profileValidator";

const CS_PROFILE_PROJECTION = { name: 1, email: 1, image: 1, role: 1, phone: 1, area: 1, bio: 1 } as const;

// PATCH /api/users/profile (any logged-in user)
export const cs_updateProfile: RequestHandler = async (req, res) => {
  const cs_user = cs_getAuthUser(req);
  const cs_changes = cs_validateProfileInput(req.body);

  const cs_updated = await (await cs_usersCollection()).findOneAndUpdate(
    { _id: new ObjectId(cs_user._id) },
    {
      $set: { ...cs_changes.set, updatedAt: new Date() },
      ...(cs_changes.unset.length ? { $unset: Object.fromEntries(cs_changes.unset.map((cs_field) => [cs_field, ""])) } : {}),
    },
    { returnDocument: "after", projection: CS_PROFILE_PROJECTION },
  );
  if (!cs_updated) throw new Cs_AppError(404, "User not found");

  // Keep public listings in sync; past bookings keep their snapshot
  if (cs_changes.set.name && cs_updated.role === "technician") {
    await (await cs_servicesCollection()).updateMany(
      { technicianEmail: cs_updated.email },
      { $set: { technicianName: cs_changes.set.name } },
    );
  }

  res.json({ success: true, message: "Profile updated", user: cs_updated });
};
