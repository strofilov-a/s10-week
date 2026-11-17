/* The cabinet's requests to the site, moved out of the page unchanged (same URLs, parameters and error handling as
   release/t5/solo/solo.js). Replace this module to route the requests elsewhere when integrating. */

/** Every request goes to the page's own origin with the session cookie, like calc3. */
export const ORIGIN: string = typeof location !== 'undefined' ? location.origin : '';

/** GET and parse JSON; a non-2xx status throws Error(status). */
export async function get(u: string): Promise<any> {
  const r = await fetch(ORIGIN + u, { credentials: 'include' });
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

/** POST FormData; a non-2xx status or a body with `error` throws Error(error | status). */
export async function post(u: string, fd: FormData): Promise<any> {
  const r = await fetch(ORIGIN + u, { method: 'POST', body: fd, credentials: 'include' });
  const b: any = await r.json().catch(() => ({}));
  if (!r.ok || b.error) throw new Error(b.error || String(r.status));
  return b;
}

/** calc4's plan generator: streamed plain text; onProgress gets the text so far after every chunk. No auth. */
export async function generatePlanText(body: { distance: any; weeks: number; prompt: string }, onProgress: (text: string) => void): Promise<string> {
  const r = await fetch('https://s10.run/t7/plan-templates/public/api/generate.php', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) { const b: any = await r.json().catch(() => ({})); throw new Error(b.error || `ошибка ${r.status}`); }
  if (!r.body) { const t = await r.text(); onProgress(t); return t; }
  const rd = r.body.getReader(), dec = new TextDecoder(); let out = '';
  for (;;) { const { done, value } = await rd.read(); if (done) break; out += dec.decode(value, { stream: true }); onProgress(out); }
  return out + dec.decode();
}
