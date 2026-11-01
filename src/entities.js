// Сущности: хомяк, враги, босс, снаряды и предметы.
import { TILE, clamp, rand, randInt, approach, aabb, chance } from "./core.js";
import { T } from "./levels.js";

const GRAVITY = 1500;
const MAX_FALL = 430;

export function isSolidAt(level, px, py) {
  return level.isSolid(Math.floor(px / TILE), Math.floor(py / TILE));
}

export function moveBody(level, e, dt) {
  const flags = { wall: 0, ground: false, ceiling: false, hitTile: null };

  e.x += e.vx * dt;
  const topR = Math.floor(e.y / TILE);
  const botR = Math.floor((e.y + e.h - 0.001) / TILE);
  if (e.vx > 0) {
    const col = Math.floor((e.x + e.w - 0.001) / TILE);
    for (let ty = topR; ty <= botR; ty++) {
      if (level.isSolid(col, ty)) {
        e.x = col * TILE - e.w;
        e.vx = 0;
        flags.wall = 1;
        break;
      }
    }
  } else if (e.vx < 0) {
    const col = Math.floor(e.x / TILE);
    for (let ty = topR; ty <= botR; ty++) {
      if (level.isSolid(col, ty)) {
        e.x = (col + 1) * TILE;
        e.vx = 0;
        flags.wall = -1;
        break;
      }
    }
  }

  e.y += e.vy * dt;
  const leftC = Math.floor(e.x / TILE);
  const rightC = Math.floor((e.x + e.w - 0.001) / TILE);
  if (e.vy > 0) {
    const row = Math.floor((e.y + e.h - 0.001) / TILE);
    for (let tx = leftC; tx <= rightC; tx++) {
      if (level.isSolid(tx, row)) {
        e.y = row * TILE - e.h;
        e.vy = 0;
        flags.ground = true;
        break;
      }
    }
  } else if (e.vy < 0) {
    const row = Math.floor(e.y / TILE);
    for (let tx = leftC; tx <= rightC; tx++) {
      if (level.isSolid(tx, row)) {
        e.y = (row + 1) * TILE;
        e.vy = 0;
        flags.ceiling = true;
        flags.hitTile = { tx, ty: row };
        break;
      }
    }
  }

  if (!flags.ground && e.vy >= 0) {
    const row = Math.floor((e.y + e.h + 1) / TILE);
    if (Math.abs(e.y + e.h - row * TILE) < 1.6) {
      for (let tx = leftC; tx <= rightC; tx++) {
        if (level.isSolid(tx, row)) {
          flags.ground = true;
          break;
        }
      }
    }
  }
  e.onGround = flags.ground;
  return flags;
}

