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

// Constants for inactivity handling
const INACTIVITY_TIMEOUT = 30000; // 30 seconds in milliseconds
const CLEANUP_INTERVAL = 5000; // Check every 5 seconds

// Map to store last activity timestamps
const lastActivityMap = new Map();

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
  
  // Create container for current user
  createPlayerContainer(room.party.client.id, room.party.client.username);
  
  // Update player list and containers when peers change
  room.party.subscribe((peers) => {
    playerList.innerHTML = '';
    
    // Clean up old containers
    document.querySelectorAll('.player-container').forEach(container => {
      if (!peers[container.dataset.clientId]) {
        container.remove();
      }
    });
    
    for (const clientId in peers) {
      const { avatarUrl, username } = peers[clientId];
      
      // Update last activity timestamp for new peers
      if (!lastActivityMap.has(clientId)) {
        lastActivityMap.set(clientId, Date.now());
      }
      
      // Create player list item
      const playerItem = document.createElement('div');
      playerItem.className = 'player-item';
      playerItem.innerHTML = `
        <img class="player-avatar" src="${avatarUrl}" alt="${username}">
        <span>${username}</span>
      `;
      playerList.appendChild(playerItem);
      
      // Create or update player container
      createPlayerContainer(clientId, username);
    }
  });

  // Clean up disconnected player canvases and handle inactivity
  room.onmessage = (event) => {
    const data = event.data;
    switch (data.type) {
      case 'disconnected':
        cleanupUser(data.clientId);
        break;
      case 'faceMeshUpdate':
        if (data.clientId !== room.party.client.id) {
          updateRemoteFaceMesh(data);
          // Update last activity timestamp
          lastActivityMap.set(data.clientId, Date.now());
        }
        break;
      case 'userSettings':
        updateOtherUserSettings(data);
        break;
      case 'drawingUpdate':
        if (data.clientId !== room.party.client.id) {
          updateRemoteDrawing(data);
          // Update last activity timestamp
          lastActivityMap.set(data.clientId, Date.now());
        }
        break;
      case 'transcription':
        if (data.clientId !== room.party.client.id) {
          addMessageToLog(data.username, data.text);
          playTTS(data.text);
          // Update last activity timestamp
          lastActivityMap.set(data.clientId, Date.now());
        }
        break;
    }
  };

  // Start the inactivity checker
  startInactivityChecker();

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

  setupVoiceChat();
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
  
  // Update canvas dimensions if needed
  if (remoteCanvas.width !== window.innerWidth || remoteCanvas.height !== window.innerHeight) {
    remoteCanvas.width = window.innerWidth;
    remoteCanvas.height = window.innerHeight;
  }
  
  const remoteCtx = remoteCanvas.getContext('2d');
  remoteCtx.clearRect(0, 0, remoteCanvas.width, remoteCanvas.height);
  
  // Use received settings if available
  let userColor, userGlow;
  if (data.settings) {
    userSettings.set(data.clientId, data.settings);
    userColor = data.settings.lineColor;
    userGlow = data.settings.glowIntensity;
  } else {
    const savedSettings = userSettings.get(data.clientId);
    if (savedSettings) {
      userColor = savedSettings.lineColor;
      userGlow = savedSettings.glowIntensity;
    } else {
      userColor = `hsla(${(parseInt(data.clientId, 36) % 360)}, 100%, 50%, 0.5)`;
      userGlow = settings.glowIntensity;
    }
  }
  
  // Draw face mesh
  remoteCtx.lineWidth = settings.lineWidth;
  remoteCtx.strokeStyle = userColor;
  remoteCtx.shadowColor = userColor;
  remoteCtx.shadowBlur = userGlow;
  
  // Draw face outline and features
  drawConnectors(data.landmarks, FACEMESH_FACE_OVAL, userColor, settings.lineWidth, remoteCtx);
  drawFacialFeature(data.landmarks, FACE_CONNECTIONS.leftEye, userColor, settings.lineWidth, remoteCtx);
  drawFacialFeature(data.landmarks, FACE_CONNECTIONS.rightEye, userColor, settings.lineWidth, remoteCtx);
  drawFacialFeature(data.landmarks, FACE_CONNECTIONS.leftEyebrow, userColor, settings.lineWidth, remoteCtx);
  drawFacialFeature(data.landmarks, FACE_CONNECTIONS.rightEyebrow, userColor, settings.lineWidth, remoteCtx);
  drawFacialFeature(data.landmarks, FACE_CONNECTIONS.nose, userColor, settings.lineWidth, remoteCtx);
  drawFacialFeature(data.landmarks, FACE_CONNECTIONS.lipsOuter, userColor, settings.lineWidth, remoteCtx);
  drawFacialFeature(data.landmarks, FACE_CONNECTIONS.lipsInner, userColor, settings.lineWidth, remoteCtx);

  // If there's a stored drawing for this user, render it
  const userDrawing = userDrawings.get(data.clientId);
  if (userDrawing && data.faceBounds) {
    const img = new Image();
    img.onload = () => {
      remoteCtx.save();
      remoteCtx.translate(data.faceBounds.left, data.faceBounds.top);
      remoteCtx.scale(data.faceBounds.width, data.faceBounds.height);
      remoteCtx.drawImage(img, 0, 0, 1, 1);
      remoteCtx.restore();
    };
    img.src = userDrawing;
  }
}

