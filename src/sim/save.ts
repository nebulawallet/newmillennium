/**
 * Save/load. A save is the GameState plus metadata. Saves go to localStorage (gzip + base64) and
 * fall back to IndexedDB when localStorage is full or unavailable; they can also be downloaded
 * and loaded as plain JSON files.
 */
import { gunzipSync, gzipSync, strFromU8, strToU8 } from "fflate";
import { STATE_VERSION, type GameState } from "./state.ts";

export const SAVE_FORMAT = "new-millennium-save";

export interface SaveFile {
  format: typeof SAVE_FORMAT;
  version: number;
  name: string;
  savedAt: string;
  state: GameState;
}

export interface SaveMeta {
  slot: string;
  name: string;
  savedAt: string;
  day: number;
  player: string | null;
  bytes: number;
  store: "localStorage" | "indexedDB";
}

const LS_PREFIX = "nm.save.";
const LS_INDEX = "nm.saves";

export function toSaveFile(state: GameState, name: string): SaveFile {
  return { format: SAVE_FORMAT, version: STATE_VERSION, name, savedAt: new Date().toISOString(), state };
}

export function parseSaveFile(text: string): SaveFile {
  const data = JSON.parse(text) as SaveFile;
  if (data?.format !== SAVE_FORMAT) throw new Error("not a New Millennium save file");
  if (data.version > STATE_VERSION) throw new Error(`save version ${data.version} is newer than this game (${STATE_VERSION})`);
  return data;
}

const encode = (save: SaveFile): string => {
  const gz = gzipSync(strToU8(JSON.stringify(save)), { level: 6 });
  let bin = "";
  for (let i = 0; i < gz.length; i += 0x8000) bin += String.fromCharCode(...gz.subarray(i, i + 0x8000));
  return btoa(bin);
};
const decode = (b64: string): SaveFile => {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return parseSaveFile(strFromU8(gunzipSync(u8)));
};

// ------------------------------------------------------------------ IndexedDB fallback

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("new-millennium", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("saves");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbPut(key: string, value: string): Promise<void> {
  const d = await idb();
  await new Promise<void>((res, rej) => {
    const tx = d.transaction("saves", "readwrite");
    tx.objectStore("saves").put(value, key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}
async function idbGet(key: string): Promise<string | undefined> {
  const d = await idb();
  return new Promise((res, rej) => {
    const req = d.transaction("saves").objectStore("saves").get(key);
    req.onsuccess = () => res(req.result as string | undefined);
    req.onerror = () => rej(req.error);
  });
}
async function idbDelete(key: string): Promise<void> {
  const d = await idb();
  await new Promise<void>((res) => {
    const tx = d.transaction("saves", "readwrite");
    tx.objectStore("saves").delete(key);
    tx.oncomplete = () => res();
  });
}

// ------------------------------------------------------------------ slots

function readIndex(): SaveMeta[] {
  try {
    return JSON.parse(localStorage.getItem(LS_INDEX) ?? "[]") as SaveMeta[];
  } catch {
    return [];
  }
}
function writeIndex(list: SaveMeta[]): void {
  try {
    localStorage.setItem(LS_INDEX, JSON.stringify(list));
  } catch {
    /* index is a convenience; ignore */
  }
}

export function listSaves(): SaveMeta[] {
  return readIndex().sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
}

export async function saveToSlot(state: GameState, slot: string, name: string): Promise<SaveMeta> {
  const save = toSaveFile(state, name);
  const payload = encode(save);
  let store: SaveMeta["store"] = "localStorage";
  try {
    localStorage.setItem(LS_PREFIX + slot, payload);
  } catch {
    store = "indexedDB";
    await idbPut(LS_PREFIX + slot, payload);
  }
  const meta: SaveMeta = { slot, name, savedAt: save.savedAt, day: state.day, player: state.player, bytes: payload.length, store };
  writeIndex([...readIndex().filter((m) => m.slot !== slot), meta]);
  return meta;
}

export async function loadFromSlot(slot: string): Promise<SaveFile> {
  let payload: string | null | undefined = null;
  try {
    payload = localStorage.getItem(LS_PREFIX + slot);
  } catch {
    payload = null;
  }
  payload ??= await idbGet(LS_PREFIX + slot);
  if (!payload) throw new Error(`no save in slot '${slot}'`);
  return decode(payload);
}

export async function deleteSlot(slot: string): Promise<void> {
  try {
    localStorage.removeItem(LS_PREFIX + slot);
  } catch {
    /* ignore */
  }
  await idbDelete(LS_PREFIX + slot).catch(() => undefined);
  writeIndex(readIndex().filter((m) => m.slot !== slot));
}

/** Trigger a JSON download of the save. */
export function downloadSave(state: GameState, name: string): void {
  const blob = new Blob([JSON.stringify(toSaveFile(state, name))], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${name.replace(/[^a-z0-9_-]+/gi, "_")}.nmsave.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
