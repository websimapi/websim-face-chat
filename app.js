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

// Settings inputs
const lineColorInput = document.getElementById('lineColor');
const lineWidthInput = document.getElementById('lineWidth');
const lineWidthValue = document.getElementById('lineWidthValue');
const glowIntensityInput = document.getElementById('glowIntensity');
const glowIntensityValue = document.getElementById('glowIntensityValue');
const backgroundPromptInput = document.getElementById('backgroundPrompt');
const startButton = document.getElementById('startButton');

// Add gameMode checkbox reference
const gameModeCheckbox = document.getElementById('gameMode');
const multiplayerModeCheckbox = document.getElementById('multiplayerMode');
let room = null;
let isMultiplayer = false;
let game = null;

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
  backgroundImg.alt = prompt; // Set alt text to exact prompt
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
  
  isMultiplayer = multiplayerModeCheckbox.checked;
  
  if (isMultiplayer) {
    room = new WebsimSocket();
    setupMultiplayer();
  }
  
  if (gameModeCheckbox.checked) {
    const gameCanvas = document.getElementById('gameCanvas');
    game = new Game(gameCanvas, {
      mouthOpen: false,
      mouthCenter: { x: 0, y: 0 }
    }, isMultiplayer, room);
    game.start();
  }
  
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
      playerList.appendChild(playerItem);
    }
  });

  // Handle face mesh data sync
  room.onmessage = (event) => {
    const data = event.data;
    switch (data.type) {
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
    }
  };
}

function updateRemoteFaceMesh(data) {
  // Draw remote player's face mesh on the canvas
  const remoteCanvas = document.createElement('canvas');
  remoteCanvas.width = canvasElement.width;
  remoteCanvas.height = canvasElement.height;
  const remoteCtx = remoteCanvas.getContext('2d');
  
  // Draw face mesh using the received landmarks
  drawFaceMeshOnContext(remoteCtx, data.landmarks);
  
  // Composite the remote face mesh onto the main canvas
  canvasCtx.globalAlpha = 0.5;
  canvasCtx.drawImage(remoteCanvas, 0, 0);
  canvasCtx.globalAlpha = 1.0;
}

function drawFaceMeshOnContext(ctx, landmarks) {
  ctx.lineWidth = settings.lineWidth;
  ctx.strokeStyle = settings.lineColor;
  ctx.shadowColor = settings.lineColor;
  ctx.shadowBlur = settings.glowIntensity;
  
  // Draw face outline
  drawConnectors(landmarks, FACEMESH_FACE_OVAL, settings.lineColor, settings.lineWidth);

  // Draw facial features
  drawFacialFeature(landmarks, FACE_CONNECTIONS.leftEye, settings.lineColor, settings.lineWidth);
  drawFacialFeature(landmarks, FACE_CONNECTIONS.rightEye, settings.lineColor, settings.lineWidth);
  drawFacialFeature(landmarks, FACE_CONNECTIONS.leftEyebrow, settings.lineColor, settings.lineWidth);
  drawFacialFeature(landmarks, FACE_CONNECTIONS.rightEyebrow, settings.lineColor, settings.lineWidth);
  drawFacialFeature(landmarks, FACE_CONNECTIONS.nose, settings.lineColor, settings.lineWidth);
  drawFacialFeature(landmarks, FACE_CONNECTIONS.lipsOuter, settings.lineColor, settings.lineWidth);
  drawFacialFeature(landmarks, FACE_CONNECTIONS.lipsInner, settings.lineColor, settings.lineWidth);
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
  canvasElement.width = window.innerWidth;
  canvasElement.height = window.innerHeight;
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

function onResults(results) {
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  if (results.multiFaceLandmarks) {
    for (const landmarks of results.multiFaceLandmarks) {
      const smoothedLandmarks = smoothLandmarks(landmarks, previousLandmarks);
      previousLandmarks = smoothedLandmarks;

      // Update game mouth position if game is active
      if (game) {
        // Calculate mouth openness using upper and lower lip landmarks
        const upperLip = smoothedLandmarks[13];
        const lowerLip = smoothedLandmarks[14];
        const mouthDistance = Math.hypot(
          (upperLip.x - lowerLip.x) * canvasElement.width,
          (upperLip.y - lowerLip.y) * canvasElement.height
        );
        
        // Calculate mouth center
        const mouthCenter = {
          x: (upperLip.x + lowerLip.x) / 2 * canvasElement.width,
          y: (upperLip.y + lowerLip.y) / 2 * canvasElement.height
        };
        
        // Update game data
        game.faceMeshData = {
          mouthOpen: mouthDistance > 30, // Adjust threshold as needed
          mouthCenter: mouthCenter
        };
      }

      canvasCtx.lineWidth = settings.lineWidth;
      canvasCtx.strokeStyle = settings.lineColor;
      canvasCtx.shadowColor = settings.lineColor;
      canvasCtx.shadowBlur = settings.glowIntensity;
      
      // Draw face outline
      drawConnectors(smoothedLandmarks, FACEMESH_FACE_OVAL, settings.lineColor, settings.lineWidth);

      // Draw facial features
      drawFacialFeature(smoothedLandmarks, FACE_CONNECTIONS.leftEye, settings.lineColor, settings.lineWidth);
      drawFacialFeature(smoothedLandmarks, FACE_CONNECTIONS.rightEye, settings.lineColor, settings.lineWidth);
      drawFacialFeature(smoothedLandmarks, FACE_CONNECTIONS.leftEyebrow, settings.lineColor, settings.lineWidth);
      drawFacialFeature(smoothedLandmarks, FACE_CONNECTIONS.rightEyebrow, settings.lineColor, settings.lineWidth);
      drawFacialFeature(smoothedLandmarks, FACE_CONNECTIONS.nose, settings.lineColor, settings.lineWidth);
      drawFacialFeature(smoothedLandmarks, FACE_CONNECTIONS.lipsOuter, settings.lineColor, settings.lineWidth);
      drawFacialFeature(smoothedLandmarks, FACE_CONNECTIONS.lipsInner, settings.lineColor, settings.lineWidth);

      // Sync face mesh data in multiplayer mode
      if (isMultiplayer && room) {
        room.send({
          type: 'faceMeshUpdate',
          landmarks: smoothedLandmarks,
          clientId: room.party.client.id,
          username: room.party.client.username
        });
      }
    }
  }
  canvasCtx.restore();
}

function drawConnectors(landmarks, connections, color, width) {
  canvasCtx.lineWidth = width;
  canvasCtx.strokeStyle = color;
  
  connections.forEach(([i, j]) => {
    const start = landmarks[i];
    const end = landmarks[j];
    
    canvasCtx.beginPath();
    canvasCtx.moveTo(start.x * canvasElement.width, start.y * canvasElement.height);
    canvasCtx.lineTo(end.x * canvasElement.width, end.y * canvasElement.height);
    canvasCtx.stroke();
  });
}

function drawFacialFeature(landmarks, connections, color, width) {
  canvasCtx.lineWidth = width;
  canvasCtx.strokeStyle = color;
  canvasCtx.shadowColor = color;
  canvasCtx.shadowBlur = 5;
  
  connections.forEach(([i, j]) => {
    const start = landmarks[i];
    const end = landmarks[j];
    
    canvasCtx.beginPath();
    canvasCtx.moveTo(start.x * canvasElement.width, start.y * canvasElement.height);
    canvasCtx.lineTo(end.x * canvasElement.width, end.y * canvasElement.height);
    canvasCtx.stroke();
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