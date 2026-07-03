const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface SubmitComplaintInput {
  text: string;
  locale: string;
  category?: string;
  location?: string;
  coords?: { lat: number; lng: number } | null;
  anonymous: boolean;
}

export async function submitComplaint(input: SubmitComplaintInput) {
  const res = await fetch(`${API_URL}/complaints`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: input.text,
      locale: input.locale,
      category: input.category || null,
      location: input.location || null,
      lat: input.coords?.lat ?? null,
      lng: input.coords?.lng ?? null,
      anonymous: input.anonymous,
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
