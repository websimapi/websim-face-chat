const videoElement = document.getElementById('input');
const canvasElement = document.getElementById('output');
const canvasCtx = canvasElement.getContext('2d');

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
  // Left eye - updated for more natural shape
  leftEye: [
    [263, 249], [249, 390], [390, 373], [373, 374], [374, 380], 
    [380, 381], [381, 382], [382, 362], [263, 466], [466, 388], 
    [388, 387], [387, 386], [386, 385], [385, 384], [384, 398], [398, 362]
  ],
  // Right eye - updated for more natural shape
  rightEye: [
    [33, 7], [7, 163], [163, 144], [144, 145], [145, 153], 
    [153, 154], [154, 155], [155, 133], [33, 246], [246, 161], 
    [161, 160], [160, 159], [159, 158], [158, 157], [157, 173], [173, 133]
  ],
  // Rest of the facial features remain the same
  leftEyebrow: [
    [70, 63], [63, 105], [105, 66], [66, 107], [107, 55], [55, 65], [65, 52], 
    [52, 53], [53, 46]
  ],
  rightEyebrow: [
    [300, 293], [293, 334], [334, 296], [296, 336], [336, 285], [285, 295], 
    [295, 282], [282, 283], [283, 276]
  ],
  nose: [
    [168, 6], [6, 197], [197, 195], [195, 5], [5, 4], [4, 1], [1, 19], [19, 94], 
    [94, 2], [2, 164], [164, 0], [0, 11], [11, 12], [12, 13], [13, 14], [14, 15], 
    [15, 16], [16, 17], [17, 18], [18, 200], [200, 199], [199, 175]
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

function onResults(results) {
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  if (results.multiFaceLandmarks) {
    for (const landmarks of results.multiFaceLandmarks) {
      const smoothedLandmarks = smoothLandmarks(landmarks, previousLandmarks);
      previousLandmarks = smoothedLandmarks;

      // Draw face outline
      canvasCtx.lineWidth = 2;
      canvasCtx.strokeStyle = '#00ff00';
      canvasCtx.shadowColor = '#00ff00';
      canvasCtx.shadowBlur = 10;
      
      // Draw face outline
      drawConnectors(smoothedLandmarks, FACEMESH_FACE_OVAL, '#00ff00', 2);

      // Draw facial features
      drawFacialFeature(smoothedLandmarks, FACE_CONNECTIONS.leftEye, '#00ff00', 1.5);
      drawFacialFeature(smoothedLandmarks, FACE_CONNECTIONS.rightEye, '#00ff00', 1.5);
      drawFacialFeature(smoothedLandmarks, FACE_CONNECTIONS.leftEyebrow, '#00ff00', 1.5);
      drawFacialFeature(smoothedLandmarks, FACE_CONNECTIONS.rightEyebrow, '#00ff00', 1.5);
      drawFacialFeature(smoothedLandmarks, FACE_CONNECTIONS.nose, '#00ff00', 1.5);
      drawFacialFeature(smoothedLandmarks, FACE_CONNECTIONS.lipsOuter, '#00ff00', 1.5);
      drawFacialFeature(smoothedLandmarks, FACE_CONNECTIONS.lipsInner, '#00ff00', 1.5);
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

camera.start();