function updateRemoteDrawing(data) {
  // Store the drawing data for this user
  userDrawings.set(data.clientId, data.drawingData);
  
  // Get the canvas for this user
  const remoteCanvas = document.getElementById(`face-mesh-${data.clientId}`);
  if (!remoteCanvas) return;
  
  const remoteCtx = remoteCanvas.getContext('2d');
  
  // Create a new image to draw
  const img = new Image();
  img.onload = () => {
    // Only draw if we have face bounds
    if (data.faceBounds) {
      remoteCtx.save();
      remoteCtx.translate(data.faceBounds.left, data.faceBounds.top);
      remoteCtx.scale(data.faceBounds.width, data.faceBounds.height);
      remoteCtx.drawImage(img, 0, 0, 1, 1);
      remoteCtx.restore();
    }
  };
  img.src = data.drawingData;
}

// Modified drawing state
let isDrawing = false;
let drawingEnabled = true; // Always enabled now
let lastX = 0;
let lastY = 0;
let drawingBounds = { left: 0, top: 0, width: 0, height: 0 }; // Track face bounds for drawing
let currentTranscript = ''; // Add this at the top with other state variables

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
  
  const container = e.target.closest('.player-container');
  const rect = container.getBoundingClientRect();
  
  // Convert to relative coordinates
  lastX = ((e.clientX || e.touches[0].clientX) - rect.left) / rect.width;
  lastY = ((e.clientY || e.touches[0].clientY) - rect.top) / rect.height;
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
  
  const container = e.target.closest('.player-container');
  const rect = container.getBoundingClientRect();
  
  // Convert to relative coordinates
  const x = ((e.clientX || e.touches[0].clientX) - rect.left) / rect.width;
  const y = ((e.clientY || e.touches[0].clientY) - rect.top) / rect.height;
  
  // Draw in buffer
  bufferCtx.beginPath();
  bufferCtx.moveTo(lastX * 1000, lastY * 1000);
  bufferCtx.lineTo(x * 1000, y * 1000);
  bufferCtx.strokeStyle = drawingSettings.color;
  bufferCtx.lineWidth = drawingSettings.width * 2;
  bufferCtx.stroke();
  
  // Draw on screen
  const drawingCtx = document.getElementById(`face-mesh-${room.party.client.id}`).getContext('2d');
  drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
  drawingCtx.save();
  drawingCtx.scale(rect.width, rect.height);
  drawingCtx.drawImage(drawingBuffer, 0, 0, 1000, 1000, 0, 0, 1, 1);
  drawingCtx.restore();
  
  // Send drawing update less frequently
  if (!draw.throttled) {
    draw.throttled = true;
    setTimeout(() => {
      room.send({
        type: 'drawingUpdate',
        clientId: room.party.client.id,
        drawingData: drawingBuffer.toDataURL(),
        timestamp: Date.now()
      });
      draw.throttled = false;
    }, 50); // Throttle to 20fps
  }
  
  [lastX, lastY] = [x, y];
}

