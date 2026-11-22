import type { RequestHandler } from "express";
import { cs_bookingsCollection, cs_paymentsCollection, cs_servicesCollection, cs_usersCollection } from "../config/cs_db";
import type { Cs_Role, Cs_ServiceCategory } from "../cs_types";
import { CS_ACTIVE_BOOKING_STATUSES, CS_CATEGORIES } from "../utils/cs_constants";
import { cs_getAuthUser } from "../utils/cs_request";
import { cs_countByStatus, cs_countOf, cs_round, cs_sumPayments } from "../utils/cs_stats";

const CS_ROLES: readonly Cs_Role[] = ["customer", "technician", "admin"];

// GET /api/stats/customer
export const cs_getCustomerStats: RequestHandler = async (req, res) => {
  const { email: cs_email } = cs_getAuthUser(req);
  const cs_bookings = await cs_bookingsCollection();

  const [cs_byStatus, cs_payments, cs_unpaid] = await Promise.all([
    cs_countByStatus(cs_bookings, { customerEmail: cs_email }),
    cs_sumPayments(await cs_paymentsCollection(), { customerEmail: cs_email }),
    cs_bookings
      .aggregate<{ count: number; amount: number }>([
        { $match: { customerEmail: cs_email, status: "completed", paymentStatus: "unpaid" } },
        { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: "$finalAmount" } } },
      ])
      .toArray(),
  ]);

  res.json({
    success: true,
    stats: {
      totalBookings: cs_countOf(cs_byStatus, cs_byStatus.map((cs_row) => cs_row.status)),
      activeBookings: cs_countOf(cs_byStatus, CS_ACTIVE_BOOKING_STATUSES),
      completedBookings: cs_countOf(cs_byStatus, ["completed"]),
      cancelledBookings: cs_countOf(cs_byStatus, ["cancelled", "rejected"]),
      totalSpent: cs_payments.total,
      unpaidCount: cs_unpaid[0]?.count ?? 0,
      unpaidAmount: cs_round(cs_unpaid[0]?.amount ?? 0),
    },
    charts: { bookingsByStatus: cs_byStatus, monthlySpending: cs_payments.monthly },
  });
};

// GET /api/stats/technician
export const cs_getTechnicianStats: RequestHandler = async (req, res) => {
  const { email: cs_email } = cs_getAuthUser(req);

  const [cs_byStatus, cs_payments, cs_services] = await Promise.all([
    cs_countByStatus(await cs_bookingsCollection(), { technicianEmail: cs_email }),
    cs_sumPayments(await cs_paymentsCollection(), { technicianEmail: cs_email }),
    (await cs_servicesCollection())
      .aggregate<{ _id: string; count: number }>([
        { $match: { technicianEmail: cs_email } },
        { $group: { _id: "$approvalStatus", count: { $sum: 1 } } },
      ])
      .toArray(),
  ]);
  const cs_serviceCount = (cs_status: string) => cs_services.find((cs_row) => cs_row._id === cs_status)?.count ?? 0;

  res.json({
    success: true,
    stats: {
      totalServices: cs_services.reduce((cs_sum, cs_row) => cs_sum + cs_row.count, 0),
      approvedServices: cs_serviceCount("approved"),
      pendingServices: cs_serviceCount("pending"),
      totalJobs: cs_countOf(cs_byStatus, cs_byStatus.map((cs_row) => cs_row.status)),
      newRequests: cs_countOf(cs_byStatus, ["requested"]),
      activeJobs: cs_countOf(cs_byStatus, ["accepted", "in-progress"]),
      completedJobs: cs_countOf(cs_byStatus, ["completed"]),
      totalEarnings: cs_payments.total,
    },
    charts: { jobsByStatus: cs_byStatus, monthlyEarnings: cs_payments.monthly },
  });
};

// GET /api/admin/stats
export const cs_getAdminStats: RequestHandler = async (_req, res) => {
  const [cs_users, cs_services, cs_byStatus, cs_payments] = await Promise.all([
    (await cs_usersCollection())
      .aggregate<{ _id: Cs_Role; count: number }>([
        // Users made before roles existed count as customers
        { $group: { _id: { $ifNull: ["$role", "customer"] }, count: { $sum: 1 } } },
      ])
      .toArray(),
    (await cs_servicesCollection())
      .aggregate<{ byApproval: { _id: string; count: number }[]; byCategory: { _id: Cs_ServiceCategory; count: number }[] }>([
        {
          $facet: {
            byApproval: [{ $group: { _id: "$approvalStatus", count: { $sum: 1 } } }],
            byCategory: [{ $match: { approvalStatus: "approved" } }, { $group: { _id: "$category", count: { $sum: 1 } } }],
          },
        },
      ])
      .toArray(),
    cs_countByStatus(await cs_bookingsCollection(), {}),
    cs_sumPayments(await cs_paymentsCollection(), {}),
  ]);

  const cs_usersByRole = CS_ROLES.map((cs_role) => ({
    role: cs_role,
    count: cs_users.find((cs_row) => cs_row._id === cs_role)?.count ?? 0,
  }));
  const { byApproval: cs_byApproval = [], byCategory: cs_byCategory = [] } = cs_services[0] ?? {};
  const cs_approvalCount = (cs_status: string) => cs_byApproval.find((cs_row) => cs_row._id === cs_status)?.count ?? 0;

  res.json({
    success: true,
    stats: {
      totalUsers: cs_usersByRole.reduce((cs_sum, cs_row) => cs_sum + cs_row.count, 0),
      totalCustomers: cs_usersByRole[0].count,
      totalTechnicians: cs_usersByRole[1].count,
      totalServices: cs_byApproval.reduce((cs_sum, cs_row) => cs_sum + cs_row.count, 0),
      pendingServices: cs_approvalCount("pending"),
      totalBookings: cs_countOf(cs_byStatus, cs_byStatus.map((cs_row) => cs_row.status)),
      activeBookings: cs_countOf(cs_byStatus, CS_ACTIVE_BOOKING_STATUSES),
      totalRevenue: cs_payments.total,
      totalPayments: cs_payments.count,
    },
    charts: {
      bookingsByStatus: cs_byStatus,
      monthlyRevenue: cs_payments.monthly,
      servicesByCategory: CS_CATEGORIES.map((cs_category) => ({
        category: cs_category,
        count: cs_byCategory.find((cs_row) => cs_row._id === cs_category)?.count ?? 0,
      })),
      usersByRole: cs_usersByRole,
    },
  });
};
