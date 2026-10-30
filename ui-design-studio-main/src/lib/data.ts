export type Provenance =
  "INSTITUTION_REPORTED" | "OFFICIAL_REVIEWED" | "BANK_CONFIRMED" | "DEMO_SIMULATED";
export type SubmissionStatus =
  "DRAFT" | "SUBMITTED" | "UNDER_SCRUTINY" | "RETURNED" | "ACCEPTED" | "REJECTED";

export interface NextAction {
  action: string;
  owner: string;
  due: string;
  reason: string;
  evidence: string;
}

export interface Instrument {
  id: string;
  fdrNo: string;
  institution: string;
  institutionId: string;
  region: string;
  bank: string;
  branch: string;
  amount: number;
  issueDate: string;
  maturityDate: string;
  holdEndDate: string | null;
  status: SubmissionStatus;
  provenance: Provenance;
  discrepancy?: string;
  officer: string;
  next: NextAction;
  timeline: { at: string; actor: string; event: string }[];
}

export const instruments: Instrument[] = [
  {
    id: "fdr-1001",
    fdrNo: "SBI/FD/2023/004417",
    institution: "Shri Ram Institute of Technology",
    institutionId: "1-4417820",
    region: "Northern",
    bank: "State Bank of India",
    branch: "Connaught Place, New Delhi",
    amount: 3500000,
    issueDate: "2023-11-20",
    maturityDate: "2026-11-20",
    holdEndDate: "2033-11-20",
    status: "ACCEPTED",
    provenance: "OFFICIAL_REVIEWED",
    officer: "A. Mehta",
    next: {
      action: "Submit renewal FDR",
      owner: "Institution admin",
      due: "2026-11-20",
      reason: "Bank maturity in 21 days; regulatory hold continues to 2033",
      evidence: "FDR scan v2 · reviewed 12 Jan 2026",
    },
    timeline: [
      {
        at: "2023-12-02 10:14",
        actor: "Institution admin",
        event: "Submitted FDR with scanned copy (SHA-256 recorded)",
      },
      { at: "2023-12-09 16:40", actor: "A. Mehta", event: "Moved to UNDER_SCRUTINY" },
      {
        at: "2024-01-12 11:02",
        actor: "A. Mehta",
        event: "Accepted · provenance OFFICIAL_REVIEWED",
      },
      { at: "2026-10-01 00:00", actor: "Alert engine", event: "Maturity reminder T-50 sent" },
    ],
  },
  {
    id: "fdr-1002",
    fdrNo: "SBI/FD/2023/004417",
    institution: "Vidya Bharati College of Engineering",
    institutionId: "1-5521093",
    region: "Western",
    bank: "State Bank of India",
    branch: "Connaught Place, New Delhi",
    amount: 3500000,
    issueDate: "2024-02-03",
    maturityDate: "2027-02-03",
    holdEndDate: "2034-02-03",
    status: "UNDER_SCRUTINY",
    provenance: "INSTITUTION_REPORTED",
    discrepancy: "Normalized FDR number + issuer matches fdr-1001 (another institution)",
    officer: "R. Iyer",
    next: {
      action: "Resolve duplicate-reference discrepancy",
      owner: "R. Iyer (Case officer)",
      due: "2026-11-04",
      reason: "DUP_REFERENCE · SLA 5 working days",
      evidence: "Uploaded scan v1 · unverified",
    },
    timeline: [
      { at: "2026-10-24 09:12", actor: "Institution admin", event: "Submitted FDR" },
      {
        at: "2026-10-24 09:12",
        actor: "Rule engine",
        event: "Flagged DUP_REFERENCE against fdr-1001",
      },
      { at: "2026-10-25 14:30", actor: "R. Iyer", event: "Moved to UNDER_SCRUTINY" },
    ],
  },
  {
    id: "fdr-1003",
    fdrNo: "PNB/TD/2019/77812",
    institution: "Kaveri Institute of Management",
    institutionId: "1-3398214",
    region: "Southern",
    bank: "Punjab National Bank",
    branch: "MG Road, Bengaluru",
    amount: 1500000,
    issueDate: "2019-07-15",
    maturityDate: "2026-07-15",
    holdEndDate: null,
    status: "ACCEPTED",
    provenance: "DEMO_SIMULATED",
    officer: "S. Nair",
    next: {
      action: "Confirm regulatory hold term",
      owner: "S. Nair (Case officer)",
      due: "2026-11-08",
      reason: "Instrument matured; maturity ≠ release eligibility",
      evidence: "Simulated bank confirmation · 16 Jul 2026",
    },
    timeline: [
      { at: "2019-08-01 12:00", actor: "Institution admin", event: "Submitted FDR" },
      { at: "2019-08-20 15:00", actor: "S. Nair", event: "Accepted" },
      {
        at: "2026-07-16 08:00",
        actor: "Bank adapter (SIMULATED)",
        event: "Matured · auto-renewal not found",
      },
    ],
  },
  {
    id: "fdr-1004",
    fdrNo: "HDFC/FD/2026/120934",
    institution: "Shri Ram Institute of Technology",
    institutionId: "1-4417820",
    region: "Northern",
    bank: "HDFC Bank",
    branch: "Karol Bagh, New Delhi",
    amount: 3500000,
    issueDate: "2026-10-22",
    maturityDate: "2029-10-22",
    holdEndDate: "2033-11-20",
    status: "SUBMITTED",
    provenance: "INSTITUTION_REPORTED",
    discrepancy: "Amount on scan (₹35,00,000) matches; issue date on scan reads 21-10-2026",
    officer: "A. Mehta",
    next: {
      action: "Scrutinize replacement instrument",
      owner: "A. Mehta (Case officer)",
      due: "2026-11-02",
      reason: "Replaces fdr-1001 · DATE_MISMATCH",
      evidence: "Scan v1 · OCR suggestion (not verified)",
    },
    timeline: [
      {
        at: "2026-10-23 17:21",
        actor: "Institution admin",
        event: "Submitted as replacement for fdr-1001",
      },
    ],
  },
  {
    id: "fdr-1005",
    fdrNo: "BOB/FD/2022/55310",
    institution: "Ganga Polytechnic",
    institutionId: "1-2287711",
    region: "Central",
    bank: "Bank of Baroda",
    branch: "Hazratganj, Lucknow",
    amount: 1000000,
    issueDate: "2022-03-10",
    maturityDate: "2027-03-10",
    holdEndDate: "2029-03-10",
    status: "RETURNED",
    provenance: "INSTITUTION_REPORTED",
    discrepancy: "Signature page missing from upload",
    officer: "R. Iyer",
    next: {
      action: "Re-upload complete FDR copy",
      owner: "Institution admin",
      due: "2026-11-06",
      reason: "DOC_INCOMPLETE · returned 28 Oct",
      evidence: "Scan v1 (3 of 4 pages)",
    },
    timeline: [
      { at: "2026-10-20 11:00", actor: "Institution admin", event: "Submitted FDR" },
      {
        at: "2026-10-28 13:45",
        actor: "R. Iyer",
        event: "Returned for correction: signature page missing",
      },
    ],
  },
];

