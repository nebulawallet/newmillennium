import { useState } from "preact/hooks";
import { formatDate } from "../../sim/date.ts";
import { deleteSlot, downloadSave, listSaves, loadFromSlot, parseSaveFile, saveToSlot } from "../../sim/save.ts";
import { Icon } from "../icons.tsx";
import { panel, type Session } from "../session.ts";

/** Save slots and file import/export, used by the in-game menu and the start screen. */
export function SaveList({ session, allowSave }: { session: Session; allowSave: boolean }) {
  const [saves, setSaves] = useState(listSaves());
  const [msg, setMsg] = useState("");
  const state = session.state;
  const refresh = () => setSaves(listSaves());

  const save = async () => {
    if (!state) return;
    const name = `${state.player ?? "Observer"}, ${formatDate(state.day)}`;
    const meta = await saveToSlot(state, `slot-${Date.now()}`, name);
    setMsg(`Saved “${meta.name}” (${Math.round(meta.bytes / 1024)} KB).`);
    refresh();
  };
  const load = async (slot: string) => {
    try {
      session.start((await loadFromSlot(slot)).state);
      panel.value = null;
    } catch (e) {
      setMsg(`This save could not be loaded: ${(e as Error).message}`);
    }
  };
  const loadFile = async (f: File) => {
    try {
      session.start(parseSaveFile(await f.text()).state);
      panel.value = null;
    } catch (e) {
      setMsg(`That file could not be loaded: ${(e as Error).message}`);
    }
  };

  return (
    <div class="saves">
      {allowSave && state && (
        <div class="row2">
          <button class="btn" onClick={save}>Save game</button>
          <button class="btn" onClick={() => downloadSave(state, `${state.player ?? "game"}_${formatDate(state.day)}`)}>Export file</button>
        </div>
      )}
      <label class="btn filebtn">
        Import save file
        <input type="file" accept=".json,application/json" onChange={(e) => {
          const f = (e.target as HTMLInputElement).files?.[0];
          if (f) void loadFile(f);
        }} />
      </label>
      {msg && <p class="dim small">{msg}</p>}
      {saves.length > 0 ? (
        <ul class="save-list hp-well">
          {saves.map((s) => (
            <li key={s.slot}>
              <button class="lnk" onClick={() => void load(s.slot)}>{s.name}</button>
              <span class="faint small num">{new Date(s.savedAt).toLocaleDateString()}</span>
              <button class="x" aria-label={`Delete ${s.name}`} onClick={async () => { await deleteSlot(s.slot); refresh(); }}>{Icon.close({ size: 12 })}</button>
            </li>
          ))}
        </ul>
      ) : (
        <p class="faint small">No saved games yet.</p>
      )}
    </div>
  );
}

/** Esc menu, centred like HOI4's. */
export function GameMenu({ session }: { session: Session }) {
  return (
    <div class="scrim" onClick={(e) => { if (e.target === e.currentTarget) panel.value = null; }}>
      <section class="game-menu hp" aria-label="Game menu">
        <header class="hp-head">
          <h2 class="hp-title">Game menu</h2>
          <button class="x" onClick={() => (panel.value = null)} aria-label="Close menu">{Icon.close({ size: 14 })}</button>
        </header>
        <div class="gm-body">
          <button class="btn wide primary" onClick={() => (panel.value = null)}>Resume</button>
          <SaveList session={session} allowSave />
          <button class="btn wide" onClick={() => session.quitToMenu()}>Quit to main menu</button>
        </div>
      </section>
    </div>
  );
}
