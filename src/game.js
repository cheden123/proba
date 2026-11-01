// Игровой цикл, столкновения, камера и HUD.
import { VIEW_W, VIEW_H, TILE, clamp, rand, smoothDamp, aabb } from "./core.js";
import { buildLevel, T } from "./levels.js";
import {
  Player,
  Bullet,
  Coin,
  Acorn,
  Checkpoint,
  Goal,
  makeEnemy,
  makeParticle,
  particleUpdate,
} from "./entities.js";
import { drawSky, drawDecor, drawTiles, drawHamster, drawMole, drawCrow, drawCactusGuy, drawCatBoss, drawCoin, drawAcorn, drawPellet, drawDynamite, drawGoal, drawCheckpoint, drawParticle } from "./art.js";

export class Game {
  constructor(canvas, audio, input, hooks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.ctx.imageSmoothingEnabled = false;
    this.audio = audio;
    this.sfx = audio;
    this.input = input;
    this.hooks = hooks;
    this.t = 0;
    this.levelIndex = 0;
    this.state = "idle";
    this.score = 0;
    this.coins = 0;
    this.kills = 0;
    this.cam = { x: 0, y: 0 };
    this.shakeAmount = 0;
    this.flashTimer = 0;
    this.flashColor = "#fff";
    this.levelTime = 0;
    this.hintTimer = 0;
    this.paused = false;
    this.transition = 0;
    this.clearTimer = 0;
    this.reported = false;
  }

  music(name) {
    this.audio.playSong(name);
  }

  startRun() {
    this.score = 0;
    this.coins = 0;
    this.kills = 0;
    this.levelIndex = 0;
    this.loadLevel(0);
  }

  loadLevel(index, keepStats = true) {
    if (!keepStats) {
      this.score = 0;
      this.coins = 0;
      this.kills = 0;
    }
    this.levelIndex = index;
    this.level = buildLevel(index);
    this.enemies = [];
    this.bullets = [];
    this.shots = [];
    this.items = [];
    this.props = [];
    this.particles = [];

    for (const spawn of this.level.spawns) {
      switch (spawn.type) {
        case "enemy": {
          const e = makeEnemy(spawn);
          if (e) this.enemies.push(e);
          break;
        }
        case "boss": {
          const e = makeEnemy(spawn);
          if (e) this.enemies.push(e);
          break;
        }
        case "coin":
          this.items.push(new Coin(spawn.tileX * TILE + 2, spawn.tileY * TILE + 2));
          break;
        case "checkpoint":
          this.props.push(new Checkpoint(spawn.tileX * TILE, spawn.tileY * TILE - 4));
          break;
        case "goal":
          this.props.push(new Goal(spawn.tileX * TILE, spawn.tileY * TILE + 4));
          break;
      }
    }

    this.player = new Player(this.level.start.x, this.level.start.y);
    this.player.respawn = { x: this.level.start.x, y: this.level.start.y };
    this.cam.x = clamp(this.player.cx - VIEW_W * 0.42, 0, this.level.w * TILE - VIEW_W);
    this.cam.y = 0;
    this.state = "playing";
    this.clearTimer = 0;
    this.reported = false;
    this.levelTime = 0;
    this.hintTimer = index === 0 ? 6.5 : 0;
    this.bannerTimer = 2.8;
    this.shakeAmount = 0;
    this.transition = 1;
    this.paused = false;
    this.boss = this.enemies.find((e) => e.isBoss) || null;
    this.bossSeen = false;
    this.music(this.level.index === 2 ? "boss" : this.level.index === 1 ? "canyon" : "level");
    this.hooks.onLevelStart?.(this.level);
  }

  restartLevel() {
    this.loadLevel(this.levelIndex);
  }

  // ------- эффекты -------

  shake(amount) {
    this.shakeAmount = Math.min(14, this.shakeAmount + amount);
  }

  flash(time, color) {
    this.flashTimer = Math.max(this.flashTimer, time);
    this.flashColor = color;
  }

  addScore(amount, x, y) {
    this.score += amount;
    if (x !== undefined) this.popup(x, y - 4, `+${amount}`, "#ffe066");
  }

  popup(x, y, text, color) {
    this.particles.push({
      x,
      y,
      vx: 0,
      vy: -26,
      life: 0.9,
      maxLife: 0.9,
      color,
      size: 8,
      shape: "text",
      text,
      gravity: 0,
    });
  }

