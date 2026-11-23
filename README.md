# FixMate Server

REST API for **FixMate**, a repair service platform where customers book verified technicians for phones, laptops and home appliances, follow every job step by step, and pay online only after the work is done.

- **Live API:** https://fixmate-server-ruby.vercel.app ([health check](https://fixmate-server-ruby.vercel.app/api/health))
- **Client app:** https://fixmate-client-six.vercel.app (see the `fixmate-client` repository)

## Tech stack

Express 5, TypeScript, the native MongoDB driver, JWT (shared secret with the client), Stripe Checkout and ImgBB for image hosting. Deployed on Vercel.

## Key features

- **Role-based access:** customer, technician and admin. The role is read fresh from the database on every request, so role changes apply at once.
- **Services:** public search, category and mode filters, sorting and server-side pagination. Technicians create and edit listings; every edit goes back to admin review.
- **Job status pipeline enforced on the server:** `requested → accepted → in-progress → completed`, plus `rejected` and customer `cancelled`. Updates are atomic, so two people acting at once cannot skip or repeat a step.
- **One active request per customer and service**, guaranteed by a partial unique index.
- **Idempotent Stripe payments:** the success page and the webhook share one `cs_fulfillPayment` function. A unique `stripeSessionId` and a conditional booking update mean reloads, retries and parallel calls record exactly one payment. The charged amount is checked against the booking.
- **Ratings and reviews** on paid jobs, with averages recomputed from the bookings.
- **Dashboard stats** for each role, with 6-month chart data grouped by Dhaka time.

## Getting started

```bash
npm install
cp .env.example .env   # then fill in the values
npm run dev            # http://localhost:5000
```

### Environment variables

| Variable | Purpose |
|---|---|
| `PORT` | Local port (default `5000`) |
| `CS_MONGODB_URI` | MongoDB connection string (same database as the client) |
| `CS_DB_NAME` | Database name, e.g. `fixmate` |
| `CS_JWT_SECRET` | Must match `CS_JWT_SECRET` in the client |
| `CS_CLIENT_URL` | Client origin, used for CORS and Stripe redirect URLs |
| `CS_CORS_ORIGINS` | Extra allowed origins, comma separated |
| `CS_STRIPE_SECRET_KEY` | Stripe secret key (test mode: `sk_test_…`) |
| `CS_STRIPE_WEBHOOK_SECRET` | Signing secret of the Stripe webhook (`whsec_…`) |
| `CS_IMGBB_API_KEY` | ImgBB API key for image uploads |

Never commit `.env`; only `.env.example` is tracked.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start with hot reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled build |
| `npm run typecheck` | Type-check without emitting |
| `npm run seed:data` | Add demo services, bookings, payments and reviews (`-- --reset` replaces them) |

### Demo data

1. In `fixmate-client`, run `npm run seed:users` (creates the accounts below through BetterAuth).
2. Here, run `npm run seed:data`. It prints the target database first and stops if the demo users are missing.

| Role | Email | Password |
|---|---|---|
| Admin | `admin@fixmate.test` | `Admin@123` |
| Technician | `rafiq@fixmate.test`, `nusrat@fixmate.test`, `tanvir@fixmate.test` | `Tech@123` |
| Customer | `nadia@fixmate.test`, `karim@fixmate.test`, `farhana@fixmate.test` | `Customer@123` |

The seed creates 15 approved services across all 7 categories, 2 pending, 1 rejected, bookings in every status, 6 payments and 5 reviews.

## API

All paths start with `/api`. Protected routes need `Authorization: Bearer <JWT>`; the client gets this token from its own `/api/token` route.

### Public

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Server and database status |
| GET | `/services` | Approved, available services. Query: `search`, `category`, `mode`, `sort` (`price_asc`, `price_desc`, `newest`), `page`, `limit` |
| GET | `/services/featured` | Latest 6 services |
| GET | `/services/:id` | Service details and technician summary |
| GET | `/services/:id/reviews` | Latest reviews (first names only) |

### Any signed-in user

