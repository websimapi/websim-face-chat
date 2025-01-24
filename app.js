// Settings variables
let settings = {
  lineColor: '#00ff00',
  lineWidth: 2,
  glowIntensity: 10
};

// DOM Elements
const videoElement = document.getElementById('input');
const canvasElement = document.getElementById('output');
const canvasCtx = canvasElement.getContext('2d');
const settingsModal = document.getElementById('settings-modal');
const container = document.querySelector('.container');
const drawingModeToggle = document.getElementById('drawingMode');
const drawingControls = document.querySelector('.drawing-controls');
const drawingColorInput = document.getElementById('drawingColor');
const drawingWidthInput = document.getElementById('drawingWidth');
const drawingWidthValue = document.getElementById('drawingWidthValue');
const clearDrawingBtn = document.getElementById('clearDrawing');

// Create a new canvas for drawing
const drawingCanvas = document.createElement('canvas');
drawingCanvas.id = 'drawingCanvas';
container.appendChild(drawingCanvas);
const drawingCtx = drawingCanvas.getContext('2d');

// Settings inputs
const lineColorInput = document.getElementById('lineColor');
const lineWidthInput = document.getElementById('lineWidth');
const lineWidthValue = document.getElementById('lineWidthValue');
const glowIntensityInput = document.getElementById('glowIntensity');
const glowIntensityValue = document.getElementById('glowIntensityValue');
const backgroundPromptInput = document.getElementById('backgroundPrompt');
const startButton = document.getElementById('startButton');

let room = null;

// Settings event listeners
lineColorInput.addEventListener('input', (e) => settings.lineColor = e.target.value);
lineWidthInput.addEventListener('input', (e) => {
  settings.lineWidth = e.target.value;
  lineWidthValue.textContent = e.target.value;
});
glowIntensityInput.addEventListener('input', (e) => {
  settings.glowIntensity = e.target.value;
  glowIntensityValue.textContent = e.target.value;
});

let imageCounter = 0;

function loadBackgroundImage(prompt) {
  // Remove any existing background images
  document.querySelectorAll('[id^="background-image-"]').forEach(img => img.remove());

  // Create new unique image element
  const backgroundImg = document.createElement('img');
  const uniqueId = `background-image-${imageCounter++}`;
  backgroundImg.id = uniqueId;
  backgroundImg.alt = prompt;
  backgroundImg.src = `https://source.unsplash.com/1920x1080/?${encodeURIComponent(prompt)}`;
  
  // Add loaded class when image is loaded
  backgroundImg.onload = () => {
    backgroundImg.classList.add('loaded');
  };
  
  document.body.insertBefore(backgroundImg, document.body.firstChild);
}

startButton.addEventListener('click', async () => {
  settingsModal.style.display = 'none';
  container.style.display = 'block';
  
  if (backgroundPromptInput.value.trim()) {
    loadBackgroundImage(backgroundPromptInput.value.trim());
  }
  
  room = new WebsimSocket();
  setupMultiplayer();
  
  camera.start();
});

function setupMultiplayer() {
  const playerList = document.getElementById('playerList');
  
  // Update player list when peers change
  room.party.subscribe((peers) => {
    playerList.innerHTML = '';
    for (const clientId in peers) {
      const { avatarUrl, username } = peers[clientId];
      const playerItem = document.createElement('div');
      playerItem.className = 'player-item';
      playerItem.innerHTML = `
        <img class="player-avatar" src="${avatarUrl}" alt="${username}">
        <span>${username}</span>
      `;
      // Add a canvas for this player's face mesh
      const playerCanvas = document.createElement('canvas');
      playerCanvas.className = 'remote-face-mesh';
      playerCanvas.id = `face-mesh-${clientId}`;
      playerCanvas.width = window.innerWidth;
      playerCanvas.height = window.innerHeight;
      document.querySelector('.container').appendChild(playerCanvas);
      
      playerList.appendChild(playerItem);
    }
  });

  // Clean up disconnected player canvases
  room.onmessage = (event) => {
    const data = event.data;
    switch (data.type) {
      case 'disconnected':
        const disconnectedCanvas = document.getElementById(`face-mesh-${data.clientId}`);
        if (disconnectedCanvas) {
          disconnectedCanvas.remove();
        }
        break;
      case 'faceMeshUpdate':
        if (data.clientId !== room.party.client.id) {
          updateRemoteFaceMesh(data);
        }
        break;
      case 'userSettings':
        updateOtherUserSettings(data);
        break;
      case 'drawingUpdate':
        if (data.clientId !== room.party.client.id) {
          updateRemoteDrawing(data);
        }
        break;
    }
  };

  // Send initial settings when joining
  room.send({
    type: 'userSettings',
    clientId: room.party.client.id,
    settings: {
      lineColor: settings.lineColor,
      glowIntensity: settings.glowIntensity
    }
  });

  // Send settings updates when they change
  lineColorInput.addEventListener('change', () => {
    room.send({
      type: 'userSettings',
      clientId: room.party.client.id,
      settings: {
        lineColor: settings.lineColor,
        glowIntensity: settings.glowIntensity
      }
    });
  });

  glowIntensityInput.addEventListener('change', () => {
    room.send({
      type: 'userSettings',
      clientId: room.party.client.id,
      settings: {
        lineColor: settings.lineColor,
        glowIntensity: settings.glowIntensity
      }
    });
  });
}

