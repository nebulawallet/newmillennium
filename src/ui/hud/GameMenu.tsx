import { useState } from "preact/hooks";
import { formatDate } from "../../sim/date.ts";
import { deleteSlot, downloadSave, listSaves, loadFromSlot, parseSaveFile, saveToSlot } from "../../sim/save.ts";
import { panel, type Session } from "../session.ts";

/** Save / load menu, shared by the in-game menu and the start screen. */
export function SaveList({ session, allowSave }: { session: Session; allowSave: boolean }) {
  const [saves, setSaves] = useState(listSaves());
  const [msg, setMsg] = useState("");
  const state = session.state;
  const refresh = () => setSaves(listSaves());

  const save = async () => {
    if (!state) return;
    const name = `${state.player ?? "Observer"} ${formatDate(state.day)}`;
    const meta = await saveToSlot(state, `slot-${Date.now()}`, name);
    setMsg(`Saved "${meta.name}" (${Math.round(meta.bytes / 1024)} KB, ${meta.store}).`);
    refresh();
  };
  const load = async (slot: string) => {
    try {
      const file = await loadFromSlot(slot);
      session.start(file.state);
      panel.value = null;
    } catch (e) {
      setMsg(`Could not load: ${(e as Error).message}`);
    }
  };
  const loadFile = async (f: File) => {
    try {
      const file = parseSaveFile(await f.text());
      session.start(file.state);
      panel.value = null;
    } catch (e) {
      setMsg(`Could not load file: ${(e as Error).message}`);
    }
  };

  return (
    <div class="savelist">
      {allowSave && state && (
        <div class="row">
          <button onClick={save}>Save game</button>
          <button onClick={() => downloadSave(state, `${state.player ?? "game"}_${formatDate(state.day)}`)}>Download save</button>
        </div>
      )}
      <label class="filebtn">
        Load from file…
        <input type="file" accept=".json,application/json" onChange={(e) => {
          const f = (e.target as HTMLInputElement).files?.[0];
          if (f) void loadFile(f);
        }} />
      </label>
      {msg && <p class="dim small">{msg}</p>}
      {saves.length > 0 && <h3>Saved games</h3>}
      <ul>
        {saves.map((s) => (
          <li key={s.slot}>
            <button class="link" onClick={() => void load(s.slot)}>{s.name}</button>
            <span class="faint small"> {new Date(s.savedAt).toLocaleString()}</span>
            <button class="close" aria-label={`Delete ${s.name}`} onClick={async () => { await deleteSlot(s.slot); refresh(); }}>×</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function GameMenu({ session }: { session: Session }) {
  return (
    <section class="game-menu panel" aria-label="Game menu">
      <header>
        <h2>Menu</h2>
        <button class="close" onClick={() => (panel.value = null)} aria-label="Close">×</button>
      </header>
      <SaveList session={session} allowSave />
      <div class="row">
        <button onClick={() => session.quitToMenu()}>Quit to main menu</button>
      </div>
    </section>
  );
}
