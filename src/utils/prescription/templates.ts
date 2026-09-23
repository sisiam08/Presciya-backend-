import {
  PrescriptionDesignTemplate,
} from "../../../generated/prisma/enums";
import { MedicineViewModel, PrescriptionViewModel } from "./view-model";

// ─────────────────────────────────────────────────────────────────────────────
// Shared document shell
//
// Every template renders the SAME view model (PrescriptionViewModel) and only
// changes layout. Pagination strategy is identical across templates: one flex
// column document whose footer uses `margin-top: auto`, so the signature/footer
// anchors to the bottom of the last page and never repeats.
// ─────────────────────────────────────────────────────────────────────────────

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Noto+Sans+Bengali:wght@400;500;600;700&display=swap');`;

const BASE_STYLES = `
  @page { size: A4; margin: 15mm 15mm 20mm 15mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: 'Outfit', 'Noto Sans Bengali', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: #333333;
    background-color: #ffffff;
    font-size: 14px;
    line-height: 1.5;
    display: flex;
    flex-direction: column;
    min-height: 262mm;
  }
  .doc { flex: 1; display: flex; flex-direction: column; position: relative; z-index: 1; }
  /* ── Bottom region ──────────────────────────────────────────────────────
     ONE bottom-anchored block containing the custom footer/contact text AND
     the QR + signature row. Previously the auto top-margin sat on the
     QR/signature row only, so the contact text stayed immediately after the
     content and floated in the middle of the page while the signature dropped
     to the bottom. Anchoring the whole region keeps the intended order:
       content → flexible space → footer text → QR/signature → bottom margin */
  .page-footer-region {
    margin-top: auto;
    /* Explicit bottom breathing room after the LAST line of the footer. The
       @page margin is not enough on its own: the footer/contact text must never
       touch the bottom edge, and the same spacing applies to every template
       because this rule is shared. */
    padding-bottom: 8mm;
    /* The footer is ONE unit: QR + signature row AND the contact text below it.
       Without this the print engine fragmented the region across the page
       boundary — the QR/signature stayed on the last content page while the
       contact line was orphaned onto a further, otherwise-blank page. */
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .page-footer {
    display: flex;
    page-break-inside: avoid;
    break-inside: avoid;
    /* Left = QR slot, right = signature. Never depends on how many children
       exist: the left slot is always rendered and the right slot is pushed
       across with an auto left margin, so the signature never slides left when
       the QR is absent. */
    justify-content: space-between;
    align-items: flex-end;
    gap: 12px;
  }
  .page-footer .footer-left { flex: 0 1 auto; min-width: 0; }
  .page-footer .footer-right { margin-left: auto; flex: 0 0 auto; }
  /* Keep every direct document block above the watermark layer. Must come
     BEFORE .rx-watermark so the watermark keeps its absolute positioning. */
  .doc > * { position: relative; z-index: 1; }
  /* Prescription watermark: behind the content, clipped to the document so it
     can never overflow A4 or cover medicines/patient/doctor/signature. */
  .rx-watermark {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 0;
    overflow: hidden;
    pointer-events: none;
  }
  .rx-watermark img { max-width: 55%; max-height: 55%; opacity: 0.07; }
  .rx-watermark span {
    font-size: 60px;
    font-weight: 800;
    letter-spacing: 6px;
    color: #111111;
    opacity: 0.05;
    transform: rotate(-24deg);
    white-space: nowrap;
  }
  /* Custom prescription footer (chamber or personal settings). */
  .rx-footer-text {
    font-size: 11px;
    color: #555555;
    text-align: center;
    margin-top: 8px;
    white-space: pre-line;
  }
  .medicine-item { page-break-inside: avoid; }
  .header, .patient-banner, .patient-card { page-break-inside: avoid; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
`;

export interface TemplateParts {
  styles: string;
  body: string;
}

export const renderDocument = (vm: PrescriptionViewModel, parts: TemplateParts): string => `
<!DOCTYPE html>
<html lang="${vm.isBangla ? "bn" : "en"}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Prescription - ${vm.patient.name || vm.serialNumber || vm.id}</title>
  <style>
${FONT_IMPORT}
${BASE_STYLES}
${parts.styles}
  </style>
</head>
<body>
${parts.body}
</body>
</html>
`;

// ─────────────────────────────────────────────────────────────────────────────
// Shared fragments
// ─────────────────────────────────────────────────────────────────────────────

const medGenericLine = (m: MedicineViewModel): string =>
  m.generic ? `<div class="med-generic">(${m.generic})</div>` : "";

const medInstructionLine = (m: MedicineViewModel): string =>
  m.instruction ? `<div class="med-instruction">👉 ${m.instruction}</div>` : "";

const medNotesLine = (m: MedicineViewModel): string =>
  m.notes ? `<div class="med-notes">* ${m.notes}</div>` : "";

// ── Watermark + custom footer (shared by every template) ─────────────────────
// The watermark is drawn behind the content and clipped to the document; the
// custom footer is a plain line rendered just above the page footer. Both are
// empty strings when not configured, so templates render nothing.

const watermarkLayer = (vm: PrescriptionViewModel): string => {
  if (!vm.watermark?.enabled) return "";
  const inner = vm.watermark.url
    ? `<img src="${vm.watermark.url}" alt="">`
    : vm.watermark.text
      ? `<span>${vm.watermark.text}</span>`
      : "";
  return inner ? `<div class="rx-watermark" aria-hidden="true">${inner}</div>` : "";
};

const customFooter = (vm: PrescriptionViewModel): string =>
  vm.footerText ? `<div class="rx-footer-text">${vm.footerText}</div>` : "";

// ── Optional clinical additions (history / On Examination / Investigation) ────
// Each returns "" when it has no content at all, so no template ever prints an
// empty heading or empty list. The title/body class names are passed in so every
// template keeps its own styling; `tag` matches each template's markup (some
// use <p>, some <div>).

interface SectionClasses {
  title: string;
  body: string;
  tag?: "div" | "p";
}

const historySection = (
  vm: PrescriptionViewModel,
  c: SectionClasses,
): string => {
  if (!vm.history) return "";
  const tag = c.tag ?? "div";
  // "Past History" so it never collides with the patient chronic/allergies
  // block, which some templates already title "History".
  return `<${tag} class="${c.title}">Past History</${tag}><${tag} class="${c.body}">${vm.history}</${tag}>`;
};

const examinationSection = (
  vm: PrescriptionViewModel,
  c: SectionClasses,
): string => {
  if (!vm.hasExamination) return "";
  const tag = c.tag ?? "div";
  const findings = vm.examination
    .map((e) => `<strong>${e.label}:</strong> ${e.value}`)
    .join(" &nbsp;&middot;&nbsp; ");
  return `<${tag} class="${c.title}">On Examination</${tag}><${tag} class="${c.body}">${findings}</${tag}>`;
};