// Store other users' settings
const userSettings = new Map();
const userDrawings = new Map(); // Store drawings for each user

function updateOtherUserSettings(data) {
  userSettings.set(data.clientId, data.settings);
}

function updateRemoteFaceMesh(data) {
  const remoteCanvas = document.getElementById(`face-mesh-${data.clientId}`);
  if (!remoteCanvas) return;
  
  const remoteCtx = remoteCanvas.getContext('2d');
  remoteCtx.clearRect(0, 0, remoteCanvas.width, remoteCanvas.height);
  
  // Use received settings if available, otherwise generate from client ID
  let userColor, userGlow;
  if (data.settings) {
    userSettings.set(data.clientId, data.settings);
  }
  
  const savedSettings = userSettings.get(data.clientId);
  if (savedSettings) {
    userColor = savedSettings.lineColor;
    userGlow = savedSettings.glowIntensity;
  } else {
    userColor = `hsla(${(parseInt(data.clientId, 36) % 360)}, 100%, 50%, 0.5)`;
    userGlow = settings.glowIntensity;
  }
  
  // Draw face mesh using the received landmarks and user settings
  remoteCtx.lineWidth = settings.lineWidth;
  remoteCtx.strokeStyle = userColor;
  remoteCtx.shadowColor = userColor;
  remoteCtx.shadowBlur = userGlow;
  
  // Draw face outline
  drawConnectors(data.landmarks, FACEMESH_FACE_OVAL, userColor, settings.lineWidth, remoteCtx);

  // Draw facial features with user's settings
  drawFacialFeature(data.landmarks, FACE_CONNECTIONS.leftEye, userColor, settings.lineWidth, remoteCtx);
  drawFacialFeature(data.landmarks, FACE_CONNECTIONS.rightEye, userColor, settings.lineWidth, remoteCtx);
  drawFacialFeature(data.landmarks, FACE_CONNECTIONS.leftEyebrow, userColor, settings.lineWidth, remoteCtx);
  drawFacialFeature(data.landmarks, FACE_CONNECTIONS.rightEyebrow, userColor, settings.lineWidth, remoteCtx);
  drawFacialFeature(data.landmarks, FACE_CONNECTIONS.nose, userColor, settings.lineWidth, remoteCtx);
  drawFacialFeature(data.landmarks, FACE_CONNECTIONS.lipsOuter, userColor, settings.lineWidth, remoteCtx);
  drawFacialFeature(data.landmarks, FACE_CONNECTIONS.lipsInner, userColor, settings.lineWidth, remoteCtx);
}

function updateRemoteDrawing(data) {
  const remoteCanvas = document.getElementById(`face-mesh-${data.clientId}`);
  if (!remoteCanvas) return;
  
  userDrawings.set(data.clientId, data.drawingData);
  const remoteCtx = remoteCanvas.getContext('2d');
  
  // Only draw if we have face bounds
  if (data.faceBounds) {
    remoteCtx.clearRect(0, 0, remoteCanvas.width, remoteCanvas.height);
    remoteCtx.save();
    
    // Transform drawing to match received face bounds
    remoteCtx.translate(data.faceBounds.left, data.faceBounds.top);
    remoteCtx.scale(data.faceBounds.width, data.faceBounds.height);
    
    const img = new Image();
    img.onload = () => {
      remoteCtx.drawImage(img, 0, 0, 1, 1);
      remoteCtx.restore();
    };
    img.src = data.drawingData;
  }
}

