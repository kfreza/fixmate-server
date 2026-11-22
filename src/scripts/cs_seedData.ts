// Seed demo services, bookings, payments and reviews. Run: npm run seed:data [-- --reset]
import "dotenv/config";
import type { ObjectId } from "mongodb";
import {
  cs_bookingsCollection,
  cs_connectDb,
  cs_paymentsCollection,
  cs_servicesCollection,
  cs_usersCollection,
} from "../config/cs_db";
import { cs_refreshServiceRating } from "../controllers/cs_reviewController";
import type { Cs_Booking, Cs_BookingStatus, Cs_Service, Cs_ServiceCategory, Cs_ServiceMode, Cs_ApprovalStatus } from "../cs_types";

// Same accounts as fixmate-client/scripts/cs_seedUsers.ts
const CS_TECHNICIANS = ["rafiq@fixmate.test", "nusrat@fixmate.test", "tanvir@fixmate.test"];
const CS_CUSTOMERS = ["nadia@fixmate.test", "karim@fixmate.test", "farhana@fixmate.test"];
const CS_DAY = 86_400_000;

// Every image was checked to load and to match its category
const cs_img = (cs_id: string) => `https://images.unsplash.com/${cs_id}?w=800&q=70`;

type Cs_SeedService = [
  key: string,
  tech: number,
  title: string,
  category: Cs_ServiceCategory,
  image: string,
  price: number,
  duration: string,
  mode: Cs_ServiceMode,
  status: Cs_ApprovalStatus,
  description: string,
];

const CS_SERVICES: Cs_SeedService[] = [
  ["phoneScreen", 0, "iPhone & Android Screen Replacement", "Smartphone", "photo-1511707171634-5f897ff02aa9", 35, "1-2 hours", "Shop Drop-off", "approved", "Cracked or unresponsive screen? We fit a high-quality panel, test touch and display, and add a free screen protector. 30-day warranty."],
  ["phoneBattery", 0, "Phone Battery & Charging Port Repair", "Smartphone", "photo-1581092921461-eab62e97a780", 20, "1 hour", "Shop Drop-off", "approved", "Battery draining fast or the charger keeps disconnecting? We replace worn batteries and clean or swap faulty charging ports."],
  ["tabletScreen", 0, "iPad & Tablet Screen Repair", "Smartphone", "photo-1544244015-0df4b3ffc6b0", 45, "1 day", "Shop Drop-off", "approved", "Glass and display replacement for iPads and Android tablets, with a full touch test before you collect it."],
  ["laptopBoard", 0, "Laptop Motherboard & Chip-Level Repair", "Laptop & PC", "photo-1496181133206-80ce9b88a853", 60, "2-3 days", "Shop Drop-off", "approved", "No power, no display or water damage? Chip-level diagnosis and repair for all major laptop brands, with a written report."],
  ["laptopKeyboard", 0, "Laptop Keyboard & Battery Replacement", "Laptop & PC", "photo-1517336714731-489689fd1ca8", 30, "2 hours", "Home Visit", "approved", "Broken keys or a battery that no longer holds charge? We bring original-grade parts and replace them at your home."],
  ["acService", 1, "AC Gas Refill & Full Servicing", "AC", "photo-1647022528152-52ed9338611d", 25, "2 hours", "Home Visit", "approved", "Gas top-up, leak check, filter and coil cleaning for split and window ACs. Your AC cools faster and uses less power."],
  ["acInstall", 1, "Split AC Installation & Shifting", "AC", "photo-1621905251189-08b45d6a269e", 40, "3 hours", "Home Visit", "approved", "Safe installation or shifting of split ACs, with bracket fitting, piping and a full cooling test after setup."],
  ["fridgeCooling", 1, "Refrigerator Cooling Problem Fix", "Refrigerator", "photo-1571175443880-49e1d25b2bc5", 30, "3 hours", "Home Visit", "approved", "Fridge not cooling, freezing too much or making noise? We find the cause on the spot and fix thermostat, fan or relay faults."],
  ["fridgeCompressor", 1, "Fridge Gas Leak & Compressor Repair", "Refrigerator", "photo-1584568694244-14fbdf83bd30", 55, "1 day", "Home Visit", "approved", "Leak detection, brazing and gas recharge, plus compressor repair or replacement for single and double door fridges."],
  ["tvPanel", 2, "LED TV Panel & Backlight Repair", "TV", "photo-1593359677879-a4bb92f829d1", 45, "1 day", "Shop Drop-off", "approved", "Dark screen, lines or flicker? We repair backlights and panels for LED and Smart TVs from 32 to 65 inches."],
  ["tvBoard", 2, "Smart TV Software & Board Repair", "TV", "photo-1593784991095-a205069470b6", 35, "1 day", "Shop Drop-off", "approved", "Boot loops, apps not opening or no sound? Software reflash and main board repair for all popular Smart TV brands."],
  ["washerDrum", 2, "Washing Machine Drum & Motor Repair", "Washing Machine", "photo-1626806787461-102c1bfaaea1", 28, "2-3 hours", "Home Visit", "approved", "Drum not spinning or making a loud noise? We fix bearings, belts and motors for front and top loading machines."],
  ["washerLeak", 2, "Washing Machine Water Leak Fix", "Washing Machine", "photo-1610557892470-55d9e80c0bce", 22, "1-2 hours", "Home Visit", "approved", "Water on the floor after every wash? We replace door seals, hoses and pumps and test a full cycle before leaving."],
  ["wiring", 2, "House Wiring & Switchboard Repair", "Electrical", "photo-1621905252507-b35492cc74b4", 15, "1 hour", "Home Visit", "approved", "Sparking sockets, tripping breakers or dead switches? Safe repair and replacement by a licensed electrician."],
  ["fanFitting", 2, "Ceiling Fan & Light Fitting Installation", "Electrical", "photo-1621905251918-48416bd8575a", 12, "1 hour", "Home Visit", "approved", "Installation of ceiling fans, lights and regulators, including wiring checks and safe mounting."],
  ["macbook", 0, "MacBook Logic Board Repair", "Laptop & PC", "photo-1517336714731-489689fd1ca8", 90, "3-4 days", "Shop Drop-off", "pending", "Specialist logic board repair for MacBook Air and Pro models, including liquid damage cleaning."],
  ["freezer", 1, "Deep Freezer Repair", "Refrigerator", "photo-1536353284924-9220c464e262", 50, "1 day", "Home Visit", "pending", "Repair for chest and upright deep freezers: thermostat, gas and compressor problems, done at your home or shop."],
  ["homeTheatre", 2, "Home Theatre Setup", "TV", "photo-1461151304267-38535e780c79", 20, "2 hours", "Home Visit", "rejected", "Speaker placement, wiring and sound setup for home theatre systems."],
];