export function touchedHazard(level, e) {
  const x0 = Math.floor((e.x + 1) / TILE);
  const x1 = Math.floor((e.x + e.w - 1) / TILE);
  const y0 = Math.floor((e.y + 2) / TILE);
  const y1 = Math.floor((e.y + e.h - 1) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const t = level.get(tx, ty);
      if (t === T.SPIKES || t === T.LAVA) return t;
    }
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Хомяк
// ---------------------------------------------------------------------------

export class Player {
  constructor(x, y) {
    this.w = 13;
    this.h = 16;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.facing = 1;
    this.onGround = false;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.airJumps = 1;
    this.maxHp = 5;
    this.hp = 3;
    this.invuln = 0;
    this.fury = 0;
    this.charge = 0;
    this.maxCharge = 0.8;
    this.cooldown = 0;
    this.aimAngle = 0;
    this.recoil = 0;
    this.squashX = 1;
    this.squashY = 1;
    this.dead = false;
    this.respawn = { x, y };
    this.transformed = false;
    this.stepTimer = 0;
    this.lastSafe = { x, y };
  }

  get cx() {
    return this.x + this.w / 2;
  }

  get cy() {
    return this.y + this.h / 2;
  }

  update(dt, game) {
    const input = game.input;
    if (this.dead) {
      this.vy = Math.min(this.vy + GRAVITY * dt, MAX_FALL);
      this.y += this.vy * dt;
      return;
    }

    const left = input.isDown("left");
    const right = input.isDown("right");
    const dir = (right ? 1 : 0) - (left ? 1 : 0);
    const control = this.fury > 0 ? 1.12 : 1;
    const accel = (this.onGround ? 1050 : 720) * control;
    const friction = this.onGround ? 1250 : 240;

    if (dir !== 0) {
      this.vx = approach(this.vx, dir * 120 * control, accel * dt);
      this.facing = dir;
    } else {
      this.vx = approach(this.vx, 0, friction * dt);
    }

    // Прыжки: койот-тайм, буфер и «двойной прыжок с надутыми щеками».
    this.coyote = this.onGround ? 0.1 : Math.max(0, this.coyote - dt);
    this.jumpBuffer = input.pressed("jump") ? 0.12 : Math.max(0, this.jumpBuffer - dt);

    if (this.jumpBuffer > 0 && this.coyote > 0) {
      this.vy = -348;
      this.jumpBuffer = 0;
      this.coyote = 0;
      this.onGround = false;
      this.squashX = 0.82;
      this.squashY = 1.22;
      this.puff(game, 6, "#f7e2c0");
      game.sfx.jump();
    } else if (this.jumpBuffer > 0 && this.airJumps > 0) {
      this.airJumps--;
      this.jumpBuffer = 0;
      this.vy = -300;
      this.squashX = 0.8;
      this.squashY = 1.25;
      this.puff(game, 10, "#ffe0b0");
      game.sfx.jump();
    }

    const holdingJump = input.isDown("jump");
    const gravity = this.vy < 0 && holdingJump ? GRAVITY * 0.55 : GRAVITY;
    this.vy = Math.min(this.vy + gravity * dt, MAX_FALL);

    const flags = moveBody(game.level, this, dt);
    if (flags.ground) {
      this.airJumps = 1;
      if (!this.wasGrounded) {
        this.squashX = 1.18;
        this.squashY = 0.84;
        this.puff(game, 4, "#e8d6b8");
        if (this.vyImpact > 260) game.shake(1.4);
      }
      this.lastSafe = { x: this.x, y: this.y };
    }
    this.wasGrounded = flags.ground;
    this.vyImpact = this.vy;

    if (flags.ceiling && flags.hitTile) game.bumpTile(flags.hitTile.tx, flags.hitTile.ty, this);

    // Анимационные «пружинки»
    this.squashX = approach(this.squashX, 1, 3.2 * dt);
    this.squashY = approach(this.squashY, 1, 3.2 * dt);
    this.recoil = approach(this.recoil, 0, 22 * dt);

    // Рогатка: держи — заряжаешь, отпусти — стреляешь.
    this.cooldown = Math.max(0, this.cooldown - dt);
    const wantShoot = input.isDown("shoot");
    if (wantShoot) {
      if (this.charge >= this.maxCharge) {
        if (this.cooldown <= 0) this.fire(game);
      } else {
        this.charge = Math.min(this.maxCharge, this.charge + dt);
        this.transformed = this.charge > 0.3;
      }
    } else if (this.charge > 0) {
      this.fire(game);
    }
    if (!wantShoot && this.charge === 0) this.transformed = false;
    this.aimAngle = game.aimAngleFor(this);

    // Таймеры
    this.invuln = Math.max(0, this.invuln - dt);
    this.fury = Math.max(0, this.fury - dt);
    this.stepTimer -= dt;
    if (this.onGround && Math.abs(this.vx) > 40 && this.stepTimer <= 0) {
      this.stepTimer = 0.17;
      game.particles.push(makeParticle(this.cx, this.y + this.h, rand(-14, 14), rand(-20, -4), 0.3, "#e6d3b0", 1.6));
    }

    // Опасности
    const hazard = touchedHazard(game.level, this);
    if (hazard) this.hurt(game, hazard === T.LAVA ? 2 : 1, this.cx, true);

    if (this.y > game.level.h * TILE + 24) {
      this.hurt(game, 1, this.cx, true, true);
    }
  }

  puff(game, n, color) {
    for (let i = 0; i < n; i++) {
      game.particles.push(
        makeParticle(this.cx + rand(-5, 5), this.y + this.h - rand(0, 4), rand(-50, 50), rand(-40, -5), rand(0.2, 0.4), color, rand(1.4, 2.8))
      );
    }
  }

  fire(game) {
    const c = this.charge;
    let kind = "light";
    if (c >= 0.62) kind = "bounce";
    else if (c >= 0.28) kind = "heavy";

    const furyBoost = this.fury > 0;
    if (furyBoost && kind === "light") kind = "heavy";
    else if (furyBoost && kind === "heavy") kind = "bounce";

    const angle = this.aimAngle;
    const speed = kind === "heavy" ? 400 : 330;
    const dmg = (kind === "bounce" ? 3 : kind === "heavy" ? 2 : 1) + (furyBoost ? 1 : 0);
    const px = this.cx + Math.cos(angle) * this.facing * 11;
    const py = this.cy - 1 + Math.sin(angle) * 9;
    game.spawn(
      new Bullet(px, py, Math.cos(angle) * this.facing * speed, Math.sin(angle) * speed, kind, dmg)
    );
    this.recoil = 3.5;
    this.vx -= this.facing * 14;
    this.squashX = 1.1;
    this.squashY = 0.94;
    this.charge = 0;
    this.transformed = false;
    this.cooldown = kind === "light" ? 0.17 : 0.26;
    game.sfx.shoot();
    game.shake(kind === "bounce" ? 2.4 : 0.8);
    for (let i = 0; i < 4; i++) {
      game.particles.push(
        makeParticle(px, py, Math.cos(angle) * this.facing * rand(20, 80), Math.sin(angle) * rand(20, 80), 0.2, "#d9ffa8", 1.4)
      );
    }
  }

  hurt(game, amount, fromX, ignoreShield = false, fell = false) {
    if (this.dead || this.invuln > 0) return;
    game.sfx.hurt();
    game.shake(5);
    game.flash(0.45, "#ff4d4d");
    if (this.fury > 0 && !ignoreShield) {
      this.fury = 0;
      this.invuln = 1.1;
      game.particles.push(makeParticle(this.cx, this.cy, 0, -20, 0.6, "#ffd257", 3, "ring"));
      game.popup(this.cx, this.y - 6, "ОРЕХ СПАС!", "#ffd257");
      return;
    }
    this.hp -= amount;
    this.invuln = 1.5;
    const dirAway = fromX < this.cx ? 1 : -1;
    this.vx = dirAway * 110;
    this.vy = -180;
    for (let i = 0; i < 10; i++) {
      game.particles.push(
        makeParticle(this.cx, this.cy, rand(-90, 90), rand(-90, 20), rand(0.3, 0.6), i % 2 ? "#ff8f6b" : "#ffd9a8", rand(1.6, 3))
      );
    }
    if (this.hp <= 0) {
      this.hp = 0;
      if (fell) {
        this.dead = true;
        game.onPlayerDeath(true);
      } else {
        this.dead = true;
        game.onPlayerDeath(false);
      }
    } else if (fell) {
      // Упал в яму — возвращаем к чекпоинту, потеряв сердце.
      this.respawnPlayer(game);
    }
  }

  respawnPlayer(game) {
    this.x = this.respawn.x;
    this.y = this.respawn.y;
    this.vx = 0;
    this.vy = 0;
    this.invuln = 1.6;
    this.dead = false;
    for (let i = 0; i < 14; i++) {
      game.particles.push(
        makeParticle(this.cx + rand(-10, 10), this.cy + rand(-10, 10), rand(-40, 40), rand(-80, -20), 0.5, "#a8e6ff", rand(1.5, 3))
      );
    }
  }

  heal(game, amount) {
    if (this.hp < this.maxHp) {
      this.hp += amount;
      game.sfx.heal();
      game.popup(this.cx, this.y - 6, "+1 ♥", "#7fe08a");
    } else {
      this.fury = 10;
      game.sfx.checkpoint();
      game.popup(this.cx, this.y - 6, "ОРЕХОВАЯ ЯРОСТЬ!", "#ffd257");
      for (let i = 0; i < 16; i++) {
        game.particles.push(
          makeParticle(this.cx, this.cy, rand(-70, 70), rand(-90, -10), rand(0.4, 0.8), "#ffd257", rand(1.6, 3))
        );
      }
    }
    this.hp = Math.min(this.hp, this.maxHp);
  }
}

// ---------------------------------------------------------------------------
// Снаряды
// ---------------------------------------------------------------------------

export class Bullet {
  constructor(x, y, vx, vy, kind, damage) {
    this.kind = kind;
    this.x = x;
    this.y = y;
    this.w = kind === "bounce" ? 9 : kind === "heavy" ? 8 : 6;
    this.h = kind === "bounce" ? 7 : 5;
    this.vx = vx;
    this.vy = vy;
    this.damage = damage;
    this.life = 2.2;
    this.dead = false;
    this.pierce = kind === "bounce" ? 1 : 0;
    this.bounces = kind === "bounce" ? 3 : 0;
    this.isEnemy = false;
    this.spin = 0;
  }

  update(dt, game) {
    this.life -= dt;
    this.spin += dt * 10;
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (isSolidAt(game.level, this.x + this.w / 2, this.y + this.h / 2)) {
      if (this.bounces > 0) {
        // отражаемся: смотрим, куда биться — по X или по Y
        const nextX = isSolidAt(game.level, this.x + this.w / 2 + Math.sign(this.vx) * 6, this.y + this.h / 2);
        const nextY = isSolidAt(game.level, this.x + this.w / 2, this.y + this.h / 2 + Math.sign(this.vy) * 6);
        if (nextX) this.vx *= -1;
        if (nextY || !nextX) this.vy = this.vy || 0, (this.vy *= -1);
        this.bounces--;
        this.x -= Math.sign(this.vx) * 0;
        game.sfx.ui();
      } else {
        this.explodeSmall(game);
      }
    }

    if (this.life <= 0 || this.y < -40 || this.y > game.level.h * TILE + 40 || this.x < -20 || this.x > game.level.w * TILE + 20) {
      this.dead = true;
    }
  }

  explodeSmall(game) {
    this.dead = true;
    for (let i = 0; i < 5; i++) {
      game.particles.push(
        makeParticle(this.x + this.w / 2, this.y + this.h / 2, rand(-60, 60), rand(-60, 20), 0.25, "#c9f26b", rand(1.2, 2.4))
      );
    }
  }
}

export class EnemyShot {
  constructor(x, y, vx, vy, kind = "spine") {
    this.x = x;
    this.y = y;
    this.w = kind === "spine" ? 7 : 6;
    this.h = kind === "spine" ? 7 : 6;
    this.vx = vx;
    this.vy = vy;
    this.kind = kind;
    this.life = 3.4;
    this.dead = false;
    this.isEnemy = true;
    this.spin = 0;
    this.damage = 1;
  }

  update(dt, game) {
    this.life -= dt;
    this.spin += dt * 8;
    this.vy += (this.kind === "spine" ? 220 : 0) * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.kind === "spine" && isSolidAt(game.level, this.x + this.w / 2, this.y + this.h)) {
      this.dead = true;
      for (let i = 0; i < 4; i++) {
        game.particles.push(
          makeParticle(this.x + this.w / 2, this.y + this.h, rand(-40, 40), rand(-50, -5), 0.3, "#e9e3bd", 1.4)
        );
      }
    }
    if (this.life <= 0 || this.y > game.level.h * TILE + 20) this.dead = true;
  }
}

