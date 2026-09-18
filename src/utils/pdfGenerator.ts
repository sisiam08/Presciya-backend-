import config from "../config";
import { IPdfRenderData } from "../interface/pdf.type";

// IPdfRenderData is defined in src/interface/pdf.type.ts

const escapeHtml = (unsafe?: string | number | null): string => {
  if (unsafe === undefined || unsafe === null) return "";
  const str = String(unsafe);
  return str.replace(/[&<>"'/]/g, (m) => {
    switch (m) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#x27;";
      case "/":
        return "&#x2F;";
      default:
        return m;
    }
  });
};

const escapeHtmlMultiline = (unsafe?: string | null): string => {
  if (!unsafe) return "";
  return escapeHtml(unsafe).replace(/\n/g, "<br>");
};

// Only allow absolute http(s) URLs into rendered attributes. Prevents
// javascript:/data: injection and unexpected resource loads (Section 14.5).
const safeUrl = (url?: string | null): string => {
  if (!url) return "";
  const trimmed = String(url).trim();
  if (!/^https?:\/\//i.test(trimmed)) return "";
  return trimmed.replace(/"/g, "%22").replace(/'/g, "%27");
};

export const generatePrescriptionHtml = (data: IPdfRenderData): string => {
  const {
    id,
    serialNumber,
    createdAt,
    complaints,
    diagnosis,
    bloodPressure,
    pulse,
    temperature,
    weight,
    height,
    clinicalNotes,
    advises,
    nextVisitDate,
    medicines,
    doctor,
    chamber,
    patient,
  } = data;

  const dateStr = new Date(createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const nextVisitStr = nextVisitDate
    ? new Date(nextVisitDate).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "As needed";

  const phones = chamber?.chamberPhone?.map((p) => p.phone).join(", ") || "N/A";
  const colorTheme = chamber?.templateConfig?.colorTheme || "#0f8374";
  const showLogo = chamber?.templateConfig?.showLogo !== false;

  const generatedAtStr = new Date().toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const disclaimer =
    chamber?.templateConfig?.disclaimer ||
    "This is a digitally generated prescription. Verify authenticity by scanning the QR code.";

  // Verification URL
  const verifyUrl = `${config.appUrl || "http://localhost:3000"}/verify/prescription/${id}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(
    verifyUrl,
  )}`;

  // Escape all basic doctor, chamber, and patient parameters for safe injection
  const docName = escapeHtml(doctor.name);
  const docQualification = escapeHtml(doctor.qualification);
  const docSpecialization = escapeHtml(doctor.specialization);
  const docRegNo = escapeHtml(doctor.registrationNo);
  const docSignature = safeUrl(doctor.signature);
  const chamberLogo = showLogo ? safeUrl(chamber?.logo) : "";
  const chName = escapeHtml(chamber?.chamberName || "Private Practice");
  const chSlogan = escapeHtml(chamber?.chamberSlogan);
  const chAddress = escapeHtml(
    chamber?.chamberAddress || "Online Consultation",
  );
  const chEmail = escapeHtml(chamber?.chamberEmail);
  const chPhones = escapeHtml(phones);

  const patName = escapeHtml(patient.name);
  const patAge = escapeHtml(patient.age);
  const patGender = escapeHtml(patient.gender);
  const patIdentifier = escapeHtml(patient.patientIdentifier);
  const escSerial = escapeHtml(serialNumber);
  const patWeight = weight ? escapeHtml(weight) : "";
  const patAllergies = escapeHtml(patient.allergies);
  const patChronic = escapeHtml(patient.chronicDiseases);

  const escComplaints = escapeHtmlMultiline(complaints);
  const escDiagnosis = escapeHtmlMultiline(diagnosis);
  const escAdvises = escapeHtmlMultiline(advises);
  const escBp = escapeHtml(bloodPressure);
  const escPulse = escapeHtml(pulse);
  const escTemp = escapeHtml(temperature);
  const escHeight = escapeHtml(height);

  // Compile Medicines HTML safely
  const medicinesHtml = medicines
    .map((med, index) => {
      const medBrandName = escapeHtml(med.brandName);
      const medStrength = escapeHtml(med.strength);
      const medType = escapeHtml(med.type);
      const medGeneric = escapeHtml(med.generic);
      const medDosagePattern = escapeHtml(med.dosagePattern);
      const medMealTiming = escapeHtml(med.mealTiming);
      const medDuration = escapeHtml(med.duration);
      const medInstruction = escapeHtml(med.instruction);
      const medNotes = escapeHtml(med.notes);

      const genericText = medGeneric
        ? `<div class="med-generic">(${medGeneric})</div>`
        : "";
      const patternText = medDosagePattern
        ? `<span class="med-pattern">${medDosagePattern}</span>`
        : "";
      const mealText = medMealTiming
        ? `<span class="med-meal">${medMealTiming.replace(/_/g, " ")}</span>`
        : "";
      const durationText = `<span class="med-duration">${medDuration}</span>`;
      const instructionText = medInstruction
        ? `<div class="med-instruction">👉 ${medInstruction}</div>`
        : "";
      const notesText = medNotes
        ? `<div class="med-notes">* ${medNotes}</div>`
        : "";

      return `
      <div class="medicine-item">
        <div class="med-header">
          <span class="med-index">${index + 1}.</span>
          <span class="med-name">${medBrandName} ${medStrength}</span>
          <span class="med-type">(${medType})</span>
        </div>
        ${genericText}
        <div class="med-details">
          ${patternText} ${mealText} &mdash; ${durationText}
        </div>
        ${instructionText}
        ${notesText}
      </div>
    `;
    })
    .join("");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Prescription - ${patName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap');
    
    @page {
      size: A4;
      margin: 15mm 15mm 20mm 15mm;
    }

    * {
      box-sizing: border-box;
    }

    body {
      font-family: 'Outfit', sans-serif;
      color: #333333;
      margin: 0;
      padding: 0;
      background-color: #ffffff;
      font-size: 14px;
      line-height: 1.5;
      /* A4 printable height (297mm - 15mm top - 20mm bottom) so a single-page
         prescription anchors its footer to the bottom of the page. */
      display: flex;
      flex-direction: column;
      min-height: 262mm;
    }

    /* Print-specific rules */
    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      /* Never split the header, patient banner or an individual medicine
         across a page boundary (Section 14.3). */
      .header,
      .patient-banner {
        page-break-inside: avoid;
      }
    }

    /* Watermark styling */
    .watermark {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-30deg);
      font-size: 100px;
      color: rgba(15, 131, 116, 0.04);
      font-weight: 700;
      text-transform: uppercase;
      pointer-events: none;
      z-index: 0;
      letter-spacing: 5px;
      white-space: nowrap;
    }

    .container {
      position: relative;
      z-index: 1;
      width: 100%;
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    /* Header double-column */
    .header {
      display: flex;
      justify-content: space-between;
      border-bottom: 3px solid ${colorTheme};
      padding-bottom: 12px;
      margin-bottom: 15px;
    }

    .doctor-info {
      flex: 1;
      padding-right: 15px;
    }

    .doctor-name {
      font-size: 22px;
      font-weight: 700;
      color: ${colorTheme};
      margin: 0 0 4px 0;
    }

    .doctor-qualification {
      font-size: 13px;
      font-weight: 600;
      margin: 0 0 2px 0;
    }

    .doctor-specialty {
      font-size: 12px;
      color: #666666;
      margin: 0 0 6px 0;
    }

    .doctor-reg {
      font-size: 11px;
      background-color: #f0f7f6;
      color: ${colorTheme};
      padding: 2px 6px;
      border-radius: 4px;
      display: inline-block;
      font-weight: 600;
    }

    .chamber-info {
      flex: 1;
      text-align: right;
      padding-left: 15px;
    }

    .chamber-name {
      font-size: 18px;
      font-weight: 700;
      color: #333333;
      margin: 0 0 4px 0;
    }

    .chamber-slogan {
      font-size: 11px;
      font-style: italic;
      color: #666666;
      margin: 0 0 6px 0;
    }

    .chamber-detail {
      font-size: 11px;
      color: #555555;
      margin: 0 0 2px 0;
    }

    /* Patient banner */
    .patient-banner {
      background-color: #f4faf9;
      border-left: 4px solid ${colorTheme};
      border-radius: 4px;
      padding: 10px 15px;
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      margin-bottom: 20px;
      font-size: 13px;
    }

    .patient-field {
      margin-right: 15px;
    }

    .patient-field strong {
      color: #555555;
    }

    /* Core prescription layout: Double column */
    .content-body {
      display: flex;
      min-height: 550px;
    }

    .left-column {
      width: 30%;
      border-right: 1px solid #e0e0e0;
      padding-right: 15px;
    }

    .right-column {
      width: 70%;
      padding-left: 20px;
    }

    .section-title {
      font-size: 13px;
      font-weight: 700;
      color: ${colorTheme};
      text-transform: uppercase;
      border-bottom: 1px solid #f0f7f6;
      padding-bottom: 4px;
      margin: 15px 0 8px 0;
      letter-spacing: 0.5px;
    }

    .section-title:first-child {
      margin-top: 0;
    }

    .notes-content {
      font-size: 12px;
      color: #555555;
      white-space: pre-line;
      margin-bottom: 12px;
    }

    /* Medicine prescription engine styles */
    .rx-symbol {
      font-size: 28px;
      font-weight: 700;
      color: ${colorTheme};
      font-style: italic;
      margin: 0 0 10px 0;
    }

    .medicine-item {
      margin-bottom: 18px;
      page-break-inside: avoid;
    }

    .med-header {
      font-size: 15px;
      font-weight: 600;
      margin-bottom: 2px;
    }

    .med-index {
      color: ${colorTheme};
      margin-right: 4px;
    }

    .med-name {
      color: #111111;
    }

    .med-type {
      font-size: 12px;
      color: #666666;
      font-weight: 400;
    }

    .med-generic {
      font-size: 11px;
      color: #666666;
      font-style: italic;
      margin-bottom: 4px;
    }

    .med-details {
      font-size: 13px;
      color: #333333;
      margin-bottom: 2px;
    }

    .med-pattern {
      background-color: #f0f7f6;
      color: ${colorTheme};
      font-weight: 600;
      padding: 1px 6px;
      border-radius: 4px;
      margin-right: 8px;
    }

    .med-meal {
      font-size: 12px;
      color: #555555;
    }

    .med-duration {
      font-weight: 600;
      color: #111111;
    }

    .med-instruction {
      font-size: 12px;
      color: #2e7d32;
      font-weight: 600;
      margin-top: 2px;
    }

    .med-notes {
      font-size: 11px;
      color: #888888;
      margin-top: 1px;
    }

    /* Footer & signature styling */
    .page-footer {
      border-top: 1px solid #e0e0e0;
      padding-top: 10px;
      /* Push the signature/footer to the bottom of the final page when there is
         leftover whitespace (Section 14.3, Case A). */
      margin-top: auto;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      font-size: 11px;
      color: #888888;
    }

    .chamber-logo {
      max-height: 48px;
      max-width: 150px;
      margin-bottom: 6px;
    }

    .footer-meta {
      max-width: 260px;
      padding: 0 12px;
      text-align: center;
    }

    .footer-disclaimer {
      font-size: 9px;
      color: #999999;
      margin-top: 4px;
      line-height: 1.3;
    }

    .footer-qr {
      display: flex;
      align-items: center;
    }

    .qr-image {
      width: 60px;
      height: 60px;
      margin-right: 8px;
      border: 1px solid #dddddd;
      padding: 2px;
    }

    .qr-text {
      line-height: 1.3;
      max-width: 140px;
    }

    .signature-block {
      text-align: right;
      width: 150px;
    }

    .sig-image {
      max-width: 120px;
      max-height: 50px;
      margin-bottom: 4px;
    }

    .sig-line {
      border-top: 1px solid #999999;
      padding-top: 4px;
      font-weight: 600;
      font-size: 12px;
      color: #333333;
    }
  </style>
</head>
<body>

  <div class="watermark">Presciya</div>

  <div class="container">
    <!-- Double column header -->
    <div class="header">
      <div class="doctor-info">
        <h1 class="doctor-name">Dr. ${docName}</h1>
        <p class="doctor-qualification">${docQualification}</p>
        <p class="doctor-specialty">${docSpecialization}</p>
        ${docRegNo && doctor.bmdcApproved ? `<span class="doctor-reg">BMDC Reg No: ${docRegNo}</span>` : ""}
      </div>
      <div class="chamber-info">
        ${chamberLogo ? `<img class="chamber-logo" src="${chamberLogo}" alt="Chamber Logo">` : ""}
        <h2 class="chamber-name">${chName}</h2>
        ${chSlogan ? `<p class="chamber-slogan">${chSlogan}</p>` : ""}
        <p class="chamber-detail">${chAddress}</p>
        ${chPhones !== "N/A" ? `<p class="chamber-detail">📞 ${chPhones}</p>` : ""}
        ${chEmail ? `<p class="chamber-detail">✉️ ${chEmail}</p>` : ""}
      </div>
    </div>

    <!-- Patient Banner -->
    <div class="patient-banner">
      <span class="patient-field"><strong>Patient:</strong> ${patName}</span>
      <span class="patient-field"><strong>Age:</strong> ${patAge} Yrs</span>
      <span class="patient-field"><strong>Gender:</strong> ${patGender}</span>
      ${patWeight ? `<span class="patient-field"><strong>Weight:</strong> ${patWeight} kg</span>` : ""}
      ${patIdentifier ? `<span class="patient-field"><strong>Patient ID:</strong> ${patIdentifier}</span>` : ""}
      <span class="patient-field"><strong>Date:</strong> ${dateStr}</span>
      ${escSerial ? `<span class="patient-field"><strong>Rx No:</strong> ${escSerial}</span>` : ""}
    </div>

    <!-- Main Content Body -->
    <div class="content-body">
      <!-- Left Column: Clinical Parameters -->
      <div class="left-column">
        ${
          escComplaints
            ? `
          <div class="section-title">Complaints</div>
          <div class="notes-content">${escComplaints}</div>
        `
            : ""
        }
        
        ${
          escDiagnosis
            ? `
          <div class="section-title">Diagnosis</div>
          <div class="notes-content">${escDiagnosis}</div>
        `
            : ""
        }

        <!-- Vitals -->
        ${
          escBp || escPulse || escTemp || escHeight
            ? `
          <div class="section-title">Vitals</div>
          ${escBp ? `<div class="notes-content"><strong>B.P:</strong> ${escBp} mmHg</div>` : ""}
          ${escPulse ? `<div class="notes-content"><strong>Pulse:</strong> ${escPulse} /min</div>` : ""}
          ${escTemp ? `<div class="notes-content"><strong>Temp:</strong> ${escTemp} °F</div>` : ""}
          ${escHeight ? `<div class="notes-content"><strong>Height:</strong> ${escHeight}</div>` : ""}
        `
            : ""
        }

        <!-- History/Allergies -->
        ${
          patAllergies || patChronic
            ? `
          <div class="section-title">Medical History</div>
          ${patChronic ? `<div class="notes-content"><strong>Chronic:</strong> ${patChronic}</div>` : ""}
          ${patAllergies ? `<div class="notes-content" style="color: #c62828;"><strong>Allergies:</strong> ${patAllergies}</div>` : ""}
        `
            : ""
        }

        ${
          escAdvises
            ? `
          <div class="section-title">Advises</div>
          <div class="notes-content">${escAdvises}</div>
        `
            : ""
        }

        <div class="section-title">Next Visit</div>
        <div class="notes-content" style="font-weight: 600; color: ${colorTheme};">${nextVisitStr}</div>
      </div>

      <!-- Right Column: Medicines (Rx) -->
      <div class="right-column">
        <div class="rx-symbol">Rx</div>
        ${medicinesHtml}
      </div>
    </div>

    <!-- Page Footer & Signature -->
    <div class="page-footer">
      <div class="footer-qr">
        <img class="qr-image" src="${qrCodeUrl}" alt="Verification QR Code">
        <div class="qr-text">
          <strong>Authentic Digital Record</strong><br>
          Scan to verify prescription authenticity.
        </div>
      </div>

      <div class="footer-meta">
        <div class="footer-disclaimer">${escapeHtml(disclaimer)}</div>
        <div style="font-size: 9px; color: #aaaaaa; margin-top: 4px;">Generated: ${escapeHtml(generatedAtStr)}</div>
      </div>

      <div class="signature-block">
        ${
          docSignature
            ? `<img class="sig-image" src="${docSignature}" alt="Doctor Signature">`
            : `<div style="height: 50px;"></div>`
        }
        <div class="sig-line">Dr. ${docName}</div>
        <div style="font-size: 9px; color: #666666; margin-top: 2px;">Registered Practitioner</div>
      </div>
    </div>
  </div>

</body>
</html>
  `;
};
