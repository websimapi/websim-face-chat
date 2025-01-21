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

let objectDetector = null;
let isObjectDetectionEnabled = false;

// Initialize the object detector
async function initializeObjectDetector() {
  try {
    const statusEl = document.getElementById('detectionStatus');
    if (statusEl) statusEl.textContent = 'Initializing...';
    
    const { pipeline } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.6.0');
    objectDetector = await pipeline('object-detection', {
      model: 'Xenova/detr-resnet-50',
      quantized: false
    });
    
    if (statusEl) statusEl.textContent = 'Ready';
    return true;
  } catch (error) {
    console.error('Error initializing object detector:', error);
    const statusEl = document.getElementById('detectionStatus');
    if (statusEl) statusEl.textContent = `Init Error: ${error.message}`;
    return false;
  }
}

function showLoadingIndicator() {
  const loader = document.createElement('div');
  loader.className = 'loading-indicator';
  loader.id = 'loading-indicator';
  loader.textContent = 'Detecting objects...';
  document.body.appendChild(loader);
}

function hideLoadingIndicator() {
  const loader = document.getElementById('loading-indicator');
  if (loader) {
    loader.remove();
  }
}

function clearDetections() {
  const overlay = document.getElementById('detection-overlay');
  overlay.innerHTML = '';
}

let lastDetectionTime = null;
let detectionCount = 0;

// Add this function near other UI-related functions
function createDebugPanel() {
  const panel = document.createElement('div');
  panel.className = 'debug-panel';
  panel.innerHTML = `
    <button class="debug-panel-toggle">⚙️</button>
    <div class="debug-panel-content">
      <h3>Debug Controls</h3>
      <button class="debug-button" id="retryDetection">Retry Object Detection</button>
      <div class="debug-info">
        <p>Last Detection: <span id="lastDetectionTime">Never</span></p>
        <p>Objects Detected: <span id="detectionCount">0</span></p>
        <p>Detection Status: <span id="detectionStatus">Idle</span></p>
      </div>
    </div>
  `;
  
  document.body.appendChild(panel);

  // Toggle panel
  const toggleBtn = panel.querySelector('.debug-panel-toggle');
  toggleBtn.addEventListener('click', () => {
    panel.classList.toggle('collapsed');
  });

  // Retry detection button
  const retryBtn = panel.querySelector('#retryDetection');
  retryBtn.addEventListener('click', async () => {
    const statusEl = document.getElementById('detectionStatus');
    
    if (!isObjectDetectionEnabled) {
      if (statusEl) statusEl.textContent = 'Object detection is disabled';
      return;
    }
    
    if (!objectDetector) {
      if (statusEl) statusEl.textContent = 'Initializing detector...';
      const initialized = await initializeObjectDetector();
      if (!initialized) {
        if (statusEl) statusEl.textContent = 'Failed to initialize detector';
        return;
      }
    }

    const currentBg = document.querySelector('[id^="background-image-"].loaded');
    if (currentBg) {
      await detectObjects(currentBg);
    } else {
      if (statusEl) statusEl.textContent = 'No background image loaded';
    }
  });

  // Initialize collapsed
  panel.classList.add('collapsed');
}

