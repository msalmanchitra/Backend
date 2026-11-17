# E-commerce backend

REST API built with Express 5 and MongoDB/Mongoose. It includes customer registration and login, a product catalog, administrator product management, customer carts, and stock-aware order creation.

## Requirements and setup

- Node.js 18 or newer
- MongoDB configured as a replica set (MongoDB Atlas is suitable). Checkout and order cancellation use MongoDB transactions.

From this directory:

```powershell
npm install
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Set `MONGO_URI` to your MongoDB connection string and replace `JWT_SECRET` with a randomly generated secret of at least 32 characters. Configure `CORS_ORIGIN` as a comma-separated list of frontend origins. Then run:

```powershell
npm run dev
```

The API listens on port `5000` by default. `GET /api/health` reports API/database readiness.

New accounts are always customers. To grant administrator access, update that user's `role` to `admin` directly in MongoDB; never accept a role from a public registration request.

## API routes

All protected routes require `Authorization: Bearer <token>`.

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | Public | Create customer account |
| POST | `/api/auth/login` | Public | Sign in |
| GET | `/api/auth/me` | Customer/admin | Current account |
| GET | `/api/products` | Public | List/search/filter products (`page`, `limit`, `category`, `search`, `sort`) |
| GET | `/api/products/:id` | Public | Product details |
| POST | `/api/products` | Admin | Create product |
| PATCH | `/api/products/:id` | Admin | Update product |
| DELETE | `/api/products/:id` | Admin | Archive product |
| GET | `/api/cart` | Customer/admin | Get current cart |
| POST | `/api/cart/items` | Customer/admin | Add `{ "productId": "...", "quantity": 1 }` |
| PATCH | `/api/cart/items/:productId` | Customer/admin | Set item quantity |
| DELETE | `/api/cart/items/:productId` | Customer/admin | Remove cart item |
| DELETE | `/api/cart` | Customer/admin | Clear cart |
| POST | `/api/orders` | Customer/admin | Checkout with `shippingAddress`; optional `paymentMethod` |
| GET | `/api/orders` | Customer/admin | List own orders (admins see all) |
| GET | `/api/orders/:id` | Customer/admin | Get own order (admins can view all) |
| PATCH | `/api/orders/:id/status` | Admin | Advance order status or cancel |

Product creation requires `name`, `description`, `category`, `price`, and `stock`. Checkout accepts `paymentMethod: "cash_on_delivery"` (default) or `"online"`, but this starter does not charge online payments or process payment webhooks. Integrate a payment provider before enabling online checkout in production.

## Security notes

- Passwords are hashed with bcrypt; authentication uses signed expiring JWTs.
- Public registration cannot set administrator privileges.
- Responses use security headers, CORS allowlisting, bounded JSON payloads, and authentication rate limiting.
- Prices are read from the database during checkout; client-provided totals are ignored.
- Checkout decrements inventory and creates the order in one MongoDB transaction.