export class Dynamite {
  constructor(x, y, vx, vy) {
    this.x = x;
    this.y = y;
    this.w = 8;
    this.h = 16;
    this.vx = vx;
    this.vy = vy;
    this.rot = 0;
    this.fuse = 1.6;
    this.dead = false;
    this.isEnemy = true;
    this.damage = 1;
  }

  update(dt, game) {
    this.fuse -= dt;
    this.rot += this.vx * dt * 0.06;
    this.vy += GRAVITY * 0.55 * dt;
    const flags = moveBody(game.level, this, dt);
    if (flags.ground) {
      this.vx *= 0.7;
      this.vy = Math.min(this.vy, 0);
    }
    if (this.fuse <= 0) this.explode(game);
    if (this.y > game.level.h * TILE + 20) this.dead = true;
  }

  explode(game) {
    this.dead = true;
    game.explosion(this.x + this.w / 2, this.y + this.h / 2, 30, 1);
  }
}

// ---------------------------------------------------------------------------
// Враги
// ---------------------------------------------------------------------------

class Enemy {
  constructor(x, y, w, h, hp) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.hp = hp;
    this.maxHp = hp;
    this.vx = 0;
    this.vy = 0;
    this.dir = -1;
    this.dead = false;
    this.flash = 0;
    this.score = 100;
    this.stompable = true;
    this.isBoss = false;
    this.seed = Math.random();
    this.onGround = false;
    this.type = "enemy";
  }

  hit(dmg, game, fromX) {
    if (this.dead) return;
    this.hp -= dmg;
    this.flash = 0.12;
    game.sfx.pop();
    if (fromX !== undefined) this.vx = fromX < this.x + this.w / 2 ? 40 : -40;
    for (let i = 0; i < 6; i++) {
      game.particles.push(
        makeParticle(this.x + this.w / 2, this.y + this.h / 2, rand(-70, 70), rand(-70, 20), 0.35, i % 2 ? "#ffe066" : "#ffffff", rand(1.4, 2.6))
      );
    }
    if (this.hp <= 0) this.die(game);
  }

  die(game) {
    this.dead = true;
    game.addScore(this.score, this.x + this.w / 2, this.y);
    game.kills++;
    game.sfx.pop();
    game.shake(2.5);
    for (let i = 0; i < 16; i++) {
      game.particles.push(
        makeParticle(
          this.x + this.w / 2 + rand(-6, 6),
          this.y + this.h / 2 + rand(-6, 6),
          rand(-110, 110),
          rand(-140, 30),
          rand(0.35, 0.8),
          i % 3 === 0 ? "#ffffff" : i % 3 === 1 ? "#ffd257" : "#b7a8d8",
          rand(1.4, 3)
        )
      );
    }
  }

  stomp(game) {
    this.hit(this.maxHp, game);
    game.popup(this.x + this.w / 2, this.y - 4, "ТОП!", "#9be04f");
  }

  updateCommon(dt, game) {
    this.flash = Math.max(0, this.flash - dt);
  }
}

