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
    
    // Adjust collision radius based on score/face size
    this.baseCollisionRadius = 20;
    
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
      speed: Math.random() * 2 + 2
    });
  }
  
  checkMouthCollision(object) {
    if (!this.faceMeshData.mouthOpen || !this.faceMeshData.mouthCenter) return false;
    
    // Scale collision radius based on score
    const scale = 0.4 + Math.min(0.8, (this.score / 100) * 0.02);
    const currentCollisionRadius = this.baseCollisionRadius * scale;
    
    const distance = Math.hypot(
      object.x - this.faceMeshData.mouthCenter.x,
      object.y - this.faceMeshData.mouthCenter.y
    );
    
    return distance < object.radius + currentCollisionRadius;
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