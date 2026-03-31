// Markdown formatting helpers for exploration output files.
// See FORMAT-GUIDE.md for usage patterns.

// Fenced code block. Preserves whitespace and prevents line collapsing.
function codeBlock(lines: string[], lang: string = ''): string {
  return ['```' + lang, ...lines, '```'].join('\n');
}

// Bulleted list. Items render as separate lines without needing blank lines between.
function bulletList(items: string[], indent: number = 0): string {
  const prefix = '  '.repeat(indent) + '- ';
  return items.map((item) => prefix + item).join('\n');
}

// Markdown heading with a trailing blank line.
function heading(text: string, level: number = 2): string {
  return '#'.repeat(level) + ' ' + text + '\n';
}

// Key-value line with bold key: `**key:** value`
function kv(key: string, value: string | number): string {
  return `**${key}:** ${value}`;
}

// Horizontal rule with surrounding blank lines.
function hr(): string {
  return '\n---\n';
}

// Join sections with blank lines between them.
// Filters out empty strings so you can conditionally include sections.
function sections(...parts: string[]): string {
  return parts.filter((p) => p.length > 0).join('\n\n');
}

export { codeBlock, bulletList, heading, kv, hr, sections };
