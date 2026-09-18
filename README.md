# Presciya Backend — Bangladesh-Focused Digital Prescription SaaS Platform

Presciya is a production-grade, highly secure, and multi-tenant Digital Prescription SaaS platform architected for personal doctors, clinic networks, and hospital chains in Bangladesh. It provides structured medical cataloging, appointment scheduling, A4 print-ready prescription calculation with dynamic watermarks, and verification QR-codes.

---

## 🛠️ Technology Stack

* **Runtime**: Bun / Node.js
* **Framework**: Express.js with TypeScript
* **ORM**: Prisma ORM
* **Database**: PostgreSQL (with trigram GIN indices for typo-tolerance)
* **Storage**: Cloudinary + Multer for signatures and assets
* **Auth**: JWT Rotation + Secure httpOnly Cookies
* **Validation**: Zod Schemas

---

## 🚀 Setup & Installation

### 1. Prerequisites
Ensure you have **PostgreSQL** and **Node.js** (or **Bun**) installed on your machine.

### 2. Configuration (`.env`)
Create a `.env` file in the root directory:
```env
PORT=5000
DATABASE_URL="postgresql://postgres:password@localhost:5410/presciya?schema=public"
JWT_ACCESS_SECRET="your_access_token_secret"
JWT_REFRESH_SECRET="your_refresh_token_secret"
CLOUDINARY_CLOUD_NAME="your_cloud_name"
CLOUDINARY_API_KEY="your_api_key"
CLOUDINARY_API_SECRET="your_api_secret"
APP_URL="http://localhost:5000"
FRONTEND_URL="http://localhost:3000"
```

### 3. Installation
Install the project dependencies:
```bash
npm install
```

### 4. Database Initialization & Seeding
Generate the Prisma client, run the migrations, and seed the default subscription plans and admin credentials:
```bash
npx prisma generate
npx prisma migrate dev
npm run seed
```

### 5. Running the Application
Start the development watch server:
```bash
npm run dev
```

---

## 🔧 RBAC & Permissions

Presciya uses **two independent role axes** (never conflate them):

- `User.systemRole` — platform-wide authority (`USER | SUPER_ADMIN`).
- `Membership.role` — workspace-level authority (`OWNER | ADMIN | DOCTOR | MANAGER | ASSISTANT`), stored on `Membership`.

Authorization always flows through `Membership` + `Membership.status` + `WorkspaceRole` + `Permission`. `Workspace.ownerId` is provenance/display data only — it is **never** the sole authorization source. Workspace-scoped middleware (`authWorkspace([...])`) verifies the active `Membership` and exposes `req.workspaceId` / `req.workspaceRole`.

- There is **no** global `UserRole`/`DoctorType` enum. Roles such as `DOCTOR` exist only as `WorkspaceRole` values.
- Admin APIs (`src/modules/admin/*`) provide user management, subscription plan handling, feature flag toggling, and plan feature limits.
- Ensure to run migrations after changes: `npx prisma migrate dev`.

Common rule:

- If the action depends on "what can this user do in this workspace?", use `WorkspaceRole`.
- If the action depends on "what can this user do across the whole platform?", use `User.systemRole`.

---

## 🔒 Security Hardening

Presciya is engineered with enterprise-grade defensive layers:

1. **Broken Object Level Authorization (BOLA / IDOR Protection)**:
   All routes utilize the strict [rbac.ts](src/middleware/rbac.ts) middleware. This validates both global role access permissions and resource ownership. Personal doctors are isolated, while institutional admins can monitor their assigned resources.
2. **HTML Injection, XSS, and SSRF Mitigation**:
   PDF print engines are vulnerable to SSRF and remote code executions through nested HTML parameters. Presciya fully encodes all user-controlled text parameters (e.g., patient details, complaints, clinical notes, brand names) using a high-performance sanitization helper before rendering A4 prescriptions.
3. **Session Hijacking Prevention**:
   JWT access and rotation tokens are transported via `httpOnly`, Lax, and Secure cookies, shielding them completely from cross-site scripts.
4. **Brute Force & DDoS Hardening**:
   - **Helmet**: Secures response HTTP headers.
   - **General Rate Limiter**: Limits general API routes to 300 requests per 15 minutes.
   - **Auth Rate Limiter**: Curbs high-risk routes (`/login`, `/signup`, `/reset-password`) to 10 attempts per 15 minutes.
5. **Centralized Auditing System**:
   Critical alterations in Patients, Chambers, and Prescriptions automatically log activities (User, Action type, old values, and new values) using the central async `AuditLog` hook.

---

## 📂 Core Business Modules

### 1. Authentication & Session Security (`/api/v1/auth`)
Handles token issuance, rotation, and devices:
* Multi-device session tracking (`Session` model).
* Password hashing (`bcryptjs`) with secure reset.
* Complete multi-device remote logout.

### 2. Multi-Tenant Institution (`/api/v1/institution`)
Empowers clinic/hospital networks to:
* Set custom branding (colors, primary font, templates).
* Standardize clinical departments.
* Manage assigned doctors, visiting rooms, and active states.

### 3. Chamber visiting schedules & Queue appointments (`/api/v1/chamber`)
* Set weekly visiting days, slot times, and dynamic capacity rules.
* Book patients into a real-time visit queue with auto-incremented daily serial numbers.

### 4. Patient Profile & History Timeline (`/api/v1/patient`)
* Captures allergies, emergency contacts, blood group, and chronic history.
* Logs life-cycle activities (prescriptions written, appointments scheduled) inside the Patient Timeline.
* Features typo-tolerant smart lookup by phone number to eliminate duplicates.

