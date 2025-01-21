const videoElement = document.getElementById('input');
const canvasElement = document.getElementById('output');
const canvasCtx = canvasElement.getContext('2d');

// Adjust canvas size to match viewport
function onResize() {
  canvasElement.width = window.innerWidth;
  canvasElement.height = window.innerHeight;
}
window.addEventListener('resize', onResize);
onResize();

function onResults(results) {
  // Clear canvas
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  // Draw face mesh
  if (results.multiFaceLandmarks) {
    for (const landmarks of results.multiFaceLandmarks) {
      // Draw dots for each landmark
      canvasCtx.fillStyle = '#00FF00';
      for (const landmark of landmarks) {
        const x = landmark.x * canvasElement.width;
        const y = landmark.y * canvasElement.height;
        canvasCtx.beginPath();
        canvasCtx.arc(x, y, 2, 0, 2 * Math.PI);
        canvasCtx.fill();
      }

      // Draw connections between landmarks
      canvasCtx.strokeStyle = '#00FF00';
      canvasCtx.lineWidth = 1;
      for (let i = 0; i < landmarks.length - 1; i++) {
        const start = landmarks[i];
        const end = landmarks[i + 1];
        canvasCtx.beginPath();
        canvasCtx.moveTo(start.x * canvasElement.width, start.y * canvasElement.height);
        canvasCtx.lineTo(end.x * canvasElement.width, end.y * canvasElement.height);
        canvasCtx.stroke();
      }
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