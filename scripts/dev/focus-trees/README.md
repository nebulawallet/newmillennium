# Focus tree generators

The national focus trees in `data/focus_trees/`, their spirits in `data/spirits/` and their decisions in `data/decisions/` are written by these scripts. Edit a script and rerun it rather than editing the JSON by hand.

Run from the repo root, for example:

```bash
python -I -X utf8 scripts/dev/focus-trees/gen_rus.py
```

Then `npm run validate-data -- --only <TAGS>` and `npm run check`.

- `treelib.py`: shared helpers (effects, a `Tree` builder, the political-path and democracy-path helpers, a generic society branch, spirit and decision writers).
- `gen_rus.py` is the model tree; `gen_generic.py` writes the tree every other country uses.
- Every named real policy cites a Wikipedia article fetched with `scripts/research/wiki.ts`; spirits with `start` describe the real situation on 1 January 2000 and need sources.