### 5. Advanced Prescription Engine & PDF Generation (`/api/v1/prescription`)
* Structure-relational medicine mappings coupled with backward-compatible JSON storage.
* Generates double-column A4 templates complete with watermark, digital signatures, and headers.
* Dynamic **verification QR-code** generated instantly.

### 6. Medicine Catalogue Search (`/api/v1/medicine`)
* Employs PostgreSQL trigram Indices (`pg_trgm`) to tolerate typographies during fast lookups.
* Captures doctor-specific favorite lists to display instantly during autocomplete empty states.

### 7. Subscription, Quotas, and Invoices (`/api/v1/subscription`)
* Daily prescription quota check (Free limit: `3/day`, standard: configurable pricing plans).
* Supports coupons, dynamic pricing calculations, payment logging, and automated invoice PDF referencing.

### 8. Analytics Dashboard (`/api/v1/analytics`)
* Offers institutional counts (departments, doctors, total prescriptions generated).
* Provides individual doctors overview metrics (total patients, chamber ratios, active visits).

---

## 🔗 Complete API Endpoint Registry

All protected routes require user cookies (`accessToken` and `refreshToken`).

### 🔑 Authentication Module (`/api/v1/auth`)
* `POST /sendOTP` - Send a signup OTP by email.
* `POST /signup` - Register a new account (validates OTP).
* `POST /login` - Log in and obtain secure cookies.
* `POST /refresh-token` - Rotate JWT credentials securely.
* `GET /me` - Current user + profile + workspaces.
* `POST /switch-workspace` - Switch active workspace. The acting identity is taken **exclusively** from the verified `accessToken` (`req.user.id`); the request body only carries `workspaceId`.
* `POST /logout` - Log out of current device.
* `POST /logout-all` - Invalidate all active sessions globally.
* `POST /forget-password` - Request a password reset token.
* `POST /reset-password` - Apply new password using token.

### 🏥 Institution Module (`/api/v1/institution`)
* `POST /profile` - Initialize institution profile details.
* `GET /profile` - Retrieve current branding configuration.
* `PATCH /profile` - Update institution details.
* `PATCH /branding` - Save branding styling rules (flat payload: `primaryColor`, `secondaryColor`, `fontFamily`, `headerTemplate`, `footerTemplate`, `showLogo`).
* `POST /departments` - Add new clinical department.
* `GET /departments` - List departments under institution.
* `POST /doctors/assign` - Assign a doctor to a department/chamber.
* `DELETE /doctors/:doctorId` - Revoke doctor assignment.
* `GET /doctors` - List assigned doctors and schedules.

### 🏢 Chamber Module (`/api/v1/chamber`)
* `POST /` - Add a chamber.
* `GET /my-chambers` - Retrieve list of owned/assigned chambers.
* `GET /:id` - Retrieve detailed chamber settings.
* `PATCH /:id` - Edit chamber information.
* `DELETE /:id` - Soft-delete chamber.
* `POST /:id/schedules` - Add weekly visiting schedules.
* `DELETE /schedules/:scheduleId` - Delete visit schedule.
* `POST /:id/appointments` - Schedule a patient (computes serial number).
* `GET /:id/appointments` - List daily patient visits.

### 👥 Patient Module (`/api/v1/patient`)
* `POST /` - Create patient profile.
* `GET /search?query=...` - Typo-tolerant phone/name matching search.
* `GET /:id` - Detailed profile with prescription history.
* `PATCH /:id` - Edit demographics/medical notes.
* `DELETE /:id` - Soft-delete patient record.
* `GET /:id/timeline` - Retrieve full patient event trail.

### 📄 Prescription Engine (`/api/v1/prescription`)
* `POST /` - Create draft prescription (validates verification + daily quota).
* `GET /my-prescriptions` - List prescriptions in the active workspace.
* `GET /:id` - Workspace-scoped detail.
* `GET /:id/preview` - Authenticated canonical A4 HTML (draft or finalized).
* `PATCH /:id` - Edit a draft (finalized records are locked).
* `POST /:id/finalize` - Lock, assign serial + opaque verification code.
* `POST /:id/amend` - Create a corrected draft version (original stays intact).
* `DELETE /:id` - Soft-delete prescription.
* `GET /:id/print` - (Public, finalized only) Compiles clean A4 HTML print.
* `GET /:id/verify` - (Public) Verifies authenticity by verification code.

### 🧩 Prescription Templates (`/api/v1/prescription-templates`)
* `GET /` - List templates in the active workspace.
* `POST /` - Save the current medicines/advice as a reusable template.
* `GET /:id`, `PATCH /:id`, `DELETE /:id` - Manage a template.

### 💊 Medicine Module (`/api/v1/medicine`)
* `GET /search?query=...` - Fast typo-tolerant GIN search.
* `GET /favorites` - Retrieve doctor favorites.
* `POST /favorites` - Add medicine to favorites.
* `DELETE /favorites/:medicineId` - Remove medicine from favorites.

### 💳 Subscription & Billing Module (`/api/v1/subscription`)
* `GET /plans` - View standard available subscription plans.
* `GET /my-subscription` - View active billing metrics and quotas.
* `GET /billing-history` - Paginated invoices list.
* `POST /subscribe` - Purchase or upgrade subscription plan.
* `POST /validate-voucher` - Calculate discount prior to checkout.
* `POST /cancel` - Gracefully soft-cancel recurring billing.

> Plan seeding is a database seed script (`npm run seed`), not an HTTP endpoint. There is intentionally no public `POST /seed-plans` route.

### 📊 Analytics Module (`/api/v1/analytics`)
* `GET /dashboard` - Dynamic diagnostic overview reports.
