const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// High-resolution canvas for smoother graphics.
const W = 900;
const H = 500;
const SCALE = 2;

canvas.width = W * SCALE;
canvas.height = H * SCALE;
ctx.scale(SCALE, SCALE);

const GROUND = 420;

const scoreText = document.getElementById("score");
const coinsText = document.getElementById("coins");
const timerText = document.getElementById("timer");

const startScreen = document.getElementById("startScreen");
const endScreen = document.getElementById("endScreen");

let running = false;
let animationId = null;
let lastTime = 0;
let elapsed = 0;
let timeLeft = 30;
let score = 0;
let coins = 0;
let spawnTimer = 0;
let objects = [];
let particles = [];

const keys = {
  left: false,
  right: false
};

const player = {
  x: 120,
  y: GROUND - 60,
  w: 42,
  h: 60,
  vy: 0,
  speed: 330,
  onGround: true
};

// Jump power 7.
const JUMP_POWER = 9;
const JUMP_VELOCITY = JUMP_POWER * 70;

function startGame() {
  // Cancel any previous animation loop.
  if (animationId !== null) {
    cancelAnimationFrame(animationId);
  }

  running = true;
  lastTime = performance.now();

  elapsed = 0;
  timeLeft = 30;
  score = 0;
  coins = 0;
  spawnTimer = 0.8;

  objects = [];
  particles = [];

  keys.left = false;
  keys.right = false;

  player.x = 120;
  player.y = GROUND - player.h;
  player.vy = 0;
  player.onGround = true;

  startScreen.classList.add("hidden");
  endScreen.classList.add("hidden");

  updateHUD();
  animationId = requestAnimationFrame(gameLoop);
}

function endGame(message) {
  if (!running) return;

  running = false;

  document.getElementById("endTitle").textContent = message;
  document.getElementById("endResult").textContent =
    "Score: " + score + " | Coins: " + coins;

  endScreen.classList.remove("hidden");
}

function updateHUD() {
  scoreText.textContent = score;
  coinsText.textContent = coins;
  timerText.textContent = Math.ceil(Math.max(0, timeLeft));
}

function jump() {
  if (!running || !player.onGround) return;

  player.vy = -JUMP_VELOCITY;
  player.onGround = false;
}

// --------------------------------------------------
// OBJECT SPAWNING
// --------------------------------------------------

function spawnObject() {
  const roll = Math.random();

  if (roll < 0.38) {
    objects.push({
      type: "mushroom",
      x: W + 30,
      y: GROUND - 38,
      w: 42,
      h: 38,
      passed: false
    });

  } else if (roll < 0.62) {
    objects.push({
      type: "hazard",
      x: W + 30,
      y: 150,
      baseY: 150,
      phase: Math.random() * Math.PI * 2,
      w: 42,
      h: 42,
      hitRadius: 9
    });

  } else if (roll < 0.82) {
    objects.push({
      type: "reward",
      reward: "star",
      x: W + 30,
      y: 190 + Math.random() * 35,
      w: 30,
      h: 30,
      collected: false
    });

  } else {
    objects.push({
      type: "reward",
      reward: "chest",
      x: W + 30,
      y: 220 + Math.random() * 35,
      w: 40,
      h: 32,
      collected: false
    });
  }
}

// --------------------------------------------------
// COLLISION DETECTION
// --------------------------------------------------

function rectangleCollision(a, b) {
  const padding = 4;

  return (
    a.x + padding < b.x + b.w &&
    a.x + a.w - padding > b.x &&
    a.y + padding < b.y + b.h &&
    a.y + a.h - padding > b.y
  );
}

// Circle-versus-rectangle collision for small star hitboxes.
function circleHitsPlayer(cx, cy, radius) {
  const closestX = Math.max(
    player.x,
    Math.min(cx, player.x + player.w)
  );

  const closestY = Math.max(
    player.y,
    Math.min(cy, player.y + player.h)
  );

  const dx = cx - closestX;
  const dy = cy - closestY;

  return dx * dx + dy * dy < radius * radius;
}

// --------------------------------------------------
// UPDATE GAME
// --------------------------------------------------

