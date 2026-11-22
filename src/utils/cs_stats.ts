import type { Collection, Document, Filter } from "mongodb";
import type { Cs_Booking, Cs_BookingStatus, Cs_Payment } from "../cs_types";
import { CS_BOOKING_STATUSES, CS_TIMEZONE } from "./cs_constants";

export const CS_CHART_MONTHS = 6;

// Last n months in Dhaka time, oldest first: { month: "2026-06", label: "Jun" }
export const cs_getRecentMonths = (cs_count = CS_CHART_MONTHS) => {
  const cs_parts = new Intl.DateTimeFormat("en-CA", { timeZone: CS_TIMEZONE, year: "numeric", month: "2-digit" })
    .formatToParts(new Date())
    .reduce<Record<string, string>>((cs_acc, cs_part) => ({ ...cs_acc, [cs_part.type]: cs_part.value }), {});
  const cs_year = Number(cs_parts.year);
  const cs_month = Number(cs_parts.month) - 1;

  return Array.from({ length: cs_count }, (_, cs_index) => {
    const cs_date = new Date(Date.UTC(cs_year, cs_month - (cs_count - 1 - cs_index), 1));
    return {
      month: cs_date.toISOString().slice(0, 7),
      label: cs_date.toLocaleString("en-US", { month: "short", timeZone: "UTC" }),
    };
  });
};

// Start of the oldest chart month (a little early is fine; grouping is by Dhaka month)
const cs_chartStart = () => new Date(`${cs_getRecentMonths()[0].month}-01T00:00:00.000Z`).getTime() - 86_400_000;

// Count per status, every status present (0 if none)
export const cs_countByStatus = async (cs_bookings: Collection<Cs_Booking>, cs_match: Filter<Cs_Booking>) => {
  const cs_rows = await cs_bookings
    .aggregate<{ _id: Cs_BookingStatus; count: number }>([{ $match: cs_match }, { $group: { _id: "$status", count: { $sum: 1 } } }])
    .toArray();
  return CS_BOOKING_STATUSES.map((cs_status) => ({
    status: cs_status,
    count: cs_rows.find((cs_row) => cs_row._id === cs_status)?.count ?? 0,
  }));
};

// Paid amount per month for the last 6 months, plus the all-time total
export const cs_sumPayments = async (cs_payments: Collection<Cs_Payment>, cs_match: Filter<Cs_Payment>) => {
  const cs_months = cs_getRecentMonths();
  const [cs_result] = await cs_payments
    .aggregate<{ total: { amount: number; count: number }[]; monthly: { _id: string; amount: number }[] }>([
      { $match: cs_match },
      {
        $facet: {
          total: [{ $group: { _id: null, amount: { $sum: "$amount" }, count: { $sum: 1 } } }],
          monthly: [
            { $match: { paidAt: { $gte: new Date(cs_chartStart()) } } },
            {
              $group: {
                _id: { $dateToString: { format: "%Y-%m", date: "$paidAt", timezone: CS_TIMEZONE } },
                amount: { $sum: "$amount" },
              },
            },
          ],
        },
      },
    ] as Document[])
    .toArray();

  return {
    total: cs_round(cs_result?.total[0]?.amount ?? 0),
    count: cs_result?.total[0]?.count ?? 0,
    monthly: cs_months.map((cs_month) => ({
      ...cs_month,
      amount: cs_round(cs_result?.monthly.find((cs_row) => cs_row._id === cs_month.month)?.amount ?? 0),
    })),
  };
};

export const cs_round = (cs_value: number) => Math.round(cs_value * 100) / 100;

export const cs_countOf = (cs_rows: { status: Cs_BookingStatus; count: number }[], cs_statuses: readonly Cs_BookingStatus[]) =>
  cs_rows.filter((cs_row) => cs_statuses.includes(cs_row.status)).reduce((cs_sum, cs_row) => cs_sum + cs_row.count, 0);
