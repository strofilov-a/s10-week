import * as React from 'react';
import { SoloPlan } from './SoloPlan';

export interface SoloKazanProps {
  /** cover the whole window (position:fixed), as the standalone release does; default false: draw in place */
  overlay?: boolean;
}

/**
 * /solo/kazan — «Казанский марафон»: the same page as <SoloPlan /> in its Kazan mode. The race is fixed (Kazan,
 * 2 May 2027, 42.2 km), the 24-week plan is built in, the athlete picks the goal 3:00 / 3:30 / 4:00. Its browser
 * keys are «s10week.kazan.…», so it never touches Solo's. Logged out, it shows the Kazan block with «Войти и начать».
 */
export function SoloKazan(props: SoloKazanProps = {}): React.ReactElement {
  return <SoloPlan mode="kazan" overlay={props.overlay} />;
}

export default SoloKazan;