// Per-template section styling (kept next to the helpers so a template change
// is a one-line edit here rather than in three call sites).
const DEFAULT_SECTION: SectionClasses = { title: "section-title", body: "notes-content" };
const MC_SECTION: SectionClasses = { title: "mc-sec-title", body: "mc-text", tag: "p" };
const MP_SECTION: SectionClasses = { title: "mp-sec-title", body: "mp-text" };
const MM_SECTION: SectionClasses = { title: "mm-sec-title", body: "mm-text", tag: "p" };
const EC_SECTION: SectionClasses = { title: "ec-sec-title", body: "ec-text" };

const investigationSection = (
  vm: PrescriptionViewModel,
  c: SectionClasses,
): string => {
  if (!vm.hasInvestigations) return "";
  const tag = c.tag ?? "div";
  const items = vm.investigations
    .map((inv) => `&bull; ${inv.testName}${inv.note ? ` &mdash; ${inv.note}` : ""}`)
    .join("<br/>");
  return `<${tag} class="${c.title}">Investigation</${tag}><${tag} class="${c.body}">${items}</${tag}>`;
};

const signatureBlock = (vm: PrescriptionViewModel, extraClass = ""): string => `
  <div class="signature-block ${extraClass}">
    ${
      vm.doctor.signature
        ? `<img class="sig-image" src="${vm.doctor.signature}" alt="Doctor Signature">`
        : `<div class="sig-space"></div>`
    }
    <div class="sig-line">${vm.doctor.name}</div>
  </div>
`;

// Renders nothing when no QR was generated (e.g. the plan does not include
// public QR verification), so a restricted plan never prints a broken image.
const qrBlock = (vm: PrescriptionViewModel, extraClass = ""): string => {
  if (!vm.qrCodeUrl) return "";
  return `
  <div class="footer-qr ${extraClass}">
    <img class="qr-image" src="${vm.qrCodeUrl}" alt="Verification QR Code">
    <div class="qr-text">
      <strong>Authentic Digital Record</strong><br>
      Scan to verify prescription authenticity.
    </div>
  </div>
`;
};

const bmdcChip = (vm: PrescriptionViewModel): string =>
  vm.doctor.registrationNo && vm.doctor.bmdcApproved
    ? `<span class="doctor-reg">BMDC Reg No: ${vm.doctor.registrationNo}</span>`
    : "";

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE 1 — DEFAULT (the original Classic design, preserved)
// ─────────────────────────────────────────────────────────────────────────────

