# Formatting Helpers Guide

Helpers for generating readable `.md` output files from exploration scripts.

## Key Rule

**Long semi-structured lines without blank line separators render poorly in markdown.**
Whitespace collapses and adjacent lines merge into a single paragraph.

Solutions (pick the best fit):

- **Code blocks** — preserve all whitespace, good for dense aligned data
- **Bulleted lists** — no blank lines needed between items, good for labeled entries
- **Tables** — great when data has consistent columns and rows fit in ~100-150 chars

---

## Available Helpers

### `@/utils/md.ts` — Markdown primitives

```ts
import { codeBlock, bulletList, heading, kv, hr, sections } from '@/utils/md';
```

| Helper                         | Output                                         |
| ------------------------------ | ---------------------------------------------- |
| `heading('Title', 2)`         | `## Title\n`                                   |
| `codeBlock(lines, 'ts')`      | Fenced code block with language tag             |
| `bulletList(items)`            | `- item1\n- item2\n...`                        |
| `bulletList(items, 1)`         | Indented (nested) bullets                       |
| `kv('key', 'val')`            | `**key:** val`                                  |
| `hr()`                         | `\n---\n`                                       |
| `sections(a, b, c)`           | Joins non-empty strings with blank lines        |

### `@/utils/json.ts` — JSON output

```ts
import { writeJson } from '@/utils/json';
```

| Helper                    | Output                                                    |
| ------------------------- | --------------------------------------------------------- |
| `writeJson(path, data)`  | Write compact JSON via `fjson` (falls back to std JSON)   |

Uses [fractured JSON](https://github.com/j-brooke/FracturedJson) for natural, compact formatting — arrays of small values stay on one line instead of expanding to one-per-line. Requires `fjson` CLI.

### `@/utils/format.ts` — Tables and alignment

```ts
import { formatTable, alignColumns, num, fmtObj } from '@/utils/format';
```

| Helper                          | Output                                          |
| ------------------------------- | ------------------------------------------------|
| `formatTable(headers, rows)`   | Whitespace-aligned markdown table                |
| `alignColumns(rows, sep)`      | Plain-text column alignment (no table borders)   |
| `num(n, width)`                | Right-padded number string                       |
| `fmtObj(obj)`                  | `{ key1: val1, key2: val2 }`                    |

---

## Patterns

### Dense data with alignment — use `codeBlock`

```ts
const lines = items.map(i => `  N=${num(i.n, 2)}  states=${i.states}`);
output += codeBlock(lines);
```

### Labeled entries — use `bulletList`

```ts
const items = groups.map(g =>
  `frontier=${g.frontier}  tick=${g.tick}  (${g.count} chains)`
);
output += bulletList(items);
```

### Structured multi-column data — use `formatTable`

```ts
const rows = groups.map(g => [String(g.frontier), String(g.tick), String(g.count)]);
output += formatTable(['frontier', 'tick', 'chains'], rows);
```

### Assembling a full document

```ts
output = sections(
  heading('Title'),
  bulletList([kv('Total', 100), kv('Groups', 5)]),
  hr(),
  heading('Details', 3),
  formatTable(headers, rows),
);
```
