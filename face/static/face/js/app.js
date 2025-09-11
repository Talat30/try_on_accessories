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

// function drawHat(F, L, R, img) {
//   const dx = R.x - L.x, dy = R.y - L.y;
//   const earDist = Math.hypot(dx, dy);
//   const angle = Math.atan2(dy, dx);
//   const cx = (L.x + R.x) / 2;
//   const hatWidth = earDist * 1.5;
//   const hatHeight = hatWidth * 0.7;
//   const x = cx;
//   const y = F.y - hatHeight * 0.9;
//   ctx.translate(x, y);
//   ctx.rotate(angle);
//   ctx.drawImage(img, -hatWidth/2, -hatHeight, hatWidth, hatHeight);
//   ctx.setTransform(1,0,0,1,0,0);
// }
// function drawHat(F, L, R, img) {
//   const dx = R.x - L.x, dy = R.y - L.y;
//   const baseWidth = Math.hypot(dx, dy); // width between left and right temple
//   const angle = Math.atan2(dy, dx);
//   const centerX = (L.x + R.x) / 2;

//   // These ratios make the hat fit most faces and sit naturally atop the forehead landmark.
//   const hatWidth = baseWidth * 1.2;    // slightly wider than head
//   const hatHeight = hatWidth * 0.65;   // proportional height
//   const yOffset = hatHeight * 0.45;    // vertical offset above forehead, adjust if needed

//   const x = centerX;                   // center horizontally
//   const y = F.y - yOffset;             // position just above forehead (landmark 10)

//   ctx.save();
//   ctx.translate(x, y);
//   ctx.rotate(angle);
//   ctx.drawImage(img, -hatWidth/2, -hatHeight, hatWidth, hatHeight);
//   ctx.restore();
// }
function drawHat(F, L, R, img) {
  const dx = R.x - L.x, dy = R.y - L.y;
  const baseWidth = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);
  const centerX = (L.x + R.x) / 2;

  // Precise scaling: width covers ear to ear, height proportional for top hats
  const hatWidth = baseWidth * 1.18;
  const hatHeight = hatWidth * 0.9;

  // Place the brim exactly at the top head point (landmark 10)
  const y = F.y;

  ctx.save();
  ctx.translate(centerX, y);
  ctx.rotate(angle);
  // The brim is at y = F.y; so draw the hat upward from there
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