export class Mole extends Enemy {
  constructor(x, y) {
    super(x, y, 17, 15, 2);
    this.type = "mole";
    this.speed = 36;
  }

  update(dt, game) {
    this.updateCommon(dt, game);
    this.vx = this.dir * this.speed;
    this.vy = Math.min(this.vy + GRAVITY * dt, MAX_FALL);
    const flags = moveBody(game.level, this, dt);
    if (flags.wall) this.dir *= -1;
    // Не падаем с уступов
    if (flags.ground) {
      const aheadX = this.dir > 0 ? this.x + this.w + 2 : this.x - 2;
      if (!isSolidAt(game.level, aheadX, this.y + this.h + 4)) this.dir *= -1;
    }
    if (chance(dt * 0.7)) this.dir *= -1;
    this.y += 0;
  }
}

export class Crow extends Enemy {
  constructor(x, y) {
    super(x, y, 16, 13, 1);
    this.type = "crow";
    this.baseY = y;
    this.phase = Math.random() * 6;
    this.speed = 46;
    this.score = 150;
  }

  update(dt, game) {
    this.updateCommon(dt, game);
    const target = game.player;
    const dx = target.cx - (this.x + this.w / 2);
    if (Math.abs(dx) > 8) this.dir = Math.sign(dx);
    this.vx = this.dir * this.speed;
    this.x += this.vx * dt;
    this.phase += dt * 2.2;
    this.y = this.baseY + Math.sin(this.phase) * 14;
    if (isSolidAt(game.level, this.x + this.w / 2, this.y + this.h / 2)) {
      this.x -= this.vx * dt;
      this.baseY += Math.sin(this.phase) * 6;
    }
  }
}

