// Dispatches a resolved SRS queue item ({type, facet, content, ...}) to the
// right interaction: flip-card+4-grade for open recall, multiple-choice
// (reusing the grammar exercise renderer) for auto-gradable facets.

import { renderFlipCard } from './flipCard.js';
import { renderExercise } from '../grammar/exerciseRenderer.js';
import { gradeFromCorrectness, Grade } from '../../srs/engine.js';
import { nounHTML, genderBadgeHTML, escapeHtml } from '../../components/gender.js';
import { findPhraseSet } from '../../db/contentLoader.js';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function exampleBlock(word) {
  if (!word.example_de) return '';
  return `<div class="drill-example">${escapeHtml(word.example_de)}<br>${escapeHtml(word.example_en || '')}</div>`;
}

function renderVocabItem(item, container, onGrade) {
  const w = item.content;
  const headword = w.pos === 'noun' ? `${genderBadgeHTML(w.gender)} <strong>${escapeHtml(w.lemma)}</strong>` : `<strong>${escapeHtml(w.lemma)}</strong>`;

  if (item.facet === 'meaning_de_en') {
    renderFlipCard({
      container,
      frontHTML: headword,
      backHTML: `${escapeHtml(w.meaning_en)}${exampleBlock(w)}`,
      onGrade,
    });
    return;
  }
  if (item.facet === 'meaning_en_de') {
    renderFlipCard({
      container,
      frontHTML: escapeHtml(w.meaning_en),
      backHTML: `${headword}${exampleBlock(w)}`,
      onGrade,
    });
    return;
  }
  if (item.facet === 'gender') {
    const options = shuffle(['der', 'die', 'das']);
    const exercise = {
      type: 'multiple-choice',
      prompt: `What's the gender of "${w.lemma}"?`,
      options,
      answerIndex: options.indexOf(w.gender),
      explanation: `${w.gender} ${w.lemma}, plural: ${w.plural} — ${w.meaning_en}`,
    };
    renderExercise({ exercise, container, onResult: (correct) => onGrade(gradeFromCorrectness(correct)) });
    return;
  }
  if (item.facet === 'plural') {
    renderFlipCard({
      container,
      frontHTML: `${headword} <div class="drill-sub">plural?</div>`,
      backHTML: `die ${escapeHtml(w.plural)}`,
      onGrade,
    });
    return;
  }
  if (item.facet === 'principal_parts') {
    const parts = [
      `<strong>${escapeHtml(w.lemma)}</strong> → <strong>${escapeHtml(w.present_3sg)}</strong>`,
      `Präteritum: ${escapeHtml(w.praeteritum)}`,
      `Perfekt: ${escapeHtml(w.perfekt)}`,
    ];
    if (w.government) parts.push(`Government: ${escapeHtml(w.government)}`);
    renderFlipCard({
      container,
      frontHTML: `${escapeHtml(w.lemma)} <div class="drill-sub">present · Präteritum · Perfekt?</div>`,
      backHTML: parts.join('<br>'),
      onGrade,
    });
    return;
  }
  // 'meaning' facet (verb/adjective/other)
  renderFlipCard({
    container,
    frontHTML: escapeHtml(w.lemma),
    backHTML: `${escapeHtml(w.meaning_en)}${exampleBlock(w)}`,
    onGrade,
  });
}

function renderPhraseItem(item, container, onGrade) {
  const p = item.content;
  if (item.facet === 'phrase_to_meaning') {
    renderFlipCard({
      container,
      frontHTML: `“${escapeHtml(p.phrase)}”`,
      backHTML: `<em>${escapeHtml(p.literal)}</em><br>${escapeHtml(p.meaning)}<br><span class="tag">${p.register}</span>`,
      onGrade,
    });
    return;
  }
  // situation_to_phrase
  const set = findPhraseSet(item.sourceId);
  const distractors = shuffle((set?.phrases || []).filter((ph) => ph.id !== p.id)).slice(0, 3);
  const options = shuffle([p.phrase, ...distractors.map((d) => d.phrase)]);
  const exercise = {
    type: 'multiple-choice',
    prompt: p.situation,
    options,
    answerIndex: options.indexOf(p.phrase),
    explanation: `${p.phrase} — ${p.meaning}`,
  };
  renderExercise({ exercise, container, onResult: (correct) => onGrade(gradeFromCorrectness(correct)) });
}

export function renderQueueItem(item, container, onGrade) {
  if (item.type === 'vocab') return renderVocabItem(item, container, onGrade);
  if (item.type === 'phrase') return renderPhraseItem(item, container, onGrade);
  if (item.type === 'grammar') {
    return renderExercise({ exercise: item.content, container, onResult: (correct) => onGrade(gradeFromCorrectness(correct)) });
  }
}

export { Grade };