function createPlayerContainer(clientId, username) {
  let container = document.querySelector(`.player-container[data-client-id="${clientId}"]`);
  
  if (!container) {
    container = document.createElement('div');
    container.className = 'player-container';
    container.dataset.clientId = clientId;
    
    // Add merge button if not current user
    if (clientId !== room.party.client.id) {
      const mergeButton = document.createElement('button');
      mergeButton.className = 'merge-button';
      mergeButton.textContent = 'Join View';
      mergeButton.onclick = () => mergeWithUser(clientId);
      container.appendChild(mergeButton);
    }
    
    // Create canvas for face mesh
    const canvas = document.createElement('canvas');
    canvas.className = 'remote-face-mesh';
    canvas.id = `face-mesh-${clientId}`;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    container.appendChild(canvas);
    
    document.querySelector('.container').appendChild(container);
  }
  
  return container;
}

function mergeWithUser(targetId) {
  const targetContainer = document.querySelector(`.player-container[data-client-id="${targetId}"]`);
  const currentContainer = document.querySelector(`.player-container[data-client-id="${room.party.client.id}"]`);
  
  if (targetContainer.classList.contains('merged')) {
    // Unmerge
    document.querySelectorAll('.player-container').forEach(container => {
      container.classList.remove('merged');
    });
  } else {
    // Merge
    targetContainer.classList.add('merged');
    currentContainer.classList.add('merged');
  }
}

function updateRemoteDrawing(data) {
  const canvas = document.getElementById(`face-mesh-${data.clientId}`);
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  const img = new Image();
  
  img.onload = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  };
  
  img.src = data.drawingData;
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
  // Update current user's activity timestamp
  if (room && room.party.client.id) {
    lastActivityMap.set(room.party.client.id, Date.now());
  }
  
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
    const landmarks = results.multiFaceLandmarks[0];
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
    
    // Draw face features
    drawConnectors(smoothedLandmarks, FACEMESH_FACE_OVAL, settings.lineColor, settings.lineWidth, canvasCtx);
    drawFacialFeature(smoothedLandmarks, FACE_CONNECTIONS.leftEye, settings.lineColor, settings.lineWidth, canvasCtx);
    drawFacialFeature(smoothedLandmarks, FACE_CONNECTIONS.rightEye, settings.lineColor, settings.lineWidth, canvasCtx);
    drawFacialFeature(smoothedLandmarks, FACE_CONNECTIONS.leftEyebrow, settings.lineColor, settings.lineWidth, canvasCtx);
    drawFacialFeature(smoothedLandmarks, FACE_CONNECTIONS.rightEyebrow, settings.lineColor, settings.lineWidth, canvasCtx);
    drawFacialFeature(smoothedLandmarks, FACE_CONNECTIONS.nose, settings.lineColor, settings.lineWidth, canvasCtx);
    drawFacialFeature(smoothedLandmarks, FACE_CONNECTIONS.lipsOuter, settings.lineColor, settings.lineWidth, canvasCtx);
    drawFacialFeature(smoothedLandmarks, FACE_CONNECTIONS.lipsInner, settings.lineColor, settings.lineWidth, canvasCtx);

    // Sync face mesh and drawing data
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
        faceBounds: drawingBounds,
        drawingData: drawingBuffer.toDataURL()
      });
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

faceMesh.onResults = onResults;

const camera = new Camera(videoElement, {
  onFrame: async () => {
    await faceMesh.send({image: videoElement});
  },
  width: 1280,
  height: 720,
  facingMode: 'user'
});

let isRecording = false;
const voiceButton = document.getElementById('voiceButton');
const hearSelfCheckbox = document.getElementById('hearSelf');
const messageLog = document.getElementById('messageLog');

