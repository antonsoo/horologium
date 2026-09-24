import './style.css';
import { dateToJD } from '../lib/core/jd.js';
import { buildBackDial } from './backdial.js';
import { buildControls, formatDateReadout } from './controls.js';
import { buildDial } from './dial.js';
import { buildTablets } from './tablets.js';

const app = document.getElementById('app');
if (!app) throw new Error('missing #app mount point');

app.innerHTML = `
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header">
    <button class="theme-toggle" type="button" id="theme-toggle">Night sky</button>
    <div class="wrap">
      <h1 class="wordmark">Horologium</h1>
      <p class="tagline">What time is it in Babylon? A live clock for the calendars of the ancient world.</p>
    </div>
  </header>
  <main id="main" class="wrap">
    <section class="dial-section" aria-label="Astronomical dial">
      <figure class="dial-figure" id="dial-mount"></figure>
    </section>
    <p class="dial-caption">Sun · Moon · Mercury · Venus · Mars · Jupiter · Saturn · date pointer</p>
    <div class="readout">
      <div class="primary" id="readout-primary"></div>
      <div class="secondary" id="readout-secondary"></div>
    </div>
    <section id="controls-mount" aria-label="Time and location controls"></section>
    <h2 class="tablets-heading">Calendar tablets</h2>
    <section class="tablets-grid" id="tablets-mount" aria-label="Calendars"></section>
    <section class="backdial-section" aria-label="Back dial: Metonic and Saros cycles">
      <h2 class="tablets-heading">Back dial</h2>
      <figure class="backdial-figure" id="backdial-mount"></figure>
    </section>
  </main>
  <footer class="site-footer wrap">
    <p>
      Calendar arithmetic follows Reingold &amp; Dershowitz, <em>Calendrical Calculations: The Ultimate
      Edition</em> (Cambridge University Press, 2018); astronomy follows Jean Meeus, <em>Astronomical
      Algorithms</em>, 2nd ed. (Willmann-Bell, 1998), and planetary positions follow E.M. Standish
      (JPL/Caltech), "Keplerian Elements for Approximate Positions of the Major Planets".
    </p>
    <p>
      <a href="https://github.com/antonsoo/horologium">Source on GitHub</a> · MIT licensed ·
      built by Anton Soloviev
    </p>
  </footer>
`;

const dialMount = document.getElementById('dial-mount') as HTMLElement;
const { svg, update: updateDial } = buildDial();
dialMount.appendChild(svg);

const backdialMount = document.getElementById('backdial-mount') as HTMLElement;
const { svg: backSvg, update: updateBackDial } = buildBackDial();
backdialMount.appendChild(backSvg);

const tabletsMount = document.getElementById('tablets-mount') as HTMLElement;
const controlsMount = document.getElementById('controls-mount') as HTMLElement;
const readoutPrimary = document.getElementById('readout-primary') as HTMLElement;
const readoutSecondary = document.getElementById('readout-secondary') as HTMLElement;

const controls = buildControls();
controlsMount.appendChild(controls.root);

function render() {
  const state = controls.getState();
  updateDial(state.jd);
  updateBackDial(state.jd);
  buildTablets(tabletsMount, state.jd);
  const { primary, secondary } = formatDateReadout(state.jd);
  readoutPrimary.textContent = primary;
  readoutSecondary.textContent = `${secondary} · ${state.locationName}`;
}
render();
controls.onChange(render);

// Live ticking: advance once a minute of wall-clock time while "live".
setInterval(() => {
  const state = controls.getState();
  if (!state.live) return;
  controls.setState({ jd: dateToJD(new Date()) });
}, 15000);

// Theme toggle (persists only for this tab via a data attribute, no tracking).
const themeToggle = document.getElementById('theme-toggle') as HTMLButtonElement;
function currentTheme(): 'light' | 'dark' {
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'light' || attr === 'dark') return attr;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function applyThemeLabel() {
  themeToggle.textContent = currentTheme() === 'dark' ? 'Papyrus by day' : 'Night sky';
}
themeToggle.addEventListener('click', () => {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try {
    localStorage.setItem('horologium-theme', next);
  } catch {
    /* private browsing or storage disabled: theme just won't persist */
  }
  applyThemeLabel();
});
try {
  const saved = localStorage.getItem('horologium-theme');
  if (saved === 'light' || saved === 'dark')
    document.documentElement.setAttribute('data-theme', saved);
} catch {
  /* ignore */
}
applyThemeLabel();
