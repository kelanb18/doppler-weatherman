// ─── UTILS ───────────────────────────────────────────────────
export const $ = id => document.getElementById(id);

export function clamp(n, a, b) { return Math.min(Math.max(n, a), b); }

export function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function setStatus(msg) {
  const s1 = $('status');
  const s2 = $('status2');
  if (s1) s1.textContent = msg;
  if (s2) s2.textContent = msg;
}

export function setBar(id, val, color) {
  const el = $(id);
  if (!el) return;
  el.style.height = `${Math.round(clamp(val, 0, 1) * 100)}%`;
  el.style.background = color;
}
