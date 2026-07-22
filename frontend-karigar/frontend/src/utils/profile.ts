import { COLORS } from "@/src/theme";

export interface ProfileVersion {
  full_name: string;
  dob?: string;
  gender: string;
  languages: string[];
  area: string;
  city: string;
  skills: string[];
  years_experience: number;
  current_employer?: string | null;
  previous_employer?: string | null;
  wage_expectation?: number | null;
  upi_id?: string | null;
  portfolio_images?: string[];
  aadhar_images?: string[];
  employment_proof_type?: string | null;
  employment_proof_images?: string[];
  availability_status?: string;
  available_from?: string | null;
  verification_status?: string;
  snapshot_at?: string;
  archived_at?: string;
  edited_by?: string;
}

export interface Worker {
  id: string;
  worker_id?: string;
  phone: string;
  full_name: string;
  dob?: string;
  gender: string;
  languages: string[];
  area: string;
  city: string;
  location_lat?: number | null;
  location_lng?: number | null;
  skills: string[];
  years_experience: number;
  current_employer?: string | null;
  previous_employer?: string | null;
  wage_expectation?: number | null;
  upi_id?: string | null;
  portfolio_images: string[];
  aadhar_images?: string[];
  employment_proof_type?: string | null;
  employment_proof_images?: string[];
  referral_code: string;
  referred_by_code?: string | null;
  availability_status: "available_now" | "available_from" | "not_available";
  available_from?: string | null;
  verification_status: "pending" | "approved" | "rejected";
  rejection_reason?: string | null;
  referred_by?: { name: string; phone: string } | null;
  duplicate_flags?: string[];
  history?: ProfileVersion[];
  created_at: string;
}

const COMPLETION_FIELDS: (keyof Worker)[] = [
  "full_name",
  "gender",
  "languages",
  "area",
  "city",
  "skills",
  "years_experience",
  "current_employer",
  "wage_expectation",
  "portfolio_images",
  "upi_id",
];

export function profileCompletion(w: Worker): number {
  let filled = 0;
  for (const f of COMPLETION_FIELDS) {
    const v = w[f];
    if (Array.isArray(v)) {
      if (v.length > 0) filled++;
    } else if (typeof v === "number") {
      if (v > 0) filled++;
    } else if (v) {
      filled++;
    }
  }
  return Math.round((filled / COMPLETION_FIELDS.length) * 100);
}

export function availabilityColor(status: string): string {
  return status === "available_now"
    ? COLORS.success
    : status === "available_from"
    ? COLORS.warning
    : COLORS.error;
}

export function formatDate(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function verificationColor(status: string): string {
  return status === "approved" ? COLORS.success : status === "pending" ? COLORS.warning : COLORS.error;
}

export function calcAge(dob: string): number {
  const d = new Date(dob);
  if (isNaN(d.getTime())) return 0;
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
}

export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