export class CactusGuy extends Enemy {
  constructor(x, y) {
    super(x, y, 17, 20, 3);
    this.type = "cactus";
    this.stompable = false;
    this.speed = 26;
    this.shootTimer = rand(1.2, 2.2);
    this.score = 180;
  }

  update(dt, game) {
    this.updateCommon(dt, game);
    const target = game.player;
    const dx = target.cx - (this.x + this.w / 2);
    const dist = Math.abs(dx);
    if (dist < 190) this.dir = Math.sign(dx) || this.dir;

    this.shootTimer -= dt;
    const busy = this.shootTimer < 0.35;
    this.vx = busy ? 0 : this.dir * this.speed;
    this.vy = Math.min(this.vy + GRAVITY * dt, MAX_FALL);
    const flags = moveBody(game.level, this, dt);
    if (flags.wall) this.dir *= -1;
    if (flags.ground) {
      const aheadX = this.dir > 0 ? this.x + this.w + 2 : this.x - 2;
      if (!isSolidAt(game.level, aheadX, this.y + this.h + 4)) this.dir *= -1;
    }

    if (this.shootTimer <= 0 && dist < 210 && Math.abs(target.cy - (this.y + 4)) < 60) {
      this.shootTimer = rand(1.9, 2.8);
      const sx = this.x + this.w / 2 + this.dir * 8;
      const sy = this.y + 6;
      const angle = Math.atan2(target.cy - sy, target.cx - sx);
      game.spawn(new EnemyShot(sx, sy, Math.cos(angle) * 118, Math.sin(angle) * 118 - 40, "spine"));
      game.sfx.shoot();
    }
  }
}

