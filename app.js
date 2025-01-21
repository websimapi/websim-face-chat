// Settings variables
let settings = {
  lineColor: '#00ff00',
  lineWidth: 2,
  glowIntensity: 10
};

// DOM Elements
let videoElement, canvasElement, canvasCtx, settingsModal, container;
let lineColorInput, lineWidthInput, lineWidthValue, glowIntensityInput, glowIntensityValue;
let backgroundPromptInput, startButton, multiplayerModeCheckbox;

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
  // Initialize DOM elements
  videoElement = document.getElementById('input');
  canvasElement = document.getElementById('output');
  canvasCtx = canvasElement.getContext('2d');
  settingsModal = document.getElementById('settings-modal');
  container = document.querySelector('.container');

  // Settings inputs
  lineColorInput = document.getElementById('lineColor');
  lineWidthInput = document.getElementById('lineWidth');
  lineWidthValue = document.getElementById('lineWidthValue');
  glowIntensityInput = document.getElementById('glowIntensity');
  glowIntensityValue = document.getElementById('glowIntensityValue');
  backgroundPromptInput = document.getElementById('backgroundPrompt');
  startButton = document.getElementById('startButton');
  multiplayerModeCheckbox = document.getElementById('multiplayerMode');

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

  // Start button event listener
  startButton.addEventListener('click', startApplication);

  // Initialize camera and face mesh after DOM is loaded
  initializeFaceMeshAndCamera();
});

let room = null;
let isMultiplayer = false;
let imageCounter = 0;

async function startApplication() {
  settingsModal.style.display = 'none';
  container.style.display = 'block';
  
  if (backgroundPromptInput.value.trim()) {
    loadBackgroundImage(backgroundPromptInput.value.trim());
  }
  
  isMultiplayer = multiplayerModeCheckbox.checked;
  
  if (isMultiplayer) {
    room = new WebsimSocket();
    setupMultiplayer();
  }
  
  camera.start();
}

function loadBackgroundImage(prompt) {
  // Remove any existing background images
  document.querySelectorAll('[id^="background-image-"]').forEach(img => img.remove());

  // Create new unique image element
  const backgroundImg = document.createElement('img');
  const uniqueId = `background-image-${imageCounter++}`;
  backgroundImg.id = uniqueId;
  backgroundImg.alt = prompt; // Set alt text to exact prompt
  backgroundImg.src = `https://source.unsplash.com/1920x1080/?${encodeURIComponent(prompt)}`;
  
  // Add loaded class when image is loaded
  backgroundImg.onload = () => {
    backgroundImg.classList.add('loaded');
  };
  
  document.body.insertBefore(backgroundImg, document.body.firstChild);
}

let game = null;

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
      case 'scoreUpdate':
        if (game) {
          game.updateGlobalScore(data.score);
        }
        break;
      case 'userSettings':
        updateOtherUserSettings(data);
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

function updateOtherUserSettings(data) {
  userSettings.set(data.clientId, data.settings);
}

function onResults(results) {
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  if (results.multiFaceLandmarks) {
    for (const landmarks of results.multiFaceLandmarks) {
      const smoothedLandmarks = smoothLandmarks(landmarks, previousLandmarks);
      previousLandmarks = smoothedLandmarks;

      canvasCtx.lineWidth = settings.lineWidth;
      canvasCtx.strokeStyle = settings.lineColor;
      canvasCtx.shadowColor = settings.lineColor;
      canvasCtx.shadowBlur = settings.glowIntensity;
      
      // Draw face outline and features with current user's settings
      drawConnectors(smoothedLandmarks, FACEMESH_FACE_OVAL, settings.lineColor, settings.lineWidth, canvasCtx);
      drawFacialFeatures(smoothedLandmarks, settings.lineColor, settings.lineWidth, canvasCtx);

      // Sync face mesh data in multiplayer mode
      if (isMultiplayer && room) {
        // Calculate face bounds for proper scaling
        const bounds = calculateFaceBounds(smoothedLandmarks);
        
        room.send({
          type: 'faceMeshUpdate',
          landmarks: smoothedLandmarks,
          bounds: bounds,
          clientId: room.party.client.id,
          username: room.party.client.username,
          settings: {
            lineColor: settings.lineColor,
            glowIntensity: settings.glowIntensity
          }
        });
      }
    }
  }
  canvasCtx.restore();
}

function calculateFaceBounds(landmarks) {
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;
  
  landmarks.forEach(point => {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  });
  
  return {
    width: maxX - minX,
    height: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2
  };
}