  spawn(obj) {
    if (obj instanceof Bullet) this.bullets.push(obj);
    else if (obj.isEnemy) this.shots.push(obj);
    else this.items.push(obj);
  }

  explosion(x, y, radius, damage) {
    this.sfx.bossHit();
    this.shake(7);
    this.flash(0.22, "#ffb066");
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      const sp = rand(40, radius * 6);
      this.particles.push(makeParticle(x, y, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.3, 0.7), i % 2 ? "#ffb066" : "#ffe9a8", rand(1.6, 3.4)));
    }
    this.particles.push(makeParticle(x, y, 0, 0, 0.4, "#ffc06b", radius, "ring"));
    const p = this.player;
    if (Math.hypot(p.cx - x, p.cy - y) < radius) p.hurt(this, damage, x);
    for (const e of this.enemies) {
      if (e.dead || e.isBoss) continue;
      if (Math.hypot(e.x + e.w / 2 - x, e.y + e.h / 2 - y) < radius) e.hit(2, this, x);
    }
    for (const s of this.shots) {
      if (s !== null && Math.hypot(s.x - x, s.y - y) < radius) s.dead = true;
    }
  }

  aimAngleFor(p) {
    let best = null;
    let bestDist = 210;
    const px = p.cx;
    const py = p.cy - 1;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const ex = e.x + e.w / 2;
      const ey = e.y + e.h / 2;
      const dx = (ex - px) * p.facing;
      if (dx < 4) continue;
      const dy = ey - py;
      const dist = Math.hypot(dx, dy);
      if (dist < bestDist) {
        bestDist = dist;
        best = Math.atan2(dy, dx);
      }
    }
    if (best === null) return 0;
    return clamp(best, -0.62, 0.5);
  }

  bumpTile(tx, ty, player) {
    const tile = this.level.get(tx, ty);
    const wx = tx * TILE + TILE / 2;
    const wy = ty * TILE + TILE / 2;
    if (tile === T.QBLOCK) {
      const content = this.level.spawns.find((s) => s.type === "qblock-content" && s.tileX === tx && s.tileY === ty);
      this.level.set(tx, ty, T.USED);
      this.sfx.coin();
      this.shake(1.5);
      for (let i = 0; i < 8; i++) {
        this.particles.push(makeParticle(wx, wy + 6, rand(-60, 60), rand(-90, -20), 0.4, "#ffe9a8", rand(1.4, 2.4)));
      }
      if (content && content.contents === "acorn") {
        const acorn = new Acorn(tx * TILE + 2, ty * TILE - 4);
        acorn.popping = true;
        acorn.vy = -250;
        this.items.push(acorn);
      } else {
        for (let i = 0; i < 3; i++) {
          const coin = new Coin(tx * TILE + 2, ty * TILE - 6);
          coin.popping = true;
          coin.vy = -220 - i * 25;
          coin.x += rand(-2, 2);
          coin.y += rand(-2, 2);
          this.items.push(coin);
        }
      }
    } else if (tile === T.BRICK) {
      if (player.fury > 0) {
        this.level.set(tx, ty, T.EMPTY);
        this.sfx.pop();
        this.shake(3);
        this.addScore(30);
        for (let i = 0; i < 10; i++) {
          this.particles.push(makeParticle(wx, wy, rand(-100, 100), rand(-140, 10), rand(0.4, 0.8), i % 2 ? "#d98a52" : "#b5653a", rand(2, 3.4)));
        }
      } else {
        this.sfx.ui();
        for (let i = 0; i < 4; i++) {
          this.particles.push(makeParticle(wx, wy + 4, rand(-30, 30), rand(-40, 0), 0.3, "#c9a07a", 1.8));
        }
      }
    }
  }

  onLevelClear() {
    if (this.state !== "playing") return;
    this.state = "clear";
    this.clearTimer = 2.2;
    this.reported = false;
    this.sfx.levelClear();
    this.stopMusic();
    const timeBonus = Math.max(0, Math.round(2000 - this.levelTime * 12));
    this.addScore(500 + timeBonus);
    this.hooks.onLevelClear?.({
      index: this.levelIndex,
      name: this.level.name,
      score: this.score,
      coins: this.coins,
      kills: this.kills,
      time: this.levelTime,
      bonus: 500 + timeBonus,
      last: this.levelIndex >= 2,
    });
  }

  onBossDefeated() {
    if (this.state === "bossdown") return;
    this.state = "bossdown";
    this.clearTimer = 3.2;
    this.addScore(2500);
    this.sfx.victory();
    this.flash(0.6, "#ffe9a8");
    this.shake(10);
    this.hooks.onBossDefeated?.();
  }

  onPlayerDeath(fell) {
    if (this.state !== "playing") return;
    this.state = "dead";
    this.stopMusic();
    this.sfx.gameOver();
    this.shake(8);
    this.flash(0.5, "#ff5b5b");
    this.clearTimer = 1.1;
    for (let i = 0; i < 26; i++) {
      this.particles.push(makeParticle(this.player.cx, this.player.cy, rand(-140, 140), rand(-190, 20), rand(0.5, 1), i % 2 ? "#ff9b7a" : "#ffe0b0", rand(1.6, 3.4)));
    }
  }

  stopMusic() {
    this.audio.stopMusic();
  }

  // ------- обновление -------

  update(dt) {
    this.t += dt;
    this.transition = Math.max(0, this.transition - dt * 1.4);
    this.flashTimer = Math.max(0, this.flashTimer - dt);
    this.shakeAmount = Math.max(0, this.shakeAmount - dt * 26);

    if (this.paused || this.state === "idle") {
      this.particles.forEach((p) => particleUpdate(p, dt));
      this.particles = this.particles.filter((p) => p.life > 0);
      return;
    }

    this.levelTime += dt;
    this.hintTimer = Math.max(0, this.hintTimer - dt);
    this.bannerTimer = Math.max(0, (this.bannerTimer || 0) - dt);

    if (this.state === "playing" || this.state === "clear" || this.state === "bossdown" || this.state === "dead") {
      if (this.state === "playing") {
        this.player.update(dt, this);
        this.handleCollisions();
      } else {
        this.clearTimer -= dt;
        if (this.state === "dead") {
          this.player.update(dt, this);
        }
        if (this.clearTimer <= 0 && !this.reported) {
          this.reported = true;
          if (this.state === "clear") this.hooks.onLevelFinished?.();
          if (this.state === "bossdown") this.hooks.onVictory?.({ score: this.score, coins: this.coins, kills: this.kills });
          if (this.state === "dead") this.hooks.onGameOver?.({ score: this.score, coins: this.coins, kills: this.kills });
        }
      }

      for (const e of this.enemies) if (!e.dead) e.update(dt, this);
      for (const b of this.bullets) if (!b.dead) b.update(dt, this);
      for (const s of this.shots) if (!s.dead) s.update(dt, this);
      for (const i of this.items) if (!i.dead) i.update(dt, this);
      for (const p of this.props) p.update(dt, this);

      if (this.state === "playing") this.projectileCollisions();

      this.enemies = this.enemies.filter((e) => !e.dead);
      this.bullets = this.bullets.filter((b) => !b.dead);
      this.shots = this.shots.filter((s) => !s.dead);
      this.items = this.items.filter((i) => !i.dead);
    }

    for (const p of this.particles) particleUpdate(p, dt);
    this.particles = this.particles.filter((p) => p.life > 0);

    // Камера
    const targetX = clamp(this.player.cx - VIEW_W * 0.45 + this.player.facing * 26, 0, this.level.w * TILE - VIEW_W);
    const targetY = clamp(this.player.cy - VIEW_H * 0.58, -10, Math.max(0, this.level.h * TILE - VIEW_H));
    this.cam.x = smoothDamp(this.cam.x, targetX, 7, dt);
    this.cam.y = smoothDamp(this.cam.y, targetY, 6, dt);
  }

  handleCollisions() {
    const p = this.player;
    if (p.dead) return;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (!aabb(p, e)) continue;
      const falling = p.vy > 60;
      const feetAbove = p.y + p.h - e.y < 14;
      if (e.isBoss) {
        if (falling && feetAbove) {
          e.stomp(this);
          p.vy = -320;
          p.airJumps = 1;
          this.sfx.stomp();
        } else {
          p.hurt(this, 1, e.x + e.w / 2);
        }
        continue;
      }
      if (e.stompable && falling && feetAbove) {
        e.stomp(this);
        p.vy = -300;
        p.airJumps = 1;
        p.squashX = 1.2;
        p.squashY = 0.8;
        this.sfx.stomp();
        this.addScore(0);
      } else {
        p.hurt(this, 1, e.x + e.w / 2);
      }
    }
  }

  projectileCollisions() {
    const p = this.player;
    for (const b of this.bullets) {
      if (b.dead) continue;
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (aabb(b, e)) {
          e.hit(b.damage, this, b.x);
          b.pierce--;
          if (b.pierce < 0) {
            b.dead = true;
          }
          break;
        }
      }
      if (b.dead) continue;
      for (const s of this.shots) {
        if (s.dead) continue;
        if (aabb(b, s)) {
          s.dead = true;
          b.pierce--;
          if (b.pierce < 0) b.dead = true;
          for (let i = 0; i < 6; i++) {
            this.particles.push(makeParticle(b.x + b.w / 2, b.y + b.h / 2, rand(-60, 60), rand(-60, 20), 0.3, "#e8ffc0", rand(1.2, 2.2)));
          }
          break;
        }
      }
    }
    for (const s of this.shots) {
      if (s.dead) continue;
      if (aabb(s, p)) {
        if (s.kind === "dynamite") continue;
        p.hurt(this, 1, s.x);
        s.dead = true;
      }
    }
    // Босс просыпается, когда камера на него смотрит
    if (this.boss && !this.bossSeen && this.state === "playing") {
      const view = { x: this.cam.x, y: 0, w: VIEW_W, h: VIEW_H };
      if (aabb(view, this.boss) && this.boss.state !== "sleep") this.bossSeen = true;
    }
  }

  // ------- отрисовка -------

  render() {
    const ctx = this.ctx;
    const t = this.t;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (!this.level) {
      ctx.fillStyle = "#120d1c";
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      return;
    }

    const shakeX = this.shakeAmount > 0 ? Math.sin(t * 90) * this.shakeAmount : 0;
    const shakeY = this.shakeAmount > 0 ? Math.cos(t * 77) * this.shakeAmount * 0.7 : 0;

    ctx.save();
    ctx.translate(shakeX, shakeY);

    drawSky(ctx, this.level, this.cam.x, this.cam.y, t);
    drawDecor(ctx, this.level, this.cam.x, this.cam.y, t);

    ctx.save();
    ctx.translate(-this.cam.x, -this.cam.y);
    drawTiles(ctx, this.level, this.cam.x, this.cam.y, t);
    this.drawEntities(ctx);
    ctx.restore();

    ctx.restore();

    this.drawHud(ctx);
    this.drawEffects(ctx);
  }

  drawEntities(ctx) {
    const t = this.t;
    for (const prop of this.props) {
      if (prop instanceof Checkpoint) drawCheckpoint(ctx, prop, t);
      else if (prop instanceof Goal) drawGoal(ctx, prop, t);
    }
    for (const item of this.items) {
      if (item instanceof Coin) drawCoin(ctx, item, t);
      else if (item instanceof Acorn) drawAcorn(ctx, item, t);
    }
    for (const e of this.enemies) {
      ctx.save();
      if (e.flash > 0) {
        ctx.filter = "brightness(2.2)";
      }
      if (e.type === "mole") drawMole(ctx, e, t);
      else if (e.type === "crow") drawCrow(ctx, e, t);
      else if (e.type === "cactus") drawCactusGuy(ctx, e, t);
      else if (e.type === "boss") drawCatBoss(ctx, e, t);
      ctx.restore();
    }
    for (const s of this.shots) {
      if (s.kind === "dynamite") drawDynamite(ctx, s, t);
      else this.drawSpine(ctx, s);
    }
    for (const b of this.bullets) drawPellet(ctx, b);

    if (this.state !== "dead" || this.clearTimer > 0.6) drawHamster(ctx, this.player, t);
    this.drawChargeMeter(ctx);
    for (const p of this.particles) drawParticle(ctx, p);
  }

  drawSpine(ctx, s) {
    ctx.save();
    ctx.translate(s.x + s.w / 2, s.y + s.h / 2);
    ctx.rotate(Math.atan2(s.vy, s.vx));
    ctx.fillStyle = "#e9e3bd";
    ctx.beginPath();
    ctx.moveTo(-5, 0);
    ctx.lineTo(4, -2.4);
    ctx.lineTo(6, 0);
    ctx.lineTo(4, 2.4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#9aa87a";
    ctx.fillRect(-2, -0.8, 4, 1.6);
    ctx.restore();
  }

  drawChargeMeter(ctx) {
    const p = this.player;
    if (p.charge <= 0 || p.dead) return;
    const c = Math.min(1, p.charge / p.maxCharge);
    ctx.save();
    ctx.translate(p.cx, p.y - 8);
    ctx.fillStyle = "rgba(20,14,30,0.55)";
    ctx.fillRect(-10, -3, 20, 4);
    ctx.fillStyle = c >= 1 ? "#b6ef6a" : c >= 0.5 ? "#ffd257" : "#ff9f6b";
    ctx.fillRect(-9.5, -2.5, 19 * c, 3);
    if (c >= 1) {
      ctx.fillStyle = "rgba(182,239,106,0.9)";
      ctx.font = "bold 6px 'Trebuchet MS', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("МАКС", 0, -6);
    }
    ctx.restore();
  }

  pill(ctx, x, y, w, h, alpha = 0.3) {
    ctx.fillStyle = `rgba(10,7,18,${alpha})`;
    ctx.fillRect(x, y, w, h);
  }

  drawHud(ctx) {
    const p = this.player;
    // подложки под показатели — чтобы читалось на любом фоне
    this.pill(ctx, 7, 4, 122, 34, 0.26);
    this.pill(ctx, VIEW_W / 2 - 42, 3, 84, 15, 0.26);
    this.pill(ctx, VIEW_W - 108, 4, 101, 30, 0.26);

    // сердца
    for (let i = 0; i < p.maxHp; i++) {
      const x = 12 + i * 15;
      const y = 13;
      const filled = i < p.hp;
      this.heart(ctx, x + (filled ? Math.sin(this.t * 6 + i) * 0.4 : 0), y, filled);
    }

    // монеты
    ctx.save();
    ctx.shadowColor = "rgba(10,6,20,0.55)";
    ctx.shadowBlur = 3;
    ctx.translate(12, 28);
    ctx.fillStyle = "#f0b429";
    ctx.beginPath();
    ctx.arc(5, 4, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffd95e";
    ctx.beginPath();
    ctx.arc(4.3, 3.3, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#c98d12";
    ctx.beginPath();
    ctx.arc(5, 4, 1.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 10px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`× ${this.coins}`, 14, 4.5);
    ctx.restore();

    // очки
    ctx.save();
    ctx.shadowColor = "rgba(10,6,20,0.6)";
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "bold 10px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText(String(this.score).padStart(6, "0"), VIEW_W - 12, 8);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "8px 'Trebuchet MS', sans-serif";
    ctx.fillText(this.level.name, VIEW_W - 12, 21);
    ctx.restore();

    // уровень
    ctx.save();
    ctx.shadowColor = "rgba(10,6,20,0.6)";
    ctx.shadowBlur = 3;
    ctx.fillStyle = "rgba(255,255,255,0.62)";
    ctx.font = "bold 8px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(`УРОВЕНЬ ${this.levelIndex + 1}/3`, VIEW_W / 2, 7);
    ctx.restore();

    // ярость
    if (p.fury > 0) {
      ctx.save();
      ctx.fillStyle = "rgba(255,210,87,0.9)";
      ctx.font = "bold 8px 'Trebuchet MS', sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("ОРЕХОВАЯ ЯРОСТЬ", 12, 40);
      ctx.fillStyle = "rgba(255,210,87,0.35)";
      ctx.fillRect(12, 50, 80, 3);
      ctx.fillStyle = "#ffd257";
      ctx.fillRect(12, 50, (80 * p.fury) / 10, 3);
      ctx.restore();
    }

    // босс
    if (this.boss && !this.boss.dead && (this.boss.state !== "sleep" || this.bossSeen)) {
      const w = 168;
      const x = (VIEW_W - w) / 2;
      const y = VIEW_H - 18;
      ctx.fillStyle = "rgba(12,8,20,0.72)";
      ctx.fillRect(x - 4, y - 12, w + 8, 22);
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.font = "bold 8px 'Trebuchet MS', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText("БАРСИК, ПОВЕЛИТЕЛЬ КЛАДОВКИ", VIEW_W / 2, y - 10);
      const hpFrac = Math.max(0, this.boss.hp / this.boss.maxHp);
      ctx.fillStyle = "#3a2030";
      ctx.fillRect(x, y, w, 7);
      const grad = ctx.createLinearGradient(x, y, x + w, y);
      grad.addColorStop(0, "#ff5f6d");
      grad.addColorStop(1, "#ffb347");
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, w * hpFrac, 7);
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fillRect(x, y, w * hpFrac, 2);
      for (let i = 5; i < this.boss.maxHp; i += 5) {
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.fillRect(x + (w * i) / this.boss.maxHp, y, 1, 7);
      }
    }

    // подсказки на старте первого уровня
    if (this.hintTimer > 0 && this.levelIndex === 0) {
      const alpha = Math.min(1, this.hintTimer / 1.2) * Math.min(1, (6.5 - this.hintTimer) / 0.4 + 0.2);
      const w = 288;
      const x = (VIEW_W - w) / 2;
      const y = 46;
      ctx.save();
      ctx.globalAlpha = Math.min(1, alpha);
      ctx.fillStyle = "rgba(12,8,20,0.62)";
      ctx.fillRect(x, y, w, 32);
      ctx.strokeStyle = "rgba(255,210,87,0.35)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = "#ffe9b0";
      ctx.font = "bold 8px 'Trebuchet MS', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("← → бежать · ПРОБЕЛ прыжок (дважды = двойной)", VIEW_W / 2, y + 11);
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.fillText("J — рогатка: держи для заряда, отпусти — выстрел", VIEW_W / 2, y + 22);
      ctx.restore();
    }

    // заставка уровня
    if (this.bannerTimer > 0) {
      const a = Math.min(1, this.bannerTimer / 0.6) * Math.min(1, (2.8 - this.bannerTimer) / 0.35 + 0.15);
      ctx.save();
      ctx.globalAlpha = Math.min(1, a);
      const cy = VIEW_H * 0.4;
      const grad = ctx.createLinearGradient(0, cy - 18, 0, cy + 18);
      grad.addColorStop(0, "rgba(12,8,20,0)");
      grad.addColorStop(0.5, "rgba(12,8,20,0.55)");
      grad.addColorStop(1, "rgba(12,8,20,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, cy - 18, VIEW_W, 36);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(255,210,87,0.95)";
      ctx.font = "bold 15px 'Trebuchet MS', sans-serif";
      ctx.fillText(`УРОВЕНЬ ${this.levelIndex + 1}`, VIEW_W / 2, cy - 6);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 9px 'Trebuchet MS', sans-serif";
      ctx.fillText(this.level.name.toUpperCase(), VIEW_W / 2, cy + 9);
      ctx.restore();
    }

    if (this.audio.muted) {
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "8px 'Trebuchet MS', sans-serif";
      ctx.textAlign = "right";
      ctx.fillText("звук выкл. (M)", VIEW_W - 12, VIEW_H - 10);
      ctx.restore();
    }
  }

  heart(ctx, x, y, filled) {
    ctx.save();
    ctx.translate(x, y);
    if (!filled) ctx.globalAlpha = 0.28;
    ctx.fillStyle = filled ? "#ff5f6d" : "#ffffff";
    ctx.beginPath();
    ctx.moveTo(0, 4);
    ctx.bezierCurveTo(-6, -1, -2.5, -7, 0, -3.4);
    ctx.bezierCurveTo(2.5, -7, 6, -1, 0, 4);
    ctx.fill();
    if (filled) {
      ctx.fillStyle = "#ff9aa2";
      ctx.beginPath();
      ctx.arc(-1.6, -2.3, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawEffects(ctx) {
    // Виньетка
    const vg = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.35, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.95);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.42)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    if (this.level.palette.ambient === "night") {
      const px = this.player.cx - this.cam.x;
      const py = this.player.cy - this.cam.y;
      const light = ctx.createRadialGradient(px, py, 8, px, py, 150);
      light.addColorStop(0, "rgba(255,205,150,0.22)");
      light.addColorStop(0.5, "rgba(255,170,110,0.09)");
      light.addColorStop(1, "rgba(255,150,90,0)");
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = light;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.globalCompositeOperation = "source-over";
    }

    if (this.flashTimer > 0) {
      ctx.globalAlpha = Math.min(0.5, this.flashTimer);
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.globalAlpha = 1;
    }

    if (this.transition > 0) {
      ctx.globalAlpha = Math.min(1, this.transition);
      ctx.fillStyle = "#0b0812";
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.globalAlpha = 1;
    }
  }
}
