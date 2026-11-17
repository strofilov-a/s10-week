/* The cabinet keeps its view in the address, as the release does: ?id= (a coach opening an athlete), ?tab=plan|paces,
   ?week=YYYY-MM-DD, ?colors (the palette picker). These are the only places it touches location and history; swap
   them for your router's equivalents if it owns the address. */
export const urlState = {
  /** the current query string, «?…» or «» */
  search(): string { return location.search; },
  href(): string { return location.href; },
  /** write a new address: push = a step back works, else replace */
  write(u: URL, push: boolean): void { if (push) history.pushState(null, '', u.href); else history.replaceState(null, '', u.href); },
  /** back/forward in the browser; returns the unsubscribe */
  onPop(fn: () => void): () => void { window.addEventListener('popstate', fn); return () => window.removeEventListener('popstate', fn); },
  /** leave the page (the login, /money, the site's links) */
  go(url: string): void { location.href = url; },
};
