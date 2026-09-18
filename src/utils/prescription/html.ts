// Shared HTML escaping helpers for prescription templates. Every template
// interpolates already-escaped values so a single escaping policy is enforced
// in one place (Section 14.5).

export const escapeHtml = (unsafe?: string | number | null): string => {
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

export const escapeHtmlMultiline = (unsafe?: string | null): string => {
  if (!unsafe) return "";
  return escapeHtml(unsafe).replace(/\n/g, "<br>");
};

// Only allow absolute http(s) URLs into rendered attributes. Prevents
// javascript:/data: injection and unexpected resource loads (Section 14.5).
export const safeUrl = (url?: string | null): string => {
  if (!url) return "";
  const trimmed = String(url).trim();
  if (!/^https?:\/\//i.test(trimmed)) return "";
  return trimmed.replace(/"/g, "%22").replace(/'/g, "%27");
};

// Doctor names are frequently stored with the honorific already ("Dr. Osman").
// Never render a doubled "Dr. Dr." prefix.
export const formatDoctorName = (name?: string | null): string => {
  const raw = (name || "").trim();
  if (!raw) return "";
  return /^dr\.?\s/i.test(raw) ? raw : `Dr. ${raw}`;
};