// ---------------------------------------------------------------------------
// Босс: кот Барсик
// ---------------------------------------------------------------------------

export class CatBoss extends Enemy {
  constructor(x, y) {
    super(x, y, 38, 36, 7);
    this.type = "boss";
    this.isBoss = true;
    this.stompable = false;
    this.state = "sleep";
    this.timer = 0;
    this.hp = this.maxHp = 30;
    this.score = 2500;
    this.attacks = 0;
    this.roared = false;
  }

  get enraged() {
    return this.hp <= this.maxHp * 0.4;
  }

  update(dt, game) {
    this.updateCommon(dt, game);
    const player = game.player;
    const dx = player.cx - (this.x + this.w / 2);
    this.timer -= dt;

    if (this.state === "sleep") {
      this.vx = 0;
      this.vy = Math.min(this.vy + GRAVITY * dt, MAX_FALL);
      moveBody(game.level, this, dt);
      if (dx < 150 && Math.abs(dx) < 150) {
        this.state = "wake";
        this.timer = 1.5;
        game.sfx.bossHit();
        game.shake(7);
        game.popup(this.x + this.w / 2, this.y - 12, "БАРСИК ПРОСНУЛСЯ!", "#ff7a6b");
        game.music("boss");
      }
      return;
    }

    if (this.state === "dying") {
      this.vx *= 0.9;
      this.vy = Math.min(this.vy + GRAVITY * dt, MAX_FALL);
      this.y += this.vy * dt;
      this.timer -= dt;
      if (this.timer <= 0) {
        this.dead = true;
        for (let i = 0; i < 40; i++) {
          game.particles.push(
            makeParticle(this.x + this.w / 2, this.y + this.h / 2, rand(-160, 160), rand(-200, 20), rand(0.5, 1.2), i % 3 ? "#ffd257" : "#ff7a6b", rand(2, 4))
          );
        }
        game.onBossDefeated();
      }
      return;
    }

    if (this.state === "wake") {
      this.vx = 0;
      this.vy = Math.min(this.vy + GRAVITY * dt, MAX_FALL);
      moveBody(game.level, this, dt);
      if (this.timer <= 0) {
        this.state = "idle";
        this.timer = 0.9;
      }
      return;
    }

    if (this.state === "idle") {
      this.dir = Math.sign(dx) || this.dir;
      this.vx = approach(this.vx, this.dir * (this.enraged ? 52 : 34), 300 * dt);
      this.vy = Math.min(this.vy + GRAVITY * dt, MAX_FALL);
      moveBody(game.level, this, dt);
      if (this.timer <= 0) {
        this.attacks++;
        if (this.attacks % 3 === 0 || chance(0.4)) {
          this.state = "lob";
          this.timer = 1.7;
          this.vy = -370;
          this.vx = this.dir * 90;
          game.sfx.jump();
        } else {
          this.state = "telegraph";
          this.timer = this.enraged ? 0.4 : 0.62;
          this.vx = 0;
          game.sfx.ui();
        }
      }
      return;
    }

    if (this.state === "telegraph") {
      this.vx = 0;
      this.vy = Math.min(this.vy + GRAVITY * dt, MAX_FALL);
      moveBody(game.level, this, dt);
      this.dir = Math.sign(dx) || this.dir;
      if (this.timer <= 0) {
        this.state = "charge";
        this.timer = 1.1;
        this.vx = this.dir * 330;
        this.lobbed = false;
        game.shake(3);
      }
      return;
    }

    if (this.state === "charge") {
      this.vy = Math.min(this.vy + GRAVITY * dt, MAX_FALL);
      const flags = moveBody(game.level, this, dt);
      if (Math.abs(this.vx) < 300) this.vx = this.dir * 330;
      if (flags.wall) {
        this.state = "stunned";
        this.timer = 1.5;
        this.vx = 0;
        game.shake(9);
        game.sfx.bossHit();
        for (let i = 0; i < 14; i++) {
          game.particles.push(
            makeParticle(this.x + this.w / 2 + this.dir * 14, this.y + 16, rand(-90, 90), rand(-110, 10), 0.6, "#ffe9a8", rand(1.6, 3.2))
          );
        }
        game.popup(this.x + this.w / 2, this.y - 10, "В КОНТУЗИИ!", "#9be04f");
      }
      if (this.timer <= 0 && this.state === "charge") {
        this.state = "idle";
        this.timer = 0.7;
      }
      return;
    }

    if (this.state === "stunned") {
      this.vx = approach(this.vx, 0, 400 * dt);
      this.vy = Math.min(this.vy + GRAVITY * dt, MAX_FALL);
      moveBody(game.level, this, dt);
      if (this.timer <= 0) {
        this.state = "idle";
        this.timer = 1.0;
      }
      return;
    }

    if (this.state === "lob") {
      this.vy = Math.min(this.vy + GRAVITY * dt, MAX_FALL);
      const flags = moveBody(game.level, this, dt);
      if (!this.lobbed && this.vy > -40) {
        this.lobbed = true;
        for (let i = 0; i < 2; i++) {
          game.spawn(new Dynamite(this.x + this.w / 2 + rand(-10, 10), this.y + 4, rand(-70, 70) + this.dir * 40, -120));
        }
        game.sfx.ui();
      }
      if (flags.ground) {
        this.state = "idle";
        this.timer = 0.8;
      } else if (this.timer <= 0) {
        this.state = "idle";
        this.timer = 0.5;
      }
      return;
    }
  }