// Initialize speech synthesis
const synth = window.speechSynthesis;

let voices = [];
const defaultVoice = {
  name: 'Microsoft David - English (United States)',
  fallbacks: [
    'Google US English',
    'en-US',
    'English United States',
    'en_US',
    'English',
    'en'
  ]
};

function populateVoiceSelect() {
  const voiceSelect = document.getElementById('voiceSelect');
  voices = synth.getVoices();
  
  // Clear existing options
  voiceSelect.innerHTML = '';
  
  // Add voices to select, filtering for English voices first
  const englishVoices = voices.filter(voice => 
    voice.lang.toLowerCase().includes('en') ||
    voice.name.toLowerCase().includes('english')
  );
  
  const otherVoices = voices.filter(voice => 
    !voice.lang.toLowerCase().includes('en') &&
    !voice.name.toLowerCase().includes('english')
  );
  
  // Add English voices first
  englishVoices.forEach(voice => {
    const option = document.createElement('option');
    option.value = voice.name;
    option.textContent = `${voice.name} (${voice.lang})`;
    voiceSelect.appendChild(option);
  });
  
  // Add separator if we have both types
  if (englishVoices.length > 0 && otherVoices.length > 0) {
    const separator = document.createElement('option');
    separator.disabled = true;
    separator.textContent = '──────────';
    voiceSelect.appendChild(separator);
  }
  
  // Add other voices
  otherVoices.forEach(voice => {
    const option = document.createElement('option');
    option.value = voice.name;
    option.textContent = `${voice.name} (${voice.lang})`;
    voiceSelect.appendChild(option);
  });
  
  // Try to set default voice using fallbacks
  let selectedVoice = voices.find(v => v.name === defaultVoice.name);
  
  if (!selectedVoice) {
    // Try each fallback until we find a match
    for (const fallback of defaultVoice.fallbacks) {
      selectedVoice = voices.find(v => 
        v.name.toLowerCase().includes(fallback.toLowerCase()) ||
        v.lang.toLowerCase().includes(fallback.toLowerCase())
      );
      if (selectedVoice) break;
    }
  }
  
  // If still no match, use first English voice or first available voice
  if (!selectedVoice) {
    selectedVoice = englishVoices[0] || voices[0];
  }
  
  if (selectedVoice) {
    voiceSelect.value = selectedVoice.name;
  }
}

// Call immediately in case voices are already loaded
async function loadVoices() {
  return new Promise(resolve => {
    if (synth.getVoices().length > 0) {
      resolve();
    } else {
      const intervalId = setInterval(() => {
        if (synth.getVoices().length > 0) {
          clearInterval(intervalId);
          resolve();
        }
      }, 100);
    }
  });
}

loadVoices().then(() => {
  populateVoiceSelect();
});

// Also listen for voices changed event
synth.addEventListener('voiceschanged', populateVoiceSelect);

// Update voice selection in playTTS function
let speechQueue = [];
let isSpeaking = false;

function playTTS(text) {
  speechQueue.push(text);
  
  if (!isSpeaking) {
    processQueue();
  }
}

function processQueue() {
  if (speechQueue.length === 0) {
    isSpeaking = false;
    return;
  }
  
  isSpeaking = true;
  
  synth.cancel();
  
  const text = speechQueue.shift();
  
  const utterance = new SpeechSynthesisUtterance(text);
  
  // Get selected voice with improved fallback handling
  const selectedVoiceName = document.getElementById('voiceSelect').value;
  let selectedVoice = voices.find(v => v.name === selectedVoiceName);
  
  if (!selectedVoice) {
    // Try fallbacks if selected voice isn't available
    for (const fallback of defaultVoice.fallbacks) {
      selectedVoice = voices.find(v => 
        v.name.toLowerCase().includes(fallback.toLowerCase()) ||
        v.lang.toLowerCase().includes(fallback.toLowerCase())
      );
      if (selectedVoice) break;
    }
    
    // Use first English voice or first available as last resort
    if (!selectedVoice) {
      selectedVoice = voices.find(v => v.lang.toLowerCase().includes('en')) || voices[0];
    }
  }
  
  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }
  
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;
  
  utterance.onerror = (event) => {
    console.error('TTS! Error:', event);
    isSpeaking = false;
    processQueue(); // Continue with next item in queue
  };
  
  utterance.onend = () => {
    processQueue();
  };
  
  synth.speak(utterance);
}

