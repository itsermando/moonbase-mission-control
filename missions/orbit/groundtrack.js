// Ground-track map: the satellite's path over the planet (NASA mosaic), green where the base can talk to it.
const imgs = {};

export function drawGroundTrack(canvas, world, track, { base = '../../', nowIndex = -1 } = {}) {
  const W = 1024, H = 512; canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const X = (lon) => ((lon + 180) / 360) * W, Y = (lat) => ((90 - lat) / 180) * H;
  const paint = () => {
    ctx.fillStyle = '#04050c'; ctx.fillRect(0, 0, W, H);
    const im = imgs[world.id];
    if (im?.complete && im.naturalWidth) { ctx.globalAlpha = 0.85; ctx.drawImage(im, 0, 0, W, H); ctx.globalAlpha = 1; }
    // grid
    ctx.strokeStyle = 'rgba(0,229,255,.18)'; ctx.lineWidth = 1;
    for (let lon = -180; lon <= 180; lon += 30) { ctx.beginPath(); ctx.moveTo(X(lon), 0); ctx.lineTo(X(lon), H); ctx.stroke(); }
    for (let lat = -90; lat <= 90; lat += 30) { ctx.beginPath(); ctx.moveTo(0, Y(lat)); ctx.lineTo(W, Y(lat)); ctx.stroke(); }
    // track (break the line where it wraps around the map edge)
    ctx.lineWidth = 2.2;
    for (let k = 1; k < track.length; k++) {
      const a = track[k - 1], b = track[k];
      if (Math.abs(b.lon - a.lon) > 180) continue;
      ctx.strokeStyle = b.inView ? 'rgba(57,255,159,.95)' : 'rgba(0,229,255,.55)';
      ctx.beginPath(); ctx.moveTo(X(a.lon), Y(a.lat)); ctx.lineTo(X(b.lon), Y(b.lat)); ctx.stroke();
    }
    // base
    const sx = X(0), sy = Y(world.site.latDeg);
    ctx.fillStyle = '#ffd23f'; ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(sx, sy, 7, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    ctx.font = '600 18px "Share Tech Mono", monospace'; ctx.fillText('BASE', sx + 10, sy < 30 ? sy + 22 : sy - 8);
    if (nowIndex >= 0 && track[nowIndex]) {
      const p = track[nowIndex];
      ctx.fillStyle = '#ff2bd6'; ctx.shadowColor = '#ff2bd6'; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.arc(X(p.lon), Y(p.lat), 6, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    }
    ctx.fillStyle = 'rgba(230,241,255,.75)'; ctx.font = '14px "Share Tech Mono", monospace';
    ctx.fillText('GREEN = BASE IN CONTACT   CYAN = OUT OF CONTACT   MAP: NASA ' + world.name.toUpperCase() + ' MOSAIC', 10, H - 10);
  };
  if (!imgs[world.id]) { const im = new Image(); im.src = base + world.texture; im.onload = paint; imgs[world.id] = im; }
  paint();
}
