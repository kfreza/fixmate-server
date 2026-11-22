import dns from "node:dns";
import { Db, MongoClient } from "mongodb";
import { CS_ACTIVE_BOOKING_STATUSES } from "../utils/cs_constants";
import type { Cs_Booking, Cs_Payment, Cs_Service, Cs_User } from "../cs_types";

// `user` is BetterAuth's collection
export const CS_COLLECTIONS = {
  users: "user",
  services: "services",
  bookings: "bookings",
  payments: "payments",
} as const;

// Runs only locally
if (!process.env.VERCEL) {
  dns.setServers(["8.8.8.8", "8.8.4.4"]);
  dns.promises.setServers(["8.8.8.8", "8.8.4.4"]);
}

// Reuse one connection across serverless calls
const cs_globalCache = globalThis as typeof globalThis & {
  cs_dbPromise?: Promise<Db>;
};

const cs_ensureIndexes = async (cs_db: Db) => {
  await Promise.all([
    cs_db
      .collection(CS_COLLECTIONS.services)
      .createIndexes([
        { key: { approvalStatus: 1, isAvailable: 1, createdAt: -1 } },
        { key: { technicianEmail: 1 } },
      ]),
    cs_db
      .collection(CS_COLLECTIONS.bookings)
      .createIndexes([
        { key: { customerEmail: 1 } },
        { key: { technicianEmail: 1, status: 1 } },
        { key: { serviceId: 1, customerEmail: 1, status: 1 } },
        // One active booking per customer per service, even under races
        {
          key: { serviceId: 1, customerEmail: 1 },
          name: "cs_one_active_booking",
          unique: true,
          partialFilterExpression: { status: { $in: [...CS_ACTIVE_BOOKING_STATUSES] } },
        },
      ]),
    cs_db
      .collection(CS_COLLECTIONS.payments)
      .createIndexes([
        { key: { stripeSessionId: 1 }, unique: true },
        { key: { bookingId: 1 }, unique: true },
      ]),
  ]);
};

const cs_createConnection = async (): Promise<Db> => {
  const cs_uri = process.env.CS_MONGODB_URI;
  if (!cs_uri) {
    throw new Error("CS_MONGODB_URI is not set");
  }

  const cs_client = new MongoClient(cs_uri);
  await cs_client.connect();

  const cs_db = cs_client.db(process.env.CS_DB_NAME || "fixmate");
  await cs_ensureIndexes(cs_db);
  return cs_db;
};

export const cs_connectDb = (): Promise<Db> => {
  if (!cs_globalCache.cs_dbPromise) {
    cs_globalCache.cs_dbPromise = cs_createConnection().catch((cs_error) => {
      // Allow retry on next call
      cs_globalCache.cs_dbPromise = undefined;
      throw cs_error;
    });
  }
  return cs_globalCache.cs_dbPromise;
};

/* ---------- typed collection getters ---------- */

export const cs_usersCollection = async () =>
  (await cs_connectDb()).collection<Cs_User>(CS_COLLECTIONS.users);

export const cs_servicesCollection = async () =>
  (await cs_connectDb()).collection<Cs_Service>(CS_COLLECTIONS.services);

export const cs_bookingsCollection = async () =>
  (await cs_connectDb()).collection<Cs_Booking>(CS_COLLECTIONS.bookings);

export const cs_paymentsCollection = async () =>
  (await cs_connectDb()).collection<Cs_Payment>(CS_COLLECTIONS.payments);
