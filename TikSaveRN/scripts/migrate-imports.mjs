/**
 * Rewrite parent-relative imports to @/ alias (see docs/STYLE_GUIDE.md).
 */
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';

const root = join(fileURLToPath(new URL('..', import.meta.url)));
const srcDir = join(root, 'src');

const rules = [
  [/from '\.\.\/\.\.\/types'/g, "from '@/types'"],
  [/from "\.\.\/\.\.\/types"/g, 'from "@/types"'],
  [/from '\.\.\/\.\.\/config'/g, "from '@/config'"],
  [/from '\.\.\/\.\.\/components'/g, "from '@/components'"],
  [/from '\.\.\/\.\.\/utils\//g, "from '@/utils/"],
  [/from '\.\.\/\.\.\/hooks\//g, "from '@/hooks/"],
  [/from '\.\.\/\.\.\/stores\//g, "from '@/stores/"],
  [/from '\.\.\/\.\.\/services\//g, "from '@/services/"],
  [/from '\.\.\/config'/g, "from '@/config'"],
  [/from "\.\.\/config"/g, 'from "@/config"'],
  [/from '\.\.\/types'/g, "from '@/types'"],
  [/from "\.\.\/types"/g, 'from "@/types"'],
  [/from '\.\.\/components'/g, "from '@/components'"],
  [/from '\.\.\/navigation\/types'/g, "from '@/navigation/types'"],
  [/from '\.\.\/navigation\//g, "from '@/navigation/"],
  [/from '\.\.\/stores\//g, "from '@/stores/"],
  [/from '\.\.\/hooks\//g, "from '@/hooks/"],
  [/from '\.\.\/services\//g, "from '@/services/"],
  [/from '\.\.\/utils\//g, "from '@/utils/"],
  [/from '\.\.\/screens'/g, "from '@/screens'"],
  [/from '\.\.\/screens\//g, "from '@/screens/"],
];

function walk(dir, files = []) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) walk(p, files);
    else if (/\.(ts|tsx)$/.test(ent.name)) files.push(p);
  }
  return files;
}

let changed = 0;
for (const file of walk(srcDir)) {
  let text = readFileSync(file, 'utf8');
  const before = text;
  for (const [pattern, replacement] of rules) {
    text = text.replace(pattern, replacement);
  }
  if (text !== before) {
    writeFileSync(file, text);
    changed++;
    console.log(relative(root, file));
  }
}
console.log(`Updated ${changed} files.`);
