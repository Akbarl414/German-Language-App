// The English prompt for a vocab word, used only where English is the prompt
// and German is the answer (meaning_en_de card fronts, incl. Core 1000 stage
// two; Type it; Wordfall English to German). prompt_en is a clean English
// prompt with no German in it; meaning_en (which may carry German usage notes)
// stays the text for backs, answer options and German-first places.
// Dependency-free so node tests and scripts/validate-content.js can import it.

export function englishPrompt(word) {
  const p = word?.prompt_en;
  if (typeof p === 'string' && p.trim() !== '') return p.trim();
  return word?.meaning_en ?? '';
}
