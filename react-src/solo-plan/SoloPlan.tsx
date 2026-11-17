import * as React from 'react';
import { mountSoloPlan } from './engine';
import './plan.css';

export interface SoloPlanProps {
  /** cover the whole window (position:fixed), as the standalone release does; default false: draw in place */
  overlay?: boolean;
  /** 'kazan': the Kazan marathon mode (use <SoloKazan /> at /solo/kazan); default 'solo' */
  mode?: 'solo' | 'kazan';
}

/**
 * /solo/plan — «S10 Solo / Моя неделя». The page draws itself into this element and keeps its state inside
 * (engine.ts); on unmount every listener and the page's marks on <html> are removed. The athlete comes from
 * ?id= in the address, else the logged-in user (GET /apiweb/student/self/info/).
 */
export function SoloPlan(props: SoloPlanProps): React.ReactElement {
  const host = React.useRef<HTMLDivElement>(null);
  const overlay = !!props.overlay;
  const mode = props.mode === 'kazan' ? 'kazan' : 'solo';
  React.useEffect(() => {
    if (!host.current) return undefined;
    return mountSoloPlan(host.current, { overlay, mode });
  }, [overlay, mode]);
  return <div ref={host} className="s10-solo-plan" />;
}

export default SoloPlan;
