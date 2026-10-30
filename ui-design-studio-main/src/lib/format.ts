// Display formatting and deterministic demo-date helpers.

/** Fixed demo clock so maturity and SLA scenarios stay stable for judging. */
export const DEMO_TODAY = "2026-10-30";

export const INR = (value: number): string =>
  "₹" + value.toLocaleString("en-IN", { maximumFractionDigits: 0 });

export const INRshort = (value: number): string => {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)} Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(2)} L`;
  return INR(value);
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Format an ISO date-only string without timezone shifting. */
export const fmtDate = (iso: string | null | undefined): string => {
  if (!iso) return "Not recorded";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${String(d).padStart(2, "0")} ${MONTHS[m - 1]} ${y}`;
};

export const fmtDateTime = (iso: string): string => {
  if (!iso) return "Not recorded";
  const [datePart, timePart] = iso.split(" ");
  const suffix = timePart ? ` · ${timePart}` : "";
  return `${fmtDate(datePart)}${suffix}`;
};

export const fmtMonthYear = (iso: string): string => {
  const [y, m] = iso.slice(0, 7).split("-").map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${y}`;
};

export const toDate = (iso: string): Date => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
};

export const daysBetween = (from: string, to: string): number =>
  Math.round((toDate(to).getTime() - toDate(from).getTime()) / 86_400_000);

/** Positive = future, negative = past, relative to the demo clock. */
export const daysFromToday = (iso: string): number => daysBetween(DEMO_TODAY, iso);

export const relativeDays = (iso: string): string => {
  const n = daysFromToday(iso);
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n > 1) return `in ${n} days`;
  return `${Math.abs(n)} days ago`;
};

export const addDays = (iso: string, days: number): string => {
  const d = toDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export const maturityBucket = (maturity: string): string => {
  const n = daysFromToday(maturity);
  if (n < 0) return "Matured";
  if (n <= 30) return "0–30 days";
  if (n <= 60) return "31–60 days";
  if (n <= 180) return "61–180 days";
  if (n <= 365) return "181–365 days";
  return "> 1 year";
};

export const normalizeReference = (value: string): string =>
  value.toUpperCase().replace(/[^A-Z0-9]/g, "");

export const maskReference = (value: string): string => {
  const normalized = value.replace(/\s/g, "");
  if (normalized.length <= 8) return normalized;
  return `${normalized.slice(0, 4)}…${normalized.slice(-4)}`;
};

export const checksumPreview = (sha: string): string =>
  sha.length > 16 ? `${sha.slice(0, 8)}…${sha.slice(-4)}` : sha;

export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const slaLabel = (
  dueDate: string,
): { label: string; tone: "danger" | "warning" | "muted" } => {
  const n = daysFromToday(dueDate);
  if (n < 0) return { label: `Overdue by ${Math.abs(n)}d`, tone: "danger" };
  if (n === 0) return { label: "Due today", tone: "danger" };
  if (n <= 3) return { label: `Due in ${n}d`, tone: "warning" };
  return { label: `Due ${fmtDate(dueDate)}`, tone: "muted" };
};

export const csvEscape = (value: string | number): string => {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const downloadCsv = (filename: string, rows: (string | number)[][]): void => {
  const body = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export const uid = (prefix: string): string =>
  `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;

export const nowStamp = (): string => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
