// Player profiles, XP, ranks, medals and run history. Stored only in this browser (no accounts),
// so the game is safe for classrooms: no personal data leaves the device.

const KEY = 'com.profiles.v1';
export const LEVELS = [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200];
export const RANKS = ['Cadet', 'Cadet', 'Pilot', 'Pilot', 'Engineer', 'Engineer', 'Mission Specialist', 'Mission Specialist', 'Flight Director', 'Flight Director'];
export const ROLES = ['Mission lead', 'Engineer', 'Scientist', 'Comms officer'];
export const AVATARS = 6;

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || { profiles: {}, crew: [] }; } catch { return { profiles: {}, crew: [] }; }
}
function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage blocked */ } }

export function levelOf(xp) {
  let lv = 0; while (lv + 1 < LEVELS.length && xp >= LEVELS[lv + 1]) lv++;
  const next = LEVELS[lv + 1];
  return { level: lv + 1, rank: RANKS[lv], into: xp - LEVELS[lv], span: next ? next - LEVELS[lv] : 0, max: !next };
}

export function medalOf(score) {
  return score >= 85 ? 'gold' : score >= 65 ? 'silver' : score >= 40 ? 'bronze' : 'none';
}

export const listProfiles = () => Object.values(load().profiles).sort((a, b) => a.created.localeCompare(b.created));
export const getProfile = (id) => load().profiles[id] || null;

export function createProfile({ name, avatar = 0, role = ROLES[0], group = '' }) {
  const s = load();
  const clean = String(name || '').trim().slice(0, 24) || 'Cadet';
  const id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  s.profiles[id] = { id, name: clean, avatar: Number(avatar) % AVATARS, role, group: String(group).trim().slice(0, 30),
    created: new Date().toISOString(), xp: 0, runs: [], best: {}, badges: [] };
  if (s.crew.length < 4) s.crew.push(id);
  save(s);
  return s.profiles[id];
}

export function updateProfile(id, patch) {
  const s = load(); if (!s.profiles[id]) return null;
  for (const k of ['name', 'avatar', 'role', 'group']) if (k in patch) s.profiles[id][k] = patch[k];
  save(s); return s.profiles[id];
}

export function deleteProfile(id) {
  const s = load(); delete s.profiles[id]; s.crew = s.crew.filter((c) => c !== id); save(s);
}

export function getCrew() { const s = load(); return s.crew.map((id) => s.profiles[id]).filter(Boolean); }
export function setCrew(ids) { const s = load(); s.crew = ids.filter((id) => s.profiles[id]).slice(0, 4); save(s); }
export function toggleCrew(id) {
  const s = load();
  if (s.crew.includes(id)) s.crew = s.crew.filter((c) => c !== id);
  else if (s.crew.length < 4) s.crew.push(id);
  save(s); return s.crew;
}

/**
 * Record a finished mission for everyone in the crew.
 * run: { mission, world, score, summary, decisions: [string], badges: [string] }
 * Returns per-profile changes so the screen can celebrate level-ups.
 */
export function awardRun(run) {
  const s = load();
  const medal = medalOf(run.score);
  const xp = Math.round(run.score) + { gold: 50, silver: 25, bronze: 10, none: 0 }[medal] + (run.badges?.length || 0) * 15;
  const changes = [];
  for (const id of s.crew) {
    const p = s.profiles[id]; if (!p) continue;
    const before = levelOf(p.xp);
    p.xp += xp;
    p.runs.unshift({ at: new Date().toISOString(), mission: run.mission, world: run.world, score: Math.round(run.score), medal, summary: run.summary || '', decisions: (run.decisions || []).slice(0, 8) });
    p.runs = p.runs.slice(0, 20);
    const key = `${run.mission}:${run.world}`;
    if (!p.best[key] || p.best[key].score < run.score) p.best[key] = { score: Math.round(run.score), medal };
    const fresh = (run.badges || []).filter((b) => !p.badges.includes(b));
    p.badges.push(...fresh);
    const after = levelOf(p.xp);
    changes.push({ id, name: p.name, xp, medal, levelUp: after.level > before.level ? after : null, newBadges: fresh });
  }
  save(s);
  return { xp, medal, changes };
}

/** CSV of every profile on this device, for teachers. */
export function exportCSV() {
  const rows = [['name', 'group', 'role', 'level', 'rank', 'xp', 'runs', 'mission', 'world', 'score', 'medal', 'date', 'summary']];
  for (const p of listProfiles()) {
    const lv = levelOf(p.xp);
    if (!p.runs.length) rows.push([p.name, p.group, p.role, lv.level, lv.rank, p.xp, 0, '', '', '', '', '', '']);
    for (const r of p.runs) rows.push([p.name, p.group, p.role, lv.level, lv.rank, p.xp, p.runs.length, r.mission, r.world, r.score, r.medal, r.at.slice(0, 16).replace('T', ' '), r.summary]);
  }
  return rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
}

export function resetAll() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }
