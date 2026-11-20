import * as React from 'react';
import { MARKUP } from './markup';
import { mountKazanStart } from './start';
import '../solo-start/fonts.css';
import './fonts.css';
import './start.css';

/**
 * /solo/kazan/start — the public Kazan marathon promo page. No login, no requests to the site: every button is a link
 * to /login?back=…/solo/kazan. The markup is rendered once; the scenes (GSAP ScrollTrigger, Lenis on the mouse wheel),
 * the orb's flight, the calendar and the goal picker start on mount and are all removed on unmount. The fonts and the
 * stage are /solo/start's (solo-start/fonts.css, solo-start/stage.ts), plus Roboto (./fonts.css) for the three Kazan
 * blocks on top, which mountKazanStart puts in a shadow root of their own (their CSS and ours never meet).
 */
export function KazanStart(): React.ReactElement {
  const root = React.useRef<HTMLDivElement>(null);
  const html = React.useMemo(() => ({ __html: MARKUP }), []);
  React.useEffect(() => {
    if (!root.current) return undefined;
    return mountKazanStart(root.current);
  }, []);
  return <div ref={root} className="s10-kazan-start" dangerouslySetInnerHTML={html} />;
}

export default KazanStart;
