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
    
    // Add mouth state tracking
    this.mouthWasClosed = true;
    this.mouthOpenThreshold = 30;
    
    // Define food types with shapes and colors
    this.itemTypes = [
      {
        type: 'good',
        shape: 'burger',
        color: '#8B4513', // burger color
        points: 10,
        radius: 20,
        probability: 0.4
      },
      {
        type: 'good',
        shape: 'pizza',
        color: '#FFD700', // pizza color
        points: 15,
        radius: 20,
        probability: 0.3
      },
      {
        type: 'bad',
        shape: 'poison',
        color: '#800080', // poison color
        points: -20,
        radius: 15,
        probability: 0.3
      }
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
  
  drawBurger(x, y, radius) {
    this.ctx.save();
    // Bun top
    this.ctx.beginPath();
    this.ctx.fillStyle = '#F4A460';
    this.ctx.arc(x, y - radius/4, radius, 0.25 * Math.PI, 0.75 * Math.PI, true);
    this.ctx.fill();
    
    // Lettuce
    this.ctx.beginPath();
    this.ctx.fillStyle = '#32CD32';
    this.ctx.fillRect(x - radius, y, radius * 2, radius/4);
    
    // Patty
    this.ctx.beginPath();
    this.ctx.fillStyle = '#8B4513';
    this.ctx.fillRect(x - radius, y + radius/4, radius * 2, radius/3);
    
    // Bun bottom
    this.ctx.beginPath();
    this.ctx.fillStyle = '#F4A460';
    this.ctx.arc(x, y + radius/2, radius, 1.25 * Math.PI, 1.75 * Math.PI, false);
    this.ctx.fill();
    this.ctx.restore();
  }

  drawPizza(x, y, radius) {
    this.ctx.save();
    // Pizza triangle
    this.ctx.beginPath();
    this.ctx.moveTo(x, y - radius);
    this.ctx.lineTo(x - radius, y + radius);
    this.ctx.lineTo(x + radius, y + radius);
    this.ctx.closePath();
    this.ctx.fillStyle = '#FFD700';
    this.ctx.fill();
    
    // Pepperoni
    this.ctx.fillStyle = '#FF0000';
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius/4, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.beginPath();
    this.ctx.arc(x - radius/2, y + radius/2, radius/4, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.beginPath();
    this.ctx.arc(x + radius/2, y + radius/2, radius/4, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
  }

  drawPoison(x, y, radius) {
    this.ctx.save();
    // Poison bottle
    this.ctx.beginPath();
    this.ctx.moveTo(x - radius/2, y - radius);
    this.ctx.lineTo(x + radius/2, y - radius);
    this.ctx.lineTo(x + radius, y + radius);
    this.ctx.lineTo(x - radius, y + radius);
    this.ctx.closePath();
    this.ctx.fillStyle = '#800080';
    this.ctx.fill();
    
    // Skull symbol
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = `${radius}px Arial`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('☠', x, y);
    this.ctx.restore();
  }

  spawnObject() {
    const x = Math.random() * (this.canvas.width - 30) + 15;
    
    // Select item type based on probabilities
    const rand = Math.random();
    let cumProb = 0;
    let selectedType = this.itemTypes[0];
    
    for (const type of this.itemTypes) {
      cumProb += type.probability;
      if (rand <= cumProb) {
        selectedType = type;
        break;
      }
    }
    
    this.objects.push({
      x,
      y: -20,
      type: selectedType.type,
      shape: selectedType.shape,
      color: selectedType.color,
      points: selectedType.points,
      radius: selectedType.radius,
      speed: Math.random() * 2 + 2,
      canBeEaten: true,
      eatingProgress: 0 // Track eating progress
    });
  }
  
  checkMouthCollision(object) {
    if (!this.faceMeshData.mouthCenter || !object.canBeEaten) return false;
    
    const isMouthOpen = this.faceMeshData.mouthOpen;
    const distance = Math.hypot(
      object.x - this.faceMeshData.mouthCenter.x,
      object.y - this.faceMeshData.mouthCenter.y
    );
    
    const isInMouthArea = distance < object.radius + 20;
    
    // Start eating progress when mouth is open and object is in mouth area
    if (isInMouthArea && isMouthOpen) {
      object.eatingProgress = Math.min(object.eatingProgress + 0.1, 1);
      return false;
    }
    
    // Complete eating when mouth closes with sufficient eating progress
    if (isInMouthArea && !isMouthOpen && object.eatingProgress > 0.5) {
      return true;
    }
    
    // Reset eating progress if object leaves mouth area
    if (!isInMouthArea) {
      object.eatingProgress = 0;
    }
    
    return false;
  }
  
  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    for (const obj of this.objects) {
      // Draw eating progress if being eaten
      if (obj.eatingProgress > 0) {
        this.ctx.beginPath();
        this.ctx.strokeStyle = '#00ff00';
        this.ctx.lineWidth = 3;
        this.ctx.arc(obj.x, obj.y, obj.radius + 5, 0, Math.PI * 2 * obj.eatingProgress);
        this.ctx.stroke();
      }
      
      // Draw appropriate shape based on object type
      switch(obj.shape) {
        case 'burger':
          this.drawBurger(obj.x, obj.y, obj.radius);
          break;
        case 'pizza':
          this.drawPizza(obj.x, obj.y, obj.radius);
          break;
        case 'poison':
          this.drawPoison(obj.x, obj.y, obj.radius);
          break;
      }
    }
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
  
  gameLoop = () => {
    if (!this.gameActive) return;
    
    this.update();
    this.draw();
    requestAnimationFrame(this.gameLoop);
  }
}

window.Game = Game;