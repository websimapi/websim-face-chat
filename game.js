class Game {
  constructor(canvas, faceMeshData, isMultiplayer = false, room = null) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.faceMeshData = faceMeshData;
    this.objects = [];
    this.score = 0;
    this.globalScore = 0;
    this.lastSpawnTime = 0;
    this.spawnInterval = 2000;
    this.gameActive = false;
    this.scoreElement = document.getElementById('score');
    this.isMultiplayer = isMultiplayer;
    this.room = room;
    
    // Add mouth state tracking
    this.mouthWasClosed = true;
    this.mouthOpenThreshold = 30;
    
    // Add rotation and bounce properties to itemTypes
    this.itemTypes = [
      {
        type: 'good',
        shape: 'burger',
        color: '#8B4513',
        points: 10,
        radius: 20,
        probability: 0.4,
        rotates: false
      },
      {
        type: 'good',
        shape: 'pizza',
        color: '#FFD700',
        points: 15,
        radius: 20,
        probability: 0.3,
        rotates: true,
        bounces: true
      },
      {
        type: 'bad',
        shape: 'poison',
        color: '#800080',
        points: -20,
        radius: 15,
        probability: 0.3,
        rotates: false
      }
    ];
    
    // Add pause state
    this.isPaused = false;
    
    // Handle multiplayer sync
    if (this.isMultiplayer && this.room) {
      this.setupMultiplayerSync();
    }
    
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }
  
  setupMultiplayerSync() {
    // Sync game objects
    this.room.onmessage = (event) => {
      const data = event.data;
      if (data.type === 'gameObjectSpawned') {
        this.addSyncedObject(data.object);
      } else if (data.type === 'objectEaten') {
        this.handleSyncedObjectEaten(data);
      }
    };
    
    // Subscribe to score updates
    this.room.collection('game_score').subscribe((scores) => {
      if (scores.length > 0) {
        this.globalScore = scores[0].score;
        this.updateScore();
      }
    });
  }
  
  async updateGlobalScore(points) {
    if (this.isMultiplayer) {
      const scores = await this.room.collection('game_score').getList();
      if (scores.length === 0) {
        await this.room.collection('game_score').create({ score: points });
      } else {
        await this.room.collection('game_score').update(scores[0].id, {
          score: scores[0].score + points
        });
      }
    }
  }
  
  spawnObject() {
    const object = this.createRandomObject();
    
    if (this.isMultiplayer) {
      this.room.send({
        type: 'gameObjectSpawned',
        object: object
      });
    }
    
    this.objects.push(object);
  }
  
  createRandomObject() {
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
    
    return {
      x,
      y: -20,
      type: selectedType.type,
      shape: selectedType.shape,
      color: selectedType.color,
      points: selectedType.points,
      radius: selectedType.radius,
      speed: Math.random() * 2 + 2,
      canBeEaten: true,
      eatingProgress: 0,
      rotation: 0,
      rotates: selectedType.rotates,
      bounces: selectedType.bounces,
      dx: (Math.random() - 0.5) * 4,
      rotationSpeed: Math.random() * 0.1 + 0.05,
      id: Math.random().toString(36).substr(2, 9)
    };
  }
  
  addSyncedObject(object) {
    if (!this.objects.find(obj => obj.id === object.id)) {
      this.objects.push(object);
    }
  }
  
  handleSyncedObjectEaten(data) {
    const index = this.objects.findIndex(obj => obj.id === data.objectId);
    if (index !== -1) {
      this.objects.splice(index, 1);
      this.globalScore += data.points;
      this.updateScore();
    }
  }
  
  async checkMouthCollision(object) {
    if (!this.faceMeshData.mouthCenter || !object.canBeEaten) return false;
    
    const isMouthOpen = this.faceMeshData.mouthOpen;
    const distance = Math.hypot(
      object.x - this.faceMeshData.mouthCenter.x,
      object.y - this.faceMeshData.mouthCenter.y
    );
    
    const isInMouthArea = distance < object.radius + 20;
    
    if (isInMouthArea && isMouthOpen) {
      object.eatingProgress = Math.min(object.eatingProgress + 0.1, 1);
      return false;
    }
    
    if (isInMouthArea && !isMouthOpen && object.eatingProgress > 0.5) {
      if (this.isMultiplayer) {
        this.room.send({
          type: 'objectEaten',
          objectId: object.id,
          points: object.points
        });
        await this.updateGlobalScore(object.points);
      } else {
        this.score += object.points;
      }
      return true;
    }
    
    if (!isInMouthArea) {
      object.eatingProgress = 0;
    }
    
    return false;
  }
  
  updateScore() {
    if (this.isMultiplayer) {
      this.scoreElement.textContent = `Global Score: ${this.globalScore}`;
    } else {
      this.scoreElement.textContent = `Score: ${this.score}`;
    }
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
  
  pause() {
    if (this.gameActive && !this.isMultiplayer) {
      this.isPaused = true;
      this.drawPauseScreen();
    }
  }
  
  unpause() {
    if (this.gameActive && this.isPaused) {
      this.isPaused = false;
      this.gameLoop();
    }
  }
  
  drawPauseScreen() {
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = '48px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('PAUSED', this.canvas.width / 2, this.canvas.height / 2);
    this.ctx.font = '24px Arial';
    this.ctx.fillText('Click to resume', this.canvas.width / 2, this.canvas.height / 2 + 50);
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
    
    // Bun bottom (rectangle shape like the patty)
    this.ctx.beginPath();
    this.ctx.fillStyle = '#F4A460';
    this.ctx.fillRect(x - radius, y + radius/2, radius * 2, radius/3);
    
    this.ctx.restore();
  }

  drawPizza(x, y, radius, rotation = 0) {
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(rotation);
    
    // Pizza triangle
    this.ctx.beginPath();
    this.ctx.moveTo(0, -radius);
    this.ctx.lineTo(-radius, radius);
    this.ctx.lineTo(radius, radius);
    this.ctx.closePath();
    this.ctx.fillStyle = '#FFD700';
    this.ctx.fill();
    
    // Pepperoni
    this.ctx.fillStyle = '#FF0000';
    this.ctx.beginPath();
    this.ctx.arc(0, 0, radius/4, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.beginPath();
    this.ctx.arc(-radius/2, radius/2, radius/4, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.beginPath();
    this.ctx.arc(radius/2, radius/2, radius/4, 0, Math.PI * 2);
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
          this.drawPizza(obj.x, obj.y, obj.radius, obj.rotation);
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
      
      // Update rotation for rotating objects
      if (obj.rotates) {
        obj.rotation += obj.rotationSpeed;
      }
      
      // Handle bouncing movement for bouncing objects
      if (obj.bounces) {
        obj.x += obj.dx;
        
        // Bounce off walls
        if (obj.x < obj.radius) {
          obj.x = obj.radius;
          obj.dx = Math.abs(obj.dx);
        } else if (obj.x > this.canvas.width - obj.radius) {
          obj.x = this.canvas.width - obj.radius;
          obj.dx = -Math.abs(obj.dx);
        }
      }
      
      if (this.checkMouthCollision(obj)) {
        obj.canBeEaten = false; 
        if (!this.isMultiplayer) {
          this.score += obj.points;
          this.updateScore();
        }
        this.objects.splice(i, 1);
      } else if (obj.y > this.canvas.height + obj.radius) {
        if (obj.type === 'good' && !this.isMultiplayer) {
          this.score -= 5;
          this.updateScore();
        }
        this.objects.splice(i, 1);
      }
    }
  }

  gameLoop = () => {
    if (!this.gameActive || this.isPaused) return;
    
    this.update();
    this.draw();
    requestAnimationFrame(this.gameLoop);
  }

  window.addEventListener('blur', () => this.pause());
  window.addEventListener('focus', () => this.unpause());
}

window.Game = Game;