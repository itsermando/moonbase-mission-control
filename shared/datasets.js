// Where the game's NASA figures and pictures come from, tied to their entries in the NASA Open Data Portal (data.nasa.gov).
// Every catalog entry below was checked against https://data.nasa.gov/api/3/action/package_search on 2026-11-14.
// data.nasa.gov lists these archives as metadata (the entries carry no files); the files live at the landing page shown.
// "license" is exactly what the catalog states. The game's textures and terrain come through NASA Trek, which serves these missions' data.

export const CATALOG_URL = 'https://data.nasa.gov/dataset/';

export const SOURCES = [
  { world: 'Moon', mission: 'Lunar Reconnaissance Orbiter (LOLA, LROC)', usedFor: 'Shackleton terrain, slopes and the Moon globe (via NASA Moon Trek)',
    slug: 'pds-lunar-reconnaissance-orbiter-data-2', title: 'PDS Lunar Reconnaissance Orbiter Data 2', license: 'not specified in the catalog', landing: 'https://pds.jpl.nasa.gov/tools/subscription_service/SS-Release.shtml' },
  { world: 'Mars', mission: 'Mars Global Surveyor (MOLA)', usedFor: 'Mars heights and the Jezero map (via NASA Mars Trek)',
    slug: 'gazetteer-of-planetary-nomenclature-mars-mola-global-images', title: 'Gazetteer of Planetary Nomenclature: Mars: MOLA global images', license: 'not specified in the catalog', landing: 'http://planetarynames.wr.usgs.gov/Page/Images' },
  { world: 'Mars', mission: 'Mars Reconnaissance Orbiter (CTX)', usedFor: 'Jezero crater imagery (via NASA Mars Trek)',
    slug: 'pds-mars-reconnaissance-orbiter-data-9', title: 'PDS Mars Reconnaissance Orbiter Data 9', license: 'not specified in the catalog', landing: 'https://pds.jpl.nasa.gov/tools/subscription_service/SS-Release.shtml' },
  { world: 'Mercury', mission: 'MESSENGER (MDIS)', usedFor: 'The Mercury globe (via NASA Mercury Trek)',
    slug: 'pds-messenger-data-release-1', title: 'PDS MESSENGER Data Release 1', license: 'not specified in the catalog', landing: 'https://pds.jpl.nasa.gov/tools/subscription_service/SS-Release.shtml' },
  { world: 'Ceres', mission: 'Dawn gravity science', usedFor: 'Ceres’s mass and gravity parameter (GM), which set every orbit there',
    slug: 'dawn-ceres-gravity-science-derived-science-data-v3-0', title: 'DAWN CERES GRAVITY SCIENCE DERIVED SCIENCE DATA V3.0', license: 'us-pd (US public domain)', landing: 'https://pds.nasa.gov/ds-view/pds/viewDataset.jsp?dsid=DAWN-A-RSS-5-CEGR-V3.0' },
];

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function sourcesTable() {
  return `<table><tr><th>World</th><th>Mission and what it feeds</th><th>Catalog entry</th><th>Licence listed</th></tr>${SOURCES.map((s) => `<tr>
    <td>${esc(s.world)}</td><td><b>${esc(s.mission)}</b><br>${esc(s.usedFor)}</td>
    <td><a href="${CATALOG_URL}${esc(s.slug)}">${esc(s.title)}</a><br><a class="small" href="${esc(s.landing)}">Archive landing page</a></td><td>${esc(s.license)}</td></tr>`).join('')}</table>`;
}