function drawFacialFeatures(landmarks, color, width, ctx) {
  Object.values(FACE_CONNECTIONS).forEach(feature => {
    drawFacialFeature(landmarks, feature, color, width, ctx);
  });
}

function updateRemoteFaceMesh(data) {
  const remoteCanvas = document.getElementById(`face-mesh-${data.clientId}`);
  if (!remoteCanvas) return;
  
  const remoteCtx = remoteCanvas.getContext('2d');
  remoteCtx.clearRect(0, 0, remoteCanvas.width, remoteCanvas.height);
  
  // Get or generate user settings
  let userColor, userGlow;
  const savedSettings = userSettings.get(data.clientId);
  if (savedSettings) {
    userColor = savedSettings.lineColor;
    userGlow = savedSettings.glowIntensity;
  } else {
    userColor = `hsla(${(parseInt(data.clientId, 36) % 360)}, 100%, 50%, 0.5)`;
    userGlow = settings.glowIntensity;
  }
  
  // Scale the landmarks to match the canvas size while maintaining aspect ratio
  const scaledLandmarks = scaleLandmarks(data.landmarks, data.bounds, remoteCanvas);
  
  // Draw the face mesh
  remoteCtx.lineWidth = settings.lineWidth;
  remoteCtx.strokeStyle = userColor;
  remoteCtx.shadowColor = userColor;
  remoteCtx.shadowBlur = userGlow;
  
  drawConnectors(scaledLandmarks, FACEMESH_FACE_OVAL, userColor, settings.lineWidth, remoteCtx);
  drawFacialFeatures(scaledLandmarks, userColor, settings.lineWidth, remoteCtx);
}

function scaleLandmarks(landmarks, bounds, canvas) {
  // Calculate scale factor to maintain aspect ratio
  const scaleX = canvas.width * 0.8; // Use 80% of canvas width
  const scaleY = canvas.height * 0.8; // Use 80% of canvas height
  const scale = Math.min(scaleX / bounds.width, scaleY / bounds.height);
  
  // Center offset
  const offsetX = (canvas.width - bounds.width * scale) / 2;
  const offsetY = (canvas.height - bounds.height * scale) / 2;
  
  return landmarks.map(point => ({
    x: (point.x - bounds.centerX) * scale + canvas.width / 2,
    y: (point.y - bounds.centerY) * scale + canvas.height / 2,
    z: point.z * scale
  }));
}

// Facial feature connections
const FACE_CONNECTIONS = {
  // Left eye remains the same
  leftEye: [
    [263, 249], [249, 390], [390, 373], [373, 374], [374, 380], 
    [380, 381], [381, 382], [382, 362], [263, 466], [466, 388], 
    [388, 387], [387, 386], [386, 385], [385, 384], [384, 398], [398, 362]
  ],
  // Right eye remains the same
  rightEye: [
    [33, 7], [7, 163], [163, 144], [144, 145], [145, 153], 
    [153, 154], [154, 155], [155, 133], [33, 246], [246, 161], 
    [161, 160], [160, 159], [159, 158], [158, 157], [157, 173], [173, 133]
  ],
  // Eyebrows remain the same
  leftEyebrow: [
    [70, 63], [63, 105], [105, 66], [66, 107], [107, 55], [55, 65], [65, 52], 
    [52, 53], [53, 46]
  ],
  rightEyebrow: [
    [300, 293], [293, 334], [334, 296], [296, 336], [336, 285], [285, 295], 
    [295, 282], [282, 283], [283, 276]
  ],
  // Updated nose to remove connection to lips
  nose: [
    [168, 6], [6, 197], [197, 195], [195, 5], [5, 4], [4, 1], [1, 19], 
    [19, 94], [94, 2], [2, 164]  // Removed the [164, 0] connection that went to lips
  ],
  // Lips remain the same
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

// Adjust canvas size to match viewport
function onResize() {
  if (!canvasElement) {
    // Safety check - if canvas isn't loaded yet, try to get it
    canvasElement = document.getElementById('output');
    if (!canvasElement) return; // Exit if still not found
  }
  
  canvasElement.width = window.innerWidth;
  canvasElement.height = window.innerHeight;
  
  // Also resize any remote player canvases
  document.querySelectorAll('.remote-face-mesh').forEach(canvas => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  });
}

// Only add resize listener after DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Add resize listener
  window.addEventListener('resize', onResize);
  // Initial resize
  onResize();
});

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

let faceMesh, camera;

function initializeFaceMeshAndCamera() {
  faceMesh = new FaceMesh({
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

  camera = new Camera(videoElement, {
    onFrame: async () => {
      await faceMesh.send({image: videoElement});
    },
    width: 1280,
    height: 720,
    facingMode: 'user'
  });
}