type Cs_SeedBooking = {
  service: string;
  customer: number;
  status: Cs_BookingStatus;
  paidDaysAgo?: number;
  finalAmount?: number;
  rating?: number;
  review?: string;
  problem: string;
};

// One or more bookings in every status; paid ones spread over months for the charts
const CS_BOOKINGS: Cs_SeedBooking[] = [
  { service: "acService", customer: 0, status: "requested", problem: "The bedroom AC runs but the air is not cold any more." },
  { service: "laptopBoard", customer: 1, status: "accepted", problem: "Laptop shows no display after a power cut, only the fan spins." },
  { service: "tvPanel", customer: 2, status: "in-progress", problem: "Half of the TV screen has gone dark with vertical lines." },
  { service: "washerDrum", customer: 0, status: "completed", finalAmount: 32, problem: "Drum makes a grinding sound and stops during the spin cycle." },
  { service: "phoneScreen", customer: 1, status: "completed", paidDaysAgo: 150, finalAmount: 35, rating: 5, review: "Screen looks brand new and the work was done in an hour.", problem: "Dropped my phone and the screen shattered." },
  { service: "phoneScreen", customer: 2, status: "completed", paidDaysAgo: 95, finalAmount: 38, rating: 4, review: "Good repair, took a little longer than promised but fair price.", problem: "Touch stopped working on the lower part of the screen." },
  { service: "fridgeCooling", customer: 0, status: "completed", paidDaysAgo: 60, finalAmount: 30, rating: 5, review: "Came on time, explained the fault and fixed the cooling the same day.", problem: "Fridge is not cooling, the freezer is fine." },
  { service: "acService", customer: 1, status: "completed", paidDaysAgo: 30, finalAmount: 28, rating: 4, review: "AC cools much better now. Very polite technician.", problem: "AC needs servicing before summer, cooling is weak." },
  { service: "wiring", customer: 2, status: "completed", paidDaysAgo: 10, finalAmount: 18, rating: 5, review: "Fixed the sparking switchboard safely and quickly.", problem: "The kitchen switchboard sparks when I turn on the oven." },
  { service: "laptopKeyboard", customer: 0, status: "completed", paidDaysAgo: 3, finalAmount: 30, problem: "Several keys are not working and the battery dies in 20 minutes." },
  { service: "tvBoard", customer: 2, status: "rejected", problem: "TV keeps restarting on the logo screen." },
  { service: "washerLeak", customer: 1, status: "cancelled", problem: "Water leaks from the front door during the wash." },
];

