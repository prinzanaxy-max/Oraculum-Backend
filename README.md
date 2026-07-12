# Oraculum Backend

Express + TypeScript backend for the Oraculum university library management admin API.

## Stack

- Node.js + Express
- TypeScript
- Prisma ORM
- PostgreSQL on Neon
- JWT authentication with `jsonwebtoken`
- Password hashing with `bcryptjs`
- Request validation with `zod`

## Setup

Install dependencies:

```bash
npm install
```

Create a `.env` file:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DB?sslmode=require"
JWT_SECRET="replace-with-a-long-random-string"
PORT=3000
FINE_PER_DAY=1
LOAN_PERIOD_DAYS=14
FRONTEND_URL="http://localhost:5173"
ADMIN_EMAIL="admin@oraculum.edu.gh"
ADMIN_PASSWORD="ChangeThisPassword123"
ADMIN_NAME="Head Librarian"
GOOGLE_CLIENT_ID="your-google-oauth-client-id"
GOOGLE_CLIENT_SECRET="your-google-oauth-client-secret"
```

Keep real OAuth credentials and database secrets in `.env` only. The repository `.gitignore` excludes `.env` files.

Generate Prisma Client and sync the database:

```bash
npx prisma generate
npx prisma db push
```

Seed demo data:

```bash
npm run seed
```

Run in development:

```bash
npm run dev
```

Build and run production output:

```bash
npm run build
npm start
```

## Scripts

- `npm run dev` starts the hot-reload development server.
- `npm run build` compiles TypeScript into `dist/`.
- `npm start` runs the compiled server.
- `npm run seed` seeds admin and dashboard demo data.
- `npm run migrate` runs Prisma migrations.
- `postinstall` runs `prisma generate`.

## Authentication

The API uses manual JWT authentication with short-lived access tokens and database-backed refresh tokens.
It also supports Google Identity Services sign-in by verifying frontend-issued Google ID tokens on the backend.

Public routes:

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/google`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`

Protected routes require:

```http
Authorization: Bearer <token>
```

JWT payload:

```json
{
  "id": "user-id",
  "email": "user@example.com"
}
```

Access tokens expire after 15 minutes. Refresh tokens expire after 7 days, are stored as SHA-256 hashes in the database, and are rotated on every refresh request.

## API Routes

Base URL in development:

```txt
http://localhost:3000
```

### Auth

`POST /api/auth/signup`

```json
{
  "fullName": "Sarah Jenkins",
  "studentStaffId": "STF-1001",
  "email": "sarah@example.com",
  "password": "Password123!",
  "confirmPassword": "Password123!"
}
```

`POST /api/auth/login`

```json
{
  "email": "sarah@example.com",
  "password": "Password123!"
}
```

Password login for a Google-only account returns:

```json
{
  "message": "This account uses Google sign-in. Please continue with Google."
}
```

Both signup and login return:

```json
{
  "accessToken": "jwt-access-token",
  "refreshToken": "jwt-refresh-token",
  "token": "jwt-access-token",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "user": {
    "id": "user-id",
    "fullName": "Sarah Jenkins",
    "email": "sarah@example.com"
  }
}
```

`token` is included as a temporary compatibility alias for `accessToken`.

`POST /api/auth/google`

Used by the frontend Google Identity Services flow. The frontend sends the Google ID token returned by Google, and the backend verifies it against `GOOGLE_CLIENT_ID`.

```json
{
  "idToken": "google-identity-services-id-token"
}
```

Behavior:

- Returns `401` for expired, malformed, tampered, or wrong-audience Google ID tokens.
- Returns `403` if Google says the email is not verified.
- Looks up an existing user by `googleId`.
- If no `googleId` match exists, links an existing local account with the same email instead of creating a duplicate.
- Creates a Google-only user if no matching account exists.

Returns the same token response shape as signup/login.

`POST /api/auth/refresh`

```json
{
  "refreshToken": "jwt-refresh-token"
}
```

Returns a new access token and a new refresh token. The previous refresh token is revoked.

`POST /api/auth/logout`

```json
{
  "refreshToken": "jwt-refresh-token"
}
```

Revokes the supplied refresh token.

`GET /api/auth/me`

Returns the authenticated user's public profile.

### Books

`GET /api/books`

Returns all books.

`POST /api/books`

```json
{
  "title": "Beloved",
  "author": "Toni Morrison",
  "isbn": "978-1400033416",
  "category": "Fiction",
  "publishedYear": 1987,
  "description": "A Pulitzer Prize-winning novel.",
  "totalCopies": 2,
  "status": "AVAILABLE"
}
```

### Members

`GET /api/members`

Returns all members.

`POST /api/members`

```json
{
  "studentId": "STF-2001",
  "memberCode": "M-2001",
  "name": "David Chen",
  "email": "david@example.com",
  "phone": "+233-20-555-2001",
  "department": "Computer Science",
  "isActive": true
}
```

### Borrow Records

`GET /api/borrow`

Returns all borrow records with book and member details.

`POST /api/borrow`

```json
{
  "bookId": "book-id",
  "memberId": "member-id",
  "dueDate": "2026-07-25T00:00:00.000Z"
}
```

### Reservations

`GET /api/reservations`

Returns all reservations with book and member details.

`POST /api/reservations`

```json
{
  "bookId": "book-id",
  "memberId": "member-id"
}
```

### Dashboard

`GET /api/dashboard/stats?range=last_6_months`

Returns summary cards for borrowed books, returned books, overdue books, missing books, total books, visitors, new members, and pending fees.

Supported ranges:

- `last_7_days`
- `last_30_days`
- `last_6_months`
- `last_year`
- `all_time`

Optional query:

- `status=active` counts only active borrowed records for `borrowedBooks`.

`GET /api/dashboard/checkout-stats?range=last_6_months`

Returns day-of-week borrow and return counts for the line chart.

`GET /api/dashboard/overdue-history?limit=10`

Returns overdue borrow records joined with book and member data.

`GET /api/dashboard/recent-checkouts?limit=10`

Returns recent borrow records ordered by issue date.

`GET /api/dashboard/books-panel?tab=top&limit=10`

Returns the most borrowed books.

`GET /api/dashboard/books-panel?tab=new&limit=10`

Returns recently added books.

## Postman

Import this collection:

```txt
docs/oraculum-backend.postman_collection.json
```

Recommended run order:

1. `Auth / Signup`
2. `Auth / Login`
3. `Auth / Me`
4. `Books / Get Books`
5. `Members / Get Members`
6. Remaining protected requests

The collection stores `token`, `bookId`, and `memberId` as collection variables so protected and relational requests can run end-to-end.

## Seed Data

`npm run seed` creates:

- 10 books with real-looking titles/authors
- Dashboard-scale books with `32,345` total copies and `12` missing books
- 72 members, including `34` current-period new members
- 500 borrow records across current and prior periods, including borrowed, returned, and overdue examples
- 10 reservations
- 2,964 visitor logs powering `1,504` current-period visitors

The seed clears and recreates the demo library data tables before inserting records.