const defaultTemplate = (vm: PrescriptionViewModel): TemplateParts => {
  const styles = `
    .header {
      display: flex; justify-content: space-between;
      border-bottom: 3px solid ${vm.colorTheme}; padding-bottom: 12px; margin-bottom: 15px;
    }
    .doctor-info { flex: 1; padding-right: 15px; }
    .doctor-name { font-size: 22px; font-weight: 700; color: ${vm.colorTheme}; margin: 0 0 4px 0; }
    .doctor-qualification { font-size: 13px; font-weight: 600; margin: 0 0 2px 0; }
    .doctor-specialty { font-size: 12px; color: #666666; margin: 0 0 6px 0; }
    .doctor-reg { font-size: 11px; background-color: #f0f7f6; color: ${vm.colorTheme}; padding: 2px 6px; border-radius: 4px; display: inline-block; font-weight: 600; }
    .chamber-info { flex: 1; text-align: right; padding-left: 15px; }
    .chamber-logo { max-height: 48px; max-width: 150px; margin-bottom: 6px; }
    .chamber-name { font-size: 18px; font-weight: 700; color: #333333; margin: 0 0 4px 0; }
    .chamber-slogan { font-size: 11px; font-style: italic; color: #666666; margin: 0 0 6px 0; }
    .chamber-detail { font-size: 11px; color: #555555; margin: 0 0 2px 0; }
    .patient-banner { background-color: #f4faf9; border-left: 4px solid ${vm.colorTheme}; border-radius: 4px; padding: 10px 15px; display: flex; flex-wrap: wrap; justify-content: space-between; margin-bottom: 20px; font-size: 13px; }
    .patient-field { margin-right: 15px; }
    .patient-field strong { color: #555555; }
    .content-body { display: flex; min-height: 550px; }
    .left-column { width: 30%; border-right: 1px solid #e0e0e0; padding-right: 15px; }
    .right-column { width: 70%; padding-left: 20px; }
    .section-title { font-size: 13px; font-weight: 700; color: ${vm.colorTheme}; text-transform: uppercase; border-bottom: 1px solid #f0f7f6; padding-bottom: 4px; margin: 15px 0 8px 0; letter-spacing: 0.5px; }
    .section-title:first-child { margin-top: 0; }
    .notes-content { font-size: 12px; color: #555555; white-space: pre-line; margin-bottom: 12px; }
    .rx-symbol { font-size: 28px; font-weight: 700; color: ${vm.colorTheme}; font-style: italic; margin: 0 0 10px 0; }
    .medicine-item { margin-bottom: 18px; }
    .med-header { font-size: 15px; font-weight: 600; margin-bottom: 2px; }
    .med-index { color: ${vm.colorTheme}; margin-right: 4px; }
    .med-name { color: #111111; }
    .med-type { font-size: 12px; color: #666666; font-weight: 400; }
    .med-generic { font-size: 11px; color: #666666; font-style: italic; margin-bottom: 4px; }
    .med-details { font-size: 13px; color: #333333; margin-bottom: 2px; }
    .med-pattern { background-color: #f0f7f6; color: ${vm.colorTheme}; font-weight: 600; padding: 1px 6px; border-radius: 4px; margin-right: 8px; }
    .med-meal { font-size: 12px; color: #555555; }
    .med-duration { font-weight: 600; color: #111111; }
    .med-instruction { font-size: 12px; color: #2e7d32; font-weight: 600; margin-top: 2px; }
    .med-notes { font-size: 11px; color: #888888; margin-top: 1px; }
    .page-footer { border-top: 1px solid #e0e0e0; padding-top: 10px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 11px; color: #888888; }
    .footer-meta { max-width: 260px; padding: 0 12px; text-align: center; }
    .footer-disclaimer { font-size: 9px; color: #999999; margin-top: 4px; line-height: 1.3; }
    .footer-generated { font-size: 9px; color: #aaaaaa; margin-top: 4px; }
    .footer-qr { display: flex; align-items: center; }
    .qr-image { width: 60px; height: 60px; margin-right: 8px; border: 1px solid #dddddd; padding: 2px; }
    .qr-text { line-height: 1.3; max-width: 140px; }
    .signature-block { text-align: right; width: 150px; }
    .sig-image { max-width: 120px; max-height: 50px; margin-bottom: 4px; }
    .sig-space { height: 50px; }
    .sig-line { border-top: 1px solid #999999; padding-top: 4px; font-weight: 600; font-size: 12px; color: #333333; }
    .sig-role { font-size: 9px; color: #666666; margin-top: 2px; }
  `;

  const medicinesHtml = vm.medicines
    .map((m) => {
      const details = [
        m.dosage ? `<span class="med-pattern">${m.dosage}</span>` : "",
        m.mealTimingLabel ? `<span class="med-meal">${m.mealTimingLabel}</span>` : "",
        m.duration ? `<span class="med-duration">${m.duration}</span>` : "",
      ]
        .filter(Boolean)
        .join(" &mdash; ");

      return `
      <div class="medicine-item">
        <div class="med-header">
          <span class="med-index">${m.index}.</span>
          <span class="med-name">${m.brandName} ${m.strength}</span>
          <span class="med-type">(${m.type})</span>
        </div>
        ${medGenericLine(m)}
        <div class="med-details">${details}</div>
        ${medInstructionLine(m)}
        ${medNotesLine(m)}
      </div>`;
    })
    .join("");

  const body = `
  <div class="doc">
    ${watermarkLayer(vm)}
    <div class="header">
      <div class="doctor-info">
        <h1 class="doctor-name">${vm.doctor.name}</h1>
        <p class="doctor-qualification">${vm.doctor.qualification}</p>
        <p class="doctor-specialty">${vm.doctor.specialization}</p>
        ${bmdcChip(vm)}
      </div>
      <div class="chamber-info">
        ${vm.chamber.logo ? `<img class="chamber-logo" src="${vm.chamber.logo}" alt="Chamber Logo">` : ""}
        ${vm.chamber.name ? `<h2 class="chamber-name">${vm.chamber.name}</h2>` : ""}
        ${vm.chamber.slogan ? `<p class="chamber-slogan">${vm.chamber.slogan}</p>` : ""}
        ${vm.chamber.address ? `<p class="chamber-detail">${vm.chamber.address}</p>` : ""}
        ${vm.chamber.phones ? `<p class="chamber-detail">📞 ${vm.chamber.phones}</p>` : ""}
        ${vm.chamber.email ? `<p class="chamber-detail">✉️ ${vm.chamber.email}</p>` : ""}
      </div>
    </div>

    <div class="patient-banner">
      <span class="patient-field"><strong>Patient:</strong> ${vm.patient.name}</span>
      <span class="patient-field"><strong>Age:</strong> ${vm.patient.age} Yrs</span>
      <span class="patient-field"><strong>Gender:</strong> ${vm.patient.gender}</span>
      ${vm.patient.weight ? `<span class="patient-field"><strong>Weight:</strong> ${vm.patient.weight} kg</span>` : ""}
      ${vm.patient.identifier ? `<span class="patient-field"><strong>Patient ID:</strong> ${vm.patient.identifier}</span>` : ""}
      <span class="patient-field"><strong>Date:</strong> ${vm.dateStr}</span>
      ${vm.serialNumber ? `<span class="patient-field"><strong>Rx No:</strong> ${vm.serialNumber}</span>` : ""}
    </div>

    <div class="content-body">
      <div class="left-column">
        ${examinationSection(vm, DEFAULT_SECTION)}
        ${vm.complaints ? `<div class="section-title">Complaints</div><div class="notes-content">${vm.complaints}</div>` : ""}
        ${historySection(vm, DEFAULT_SECTION)}
        ${vm.diagnosis ? `<div class="section-title">Diagnosis</div><div class="notes-content">${vm.diagnosis}</div>` : ""}
        ${investigationSection(vm, DEFAULT_SECTION)}
        ${
          vm.hasMedicalHistory
            ? `<div class="section-title">Medical History</div>
               ${vm.patient.chronicDiseases ? `<div class="notes-content"><strong>Chronic:</strong> ${vm.patient.chronicDiseases}</div>` : ""}
               ${vm.patient.allergies ? `<div class="notes-content" style="color:#c62828;"><strong>Allergies:</strong> ${vm.patient.allergies}</div>` : ""}`
            : ""
        }
        ${vm.clinicalNotes ? `<div class="section-title">${vm.labels.instructions}</div><div class="notes-content">${vm.clinicalNotes}</div>` : ""}
        ${vm.advises ? `<div class="section-title">${vm.labels.advice}</div><div class="notes-content">${vm.advises}</div>` : ""}
        <div class="section-title">${vm.labels.nextVisit}</div>
        <div class="notes-content" style="font-weight:600;color:${vm.colorTheme};">${vm.nextVisitStr}</div>
      </div>

      <div class="right-column">
        <div class="rx-symbol">Rx</div>
        ${medicinesHtml}
      </div>
    </div>

    <div class="page-footer-region">
      <div class="page-footer">
        <div class="footer-left">${qrBlock(vm)}</div>
        <div class="footer-right">${signatureBlock(vm)}</div>
      </div>
      ${customFooter(vm)}
    </div>
  </div>`;

  return { styles, body };
};

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE 2 — MODERN CLINICAL
// ─────────────────────────────────────────────────────────────────────────────