// Modified drawing state
let isDrawing = false;
let drawingEnabled = true; // Always enabled now
let lastX = 0;
let lastY = 0;
let drawingBounds = { left: 0, top: 0, width: 0, height: 0 }; // Track face bounds for drawing

// Create drawing buffer canvas
const drawingBuffer = document.createElement('canvas');
drawingBuffer.width = 1000; // Fixed size buffer for high quality
drawingBuffer.height = 1000;
const bufferCtx = drawingBuffer.getContext('2d');
bufferCtx.lineCap = 'round';
bufferCtx.lineJoin = 'round';

// Drawing settings
const drawingSettings = {
  color: '#ff0000',
  width: 5
};

// Event listeners for drawing controls
drawingColorInput.addEventListener('input', (e) => {
  drawingSettings.color = e.target.value;
});

drawingWidthInput.addEventListener('input', (e) => {
  drawingSettings.width = e.target.value;
  drawingWidthValue.textContent = e.target.value;
});

clearDrawingBtn.addEventListener('click', clearDrawing);

// Drawing event handlers
drawingCanvas.addEventListener('mousedown', startDrawing);
drawingCanvas.addEventListener('mousemove', draw);
drawingCanvas.addEventListener('mouseup', stopDrawing);
drawingCanvas.addEventListener('mouseleave', stopDrawing);

// Touch support
drawingCanvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  startDrawing(e);
});
drawingCanvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  draw(e);
});
drawingCanvas.addEventListener('touchend', stopDrawing);
drawingCanvas.addEventListener('touchcancel', stopDrawing);

function stopDrawing() {
  isDrawing = false;
}

function startDrawing(e) {
  if (!drawingEnabled) return;
  isDrawing = true;
  const rect = drawingCanvas.getBoundingClientRect();
  // Adjust for mirroring
  lastX = rect.width - ((e.clientX || e.touches[0].clientX) - rect.left);
  lastY = (e.clientY || e.touches[0].clientY) - rect.top;
}

function clearDrawing() {
  bufferCtx.clearRect(0, 0, drawingBuffer.width, drawingBuffer.height);
  drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
  
  if (room) {
    room.send({
      type: 'drawingUpdate',
      clientId: room.party.client.id,
      drawingData: drawingBuffer.toDataURL(),
      faceBounds: drawingBounds
    });
  }
}

function draw(e) {
  if (!isDrawing || !drawingEnabled) return;
  
  e.preventDefault();
  
  // Convert mouse/touch coordinates to relative position within face bounds
  const rect = drawingCanvas.getBoundingClientRect();
  
  // Adjust for mirroring by inverting the x coordinate
  const x = rect.width - ((e.clientX || e.touches[0].clientX) - rect.left);
  const y = (e.clientY || e.touches[0].clientY) - rect.top;
  
  // Convert to relative coordinates (0-1 range)
  const relativeX = (x - drawingBounds.left) / drawingBounds.width;
  const relativeY = (y - drawingBounds.top) / drawingBounds.height;
  
  const lastRelativeX = (lastX - drawingBounds.left) / drawingBounds.width;
  const lastRelativeY = (lastY - drawingBounds.top) / drawingBounds.height;
  
  // Draw in buffer (normalized 0-1 space)
  bufferCtx.beginPath();
  bufferCtx.moveTo(lastRelativeX * 1000, lastRelativeY * 1000);
  bufferCtx.lineTo(relativeX * 1000, relativeY * 1000);
  bufferCtx.strokeStyle = drawingSettings.color;
  bufferCtx.lineWidth = drawingSettings.width * 2;
  bufferCtx.stroke();
  
  // Draw on screen
  drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
  drawingCtx.save();
  drawingCtx.translate(drawingBounds.left, drawingBounds.top);
  drawingCtx.scale(drawingBounds.width, drawingBounds.height);
  drawingCtx.drawImage(drawingBuffer, 0, 0, 1000, 1000, 0, 0, 1, 1);
  drawingCtx.restore();
  
  // Broadcast drawing update
  if (room) {
    room.send({
      type: 'drawingUpdate',
      clientId: room.party.client.id,
      drawingData: drawingBuffer.toDataURL(),
      faceBounds: drawingBounds
    });
  }
  
  [lastX, lastY] = [x, y];
}

