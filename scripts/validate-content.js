#!/usr/bin/env node
// Validates every content JSON file against its schema and checks id uniqueness.
// Run: npm run validate

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import { englishPrompt } from '../src/modules/shared/englishPrompt.js';

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
  {
    label: 'sentence set',
    dir: join(contentRoot, 'sentences'),
    schema: loadSchema('sentence-set.schema.json'),
    itemsKey: 'sentences',
  },
];

// Same edge-punctuation rule as src/modules/grammar/reorderChecker.js (which
// ignores it when matching). Tokens carry none; accepted orders may.
const EDGE_PUNCTUATION = /^[.,!?;:„"'()]+|[.,!?;:„"'()]+$/g;
const strip = (tok) => tok.replace(EDGE_PUNCTUATION, '');
const decapitalize = (tok) => tok.charAt(0).toLowerCase() + tok.slice(1);

/** Same multiset of tokens, ignoring order. */
function sameTokens(a, b) {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((x, i) => x === sb[i]);
}

/** An accepted order uses exactly the tokens (its first word may be capitalised, punctuation allowed). */
function orderUsesTokens(order, tokens) {
  const stripped = order.map(strip);
  const t = tokens.map(strip);
  return sameTokens(stripped, t) || sameTokens([decapitalize(stripped[0]), ...stripped.slice(1)], t);
}

/**
 * Satzbau checks beyond the schema: tokens carry no punctuation, every accepted
 * order uses exactly the scrambled tokens, no order is listed twice, and the
 * tokens are not handed over already solved. Returns a list of problems.
 */
function sentenceProblems(sentence) {
  const problems = [];
  for (const tok of sentence.tokens) {
    if (strip(tok) !== tok) problems.push(`"${sentence.id}": token "${tok}" carries punctuation (put it in answerOrders only)`);
  }
  const seen = new Set();
  for (const order of sentence.answerOrders) {
    if (!orderUsesTokens(order, sentence.tokens)) {
      problems.push(`"${sentence.id}": accepted order "${order.join(' ')}" does not use exactly the tokens`);
    }
    const key = order.map((x) => strip(x).toLowerCase()).join('\u0001');
    if (seen.has(key)) problems.push(`"${sentence.id}": accepted order "${order.join(' ')}" is listed twice`);
    seen.add(key);
  }
  if (seen.has(sentence.tokens.map((x) => x.toLowerCase()).join('\u0001'))) {
    problems.push(`"${sentence.id}": tokens are already in an accepted order (not scrambled)`);
  }
  return problems;
}
const sentenceTopicCounts = new Map();
let sentenceCount = 0;

let errorCount = 0;
let fileCount = 0;
const globalIdsByLabel = new Map();
// Core 1000: optional `rank` on vocab words, unique across all packs (see content/core/).
const CORE_SIZE = 1000;
const coreRanks = new Map(); // rank -> "pack::word"
let promptEnCount = 0;

/**
 * English prompts (prompt_en, or meaning_en when there is none) are shown where
 * German is the answer, so they must not contain the word's own lemma inside
 * brackets. Matching is case-insensitive: as a whole word, or for lemmas of 4+
 * letters also as the start of a word (catches inflected forms like
 * "Sachen", "Polizistin"). Returns the offending bracket text, or null.
 */
function lemmaInPromptBrackets(word) {
  const lemma = word.lemma.replace(/\s*\([^)]*\)\s*/g, ' ').trim().toLowerCase();
  if (!lemma) return null;
  const esc = lemma.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = lemma.length >= 4
    ? new RegExp(`(^|[^\\p{L}])${esc}`, 'u')
    : new RegExp(`(^|[^\\p{L}])${esc}($|[^\\p{L}])`, 'u');
  for (const m of englishPrompt(word).matchAll(/\(([^)]*)\)|\[([^\]]*)\]/g)) {
    const inside = m[1] ?? m[2];
    if (re.test(inside.toLowerCase())) return m[0];
  }
  return null;
}

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

    let rankErrors = 0;
    if (target.label === 'vocab pack') {
      for (const item of items) {
        if (item.rank === undefined) continue;
        const where = `${data.id}::${item.id}`;
        if (!Number.isInteger(item.rank) || item.rank < 1 || item.rank > CORE_SIZE) {
          console.error(`FAIL  ${file}\n      rank ${item.rank} on "${where}" is outside 1-${CORE_SIZE}`);
          rankErrors++;
        } else if (coreRanks.has(item.rank)) {
          console.error(`FAIL  ${file}\n      duplicate rank ${item.rank}: "${where}" and "${coreRanks.get(item.rank)}"`);
          rankErrors++;
        } else {
          coreRanks.set(item.rank, where);
        }
      }
      for (const item of items) {
        if (item.prompt_en !== undefined) promptEnCount++;
        const hit = lemmaInPromptBrackets(item);
        if (hit) {
          console.error(`FAIL  ${file}\n      English prompt of "${data.id}::${item.id}" contains its lemma "${item.lemma}" in brackets: ${hit} (add or fix prompt_en)`);
          rankErrors++;
        }
      }
    }
    if (target.label === 'sentence set') {
      for (const item of items) {
        sentenceCount++;
        sentenceTopicCounts.set(item.topic, (sentenceTopicCounts.get(item.topic) || 0) + 1);
        for (const problem of sentenceProblems(item)) {
          console.error(`FAIL  ${file}\n      ${problem}`);
          rankErrors++;
        }
      }
    }
    if (rankErrors > 0) {
      errorCount += rankErrors;
      continue;
    }

    console.log(`ok    ${file}  (${items.length} ${target.itemsKey})`);
  }
}

console.log(`\nCore 1000: ${coreRanks.size} / ${CORE_SIZE} ranks present.`);
console.log(`prompt_en: ${promptEnCount} words carry a clean English prompt.`);
console.log(
  `Satzbau: ${sentenceCount} sentences (${[...sentenceTopicCounts].map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}).`
);
console.log(`Checked ${fileCount} file(s).`);
if (errorCount > 0) {
  console.error(`${errorCount} error(s) found.`);
  process.exit(1);
} else {
  console.log('All content valid.');
}