const modernClinicalTemplate = (vm: PrescriptionViewModel): TemplateParts => {
  const styles = `
    .mc-header { display: flex; align-items: center; gap: 16px; padding-bottom: 14px; border-bottom: 2px solid ${vm.colorTheme}; }
    .mc-logo { height: 56px; max-width: 120px; object-fit: contain; }
    .mc-identity { flex: 1; }
    .mc-doctor { font-size: 21px; font-weight: 700; color: #111111; margin: 0; }
    .mc-qual { font-size: 12.5px; font-weight: 600; color: #333333; margin: 2px 0 0; }
    .mc-spec { font-size: 12px; color: #666666; margin: 1px 0 0; }
    .mc-chamber { text-align: right; }
    .mc-chamber-name { font-size: 16px; font-weight: 700; color: ${vm.colorTheme}; margin: 0; }
    .mc-chamber-line { font-size: 10.5px; color: #666666; margin: 2px 0 0; }
    .mc-bmdc { display: inline-block; margin-top: 6px; font-size: 10.5px; font-weight: 600; color: ${vm.colorTheme}; background: #f0f7f6; border: 1px solid #d7ece8; border-radius: 999px; padding: 2px 9px; }

    .mc-patient { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px 18px; margin: 16px 0 18px; padding: 12px 16px; background: #f7faf9; border: 1px solid #e3efec; border-radius: 8px; }
    .mc-field-label { font-size: 9.5px; text-transform: uppercase; letter-spacing: .6px; color: #7a8a87; font-weight: 700; margin: 0; }
    .mc-field-value { font-size: 13px; font-weight: 600; color: #1b1b1b; margin: 1px 0 0; }

    .mc-clinical { display: grid; grid-template-columns: 1fr 1fr; gap: 0 22px; margin-bottom: 18px; }
    .mc-sec-title { font-size: 11px; font-weight: 700; letter-spacing: .8px; text-transform: uppercase; color: ${vm.colorTheme}; margin: 0 0 6px; padding-bottom: 3px; border-bottom: 1px solid #e3efec; }
    .mc-text { font-size: 12.5px; color: #444444; white-space: pre-line; margin: 0 0 12px; }
    .mc-vital { font-size: 12px; color: #444444; margin: 0 0 3px; }
    .mc-vital strong { color: #666666; }

    .mc-rx-head { display: flex; align-items: baseline; gap: 10px; border-bottom: 2px solid ${vm.colorTheme}; padding-bottom: 6px; margin-bottom: 12px; }
    .mc-rx { font-size: 22px; font-weight: 700; font-style: italic; color: ${vm.colorTheme}; margin: 0; }
    .mc-rx-sub { font-size: 10.5px; color: #8a8a8a; letter-spacing: .5px; text-transform: uppercase; }

    .medicine-item { padding: 10px 0; border-bottom: 1px dashed #e2e2e2; }
    .medicine-item:last-child { border-bottom: 0; }
    .mc-med-top { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
    .mc-med-name { font-size: 15px; font-weight: 700; color: #111111; }
    .mc-med-strength { font-weight: 600; color: ${vm.colorTheme}; }
    .mc-med-type { font-size: 11px; color: #777777; }
    .med-generic { font-size: 11.5px; color: #6b6b6b; font-style: italic; margin-top: 1px; }
    .mc-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
    .mc-chip { font-size: 11px; font-weight: 600; border-radius: 5px; padding: 2px 8px; }
    .mc-chip-dose { background: ${vm.colorTheme}; color: #ffffff; }
    .mc-chip-plain { background: #f0f3f2; color: #444444; }
    .med-instruction { font-size: 11.5px; color: #2e7d32; font-weight: 600; margin-top: 5px; }
    .med-notes { font-size: 11px; color: #888888; margin-top: 2px; }

    .mc-notes { display: grid; grid-template-columns: 1fr 1fr; gap: 0 22px; margin-top: 16px; }
    .mc-notes-full { grid-column: 1 / -1; }

    .page-footer { border-top: 1px solid #dcdcdc; padding-top: 10px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 11px; color: #888888; margin-top: 18px; }
    .footer-meta { max-width: 250px; padding: 0 12px; text-align: center; }
    .footer-disclaimer { font-size: 9px; color: #999999; margin-top: 4px; line-height: 1.3; }
    .footer-generated { font-size: 9px; color: #aaaaaa; margin-top: 4px; }
    .footer-qr { display: flex; align-items: center; }
    .qr-image { width: 58px; height: 58px; margin-right: 8px; border: 1px solid #dddddd; padding: 2px; }
    .qr-text { line-height: 1.3; max-width: 140px; }
    .signature-block { text-align: right; width: 160px; }
    .sig-image { max-width: 120px; max-height: 50px; margin-bottom: 4px; }
    .sig-space { height: 50px; }
    .sig-line { border-top: 1px solid #999999; padding-top: 4px; font-weight: 600; font-size: 12px; color: #333333; }
    .sig-role { font-size: 9px; color: #666666; margin-top: 2px; }
  `;

  const medicinesHtml = vm.medicines
    .map(
      (m) => `
      <div class="medicine-item">
        <div class="mc-med-top">
          <div>
            <span class="mc-med-name">${m.index}. ${m.brandName}</span>
            ${m.strength ? ` <span class="mc-med-strength">${m.strength}</span>` : ""}
          </div>
          <span class="mc-med-type">${m.type}</span>
        </div>
        ${medGenericLine(m)}
        <div class="mc-chips">
          ${m.dosage ? `<span class="mc-chip mc-chip-dose">${m.dosage}</span>` : ""}
          ${m.mealTimingLabel ? `<span class="mc-chip mc-chip-plain">${m.mealTimingLabel}</span>` : ""}
          ${m.duration ? `<span class="mc-chip mc-chip-plain">${m.duration}</span>` : ""}
        </div>
        ${medInstructionLine(m)}
        ${medNotesLine(m)}
      </div>`,
    )
    .join("");

  const body = `
  <div class="doc">
    ${watermarkLayer(vm)}
    <div class="mc-header">
      ${vm.chamber.logo ? `<img class="mc-logo" src="${vm.chamber.logo}" alt="Logo">` : ""}
      <div class="mc-identity">
        <h1 class="mc-doctor">${vm.doctor.name}</h1>
        ${vm.doctor.qualification ? `<p class="mc-qual">${vm.doctor.qualification}</p>` : ""}
        ${vm.doctor.specialization ? `<p class="mc-spec">${vm.doctor.specialization}</p>` : ""}
      </div>
      <div class="mc-chamber">
        ${vm.chamber.name ? `<h2 class="mc-chamber-name">${vm.chamber.name}</h2>` : ""}
        ${vm.chamber.address ? `<p class="mc-chamber-line">${vm.chamber.address}</p>` : ""}
        ${vm.chamber.phones ? `<p class="mc-chamber-line">${vm.chamber.phones}</p>` : ""}
        ${vm.chamber.email ? `<p class="mc-chamber-line">${vm.chamber.email}</p>` : ""}
        ${bmdcChip(vm)}
      </div>
    </div>

    <div class="mc-patient">
      <div><p class="mc-field-label">Patient</p><p class="mc-field-value">${vm.patient.name}</p></div>
      <div><p class="mc-field-label">Age</p><p class="mc-field-value">${vm.patient.age} Yrs</p></div>
      <div><p class="mc-field-label">Gender</p><p class="mc-field-value">${vm.patient.gender}</p></div>
      <div><p class="mc-field-label">Date</p><p class="mc-field-value">${vm.dateStr}</p></div>
      ${vm.patient.identifier ? `<div><p class="mc-field-label">Patient ID</p><p class="mc-field-value">${vm.patient.identifier}</p></div>` : ""}
      ${vm.patient.weight ? `<div><p class="mc-field-label">Weight</p><p class="mc-field-value">${vm.patient.weight} kg</p></div>` : ""}
      ${vm.serialNumber ? `<div><p class="mc-field-label">Rx No</p><p class="mc-field-value">${vm.serialNumber}</p></div>` : ""}
    </div>

    <div class="mc-clinical">
      <div>
        ${examinationSection(vm, MC_SECTION)}
        ${vm.complaints ? `<p class="mc-sec-title">Complaints</p><p class="mc-text">${vm.complaints}</p>` : ""}
        ${historySection(vm, MC_SECTION)}
        ${vm.diagnosis ? `<p class="mc-sec-title">Diagnosis</p><p class="mc-text">${vm.diagnosis}</p>` : ""}
        ${investigationSection(vm, MC_SECTION)}
      </div>
      <div>
        ${
          vm.hasMedicalHistory
            ? `${vm.patient.chronicDiseases ? `<p class="mc-vital"><strong>Chronic:</strong> ${vm.patient.chronicDiseases}</p>` : ""}
               ${vm.patient.allergies ? `<p class="mc-vital"><strong>Allergies:</strong> ${vm.patient.allergies}</p>` : ""}`
            : ""
        }
      </div>
    </div>

    <div class="mc-rx-head">
      <span class="mc-rx">Rx</span>
      <span class="mc-rx-sub">Prescription</span>
    </div>
    ${medicinesHtml}

    <div class="mc-notes">
      ${vm.advises ? `<div><p class="mc-sec-title">${vm.labels.advice}</p><p class="mc-text">${vm.advises}</p></div>` : ""}
      ${vm.clinicalNotes ? `<div><p class="mc-sec-title">${vm.labels.instructions}</p><p class="mc-text">${vm.clinicalNotes}</p></div>` : ""}
      <div><p class="mc-sec-title">${vm.labels.nextVisit}</p><p class="mc-text" style="font-weight:600;color:${vm.colorTheme};">${vm.nextVisitStr}</p></div>
    </div>

    <div class="page-footer-region">
      <div class="page-footer">
        <div class="footer-left">${qrBlock(vm)}</div>
        <div class="footer-right">${signatureBlock(vm)}</div>
      </div>
      ${customFooter(vm)}
    </div>
  </div>`;

  return { styles, body };
};

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE 3 — MINIMAL PROFESSIONAL
// ─────────────────────────────────────────────────────────────────────────────

