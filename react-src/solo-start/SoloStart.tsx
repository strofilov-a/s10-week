import * as React from 'react';
import { MARKUP } from './markup';
import { mountSoloStart } from './start';
import './fonts.css';
import './start.css';

/**
 * /solo/start — the public S10 Solo promo page. No login, no requests to the site: every button is a link to
 * /login?back=…/solo/plan. The markup is rendered once; the scenes (GSAP ScrollTrigger, Lenis on the mouse wheel),
 * the orb's flight, the calendar and the paces start on mount and are all removed on unmount.
 */
export function SoloStart(): React.ReactElement {
  const root = React.useRef<HTMLDivElement>(null);
  const html = React.useMemo(() => ({ __html: MARKUP }), []);
  React.useEffect(() => {
    if (!root.current) return undefined;
    return mountSoloStart(root.current);
  }, []);
  return <div ref={root} className="s10-solo-start" dangerouslySetInnerHTML={html} />;
}

export default SoloStart;