  hit(dmg, game) {
    if (this.state === "sleep" || this.state === "dying") return;
    this.hp -= dmg;
    this.flash = 0.14;
    game.sfx.bossHit();
    game.shake(3);
    game.addScore(50, this.x + this.w / 2, this.y);
    for (let i = 0; i < 8; i++) {
      game.particles.push(
        makeParticle(this.x + this.w / 2, this.y + this.h / 2, rand(-90, 90), rand(-90, 30), 0.4, i % 2 ? "#ffd257" : "#ffffff", rand(1.5, 3))
      );
    }
    if (this.hp <= 0) {
      this.state = "dying";
      this.timer = 1.8;
      game.shake(12);
      game.flash(0.5, "#ffffff");
      game.stopMusic();
      game.sfx.victory();
    } else if (this.state === "charge" && dmg >= 2) {
      this.state = "stunned";
      this.timer = 0.9;
      this.vx = 0;
    }
  }

  stomp(game) {
    if (this.state === "stunned") {
      this.hit(2, game);
      game.popup(this.x + this.w / 2, this.y - 10, "КРИТ!", "#ffd257");
    } else {
      this.hit(1, game);
    }
  }
}

// ---------------------------------------------------------------------------
// Предметы
// ---------------------------------------------------------------------------

export class Coin {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.w = 12;
    this.h = 12;
    this.spin = Math.random() * 6.28;
    this.dead = false;
    this.value = 10;
    this.vy = 0;
    this.popping = false;
    this.life = 0;
  }

  update(dt, game) {
    if (this.popping) {
      this.vy += 900 * dt;
      this.y += this.vy * dt;
      this.life += dt;
      if (this.life > 0.6) this.dead = true;
    }
    if (aabb(this, game.player)) this.collect(game);
  }

  collect(game) {
    if (this.dead) return;
    this.dead = true;
    game.coins++;
    game.addScore(this.value);
    game.sfx.coin();
    for (let i = 0; i < 5; i++) {
      game.particles.push(
        makeParticle(this.x + 6, this.y + 6, rand(-45, 45), rand(-90, -20), 0.35, "#ffd95e", rand(1.2, 2.2))
      );
    }
  }
}

