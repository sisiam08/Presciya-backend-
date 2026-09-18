# Presciya Backend — API Status

Last updated: Phase 15 (testing & documentation pass).

Base path: `/api/v1`. Protected requests use the `accessToken` cookie; workspace routes additionally require an **ACTIVE** `Membership` and a permitted `WorkspaceRole`. Identity is always taken from the verified token (`req.user.id`), never from the request body.

Error envelope (all failures):

```json
{ "success": false, "message": "…", "code": "STABLE_CODE", "requestId": "…", "details": null }
```

Stable codes: `VALIDATION_ERROR`, `UNAUTHORIZED`, `AUTH_INVALID_CREDENTIALS`, `FORBIDDEN`, `WORKSPACE_ACCESS_DENIED`, `MEMBERSHIP_INACTIVE`, `VERIFICATION_REQUIRED`, `PAYMENT_REQUIRED`, `SUBSCRIPTION_REQUIRED`, `QUOTA_EXCEEDED`, `RESOURCE_NOT_FOUND`, `CONFLICT`, `INVALID_STATE`, `RATE_LIMITED`, `INTERNAL_ERROR`.

## Route inventory

### System
| Method | Path | Notes |
|---|---|---|
| GET | `/` | Server banner |
| GET | `/health` | Health probe |

### Auth `/auth`
| Method | Path | Notes |
|---|---|---|
| POST | `/sendOTP` | Signup OTP |
| POST | `/signup` | OTP-verified signup; one email = one User |
| POST | `/login` | Issues cookies; multi-workspace returns `requiresWorkspaceSelection` + unscoped token |
| POST | `/refresh-token` | Rotates tokens from httpOnly refresh cookie |
| GET | `/me` | Current user + profile + workspaces |
| POST | `/switch-workspace` | Body: `{ workspaceId }` only — identity from token |
| POST | `/logout`, `/logout-all` | Session revocation |
| POST | `/forget-password`, `/reset-password` | Reset flow |

### Workspaces `/workspaces`
List/create; invitations (`/invitations/pending|accept|reject`); detail/update/delete (`/:workspaceId`, OWNER); members (`/members`, `/members/invite`, `/members/:memberId`, `/members/:memberId/suspend|restore`); workspace invitations (`/invitations`, `/invitations/:invitationId`).

### Doctor `/doctor`
`POST /` (assign/invite), `GET /profile`, `PATCH /profile`, `GET /my-doctors`, `GET /` (workspace-scoped), `GET /:id` (workspace-scoped).

### Institution `/institution`
`POST|GET|PATCH /profile`, `PATCH /branding` (persists 6 branding fields), `POST|GET /departments`, `POST /doctors/assign`, `DELETE /doctors/:doctorId`, `GET /doctors`.

### Institution-doctors `/institution-doctors`
Detail/management surface only: `GET /list/:institutionId`, `GET /:id`, `PUT /:id`, `DELETE /:id`. Creation is owned by `POST /institution/doctors/assign`.

### Chamber `/chamber`
`POST /`, `GET /my-chambers`, `GET /:id`, `PATCH /:id`, `DELETE /:id`, `POST /:id/schedules`, `DELETE /schedules/:scheduleId`, `POST /:id/appointments`, `GET /:id/appointments`. All workspace-scoped.

### Patient `/patient`
`POST /`, `GET /search`, `GET /:id`, `PATCH /:id`, `DELETE /:id`, `GET /:id/timeline`. Workspace-scoped; duplicate detection by `(workspaceId, phone)`.

### Prescription `/prescription`
| Method | Path | Notes |
|---|---|---|
| POST | `/` | Create draft; feature quota enforced |
| GET | `/my-prescriptions` | Workspace + author scoped |
| GET | `/:id` | Workspace-scoped |
| GET | `/:id/preview` | Authenticated canonical A4 HTML (draft or finalized) |
| PATCH | `/:id` | Drafts only; `status: FINALIZED` rejected |
| POST | `/:id/finalize` | Requires verification; assigns serial + opaque verification code |
| POST | `/:id/amend` | Creates a corrected DRAFT version (original intact) |
| DELETE | `/:id` | Soft delete |
| GET | `/:id/print` | Public, rate-limited; finalized only |
| GET | `/:id/verify` | Public, rate-limited; accepts verification code (or legacy id) |

### Prescription templates `/prescription-templates`
`GET /`, `POST /`, `GET /:id`, `PATCH /:id`, `DELETE /:id`. Workspace + doctor scoped; copied into new prescriptions.

### Appointment `/appointment`
`POST /:workspaceId`, `GET /:workspaceId`, `PATCH /:workspaceId/:id/status`. Workspace-scoped; serials protected by a unique constraint with retry.

### Medicine `/medicine`
`GET /search` (pg_trgm typo-tolerant; favorites on empty query), `GET /favorites`, `POST /favorites`, `DELETE /favorites/:medicineId`.

### Analytics `/analytics`
`GET /dashboard` (doctor or institution scoped).

### Verification `/verification`
`POST /submit`, `GET /pending` (super admin), `GET /:id` (owner or super admin), `POST /:id/under-review|approve|reject` (super admin). State machine: `PENDING → UNDER_REVIEW → APPROVED|REJECTED → (resubmission) PENDING`.

### Departments `/departments`
`POST /`, `GET /institution/:institutionId`, `GET /:id`, `PUT /:id`, `DELETE /:id`. Shares one write path with `institution/departments`.

### Subscription `/subscription`
`GET /plans`, `GET /my-subscription`, `GET /billing-history`, `POST /subscribe`, `POST /validate-voucher`, `POST /cancel`. Quota via `FeatureServices.checkFeatureAccess`; plans/features are seeded idempotently (`npm run seed`).

### Admin `/admin`
All require `SystemRole = SUPER_ADMIN` + permission: `GET|PATCH|DELETE /users`, `GET /plans`, `POST /plans/:variantId/features/:featureId/limit`, `PATCH /features/:featureId/flag`, `GET /audit-logs`, `GET /login-history`, `GET /stats`.

### Notifications `/notifications`
`GET /`, `GET /unread-count`, `PATCH /:id/read`, `PATCH /read-all`, `DELETE /:id`. User-scoped.

## Cross-cutting guarantees

- **Multi-tenancy:** every workspace-scoped read/mutation is scoped through `Membership` (ACTIVE) + role; `Workspace.ownerId` is provenance only.
- **BOLA/IDOR:** resource lookups are scoped to the active workspace; cross-workspace IDs return `404`.
- **Verification:** professional verification is required for prescription create/finalize/amend and other official writes; email verification is separate (`User.isVerified`).
- **PDF:** one canonical A4 renderer for preview/print; footer anchored to the final page; user content HTML-escaped; only http(s) asset URLs allowed.
- **Observability:** every request gets an `X-Request-Id`; access logs are JSON with method/path/status/duration only.
- **Audit:** append-only `AuditLog` for business changes; `LoginHistory` for auth telemetry; `Session` for active sessions.

## Testing

```bash
npm test                       # unit tests (DB-free)
RUN_INTEGRATION_TESTS=1 npm test  # + end-to-end DB tests (creates & cleans its own data)
```

## Migrations

9 migrations, applied with no drift. Seed (`npm run seed`) provisions the super admin, the feature catalog, plan variants and per-variant plan features.
