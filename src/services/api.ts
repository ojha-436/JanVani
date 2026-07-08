import { appCheckHeaders } from "@/lib/firebase";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface SubmitComplaintInput {
  text: string;
  locale: string;
  category?: string;
  location?: string;
  coords?: { lat: number; lng: number } | null;
  anonymous: boolean;
  audioUrl?: string;
  photoUrl?: string;
}

export async function submitComplaint(input: SubmitComplaintInput, idToken: string) {
  const res = await fetch(`${API_URL}/complaints`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
      ...(await appCheckHeaders()),
    },
    body: JSON.stringify({
      text: input.text,
      locale: input.locale,
      category: input.category || null,
      location: input.location || null,
      lat: input.coords?.lat ?? null,
      lng: input.coords?.lng ?? null,
      anonymous: input.anonymous,
      audio_url: input.audioUrl || null,
      photo_url: input.photoUrl || null,
    }),
  });
  if (!res.ok) throw new Error(`Server responded ${res.status}`);
  return res.json();
}

export async function syncUser(idToken: string) {
  const res = await fetch(`${API_URL}/auth/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_token: idToken }),
  });
  if (!res.ok) throw new Error(`Server responded ${res.status}`);
  return res.json();
}

export interface ProfileOut {
  id: string;
  firebase_uid: string;
  email: string | null;
  phone_number: string | null;
  display_name: string | null;
  provider: string | null;
  created_at: string;
  first_name: string | null;
  last_name: string | null;
  address: string | null;
  constituency: string | null;
  pincode: string | null;
  state: string | null;
  aadhaar_last4: string | null;
  is_onboarded: boolean;
}

export interface ProfileUpdateInput {
  first_name: string;
  last_name?: string;
  address?: string;
  constituency?: string;
  pincode?: string;
  state: string;
  aadhaar?: string | null;
}

export async function getMyProfile(idToken: string): Promise<ProfileOut> {
  const res = await fetch(`${API_URL}/users/me`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) throw new Error(`Server responded ${res.status}`);
  return res.json();
}

export async function updateMyProfile(idToken: string, data: ProfileUpdateInput): Promise<ProfileOut> {
  const res = await fetch(`${API_URL}/users/me`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Server responded ${res.status}`);
  return res.json();
}

export interface CategoryCount {
  category: string;
  count: number;
}

export interface RecentComplaint {
  id: string;
  text: string;
  category: string | null;
  location: string | null;
  anonymous: boolean;
  // Older deployed backends may not send these yet — always guard, never assume present.
  status?: string;
  assigned_department?: string | null;
  created_at: string;
  audio_url?: string | null;
  photo_url?: string | null;
  verification_confidence?: number | null;
  verification_status?: string | null;
  verification_reasons?: string[] | null;
}

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  category: string | null;
  location: string | null;
}

export interface DashboardSummary {
  total_complaints: number;
  distinct_locations: number;
  by_category: CategoryCount[];
  recent: RecentComplaint[];
  // Older deployed backends may not send these yet — always guard, never assume present.
  recent_has_more?: boolean;
  map_points?: MapPoint[];
}

export async function getDashboardSummary(
  idToken: string,
  opts?: { recentLimit?: number; recentOffset?: number }
): Promise<DashboardSummary> {
  const params = new URLSearchParams();
  if (opts?.recentLimit) params.set("recent_limit", String(opts.recentLimit));
  if (opts?.recentOffset) params.set("recent_offset", String(opts.recentOffset));
  const qs = params.toString();
  const res = await fetch(`${API_URL}/dashboard/summary${qs ? `?${qs}` : ""}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) throw new Error(`Server responded ${res.status}`);
  return res.json();
}

export const COMPLAINT_STATUSES = ["new", "in_progress", "resolved", "rejected"] as const;
export type ComplaintStatus = (typeof COMPLAINT_STATUSES)[number];

export const DEPARTMENTS = ["PWD", "Health", "Education", "Water", "Sanitation", "Electricity", "Other"] as const;
export type Department = (typeof DEPARTMENTS)[number];

export async function updateComplaint(
  idToken: string,
  complaintId: string,
  update: { status?: ComplaintStatus; assigned_department?: Department }
): Promise<RecentComplaint> {
  const res = await fetch(`${API_URL}/dashboard/complaints/${complaintId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(update),
  });
  if (!res.ok) throw new Error(`Server responded ${res.status}`);
  return res.json();
}

