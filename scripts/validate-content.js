#!/usr/bin/env node
// Validates every content JSON file against its schema and checks id uniqueness.
// Run: npm run validate

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const contentRoot = join(root, 'content');
const schemasDir = join(contentRoot, 'schemas');

const ajv = new Ajv({ allErrors: true, strict: false });

function loadSchema(name) {
  return JSON.parse(readFileSync(join(schemasDir, name), 'utf-8'));
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function listJsonFiles(dir) {
  try {
    return readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => join(dir, f));
  } catch {
    return [];
  }
}

const targets = [
  {
    label: 'vocab pack',
    dir: join(contentRoot, 'vocab', 'packs'),
    schema: loadSchema('vocab-pack.schema.json'),
    itemsKey: 'words',
  },
  {
    label: 'grammar unit',
    dir: join(contentRoot, 'grammar', 'units'),
    schema: loadSchema('grammar-unit.schema.json'),
    itemsKey: 'exercises',
  },
  {
    label: 'phrase set',
    dir: join(contentRoot, 'phrases', 'sets'),
    schema: loadSchema('phrase-set.schema.json'),
    itemsKey: 'phrases',
  },
  {
    label: 'story',
    dir: join(contentRoot, 'stories'),
    schema: loadSchema('story.schema.json'),
    itemsKey: 'segments',
    noItemIds: true,
  },
];

let errorCount = 0;
let fileCount = 0;
const globalIdsByLabel = new Map();

for (const target of targets) {
  const validate = ajv.compile(target.schema);
  const files = listJsonFiles(target.dir);
  const packIds = new Set();

  for (const file of files) {
    fileCount++;
    const base = file.split('/').pop().replace(/\.json$/, '');
    let data;
    try {
      data = readJson(file);
    } catch (e) {
      console.error(`FAIL  ${file}\n      invalid JSON: ${e.message}`);
      errorCount++;
      continue;
    }

    const valid = validate(data);
    if (!valid) {
      console.error(`FAIL  ${file}`);
      for (const err of validate.errors) {
        console.error(`      ${err.instancePath || '(root)'} ${err.message}`);
      }
      errorCount++;
      continue;
    }

    if (data.id !== base) {
      console.error(`FAIL  ${file}\n      id "${data.id}" does not match filename "${base}.json"`);
      errorCount++;
      continue;
    }

    if (packIds.has(data.id)) {
      console.error(`FAIL  ${file}\n      duplicate ${target.label} id "${data.id}"`);
      errorCount++;
      continue;
    }
    packIds.add(data.id);

    const items = data[target.itemsKey] || [];

    if (!target.noItemIds) {
      const itemIds = new Set();
      let dupItem = null;
      for (const item of items) {
        if (itemIds.has(item.id)) {
          dupItem = item.id;
          break;
        }
        itemIds.add(item.id);
      }
      if (dupItem) {
        console.error(`FAIL  ${file}\n      duplicate ${target.itemsKey} id "${dupItem}" within pack`);
        errorCount++;
        continue;
      }

      if (!globalIdsByLabel.has(target.label)) globalIdsByLabel.set(target.label, new Set());
      const globalSet = globalIdsByLabel.get(target.label);
      for (const item of items) {
        const globalId = `${data.id}::${item.id}`;
        if (globalSet.has(globalId)) {
          console.error(`FAIL  ${file}\n      global duplicate id "${globalId}"`);
          errorCount++;
        }
        globalSet.add(globalId);
      }
    }

    console.log(`ok    ${file}  (${items.length} ${target.itemsKey})`);
  }
}

console.log(`\nChecked ${fileCount} file(s).`);
if (errorCount > 0) {
  console.error(`${errorCount} error(s) found.`);
  process.exit(1);
} else {
  console.log('All content valid.');
}
