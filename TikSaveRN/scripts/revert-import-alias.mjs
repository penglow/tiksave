/**
 * Revert @/ imports back to relative paths (stable with Metro/Expo entry points).
 */
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';

const root = join(fileURLToPath(new URL('..', import.meta.url)));
const srcDir = join(root, 'src');

function walk(dir, files = []) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) walk(p, files);
    else if (/\.(ts|tsx)$/.test(ent.name)) files.push(p);
  }
  return files;
}

function rulesForFile(file) {
  const rel = relative(srcDir, file).replace(/\\/g, '/');
  const depthPrefix = '../'.repeat(Math.max(1, rel.split('/').length - 1));

  return [
    [/from '@\/config'/g, `from '${depthPrefix}config'`],
    [/from "@\/config"/g, `from "${depthPrefix}config"`],
    [/from '@\/types'/g, `from '${depthPrefix}types'`],
    [/from "@\/types"/g, `from "${depthPrefix}types"`],
    [/from '@\/components'/g, `from '${depthPrefix}components'`],
    [/from '@\/navigation\/types'/g, `from '${depthPrefix}navigation/types'`],
    [/from '@\/navigation\//g, `from '${depthPrefix}navigation/`],
    [/from '@\/stores\//g, `from '${depthPrefix}stores/`],
    [/from '@\/hooks\//g, `from '${depthPrefix}hooks/`],
    [/from '@\/services\//g, `from '${depthPrefix}services/`],
    [/from '@\/utils\//g, `from '${depthPrefix}utils/`],
    [/from '@\/screens'/g, `from '${depthPrefix}screens'`],
    [/from '@\/screens\//g, `from '${depthPrefix}screens/`],
  ];
}

let changed = 0;
for (const file of walk(srcDir)) {
  let text = readFileSync(file, 'utf8');
  const before = text;
  for (const [pattern, replacement] of rulesForFile(file)) {
    text = text.replace(pattern, replacement);
  }
  if (text !== before) {
    writeFileSync(file, text);
    changed++;
    console.log(relative(root, file));
  }
}

console.log(`Reverted ${changed} files.`);