export interface Clearance {
  bureau: string;
  status: "CLEARED" | "PENDING" | "OBJECTION" | "SIMULATED";
  note: string;
}

export const releaseCase = {
  id: "REL-2026-0042",
  instrumentId: "fdr-1003",
  institution: "Kaveri Institute of Management",
  amount: 1500000,
  status: "CLEARANCES_PENDING",
  requested: "2026-10-18",
  reason: "Institution closure approved; request discharge of security deposit",
  checklist: [
    { label: "Closure / approval order attached", done: true },
    { label: "Original FDR evidence on file", done: true },
    { label: "Regulatory hold term confirmed", done: false },
    { label: "No pending dues (Finance)", done: true },
    { label: "Bank account details verified", done: false },
  ],
  clearances: [
    { bureau: "Finance Bureau", status: "CLEARED", note: "No outstanding dues · 22 Oct" },
    { bureau: "PGRC (Grievances)", status: "PENDING", note: "Awaiting response · assigned 19 Oct" },
    { bureau: "Vigilance", status: "SIMULATED", note: "Demo response: no objection" },
    { bureau: "Approval Bureau", status: "CLEARED", note: "Closure order verified · 20 Oct" },
  ] as Clearance[],
};

export const alerts = [
  {
    type: "Bank maturity",
    date: "2026-11-20",
    title: "SBI/FD/2023/004417 matures",
    who: "Shri Ram Institute of Technology",
    level: "warning",
  },
  {
    type: "Workflow SLA",
    date: "2026-11-02",
    title: "Replacement scrutiny due",
    who: "A. Mehta",
    level: "info",
  },
  {
    type: "Workflow SLA",
    date: "2026-11-04",
    title: "Duplicate reference to resolve",
    who: "R. Iyer",
    level: "danger",
  },
  {
    type: "Regulatory hold",
    date: "2026-11-08",
    title: "Hold term unknown for matured FDR",
    who: "S. Nair",
    level: "danger",
  },
  {
    type: "Correction",
    date: "2026-11-06",
    title: "Re-upload requested",
    who: "Ganga Polytechnic",
    level: "info",
  },
] as const;

export const inr = (n: number) => "₹" + n.toLocaleString("en-IN");

export const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
