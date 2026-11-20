// A stand-in of the S10 developers' app for the checks: React 17 ReactDOM.render, the two pages imported from
// react-src/ as they would be, and a way to unmount and mount again (window.__s10) to check the cleanup.
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SoloPlan } from '../../react-src/solo-plan/SoloPlan';
import { SoloKazan } from '../../react-src/solo-plan/SoloKazan';
import { SoloStart } from '../../react-src/solo-start/SoloStart';
import { KazanStart } from '../../react-src/kazan-start/KazanStart';

const which = /\/solo\/start/.test(location.pathname) ? 'start' : /\/solo\/kazan\/start/.test(location.pathname) ? 'kzstart' : /\/solo\/kazan/.test(location.pathname) ? 'kazan' : 'plan';
const host = document.getElementById('app') as HTMLElement;
const mount = () => ReactDOM.render(which === 'start' ? <SoloStart /> : which === 'kzstart' ? <KazanStart /> : which === 'kazan' ? <SoloKazan /> : <SoloPlan />, host);
const w = window as any;
w.__s10 = {
  unmount: () => ReactDOM.unmountComponentAtNode(host),
  mount,
  triggers: () => ScrollTrigger.getAll().length,
};
mount();
