(function () {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const timerEl = document.getElementById("timer");
  const heartsEl = document.getElementById("hearts");
  const hintEl = document.getElementById("hint");
  const startScreen = document.getElementById("startScreen");
  const endScreen = document.getElementById("endScreen");
  const btnStart = document.getElementById("btnStart");
  const btnAgain = document.getElementById("btnAgain");
  const btnClose = document.getElementById("btnClose");
  const finalScoreEl = document.getElementById("finalScore");
  const endTitle = document.getElementById("endTitle");
  const endSubtitle = document.getElementById("endSubtitle");
  const endMeta = document.getElementById("endMeta");

  const GAME_DURATION = 60;
  const MAX_LIVES = 3;
  const PADDLE_W = 0.14;
  const PADDLE_H = 0.022;
  const BASE_SPAWN_MS = 920;
  const MIN_SPAWN_MS = 380;

  const GOOD_KINDS = ["orange", "lemon", "apple"];
  const BAD_KINDS = ["teapot", "ball", "racket"];
  const EMOJI = {
    orange: "\u{1F34A}",
    lemon: "\u{1F34B}",
    apple: "\u{1F34E}",
    teapot: "\u{1FAD6}",
    ball: "\u{26BD}",
    racket: "\u{1F3F8}",
  };

  let W = 900;
  let H = 560;
  let dpr = 1;

  let state = "menu";
  let score = 0;
  let combo = 0;
  let lives = MAX_LIVES;
  let timeLeft = GAME_DURATION;
  let lastTs = 0;
  let spawnAcc = 0;
  let paddleX = 0.5;
  let items = [];
  let floatTexts = [];
  let shake = 0;
  let flashBad = 0;

  function resize() {
    const wrap = canvas.parentElement;
    const maxW = Math.min(wrap.clientWidth, 900);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.floor(maxW * dpr);
    H = Math.floor((maxW * (560 / 900)) * dpr);
    canvas.width = W;
    canvas.height = H;
    canvas.style.height = `${maxW * (560 / 900)}px`;
  }

  function spawnItem() {
    const goodChance = 0.58 + Math.min(0.12, (GAME_DURATION - timeLeft) / GAME_DURATION * 0.12);
    const isGood = Math.random() < goodChance;
    const size = (0.028 + Math.random() * 0.018) * Math.min(W, H);
    const pool = isGood ? GOOD_KINDS : BAD_KINDS;
    const kind = pool[(Math.random() * pool.length) | 0];
    items.push({
      x: size + Math.random() * (W - 2 * size),
      y: -size,
      vy: (0.12 + Math.random() * 0.16) * H * 0.016,
      r: size * 0.5,
      good: isGood,
      kind,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.05,
    });
  }

  function addFloat(x, y, text, color) {
    floatTexts.push({ x, y, text, color, t: 0, life: 1 });
  }

  function paddleRect() {
    const pw = W * PADDLE_W;
    const ph = H * PADDLE_H;
    const px = paddleX * W - pw / 2;
    const py = H - ph - H * 0.04;
    return { px, py, pw, ph };
  }

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "rgba(20, 30, 55, 0.5)");
    g.addColorStop(1, "rgba(7, 10, 18, 0.95)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = "rgba(34, 211, 238, 0.06)";
    ctx.lineWidth = 1 * dpr;
    const step = 48 * dpr;
    for (let x = 0; x < W; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y < H; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
  }

  function drawItem(it) {
    ctx.save();
    ctx.translate(it.x, it.y);
    ctx.rotate(it.rot);

    const r = it.r;
    const ch = EMOJI[it.kind] || (it.good ? EMOJI.orange : EMOJI.ball);
    const fontPx = Math.max(14 * dpr, r * 2.35);
    ctx.font = `${fontPx}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (it.good) {
      ctx.shadowColor = "rgba(34, 211, 238, 0.55)";
      ctx.shadowBlur = 20 * dpr;
    } else {
      ctx.shadowColor = "rgba(251, 113, 133, 0.45)";
      ctx.shadowBlur = 16 * dpr;
    }
    ctx.fillText(ch, 0, 0);
    ctx.shadowBlur = 0;

    ctx.restore();
  }

  function drawPaddle() {
    const { px, py, pw, ph } = paddleRect();
    const grd = ctx.createLinearGradient(px, py, px, py + ph);
    grd.addColorStop(0, "rgba(167, 139, 250, 0.95)");
    grd.addColorStop(1, "rgba(34, 211, 238, 0.75)");
    ctx.save();
    ctx.shadowColor = "rgba(34, 211, 238, 0.5)";
    ctx.shadowBlur = 20 * dpr;
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, ph * 0.45);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1.5 * dpr;
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = `600 ${11 * dpr}px Outfit, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("КОРЗИНА", px + pw / 2, py + ph / 2);
    ctx.restore();
  }

  function drawFloats(dt) {
    for (let i = floatTexts.length - 1; i >= 0; i--) {
      const f = floatTexts[i];
      f.t += dt;
      f.y -= 40 * dt * dpr;
      const a = 1 - f.t / f.life;
      if (a <= 0) {
        floatTexts.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.globalAlpha = Math.max(0, a);
      ctx.font = `700 ${14 * dpr}px Outfit, sans-serif`;
      ctx.fillStyle = f.color;
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur = 4;
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }
  }

  function updateHearts() {
    heartsEl.innerHTML = "";
    for (let i = 0; i < MAX_LIVES; i++) {
      const span = document.createElement("span");
      span.className = "heart" + (i >= lives ? " heart--lost" : "");
      span.textContent = "♥";
      span.setAttribute("aria-hidden", "true");
      heartsEl.appendChild(span);
    }
  }

  function setPointer(e, rect) {
    const x = (e.clientX !== undefined ? e.clientX : e.touches[0].clientX) - rect.left;
    const nx = x / rect.width;
    paddleX = Math.max(0.08, Math.min(0.92, nx));
  }

  function onPointerMove(e) {
    if (state !== "play") return;
    if (e.pointerType === "touch") e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    setPointer(e, rect);
  }

  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerdown", (e) => {
    if (state !== "play") return;
    hintEl.classList.add("hint--hide");
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (_) {}
    const rect = canvas.getBoundingClientRect();
    setPointer(e, rect);
  });

  function collide(it, pr) {
    const bottom = it.y + it.r;
    if (bottom < pr.py + pr.ph * 0.5) return false;
    if (bottom > pr.py + pr.ph + it.r * 0.5) return false;
    return it.x > pr.px - it.r * 0.2 && it.x < pr.px + pr.pw + it.r * 0.2;
  }

  function endGame(reason) {
    state = "over";
    finalScoreEl.textContent = String(score);
    if (reason === "time") {
      endSubtitle.textContent = "Время вышло";
      endTitle.textContent = "Раунд завершён";
      endMeta.textContent =
        score >= 200
          ? "Отлично: в корзине одни съедобные фрукты, лишнее не попало."
          : "Попробуйте ещё раз — больше апельсинов, лимонов и яблок, меньше чайников и спортинвентаря.";
    } else {
      endSubtitle.textContent = "Репутация на нуле";
      endTitle.textContent = "Игра окончена";
      endMeta.textContent = "В корзину попало слишком много несъедобного. Ловите только фрукты.";
    }
    endScreen.hidden = false;
  }

  function resetRound() {
    score = 0;
    combo = 0;
    lives = MAX_LIVES;
    timeLeft = GAME_DURATION;
    items = [];
    floatTexts = [];
    spawnAcc = 0;
    shake = 0;
    flashBad = 0;
    scoreEl.textContent = "0";
    timerEl.textContent = String(GAME_DURATION);
    updateHearts();
  }

  function startGame() {
    resetRound();
    state = "play";
    startScreen.hidden = true;
    endScreen.hidden = true;
    hintEl.classList.remove("hint--hide");
    lastTs = performance.now();
    requestAnimationFrame(loop);
  }

  btnStart.addEventListener("click", startGame);
  btnAgain.addEventListener("click", startGame);
  btnClose.addEventListener("click", () => {
    endScreen.hidden = true;
    startScreen.hidden = false;
    state = "menu";
  });

  function loop(ts) {
    if (state !== "play") return;
    const dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;

    timeLeft -= dt;
    if (timeLeft <= 0) {
      timeLeft = 0;
      timerEl.textContent = "0";
      endGame("time");
      return;
    }
    timerEl.textContent = String(Math.ceil(timeLeft));

    const spawnInterval = Math.max(
      MIN_SPAWN_MS,
      BASE_SPAWN_MS - (GAME_DURATION - timeLeft) * 9
    );
    spawnAcc += dt * 1000;
    while (spawnAcc >= spawnInterval) {
      spawnAcc -= spawnInterval;
      spawnItem();
    }

    const pr = paddleRect();

    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      it.y += it.vy * (60 * dt);
      it.rot += it.vr * (60 * dt);

      if (collide(it, pr)) {
        if (it.good) {
          combo += 1;
          const bonus = 10 + Math.min(25, combo * 3);
          score += bonus;
          addFloat(it.x, it.y - it.r, `+${bonus}`, "#5eead4");
        } else {
          combo = 0;
          score = Math.max(0, score - 30);
          lives -= 1;
          shake = 12;
          flashBad = 0.35;
          addFloat(it.x, it.y - it.r, "−30", "#fb7185");
          updateHearts();
          if (lives <= 0) {
            scoreEl.textContent = String(score);
            endGame("lives");
            return;
          }
        }
        scoreEl.textContent = String(score);
        items.splice(i, 1);
        continue;
      }

      if (it.y - it.r > H + 40) {
        if (it.good) {
          combo = 0;
        }
        items.splice(i, 1);
      }
    }

    if (shake > 0) shake *= 0.85;
    if (flashBad > 0) flashBad -= dt;

    ctx.save();
    const ox = shake ? (Math.random() - 0.5) * shake * dpr * 0.5 : 0;
    const oy = shake ? (Math.random() - 0.5) * shake * dpr * 0.5 : 0;
    ctx.translate(ox, oy);

    drawBackground();
    if (flashBad > 0) {
      ctx.fillStyle = `rgba(251, 113, 133, ${flashBad * 0.25})`;
      ctx.fillRect(0, 0, W, H);
    }

    for (const it of items) drawItem(it);
    drawPaddle();
    drawFloats(dt);

    ctx.restore();

    requestAnimationFrame(loop);
  }

  window.addEventListener("resize", resize);
  resize();
  updateHearts();

  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
      const rr = Math.min(r, w / 2, h / 2);
      this.beginPath();
      this.moveTo(x + rr, y);
      this.arcTo(x + w, y, x + w, y + h, rr);
      this.arcTo(x + w, y + h, x, y + h, rr);
      this.arcTo(x, y + h, x, y, rr);
      this.arcTo(x, y, x + w, y, rr);
      this.closePath();
      return this;
    };
  }
})();
