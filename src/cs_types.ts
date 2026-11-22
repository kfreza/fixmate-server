import { ObjectId } from "mongodb";

/* ---------- enums ---------- */

export type Cs_Role = "customer" | "technician" | "admin";

export type Cs_ServiceCategory =
  | "Smartphone"
  | "Laptop & PC"
  | "AC"
  | "Refrigerator"
  | "TV"
  | "Washing Machine"
  | "Electrical";

export type Cs_ServiceMode = "Home Visit" | "Shop Drop-off";

export type Cs_ApprovalStatus = "pending" | "approved" | "rejected";

export type Cs_BookingStatus =
  | "requested"
  | "accepted"
  | "rejected"
  | "in-progress"
  | "completed"
  | "cancelled";

export type Cs_PaymentStatus = "unpaid" | "paid";

/* ---------- collections ---------- */

// BetterAuth `user` collection
export interface Cs_User {
  _id: ObjectId;
  name: string;
  email: string;
  emailVerified?: boolean;
  image?: string | null;
  role: Cs_Role;
  phone?: string;
  area?: string;
  bio?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Cs_Service {
  _id?: ObjectId;
  title: string;
  category: Cs_ServiceCategory;
  description: string;
  image: string;
  basePrice: number;
  estimatedDuration: string;
  serviceMode: Cs_ServiceMode;
  serviceArea: string;
  technicianName: string;
  technicianEmail: string;
  approvalStatus: Cs_ApprovalStatus;
  isAvailable: boolean;
  avgRating?: number;
  reviewCount?: number;
  createdAt: Date;
}

export interface Cs_StatusHistoryItem {
  status: Cs_BookingStatus | "paid";
  changedAt: Date;
}

export interface Cs_Booking {
  _id?: ObjectId;
  serviceId: string;
  serviceTitle: string;
  serviceImage: string;
  category: Cs_ServiceCategory;
  basePrice: number;
  technicianName: string;
  technicianEmail: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  address: string;
  preferredDate: Date;
  problemDescription: string;
  status: Cs_BookingStatus;
  finalAmount: number;
  paymentStatus: Cs_PaymentStatus;
  statusHistory: Cs_StatusHistoryItem[];
  rating?: number;
  review?: string;
  createdAt: Date;
}

export interface Cs_Payment {
  _id?: ObjectId;
  bookingId: string;
  serviceTitle: string;
  customerName: string;
  customerEmail: string;
  technicianName: string;
  technicianEmail: string;
  amount: number;
  currency: "usd";
  transactionId: string;
  stripeSessionId: string;
  paymentStatus: "paid";
  paidAt: Date;
}