// Helper function to get face bounds from landmarks
function getFaceBounds(landmarks) {
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  landmarks.forEach(point => {
    const x = point.x * canvasElement.width;
    const y = point.y * canvasElement.height;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  });

  // Add padding around face
  const padding = 50;
  return {
    left: minX - padding,
    top: minY - padding,
    width: (maxX - minX) + (padding * 2),
    height: (maxY - minY) + (padding * 2)
  };
}

function onResults(results) {
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  if (results.multiFaceLandmarks) {
    for (const landmarks of results.multiFaceLandmarks) {
      const smoothedLandmarks = smoothLandmarks(landmarks, previousLandmarks);
      previousLandmarks = smoothedLandmarks;

      // Update drawing bounds based on face position
      drawingBounds = getFaceBounds(smoothedLandmarks);
      
      // Update drawing position based on face bounds
      drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
      drawingCtx.save();
      drawingCtx.translate(drawingBounds.left, drawingBounds.top);
      drawingCtx.scale(drawingBounds.width, drawingBounds.height);
      drawingCtx.drawImage(drawingBuffer, 0, 0, 1000, 1000, 0, 0, 1, 1);
      drawingCtx.restore();

      canvasCtx.lineWidth = settings.lineWidth;
      canvasCtx.strokeStyle = settings.lineColor;
      canvasCtx.shadowColor = settings.lineColor;
      canvasCtx.shadowBlur = settings.glowIntensity;
      
      // Draw face outline
      drawConnectors(smoothedLandmarks, FACEMESH_FACE_OVAL, settings.lineColor, settings.lineWidth, canvasCtx);

      // Draw facial features
      drawFacialFeature(smoothedLandmarks, FACE_CONNECTIONS.leftEye, settings.lineColor, settings.lineWidth, canvasCtx);
      drawFacialFeature(smoothedLandmarks, FACE_CONNECTIONS.rightEye, settings.lineColor, settings.lineWidth, canvasCtx);
      drawFacialFeature(smoothedLandmarks, FACE_CONNECTIONS.leftEyebrow, settings.lineColor, settings.lineWidth, canvasCtx);
      drawFacialFeature(smoothedLandmarks, FACE_CONNECTIONS.rightEyebrow, settings.lineColor, settings.lineWidth, canvasCtx);
      drawFacialFeature(smoothedLandmarks, FACE_CONNECTIONS.nose, settings.lineColor, settings.lineWidth, canvasCtx);
      drawFacialFeature(smoothedLandmarks, FACE_CONNECTIONS.lipsOuter, settings.lineColor, settings.lineWidth, canvasCtx);
      drawFacialFeature(smoothedLandmarks, FACE_CONNECTIONS.lipsInner, settings.lineColor, settings.lineWidth, canvasCtx);

      // Sync face mesh data in multiplayer mode
      if (room) {
        room.send({
          type: 'faceMeshUpdate',
          landmarks: smoothedLandmarks,
          clientId: room.party.client.id,
          username: room.party.client.username,
          settings: {
            lineColor: settings.lineColor,
            glowIntensity: settings.glowIntensity
          },
          faceBounds: drawingBounds
        });
      }
    }
  }
  canvasCtx.restore();
}

// Facial feature connections
const FACE_CONNECTIONS = {
  leftEye: [
    [263, 249], [249, 390], [390, 373], [373, 374], [374, 380], 
    [380, 381], [381, 382], [382, 362], [263, 466], [466, 388], 
    [388, 387], [387, 386], [386, 385], [385, 384], [384, 398], [398, 362]
  ],
  rightEye: [
    [33, 7], [7, 163], [163, 144], [144, 145], [145, 153], 
    [153, 154], [154, 155], [155, 133], [33, 246], [246, 161], 
    [161, 160], [160, 159], [159, 158], [158, 157], [157, 173], [173, 133]
  ],
  leftEyebrow: [
    [70, 63], [63, 105], [105, 66], [66, 107], [107, 55], [55, 65], [65, 52], 
    [52, 53], [53, 46]
  ],
  rightEyebrow: [
    [300, 293], [293, 334], [334, 296], [296, 336], [336, 285], [285, 295], 
    [295, 282], [282, 283], [283, 276]
  ],
  nose: [
    [168, 6], [6, 197], [197, 195], [195, 5], [5, 4], [4, 1], [1, 19], 
    [19, 94], [94, 2], [2, 164]
  ],
  lipsOuter: [
    [61, 146], [146, 91], [91, 181], [181, 84], [84, 17], [17, 314], [314, 405], 
    [405, 321], [321, 375], [375, 291], [61, 185], [185, 40], [40, 39], [39, 37],
    [37, 0], [0, 267], [267, 269], [269, 270], [270, 409], [409, 291]
  ],
  lipsInner: [
    [78, 95], [95, 88], [88, 178], [178, 87], [87, 14], [14, 317], [317, 402], 
    [402, 318], [318, 324], [324, 308], [78, 191], [191, 80], [80, 81], [81, 82],
    [82, 13], [13, 312], [312, 311], [311, 310], [310, 415], [415, 308]
  ]
};