// Initialize speech recognition! 
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();
recognition.continuous = true;
recognition.interimResults = true;

// Configure recognition
recognition.lang = 'en-US';

let recognitionActive = false;

async function setupVoiceChat() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // We only need the stream to enable the microphone for speech recognition
    
    // Don't auto-start recognition anymore, wait for button press
    recognitionActive = false;
  } catch (error) {
    console.error('Error accessing microphone:', error);
    alert('Unable to access microphone. Please check permissions.');
  }
}

// Update the speech recognition event handlers
recognition.onresult = (event) => {
  const last = event.results.length - 1;
  const result = event.results[last];
  
  if (result.isFinal) {
    const finalText = result[0].transcript.trim();
    
    // Only send and process if we have text
    if (finalText) {
      // Send the complete transcribed text to peers
      room.send({
        type: 'transcription',
        text: finalText,
        clientId: room.party.client.id,
        username: room.party.client.username
      });
      
      addMessageToLog(room.party.client.username, finalText);
      
      // Play TTS for self if enabled
      if (hearSelfCheckbox.checked) {
        playTTS(finalText);
      }
    }
    
    // Reset the transcript
    currentTranscript = '';
  } else {
    // Accumulate interim results but don't send them
    currentTranscript = result[0].transcript;
  }
};

// Voice button event listeners
voiceButton.addEventListener('pointerdown', () => {
  if (!isRecording) {
    isRecording = true;
    voiceButton.classList.add('recording');
    if (!recognitionActive) {
      recognition.start();
      recognitionActive = true;
    }
  }
});

voiceButton.addEventListener('pointerup', () => {
  if (isRecording) {
    isRecording = false;
    voiceButton.classList.remove('recording');
    if (recognitionActive) {
      recognition.stop();
      recognitionActive = false;
    }
  }
});

// Prevent scrolling when touching the voice button on mobile
voiceButton.addEventListener('touchmove', (e) => {
  e.preventDefault();
});

// Add error handling for recognition
recognition.onerror = (event) => {
  console.error('Speech recognition error:', event);
  recognitionActive = false;
};

recognition.onend = () => {
  recognitionActive = false;
};

function addMessageToLog(username, text) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message';
  messageDiv.innerHTML = `<span class="username">${username}:</span> ${text}`;
  messageLog.appendChild(messageDiv);
  messageLog.scrollTop = messageLog.scrollHeight;
  
  // Keep only last 50 messages
  while (messageLog.children.length > 50) {
    messageLog.removeChild(messageLog.firstChild);
  }
}

function cleanupUser(clientId) {
  // Remove the user's face mesh canvas
  const disconnectedCanvas = document.getElementById(`face-mesh-${clientId}`);
  if (disconnectedCanvas) {
    disconnectedCanvas.remove();
  }
  
  // Remove from activity tracking
  lastActivityMap.delete(clientId);
  
  // Remove from user settings
  userSettings.delete(clientId);
  
  // Remove from user drawings
  userDrawings.delete(clientId);
}

function startInactivityChecker() {
  setInterval(() => {
    const now = Date.now();
    
    // Check each user's last activity
    for (const [clientId, lastActivity] of lastActivityMap.entries()) {
      if (now - lastActivity > INACTIVITY_TIMEOUT) {
        // Remove inactive user
        cleanupUser(clientId);
        
        // Add system message to chat
        addMessageToLog('System', `${room.party.peers[clientId]?.username || 'User'} removed due to inactivity`);
      }
    }
  }, CLEANUP_INTERVAL);
}