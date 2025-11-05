const video = document.getElementById('inputVideo');
const canvas = document.getElementById('outputCanvas');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');
const downloadBtn = document.getElementById('downloadBtn');
const loadingEl = document.getElementById('loading');
const permissionEl = document.getElementById('permission');
document.getElementById('year').textContent = new Date().getFullYear();

let cameraInstance = null;
let streamInstance = null;

const grid = document.getElementById('accessoryGrid');
let current = null;
let images = {};
for (const acc of window.APP_ACCESSORIES) {
  const el = document.createElement('button');
  el.className = 'item';
  el.innerHTML = `<img alt="" src="${acc.src}"/><span class="label">${acc.label}</span>`;
  el.addEventListener('click', () => selectAccessory(acc.id));
  el.dataset.id = acc.id;
  grid.appendChild(el);

  const img = new Image(); img.src = acc.src; images[acc.id] = { meta: acc, img };
}
selectAccessory(window.APP_ACCESSORIES[0].id);

function selectAccessory(id) {
  current = images[id];
  for (const node of grid.querySelectorAll('.item')) {
    node.classList.toggle('active', node.dataset.id === id);
  }
}

startBtn.addEventListener('click', async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
    video.srcObject = stream;
    streamInstance = stream;
    await video.play();
    permissionEl.style.display = 'none';
    initFaceMesh();
  } catch (e) {
    alert('Camera permission is required for the try-on.');
    console.error(e);
  }
});

resetBtn.addEventListener('click', () => {
  if (streamInstance) {
    streamInstance.getTracks().forEach(t => t.stop());
    video.srcObject = null;
  }
  ctx.clearRect(0,0,canvas.width,canvas.height);
  permissionEl.style.display = 'grid';
});

downloadBtn.addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = 'snapshot.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
});

function initFaceMesh() {
  loadingEl.style.display = 'grid';
  const faceMesh = new FaceMesh({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
  });
  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  faceMesh.onResults(onResults);

  cameraInstance = new Camera(video, {
    onFrame: async () => { await faceMesh.send({ image: video }); },
    width: 640,
    height: 480,
  });
  cameraInstance.start();
}

function onResults(results) {
  if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
    drawFrame(null);
    return;
  }
  drawFrame(results.multiFaceLandmarks[0]);
}

function drawFrame(landmarks) {
  loadingEl.style.display = 'none';
  const vw = video.videoWidth || 640;
  const vh = video.videoHeight || 480;
  if (canvas.width !== vw || canvas.height !== vh) {
    canvas.width = vw; canvas.height = vh;
  }
  ctx.save();
  ctx.clearRect(0,0,canvas.width, canvas.height);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  if (landmarks && current) {
    const toPx = (i) => ({ x: landmarks[i].x * canvas.width, y: landmarks[i].y * canvas.height });
    if (current.meta.type === 'glasses') {
      const L = toPx(33), R = toPx(263), N = toPx(168);
      drawAccessoryBetween(L, R, N, current.img, 1.4, 0.55);
    } else if (current.meta.type === 'hat') {
      const L = toPx(127), R = toPx(356), F = toPx(10);
      drawHat(F, L, R, current.img);
    } else if (current.meta.type === 'ear') {
      const L = toPx(234), R = toPx(454);
      drawEarrings(L, R, current.img);
    }
  }

  // 🔽 Apply Selected Filter
  applyCurrentFilter();
  // 🔼 End Filter

  ctx.restore();
}

function drawAccessoryBetween(L, R, N, img, scaleX = 1.4, scaleY = 0.5) {
  const dx = R.x - L.x, dy = R.y - L.y;
  const dist = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);
  const cx = (L.x + R.x) / 2;
  const cy = (L.y + R.y) / 2;
  const w = dist * scaleX;
  const h = dist * scaleY;
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  const oy = (N.y - cy) * 0.15;
  ctx.drawImage(img, -w/2, -h/2 + oy, w, h);
  ctx.setTransform(1,0,0,1,0,0);
}

function drawHat(F, L, R, img) {
  const dx = R.x - L.x, dy = R.y - L.y;
  const baseWidth = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);
  const centerX = (L.x + R.x) / 2;

  const hatWidth = baseWidth * 1.18;
  const hatHeight = hatWidth * 0.9;
  const y = F.y;

  ctx.save();
  ctx.translate(centerX, y);
  ctx.rotate(angle);
  ctx.drawImage(img, -hatWidth/2, -hatHeight, hatWidth, hatHeight);
  ctx.restore();
}

function drawEarrings(L, R, img) {
  const size = 40;
  const offset = 25;
  [L,R].forEach(P => {
    ctx.save();
    ctx.translate(P.x, P.y+offset);
    ctx.drawImage(img, -size/2, -size/2, size, size);
    ctx.restore();
  });
}

// ===================================================
// 🔽 FILTER SECTION ADDED
// ===================================================

let currentFilter = 'none';

function applyFilter(name) {
  currentFilter = name;
}

function applyCurrentFilter() {
  if (currentFilter === 'none') return;

  const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = frame.data;

  if (currentFilter === 'grayscale') {
    for (let i = 0; i < d.length; i += 4) {
      const avg = (d[i] + d[i + 1] + d[i + 2]) / 3;
      d[i] = d[i + 1] = d[i + 2] = avg;
    }
  } else if (currentFilter === 'sepia') {
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      d[i] = 0.393*r + 0.769*g + 0.189*b;
      d[i + 1] = 0.349*r + 0.686*g + 0.168*b;
      d[i + 2] = 0.272*r + 0.534*g + 0.131*b;
    }
  } else if (currentFilter === 'invert') {
    for (let i = 0; i < d.length; i += 4) {
      d[i] = 255 - d[i];
      d[i + 1] = 255 - d[i + 1];
      d[i + 2] = 255 - d[i + 2];
    }
  } else if (currentFilter === 'edge') {
    // Simple edge detection using brightness threshold
    const gray = new Uint8ClampedArray(d.length / 4);
    for (let i = 0; i < d.length; i += 4) {
      gray[i / 4] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    }
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const i = y * canvas.width + x;
        if (x === 0 || y === 0 || x === canvas.width - 1 || y === canvas.height - 1) continue;
        const gx = gray[i - 1] - gray[i + 1];
        const gy = gray[i - canvas.width] - gray[i + canvas.width];
        const mag = Math.sqrt(gx * gx + gy * gy);
        const val = mag > 40 ? 255 : 0;
        d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = val;
      }
    }
  }

  ctx.putImageData(frame, 0, 0);
}
// ===================================================
// 🔼 END FILTER SECTION
// ===================================================