const minimalProfessionalTemplate = (
  vm: PrescriptionViewModel,
): TemplateParts => {
  const styles = `
    .mp-head { display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 16px; border-bottom: 1px solid #d8d8d8; }
    .mp-doctor { font-size: 20px; font-weight: 600; letter-spacing: .2px; color: #111111; margin: 0; }
    .mp-qual { font-size: 12px; color: #555555; margin: 3px 0 0; }
    .mp-chamber { text-align: right; }
    .mp-chamber-name { font-size: 13px; font-weight: 600; color: #333333; margin: 0; }
    .mp-chamber-line { font-size: 10.5px; color: #777777; margin: 2px 0 0; }
    .mp-logo { height: 42px; max-width: 110px; object-fit: contain; margin-bottom: 4px; }

    .mp-patient { display: flex; flex-wrap: wrap; gap: 6px 26px; margin: 20px 0 6px; font-size: 12.5px; color: #333333; }
    .mp-patient span strong { color: #999999; font-weight: 500; text-transform: uppercase; font-size: 9.5px; letter-spacing: .6px; margin-right: 5px; }
    .mp-rule { border: 0; border-top: 1px solid #eeeeee; margin: 16px 0; }

    .mp-rx { font-size: 24px; font-weight: 400; font-style: italic; color: #222222; margin: 8px 0 14px; }
    .medicine-item { padding: 9px 0; border-bottom: 1px solid #f0f0f0; }
    .medicine-item:last-child { border-bottom: 0; }
    .mp-med-name { font-size: 14.5px; font-weight: 600; color: #111111; }
    .mp-med-strength { font-weight: 400; color: #444444; }
    .med-generic { font-size: 11.5px; color: #777777; font-style: italic; margin-top: 1px; }
    .mp-med-line { font-size: 12px; color: #555555; margin-top: 3px; }
    .mp-sep { color: #cccccc; margin: 0 7px; }
    .med-instruction { font-size: 11.5px; color: #444444; margin-top: 3px; }
    .med-notes { font-size: 11px; color: #999999; margin-top: 2px; }

    .mp-notes { margin-top: 22px; display: flex; flex-direction: column; gap: 14px; }
    .mp-sec-title { font-size: 9.5px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: #999999; margin: 0 0 4px; }
    .mp-text { font-size: 12.5px; color: #333333; white-space: pre-line; margin: 0; }

    .page-footer { border-top: 1px solid #d8d8d8; padding-top: 12px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 11px; color: #888888; margin-top: 26px; }
    .footer-meta { max-width: 260px; padding: 0 12px; text-align: center; }
    .footer-disclaimer { font-size: 9px; color: #aaaaaa; line-height: 1.35; }
    .footer-generated { font-size: 9px; color: #bbbbbb; margin-top: 4px; }
    .footer-qr { display: flex; align-items: center; }
    .qr-image { width: 54px; height: 54px; margin-right: 8px; border: 1px solid #e2e2e2; padding: 2px; }
    .qr-text { line-height: 1.3; max-width: 130px; color: #999999; }
    .signature-block { text-align: right; width: 160px; }
    .sig-image { max-width: 120px; max-height: 48px; margin-bottom: 4px; }
    .sig-space { height: 48px; }
    .sig-line { border-top: 1px solid #bbbbbb; padding-top: 4px; font-weight: 600; font-size: 12px; color: #333333; }
    .sig-role { font-size: 9px; color: #888888; margin-top: 2px; }
  `;

  const medicinesHtml = vm.medicines
    .map((m) => {
      const line = [m.dosage, m.mealTimingLabel, m.duration]
        .filter(Boolean)
        .join(`<span class="mp-sep">·</span>`);
      return `
      <div class="medicine-item">
        <div class="mp-med-name">${m.index}. ${m.brandName}${m.strength ? ` <span class="mp-med-strength">${m.strength}</span>` : ""}</div>
        ${medGenericLine(m)}
        ${line ? `<div class="mp-med-line">${line}</div>` : ""}
        ${medInstructionLine(m)}
        ${medNotesLine(m)}
      </div>`;
    })
    .join("");

  const body = `
  <div class="doc">
    ${watermarkLayer(vm)}
    <div class="mp-head">
      <div>
        ${vm.chamber.logo ? `<img class="mp-logo" src="${vm.chamber.logo}" alt="Logo">` : ""}
        <h1 class="mp-doctor">${vm.doctor.name}</h1>
        ${vm.doctor.qualification ? `<p class="mp-qual">${vm.doctor.qualification}</p>` : ""}
        ${vm.doctor.specialization ? `<p class="mp-qual">${vm.doctor.specialization}</p>` : ""}
      </div>
      <div class="mp-chamber">
        ${vm.chamber.name ? `<p class="mp-chamber-name">${vm.chamber.name}</p>` : ""}
        ${vm.chamber.address ? `<p class="mp-chamber-line">${vm.chamber.address}</p>` : ""}
        ${vm.chamber.phones ? `<p class="mp-chamber-line">${vm.chamber.phones}</p>` : ""}
        ${vm.chamber.email ? `<p class="mp-chamber-line">${vm.chamber.email}</p>` : ""}
        ${bmdcChip(vm)}
      </div>
    </div>

    <div class="mp-patient">
      <span><strong>Patient</strong>${vm.patient.name}</span>
      <span><strong>Age</strong>${vm.patient.age} Yrs</span>
      <span><strong>Gender</strong>${vm.patient.gender}</span>
      ${vm.patient.weight ? `<span><strong>Weight</strong>${vm.patient.weight} kg</span>` : ""}
      ${vm.patient.identifier ? `<span><strong>ID</strong>${vm.patient.identifier}</span>` : ""}
      <span><strong>Date</strong>${vm.dateStr}</span>
      ${vm.serialNumber ? `<span><strong>Rx No</strong>${vm.serialNumber}</span>` : ""}
    </div>
    <hr class="mp-rule">

    ${vm.hasExamination ? `<div class="mp-notes"><div>${examinationSection(vm, MP_SECTION)}</div></div>` : ""}
    ${vm.complaints ? `<div class="mp-notes"><div><p class="mp-sec-title">Complaints</p><p class="mp-text">${vm.complaints}</p></div></div>` : ""}
    ${vm.history ? `<div class="mp-notes"><div>${historySection(vm, MP_SECTION)}</div></div>` : ""}
    ${vm.diagnosis ? `<div class="mp-notes"><div><p class="mp-sec-title">Diagnosis</p><p class="mp-text">${vm.diagnosis}</p></div></div>` : ""}
    ${vm.hasInvestigations ? `<div class="mp-notes"><div>${investigationSection(vm, MP_SECTION)}</div></div>` : ""}

    <div class="mp-rx">Rx</div>
    ${medicinesHtml}

    <div class="mp-notes">
      ${vm.advises ? `<div><p class="mp-sec-title">${vm.labels.advice}</p><p class="mp-text">${vm.advises}</p></div>` : ""}
      ${vm.clinicalNotes ? `<div><p class="mp-sec-title">${vm.labels.instructions}</p><p class="mp-text">${vm.clinicalNotes}</p></div>` : ""}
      <div><p class="mp-sec-title">${vm.labels.nextVisit}</p><p class="mp-text" style="font-weight:600;">${vm.nextVisitStr}</p></div>
    </div>

    <div class="page-footer-region">
      <div class="page-footer">
        <div class="footer-left">${qrBlock(vm)}</div>
        <div class="footer-right">${signatureBlock(vm)}</div>
      </div>
      ${customFooter(vm)}
    </div>
  </div>`;

  return { styles, body };
};

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE 4 — MODERN MEDICAL
// ─────────────────────────────────────────────────────────────────────────────

