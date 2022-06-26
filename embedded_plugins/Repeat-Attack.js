// Repeat Attack
//
// Auto-attack when source planet has enough energy!
//
// original author: TBC
// enhancements in 2022: https://twitter.com/davidryan59

//@ts-ignore
import {
  PlanetType,
  SpaceType,
  PlanetTypeNames,
  //@ts-ignore
} from 'https://cdn.skypack.dev/@darkforest_eth/types';
//@ts-ignore
import { isUnconfirmedMoveTx } from 'https://cdn.skypack.dev/@darkforest_eth/serde';
//@ts-ignore
import {
  html,
  render,
  useEffect,
  useState,
  useLayoutEffect,
  //@ts-ignore
} from 'https://unpkg.com/htm/preact/standalone.module.js';

import { getPlanetName } from 'https://cdn.skypack.dev/@darkforest_eth/procedural';


// ----------------------------------------
// User Configurable Options

// Control how much energy gets sent, and when
let DEFAULT_PERCENTAGE_TRIGGER = 75;  // What percentage energy will trigger a send?
let DEFAULT_PERCENTAGE_REMAIN = 25;   // How much energy will remain after sending?

// Stagger all the different attacks by this number of seconds, don't send all at once
let STAGGER_S = 15;  // Over what number of seconds will all repeat attacks happen once?

// UI controls
let MAX_CHARS = 15;  // How many letters of planet name to display?
let WIDTH_PX = 430;  // What is the width of plugin window?
let MIN_V = 10; // Set minimum values for sliders
let MAX_V = 90; // Set maximum values for sliders
let STEP_V = 5; // Set step size for sliders

// Keyboard shortcuts
const KEY_SET_SOURCE = 'v';
const KEY_SET_TARGET = 'b';

// Other controls
let SILVER_SEND_PERCENT = 99;  // Sends this proportion of silver from the source planet

// Note - `let` is used in this plugin to sidestep any weird execution env problems
// ----------------------------------------


const sendSilverStatuses = [
  'Do not send', // 0
  'Upgrade first', // 1
  'Send all' // 2
];
const sendSilverStatusesIcon = ['-', 'U', '$'];
const UPGRADE_FIRST = 1;
const SEND_ALL_SILVER = 2;
const INITIAL_SILVER_STATUS = UPGRADE_FIRST;
const toggleSilverStatus = val => (val + 1) % 3;  // 3 way toggle

const viewport = ui.getViewport();
const PI_2 = 6.2831853;  // 2 * pi, the number of radians in a complete circle
const [DESYNC_X, DESYNC_Y] = [101, 103];  // Desynchronises pulsing of separate planets using prime numbers multiplied by canvas coord components

