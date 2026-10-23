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

  /** hours: [{hstHour, rating}] -> one cell per hour, night hours shaded, a label every six hours. */
  function strip(hours) {
    if (!hours.length) return '';
    const W = 420, cw = W / hours.length, H = 64;
    const RC = { GOOD: '#2e7d57', FAIR: '#c58a1f', POOR: '#b23b3b' };
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Summit viewing conditions, hour by hour" class="hc-svg">`;
    hours.forEach((h, i) => {
      const night = h.hstHour < 6 || h.hstHour >= 18;
      s += `<g><rect x="${(i * cw).toFixed(1)}" y="14" width="${Math.max(cw - 1, 1).toFixed(1)}" height="26" rx="2" fill="${RC[h.rating] || '#cfd5d1'}"${night ? ' opacity=".62"' : ''}/><title>${h.hstHour}:00 HST: ${esc(h.rating)}${h.lowCloud != null ? `, low cloud ${h.lowCloud}%` : ''}${h.mm ? `, rain ${h.mm} mm` : ''}</title></g>`;
      if (h.hstHour % 6 === 0) {
        const lab = h.hstHour === 0 ? '12a' : h.hstHour === 12 ? '12p' : h.hstHour < 12 ? `${h.hstHour}a` : `${h.hstHour - 12}p`;
        s += `<text x="${(i * cw).toFixed(1)}" y="56" class="hc-tick">${lab}</text><line x1="${(i * cw).toFixed(1)}" x2="${(i * cw).toFixed(1)}" y1="40" y2="46" stroke="#7c8a82"/>`;
      }
    });
    return s + '</svg>';
  }

  /** values/labels -> vertical bars; opts.highlight is an index drawn in the accent colour, opts.line a reference value. */
  function bars(values, labels, opts = {}) {
    const W = 420, H = 150, L = 26, B = 24, T = 12, n = values.length;
    const max = Math.max(opts.max || 0, ...values, opts.line || 0, 1) * 1.1;
    const bw = (W - L - 4) / n, y = (v) => T + (1 - v / max) * (H - T - B);
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.label || 'Bar chart')}" class="hc-svg">`;
    s += `<line x1="${L}" x2="${W - 4}" y1="${H - B}" y2="${H - B}" stroke="#9aa89f"/>`;
    const ticks = [0, Math.round(max / 2), Math.round(max)];
    ticks.forEach((t) => { s += `<text x="${L - 4}" y="${y(t) + 4}" class="hc-tick" text-anchor="end">${t}</text>`; });
    values.forEach((v, i) => {
      const x = L + i * bw + 1, top = y(v);
      s += `<g><rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${Math.max(bw - 2, 1).toFixed(1)}" height="${Math.max(H - B - top, 0).toFixed(1)}" rx="2" fill="${i === opts.highlight ? '#b23b3b' : '#3d7a63'}"/><title>${esc(labels[i])}: ${v}${opts.unit || ''}</title></g>`;
      if (labels[i] != null && (!opts.everyLabel || i % opts.everyLabel === 0)) s += `<text x="${(x + (bw - 2) / 2).toFixed(1)}" y="${H - 8}" class="hc-tick" text-anchor="middle">${esc(labels[i])}</text>`;
    });
    if (opts.line) s += `<line x1="${L}" x2="${W - 4}" y1="${y(opts.line)}" y2="${y(opts.line)}" stroke="#14201a" stroke-dasharray="4 3"/><text x="${L + 4}" y="${y(opts.line) - 4}" class="hc-tick" font-weight="700">${esc(opts.lineLabel || '')}</text>`;
    return s + '</svg>';
  }
  window.HawaiiCharts = { ruler, grid, strip, bars };
})();