const modernMedicalTemplate = (vm: PrescriptionViewModel): TemplateParts => {
  const styles = `
    .mm-band { display: flex; justify-content: space-between; align-items: center; gap: 14px; background: ${vm.colorTheme}; color: #ffffff; border-radius: 8px; padding: 14px 18px; }
    .mm-band-left { display: flex; align-items: center; gap: 12px; }
    .mm-logo { height: 46px; max-width: 100px; object-fit: contain; background: #ffffff; border-radius: 6px; padding: 3px; }
    .mm-doctor { font-size: 18px; font-weight: 700; margin: 0; color: #ffffff; }
    .mm-qual { font-size: 11.5px; margin: 2px 0 0; color: rgba(255,255,255,.9); }
    .mm-band-right { text-align: right; }
    .mm-chamber { font-size: 14px; font-weight: 700; margin: 0; color: #ffffff; }
    .mm-contact { font-size: 10.5px; margin: 2px 0 0; color: rgba(255,255,255,.9); }
    .mm-bmdc { display: inline-block; margin-top: 4px; font-size: 10px; font-weight: 600; background: rgba(255,255,255,.16); border-radius: 4px; padding: 1px 7px; }

    .mm-patient { display: flex; flex-wrap: wrap; gap: 4px 24px; margin: 14px 0 4px; padding: 10px 14px; border: 1px solid #e6e6e6; border-left: 4px solid ${vm.colorTheme}; border-radius: 6px; font-size: 12.5px; }
    .mm-patient span strong { color: #888888; font-size: 9.5px; text-transform: uppercase; letter-spacing: .5px; margin-right: 5px; font-weight: 700; }

    .mm-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 20px; margin-top: 14px; }
    .mm-sec-title { font-size: 10.5px; font-weight: 700; letter-spacing: .7px; text-transform: uppercase; color: #ffffff; background: ${vm.colorTheme}; border-radius: 4px; padding: 3px 8px; display: inline-block; margin: 0 0 6px; }
    .mm-text { font-size: 12px; color: #444444; white-space: pre-line; margin: 0 0 10px; }
    .mm-vital { font-size: 11.5px; color: #444444; margin: 0 0 3px; }

    .mm-rx-title { display: flex; align-items: center; gap: 10px; margin: 16px 0 8px; }
    .mm-rx { font-size: 20px; font-weight: 700; font-style: italic; color: ${vm.colorTheme}; margin: 0; }
    .mm-rx-rule { flex: 1; height: 2px; background: #ececec; }

    .medicine-item { border: 1px solid #ececec; border-radius: 6px; padding: 9px 12px; margin-bottom: 8px; }
    .mm-med-top { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
    .mm-med-name { font-size: 14px; font-weight: 700; color: #111111; }
    .mm-med-strength { color: ${vm.colorTheme}; font-weight: 700; }
    .mm-med-type { font-size: 10.5px; color: #888888; text-transform: uppercase; letter-spacing: .4px; }
    .med-generic { font-size: 11px; color: #777777; font-style: italic; margin-top: 1px; }
    .mm-med-meta { font-size: 12px; color: #333333; margin-top: 4px; }
    .mm-med-meta strong { color: #666666; }
    .med-instruction { font-size: 11.5px; color: #2e7d32; font-weight: 600; margin-top: 3px; }
    .med-notes { font-size: 11px; color: #999999; margin-top: 2px; }

    .mm-notes { display: grid; grid-template-columns: 1fr 1fr; gap: 0 20px; margin-top: 14px; }

    .page-footer { border-top: 2px solid ${vm.colorTheme}; padding-top: 10px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 11px; color: #888888; margin-top: 16px; }
    .footer-meta { max-width: 250px; padding: 0 12px; text-align: center; }
    .footer-disclaimer { font-size: 9px; color: #999999; margin-top: 4px; line-height: 1.3; }
    .footer-generated { font-size: 9px; color: #aaaaaa; margin-top: 4px; }
    .footer-qr { display: flex; align-items: center; }
    .qr-image { width: 58px; height: 58px; margin-right: 8px; border: 1px solid #dddddd; padding: 2px; }
    .qr-text { line-height: 1.3; max-width: 140px; }
    .signature-block { text-align: right; width: 160px; }
    .sig-image { max-width: 120px; max-height: 50px; margin-bottom: 4px; }
    .sig-space { height: 50px; }
    .sig-line { border-top: 1px solid #999999; padding-top: 4px; font-weight: 600; font-size: 12px; color: #333333; }
    .sig-role { font-size: 9px; color: #666666; margin-top: 2px; }
  `;

  const medicinesHtml = vm.medicines
    .map(
      (m) => `
      <div class="medicine-item">
        <div class="mm-med-top">
          <div><span class="mm-med-name">${m.index}. ${m.brandName}</span>${m.strength ? ` <span class="mm-med-strength">${m.strength}</span>` : ""}</div>
          <span class="mm-med-type">${m.type}</span>
        </div>
        ${medGenericLine(m)}
        <div class="mm-med-meta">
          ${m.dosage ? `<strong>Dose:</strong> ${m.dosage}` : ""}
          ${m.mealTimingLabel ? ` &nbsp;·&nbsp; ${m.mealTimingLabel}` : ""}
          ${m.duration ? ` &nbsp;·&nbsp; <strong>Duration:</strong> ${m.duration}` : ""}
        </div>
        ${medInstructionLine(m)}
        ${medNotesLine(m)}
      </div>`,
    )
    .join("");

  const body = `
  <div class="doc">
    ${watermarkLayer(vm)}
    <div class="mm-band">
      <div class="mm-band-left">
        ${vm.chamber.logo ? `<img class="mm-logo" src="${vm.chamber.logo}" alt="Logo">` : ""}
        <div>
          <h1 class="mm-doctor">${vm.doctor.name}</h1>
          ${vm.doctor.qualification ? `<p class="mm-qual">${vm.doctor.qualification}</p>` : ""}
          ${vm.doctor.specialization ? `<p class="mm-qual">${vm.doctor.specialization}</p>` : ""}
        </div>
      </div>
      <div class="mm-band-right">
        ${vm.chamber.name ? `<p class="mm-chamber">${vm.chamber.name}</p>` : ""}
        ${vm.chamber.address ? `<p class="mm-contact">${vm.chamber.address}</p>` : ""}
        ${vm.chamber.phones ? `<p class="mm-contact">${vm.chamber.phones}</p>` : ""}
        ${vm.doctor.registrationNo && vm.doctor.bmdcApproved ? `<span class="mm-bmdc">BMDC: ${vm.doctor.registrationNo}</span>` : ""}
      </div>
    </div>

    <div class="mm-patient">
      <span><strong>Patient</strong>${vm.patient.name}</span>
      <span><strong>Age</strong>${vm.patient.age} Yrs</span>
      <span><strong>Gender</strong>${vm.patient.gender}</span>
      ${vm.patient.weight ? `<span><strong>Weight</strong>${vm.patient.weight} kg</span>` : ""}
      ${vm.patient.identifier ? `<span><strong>ID</strong>${vm.patient.identifier}</span>` : ""}
      <span><strong>Date</strong>${vm.dateStr}</span>
      ${vm.serialNumber ? `<span><strong>Rx No</strong>${vm.serialNumber}</span>` : ""}
    </div>

    <div class="mm-grid">
      <div>
        ${examinationSection(vm, MM_SECTION)}
        ${vm.complaints ? `<p class="mm-sec-title">Complaints</p><p class="mm-text">${vm.complaints}</p>` : ""}
        ${historySection(vm, MM_SECTION)}
        ${vm.diagnosis ? `<p class="mm-sec-title">Diagnosis</p><p class="mm-text">${vm.diagnosis}</p>` : ""}
        ${investigationSection(vm, MM_SECTION)}
      </div>
      <div>
        ${
          vm.hasMedicalHistory
            ? `${vm.patient.chronicDiseases ? `<p class="mm-vital"><strong>Chronic:</strong> ${vm.patient.chronicDiseases}</p>` : ""}
               ${vm.patient.allergies ? `<p class="mm-vital"><strong>Allergies:</strong> ${vm.patient.allergies}</p>` : ""}`
            : ""
        }
      </div>
    </div>

    <div class="mm-rx-title">
      <span class="mm-rx">Rx</span>
      <span class="mm-rx-rule"></span>
    </div>
    ${medicinesHtml}

    <div class="mm-notes">
      ${vm.advises ? `<div><p class="mm-sec-title">${vm.labels.advice}</p><p class="mm-text">${vm.advises}</p></div>` : ""}
      ${vm.clinicalNotes ? `<div><p class="mm-sec-title">${vm.labels.instructions}</p><p class="mm-text">${vm.clinicalNotes}</p></div>` : ""}
      <div><p class="mm-sec-title">${vm.labels.nextVisit}</p><p class="mm-text" style="font-weight:600;color:${vm.colorTheme};">${vm.nextVisitStr}</p></div>
    </div>

    <div class="page-footer-region">
      <div class="page-footer">
        <div class="footer-left">${qrBlock(vm)}</div>
        <div class="footer-right">${signatureBlock(vm)}</div>
      </div>
      ${customFooter(vm)}
    </div>
  </div>`;

  return { styles, body };
};

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE 5 — ELEGANT COMPACT
// ─────────────────────────────────────────────────────────────────────────────

