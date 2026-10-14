/** Effect and condition lists for tooltips (every scripted effect is explained before it is taken). */
import type { ContentDB } from "../../content/compile.ts";
import { describeEffects, describeTrigger } from "../../sim/scripting/engine.ts";

export function EffectList({ db, effects, title = "Effects" }: { db: ContentDB; effects: unknown[]; title?: string }) {
  const lines = describeEffects(db, effects);
  if (!lines.length) return null;
  return (
    <div class="fx">
      <div class="fx-h">{title}</div>
      {lines.map((l, i) => (
        <div key={i} class="fx-l" style={{ paddingLeft: `${(l.length - l.trimStart().length) * 5}px` }}>{l.trim()}</div>
      ))}
    </div>
  );
}

export function ConditionList({ db, trigger, title = "Requires" }: { db: ContentDB; trigger: unknown; title?: string }) {
  if (trigger === undefined) return null;
  const lines = describeTrigger(db, trigger);
  if (!lines.length) return null;
  return (
    <div class="fx">
      <div class="fx-h">{title}</div>
      {lines.map((l, i) => <div key={i} class="fx-l">{l}</div>)}
    </div>
  );
}
