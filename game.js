// public/game.js
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const startBtn = document.getElementById('startBtn');
  const restartBtn = document.getElementById('restartBtn');
  const submitBtn = document.getElementById('submitBtn');
  const nameInput = document.getElementById('playerName');
  const statusEl = document.getElementById('status');

  const SCORE_API = '../server/score.php';

  let keys = {};
  let rafId = null;
  let running = false;
  let gameOver = false;
  let score = 0;

  const player = { x: 40, y: 40, w: 16, h: 16, speed: 2.2 };
  const coins = [];
  const walls = [];

  function resetGame() {
    running = false;
    gameOver = false;
    score = 0;
    player.x = 40;
    player.y = 40;
    keys = {};
    coins.length = 0;
    walls.length = 0;
    spawnLevel();
    draw();
    submitBtn.disabled = true;
    restartBtn.disabled = true;
    statusEl.textContent = 'Press Start to play.';
  }

  function spawnLevel() {
    for (let i = 0; i < 8; i++) {
      coins.push({
        x: 40 + Math.random() * (canvas.width - 80),
        y: 40 + Math.random() * (canvas.height - 80),
        r: 6,
        taken: false
      });
    }
    for (let i = 0; i < 4; i++) {
      const horizontal = i % 2 === 0;
      walls.push({
        x: horizontal ? 80 : 80 + i * 80,
        y: horizontal ? 100 + i * 40 : 60,
        w: horizontal ? canvas.width - 160 : 12,
        h: horizontal ? 12 : canvas.height - 120,
        vx: horizontal ? 0.8 : 0,
        vy: horizontal ? 0 : 0.9
      });
    }
  }

  function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  function circleHit(px, py, pr, rx, ry, rw, rh) {
    const cx = Math.max(rx, Math.min(px, rx + rw));
    const cy = Math.max(ry, Math.min(py, ry + rh));
    const dx = px - cx, dy = py - cy;
    return dx * dx + dy * dy < pr * pr;
  }

  function handleInput() {
    let vx = 0, vy = 0;
    if (keys['ArrowLeft'] || keys['a']) vx -= 1;
    if (keys['ArrowRight'] || keys['d']) vx += 1;
    if (keys['ArrowUp'] || keys['w']) vy -= 1;
    if (keys['ArrowDown'] || keys['s']) vy += 1;
    const len = Math.hypot(vx, vy) || 1;
    player.x += (vx / len) * player.speed;
    player.y += (vy / len) * player.speed;

    player.x = Math.max(0, Math.min(canvas.width - player.w, player.x));
    player.y = Math.max(0, Math.min(canvas.height - player.h, player.y));
  }

  function update(dt) {
    for (const w of walls) {
      w.x += w.vx;
      w.y += w.vy;
      if (w.x <= 20 || w.x + w.w >= canvas.width - 20) w.vx *= -1;
      if (w.y <= 20 || w.y + w.h >= canvas.height - 20) w.vy *= -1;
      if (rectsOverlap(player.x, player.y, player.w, player.h, w.x, w.y, w.w, w.h)) {
        gameOver = true;
      }
    }

    for (const c of coins) {
      if (!c.taken) {
        const px = player.x + player.w / 2;
        const py = player.y + player.h / 2;
        if (circleHit(px, py, Math.max(player.w, player.h) / 2, c.x, c.y, c.r * 2, c.r * 2)) {
          c.taken = true;
          score += 1;
        }
      }
    }

    if (coins.every(c => c.taken)) {
      gameOver = true;
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#334155';
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

    for (const c of coins) {
      if (c.taken) continue;
      ctx.beginPath();
      ctx.fillStyle = '#10b981';
      ctx.arc(c.x + c.r, c.y + c.r, c.r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#ef4444';
    for (const w of walls) {
      ctx.fillRect(w.x, w.y, w.w, w.h);
    }

    ctx.fillStyle = '#60a5fa';
    ctx.fillRect(player.x, player.y, player.w, player.h);

    ctx.fillStyle = '#e5e7eb';
    ctx.font = '16px monospace';
    ctx.fillText(`Score: ${score}`, 16, 24);

    if (!running) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#e5e7eb';
      ctx.font = '18px monospace';
      ctx.fillText('Press Start to Play', canvas.width / 2 - 90, canvas.height / 2);
    }

    if (gameOver) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#e5e7eb';
      ctx.font = '20px monospace';
      ctx.fillText(`Game Over! Score: ${score}`, canvas.width / 2 - 110, canvas.height / 2);
    }
  }

  let last = 0;
  function loop(ts) {
    const dt = (ts - last) / 1000;
    last = ts;
    if (!gameOver) {
      handleInput();
      update(dt);
    } else {
      running = false;
      submitBtn.disabled = false;
      restartBtn.disabled = false;
      statusEl.textContent = 'Game over. Enter name and click Submit Score, or Restart.';
    }
    draw();
    if (running) rafId = requestAnimationFrame(loop);
  }

  window.addEventListener('keydown', (e) => { keys[e.key] = true; });
  window.addEventListener('keyup', (e) => { keys[e.key] = false; });

  startBtn.addEventListener('click', () => {
    if (running) return;
    resetGame();
    running = true;
    statusEl.textContent = 'Collect all green coins. Avoid red walls.';
    last = performance.now();
    rafId = requestAnimationFrame(loop);
    startBtn.disabled = true;
    restartBtn.disabled = true;
  });

  restartBtn.addEventListener('click', () => {
    if (rafId) cancelAnimationFrame(rafId);
    resetGame();
    startBtn.disabled = true;
    running = true;
    last = performance.now();
    rafId = requestAnimationFrame(loop);
  });

  submitBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    if (!name) {
      statusEl.textContent = 'Please enter a name.';
      return;
    }
    try {
      statusEl.textContent = 'Submitting...';
      const res = await fetch(SCORE_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, score })
      });
      const data = await res.json();
      if (data.ok) {
        statusEl.textContent = 'Saved! Open Leaderboard to view.';
      } else {
        statusEl.textContent = 'Save failed. Try again.';
      }
    } catch (e) {
      statusEl.textContent = 'Network/Server error.';
    }
  });

  resetGame();
})();