// Face contours for the main outline
const FACEMESH_FACE_OVAL = [
  [10, 338], [338, 297], [297, 332], [332, 284], [284, 251], [251, 389],
  [389, 356], [356, 454], [454, 323], [323, 361], [361, 288], [288, 397],
  [397, 365], [365, 379], [379, 378], [378, 400], [400, 377], [377, 152],
  [152, 148], [148, 176], [176, 149], [149, 150], [150, 136], [136, 172],
  [172, 58], [58, 132], [132, 93], [93, 234], [234, 127], [127, 162],
  [162, 21], [21, 54], [54, 103], [103, 67], [67, 109], [109, 10]
];

let previousLandmarks = null;
const smoothingFactor = 0.5;

// Update how drawing canvas is initialized
function onResize() {
  canvasElement.width = window.innerWidth;
  canvasElement.height = window.innerHeight;
  drawingCanvas.width = window.innerWidth;
  drawingCanvas.height = window.innerHeight;
  drawingCanvas.classList.add('drawing-mode'); // Always in drawing mode
  drawingControls.style.display = 'block'; // Always show controls
  // Redraw user drawing after resize
  if (drawingBuffer.toDataURL()) {
    drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
    drawingCtx.save();
    drawingCtx.translate(drawingBounds.left, drawingBounds.top);
    drawingCtx.scale(drawingBounds.width, drawingBounds.height);
    drawingCtx.drawImage(drawingBuffer, 0, 0, 1000, 1000, 0, 0, 1, 1);
    drawingCtx.restore();
  }
}

window.addEventListener('resize', onResize);
onResize();

function smoothLandmarks(currentLandmarks, previousLandmarks) {
  if (!previousLandmarks) return currentLandmarks;
  
  return currentLandmarks.map((landmark, i) => ({
    x: previousLandmarks[i].x + (landmark.x - previousLandmarks[i].x) * smoothingFactor,
    y: previousLandmarks[i].y + (landmark.y - previousLandmarks[i].y) * smoothingFactor,
    z: previousLandmarks[i].z + (landmark.z - previousLandmarks[i].z) * smoothingFactor
  }));
}

function drawConnectors(landmarks, connections, color, width, ctx = canvasCtx) {
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  
  connections.forEach(([i, j]) => {
    const start = landmarks[i];
    const end = landmarks[j];
    
    ctx.beginPath();
    ctx.moveTo(start.x * canvasElement.width, start.y * canvasElement.height);
    ctx.lineTo(end.x * canvasElement.width, end.y * canvasElement.height);
    ctx.stroke();
  });
}

function drawFacialFeature(landmarks, connections, color, width, ctx = canvasCtx) {
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 5;
  
  connections.forEach(([i, j]) => {
    const start = landmarks[i];
    const end = landmarks[j];
    
    ctx.beginPath();
    ctx.moveTo(start.x * canvasElement.width, start.y * canvasElement.height);
    ctx.lineTo(end.x * canvasElement.width, end.y * canvasElement.height);
    ctx.stroke();
  });
}

const faceMesh = new FaceMesh({
  locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
  }
});

faceMesh.setOptions({
  maxNumFaces: 1,
  refineLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

faceMesh.onResults(onResults);

const camera = new Camera(videoElement, {
  onFrame: async () => {
    await faceMesh.send({image: videoElement});
  },
  width: 1280,
  height: 720,
  facingMode: 'user'
});