const elegantCompactTemplate = (vm: PrescriptionViewModel): TemplateParts => {
  const styles = `
    .ec-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding-bottom: 10px; border-bottom: 1.5px solid #222222; }
    .ec-doctor { font-size: 17px; font-weight: 700; letter-spacing: .2px; color: #111111; margin: 0; }
    .ec-qual { font-size: 10.5px; color: #555555; margin: 2px 0 0; }
    .ec-right { text-align: right; }
    .ec-chamber { font-size: 12px; font-weight: 600; color: #222222; margin: 0; }
    .ec-contact { font-size: 10px; color: #777777; margin: 1px 0 0; }
    .ec-logo { height: 36px; max-width: 90px; object-fit: contain; }
    .ec-bmdc { font-size: 9.5px; color: #555555; }

    .ec-patient { display: flex; flex-wrap: wrap; gap: 2px 20px; margin: 10px 0 4px; font-size: 11.5px; color: #333333; }
    .ec-patient strong { color: #999999; font-weight: 600; font-size: 9px; text-transform: uppercase; letter-spacing: .4px; margin-right: 4px; }

    .ec-body { display: grid; grid-template-columns: 32% 1fr; gap: 0 16px; margin-top: 10px; }
    .ec-side { border-right: 1px solid #ececec; padding-right: 14px; }
    .ec-sec-title { font-size: 9.5px; font-weight: 700; letter-spacing: .8px; text-transform: uppercase; color: #666666; border-bottom: 1px solid #f0f0f0; padding-bottom: 2px; margin: 10px 0 5px; }
    .ec-sec-title:first-child { margin-top: 0; }
    .ec-text { font-size: 11px; color: #444444; white-space: pre-line; margin: 0 0 8px; }
    .ec-vital { font-size: 10.5px; color: #444444; margin: 0 0 2px; }

    .ec-rx { font-size: 17px; font-weight: 700; font-style: italic; color: ${vm.colorTheme}; margin: 0 0 6px; }
    .medicine-item { padding: 6px 0; border-bottom: 1px dotted #e2e2e2; }
    .medicine-item:last-child { border-bottom: 0; }
    .ec-med-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
    .ec-med-name { font-size: 12.5px; font-weight: 700; color: #111111; }
    .ec-med-strength { font-weight: 600; color: ${vm.colorTheme}; }
    .ec-med-type { font-size: 9.5px; color: #999999; }
    .med-generic { font-size: 10px; color: #777777; font-style: italic; }
    .ec-med-line { font-size: 10.5px; color: #444444; margin-top: 2px; }
    .ec-chip { display: inline-block; background: #f2f5f4; color: #333333; border-radius: 3px; padding: 0 5px; font-weight: 600; margin-right: 4px; }
    .ec-chip-dose { background: ${vm.colorTheme}; color: #ffffff; }
    .med-instruction { font-size: 10px; color: #2e7d32; font-weight: 600; margin-top: 2px; }
    .med-notes { font-size: 9.5px; color: #999999; margin-top: 1px; }

    .page-footer { border-top: 1px solid #d8d8d8; padding-top: 8px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 10px; color: #888888; margin-top: 14px; }
    .footer-meta { max-width: 240px; padding: 0 10px; text-align: center; }
    .footer-disclaimer { font-size: 8.5px; color: #aaaaaa; line-height: 1.3; }
    .footer-generated { font-size: 8.5px; color: #bbbbbb; margin-top: 3px; }
    .footer-qr { display: flex; align-items: center; }
    .qr-image { width: 50px; height: 50px; margin-right: 7px; border: 1px solid #e2e2e2; padding: 2px; }
    .qr-text { line-height: 1.25; max-width: 120px; }
    .signature-block { text-align: right; width: 150px; }
    .sig-image { max-width: 110px; max-height: 42px; margin-bottom: 3px; }
    .sig-space { height: 42px; }
    .sig-line { border-top: 1px solid #bbbbbb; padding-top: 3px; font-weight: 600; font-size: 11px; color: #333333; }
    .sig-role { font-size: 8.5px; color: #888888; margin-top: 1px; }
  `;

  const medicinesHtml = vm.medicines
    .map(
      (m) => `
      <div class="medicine-item">
        <div class="ec-med-head">
          <div><span class="ec-med-name">${m.index}. ${m.brandName}</span>${m.strength ? ` <span class="ec-med-strength">${m.strength}</span>` : ""}</div>
          <span class="ec-med-type">${m.type}</span>
        </div>
        ${medGenericLine(m)}
        <div class="ec-med-line">
          ${m.dosage ? `<span class="ec-chip ec-chip-dose">${m.dosage}</span>` : ""}
          ${m.mealTimingLabel ? `<span class="ec-chip">${m.mealTimingLabel}</span>` : ""}
          ${m.duration ? `<span class="ec-chip">${m.duration}</span>` : ""}
        </div>
        ${medInstructionLine(m)}
        ${medNotesLine(m)}
      </div>`,
    )
    .join("");

  const body = `
  <div class="doc">
    ${watermarkLayer(vm)}
    <div class="ec-head">
      <div>
        <h1 class="ec-doctor">${vm.doctor.name}</h1>
        ${vm.doctor.qualification ? `<p class="ec-qual">${vm.doctor.qualification}</p>` : ""}
        ${vm.doctor.specialization ? `<p class="ec-qual">${vm.doctor.specialization}</p>` : ""}
      </div>
      <div class="ec-right">
        ${vm.chamber.logo ? `<img class="ec-logo" src="${vm.chamber.logo}" alt="Logo">` : ""}
        ${vm.chamber.name ? `<p class="ec-chamber">${vm.chamber.name}</p>` : ""}
        ${vm.chamber.address || vm.chamber.phones ? `<p class="ec-contact">${vm.chamber.address}${vm.chamber.phones ? ` · ${vm.chamber.phones}` : ""}</p>` : ""}
        ${vm.doctor.registrationNo && vm.doctor.bmdcApproved ? `<p class="ec-contact ec-bmdc">BMDC: ${vm.doctor.registrationNo}</p>` : ""}
      </div>
    </div>

    <div class="ec-patient">
      <span><strong>Patient</strong>${vm.patient.name}</span>
      <span><strong>Age</strong>${vm.patient.age} Yrs</span>
      <span><strong>Gender</strong>${vm.patient.gender}</span>
      ${vm.patient.weight ? `<span><strong>Weight</strong>${vm.patient.weight} kg</span>` : ""}
      ${vm.patient.identifier ? `<span><strong>ID</strong>${vm.patient.identifier}</span>` : ""}
      <span><strong>Date</strong>${vm.dateStr}</span>
      ${vm.serialNumber ? `<span><strong>Rx No</strong>${vm.serialNumber}</span>` : ""}
    </div>

    <div class="ec-body">
      <div class="ec-side">
        ${examinationSection(vm, EC_SECTION)}
        ${vm.complaints ? `<div class="ec-sec-title">Complaints</div><div class="ec-text">${vm.complaints}</div>` : ""}
        ${historySection(vm, EC_SECTION)}
        ${vm.diagnosis ? `<div class="ec-sec-title">Diagnosis</div><div class="ec-text">${vm.diagnosis}</div>` : ""}
        ${investigationSection(vm, EC_SECTION)}
        ${
          vm.hasMedicalHistory
            ? `<div class="ec-sec-title">History</div>
               ${vm.patient.chronicDiseases ? `<div class="ec-vital"><strong>Chronic:</strong> ${vm.patient.chronicDiseases}</div>` : ""}
               ${vm.patient.allergies ? `<div class="ec-vital" style="color:#c62828;"><strong>Allergies:</strong> ${vm.patient.allergies}</div>` : ""}`
            : ""
        }
        ${vm.advises ? `<div class="ec-sec-title">${vm.labels.advice}</div><div class="ec-text">${vm.advises}</div>` : ""}
        ${vm.clinicalNotes ? `<div class="ec-sec-title">${vm.labels.instructions}</div><div class="ec-text">${vm.clinicalNotes}</div>` : ""}
        <div class="ec-sec-title">${vm.labels.nextVisit}</div>
        <div class="ec-text" style="font-weight:600;color:${vm.colorTheme};">${vm.nextVisitStr}</div>
      </div>

      <div>
        <div class="ec-rx">Rx</div>
        ${medicinesHtml}
      </div>
    </div>

    <div class="page-footer-region">
      <div class="page-footer">
        <div class="footer-left">${qrBlock(vm)}</div>
        <div class="footer-right">${signatureBlock(vm)}</div>
      </div>
      ${customFooter(vm)}
    </div>
  </div>`;

  return { styles, body };
};

// ─────────────────────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────────────────────

export const TEMPLATE_RENDERERS: Record<
  string,
  (vm: PrescriptionViewModel) => TemplateParts
> = {
  [PrescriptionDesignTemplate.DEFAULT]: defaultTemplate,
  [PrescriptionDesignTemplate.MODERN_CLINICAL]: modernClinicalTemplate,
  [PrescriptionDesignTemplate.MINIMAL_PROFESSIONAL]: minimalProfessionalTemplate,
  [PrescriptionDesignTemplate.MODERN_MEDICAL]: modernMedicalTemplate,
  [PrescriptionDesignTemplate.ELEGANT_COMPACT]: elegantCompactTemplate,
};
