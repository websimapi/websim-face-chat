class Game {
  constructor(canvas, faceMeshData) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.faceMeshData = faceMeshData;
    this.objects = [];
    this.score = 0;
    this.lastSpawnTime = 0;
    this.spawnInterval = 2000;
    this.gameActive = false;
    this.scoreElement = document.getElementById('score');
    
    // Enhanced mouth state tracking
    this.mouthWasClosed = true;
    this.mouthOpenThreshold = 30;
    this.readyToChomp = false; // New state to track chomp readiness
    this.lastMouthState = false; // Track previous mouth state
    
    this.itemTypes = [
      { type: 'good', color: '#00ff00', points: 10, radius: 15, probability: 0.7 },
      { type: 'bad', color: '#ff0000', points: -20, radius: 15, probability: 0.3 }
    ];
    
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }
  
  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }
  
  start() {
    this.gameActive = true;
    this.score = 0;
    this.objects = [];
    this.mouthWasClosed = true;
    this.scoreElement.style.display = 'block';
    this.updateScore();
    this.gameLoop();
  }
  
  stop() {
    this.gameActive = false;
    this.scoreElement.style.display = 'none';
  }
  
  updateScore() {
    this.scoreElement.textContent = `Score: ${this.score}`;
  }
  
  spawnObject() {
    const x = Math.random() * (this.canvas.width - 30) + 15;
    const itemType = this.itemTypes[Math.random() > this.itemTypes[0].probability ? 1 : 0];
    
    this.objects.push({
      x,
      y: -20,
      type: itemType.type,
      color: itemType.color,
      points: itemType.points,
      radius: itemType.radius,
      speed: Math.random() * 2 + 2,
      canBeEaten: true // Add flag to prevent multiple collisions
    });
  }
  
  checkMouthCollision(object) {
    if (!this.faceMeshData.mouthCenter || !object.canBeEaten) return false;
    
    const isMouthOpen = this.faceMeshData.mouthOpen;
    
    // Calculate distance between mouth and object
    const distance = Math.hypot(
      object.x - this.faceMeshData.mouthCenter.x,
      object.y - this.faceMeshData.mouthCenter.y
    );
    
    // Check if object is within mouth area
    const isInMouthArea = distance < object.radius + 20;
    
    // Detect mouth closing action
    if (isInMouthArea) {
      // If mouth was open and is now closed, and we were ready to chomp
      if (!isMouthOpen && this.lastMouthState && this.readyToChomp) {
        this.readyToChomp = false; // Reset chomp readiness
        return true; // Successful chomp
      }
      
      // If mouth is open and in position, get ready to chomp
      if (isMouthOpen) {
        this.readyToChomp = true;
      }
    } else {
      // Reset chomp readiness if object is not in mouth area
      this.readyToChomp = false;
    }
    
    // Update last mouth state
    this.lastMouthState = isMouthOpen;
    
    return false;
  }
  
  update() {
    const now = Date.now();
    if (now - this.lastSpawnTime > this.spawnInterval) {
      this.spawnObject();
      this.lastSpawnTime = now;
    }
    
    for (let i = this.objects.length - 1; i >= 0; i--) {
      const obj = this.objects[i];
      obj.y += obj.speed;
      
      if (this.checkMouthCollision(obj)) {
        obj.canBeEaten = false; // Prevent multiple collisions
        this.score += obj.points;
        this.updateScore();
        this.objects.splice(i, 1);
      } else if (obj.y > this.canvas.height + obj.radius) {
        if (obj.type === 'good') this.score -= 5;
        this.updateScore();
        this.objects.splice(i, 1);
      }
    }
  }
  
  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    for (const obj of this.objects) {
      this.ctx.beginPath();
      this.ctx.fillStyle = obj.color;
      this.ctx.arc(obj.x, obj.y, obj.radius, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }
  
  gameLoop = () => {
    if (!this.gameActive) return;
    
    this.update();
    this.draw();
    requestAnimationFrame(this.gameLoop);
  }
}

window.Game = Game;