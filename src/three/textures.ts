import * as THREE from 'three';

function createCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

export function createBrushedMetalTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(256, 256);
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y++) {
    const shade = 112 + Math.floor((Math.sin(y * 0.7) * 0.5 + 0.5) * 32);
    ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
    ctx.fillRect(0, y, 256, 1);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createDeskGridTexture(
  maxAnisotropy: number,
  darkTheme: boolean,
): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(512, 512);
  ctx.fillStyle = darkTheme ? '#0f172a' : '#e2e8f0';
  ctx.fillRect(0, 0, 512, 512);

  ctx.strokeStyle = darkTheme ? 'rgba(56, 189, 248, 0.14)' : 'rgba(37, 99, 235, 0.12)';
  ctx.lineWidth = 1;
  const step = 32;
  for (let i = 0; i <= 512; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  ctx.strokeStyle = darkTheme ? 'rgba(56, 189, 248, 0.32)' : 'rgba(37, 99, 235, 0.25)';
  ctx.lineWidth = 2;
  ctx.strokeRect(8, 8, 496, 496);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createRadialShadowTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(256, 256);
  const grad = ctx.createRadialGradient(128, 128, 12, 128, 128, 126);
  grad.addColorStop(0, 'rgba(15, 23, 42, 0.58)');
  grad.addColorStop(0.55, 'rgba(15, 23, 42, 0.22)');
  grad.addColorStop(1, 'rgba(15, 23, 42, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createOledScreenTexture(
  modeLabel: string,
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(512, 256);
  ctx.fillStyle = '#091526';
  ctx.fillRect(0, 0, 512, 256);

  ctx.fillStyle = '#1d4ed8';
  ctx.fillRect(0, 0, 512, 52);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('PRINTKAMPUS LASER', 24, 35);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 34px monospace';
  ctx.fillText(modeLabel, 24, 118);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '20px sans-serif';
  ctx.fillText('PDF -> PRINT -> PICK UP', 24, 162);

  // CMYK mini bars
  const bars = ['#06b6d4', '#ec4899', '#eab308', '#334155'];
  bars.forEach((color, idx) => {
    ctx.fillStyle = color;
    ctx.fillRect(24 + idx * 115, 194, 96, 28);
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createPrintedPageTexture(
  isColor: boolean,
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(512, 680);
  ctx.fillStyle = '#fcfcfd';
  ctx.fillRect(0, 0, 512, 680);

  // Header accent
  ctx.fillStyle = isColor ? '#2563eb' : '#1e293b';
  ctx.fillRect(42, 42, 428, 18);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('BAB III — ANALISIS SISTEM', 42, 102);

  ctx.fillStyle = isColor ? '#0ea5e9' : '#64748b';
  ctx.font = '15px sans-serif';
  ctx.fillText('PrintKampus Smart Campus Print Output · A4 80gr', 42, 130);

  // Simulated paragraphs
  ctx.fillStyle = '#334155';
  for (let i = 0; i < 6; i++) {
    const w = i === 5 ? 260 : 420;
    ctx.fillRect(42, 165 + i * 24, w, 10);
  }

  // Bar chart block
  ctx.fillStyle = isColor ? '#eff6ff' : '#f1f5f9';
  ctx.fillRect(42, 330, 428, 175);
  const chartColors = isColor
    ? ['#2563eb', '#06b6d4', '#10b981', '#f59e0b', '#6366f1']
    : ['#1e293b', '#475569', '#64748b', '#94a3b8', '#334155'];
  const heights = [80, 128, 102, 145, 118];
  heights.forEach((h, i) => {
    ctx.fillStyle = chartColors[i];
    ctx.fillRect(72 + i * 78, 485 - h, 46, h);
  });

  // Bottom lines
  ctx.fillStyle = '#475569';
  for (let i = 0; i < 4; i++) {
    const w = i === 3 ? 210 : 420;
    ctx.fillRect(42, 536 + i * 24, w, 10);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createHardcoverTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(512, 680);
  ctx.fillStyle = '#1e3a8a';
  ctx.fillRect(0, 0, 512, 680);

  // Gold foil border
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 6;
  ctx.strokeRect(28, 28, 456, 624);

  ctx.fillStyle = '#fcd34d';
  ctx.textAlign = 'center';
  ctx.font = 'bold 28px serif';
  ctx.fillText('SKRIPSI SARJANA', 256, 130);

  ctx.font = 'bold 20px sans-serif';
  ctx.fillStyle = '#fef3c7';
  ctx.fillText('ANALISIS EKOSISTEM DIGITAL', 256, 220);
  ctx.fillText('PERCETAKAN KAMPUS', 256, 252);

  // Crest emblem
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(256, 390, 52, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#fcd34d';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('UNIVERSITAS', 256, 540);
  ctx.fillText('2026', 256, 575);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}