export class Acorn {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.w = 12;
    this.h = 13;
    this.dead = false;
    this.spin = Math.random() * 6;
    this.vy = 0;
    this.popping = false;
    this.life = 0;
  }

  update(dt, game) {
    if (this.popping) {
      this.vy += 900 * dt;
      this.y += this.vy * dt;
      this.life += dt;
      if (this.life > 1.1) this.dead = true;
    }
    if (aabb(this, game.player)) {
      this.dead = true;
      game.player.heal(game, 1);
      for (let i = 0; i < 8; i++) {
        game.particles.push(
          makeParticle(this.x + 6, this.y + 6, rand(-50, 50), rand(-80, -10), 0.5, "#ffd9a8", rand(1.4, 2.6))
        );
      }
    }
  }
}

export class Checkpoint {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.w = 14;
    this.h = 34;
    this.activated = false;
    this.dead = false;
  }

  update(dt, game) {
    if (this.activated) return;
    if (aabb(this, game.player)) {
      this.activated = true;
      game.player.respawn = { x: this.x - 2, y: this.y - 4 };
      game.sfx.checkpoint();
      game.popup(this.x + 6, this.y - 12, "ЧЕКПОИНТ!", "#7fe08a");
      game.flash(0.16, "#7fe08a");
      for (let i = 0; i < 14; i++) {
        game.particles.push(
          makeParticle(this.x + 6, this.y + 6, rand(-60, 60), rand(-110, -20), rand(0.4, 0.9), "#9bffa8", rand(1.4, 2.8))
        );
      }
    }
  }
}

export class Goal {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.w = 22;
    this.h = 110;
    this.dead = false;
  }

  update(dt, game) {
    if (aabb(this, game.player)) game.onLevelClear();
  }
}

export function makeParticle(x, y, vx, vy, life, color, size, shape = "dot") {
  return { x, y, vx, vy, life, maxLife: life, color, size, shape, gravity: shape === "text" ? -30 : 340 };
}

export function particleUpdate(p, dt) {
  p.life -= dt;
  p.vy += (p.gravity || 0) * dt;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  if (p.shape !== "text") p.vx *= 1 - 1.6 * dt;
}

export function makeEnemy(spawn) {
  const x = spawn.tileX * TILE;
  const y = spawn.tileY * TILE;
  switch (spawn.kind) {
    case "mole":
      return new Mole(x + 1, y + TILE - 15);
    case "crow":
      return new Crow(x, y);
    case "cactus":
      return new CactusGuy(x + 1, y + TILE - 20);
    case "cat":
      return new CatBoss(x - 4, y + TILE - 36);
    default:
      return null;
  }
}

export { randInt, clamp };