const PLANET_UNKNOWN = '?????';
const getPlanetString = locationId => {
  const planet = df.getPlanetWithId(locationId);
  if(!planet) return PLANET_UNKNOWN;
  let type = 'P';
  if( planet.planetType == PlanetType.SILVER_MINE) type = 'A'
  else if (planet.planetType == PlanetType.RUINS) type = 'F'
  else if (planet.planetType == PlanetType.TRADING_POST) type = 'STR'
  else if (planet.planetType == PlanetType.SILVER_BANK) type = 'Q'
  return `L${planet.planetLevel}-${type} ${getPlanetName(planet)}`;
};
const getPlanetMaxRank = (planet) => {
  if (!planet) return 0;
  if(planet.planetType != PlanetType.PLANET) return 0;
  if (planet.spaceType === SpaceType.NEBULA) return 3;
  else if (planet.spaceType === SpaceType.SPACE) return 4;
  else return 5;
};
const isFullRank = (planet) => {
  if (!planet) return true;
  const maxRank = getPlanetMaxRank(planet);
  const rank = planet.upgradeState.reduce(
    (a, b) => a + b,
    0
  );
  return rank >= maxRank;
};
function unconfirmedDepartures(planet) {
  return (
    planet.transactions
      ?.getTransactions(isUnconfirmedMoveTx)
      //@ts-ignore
      .reduce((acc, tx) => acc + tx.intent.forces, 0) || 0
  );
}
function planetCurrentPercentEnergy(planet) {
  const departures = unconfirmedDepartures(planet);
  const estimatedEnergy = Math.floor(planet.energy - departures);
  return Math.floor((estimatedEnergy / planet.energyCap) * 100);
}
class Repeater {
  constructor() {
    //@ts-ignore
    if (typeof window.__CORELOOP__ == 'undefined') {
      //setup append only interval id storage
      //@ts-ignore
      window.__CORELOOP__ = [];
    } else {
      //clear out old intervald
      console.log('KILLING PREVIOUS INTERVALS');
      //@ts-ignore
      window.__CORELOOP__.forEach((id) => window.clearInterval(id));
    }
    this.uiSelectedPlanet = null;
    this.attacks = [];
    this.account = df.getAccount();
    this.loadAttacks();
    this.intervalId = window.setInterval(this.coreLoop.bind(this), 1000);
    //@ts-ignore
    window.__CORELOOP__.push(this.intervalId);
  }
  saveAttacks() {
    localStorage.setItem(`repeatAttacks-${this.account}`, JSON.stringify(this.attacks));
  }
  loadAttacks() {
    const attacksJSON = localStorage.getItem(`repeatAttacks-${this.account}`);
    // @ts-ignore
    if (attacksJSON) this.attacks = JSON.parse(attacksJSON);
  }
  addAttack(attack) {
    let newAttacks = this.attacks.filter(a => a.srcId !== attack.srcId);
    newAttacks = [attack, ...newAttacks];
    this.attacks = newAttacks;
    this.saveAttacks();
  }
  toggleActive(position) {
    this.attacks[position].active = !this.attacks[position].active;
    this.saveAttacks();
  }
  toggleSilver(position) {
    this.attacks[position].sendSilverStatus = toggleSilverStatus(this.attacks[position].sendSilverStatus);
    this.saveAttacks();
  }
  removeAttack(position) {
    this.attacks.splice(position, 1);
    this.saveAttacks();
  }
  removeAllAttacks() {
    this.attacks = [];
    this.saveAttacks();
  }
  stopFiring(planetId) {
    this.attacks = this.attacks.filter(a => a.srcId !== planetId);
    this.saveAttacks();
  }
  stopBeingFiredAt(planetId) {
    this.attacks = this.attacks.filter(a => a.targetId !== planetId);
    this.saveAttacks();
  }
  coreLoop() {
    if(!this || !this.attacks) return;
    this.attacks.forEach( (attack, idx) => {
      if(idx % STAGGER_S == Math.floor(Date.now() / 1000) % STAGGER_S) ExecuteAttack(attack);
    });
  }
}
const ExecuteAttack = ({srcId, targetId, active, pcTrigger, pcRemain, sendSilverStatus}) => {
  let srcPlanet = df.getPlanetWithId(srcId);
  if (!srcPlanet) return;
  if (!active) return;
  // Needs updated check getUnconfirmedDepartingForces
  const departingForces = unconfirmedDepartures(srcPlanet);
  const TRIGGER_AMOUNT = Math.floor((srcPlanet.energyCap * pcTrigger) / 100);
  const FUZZY_ENERGY = Math.floor(srcPlanet.energy - departingForces); //Best estimate of how much energy is ready to send
  if (FUZZY_ENERGY > TRIGGER_AMOUNT) {
    const overflow_send =
      planetCurrentPercentEnergy(srcPlanet) - pcRemain;
    const FORCES = Math.floor((srcPlanet.energyCap * overflow_send) / 100);
    let silver = 0;
    if ( sendSilverStatus === SEND_ALL_SILVER || (sendSilverStatus === UPGRADE_FIRST && isFullRank(srcPlanet))) {
      silver = Math.round(srcPlanet.silver * (SILVER_SEND_PERCENT / 100));
    }
    df.move(srcId, targetId, FORCES, silver);
  }
};
let Keyboard_Shortcut = {
  fontSize: '85%',
  color: 'rgba(220, 180, 128, 1)'
};
let Margin_3L_3R = {
  marginLeft: '3px',
  marginRight: '3px',
};
let Margin_12L_12R = {
  marginLeft: '12px',
  marginRight: '12px',
};
let Margin_12B = {
  marginBottom: '12px',
};
let Margin_6B = {
  marginBottom: '6px',
};
let Clickable = {
  cursor: 'pointer',
  textDecoration: 'underline',
};
let ActionEntry = {
  marginBottom: '5px',
  display: 'flex',
  justifyContent: 'space-between',
  color: '',
};
function centerPlanet(id) {
  ui.centerLocationId(id);
}
function planetShort(locationId) {
  return locationId.substring(4, 9);
}
function Attack({ attack, onToggleActive, onToggleSilver, onDelete }) {
  const srcString = getPlanetString(attack.srcId);
  const targetString = getPlanetString(attack.targetId);
  const finalSrc = srcString.length > MAX_CHARS ? srcString.slice(0, MAX_CHARS - 3).concat('...') : srcString;
  const finalTarget = targetString.length > MAX_CHARS ? targetString.slice(0, MAX_CHARS - 3).concat('...') : targetString;
  return html`
    <div style=${ActionEntry}>
      <button style=${{border: 'none', margin: 'none'}} onClick=${onToggleActive}>${attack.active?'▶️':'⏸️'}</button>
      <span>
        <span style=${{ ...Margin_3L_3R }}>
          <span style=${{ ...Clickable }} onClick=${() => centerPlanet(attack.srcId)}>${finalSrc}</span>
          <span style=${{ ...Margin_3L_3R }}>-></span>
          <span style=${{ ...Clickable }} onClick=${() => centerPlanet(attack.targetId)}>${finalTarget}</span>
        </span>
        <span style=${{ ...Margin_3L_3R }}>
          <span>${`${attack.pcTrigger}%`}</span>
          <span style=${{ ...Margin_3L_3R }}>-></span>
          <span>${`${attack.pcRemain}%`}</span>
        </span>
      </span>
      <span style=${{ ...Margin_3L_3R }}>
        <button onClick=${onToggleSilver}>${`${sendSilverStatusesIcon[attack.sendSilverStatus]}`}</button>
      </span>
      <button onClick=${onDelete}>X</button>
    </div>
  `;
}
function AddAttack({ repeater, startFiring, stopFiring, stopBeingFiredAt }) {
  let [planet, setPlanet] = useState(ui.getSelectedPlanet());
  let [source, setSource] = useState(undefined);
  let [target, setTarget] = useState(undefined);
  let [active, setActive] = useState(true);
  let [pcTrigger, setPcTrigger] = useState(DEFAULT_PERCENTAGE_TRIGGER);
  let [pcRemain, setPcRemain] = useState(DEFAULT_PERCENTAGE_REMAIN);
  let [sendSilverStatus, setSendSilverStatus] = useState(INITIAL_SILVER_STATUS);
  useLayoutEffect(() => {
    let onClick = () => {
      const planet = ui.getSelectedPlanet();
      setPlanet(planet);
      repeater.uiSelectedPlanet = planet;
    };
    window.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('click', onClick);
    };
  }, []);
  useLayoutEffect(() => {
    let onKeyUp = e => {
      switch (e.key) {
        case KEY_SET_SOURCE:
          setSource(ui.getSelectedPlanet());
          break;
        case KEY_SET_TARGET:
          setTarget(ui.getSelectedPlanet());
          break;
      }
    };
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Note: an attack is an object with this format:
  // { srcId, targetId, active, pcTrigger, pcRemain, sendSilverStatus }
  // Each item is used to control a different aspect of the attack

  return html`
    <div style=${{ display: 'flex', flexDirection: 'column' }}>
      <div style=${{ display: 'flex' }}>
        <button
          style=${Margin_12B}
          onClick=${() => {
            setSource(planet);
          }}
        >
          Set Source <span style=${Keyboard_Shortcut}>[${KEY_SET_SOURCE}]</span>
        </button>
        <span 
          style=${source ? { ...Margin_12L_12R, ...Clickable, marginRight: 'auto' } : {...Margin_12L_12R, marginRight: 'auto'}} 
          onClick=${source? () => centerPlanet(source.locationId) : () => {}}
        >
          ${source ? getPlanetString(source.locationId) : PLANET_UNKNOWN}
        </span>
      </div>
      <div style=${{ display: 'flex' }}>
        <button style=${Margin_12B} onClick=${() => setTarget(planet)}>
          Set Target <span style=${Keyboard_Shortcut}>[${KEY_SET_TARGET}]</span>
        </button>
        <span 
          style=${target ? { ...Margin_12L_12R, ...Clickable, marginRight: 'auto' } : {...Margin_12L_12R, marginRight: 'auto'}} 
          onClick=${target? () => centerPlanet(target.locationId) : () => {}}
        >
          ${target ? getPlanetString(target.locationId) : PLANET_UNKNOWN}
        </span>
      </div>
      <div style=${{marginBottom: 3}}>
        Trigger firing at this energy: <input type='range' min=${MIN_V} max=${MAX_V} step=${STEP_V} defaultValue=${pcTrigger} onChange=${e => setPcTrigger(parseInt(e.target.value))}/> ${pcTrigger}%
      </div>
      <div style=${{marginBottom: 3}}>
        Remaining energy after firing: <input type='range' min=${MIN_V} max=${MAX_V} step=${STEP_V} defaultValue=${pcRemain} onChange=${e => setPcRemain(parseInt(e.target.value))}/> ${pcRemain}%
      </div>
      <div style=${{marginBottom: 10}}>
        Choose when to send silver: <button
          style=${{width: 150, height: 23, fontSize: '90%'}}
          onClick=${() => setSendSilverStatus(toggleSilverStatus(sendSilverStatus))}
        >
          ${sendSilverStatuses[sendSilverStatus]}
        </button>
      </div>
      <div>
        <button
          style=${{...Margin_12B, width: 150}}
          onClick=${() => target && source && startFiring({
            srcId: source.locationId,
            targetId: target.locationId,
            active,
            pcTrigger,
            pcRemain: ((pcTrigger <= pcRemain) ? parseInt(pcTrigger / 2) : pcRemain),
            sendSilverStatus
          })}
        >
          Start Firing!
        </button>
      </div>
      <hr
        style=${{borderColor: 'grey', marginBottom: '10px'}}
      />
      <div
        style=${{fontSize: '90%'}}
      >
        <button
          style=${{...Margin_12B, width: 80, marginRight: 10}}
          onClick=${() => planet && stopFiring(planet.locationId)}
        >
          Stop Firing
        </button>
        <button
          style=${{...Margin_12B, width: 93}}
          onClick=${() => planet && stopBeingFiredAt(planet.locationId)}
        >
          Stop Being Fired At
        </button>
        <span 
          style=${planet ? { ...Margin_12L_12R, ...Clickable, marginRight: 'auto' } : {...Margin_12L_12R, marginRight: 'auto'}} 
          onClick=${planet ? () => centerPlanet(planet.locationId) : () => {}}
        >
          ${planet ? getPlanetString(planet.locationId) : PLANET_UNKNOWN}
        </span>
      </div>
      <hr
        style=${{borderColor: 'grey', marginBottom: '10px'}}
      /> 
    </div>
  `;
}
function AttackList({ repeater }) {
  const [attacks, setAttacks] = useState([...repeater.attacks]);
  useEffect(() => {
    const id = setInterval(() => {
      setAttacks([...repeater.attacks]);
    }, 1000);
    setAttacks([...repeater.attacks]);
    return () => clearInterval(id);
  }, [attacks.length]);
  let actionList = {
    backgroundColor: '#252525',
    maxHeight: '240px',
    overflowX: 'hidden',
    overflowY: 'scroll',
    padding: '5px',
    borderRadius: '5px',
  };
  //@ts-ignore
  let actionsChildren = attacks.map((action, index) => {
    return html`
      <${Attack}
        attack=${action}
        onToggleActive=${() => repeater.toggleActive(index)}
        onToggleSilver=${() => repeater.toggleSilver(index)}
        onDelete=${() => repeater.removeAttack(index)}
      />
    `;
  });
  return html`
    <i style=${{ ...Margin_12B, display: 'block' }}>
      Auto-attack when source planet has enough energy!
    </i>
    <${AddAttack}
      repeater=${repeater}
      startFiring=${attack => repeater.addAttack(attack)}
      stopFiring=${planetId => repeater.stopFiring(planetId)}
      stopBeingFiredAt=${planetId => repeater.stopBeingFiredAt(planetId)}
    />
    <h1 style=${{...Margin_6B, fontWeight: 'bold'}}>
      Active (${attacks.reduce((acc, atk) => acc + (atk.active ? 1 : 0), 0)} / ${attacks.length})
      <button style=${{ float: 'right', marginLeft: 10 }} onClick=${() => {repeater.removeAllAttacks(); setAttacks([])}}>
        Clear All
      </button>
      <button style=${{ float: 'right' }} onClick=${() => setAttacks([...repeater.attacks])}>
        Refresh
      </button>
    </h1>
    <div style=${actionList}>${actionsChildren.length ? actionsChildren : 'No Actions.'}</div>
  `;
}
function App({ repeater }) {
  return html`<${AttackList} repeater=${repeater} />`;
}

const drawHighlights = plugin => {
  const ctx = plugin.ctx;
  const timeMs = plugin.dateNow;
  const planet = plugin.repeater.uiSelectedPlanet;
  if (!planet || !planet.location) return;
  const selectedPlanetId = planet.locationId;
  const attacks = plugin.repeater.attacks;
  const attacksSelectedIsSource = attacks.filter(a => a.srcId === selectedPlanetId);
  const attacksSelectedIsTarget = attacks.filter(a => a.targetId === selectedPlanetId);
  if (!attacksSelectedIsSource.length && !attacksSelectedIsTarget.length) return;
  const getSawWave01 = (periodMs, planet) => {
    const coords = planet.location.coords;
    const adjustedTimeMs = timeMs + DESYNC_X * coords.x + DESYNC_Y * coords.y;  // Large number of seconds from 1970 (approx)
    return (adjustedTimeMs % periodMs) / periodMs;  // Sawtooth Wave, position in cycle, between 0 and 1
  }
  const getTriWave01 = (periodMs, planet) => {
    const sawWave01 = getSawWave01(periodMs, planet);
    return 2 * Math.min(sawWave01, 1 - sawWave01);  // Triangle Wave, between 0 and 1
  }
  const drawHighlight = (planetId, rgba, periodMs, lineWidth, arcFraction) => {
    const thePlanet = ui.getPlanetWithId(planetId);
    const theCoords = thePlanet.location.coords;
    ctx.strokeStyle = rgba;
    ctx.setLineDash([12, 8]);
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    const cX = viewport.worldToCanvasX(theCoords.x);
    const cY = viewport.worldToCanvasY(theCoords.y);
    const cR = 10 + viewport.worldToCanvasDist(1.4 * ui.getRadiusOfPlanetLevel(thePlanet.planetLevel));
    const START_RADIANS = PI_2 * getSawWave01(periodMs, thePlanet);
    ctx.arc(cX, cY, cR, START_RADIANS, START_RADIANS + PI_2 * arcFraction);  
    ctx.stroke();
    ctx.closePath();
  }
  attacksSelectedIsSource.forEach(a => a.active
    ? drawHighlight(a.targetId, `rgba(255, 80, 80, 0.6)`, 23000, 8, 0.55)
    : drawHighlight(a.targetId, `rgba(180, 140, 40, 0.6)`, 23000, 6, 0.3)
  );
  drawHighlight(selectedPlanetId, `rgba(80, 80, 255, 0.7)`, -12000, 6, 0.7);
  attacksSelectedIsTarget.forEach(a => a.active
    ? drawHighlight(a.srcId, `rgba(80, 255, 80, 0.5)`, 7000, 4, 0.8)
    : drawHighlight(a.srcId, `rgba(140, 180, 40, 0.5)`, 7000, 3, 0.4)
  );
}

class Plugin {
  constructor() {
    this.repeater = new Repeater();
    this.ctx = null;
    this.dateNow = Date.now();
    this.root = undefined;
  }
  stop() {
    //@ts-ignore
    window.__CORELOOP__.forEach((id) => window.clearInterval(id));
  }
  /**
   * Called when plugin is launched with the "run" button.
   */
  async render(container) {
    this.container = container;
    container.style.width = `${WIDTH_PX}px`;
    this.root = render(html`<${App} repeater=${this.repeater} />`, container);
  }
  /**
   * Used to highlight source, selected, and target planets.
   */
  draw(ctx) {
    ctx.save();
    this.ctx = ctx;
    this.dateNow = Date.now();
    drawHighlights(this);
    ctx.restore();
  }
  /**
   * Called when plugin modal is closed.
   */
  destroy() {
    //@ts-ignore
    window.__CORELOOP__.forEach((id) => window.clearInterval(id));
    if (this.container) render(html`<div></div>`, this.container);
  }
}
/**
 * And don't forget to export it!
 */
export default Plugin;
