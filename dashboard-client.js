const editor = document.querySelector('[data-live-draft-editor]');

if (editor) {
  const scoreEl = document.querySelector('[data-live-quality-score]');
  const lengthEl = document.querySelector('[data-live-weighted-length]');
  const checksEl = document.querySelector('[data-live-checks]');
  const breakdownEl = document.querySelector('[data-live-breakdown]');
  let timer = null;
  let controller = null;

  const humanOnlyCodes = new Set(['FACTUALITY_UNCONFIRMED', 'EVIDENCE_UNCONFIRMED']);

  function renderBreakdown(breakdown = {}) {
    if (!breakdownEl) return;
    const labels = [
      ['Niche', breakdown.niche, 10],
      ['Hook', breakdown.hook, 8],
      ['Insight', breakdown.insight, 10],
      ['Evidence', breakdown.evidence, 10],
      ['Action', breakdown.action, 7],
      ['Originality', breakdown.originality, 5],
    ];
    breakdownEl.innerHTML = labels.map(([label, value, max]) => `<div class="editor-score-item"><dt>${label}</dt><dd>${value ?? 0}<span class="text-xs font-medium text-slate-400">/${max}</span></dd></div>`).join('');
  }

  function renderChecks(gates = {}) {
    if (!checksEl) return;
    const failures = (gates.failures || []).filter((item) => !humanOnlyCodes.has(item.code));
    const confirmations = (gates.failures || []).filter((item) => humanOnlyCodes.has(item.code));
    const warnings = gates.warnings || [];
    if (!failures.length && !warnings.length) {
      checksEl.className = 'editor-checks editor-checks-ok';
      checksEl.innerHTML = '<div class="font-semibold text-emerald-900">Draft checks look good.</div><div class="mt-1 text-sm text-emerald-800">You still make the final factuality/evidence confirmation before approval.</div>';
      return;
    }
    checksEl.className = 'editor-checks editor-checks-warn';
    checksEl.innerHTML = `<div class="font-semibold text-amber-950">${failures.length ? 'Fix before approval' : 'Worth reviewing'}</div>${[...failures, ...warnings].length ? `<ul class="mt-2 mb-0 space-y-1 text-sm text-amber-900">${[...failures, ...warnings].map((item) => `<li>${item.message}</li>`).join('')}</ul>` : ''}${confirmations.length ? '<div class="mt-2 text-xs text-sky-800">Factuality/evidence confirmation is a human approval step, not writing work.</div>' : ''}`;
  }

  async function refreshPreview() {
    controller?.abort();
    controller = new AbortController();
    const params = new URLSearchParams(new FormData(editor));
    try {
      const response = await fetch('/draft/preview', {
        method: 'POST',
        body: params,
        signal: controller.signal,
        headers: { 'x-requested-with': 'live-draft-editor' },
      });
      if (!response.ok) return;
      const data = await response.json();
      if (scoreEl) scoreEl.textContent = `${data.score}/50`;
      if (lengthEl) lengthEl.textContent = `${data.weightedLength}/280`;
      renderBreakdown(data.breakdown);
      renderChecks(data.gates);
    } catch (error) {
      if (error.name !== 'AbortError') console.warn('Live draft preview failed', error);
    }
  }

  editor.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(refreshPreview, 260);
  });
  editor.addEventListener('change', () => {
    clearTimeout(timer);
    timer = setTimeout(refreshPreview, 80);
  });
}