function update(dt) {
  elapsed += dt;
  timeLeft -= dt;

  if (timeLeft <= 0) {
    timeLeft = 0;
    updateHUD();
    endGame("Time's Up!");
    return;
  }

  // Player movement.
  if (keys.left) {
    player.x -= player.speed * dt;
  }

  if (keys.right) {
    player.x += player.speed * dt;
  }

  player.x = Math.max(
    0,
    Math.min(W - player.w, player.x)
  );

  // Gravity and jumping.
  player.vy += 1250 * dt;
  player.y += player.vy * dt;

  if (player.y + player.h >= GROUND) {
    player.y = GROUND - player.h;
    player.vy = 0;
    player.onGround = true;
  }

  // Spawn objects.
  spawnTimer -= dt;

  if (spawnTimer <= 0) {
    spawnObject();
    spawnTimer = 1.0 + Math.random() * 0.6;
  }

  const speed = 270 + Math.min(elapsed * 2, 100);

  for (const obj of objects) {
    obj.x -= speed * dt;

    // Flying stars move up and down.
    if (obj.type === "hazard") {
      obj.y = obj.baseY +
        Math.sin(elapsed * 2.5 + obj.phase) * 65;
    }

    // Mushroom collision.
    if (obj.type === "mushroom") {
      if (rectangleCollision(player, obj)) {
        endGame("You hit a mushroom!");
        return;
      }

      // Award a coin once the mushroom has been passed.
      if (!obj.passed && obj.x + obj.w < player.x) {
        obj.passed = true;
        coins += 1;
        score += 5;
      }
    }

    // Spiky star collision.
    if (obj.type === "hazard") {
      const cx = obj.x + obj.w / 2;
      const cy = obj.y;

      if (circleHitsPlayer(cx, cy, obj.hitRadius)) {
        endGame("A spiky star got you!");
        return;
      }
    }

    // Collect stars and chests.
    if (obj.type === "reward" && !obj.collected) {
      if (rectangleCollision(player, obj)) {
        obj.collected = true;

        if (obj.reward === "star") {
          coins += 1;
          score += 10;
          makeParticles(obj.x, obj.y, "#ffe34f");
        }

        if (obj.reward === "chest") {
          coins += 2;
          score += 25;
          makeParticles(obj.x, obj.y, "#ffae35");
        }
      }
    }
  }

  objects = objects.filter(obj => obj.x > -100);

  updateParticles(dt);
  updateHUD();
}

// --------------------------------------------------
// PARTICLES
// --------------------------------------------------

function makeParticles(x, y, colour) {
  for (let i = 0; i < 12; i++) {
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 160,
      vy: (Math.random() - 0.5) * 160,
      life: 0.6,
      colour
    });
  }
}

function updateParticles(dt) {
  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
  }

  particles = particles.filter(p => p.life > 0);
}

// --------------------------------------------------
// DRAW BACKGROUND
// --------------------------------------------------

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#66c8f5");
  sky.addColorStop(1, "#d4f3ff");

  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Clouds at several heights.
  for (let i = 0; i < 8; i++) {
    const x =
      ((i * 150 - elapsed * 18) % (W + 180) + W + 180) %
      (W + 180) - 90;

    const y = 55 + (i % 3) * 65;
    drawCloud(x, y);
  }

  // Ground.
  ctx.fillStyle = "#55b849";
  ctx.fillRect(0, GROUND, W, H - GROUND);

  ctx.fillStyle = "#328e38";
  ctx.fillRect(0, GROUND, W, 9);

  // Grass.
  ctx.strokeStyle = "#9be77c";
  ctx.lineWidth = 3;

  for (let i = 0; i < 55; i++) {
    const x = (i * 43 - elapsed * 110) % W;

    ctx.beginPath();
    ctx.moveTo(x, GROUND + 20);
    ctx.lineTo(x - 5, GROUND + 11);
    ctx.stroke();
  }
}

function drawCloud(x, y) {
  ctx.fillStyle = "rgba(255,255,255,0.96)";

  ctx.beginPath();
  ctx.arc(x, y, 23, 0, Math.PI * 2);
  ctx.arc(x + 27, y - 13, 29, 0, Math.PI * 2);
  ctx.arc(x + 55, y, 23, 0, Math.PI * 2);
  ctx.fill();
}

// --------------------------------------------------
// DRAW PLAYER
// --------------------------------------------------

function drawPlayer() {
  const x = player.x;
  const y = player.y;

  // Legs.
  ctx.fillStyle = "#202b46";
  ctx.fillRect(x + 7, y + 42, 12, 18);
  ctx.fillRect(x + 25, y + 42, 12, 18);

  // Shoes.
  ctx.fillStyle = "#282828";
  ctx.fillRect(x + 3, y + 56, 17, 6);
  ctx.fillRect(x + 24, y + 56, 17, 6);

  // Hoodie.
  ctx.fillStyle = "#171b2b";
  roundedRect(x + 4, y + 20, 35, 28, 7);

  // Face.
  ctx.fillStyle = "#f0bd91";
  ctx.beginPath();
  ctx.arc(x + 22, y + 14, 14, 0, Math.PI * 2);
  ctx.fill();

  // Hair.
  ctx.fillStyle = "#51301e";
  ctx.beginPath();
  ctx.arc(x + 20, y + 8, 13, Math.PI, Math.PI * 2);
  ctx.fill();

  // Eyes.
  ctx.fillStyle = "#222";
  ctx.fillRect(x + 15, y + 13, 3, 3);
  ctx.fillRect(x + 27, y + 13, 3, 3);
}

function roundedRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

