import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "http";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import app from "../app";

/**
 * End-to-end integration tests against a real database. These are opt-in so
 * the default unit test run stays fast and DB-free:
 *
 *   RUN_INTEGRATION_TESTS=1 npm test
 *
 * The suite creates its own data and cleans it up afterwards.
 */
const enabled = process.env.RUN_INTEGRATION_TESTS === "1";
const suite = enabled ? describe : describe.skip;

const EMAIL_A = "integration.a@presciya.test";
const EMAIL_B = "integration.b@presciya.test";
const PASSWORD = "Password@123";

let server: Server;
let base: string;

type Fixture = {
  userId: string;
  workspaceId: string;
  chamberId: string;
  patientId: string;
};

const fixtures: Fixture[] = [];

async function createDoctorFixture(email: string): Promise<Fixture> {
  const password = await bcrypt.hash(PASSWORD, 10);
  const user = await prisma.user.create({
    data: { name: `Integration ${email}`, email, password, isVerified: true, emailVerifiedAt: new Date() },
  });
  const doctor = await prisma.doctor.create({
    data: { name: user.name, userId: user.id, verificationStatus: "APPROVED" },
  });
  const workspace = await prisma.workspace.create({
    data: {
      name: `Integration WS ${email}`,
      slug: `integration-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: "PERSONAL",
      ownerId: user.id,
    },
  });
  await prisma.membership.create({
    data: { userId: user.id, workspaceId: workspace.id, role: "OWNER", status: "ACTIVE" },
  });
  const chamber = await prisma.chamber.create({
    data: { workspaceId: workspace.id, name: "Test Chamber" },
  });
  const patient = await prisma.patient.create({
    data: { workspaceId: workspace.id, doctorId: doctor.id, name: "Test Patient", age: 30, gender: "MALE" },
  });

  const fixture = { userId: user.id, workspaceId: workspace.id, chamberId: chamber.id, patientId: patient.id };
  fixtures.push(fixture);
  return fixture;
}

async function cleanupFixtures() {
  const userIds = fixtures.map((f) => f.userId);
  const workspaceIds = fixtures.map((f) => f.workspaceId);
  if (userIds.length === 0) return;

  await prisma.prescriptionTemplate.deleteMany({ where: { workspaceId: { in: workspaceIds } } });
  await prisma.prescription.deleteMany({ where: { workspaceId: { in: workspaceIds } } });
  await prisma.patient.deleteMany({ where: { workspaceId: { in: workspaceIds } } });
  await prisma.chamber.deleteMany({ where: { workspaceId: { in: workspaceIds } } });
  await prisma.usageTracking.deleteMany({ where: { workspaceId: { in: workspaceIds } } });
  await prisma.subscription.deleteMany({ where: { workspaceId: { in: workspaceIds } } });
  await prisma.membership.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.verificationRequest.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.doctor.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.workspace.deleteMany({ where: { id: { in: workspaceIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

async function login(email: string): Promise<string> {
  const res = await fetch(`${base}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const cookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  return cookies.map((c) => c.split(";")[0]).join("; ");
}

async function createPrescription(cookie: string, fixture: Fixture): Promise<string> {
  const res = await fetch(`${base}/api/v1/prescription`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      patientId: fixture.patientId,
      chamberId: fixture.chamberId,
      diagnosis: "Integration diagnosis",
      medicines: [
        {
          brandName: "Napa",
          generic: "Paracetamol",
          type: "Tablet",
          usageType: "DAILY",
          dosagePattern: "1+0+1",
          duration: "5 days",
        },
      ],
    }),
  });
  const body: any = await res.json();
  return body?.data?.id;
}

suite("end-to-end prescription flow", () => {
  let fixtureA: Fixture;
  let fixtureB: Fixture;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address();
        const port = typeof address === "object" && address ? address.port : 0;
        base = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    fixtureA = await createDoctorFixture(EMAIL_A);
    fixtureB = await createDoctorFixture(EMAIL_B);
  });

  afterAll(async () => {
    await cleanupFixtures();
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    await prisma.$disconnect();
  });

  it("creates, finalizes and verifies a prescription", async () => {
    const cookie = await login(EMAIL_A);
    const rxId = await createPrescription(cookie, fixtureA);
    expect(rxId).toBeTruthy();

    const draftPrint = await fetch(`${base}/api/v1/prescription/${rxId}/print`);
    expect(draftPrint.status).toBe(404);

    const finalize = await fetch(`${base}/api/v1/prescription/${rxId}/finalize`, {
      method: "POST",
      headers: { cookie },
    });
    expect(finalize.status).toBe(200);

    const print = await fetch(`${base}/api/v1/prescription/${rxId}/print`);
    expect(print.status).toBe(200);
    expect(print.headers.get("content-type")).toContain("text/html");

    const verify = await fetch(`${base}/api/v1/prescription/${rxId}/verify`);
    const verifyBody: any = await verify.json();
    expect(verify.status).toBe(200);
    expect(verifyBody.data.verified).toBe(true);
    expect(verifyBody.data).not.toHaveProperty("patientName");
  });

  it("cannot read another workspace's prescription", async () => {
    const cookieA = await login(EMAIL_A);
    const rxId = await createPrescription(cookieA, fixtureA);
    const cookieB = await login(EMAIL_B);

    const res = await fetch(`${base}/api/v1/prescription/${rxId}`, {
      headers: { cookie: cookieB },
    });
    expect(res.status).toBe(404);
  });
});
