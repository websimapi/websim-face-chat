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

// Define face feature connections for VTuber style with enhanced nose and mouth
const faceConnections = [
  // Jaw line
  [234,127,162,21,54,103,67,109,10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234],
  
  // Left eye
  [33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246],
  
  // Right eye
  [362,382,381,380,374,373,390,249,263,466,388,387,386,385,384,398],
  
  // Left eyebrow
  [70,63,105,66,107,55,65,52,53,46],
  
  // Right eyebrow
  [336,296,334,293,300,276,283,282,295,285],
  
  // Nose bridge and tip
  [168,193,245,188,174,217,126,142,130,97,98,129,49,131,134,236,3,196],
  
  // Nose bottom and nostrils
  [79,166,75,60,20,238,239,79],
  
  // Outer lips
  [61,146,91,181,84,17,314,405,321,375,291,308,324,318,402,317,14,87,178,88,95,61],
  
  // Inner lips
  [78,191,80,81,82,13,312,311,310,415,308,324,318,402,317,14,87,178,88,95,78],
  
  // Nose contour
  [122,6,351,419,456,363,360,279,358,327,326,2,97,98,129,49,131,134,236,3,196,122],
];

function onResults(results) {
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  if (results.multiFaceLandmarks) {
    for (const landmarks of results.multiFaceLandmarks) {
      const smoothedLandmarks = smoothLandmarks(landmarks, previousLandmarks);
      previousLandmarks = smoothedLandmarks;

      // Draw face features
      canvasCtx.lineWidth = 2.5;
      canvasCtx.lineCap = 'round';
      canvasCtx.lineJoin = 'round';
      
      // Draw main features with enhanced glow effect
      canvasCtx.shadowColor = '#00ff00';
      canvasCtx.shadowBlur = 12;
      canvasCtx.strokeStyle = '#ffffff';
      
      faceConnections.forEach((connection, index) => {
        canvasCtx.beginPath();
        
        // Adjust line width for different features
        if (index >= 6) { // Nose and mouth features
          canvasCtx.lineWidth = 2;
        } else {
          canvasCtx.lineWidth = 2.5;
        }
        
        connection.forEach((index, i) => {
          const point = smoothedLandmarks[index];
          const x = point.x * canvasElement.width;
          const y = point.y * canvasElement.height;
          
          if (i === 0) {
            canvasCtx.moveTo(x, y);
          } else {
            canvasCtx.lineTo(x, y);
          }
        });
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