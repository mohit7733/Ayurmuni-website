import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Regression: CategoryDoctor rendered <OurDoctorCard> without importing it, so the concern
// page crashed into the error boundary as soon as suggested doctors loaded. ESLint here has
// no react/jsx-no-undef, so guard it: every capitalised JSX tag must be bound in its file.
const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : path.endsWith('.jsx') ? [path] : [];
  });

const isBound = (src, name) =>
  new RegExp(
    [
      `import\\s+${name}\\b`,
      `import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}`,
      `import\\s+\\w+\\s*,\\s*\\{[^}]*\\b${name}\\b`,
      `(?:function|class|const|let|var)\\s+${name}\\b`,
      `[{,(]\\s*(?:\\w+\\s*:\\s*)?${name}\\s*(?:=[^,}]*)?[,})]`,
      `:\\s*${name}\\b`,
    ].join('|'),
  ).test(src);

describe('JSX components are defined', () => {
  for (const file of walk('src')) {
    it(file, () => {
      const src = readFileSync(file, 'utf8');
      const tags = new Set([...src.matchAll(/<([A-Z][A-Za-z0-9]*)[\s/>]/g)].map((m) => m[1]));
      const missing = [...tags].filter((name) => !isBound(src, name));
      expect(missing).toEqual([]);
    });
  }
});