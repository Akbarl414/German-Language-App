// Dispatches a resolved SRS queue item ({type, facet, content, ...}) to the
// right interaction: flip-card+4-grade for open recall, multiple-choice
// (reusing the grammar exercise renderer) for auto-gradable facets.
//
// German-first mode: card fronts show only the bare German (or, for
// meaning_en_de, only the English prompt that facet inherently needs) — no
// gender coloring/badges, no meanings, no grammar labels. Each facet's
// `hintHTML` reveals whatever's safe to show WITHOUT giving away the fact
// currently being tested; after answering, the back/explanation always
// shows the full picture (gender, plural, meaning, example) as feedback.

import { renderFlipCard } from './flipCard.js';
import { renderExercise } from '../grammar/exerciseRenderer.js';
import { gradeFromCorrectness, Grade } from '../../srs/engine.js';
import { genderBadgeHTML, escapeHtml } from '../../components/gender.js';
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

/** Full word info shown as feedback after answering, regardless of which facet was tested. */
function fullInfoHTML(w) {
  const parts = [];
  if (w.pos === 'noun') {
    parts.push(`${genderBadgeHTML(w.gender)} <strong>${escapeHtml(w.lemma)}</strong> <span class="drill-sub">(die ${escapeHtml(w.plural)})</span>`);
    parts.push(escapeHtml(w.meaning_en));
  } else if (w.pos === 'verb') {
    parts.push(`<strong>${escapeHtml(w.lemma)}</strong> — ${escapeHtml(w.meaning_en)}`);
    parts.push(`${escapeHtml(w.present_3sg)} · ${escapeHtml(w.praeteritum)} · ${escapeHtml(w.perfekt)}`);
    if (w.government) parts.push(`<span class="drill-sub">${escapeHtml(w.government)}</span>`);
  } else {
    parts.push(`<strong>${escapeHtml(w.lemma)}</strong> — ${escapeHtml(w.meaning_en)}`);
    if (w.comparative) parts.push(`<span class="drill-sub">${escapeHtml(w.comparative)} / ${escapeHtml(w.superlative || '')}</span>`);
  }
  const example = exampleBlock(w);
  if (example) parts.push(example);
  return parts.join('<br>');
}

/** Contextual hint per facet: everything safe EXCEPT the fact being tested. Returns '' if nothing safe to show. */
function hintForFacet(w, facet) {
  if (facet === 'meaning_de_en' || facet === 'meaning') {
    if (w.pos === 'noun') return `${genderBadgeHTML(w.gender)} plural: ${escapeHtml(w.plural)}`;
    if (w.pos === 'verb') return `${escapeHtml(w.present_3sg)} · ${escapeHtml(w.praeteritum)} · ${escapeHtml(w.perfekt)}`;
    if (w.comparative) return `${escapeHtml(w.comparative)} / ${escapeHtml(w.superlative || '')}`;
    return '';
  }
  if (facet === 'plural') {
    return `${genderBadgeHTML(w.gender)} ${escapeHtml(w.meaning_en)}`;
  }
  if (facet === 'principal_parts') {
    return `${escapeHtml(w.meaning_en)}${w.government ? ` · ${escapeHtml(w.government)}` : ''}`;
  }
  return ''; // meaning_en_de: front is already the English prompt; nothing safe to add without giving away the German answer.
}

function renderVocabItem(item, container, onGrade) {
  const w = item.content;
  const plainLemma = `<strong>${escapeHtml(w.lemma)}</strong>`;

  if (item.facet === 'meaning_de_en') {
    renderFlipCard({
      container,
      frontHTML: plainLemma,
      backHTML: fullInfoHTML(w),
      hintHTML: hintForFacet(w, 'meaning_de_en') || undefined,
      onGrade,
    });
    return;
  }
  if (item.facet === 'meaning_en_de') {
    renderFlipCard({
      container,
      frontHTML: escapeHtml(w.meaning_en),
      backHTML: fullInfoHTML(w),
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
      hint: w.meaning_en,
      explanation: `${w.gender} ${w.lemma}, plural: ${w.plural} — ${w.meaning_en}`,
    };
    renderExercise({ exercise, container, onResult: (correct, hintUsed) => onGrade(gradeFromCorrectness(correct, hintUsed)) });
    return;
  }
  if (item.facet === 'plural') {
    renderFlipCard({
      container,
      frontHTML: `${plainLemma} <div class="drill-sub">plural?</div>`,
      backHTML: fullInfoHTML(w),
      hintHTML: hintForFacet(w, 'plural') || undefined,
      onGrade,
    });
    return;
  }
  if (item.facet === 'principal_parts') {
    renderFlipCard({
      container,
      frontHTML: `${plainLemma} <div class="drill-sub">present · Präteritum · Perfekt?</div>`,
      backHTML: fullInfoHTML(w),
      hintHTML: hintForFacet(w, 'principal_parts') || undefined,
      onGrade,
    });
    return;
  }
  // 'meaning' facet (verb/adjective/other)
  renderFlipCard({
    container,
    frontHTML: plainLemma,
    backHTML: fullInfoHTML(w),
    hintHTML: hintForFacet(w, 'meaning') || undefined,
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
      hintHTML: `Register: ${p.register}`,
      onGrade,
    });
    return;
  }
  // situation_to_phrase — p.situation ends in "(English gloss)" by convention;
  // renderExercise auto-strips that trailing parenthetical as the Hint text.
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
  renderExercise({ exercise, container, onResult: (correct, hintUsed) => onGrade(gradeFromCorrectness(correct, hintUsed)) });
}

export function renderQueueItem(item, container, onGrade) {
  if (item.type === 'vocab') return renderVocabItem(item, container, onGrade);
  if (item.type === 'phrase') return renderPhraseItem(item, container, onGrade);
  if (item.type === 'grammar') {
    return renderExercise({
      exercise: item.content,
      container,
      onResult: (correct, hintUsed) => onGrade(gradeFromCorrectness(correct, hintUsed)),
    });
  }
}

export { Grade };
