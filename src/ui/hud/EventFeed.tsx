import type { ContentDB } from "../../content/compile.ts";
import { formatDate } from "../../sim/date.ts";
import { feed } from "../session.ts";

/** Recent events (office changes now; elections, laws and events in later phases). */
export function EventFeed({ db }: { db: ContentDB }) {
  const items = feed.value.slice(0, 6);
  if (!items.length) return null;
  const nameOf = (tag: string | null) => (tag ? (db.countries.get(tag)?.country?.name.en ?? tag) : "World");
  return (
    <aside class="feed panel" aria-live="polite">
      {items.map((e, i) => (
        <div class="feed-item" key={`${e.day}-${i}`}>
          <span class="faint mono">{formatDate(e.day)}</span>
          <span class="dim"> {nameOf(e.tag)}:</span> {e.text}
        </div>
      ))}
    </aside>
  );
}
