// Shared inline-SVG charts for the Hawaii tools. Draws only from the payload the page already loaded.
(() => {
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const COL = { CALM: '#2e7d57', GOOD: '#2e7d57', MODERATE: '#c58a1f', WATCH: '#c58a1f', CHECK: '#8a94a0', ROUGH: '#b23b3b', NO_DATA: '#cfd5d1' };
  const SHORT = { CALM: 'Calm', GOOD: 'Good', MODERATE: 'Mod.', WATCH: 'Watch', CHECK: 'Check', ROUGH: 'Rough', NO_DATA: 'n/a' };

  /** rows: [{name, value, record:{p50,p70,p90,p99}}] -> horizontal rulers, one per place, marker = forecast peak. */
  function ruler(rows, unitLabel) {
    const rs = rows.filter((r) => r.record);
    if (!rs.length) return '';
    const max = Math.max(...rs.map((r) => Math.max(r.record.p99, r.value ?? 0))) * 1.08;
    const W = 420, L = 4, R = 4, rowH = 58, H = 8 + rs.length * rowH;
    const x = (v) => L + (Math.min(v, max) / max) * (W - L - R);
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Forecast wave height against each place's own 10-year record" class="hc-svg">`;
    rs.forEach((r, i) => {
      const y = 38 + i * rowH, q = r.record;
      s += `<text x="${L}" y="${y - 20}" class="hc-lab">${esc(r.name)}</text>`;
      s += `<text x="${W - R}" y="${y - 20}" class="hc-tick" text-anchor="end">${r.value != null ? `forecast ${r.value.toFixed(2)} ${unitLabel} · ` : ''}typical ${q.p50.toFixed(2)} · rough end ${q.p90.toFixed(2)}</text>`;
      s += `<rect x="${x(0)}" y="${y - 8}" width="${x(q.p50) - x(0)}" height="16" fill="#dcece3"/>`;
      s += `<rect x="${x(q.p50)}" y="${y - 8}" width="${x(q.p90) - x(q.p50)}" height="16" fill="#f0e3c4"/>`;
      s += `<rect x="${x(q.p90)}" y="${y - 8}" width="${x(max) - x(q.p90)}" height="16" fill="#efd2d2"/>`;
      if (r.value != null) s += `<g><line x1="${x(r.value)}" x2="${x(r.value)}" y1="${y - 13}" y2="${y + 13}" stroke="#14201a" stroke-width="3"/><circle cx="${x(r.value)}" cy="${y}" r="5.5" fill="#14201a"/><title>${esc(r.name)}: ${r.value.toFixed(2)} ${unitLabel}</title></g>`;
    });
    return s + '</svg>';
  }

  /** days: [{label, items:[{name,state}]}] -> grid of coloured cells. */
  function grid(days, names) {
    const colW = 60, L = 116, rowH = 34, W = L + days.length * colW, H = 28 + names.length * rowH;
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Four-day outlook by place" class="hc-svg">`;
    days.forEach((d, i) => { s += `<text x="${L + i * colW + colW / 2}" y="14" class="hc-tick" text-anchor="middle">${esc(d.label)}</text>`; });
    names.forEach((n, r) => {
      const y = 24 + r * rowH;
      s += `<text x="0" y="${y + 20}" class="hc-lab">${esc(n)}</text>`;
      days.forEach((d, i) => {
        const st = d.states[r] || 'NO_DATA';
        s += `<g><rect x="${L + i * colW + 2}" y="${y}" width="${colW - 4}" height="${rowH - 4}" rx="6" fill="${COL[st] || COL.NO_DATA}"/><text x="${L + i * colW + colW / 2}" y="${y + 20}" text-anchor="middle" class="hc-cell" fill="${st === 'NO_DATA' ? '#4c5b53' : '#fff'}">${SHORT[st] || st}</text><title>${esc(n)}, ${esc(d.label)}: ${esc(st)}</title></g>`;
      });
    });
    return s + '</svg>';
  }
  window.HawaiiCharts = { ruler, grid };
})();