export interface RankedIssue {
  category: string;
  complaint_count: number;
  population: number | null;
  score: number;
  level: string;
  gov_data_summary: Record<string, number>;
  reasons: string[];
}

export async function getRankedIssues(idToken: string): Promise<RankedIssue[]> {
  const res = await fetch(`${API_URL}/dashboard/ranked-issues`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) throw new Error(`Server responded ${res.status}`);
  return res.json();
}

export interface StatusCount {
  status: string;
  count: number;
}

export interface DepartmentProgress {
  department: string;
  by_status: StatusCount[];
}

export interface ProgressOut {
  by_status: StatusCount[];
  by_status_last_30_days: StatusCount[];
  by_department: DepartmentProgress[];
}

export async function getDashboardProgress(idToken: string): Promise<ProgressOut> {
  const res = await fetch(`${API_URL}/dashboard/progress`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) throw new Error(`Server responded ${res.status}`);
  return res.json();
}

export async function listComplaints(
  idToken: string,
  opts?: { category?: string; status?: string; limit?: number; offset?: number }
): Promise<RecentComplaint[]> {
  const params = new URLSearchParams();
  if (opts?.category) params.set("category", opts.category);
  if (opts?.status) params.set("status", opts.status);
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.offset) params.set("offset", String(opts.offset));
  const qs = params.toString();
  const res = await fetch(`${API_URL}/complaints${qs ? `?${qs}` : ""}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) throw new Error(`Server responded ${res.status}`);
  return res.json();
}

export interface NotificationOut {
  id: string;
  complaint_id: string;
  category: string | null;
  old_status: string;
  new_status: string;
  created_at: string;
}

export async function getMyNotifications(idToken: string): Promise<NotificationOut[]> {
  const res = await fetch(`${API_URL}/users/me/notifications`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) throw new Error(`Server responded ${res.status}`);
  return res.json();
}

export interface EvidenceOut {
  score: number;
  level: string;
  reasons: string[];
  facts: Record<string, unknown>;
  explanation: string | null;
}

export async function getDashboardEvidence(idToken: string): Promise<EvidenceOut> {
  const res = await fetch(`${API_URL}/dashboard/evidence`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) throw new Error(`Server responded ${res.status}`);
  return res.json();
}

export interface ConsensusCluster {
  location_hint: string;
  complaint_count: number;
  categories: string[];
  root_cause: string | null;
  confidence: number;
}

export async function getDashboardConsensus(idToken: string): Promise<ConsensusCluster[]> {
  const res = await fetch(`${API_URL}/dashboard/consensus`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) throw new Error(`Server responded ${res.status}`);
  return res.json();
}

export interface GovDataImportOut {
  id: string;
  source_type: string;
  source_label: string;
  detected_category: string | null;
  confidence: number | null;
  status: string;
  row_count: number;
  issues: string[] | null;
  explanation: string | null;
  created_at: string;
}

export async function uploadGovData(idToken: string, file: File): Promise<GovDataImportOut> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_URL}/gov-data/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}`, ...(await appCheckHeaders()) },
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail || `Server responded ${res.status}`);
  }
  return res.json();
}

export async function importGovDataFromApi(
  idToken: string,
  resourceId: string,
  label?: string
): Promise<GovDataImportOut> {
  const res = await fetch(`${API_URL}/gov-data/import-api`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
      ...(await appCheckHeaders()),
    },
    body: JSON.stringify({ resource_id: resourceId, label: label || null }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail || `Server responded ${res.status}`);
  }
  return res.json();
}

