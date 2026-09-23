import { describe, it, expect } from "vitest";
import { generatePrescriptionHtml } from "./pdfGenerator";
import { IPdfRenderData } from "../interface/pdf.type";

const baseData = (overrides: Partial<IPdfRenderData> = {}): IPdfRenderData => ({
  id: "rx-1",
  serialNumber: "PRS-ABCD-000001",
  createdAt: new Date("2026-01-01T10:00:00Z"),
  status: "FINALIZED",
  complaints: "Fever",
  diagnosis: "Viral fever",
  bloodPressure: "120/80",
  pulse: 80,
  temperature: 99,
  weight: 70,
  height: "170 cm",
  clinicalNotes: null,
  advises: "Rest and fluids",
  nextVisitDate: new Date("2026-01-08T10:00:00Z"),
  medicines: [],
  doctor: {
    name: "Karim",
    qualification: "MBBS",
    specialization: "Medicine",
    registrationNo: "BMDC-123",
    signature: "https://cdn.example.com/sig.png",
    bmdcApproved: true,
  },
  chamber: {
    chamberName: "Test Chamber",
    chamberAddress: "Dhaka",
    chamberEmail: "c@example.com",
    logo: "https://cdn.example.com/logo.png",
    chamberSlogan: "Care",
    templateConfig: { colorTheme: "#0f8374", showLogo: true },
    chamberPhone: [{ phone: "01700000000" }],
  },
  patient: {
    name: "Rahim",
    age: 30,
    gender: "MALE",
    phone: "01711111111",
    bloodGroup: "O+",
    allergies: "Penicillin",
    chronicDiseases: "None",
    patientIdentifier: "P-0001",
  },
  ...overrides,
});

const medicine = (i: number) => ({
  brandName: `Napa ${i}`,
  strength: "500mg",
  type: "Tablet",
  generic: "Paracetamol",
  dosagePattern: "1+0+1",
  mealTiming: "AFTER_MEAL",
  duration: "7 days",
  instruction: "Take with water",
  notes: null,
});

const countFooter = (html: string) =>
  (html.match(/class="page-footer"/g) || []).length;

describe("generatePrescriptionHtml — pagination & layout", () => {
  it("Case A: single medicine renders one footer anchored to the bottom", () => {
    const html = generatePrescriptionHtml(baseData({ medicines: [medicine(1)] }));
    expect(countFooter(html)).toBe(1);
    expect(html).toContain("margin-top: auto");
    expect(html).not.toContain("position: fixed");
  });

  it("Case B: many medicines still render exactly one footer (no repetition)", () => {
    const medicines = Array.from({ length: 25 }, (_, i) => medicine(i + 1));
    const html = generatePrescriptionHtml(baseData({ medicines }));
    expect(countFooter(html)).toBe(1);
    expect((html.match(/class="medicine-item"/g) || []).length).toBe(25);
  });

  it("Case C: very long instructions do not break the single footer", () => {
    const long = "A".repeat(5000);
    const html = generatePrescriptionHtml(
      baseData({ medicines: [{ ...medicine(1), instruction: long }] }),
    );
    expect(countFooter(html)).toBe(1);
    expect(html).toContain(long);
  });
});

describe("generatePrescriptionHtml — instruction types (Section 13.1)", () => {
  it("STANDARD: renders structured morning/noon/night frequency", () => {
    const html = generatePrescriptionHtml(
      baseData({
        medicines: [
          {
            ...medicine(1),
            usageType: "DAILY",
            frequencyMorning: 1,
            frequencyNoon: 0,
            frequencyNight: 1,
          },
        ],
      }),
    );
    expect(html).toContain("1+0+1");
  });

  it("WEEKLY: renders interval schedule", () => {
    const html = generatePrescriptionHtml(
      baseData({
        medicines: [
          {
            ...medicine(1),
            usageType: "WEEKLY",
            dose: "Apply once",
            intervalDays: 7,
            durationValue: 4,
            durationUnit: "week",
          },
        ],
      }),
    );
    expect(html).toContain("Apply once");
    expect(html).toContain("every 7 days");
    expect(html).toContain("4 weeks");
  });

  it("TOPICAL: renders application amount and area", () => {
    const html = generatePrescriptionHtml(
      baseData({
        medicines: [
          {
            ...medicine(1),
            usageType: "TOPICAL",
            applicationAmount: "Thin layer",
            applicationArea: "affected area",
            applicationFrequency: "twice daily",
          },
        ],
      }),
    );
    expect(html).toContain("Thin layer");
    expect(html).toContain("to affected area");
    expect(html).toContain("twice daily");
  });

  it("CUSTOM: renders a structured custom schedule", () => {
    const html = generatePrescriptionHtml(
      baseData({
        medicines: [
          {
            ...medicine(1),
            usageType: "CUSTOM",
            customScheduleJson: { day1: "1 dose", day2: "1 dose", day3: 0 },
          },
        ],
      }),
    );
    expect(html).toContain("day1: 1 dose");
    expect(html).toContain("day3: 0");
  });
});

describe("generatePrescriptionHtml — content", () => {
  it("prints the patient identifier and serial without the removed footer text", () => {
    const html = generatePrescriptionHtml(baseData({ medicines: [medicine(1)] }));
    expect(html).toContain("P-0001");
    expect(html).toContain("PRS-ABCD-000001");
    expect(html).toContain("Test Chamber");
    // The generated/disclaimer footer and the "Registered Practitioner" label
    // are intentionally removed from every template.
    expect(html).not.toContain("Generated:");
    expect(html).not.toContain("Registered Practitioner");
    expect(html).not.toContain("digitally generated prescription");
  });

  it("only prints BMDC when the doctor is approved", () => {
    const approved = generatePrescriptionHtml(
      baseData({ medicines: [medicine(1)] }),
    );
    expect(approved).toContain("BMDC Reg No");

    const unapproved = generatePrescriptionHtml(
      baseData({
        medicines: [medicine(1)],
        doctor: { ...baseData().doctor, bmdcApproved: false },
      }),
    );
    expect(unapproved).not.toContain("BMDC Reg No");
  });
});

describe("generatePrescriptionHtml — security", () => {
  it("escapes user-controlled HTML", () => {
    const html = generatePrescriptionHtml(
      baseData({
        complaints: '<script>alert("xss")</script>',
        patient: { ...baseData().patient, name: "<img src=x onerror=alert(1)>" },
        medicines: [{ ...medicine(1), brandName: "<b>Evil</b>" }],
      }),
    );
    expect(html).not.toContain("<script>alert");
    expect(html).not.toContain("<img src=x onerror");
    expect(html).not.toContain("<b>Evil</b>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("rejects non-http(s) signature/logo URLs", () => {
    const html = generatePrescriptionHtml(
      baseData({
        medicines: [medicine(1)],
        doctor: { ...baseData().doctor, signature: "javascript:alert(1)" },
        chamber: { ...baseData().chamber!, logo: "data:text/html;base64,PHN2Zz4=" },
      }),
    );
    expect(html).not.toContain("javascript:alert(1)");
    expect(html).not.toContain("data:text/html");
  });
});
