// Human-readable labels for an SRS queue item ({type, content, facet, ...}),
// used by the dashboard, review session, and Test-me results screen.

import { nounHTML, escapeHtml } from '../../components/gender.js';

export function labelForItem(item) {
  if (item.type === 'vocab') {
    const w = item.content;
    const head = w.pos === 'noun' ? nounHTML(w) : escapeHtml(w.lemma);
    return `${head} — ${escapeHtml(w.meaning_en)}`;
  }
  if (item.type === 'phrase') {
    return escapeHtml(item.content.phrase);
  }
  if (item.type === 'grammar') {
    const prompt = item.content.prompt || '';
    return escapeHtml(prompt.length > 60 ? prompt.slice(0, 57) + '…' : prompt);
  }
  return '';
}

export function moduleLabel(type) {
  return { vocab: 'Vocabulary', phrase: 'Phrases', grammar: 'Grammar' }[type] || type;
}
