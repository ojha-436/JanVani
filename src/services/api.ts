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
  created_at: string;
  has_audio: boolean;
  has_photo: boolean;
  verification_confidence: number | null;
  verification_status: string | null;
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
  map_points: MapPoint[];
}

export async function getDashboardSummary(idToken: string): Promise<DashboardSummary> {
  const res = await fetch(`${API_URL}/dashboard/summary`, {
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
