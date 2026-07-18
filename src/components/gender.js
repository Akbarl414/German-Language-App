// Consistent der/die/das color coding, used wherever a noun is shown.

export function genderBadgeHTML(gender) {
  if (!gender) return '';
  return `<span class="gender-badge gender-${gender}">${gender}</span>`;
}

export function nounHTML(word) {
  if (word.pos !== 'noun') return escapeHtml(word.lemma);
  return `<span class="gender-${word.gender}">${word.gender} ${escapeHtml(word.lemma)}</span>`;
}

export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}
