// The one bit of the character that persists outside gameplay state: the name
// they were given at creation. Anything the paper doll can already speak for —
// class, outfit — belongs to gear and vocation, not here.

const STORAGE_KEY = "solotibia.profile";
const MAX_NAME_LENGTH = 16;

export interface Profile {
  name: string;
}

export function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Profile>;
    const name = sanitizeName(parsed.name ?? "");
    return name ? { name } : null;
  } catch {
    return null;
  }
}

export function saveProfile(profile: Profile): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Private browsing / quota exceeded — the game still runs, the name just
    // won't survive a reload.
  }
}

/** Trim, collapse whitespace, cap length. Empty string means "invalid". */
export function sanitizeName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, MAX_NAME_LENGTH);
}

export { MAX_NAME_LENGTH };