// --------------------------------------------------
// DRAW MUSHROOMS
// --------------------------------------------------

function drawMushroom(obj) {
  const x = obj.x;
  const y = obj.y;

  ctx.fillStyle = "#fff0d0";
  ctx.fillRect(x + 13, y + 15, 16, 23);

  ctx.fillStyle = "#ed3434";
  ctx.beginPath();
  ctx.ellipse(x + 21, y + 16, 21, 15, 0, Math.PI, 0);
  ctx.fill();

  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.arc(x + 11, y + 9, 3, 0, Math.PI * 2);
  ctx.arc(x + 25, y + 6, 3, 0, Math.PI * 2);
  ctx.fill();
}

// --------------------------------------------------
// DRAW STARS
// --------------------------------------------------

function drawStar(obj, dangerous) {
  const cx = obj.x + obj.w / 2;
  const cy = obj.type === "hazard" ? obj.y : obj.y + obj.h / 2;

  const spikes = 8;
  const outer = dangerous ? 20 : 15;
  const inner = dangerous ? 10 : 7;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(elapsed * 1.3);

  ctx.beginPath();

  for (let i = 0; i < spikes * 2; i++) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = i * Math.PI / spikes - Math.PI / 2;

    const px = Math.cos(angle) * radius;
    const py = Math.sin(angle) * radius;

    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }

  ctx.closePath();

  ctx.fillStyle = dangerous ? "#ff4848" : "#ffdb3c";
  ctx.fill();

  ctx.strokeStyle = dangerous ? "#a51b1b" : "#efa900";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();
}

// --------------------------------------------------
// DRAW TREASURE CHESTS
// --------------------------------------------------

function drawChest(obj) {
  const x = obj.x;
  const y = obj.y;

  // Lid.
  ctx.fillStyle = "#a95a20";
  ctx.beginPath();
  ctx.roundRect(x, y, obj.w, 12, 5);
  ctx.fill();

  // Body.
  ctx.fillStyle = "#d58a32";
  ctx.fillRect(x, y + 10, obj.w, 22);

  // Gold border.
  ctx.strokeStyle = "#ffe16a";
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 2, y + 11, obj.w - 4, 19);

  // Lock.
  ctx.fillStyle = "#ffe16a";
  ctx.fillRect(x + 16, y + 16, 8, 9);
}

// --------------------------------------------------
// DRAW EVERYTHING
// --------------------------------------------------

function drawObjects() {
  for (const obj of objects) {
    if (obj.type === "mushroom") {
      drawMushroom(obj);
    }

    if (obj.type === "hazard") {
      drawStar(obj, true);
    }

    if (obj.type === "reward" && obj.collected) {
      continue;
    }

    if (obj.type === "reward" && obj.reward === "star") {
      drawStar(obj, false);
    }

    if (obj.type === "reward" && obj.reward === "chest") {
      drawChest(obj);
    }
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / 0.6);
    ctx.fillStyle = p.colour;

    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  drawBackground();
  drawObjects();
  drawPlayer();
  drawParticles();
}

// --------------------------------------------------
// GAME LOOP
// --------------------------------------------------

function gameLoop(now) {
  if (!running) return;

  const dt = Math.min((now - lastTime) / 1000, 0.04);
  lastTime = now;

  update(dt);
  draw();

  if (running) {
    animationId = requestAnimationFrame(gameLoop);
  }
}

// --------------------------------------------------
// KEYBOARD CONTROLS
// --------------------------------------------------

document.addEventListener("keydown", e => {
  const key = e.key.toLowerCase();

  if (["arrowleft", "arrowright", "arrowup", " "].includes(key)) {
    e.preventDefault();
  }

  if (key === "arrowleft" || key === "a") {
    keys.left = true;
  }

  if (key === "arrowright" || key === "d") {
    keys.right = true;
  }

  if (key === " " || key === "arrowup" || key === "w") {
    jump();
  }
});

document.addEventListener("keyup", e => {
  const key = e.key.toLowerCase();

  if (key === "arrowleft" || key === "a") {
    keys.left = false;
  }

  if (key === "arrowright" || key === "d") {
    keys.right = false;
  }
});

// --------------------------------------------------
// MOBILE CONTROLS
// --------------------------------------------------

function holdButton(id, direction) {
  const button = document.getElementById(id);

  button.addEventListener("pointerdown", e => {
    e.preventDefault();
    keys[direction] = true;
    button.setPointerCapture(e.pointerId);
  });

  function release() {
    keys[direction] = false;
  }

  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", release);
}

holdButton("leftBtn", "left");
holdButton("rightBtn", "right");

document.getElementById("jumpBtn").addEventListener("pointerdown", e => {
  e.preventDefault();
  jump();
});

document.getElementById("startBtn").addEventListener("click", startGame);
document.getElementById("restartBtn").addEventListener("click", startGame);

// Draw the initial scene.
draw(); 
