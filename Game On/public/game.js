/* 
  Combined Auth + Enhanced Arcade Game
  Version: 1.5.0 (Mini-Boss + Easier Difficulty)

  Additions:
    - Mini boss every 5 levels (5,10,15,...)
    - Boss health bar & behaviors (radial bursts, aimed shots, gentle homing, enrage)
    - Boss weak orbs (collect to damage boss)
    - Dash hit damages boss
  Easier difficulty tweaks:
    - Fewer orbs needed: 5 + floor(level * 1.1)
    - More generous time & slower scaling
    - Enemies appear later & slower (chasers from L4, turrets from L8)
    - Slightly higher player speed: 2.15
    - Weaker / slower enemy projectiles
  Retains:
    - Auth (login/register)
    - Hearts (animated), start 3s immortality, i-frames
    - Powerups, dash, combo, particles, scoring & submission
*/

(() => {
  console.log("[INIT] game.js v1.5.0 (boss + easier)");

  /***********************
   * DOM / AUTH
   ***********************/
  const authSection = document.getElementById("authSection");
  const gameSection = document.getElementById("gameSection");
  const authMessage = document.getElementById("authMessage");

  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const loginUsername = document.getElementById("loginUsername");
  const loginPassword = document.getElementById("loginPassword");
  const regUsername = document.getElementById("regUsername");
  const regPassword = document.getElementById("regPassword");
  const regPassword2 = document.getElementById("regPassword2");
  const loginSubmit = document.getElementById("loginSubmit");
  const registerSubmit = document.getElementById("registerSubmit");
  const tabs = Array.from(document.querySelectorAll(".auth-tab"));

  const startBtn = document.getElementById("startBtn");
  const restartBtn = document.getElementById("restartBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const statusEl = document.getElementById("status");
  const loggedUserLabel = document.getElementById("loggedUser");

  const canvas = document.getElementById("game");
  const ctx = canvas?.getContext("2d");

  const API = {
    login: "../server/login.php",
    register: "../server/register.php",
    score: "../server/score.php",
  };

  let username = localStorage.getItem("username") || "";

  function setAuthMessage(type, text) {
    if (!authMessage) return;
    if (!text) {
      authMessage.className = "auth-message";
      authMessage.textContent = "";
      return;
    }
    authMessage.className = `auth-message show ${type}`;
    authMessage.textContent = text;
  }

  function switchTab(name) {
    tabs.forEach((t) => {
      const active = t.dataset.tab === name;
      t.classList.toggle("active", active);
      t.setAttribute("aria-selected", active);
    });
    loginForm?.classList.toggle("active", name === "login");
    registerForm?.classList.toggle("active", name === "register");
    setAuthMessage("", "");
    (name === "login" ? loginUsername : regUsername)?.focus();
  }

  tabs.forEach((tab) =>
    tab.addEventListener("click", () => switchTab(tab.dataset.tab))
  );
  document
    .querySelectorAll("[data-switch]")
    .forEach((btn) =>
      btn.addEventListener("click", () => switchTab(btn.dataset.switch))
    );

  function disableAuth(dis) {
    loginSubmit && (loginSubmit.disabled = dis);
    registerSubmit && (registerSubmit.disabled = dis);
  }

  async function postJSON(url, payload) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error("Invalid server response");
    }
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  function showGameUI() {
    authSection && (authSection.style.display = "none");
    gameSection && (gameSection.style.display = "");
    loggedUserLabel &&
      (loggedUserLabel.textContent = `Signed in as: ${username}`);
    startBtn && (startBtn.disabled = false);
  }
  function showAuthUI() {
    authSection && (authSection.style.display = "");
    gameSection && (gameSection.style.display = "none");
  }
  function handleAuthSuccess(user) {
    username = user;
    localStorage.setItem("username", user);
    setAuthMessage("success", "Success!");
    showGameUI();
  }

  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const u = loginUsername.value.trim();
    const p = loginPassword.value;
    if (!u || !p) {
      setAuthMessage("error", "Please enter username & password.");
      return;
    }
    disableAuth(true);
    loginSubmit && (loginSubmit.textContent = "Signing in...");
    setAuthMessage("", "");
    try {
      const data = await postJSON(API.login, { username: u, password: p });
      data.ok
        ? handleAuthSuccess(u)
        : setAuthMessage("error", data.error || "Login failed.");
    } catch (err) {
      setAuthMessage("error", err.message);
    } finally {
      loginSubmit && (loginSubmit.textContent = "Sign In");
      disableAuth(false);
    }
  });

  registerForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const u = regUsername.value.trim();
    const p = regPassword.value;
    const p2 = regPassword2.value;
    if (!u || !p || !p2) {
      setAuthMessage("error", "All fields required.");
      return;
    }
    if (p.length < 6) {
      setAuthMessage("error", "Password must be at least 6 characters.");
      return;
    }
    if (p !== p2) {
      setAuthMessage("error", "Passwords do not match.");
      return;
    }
    disableAuth(true);
    registerSubmit && (registerSubmit.textContent = "Creating...");
    setAuthMessage("", "");
    try {
      const data = await postJSON(API.register, { username: u, password: p });
      if (data.ok) {
        handleAuthSuccess(u);
        setAuthMessage("success", "Account created.");
      } else setAuthMessage("error", data.error || "Registration failed.");
    } catch (err) {
      setAuthMessage("error", err.message);
    } finally {
      registerSubmit && (registerSubmit.textContent = "Create Account");
      disableAuth(false);
    }
  });

  logoutBtn?.addEventListener("click", () => {
    localStorage.removeItem("username");
    username = "";
    showAuthUI();
    setAuthMessage("success", "You have been logged out.");
    STATE.runState = "MENU";
    STATE.gameStarted = false;
    startBtn && (startBtn.disabled = false);
  });

  username ? showGameUI() : (showAuthUI(), switchTab("login"));

  /***********************
   * GAME CONFIG / STATE
   ***********************/
  const G = {
    version: "1.5.0",
    baseOrbValue: 10,
    comboWindow: 2.2,
    dashSpeed: 3.6,
    dashDuration: 0.12,
    dashCooldown: 1.6,
    maxHearts: 5,
    powerupChancePerLevel: 0.55,
    powerupLifetime: 14,
    slowFactor: 0.6,
    slowDuration: 6,
    multiplierDuration: 10,
    shieldColor: "#06b6d4",
    levelTimeBase: 48, // higher base time
    turretBulletSpeed: 2.0, // slower
    turretFireInterval: 4.2, // longer
    chaserTurnRate: 2.1,
    submitScoreOn: true,
    invulnDuration: 0.9,
    startImmortalDuration: 3.0,

    bossEvery: 5,
    bossBaseHP: 70,
    bossHPMult: 1.15,
    bossRadialInterval: 4.5,
    bossAimedInterval: 3.8,
    bossEnrageThreshold: 0.4,
    bossEnrageRadialMult: 0.6, // shorter interval
    bossEnrageAimedMult: 0.65,
    bossBulletSpeed: 2.2,
    bossRadialBullets: 14,
    bossDashDamage: 18,
    bossOrbDamage: 8,
    bossBonusBase: 600,
    bossBonusPerLevel: 120,
  };

  const STATE = {
    runState: "MENU",
    level: 1,
    score: 0,
    orbsCollectedThisLevel: 0,
    orbsNeeded: 0,
    timeRemaining: 0,
    combo: 0,
    lastOrbTime: 0,
    hearts: 3,
    shield: 0,
    slowUntil: 0,
    multiplierUntil: 0,
    dashActiveUntil: 0,
    dashReadyAt: 0,
    muted: false,
    lowGfx: false,
    floatingTexts: [],
    particles: [],
    enemies: [],
    bullets: [],
    turrets: [],
    orbs: [],
    powerups: [],
    gameStarted: false,
    lostHeartAnims: [],
    boss: null,
    bossBullets: [],
    bossWeakOrbs: [],
  };

  const player = {
    x: canvas.width / 2 - 8,
    y: canvas.height / 2 - 8,
    w: 18,
    h: 18,
    vx: 0,
    vy: 0,
    speed: 2.15, // easier movement
    accel: 0.55,
    friction: 0.85,
    invulnUntil: 0,
  };

  const keys = {};
  window.addEventListener("keydown", (e) => {
    keys[e.key] = true;
    if (e.key === " " && STATE.runState === "RUN") togglePause();
    else if (e.key === " " && STATE.runState === "PAUSED") togglePause();
    else if (e.key.toLowerCase() === "m") STATE.muted = !STATE.muted;
    else if (e.key.toLowerCase() === "l") STATE.lowGfx = !STATE.lowGfx;
    else if (e.key.toLowerCase() === "r" && STATE.runState === "GAME_OVER")
      quickRestart();
    else if (e.key === "Enter" && STATE.runState === "LEVEL_CLEAR") nextLevel();
  });
  window.addEventListener("keyup", (e) => (keys[e.key] = false));

  /***********************
   * UTILITIES
   ***********************/
  function rand(a, b) {
    return Math.random() * (b - a) + a;
  }
  function clamp(v, a, b) {
    return v < a ? a : v > b ? b : v;
  }
  function now() {
    return performance.now() / 1000;
  }

  let audioCtx;
  function beep(freq = 440, dur = 0.08, vol = 0.2, type = "sine") {
    if (STATE.muted) return;
    try {
      audioCtx =
        audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator(),
        g = audioCtx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.value = vol;
      o.connect(g);
      g.connect(audioCtx.destination);
      o.start();
      o.stop(audioCtx.currentTime + dur);
    } catch {}
  }

  /***********************
   * PARTICLES / TEXT
   ***********************/
  function addParticle(x, y, color, life = 0.6, size = 4) {
    if (STATE.lowGfx) return;
    STATE.particles.push({
      x,
      y,
      vx: rand(-1, 1),
      vy: rand(-1, 1),
      life,
      maxLife: life,
      size,
      color,
    });
  }
  function spawnBurst(x, y, color, c = 10) {
    for (let i = 0; i < c; i++)
      addParticle(x, y, color, rand(0.4, 0.9), rand(2, 5));
  }
  function addFloatingText(txt, x, y, color = "#fff", life = 1.2) {
    STATE.floatingTexts.push({ text: txt, x, y, color, life, maxLife: life });
  }

  /***********************
   * LEVEL SPAWN
   ***********************/
  function isBossLevel() {
    return STATE.level % G.bossEvery === 0;
  }

  function spawnOrbs(n) {
    STATE.orbs = [];
    for (let i = 0; i < n; i++)
      STATE.orbs.push({
        x: rand(30, canvas.width - 30),
        y: rand(30, canvas.height - 30),
        r: 7,
        pulse: Math.random() * Math.PI * 2,
      });
  }

  function spawnEnemies() {
    STATE.enemies = [];
    STATE.turrets = [];
    STATE.bullets = [];
    if (isBossLevel()) return; // no regular enemies on boss level (boss handles)
    const L = STATE.level;
    const patrolCount = Math.min(4 + Math.floor(L / 3), 9); // fewer
    const chaserCount = L >= 4 ? Math.min(1 + Math.floor((L - 3) / 3), 3) : 0;
    const turretCount = L >= 8 ? Math.min(1 + Math.floor((L - 7) / 5), 3) : 0;

    for (let i = 0; i < patrolCount; i++)
      STATE.enemies.push({
        type: "patrol",
        x: rand(40, canvas.width - 40),
        y: rand(40, canvas.height - 40),
        w: 22,
        h: 22,
        vx: rand(-1.2, 1.2) * (1 + L * 0.04),
        vy: rand(-1.2, 1.2) * (1 + L * 0.04),
        color: "#ef4444",
      });

    for (let i = 0; i < chaserCount; i++)
      STATE.enemies.push({
        type: "chaser",
        x: rand(40, canvas.width - 40),
        y: rand(40, canvas.height - 40),
        w: 24,
        h: 24,
        speed: 1.25 + L * 0.06,
        angle: rand(0, Math.PI * 2),
        color: "#f87171",
      });

    for (let i = 0; i < turretCount; i++)
      STATE.turrets.push({
        type: "turret",
        x: rand(60, canvas.width - 60),
        y: rand(60, canvas.height - 60),
        w: 26,
        h: 26,
        lastFire: 0,
        fireOffset: Math.random() * 1.5,
        color: "#fbbf24",
      });
  }

  function maybeSpawnPowerup() {
    if (Math.random() > G.powerupChancePerLevel) return;
    const kinds = ["shield", "slow", "heal", "mult"];
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    STATE.powerups.push({
      kind,
      x: rand(30, canvas.width - 30),
      y: rand(30, canvas.height - 30),
      r: 10,
      born: now(),
    });
  }

  /***********************
   * BOSS HANDLING
   ***********************/
  function setupBoss() {
    const levelFactor = Math.pow(G.bossHPMult, STATE.level / G.bossEvery);
    const baseHP = Math.round(G.bossBaseHP * levelFactor);
    STATE.boss = {
      x: canvas.width / 2,
      y: canvas.height / 2 - 40,
      w: 50,
      h: 50,
      vx: 0,
      vy: 0,
      hp: baseHP,
      maxHp: baseHP,
      lastRadial: 0,
      lastAimed: 0,
      weakOrbTimer: 0,
    };
    STATE.bossBullets = [];
    STATE.bossWeakOrbs = [];
    addFloatingText(
      "BOSS LEVEL!",
      canvas.width / 2 - 60,
      canvas.height / 2,
      "#fbbf24",
      2.5
    );
    spawnBurst(STATE.boss.x, STATE.boss.y, "#fbbf24", 50);
  }

  function spawnBossWeakOrb() {
    // Orbs around arena that damage boss when collected
    STATE.bossWeakOrbs.push({
      x: rand(40, canvas.width - 40),
      y: rand(40, canvas.height - 40),
      r: 8,
      pulse: 0,
      damage: G.bossOrbDamage,
    });
  }

  function bossFireRadial(t) {
    const enraged = STATE.boss.hp / STATE.boss.maxHp < G.bossEnrageThreshold;
    const count = G.bossRadialBullets + (enraged ? 4 : 0);
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2;
      STATE.bossBullets.push({
        x: STATE.boss.x,
        y: STATE.boss.y,
        vx: Math.cos(ang) * G.bossBulletSpeed * (enraged ? 1.2 : 1),
        vy: Math.sin(ang) * G.bossBulletSpeed * (enraged ? 1.2 : 1),
        life: 6,
        r: 6,
        color: enraged ? "#fb923c" : "#fbbf24",
      });
    }
    spawnBurst(STATE.boss.x, STATE.boss.y, enraged ? "#fb923c" : "#fbbf24", 25);
    beep(520, 0.12, 0.3, "square");
  }

  function bossFireAimed(t) {
    const px = player.x + player.w / 2;
    const py = player.y + player.h / 2;
    const ang = Math.atan2(py - STATE.boss.y, px - STATE.boss.x);
    STATE.bossBullets.push({
      x: STATE.boss.x,
      y: STATE.boss.y,
      vx: Math.cos(ang) * (G.bossBulletSpeed + 0.4),
      vy: Math.sin(ang) * (G.bossBulletSpeed + 0.4),
      life: 6,
      r: 7,
      color: "#fde047",
    });
    beep(420, 0.09, 0.28, "sawtooth");
  }

  function updateBoss(dt, t) {
    if (!STATE.boss) return;
    const b = STATE.boss;
    // Gentle homing drift
    const px = player.x + player.w / 2;
    const py = player.y + player.h / 2;
    const dx = px - b.x;
    const dy = py - b.y;
    const dist = Math.hypot(dx, dy) || 1;
    const speed = 0.8;
    b.vx += (dx / dist) * 0.02;
    b.vy += (dy / dist) * 0.02;
    b.vx = clamp(b.vx, -speed, speed);
    b.vy = clamp(b.vy, -speed, speed);
    b.x += b.vx;
    b.y += b.vy;
    b.x = clamp(b.x, 60, canvas.width - 60);
    b.y = clamp(b.y, 60, canvas.height - 60);

    const enraged = b.hp / b.maxHp < G.bossEnrageThreshold;
    const radialInt =
      G.bossRadialInterval * (enraged ? G.bossEnrageRadialMult : 1);
    const aimedInt =
      G.bossAimedInterval * (enraged ? G.bossEnrageAimedMult : 1);

    if (t - b.lastRadial > radialInt) {
      b.lastRadial = t;
      bossFireRadial(t);
    }
    if (t - b.lastAimed > aimedInt) {
      b.lastAimed = t;
      bossFireAimed(t);
    }

    // Generate weak orbs periodically
    b.weakOrbTimer += dt;
    const weakSpawnEvery = 3.5;
    if (b.weakOrbTimer > weakSpawnEvery) {
      b.weakOrbTimer = 0;
      spawnBossWeakOrb();
    }

    // Collect weak orbs for damage
    for (const orb of STATE.bossWeakOrbs) {
      orb.pulse += 0.04;
      const pdx = player.x + player.w / 2 - orb.x;
      const pdy = player.y + player.h / 2 - orb.y;
      if (pdx * pdx + pdy * pdy <= (orb.r + player.w * 0.4) ** 2) {
        // damage boss
        b.hp -= orb.damage;
        addFloatingText(`-${orb.damage}`, b.x, b.y - 30, "#f87171");
        spawnBurst(orb.x, orb.y, "#10b981", 14);
        orb.collected = true;
        beep(660, 0.07, 0.25, "triangle");
      }
    }
    STATE.bossWeakOrbs = STATE.bossWeakOrbs.filter((o) => !o.collected);

    // Boss bullets update
    for (const bb of STATE.bossBullets) {
      bb.x += bb.vx;
      bb.y += bb.vy;
      bb.life -= dt;
    }
    STATE.bossBullets = STATE.bossBullets.filter(
      (bb) =>
        bb.life > 0 &&
        bb.x > -20 &&
        bb.y > -20 &&
        bb.x < canvas.width + 20 &&
        bb.y < canvas.height + 20
    );

    // Boss defeat
    if (b.hp <= 0) {
      const bonus = G.bossBonusBase + STATE.level * G.bossBonusPerLevel;
      STATE.score += bonus;
      addFloatingText(
        `+${bonus} Boss Bonus!`,
        b.x - 40,
        b.y - 50,
        "#fbbf24",
        2.2
      );
      spawnBurst(b.x, b.y, "#fbbf24", 100);
      beep(900, 0.25, 0.35, "square");
      // Guarantee powerup
      maybeSpawnPowerup();
      STATE.boss = null;
      levelComplete();
    }
  }

  /***********************
   * LEVEL FLOW
   ***********************/
  function centerPlayer() {
    player.x = canvas.width / 2 - player.w / 2;
    player.y = canvas.height / 2 - player.h / 2;
    player.vx = player.vy = 0;
  }
  function setupLevel() {
    STATE.orbsCollectedThisLevel = 0;
    STATE.boss = null;
    STATE.bossBullets = [];
    STATE.bossWeakOrbs = [];
    if (isBossLevel()) {
      STATE.orbsNeeded = 0;
      spawnEnemies(); // none
      setupBoss();
    } else {
      STATE.orbsNeeded = 5 + Math.floor(STATE.level * 1.1);
      spawnOrbs(STATE.orbsNeeded);
      spawnEnemies();
      maybeSpawnPowerup();
    }
    // Easier timing
    STATE.timeRemaining =
      G.levelTimeBase + Math.max(0, (STATE.level - 1) * 3) - STATE.level * 0.8;
    addFloatingText(
      `Level ${STATE.level}`,
      canvas.width / 2 - 40,
      canvas.height / 2,
      "#93c5fd",
      2
    );
  }
  function grantStartImmortality() {
    const t = now();
    player.invulnUntil = t + G.startImmortalDuration;
    addFloatingText("IMMUNE 3s", player.x, player.y - 24, "#fbbf24", 2.2);
    spawnBurst(player.x + player.w / 2, player.y + player.h / 2, "#fbbf24", 28);
  }
  function startGame() {
    STATE.runState = "RUN";
    STATE.gameStarted = true;
    STATE.level = 1;
    STATE.score = 0;
    STATE.hearts = 3;
    STATE.shield = 0;
    STATE.slowUntil = STATE.multiplierUntil = 0;
    STATE.combo = 0;
    STATE.lostHeartAnims.length = 0;
    centerPlayer();
    setupLevel();
    grantStartImmortality();
    statusEl && (statusEl.textContent = "Level 1 - Go!");
  }
  function levelComplete() {
    // On boss or normal, we add bonus already (boss gave extra)
    const timeBonus = Math.floor(STATE.timeRemaining * 2.5);
    const levelBonus = 120 + STATE.level * 35;
    const mult = STATE.multiplierUntil > now() ? 2 : 1;
    const gained = (timeBonus + levelBonus) * mult;
    STATE.score += gained;
    addFloatingText(
      `+${gained} (Level Bonus)`,
      player.x,
      player.y - 10,
      "#38bdf8"
    );
    spawnBurst(player.x + player.w / 2, player.y + player.h / 2, "#3b82f6", 40);
    beep(820, 0.18, 0.3, "square");
    STATE.runState = "LEVEL_CLEAR";
    statusEl &&
      (statusEl.textContent = `Level ${STATE.level} clear! Enter for next`);
  }
  function nextLevel() {
    if (STATE.runState !== "LEVEL_CLEAR") return;
    STATE.level++;
    STATE.runState = "RUN";
    centerPlayer();
    setupLevel();
    statusEl && (statusEl.textContent = `Level ${STATE.level} - Go!`);
  }
  function gameOver() {
    if (STATE.runState === "GAME_OVER") return;
    STATE.runState = "GAME_OVER";
    statusEl && (statusEl.textContent = "Game Over - Restart / R");
    addFloatingText(
      "GAME OVER",
      canvas.width / 2 - 50,
      canvas.height / 2,
      "#f87171",
      3
    );
    spawnBurst(player.x + player.w / 2, player.y + player.h / 2, "#ef4444", 60);
    restartBtn && (restartBtn.disabled = false);
    submitScore();
  }
  function restartGame() {
    STATE.runState = "RUN";
    STATE.level = 1;
    STATE.score = 0;
    STATE.hearts = 3;
    STATE.shield = 0;
    STATE.slowUntil = 0;
    STATE.multiplierUntil = 0;
    STATE.combo = 0;
    STATE.lostHeartAnims.length = 0;
    centerPlayer();
    setupLevel();
    grantStartImmortality();
    statusEl && (statusEl.textContent = "Level 1 - Go!");
    restartBtn && (restartBtn.disabled = true);
  }
  function quickRestart() {
    if (STATE.runState === "GAME_OVER") restartGame();
  }
  function togglePause() {
    if (
      !STATE.gameStarted ||
      ["GAME_OVER", "LEVEL_CLEAR"].includes(STATE.runState)
    )
      return;
    STATE.runState = STATE.runState === "PAUSED" ? "RUN" : "PAUSED";
    statusEl &&
      (statusEl.textContent =
        STATE.runState === "PAUSED" ? "Paused" : "Resumed");
  }
  function submitScore() {
    if (!username || !G.submitScoreOn) return;
    fetch(API.score, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, score: STATE.score }),
    }).catch((e) => console.warn("[score submit]", e));
  }

  /***********************
   * PLAYER UPDATE
   ***********************/
  function updatePlayer(dt) {
    if (STATE.runState !== "RUN") return;
    let ax = 0,
      ay = 0;
    if (keys["ArrowLeft"] || keys["a"]) ax -= player.accel;
    if (keys["ArrowRight"] || keys["d"]) ax += player.accel;
    if (keys["ArrowUp"] || keys["w"]) ay -= player.accel;
    if (keys["ArrowDown"] || keys["s"]) ay += player.accel;
    player.vx += ax;
    player.vy += ay;
    player.vx *= player.friction;
    player.vy *= player.friction;
    if (
      (keys["Shift"] || keys["ShiftLeft"] || keys["ShiftRight"]) &&
      now() > STATE.dashReadyAt
    ) {
      STATE.dashActiveUntil = now() + G.dashDuration;
      STATE.dashReadyAt = now() + G.dashCooldown;
      spawnBurst(
        player.x + player.w / 2,
        player.y + player.h / 2,
        "#38bdf8",
        14
      );
      beep(600, 0.09, 0.22, "sawtooth");
    }
    const maxSpeed = STATE.dashActiveUntil > now() ? G.dashSpeed : player.speed;
    const spd = Math.hypot(player.vx, player.vy);
    if (spd > maxSpeed) {
      player.vx = (player.vx / spd) * maxSpeed;
      player.vy = (player.vy / spd) * maxSpeed;
    }
    player.x += player.vx;
    player.y += player.vy;
    player.x = clamp(player.x, 5, canvas.width - player.w - 5);
    player.y = clamp(player.y, 5, canvas.height - player.h - 5);
  }

  /***********************
   * NORMAL ENEMY LOGIC
   ***********************/
  function fireTurret(turret) {
    const px = player.x + player.w / 2,
      py = player.y + player.h / 2;
    const ang = Math.atan2(py - turret.y, px - turret.x);
    STATE.bullets.push({
      x: turret.x,
      y: turret.y,
      vx: Math.cos(ang) * G.turretBulletSpeed,
      vy: Math.sin(ang) * G.turretBulletSpeed,
      life: 6,
      r: 5,
      color: "#fbbf24",
    });
    spawnBurst(turret.x, turret.y, "#fbbf24", 6);
    beep(300, 0.05, 0.14, "square");
  }

  function updateEnemies(dt, t) {
    if (isBossLevel()) return;
    const slow = t < STATE.slowUntil;
    const slowMul = slow ? G.slowFactor : 1;
    for (const e of STATE.enemies) {
      if (e.type === "patrol") {
        e.x += e.vx * slowMul;
        e.y += e.vy * slowMul;
        if (e.x < 10 || e.x + e.w > canvas.width - 10) e.vx *= -1;
        if (e.y < 10 || e.y + e.h > canvas.height - 10) e.vy *= -1;
      } else if (e.type === "chaser") {
        const px = player.x + player.w / 2,
          py = player.y + player.h / 2;
        const angTo = Math.atan2(py - e.y, px - e.x);
        let diff = angTo - e.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const turn = G.chaserTurnRate * dt;
        if (diff > turn) diff = turn;
        else if (diff < -turn) diff = -turn;
        e.angle += diff;
        e.x += Math.cos(e.angle) * e.speed * slowMul;
        e.y += Math.sin(e.angle) * e.speed * slowMul;
        e.x = clamp(e.x, 10, canvas.width - e.w - 10);
        e.y = clamp(e.y, 10, canvas.height - e.h - 10);
      }
    }
    for (const tur of STATE.turrets) {
      if (
        t - tur.lastFire >
        G.turretFireInterval -
          Math.min(STATE.level * 0.08, 1.2) +
          tur.fireOffset
      ) {
        tur.lastFire = t;
        fireTurret(tur);
      }
    }
    for (const b of STATE.bullets) {
      b.x += b.vx;
      b.y += b.vy;
      b.life -= dt;
    }
    STATE.bullets = STATE.bullets.filter(
      (b) =>
        b.life > 0 &&
        b.x > -10 &&
        b.y > -10 &&
        b.x < canvas.width + 10 &&
        b.y < canvas.height + 10
    );
  }

  /***********************
   * ORBS & COLLECTION
   ***********************/
  function collectOrbs(t) {
    if (isBossLevel()) return; // normal orbs only non-boss
    for (const orb of STATE.orbs) {
      if (orb.collected) continue;
      const dx = player.x + player.w / 2 - orb.x;
      const dy = player.y + player.h / 2 - orb.y;
      if (dx * dx + dy * dy <= (orb.r + player.w * 0.4) ** 2) {
        orb.collected = true;
        const inCombo = t - STATE.lastOrbTime <= G.comboWindow;
        STATE.combo = inCombo ? STATE.combo + 1 : 1;
        STATE.lastOrbTime = t;
        const mult = STATE.multiplierUntil > t ? 2 : 1;
        const val =
          (G.baseOrbValue + Math.ceil(STATE.level * 1.1)) * STATE.combo * mult;
        STATE.score += val;
        STATE.orbsCollectedThisLevel++;
        addFloatingText(
          `+${val}${STATE.combo > 1 ? " x" + STATE.combo : ""}`,
          orb.x,
          orb.y - 12,
          "#10b981"
        );
        spawnBurst(orb.x, orb.y, "#10b981", 12 + Math.min(STATE.combo * 2, 16));
        beep(440 + Math.min(STATE.combo, 8) * 55, 0.07, 0.18, "triangle");
        if (STATE.orbsCollectedThisLevel >= STATE.orbsNeeded) levelComplete();
      }
    }
  }

  /***********************
   * POWERUPS
   ***********************/
  function handlePowerups(t) {
    STATE.powerups = STATE.powerups.filter(
      (p) => t - p.born < G.powerupLifetime
    );
    for (const p of STATE.powerups) {
      const dx = player.x + player.w / 2 - p.x;
      const dy = player.y + player.h / 2 - p.y;
      if (dx * dx + dy * dy < (p.r + player.w * 0.4) ** 2) {
        applyPowerup(p.kind, t);
        p.consumed = true;
        spawnBurst(p.x, p.y, "#38bdf8", 16);
        beep(700, 0.14, 0.24, "sawtooth");
        addFloatingText(p.kind.toUpperCase(), p.x - 12, p.y - 18, "#38bdf8");
      }
    }
    STATE.powerups = STATE.powerups.filter((p) => !p.consumed);
  }
  function applyPowerup(kind, t) {
    if (kind === "shield") STATE.shield = 1;
    else if (kind === "slow") STATE.slowUntil = t + G.slowDuration;
    else if (kind === "heal") {
      if (STATE.hearts < G.maxHearts) STATE.hearts++;
      else {
        STATE.score += 100;
        addFloatingText("+100 BONUS", player.x, player.y - 10, "#10b981");
      }
    } else if (kind === "mult")
      STATE.multiplierUntil = t + G.multiplierDuration;
  }

  /***********************
   * HEART LOSS ANIM
   ***********************/
  function recordHeartLoss(index) {
    const size = 16;
    const spacing = 24;
    const x = 10 + index * spacing + size / 2;
    const y = 70 + size / 2;
    STATE.lostHeartAnims.push({
      x,
      y,
      age: 0,
      life: 0.65,
      rotation: Math.random() * Math.PI * 2,
      spin: (Math.random() > 0.5 ? 1 : -1) * (1.5 + Math.random() * 1.5),
    });
    spawnBurst(x, y, "#f87171", 12);
  }

  /***********************
   * DAMAGE / COLLISIONS
   ***********************/
  function damagePlayer(hitX, hitY) {
    const t = now();
    if (t < player.invulnUntil) return;
    if (STATE.shield > 0) {
      STATE.shield = 0;
      spawnBurst(
        player.x + player.w / 2,
        player.y + player.h / 2,
        G.shieldColor,
        26
      );
      addFloatingText("Shield!", player.x, player.y - 15, G.shieldColor);
      beep(200, 0.08, 0.25, "sine");
      player.invulnUntil = t + G.invulnDuration * 0.6;
      return;
    }
    const prev = STATE.hearts;
    STATE.hearts--;
    spawnBurst(player.x + player.w / 2, player.y + player.h / 2, "#ef4444", 34);
    addFloatingText("-1 HEART", player.x, player.y - 12, "#ef4444");
    beep(120, 0.18, 0.3, "square");
    recordHeartLoss(prev - 1);

    let dx = player.x + player.w / 2 - (hitX ?? player.x + player.w / 2);
    let dy = player.y + player.h / 2 - (hitY ?? player.y + player.h / 2);
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    const kb = 60;
    player.x = clamp(player.x + dx * kb, 5, canvas.width - player.w - 5);
    player.y = clamp(player.y + dy * kb, 5, canvas.height - player.h - 5);
    player.vx = dx * 2.2;
    player.vy = dy * 2.2;

    player.invulnUntil = t + G.invulnDuration;
    if (STATE.hearts <= 0) gameOver();
  }

  function rectOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }
  function circleRect(cx, cy, cr, rx, ry, rw, rh) {
    const x = Math.max(rx, Math.min(cx, rx + rw));
    const y = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - x,
      dy = cy - y;
    return dx * dx + dy * dy <= cr * cr;
  }

  function checkCollisions(t) {
    if (STATE.runState !== "RUN") return;
    if (isBossLevel()) {
      // Dash hit on boss damages it
      if (STATE.boss) {
        if (
          rectOverlap(
            player.x,
            player.y,
            player.w,
            player.h,
            STATE.boss.x - STATE.boss.w / 2,
            STATE.boss.y - STATE.boss.h / 2,
            STATE.boss.w,
            STATE.boss.h
          )
        ) {
          if (STATE.dashActiveUntil > t) {
            STATE.boss.hp -= G.bossDashDamage;
            addFloatingText(
              `-${G.bossDashDamage}`,
              STATE.boss.x,
              STATE.boss.y - 35,
              "#f87171"
            );
            spawnBurst(STATE.boss.x, STATE.boss.y, "#f87171", 30);
            beep(700, 0.12, 0.3, "triangle");
          } else {
            damagePlayer(STATE.boss.x, STATE.boss.y);
          }
        }
      }
      // Boss bullets -> player
      for (const bb of STATE.bossBullets) {
        if (
          circleRect(bb.x, bb.y, bb.r, player.x, player.y, player.w, player.h)
        ) {
          bb.life = 0;
          if (STATE.dashActiveUntil > t) {
            spawnBurst(bb.x, bb.y, "#64748b", 8);
            addFloatingText("DODGE", bb.x, bb.y - 10, "#64748b");
          } else {
            damagePlayer(bb.x, bb.y);
          }
        }
      }
      return;
    }
    // Regular enemies
    for (const e of STATE.enemies) {
      if (
        rectOverlap(player.x, player.y, player.w, player.h, e.x, e.y, e.w, e.h)
      ) {
        if (STATE.dashActiveUntil > t) {
          spawnBurst(e.x + e.w / 2, e.y + e.h / 2, "#f87171", 20);
          e.x = rand(40, canvas.width - 40);
          e.y = rand(40, canvas.height - 40);
          beep(180, 0.06, 0.2, "square");
          STATE.score += 25;
          addFloatingText("+25", e.x, e.y - 10, "#f87171");
        } else {
          damagePlayer(e.x + e.w / 2, e.y + e.h / 2);
        }
      }
    }
    // Turret bullets
    for (const b of STATE.bullets) {
      if (circleRect(b.x, b.y, b.r, player.x, player.y, player.w, player.h)) {
        b.life = 0;
        if (STATE.dashActiveUntil > t) {
          spawnBurst(b.x, b.y, "#64748b", 8);
          addFloatingText("DODGE", b.x, b.y - 10, "#64748b");
        } else {
          damagePlayer(b.x, b.y);
        }
      }
    }
  }

  /***********************
   * TIMERS / ANIM LISTS
   ***********************/
  function updateTimers(dt) {
    if (STATE.runState === "RUN") {
      STATE.timeRemaining -= dt;
      if (STATE.timeRemaining <= 0) gameOver();
    }
  }
  function updateParticles(dt) {
    for (const p of STATE.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= dt;
    }
    STATE.particles = STATE.particles.filter((p) => p.life > 0);
  }
  function updateFloatingTexts(dt) {
    for (const ft of STATE.floatingTexts) {
      ft.y -= dt * 18;
      ft.life -= dt;
    }
    STATE.floatingTexts = STATE.floatingTexts.filter((ft) => ft.life > 0);
  }
  function updateLostHeartAnims(dt) {
    for (const h of STATE.lostHeartAnims) h.age += dt;
    STATE.lostHeartAnims = STATE.lostHeartAnims.filter((h) => h.age < h.life);
  }

  /***********************
   * RENDER HELPERS
   ***********************/
  function drawHeartShape(
    x,
    y,
    size,
    fill,
    outline,
    alpha = 1,
    scale = 1,
    rot = 0
  ) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.rotate(rot);
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    const w = size,
      h = size;
    ctx.moveTo(0, h * 0.3);
    ctx.bezierCurveTo(0, 0, -w * 0.5, 0, -w * 0.5, h * 0.35);
    ctx.bezierCurveTo(-w * 0.5, h * 0.7, -0.15 * w, h * 0.9, 0, h);
    ctx.bezierCurveTo(0.15 * w, h * 0.9, w * 0.5, h * 0.7, w * 0.5, h * 0.35);
    ctx.bezierCurveTo(w * 0.5, 0, 0, 0, 0, h * 0.3);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (outline) {
      ctx.strokeStyle = outline;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  /***********************
   * RENDER
   ***********************/
  function drawBackground() {
    ctx.fillStyle = "#0b1322";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!STATE.lowGfx) {
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      const step = 40;
      ctx.beginPath();
      for (let x = 0; x < canvas.width; x += step) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
      }
      for (let y = 0; y < canvas.height; y += step) {
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
      }
      ctx.stroke();
    }
  }

  function drawOrbs(t) {
    if (isBossLevel()) {
      // Draw boss weak orbs
      for (const o of STATE.bossWeakOrbs) {
        o.pulse += 0.05;
        const r = o.r + Math.sin(o.pulse) * 1.8;
        ctx.beginPath();
        ctx.fillStyle = "#10b981";
        ctx.arc(o.x, o.y, r, 0, Math.PI * 2);
        ctx.fill();
        if (!STATE.lowGfx) {
          ctx.strokeStyle = "rgba(255,255,255,0.25)";
          ctx.stroke();
        }
      }
      return;
    }
    for (const o of STATE.orbs) {
      if (o.collected) continue;
      o.pulse += 0.04;
      const rr = o.r + Math.sin(o.pulse) * 1.5;
      ctx.beginPath();
      ctx.fillStyle = "#10b981";
      ctx.arc(o.x, o.y, rr, 0, Math.PI * 2);
      ctx.fill();
      if (!STATE.lowGfx) {
        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.stroke();
      }
    }
  }

  function drawPowerups(t) {
    for (const p of STATE.powerups) {
      const age = t - p.born;
      const pulse = 0.6 + Math.sin(age * 4) * 0.15;
      let color =
        p.kind === "shield"
          ? G.shieldColor
          : p.kind === "slow"
          ? "#a855f7"
          : p.kind === "heal"
          ? "#22c55e"
          : "#fbbf24";
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(pulse, pulse);
      if (p.kind === "heal") {
        ctx.fillStyle = color;
        ctx.fillRect(-7, -3, 14, 6);
        ctx.fillRect(-3, -7, 6, 14);
      } else if (p.kind === "shield") {
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.kind === "slow") {
        ctx.fillStyle = color;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3;
          ctx.lineTo(Math.cos(a) * 9, Math.sin(a) * 9);
        }
        ctx.closePath();
        ctx.fill();
      } else {
        // multiplier star
        ctx.fillStyle = color;
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const a = (i * 2 * Math.PI) / 5 - Math.PI / 2;
          const r = i % 2 === 0 ? 10 : 4;
          ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawEnemies(t) {
    if (isBossLevel()) return;
    for (const e of STATE.enemies) {
      ctx.save();
      if (e.type === "patrol") {
        ctx.fillStyle = e.color;
        ctx.fillRect(e.x, e.y, e.w, e.h);
        if (!STATE.lowGfx) {
          ctx.strokeStyle = "rgba(0,0,0,0.3)";
          ctx.strokeRect(e.x, e.y, e.w, e.h);
        }
      } else if (e.type === "chaser") {
        ctx.translate(e.x + e.w / 2, e.y + e.h / 2);
        ctx.rotate(e.angle);
        ctx.fillStyle = e.color;
        ctx.fillRect(-e.w / 2, -e.h / 2, e.w, e.h);
        ctx.fillStyle = "#1e293b";
        ctx.fillRect(2, -4, 6, 8);
      }
      ctx.restore();
    }
    for (const turr of STATE.turrets) {
      ctx.fillStyle = turr.color;
      ctx.fillRect(turr.x - turr.w / 2, turr.y - turr.h / 2, turr.w, turr.h);
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(turr.x - 6, turr.y - 6, 12, 12);
    }
    for (const b of STATE.bullets) {
      ctx.beginPath();
      ctx.fillStyle = b.color;
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBoss(t) {
    if (!STATE.boss) return;
    const b = STATE.boss;
    // Body
    const enraged = b.hp / b.maxHp < G.bossEnrageThreshold;
    ctx.save();
    ctx.translate(b.x, b.y);
    const pulse = 1 + Math.sin(t * 3) * (enraged ? 0.15 : 0.08);
    ctx.scale(pulse, pulse);
    // Aura
    if (!STATE.lowGfx) {
      ctx.globalAlpha = 0.25 + (enraged ? 0.15 : 0.08);
      ctx.beginPath();
      ctx.fillStyle = enraged ? "#fb923c" : "#fbbf24";
      ctx.arc(0, 0, b.w * 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = enraged ? "#ea580c" : "#f59e0b";
    ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(-10, -12, 20, 10);
    ctx.restore();

    // Boss bullets
    for (const bb of STATE.bossBullets) {
      ctx.beginPath();
      ctx.fillStyle = bb.color;
      ctx.arc(bb.x, bb.y, bb.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPlayer(t) {
    ctx.save();
    const invuln = t < player.invulnUntil;
    ctx.translate(player.x + player.w / 2, player.y + player.h / 2);

    const remaining = player.invulnUntil - t;
    if (invuln && remaining > G.invulnDuration * 0.5) {
      ctx.globalAlpha = 0.35 + Math.sin(t * 10) * 0.15;
      ctx.beginPath();
      ctx.fillStyle = "#fbbf24";
      ctx.arc(0, 0, player.w * 1.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    if (STATE.dashActiveUntil > t && !STATE.lowGfx) {
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = "#38bdf8";
      ctx.fillRect(-player.w / 2, -player.h / 2, player.w, player.h);
      ctx.globalAlpha = 1;
    }
    if (invuln) {
      const phase = Math.sin((player.invulnUntil - t) * 22);
      ctx.globalAlpha = phase > 0 ? 0.35 : 0.85;
    }
    ctx.fillStyle = "#3b82f6";
    ctx.fillRect(-player.w / 2, -player.h / 2, player.w, player.h);
    if (STATE.shield > 0) {
      ctx.strokeStyle = G.shieldColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, player.w * 0.9, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawParticles() {
    if (STATE.lowGfx) return;
    for (const p of STATE.particles) {
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawFloatingTexts() {
    ctx.save();
    ctx.font = "12px monospace";
    ctx.textBaseline = "middle";
    for (const ft of STATE.floatingTexts) {
      ctx.globalAlpha = ft.life / ft.maxLife;
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawHeartHUD(t) {
    const size = 16,
      spacing = 24;
    for (let i = 0; i < G.maxHearts; i++) {
      const x = 10 + i * spacing + size / 2;
      const y = 70 + size / 2;
      if (i < STATE.hearts)
        drawHeartShape(x, y - size / 2, size, "#ef4444", "#991b1b", 1, 1);
      else
        drawHeartShape(
          x,
          y - size / 2,
          size,
          null,
          "rgba(255,255,255,0.25)",
          0.5,
          1
        );
    }
    for (const h of STATE.lostHeartAnims) {
      const k = h.age / h.life;
      const scale = 1 + k * 1.1;
      const alpha = 1 - k;
      drawHeartShape(
        h.x,
        h.y - 8,
        16,
        "#f87171",
        "#ef4444",
        alpha,
        scale,
        h.rotation + k * h.spin
      );
    }
  }

  function drawBossHUD() {
    if (!STATE.boss) return;
    const b = STATE.boss;
    const barW = 300;
    const barH = 14;
    const x = canvas.width / 2 - barW / 2;
    const y = 8;
    const pct = Math.max(0, b.hp / b.maxHp);
    ctx.save();
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(x, y, barW, barH);
    ctx.fillStyle = pct < G.bossEnrageThreshold ? "#f97316" : "#fbbf24";
    ctx.fillRect(x, y, barW * pct, barH);
    ctx.strokeStyle = "#334155";
    ctx.strokeRect(x, y, barW, barH);
    ctx.font = "12px monospace";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText(
      `BOSS HP: ${Math.ceil(b.hp)}/${b.maxHp}`,
      canvas.width / 2,
      y + barH + 10
    );
    ctx.restore();
  }

  function drawHUD(t) {
    ctx.save();
    ctx.font = "16px monospace";
    ctx.fillStyle = "#e2e8f0";
    ctx.textBaseline = "top";
    ctx.fillText(`Score: ${STATE.score}`, 10, 8);
    if (isBossLevel()) {
      ctx.fillText(`Level: ${STATE.level} (Boss)`, 10, 28);
    } else {
      ctx.fillText(`Level: ${STATE.level}`, 10, 28);
    }
    ctx.fillStyle = STATE.timeRemaining < 10 ? "#f87171" : "#93c5fd";
    ctx.fillText(
      `Time: ${Math.max(0, STATE.timeRemaining).toFixed(1)}`,
      10,
      48
    );

    drawHeartHUD(t);
    if (STATE.combo > 1 && STATE.runState === "RUN") {
      ctx.fillStyle = "#fbbf24";
      ctx.fillText(`Combo x${STATE.combo}`, 10, 118);
    }
    let py = 138;
    if (STATE.multiplierUntil > t) {
      ctx.fillStyle = "#fbbf24";
      ctx.fillText(`2x ${(STATE.multiplierUntil - t).toFixed(1)}s`, 10, py);
      py += 20;
    }
    if (STATE.slowUntil > t) {
      ctx.fillStyle = "#c084fc";
      ctx.fillText(`Slow ${(STATE.slowUntil - t).toFixed(1)}s`, 10, py);
      py += 20;
    }
    const dashReady = t >= STATE.dashReadyAt;
    ctx.fillStyle = dashReady ? "#38bdf8" : "#64748b";
    ctx.fillText(
      "Dash " +
        (dashReady ? "READY" : (STATE.dashReadyAt - t).toFixed(1) + "s"),
      10,
      py
    );
    py += 20;
    const remainImmune = player.invulnUntil - t;
    if (remainImmune > 0.05) {
      ctx.fillStyle = "#fbbf24";
      ctx.fillText(`Immune: ${remainImmune.toFixed(1)}s`, 10, py);
      py += 20;
    }

    drawBossHUD();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (STATE.runState === "MENU") {
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "24px monospace";
      ctx.fillText(
        "Press Start to Begin",
        canvas.width / 2,
        canvas.height / 2 - 30
      );
      ctx.font = "14px monospace";
      ctx.fillText(
        "Collect Orbs / Defeat Boss every 5 Levels!",
        canvas.width / 2,
        canvas.height / 2 + 4
      );
      ctx.fillText(
        "WASD/Arrows Move, Shift Dash, Space Pause, M Mute, L LowGfx",
        canvas.width / 2,
        canvas.height / 2 + 28
      );
    }
    if (STATE.runState === "PAUSED") {
      ctx.fillStyle = "rgba(0,0,0,.55)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "28px monospace";
      ctx.fillText("PAUSED", canvas.width / 2, canvas.height / 2 - 20);
      ctx.font = "14px monospace";
      ctx.fillText("Space to Resume", canvas.width / 2, canvas.height / 2 + 12);
    }
    if (STATE.runState === "LEVEL_CLEAR") {
      ctx.fillStyle = "rgba(0,0,0,.55)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#bbf7d0";
      ctx.font = "24px monospace";
      ctx.fillText(
        `Level ${STATE.level} Complete!`,
        canvas.width / 2,
        canvas.height / 2 - 20
      );
      ctx.font = "16px monospace";
      ctx.fillText(
        "Enter for next level",
        canvas.width / 2,
        canvas.height / 2 + 10
      );
    }
    if (STATE.runState === "GAME_OVER") {
      ctx.fillStyle = "rgba(0,0,0,.6)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#f87171";
      ctx.font = "30px monospace";
      ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 30);
      ctx.font = "18px monospace";
      ctx.fillStyle = "#e2e8f0";
      ctx.fillText(
        `Final Score: ${STATE.score}`,
        canvas.width / 2,
        canvas.height / 2 + 4
      );
      ctx.font = "14px monospace";
      ctx.fillText(
        "Restart button or R to play again",
        canvas.width / 2,
        canvas.height / 2 + 34
      );
    }
    ctx.restore();
  }

  /***********************
   * MAIN LOOP
   ***********************/
  let lastT = now();
  function update() {
    const t = now();
    const dt = Math.min(0.05, t - lastT);
    lastT = t;
    if (STATE.runState === "RUN") {
      updatePlayer(dt);
      if (isBossLevel()) updateBoss(dt, t);
      else updateEnemies(dt, t);
      collectOrbs(t);
      handlePowerups(t);
      checkCollisions(t);
      updateTimers(dt);
    }
    updateParticles(dt);
    updateFloatingTexts(dt);
    updateLostHeartAnims(dt);
  }
  function render() {
    drawBackground();
    const t = now();
    drawOrbs(t);
    drawPowerups(t);
    if (isBossLevel()) drawBoss(t);
    else drawEnemies(t);
    drawPlayer(t);
    drawParticles();
    drawFloatingTexts();
    drawHUD(t);
  }
  function loop() {
    update();
    render();
    requestAnimationFrame(loop);
  }

  /***********************
   * BUTTON EVENTS
   ***********************/
  startBtn?.addEventListener("click", () => {
    if (!STATE.gameStarted) {
      startGame();
      startBtn && (startBtn.disabled = true);
      restartBtn && (restartBtn.disabled = true);
    }
  });
  restartBtn?.addEventListener("click", () => {
    if (STATE.runState === "GAME_OVER") {
      restartGame();
      startBtn && (startBtn.disabled = true);
    }
  });

  /***********************
   * INIT
   ***********************/
  STATE.runState = "MENU";
  restartBtn && (restartBtn.disabled = true);
  loop();
  console.log("[READY] Boss & easier difficulty active.");
})();
