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

// Standard MediaPipe face mesh connections
const FACEMESH_TESSELATION = [
  [127, 34], [34, 139], [139, 127], [11, 0], [0, 37], [37, 11],
  [232, 231], [231, 120], [120, 232], [72, 37], [37, 39], [39, 72],
  [128, 121], [121, 47], [47, 128], [232, 121], [121, 128], [128, 232],
  [104, 69], [69, 67], [67, 104], [175, 171], [171, 148], [148, 175],
  [118, 50], [50, 101], [101, 118], [73, 39], [39, 40], [40, 73],
  [9, 151], [151, 108], [108, 9], [48, 115], [115, 131], [131, 48],
  [194, 204], [204, 211], [211, 194], [74, 40], [40, 185], [185, 74],
  [80, 42], [42, 183], [183, 80], [40, 92], [92, 186], [186, 40],
  [230, 229], [229, 118], [118, 230], [202, 212], [212, 214], [214, 202],
  [83, 18], [18, 17], [17, 83], [76, 61], [61, 146], [146, 76],
  [160, 29], [29, 30], [30, 160], [56, 157], [157, 173], [173, 56],
  [106, 204], [204, 194], [194, 106], [135, 214], [214, 192], [192, 135],
  [187, 216], [216, 207], [207, 187], [151, 122], [122, 141], [141, 151],
  [158, 159], [159, 160], [160, 158], [170, 171], [171, 175], [175, 170]
];

// Face contours for a more defined look
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

      // Draw face mesh
      canvasCtx.lineWidth = 1;
      canvasCtx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
      canvasCtx.fillStyle = 'rgba(0, 255, 0, 0.1)';
      
      // Draw tesselation
      FACEMESH_TESSELATION.forEach(([i, j]) => {
        const start = smoothedLandmarks[i];
        const end = smoothedLandmarks[j];
        
        canvasCtx.beginPath();
        canvasCtx.moveTo(start.x * canvasElement.width, start.y * canvasElement.height);
        canvasCtx.lineTo(end.x * canvasElement.width, end.y * canvasElement.height);
        canvasCtx.stroke();
      });

      // Draw face contour with glow
      canvasCtx.lineWidth = 2;
      canvasCtx.strokeStyle = '#00ff00';
      canvasCtx.shadowColor = '#00ff00';
      canvasCtx.shadowBlur = 10;
      
      FACEMESH_FACE_OVAL.forEach(([i, j]) => {
        const start = smoothedLandmarks[i];
        const end = smoothedLandmarks[j];
        
        canvasCtx.beginPath();
        canvasCtx.moveTo(start.x * canvasElement.width, start.y * canvasElement.height);
        canvasCtx.lineTo(end.x * canvasElement.width, end.y * canvasElement.height);
        canvasCtx.stroke();
      });
    }
  }
  canvasCtx.restore();
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