const cs_seedData = async () => {
  const cs_db = await cs_connectDb();
  const cs_host = (process.env.CS_MONGODB_URI ?? "").replace(/^mongodb(\+srv)?:\/\//, "").split("@").pop()?.split("/")[0]?.split("?")[0];
  console.log(`Seeding data into ${cs_db.databaseName} @ ${cs_host}`);

  const cs_users = await (await cs_usersCollection()).find({ email: { $in: [...CS_TECHNICIANS, ...CS_CUSTOMERS] } }).toArray();
  const cs_userByEmail = new Map(cs_users.map((cs_user) => [cs_user.email, cs_user]));
  const cs_missing = [...CS_TECHNICIANS, ...CS_CUSTOMERS].filter((cs_email) => !cs_userByEmail.has(cs_email));
  if (cs_missing.length) {
    throw new Error(`Missing users: ${cs_missing.join(", ")}. Run "npm run seed:users" in fixmate-client first.`);
  }

  const cs_services = await cs_servicesCollection();
  const cs_bookings = await cs_bookingsCollection();
  const cs_payments = await cs_paymentsCollection();
  const cs_techFilter = { technicianEmail: { $in: CS_TECHNICIANS } };

  // Never mix two seeds; --reset removes only the demo technicians' data
  if (await cs_services.countDocuments(cs_techFilter)) {
    if (!process.argv.includes("--reset")) {
      console.log('Demo data already exists. Run "npm run seed:data -- --reset" to replace it.');
      return;
    }
    const [cs_s, cs_b, cs_p] = await Promise.all([
      cs_services.deleteMany(cs_techFilter),
      cs_bookings.deleteMany(cs_techFilter),
      cs_payments.deleteMany(cs_techFilter),
    ]);
    console.log(`Reset: removed ${cs_s.deletedCount} services, ${cs_b.deletedCount} bookings, ${cs_p.deletedCount} payments`);
  }

  const cs_now = Date.now();
  const cs_serviceIds = new Map<string, ObjectId>();
  const cs_serviceByKey = new Map<string, Cs_Service>();

  for (const [cs_index, cs_row] of CS_SERVICES.entries()) {
    const [cs_key, cs_tech, cs_title, cs_category, cs_image, cs_price, cs_duration, cs_mode, cs_status, cs_description] = cs_row;
    const cs_owner = cs_userByEmail.get(CS_TECHNICIANS[cs_tech])!;
    const cs_service: Cs_Service = {
      title: cs_title,
      category: cs_category,
      description: cs_description,
      image: cs_img(cs_image),
      basePrice: cs_price,
      estimatedDuration: cs_duration,
      serviceMode: cs_mode,
      serviceArea: cs_owner.area ?? "Dhaka",
      technicianName: cs_owner.name,
      technicianEmail: cs_owner.email,
      approvalStatus: cs_status,
      isAvailable: true,
      avgRating: 0,
      reviewCount: 0,
      // Spread over the last ~6 months so "newest" sorting looks natural
      createdAt: new Date(cs_now - (180 - cs_index * 9) * CS_DAY),
    };
    const { insertedId: cs_insertedId } = await cs_services.insertOne(cs_service);
    cs_serviceIds.set(cs_key, cs_insertedId);
    cs_serviceByKey.set(cs_key, cs_service);
  }

  const cs_paidOrder: Cs_BookingStatus[] = ["requested", "accepted", "in-progress", "completed"];
  let cs_paymentCount = 0;

  for (const [cs_index, cs_seed] of CS_BOOKINGS.entries()) {
    const cs_service = cs_serviceByKey.get(cs_seed.service)!;
    const cs_customer = cs_userByEmail.get(CS_CUSTOMERS[cs_seed.customer])!;
    // Paid jobs happened in the past; open ones are scheduled for the coming days
    const cs_startDaysAgo = cs_seed.paidDaysAgo !== undefined ? cs_seed.paidDaysAgo + 4 : 6 - (cs_index % 4);
    const cs_at = (cs_step: number) => new Date(cs_now - (cs_startDaysAgo - cs_step) * CS_DAY);

    const cs_steps: Cs_BookingStatus[] =
      cs_seed.status === "rejected" || cs_seed.status === "cancelled"
        ? ["requested", cs_seed.status]
        : cs_paidOrder.slice(0, cs_paidOrder.indexOf(cs_seed.status) + 1);
    const cs_isPaid = cs_seed.paidDaysAgo !== undefined;
    const cs_history: Cs_Booking["statusHistory"] = cs_steps.map((cs_status, cs_step) => ({ status: cs_status, changedAt: cs_at(cs_step) }));
    if (cs_isPaid) cs_history.push({ status: "paid", changedAt: new Date(cs_now - cs_seed.paidDaysAgo! * CS_DAY) });

    // Open jobs are booked ahead, a running job is today, finished ones are in the past
    const cs_dayOffset = cs_isPaid
      ? -(cs_startDaysAgo - 1)
      : cs_seed.status === "requested" || cs_seed.status === "accepted"
        ? 2 + (cs_index % 4)
        : cs_seed.status === "in-progress"
          ? 0
          : -(cs_startDaysAgo - 1);
    const cs_dayStart = new Date(new Date(cs_now + cs_dayOffset * CS_DAY).toISOString().slice(0, 10));
    const cs_booking: Cs_Booking = {
      serviceId: cs_serviceIds.get(cs_seed.service)!.toString(),
      serviceTitle: cs_service.title,
      serviceImage: cs_service.image,
      category: cs_service.category,
      basePrice: cs_service.basePrice,
      technicianName: cs_service.technicianName,
      technicianEmail: cs_service.technicianEmail,
      customerName: cs_customer.name,
      customerEmail: cs_customer.email,
      customerPhone: cs_customer.phone ?? "01800000000",
      address: `House ${12 + cs_index}, Road ${3 + (cs_index % 6)}, ${cs_customer.area ?? "Dhaka"}`,
      preferredDate: cs_dayStart,
      problemDescription: cs_seed.problem,
      status: cs_seed.status,
      finalAmount: cs_seed.finalAmount ?? cs_service.basePrice,
      paymentStatus: cs_isPaid ? "paid" : "unpaid",
      statusHistory: cs_history,
      ...(cs_seed.rating ? { rating: cs_seed.rating, review: cs_seed.review, reviewedAt: new Date(cs_now - (cs_seed.paidDaysAgo! - 1) * CS_DAY) } : {}),
      createdAt: cs_at(0),
    };
    const { insertedId: cs_bookingId } = await cs_bookings.insertOne(cs_booking);

    if (cs_isPaid) {
      const cs_ref = cs_bookingId.toString().slice(-10);
      await cs_payments.insertOne({
        bookingId: cs_bookingId.toString(),
        serviceTitle: cs_booking.serviceTitle,
        customerName: cs_booking.customerName,
        customerEmail: cs_booking.customerEmail,
        technicianName: cs_booking.technicianName,
        technicianEmail: cs_booking.technicianEmail,
        amount: cs_booking.finalAmount,
        currency: "usd",
        transactionId: `pi_seed_${cs_ref}`,
        stripeSessionId: `cs_test_seed_${cs_ref}`,
        paymentStatus: "paid",
        paidAt: new Date(cs_now - cs_seed.paidDaysAgo! * CS_DAY),
      });
      cs_paymentCount++;
    }
  }

  // Same averaging as the review API
  for (const cs_id of cs_serviceIds.values()) await cs_refreshServiceRating(cs_id.toString());

  const cs_count = (cs_status: Cs_ApprovalStatus) => CS_SERVICES.filter((cs_row) => cs_row[8] === cs_status).length;
  console.log(
    `Created ${CS_SERVICES.length} services (${cs_count("approved")} approved, ${cs_count("pending")} pending, ${cs_count("rejected")} rejected), ` +
      `${CS_BOOKINGS.length} bookings, ${cs_paymentCount} payments, ${CS_BOOKINGS.filter((cs_b) => cs_b.rating).length} reviews`,
  );
};

cs_seedData()
  .then(() => {
    console.log("Done.");
    process.exit(0);
  })
  .catch((cs_error) => {
    console.error("Seeding failed:", cs_error instanceof Error ? cs_error.message : cs_error);
    process.exit(1);
  });