async function detectObjects(imageElement) {
  if (!objectDetector) {
    console.error('Object detector not initialized');
    const statusEl = document.getElementById('detectionStatus');
    if (statusEl) statusEl.textContent = 'Detector not ready';
    return;
  }

  const statusEl = document.getElementById('detectionStatus');
  const timeEl = document.getElementById('lastDetectionTime');
  const countEl = document.getElementById('detectionCount');

  try {
    if (!imageElement.complete || !imageElement.naturalHeight) {
      throw new Error('Image not fully loaded');
    }

    statusEl.textContent = 'Detecting...';
    showLoadingIndicator();
    
    const output = await objectDetector(imageElement, {
      threshold: 0.5,
      maxObjects: 20
    });
    
    clearDetections();
    const overlay = document.getElementById('detection-overlay');

    detectionCount = output.length;
    lastDetectionTime = new Date().toLocaleTimeString();
    
    if (output.length === 0) {
      statusEl.textContent = 'No objects detected';
    } else {
      output.forEach(detection => {
        const { box, label, score } = detection;
        const { xmax, xmin, ymax, ymin } = box;

        const imgWidth = imageElement.offsetWidth;
        const imgHeight = imageElement.offsetHeight;

        // Ensure values are within bounds
        const left = Math.max(0, Math.min(xmin * imgWidth, imgWidth));
        const top = Math.max(0, Math.min(ymin * imgHeight, imgHeight));
        const width = Math.max(0, Math.min((xmax - xmin) * imgWidth, imgWidth - left));
        const height = Math.max(0, Math.min((ymax - ymin) * imgHeight, imgHeight - top));

        const detectionBox = document.createElement('div');
        detectionBox.className = 'detection-box';
        detectionBox.style.left = `${left}px`;
        detectionBox.style.top = `${top}px`;
        detectionBox.style.width = `${width}px`;
        detectionBox.style.height = `${height}px`;

        const labelElement = document.createElement('div');
        labelElement.className = 'detection-label';
        labelElement.textContent = `${label} (${Math.round(score * 100)}%)`;
        detectionBox.appendChild(labelElement);

        overlay.appendChild(detectionBox);
      });
      statusEl.textContent = 'Complete';
    }

    // Update debug info
    timeEl.textContent = lastDetectionTime;
    countEl.textContent = detectionCount;
  } catch (error) {
    console.error('Error detecting objects:', error);
    statusEl.textContent = `Error: ${error.message}`;
    timeEl.textContent = 'Failed';
    countEl.textContent = '0';
  } finally {
    hideLoadingIndicator();
  }
}

function loadBackgroundImage(prompt) {
  clearDetections();

  // Remove any existing background images
  document.querySelectorAll('[id^="background-image-"]').forEach(img => img.remove());

  // Create new unique image element
  const backgroundImg = document.createElement('img');
  const uniqueId = `background-image-${imageCounter++}`;
  backgroundImg.id = uniqueId;
  backgroundImg.alt = prompt;
  
  // Update status before loading
  const statusEl = document.getElementById('detectionStatus');
  if (statusEl) statusEl.textContent = 'Loading image...';

  // Set up onload handler before setting src
  backgroundImg.onload = async () => {
    backgroundImg.classList.add('loaded');
    if (isObjectDetectionEnabled && objectDetector) {
      await detectObjects(backgroundImg);
    }
  };

  backgroundImg.onerror = () => {
    const statusEl = document.getElementById('detectionStatus');
    if (statusEl) statusEl.textContent = 'Failed to load image';
  };

  // Set the source last
  backgroundImg.src = `https://source.unsplash.com/1920x1080/?${encodeURIComponent(prompt)}`;
  document.body.insertBefore(backgroundImg, document.body.firstChild);
}

// Add checkbox event listener
const objectDetectionCheckbox = document.getElementById('enableObjectDetection');
objectDetectionCheckbox.addEventListener('change', (e) => {
  isObjectDetectionEnabled = e.target.checked;
});

// Modify start button click handler
startButton.addEventListener('click', async () => {
  settingsModal.style.display = 'none';
  container.style.display = 'block';

  createDebugPanel();

  if (isObjectDetectionEnabled) {
    const statusEl = document.getElementById('detectionStatus');
    if (statusEl) statusEl.textContent = 'Initializing detector...';
    
    const initialized = await initializeObjectDetector();
    if (!initialized) {
      if (statusEl) statusEl.textContent = 'Failed to initialize detector';
      return;
    }
  }

  if (backgroundPromptInput.value.trim()) {
    loadBackgroundImage(backgroundPromptInput.value.trim());
  }

  // Start camera
  camera.start();
});

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
    await faceMesh.send({ image: videoElement });
  },
  width: 1280,
  height: 720,
  facingMode: 'user'
});