// Campaign state: the chosen world, class mode, and what each mission hands to the next.
// Orbit -> relay schedule for the rover; Rover -> data packets for comms.
import { WORLDS } from './worlds.js';
import { medalOf } from './profile.js';

const KEY = 'com.campaign.v1';
function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || { world: 'moon', classMode: false, results: {} }; }
  catch { return { world: 'moon', classMode: false, results: {} }; }
}
function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage blocked */ } }

export const getWorldId = () => (WORLDS[load().world] ? load().world : 'moon');
export const getWorld = () => WORLDS[getWorldId()];
export function setWorld(id) { if (!WORLDS[id]) return; const s = load(); s.world = id; save(s); }

export const isClassMode = () => !!load().classMode;
export function setClassMode(on) { const s = load(); s.classMode = !!on; save(s); }

export function saveMission(worldId, mission, data) {
  const s = load();
  s.results[worldId] = s.results[worldId] || {};
  const prev = s.results[worldId][mission];
  s.results[worldId][mission] = { ...data, medal: medalOf(data.score), best: Math.max(data.score, prev?.best || 0), at: new Date().toISOString() };
  save(s);
  return s.results[worldId][mission];
}
export const getMission = (worldId, mission) => load().results[worldId]?.[mission] || null;

/** Default relay used when the orbit mission hasn't been flown yet. */
export const DEFAULT_RELAY = { periodH: 12, windowH: 4, coverage: 0.33, dataRate: 1, assumed: true };

export function relaySchedule(worldId) {
  const o = getMission(worldId, 'orbit');
  return o?.relay ? { ...o.relay, assumed: false } : { ...DEFAULT_RELAY };
}

/** Data the rover brought back, as packets for the comms mission. */
export function roverPackets(worldId) {
  const r = getMission(worldId, 'rover');
  if (!r?.data) return { packets: defaultPackets(worldId), assumed: true };
  return { packets: r.data.packets, assumed: false };
}

function defaultPackets(worldId) {
  return worldId === 'mars'
    ? [{ id: 'pano', label: 'Panorama photo', bits: 16, value: 10 }, { id: 'samp1', label: 'Sample log #1', bits: 16, value: 20 }]
    : [{ id: 'pano', label: 'Panorama photo', bits: 16, value: 10 }, { id: 'soil', label: 'Soil data', bits: 8, value: 8 }];
}

export function campaignScore(worldId) {
  const r = load().results[worldId] || {};
  return ['orbit', 'rover', 'comms'].reduce((a, m) => a + (r[m]?.best || 0), 0);
}

export function resetCampaign(worldId) { const s = load(); delete s.results[worldId]; save(s); }
