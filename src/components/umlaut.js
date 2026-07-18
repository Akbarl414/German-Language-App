// Reusable ä ö ü ß tap-buttons for any German text input, per the content
// pipeline's Path A (in-app manual entry) requirement.

const CHARS = ['ä', 'ö', 'ü', 'ß', 'Ä', 'Ö', 'Ü'];

export function umlautFieldHTML(inputId, { label, type = 'text', placeholder = '', value = '', multiline = false } = {}) {
  const tag = multiline ? 'textarea' : 'input';
  const typeAttr = multiline ? '' : `type="${type}"`;
  const valueAttr = multiline ? '' : `value="${escapeAttr(value)}"`;
  const inner = multiline ? escapeHtml(value) : '';
  return `
    <div class="field-with-umlauts">
      <label for="${inputId}">${label}</label>
      <${tag} id="${inputId}" ${typeAttr} ${valueAttr} placeholder="${escapeAttr(placeholder)}">${inner}</${tag}>
      <div class="umlaut-row" data-target="${inputId}">
        ${CHARS.map((c) => `<button type="button" class="umlaut-btn" data-char="${c}">${c}</button>`).join('')}
      </div>
    </div>`;
}

export function wireUmlautButtons(root) {
  root.querySelectorAll('.umlaut-row').forEach((row) => {
    const target = root.querySelector(`#${CSS.escape(row.dataset.target)}`);
    if (!target) return;
    row.querySelectorAll('.umlaut-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const char = btn.dataset.char;
        const start = target.selectionStart ?? target.value.length;
        const end = target.selectionEnd ?? target.value.length;
        target.value = target.value.slice(0, start) + char + target.value.slice(end);
        target.focus();
        target.selectionStart = target.selectionEnd = start + char.length;
        target.dispatchEvent(new Event('input', { bubbles: true }));
      });
    });
  });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}
function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, '&quot;');
}
