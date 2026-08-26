// The account's characters, remembered across sessions. The single global
// storage key holds the whole list plus a pointer at the one currently in
// play, so switching between characters is a pointer move and no character's
// data can leak into another's.
//
// Only what the character-select screen shows and what the world needs to
// hydrate a returning character lives here: name, vocation, level and exp.
// Inventory, equipment, position and per-skill progress are deliberately
// not persisted yet — spelled out in docs/GAME_DESIGN.md's known gaps and
// in the character-select screen's own text so a returning player is not
// surprised.

import type { Vocation } from "./stats";

const STORAGE_KEY = "solotibia.characters";
const LEGACY_KEY = "solotibia.profile"; // pre-multi-character; a single {name}
const MAX_NAME_LENGTH = 16;
const MAX_CHARACTERS = 6;

export interface CharacterSave {
  id: string;
  name: string;
  createdAt: number;
  vocation: Vocation;
  level: number;
  exp: number;
}

interface Store {
  activeId: string | null;
  characters: CharacterSave[];
}

const EMPTY_STORE: Store = { activeId: null, characters: [] };

function readStore(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Store>;
      return normalize(parsed);
    }
    // Migrate the earlier single-character format.
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy) as { name?: string };
      const name = sanitizeName(parsed.name ?? "");
      if (name) {
        const character = freshCharacter(name);
        const store: Store = { activeId: character.id, characters: [character] };
        writeStore(store);
        localStorage.removeItem(LEGACY_KEY);
        return store;
      }
    }
  } catch {
    // Malformed storage should not brick the login screen — fall through to
    // an empty store; the user re-creates their character.
  }
  return { ...EMPTY_STORE };
}

function writeStore(store: Store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Private browsing / quota — the game still runs, just doesn't persist.
  }
}

function normalize(raw: Partial<Store>): Store {
  const characters = Array.isArray(raw.characters) ? raw.characters.filter(isValidCharacter) : [];
  const activeId = characters.some((c) => c.id === raw.activeId) ? (raw.activeId ?? null) : null;
  return { activeId, characters };
}

function isValidCharacter(value: unknown): value is CharacterSave {
  if (!value || typeof value !== "object") return false;
  const c = value as Partial<CharacterSave>;
  return typeof c.id === "string" && typeof c.name === "string" && c.name.length > 0;
}

function freshCharacter(name: string): CharacterSave {
  return {
    id: newId(),
    name,
    createdAt: Date.now(),
    vocation: "none",
    level: 1,
    exp: 0,
  };
}

function newId(): string {
  // crypto.randomUUID isn't guaranteed on every mobile browser this game targets;
  // a timestamp+random-bits string is unique enough for a per-device save file.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// --- Public API --------------------------------------------------------------

export function listCharacters(): CharacterSave[] {
  return readStore().characters;
}

export function getActiveCharacter(): CharacterSave | null {
  const store = readStore();
  if (!store.activeId) return null;
  return store.characters.find((c) => c.id === store.activeId) ?? null;
}

export function setActiveCharacter(id: string | null): void {
  const store = readStore();
  if (id !== null && !store.characters.some((c) => c.id === id)) return;
  store.activeId = id;
  writeStore(store);
}

export function createCharacter(rawName: string): CharacterSave | null {
  const name = sanitizeName(rawName);
  if (!name) return null;
  const store = readStore();
  if (store.characters.length >= MAX_CHARACTERS) return null;
  const character = freshCharacter(name);
  store.characters.push(character);
  store.activeId = character.id;
  writeStore(store);
  return character;
}

export function updateActiveCharacter(patch: Partial<Omit<CharacterSave, "id" | "createdAt">>): void {
  const store = readStore();
  if (!store.activeId) return;
  const idx = store.characters.findIndex((c) => c.id === store.activeId);
  if (idx < 0) return;
  store.characters[idx] = { ...store.characters[idx], ...patch };
  writeStore(store);
}

export function sanitizeName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, MAX_NAME_LENGTH);
}

export function isNameTaken(name: string): boolean {
  const target = name.toLowerCase();
  return listCharacters().some((c) => c.name.toLowerCase() === target);
}

export { MAX_NAME_LENGTH, MAX_CHARACTERS };