export async function listGovDataImports(idToken: string): Promise<GovDataImportOut[]> {
  const res = await fetch(`${API_URL}/gov-data/imports`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) throw new Error(`Server responded ${res.status}`);
  return res.json();
}

/* ---------------- Citizen: my complaints, nearby, suggestions, stats ---------------- */

export interface StatusHistoryEntry {
  old_status: string;
  new_status: string;
  changed_at: string;
}

export interface MyComplaintOut {
  id: string;
  text: string;
  category: string | null;
  location: string | null;
  anonymous: boolean;
  status: string;
  assigned_department: string | null;
  created_at: string;
  audio_url: string | null;
  photo_url: string | null;
  verification_confidence: number | null;
  verification_status: string | null;
  verification_reasons: string[] | null;
  status_history: StatusHistoryEntry[];
}

export async function getMyComplaints(
  idToken: string,
  opts?: { limit?: number; offset?: number }
): Promise<MyComplaintOut[]> {
  const params = new URLSearchParams();
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.offset) params.set("offset", String(opts.offset));
  const qs = params.toString();
  const res = await fetch(`${API_URL}/complaints/mine${qs ? `?${qs}` : ""}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) throw new Error(`Server responded ${res.status}`);
  return res.json();
}

export interface NearbyComplaintOut {
  category: string | null;
  status: string;
  lat: number;
  lng: number;
  created_at: string;
}

export async function getNearbyComplaints(
  idToken: string,
  lat: number,
  lng: number,
  opts?: { radiusKm?: number; limit?: number }
): Promise<NearbyComplaintOut[]> {
  const params = new URLSearchParams();
  params.set("lat", String(lat));
  params.set("lng", String(lng));
  if (opts?.radiusKm) params.set("radius_km", String(opts.radiusKm));
  if (opts?.limit) params.set("limit", String(opts.limit));
  const res = await fetch(`${API_URL}/complaints/nearby?${params.toString()}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) throw new Error(`Server responded ${res.status}`);
  return res.json();
}

export interface CategorySuggestion {
  category: string;
  matched_keywords: string[];
}

export interface SuggestCategoryOut {
  suggestions: CategorySuggestion[];
  source: string;
}

export async function suggestCategory(idToken: string, text: string): Promise<SuggestCategoryOut> {
  const res = await fetch(`${API_URL}/complaints/suggest-category`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`Server responded ${res.status}`);
  return res.json();
}

export interface MyStatsOut {
  complaints_total: number;
  resolved_count: number;
  in_progress_count: number;
  first_complaint_at: string | null;
  civic_points: number;
  badge: string;
  next_badge: string | null;
  points_to_next: number | null;
}

export async function getMyStats(idToken: string): Promise<MyStatsOut> {
  const res = await fetch(`${API_URL}/users/me/stats`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) throw new Error(`Server responded ${res.status}`);
  return res.json();
}

/* ---------------- MP dashboard: compare mode + alerts ---------------- */

export interface PeriodStats {
  from_date: string;
  to_date: string;
  total: number;
  resolved: number;
  by_category: CategoryCount[];
}

export interface CompareOut {
  current: PeriodStats;
  previous: PeriodStats;
}

export async function getDashboardCompare(idToken: string, days = 30): Promise<CompareOut> {
  const res = await fetch(`${API_URL}/dashboard/compare?days=${days}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) throw new Error(`Server responded ${res.status}`);
  return res.json();
}

export interface AlertOut {
  id: string;
  category: string | null;
  location: string | null;
  verification_confidence: number | null;
  verification_status: string | null;
  created_at: string;
}

export async function getDashboardAlerts(
  idToken: string,
  opts?: { since?: string; minConfidence?: number }
): Promise<AlertOut[]> {
  const params = new URLSearchParams();
  if (opts?.since) params.set("since", opts.since);
  if (opts?.minConfidence != null) params.set("min_confidence", String(opts.minConfidence));
  const qs = params.toString();
  const res = await fetch(`${API_URL}/dashboard/alerts${qs ? `?${qs}` : ""}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) throw new Error(`Server responded ${res.status}`);
  return res.json();
}
