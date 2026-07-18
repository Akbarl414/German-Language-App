// Loads all repo-authored content (bundled at build time) and merges it with
// on-device user-added content (Path A: in-app manual entry) into one
// unified view. Repo content is read-only; user content lives in storage.js
// and rides along in the same shape so the rest of the app can't tell the
// difference between a seed pack and something typed in after a lesson.

import { store } from './storage.js';

const vocabModules = import.meta.glob('../../content/vocab/packs/*.json', { eager: true });
const grammarModules = import.meta.glob('../../content/grammar/units/*.json', { eager: true });
const phraseModules = import.meta.glob('../../content/phrases/sets/*.json', { eager: true });
const storyModules = import.meta.glob('../../content/stories/*.json', { eager: true });

function unwrap(modules) {
  return Object.values(modules).map((m) => m.default ?? m);
}

const repoVocabPacks = unwrap(vocabModules);
const repoGrammarUnits = unwrap(grammarModules);
const repoPhraseSets = unwrap(phraseModules);
const repoStories = unwrap(storyModules);

const USER_VOCAB_PACK_ID = 'user-added';
const USER_PHRASE_SET_ID = 'user-added';

export function getVocabPacks() {
  const userWords = store.getUserContent().vocab;
  const packs = [...repoVocabPacks];
  if (userWords.length > 0) {
    packs.push({
      id: USER_VOCAB_PACK_ID,
      title: 'My Added Words',
      level: 'mixed',
      topic: 'Added after class',
      words: userWords,
    });
  }
  return packs;
}

export function getGrammarUnits() {
  return repoGrammarUnits;
}

export function getStories() {
  return repoStories;
}

export function findStory(storyId) {
  return repoStories.find((s) => s.id === storyId);
}

export function getPhraseSets() {
  const userPhrases = store.getUserContent().phrases;
  const sets = [...repoPhraseSets];
  if (userPhrases.length > 0) {
    sets.push({
      id: USER_PHRASE_SET_ID,
      title: 'My Added Phrases',
      phrases: userPhrases,
    });
  }
  return sets;
}

export function getAllVocabWords() {
  const out = [];
  for (const pack of getVocabPacks()) {
    for (const word of pack.words) out.push({ ...word, packId: pack.id, packTitle: pack.title });
  }
  return out;
}

export function getAllPhrases() {
  const out = [];
  for (const set of getPhraseSets()) {
    for (const phrase of set.phrases) out.push({ ...phrase, setId: set.id, setTitle: set.title });
  }
  return out;
}

export function getAllGrammarExercises() {
  const out = [];
  for (const unit of getGrammarUnits()) {
    for (const ex of unit.exercises) out.push({ ...ex, unitId: unit.id, unitTitle: unit.title });
  }
  return out;
}

export function findVocabPack(packId) {
  return getVocabPacks().find((p) => p.id === packId);
}

export function findWord(packId, wordId) {
  return findVocabPack(packId)?.words.find((w) => w.id === wordId);
}

export function findGrammarUnit(unitId) {
  return getGrammarUnits().find((u) => u.id === unitId);
}

export function findExercise(unitId, exerciseId) {
  return findGrammarUnit(unitId)?.exercises.find((e) => e.id === exerciseId);
}

export function findPhraseSet(setId) {
  return getPhraseSets().find((s) => s.id === setId);
}

export function findPhrase(setId, phraseId) {
  return findPhraseSet(setId)?.phrases.find((p) => p.id === phraseId);
}