| Method | Path | Description |
|---|---|---|
| POST | `/upload` | Upload an image to ImgBB (multipart field `image`, up to 2 MB) |
| PATCH | `/users/profile` | Update `name`, `image`, `phone`, `area`, `bio` (never email or role) |

### Customer

| Method | Path | Description |
|---|---|---|
| POST | `/bookings` | Send a repair request |
| GET | `/bookings/my` | Own bookings (`?status=`) |
| PATCH | `/bookings/:id/cancel` | Cancel while still `requested` |
| PATCH | `/bookings/:id/review` | Rate a paid job once (`rating` 1–5, optional `review`) |
| POST | `/payments/create-checkout-session` | `{ bookingId }` → Stripe Checkout URL |
| GET | `/payments/verify?session_id=` | Confirm and record a payment (safe to repeat) |
| GET | `/payments/my` | Payment history and total spent |
| GET | `/stats/customer` | Overview numbers and chart data |

### Technician

| Method | Path | Description |
|---|---|---|
| POST | `/services` | Create a service (saved as `pending`) |
| GET | `/technician/services` | Own services |
| PATCH | `/services/:id` | Edit own service (goes back to `pending`) |
| DELETE | `/services/:id` | Delete own service (not while it has active bookings) |
| PATCH | `/services/:id/availability` | Show or hide a service |
| GET | `/bookings/technician` | Incoming jobs (`?status=`) |
| PATCH | `/bookings/:id/status` | `{ status, finalAmount? }`; only valid moves are accepted |
| GET | `/stats/technician` | Overview numbers and chart data |

### Admin

| Method | Path | Description |
|---|---|---|
| GET | `/admin/stats` | Platform numbers and chart data |
| GET | `/admin/users` | All users (`?role=`, `?search=`) |
| PATCH | `/admin/users/:id/role` | Change a role (not your own) |
| GET | `/admin/services` | All services, pending first (`?status=`) |
| PATCH | `/admin/services/:id/approval` | `{ approvalStatus: "approved" \| "rejected" }` |
| GET | `/admin/bookings` | All bookings, read-only (`?status=`) |
| GET | `/admin/payments` | All payments and total revenue |

### Stripe

| Method | Path | Description |
|---|---|---|
| POST | `/payments/webhook` | Signed webhook (`checkout.session.completed`, `checkout.session.async_payment_succeeded`) |

Errors always return `{ success: false, message }` with the matching status code (400, 401, 403, 404, 409, 500).

## Deploying to Vercel

1. Import the repository in Vercel. `vercel.json` builds `src/index.ts` with `@vercel/node` and routes every path to it.
2. Add every variable from `.env.example` except `PORT`, using production values. Set `CS_CLIENT_URL` and `CS_CORS_ORIGINS` to the deployed client URL.
3. Also add `NODEJS_HELPERS=0` for every environment. This turns off Vercel's Node.js request helpers ([Vercel docs](https://vercel.com/docs/functions/runtimes/node-js/advanced-node-configuration)), so `express.raw()` on the webhook route reads the original bytes that Stripe signed.
4. In the Stripe Dashboard, add a webhook endpoint at `https://fixmate-server-ruby.vercel.app/api/payments/webhook` for `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Copy its signing secret into `CS_STRIPE_WEBHOOK_SECRET` and redeploy.
5. Open `/api/health`; it should report `"database": "connected"`.
6. Make one test payment, then check the webhook's delivery log in Stripe. A `200` means it works. A `400` with "Missing Stripe signature or raw body" means the body was parsed before Express saw it; recheck step 3. A `400` with "Invalid Stripe signature" means the signing secret does not match.

## npm packages

| Package | Use |
|---|---|
| `express` | HTTP server and routing |
| `mongodb` | Native database driver |
| `jsonwebtoken` | Verifying the JWT sent by the client |
| `stripe` | Checkout sessions and webhook verification |
| `multer` | Reading image uploads in memory |
| `cors` | Allowing the client origin |
| `dotenv` | Loading `.env` locally |
| `typescript`, `tsx` | Type safety, dev server and scripts |
