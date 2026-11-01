// Вся графика рисуется кодом: пиксельные формы + мягкие тени. Никаких картинок.
import { TILE, VIEW_W, VIEW_H, hash2 } from "./core.js";
import { T as TILES } from "./levels.js";

const TAU = Math.PI * 2;

function rr(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

// Эллипс через arc + scale: работает в любом браузере и рендерере
// (ctx.ellipse поддерживается не везде одинаково).
function ell(ctx, x, y, rx, ry, fill, rot = 0) {
  const a = Math.max(0.1, rx);
  const b = Math.max(0.1, ry);
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  ctx.scale(1, b / a);
  ctx.beginPath();
  ctx.arc(0, 0, a, 0, TAU);
  ctx.restore();
  if (fill) ctx.fillStyle = fill;
  ctx.fill();
}

// ---------------------------------------------------------------------------
// Фон
// ---------------------------------------------------------------------------

export function drawSky(ctx, level, camX, camY, t) {
  const p = level.palette;
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, p.skyTop);
  g.addColorStop(0.62, p.skyMid);
  g.addColorStop(1, p.skyBot);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  // Солнце / луна
  const sunX = 380 - camX * 0.04;
  const sunY = 52 - camY * 0.05;
  const glow = ctx.createRadialGradient(sunX, sunY, 2, sunX, sunY, 70);
  glow.addColorStop(0, p.id === "lair" ? "rgba(240,238,210,0.5)" : "rgba(255,247,194,0.65)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 70, 0, TAU);
  ctx.fill();
  ctx.fillStyle = p.sun;
  ctx.beginPath();
  ctx.arc(sunX, sunY, p.id === "lair" ? 15 : 21, 0, TAU);
  ctx.fill();
  if (p.id === "lair") {
    ctx.fillStyle = "rgba(30,20,45,0.85)";
    ctx.beginPath();
    ctx.arc(sunX + 7, sunY - 4, 13, 0, TAU);
    ctx.fill();
  }

  // Облака
  if (p.id !== "lair") {
    ctx.fillStyle = p.cloud;
    ctx.globalAlpha = 0.9;
    for (let i = 0; i < 9; i++) {
      const seed = hash2(i, 7);
      const speed = 0.08 + seed * 0.06;
      const span = 760;
      let x = (i * 137 + t * (6 + seed * 10) - camX * speed) % span;
      x = ((x % span) + span) % span - 110;
      const y = 24 + seed * 66;
      const s = 0.7 + seed * 0.8;
      cloud(ctx, x, y, s);
    }
    ctx.globalAlpha = 1;
  }

  // Дальние холмы
  hills(ctx, p.hillFar, 152 - camY * 0.12, 0.18, camX, 150, 46, 3);
  hills(ctx, p.hillNear, 178 - camY * 0.2, 0.32, camX, 110, 34, 5);

  if (p.id === "lair") drawLairWall(ctx, camX, camY);
  if (p.id === "canyon") drawCanyonRocks(ctx, camX, camY);
}

function cloud(ctx, x, y, s) {
  ctx.beginPath();
  ctx.arc(x, y, 11 * s, 0, TAU);
  ctx.arc(x + 13 * s, y - 7 * s, 14 * s, 0, TAU);
  ctx.arc(x + 29 * s, y, 11 * s, 0, TAU);
  ctx.arc(x + 15 * s, y + 6 * s, 12 * s, 0, TAU);
  ctx.fill();
}

function hills(ctx, color, baseY, parallax, camX, period, height, count) {
  ctx.fillStyle = color;
  const offset = -(camX * parallax) % period;
  ctx.beginPath();
  ctx.moveTo(-40, VIEW_H);
  for (let i = -1; i < Math.ceil(VIEW_W / period) + 2; i++) {
    const cx = offset + i * period + period / 2;
    ctx.quadraticCurveTo(cx - period * 0.28, baseY - height, cx, baseY - height * 0.92);
    ctx.quadraticCurveTo(cx + period * 0.28, baseY - height, cx + period, baseY);
  }
  ctx.lineTo(VIEW_W + 40, VIEW_H);
  ctx.closePath();
  ctx.fill();
}

function drawCanyonRocks(ctx, camX, camY) {
  ctx.fillStyle = "rgba(78,30,38,0.5)";
  const off = -(camX * 0.45) % 180;
  for (let i = -1; i < 5; i++) {
    const x = off + i * 180;
    ctx.beginPath();
    ctx.moveTo(x, VIEW_H);
    ctx.lineTo(x + 26, 120 - camY * 0.3);
    ctx.lineTo(x + 54, 138 - camY * 0.3);
    ctx.lineTo(x + 82, 104 - camY * 0.3);
    ctx.lineTo(x + 118, VIEW_H);
    ctx.closePath();
    ctx.fill();
  }
}

function drawLairWall(ctx, camX, camY) {
  ctx.fillStyle = "rgba(18,11,30,0.55)";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const bw = 26;
  const bh = 15;
  const offX = (-camX * 0.5) % (bw * 2);
  const offY = (-camY * 0.5) % (bh * 2);
  for (let row = -1; row < VIEW_H / bh + 2; row++) {
    for (let col = -1; col < VIEW_W / bw + 2; col++) {
      const x = offX + col * bw + (row % 2 ? bw / 2 : 0);
      const y = offY + row * bh;
      ctx.fillStyle = "rgba(120,95,170,0.10)";
      ctx.fillRect(x, y, bw - 2, bh - 2);
    }
  }
  // Факелы на стене
  for (let i = 0; i < 6; i++) {
    const x = ((i * 190 - camX * 0.5) % 1100 + 1100) % 1100 - 100;
    const y = 96 + (i % 2) * 22;
    const flick = 0.75 + Math.sin(performance.now() / 90 + i) * 0.25;
    const glow = ctx.createRadialGradient(x, y, 1, x, y, 34 * flick);
    glow.addColorStop(0, "rgba(255,150,80,0.42)");
    glow.addColorStop(1, "rgba(255,120,60,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, 34, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#ffb066";
    ell(ctx, x, y, 3, 5 * flick);
    ctx.fillStyle = "#ffe6a8";
    ell(ctx, x, y + 1, 1.5, 2.6 * flick);
  }
}

// ---------------------------------------------------------------------------
// Декорации на земле
// ---------------------------------------------------------------------------

export function drawDecor(ctx, level, camX, camY, t) {
  for (const d of level.decor) {
    const x = d.x - camX;
    if (x < -80 || x > VIEW_W + 80) continue;
    const y = d.y - camY;
    switch (d.kind) {
      case "tree":
        tree(ctx, x, y, t);
        break;
      case "bush":
        bush(ctx, x, y, level.palette);
        break;
      case "pumpkin":
        pumpkin(ctx, x, y);
        break;
      case "cactus-decor":
        cactusDecor(ctx, x, y);
        break;
      case "torch":
        torch(ctx, x, y, t);
        break;
    }
  }
}

function tree(ctx, x, y, t) {
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ell(ctx, x + 16, y + 2, 22, 5);
  ctx.fillStyle = "#7a4a2a";
  ctx.fillRect(x + 12, y - 44, 8, 46);
  ctx.fillStyle = "#5f381f";
  ctx.fillRect(x + 12, y - 44, 2, 46);
  const sway = Math.sin(t * 1.4 + x * 0.05) * 1.6;
  ctx.fillStyle = "#2f7f4a";
  ell(ctx, x + 16 + sway, y - 56, 24, 20);
  ell(ctx, x - 2 + sway, y - 48, 15, 13);
  ell(ctx, x + 34 + sway, y - 48, 15, 13);
  ctx.fillStyle = "#43a35e";
  ell(ctx, x + 10 + sway, y - 62, 15, 12);
  ell(ctx, x + 28 + sway, y - 52, 9, 7);
  ctx.fillStyle = "#7ecf8a";
  ell(ctx, x + 6 + sway, y - 66, 5, 3.5);
}

function bush(ctx, x, y, p) {
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ell(ctx, x + 14, y + 1, 17, 4);
  ctx.fillStyle = p.grassDark;
  ell(ctx, x + 6, y - 6, 9, 7);
  ell(ctx, x + 16, y - 8, 11, 8);
  ell(ctx, x + 25, y - 5, 8, 6);
  ctx.fillStyle = p.grass;
  ell(ctx, x + 8, y - 10, 7, 5);
  ell(ctx, x + 18, y - 12, 8, 5.5);
}

function pumpkin(ctx, x, y) {
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ell(ctx, x + 12, y + 1, 14, 4);
  ctx.fillStyle = "#e77f2e";
  ell(ctx, x + 6, y - 8, 7, 8);
  ell(ctx, x + 16, y - 8, 7, 8);
  ell(ctx, x + 11, y - 9, 8, 9.5);
  ctx.fillStyle = "#ffab52";
  ell(ctx, x + 9, y - 11, 4, 5);
  ctx.fillStyle = "#4d7a34";
  ctx.fillRect(x + 10, y - 20, 2, 5);
  ctx.fillStyle = "#7a4a2a";
  ctx.fillRect(x + 9, y - 21, 5, 2);
  ctx.fillStyle = "#1c1226";
  ell(ctx, x + 8, y - 9, 1.4, 2);
  ell(ctx, x + 15, y - 9, 1.4, 2);
}

function cactusDecor(ctx, x, y) {
  ctx.fillStyle = "rgba(0,0,0,0.16)";
  ell(ctx, x + 10, y + 1, 11, 4);
  ctx.fillStyle = "#3f8a4a";
  rr(ctx, x + 5, y - 28, 10, 29, 5);
  ctx.fill();
  rr(ctx, x - 2, y - 22, 7, 9, 3.5);
  ctx.fill();
  rr(ctx, x - 2, y - 22, 5, 14, 2.5);
  ctx.fill();
  rr(ctx, x + 13, y - 18, 8, 9, 4);
  ctx.fill();
  ctx.fillStyle = "#5cb566";
  rr(ctx, x + 6, y - 27, 3, 26, 1.5);
  ctx.fill();
  ctx.fillStyle = "#f0e2b8";
  for (let i = 0; i < 4; i++) ctx.fillRect(x + 9 + (i % 2) * 3, y - 25 + i * 5, 1, 1);
}

function torch(ctx, x, y, t) {
  ctx.fillStyle = "#2b1d3f";
  ctx.fillRect(x + 5, y - 20, 4, 22);
  const flick = 0.8 + Math.sin(t * 9 + x) * 0.2;
  ctx.fillStyle = "#ff8f3c";
  ell(ctx, x + 7, y - 24, 5 * flick, 8 * flick);
  ctx.fillStyle = "#ffd36b";
  ell(ctx, x + 7, y - 23, 3 * flick, 5 * flick);
  ctx.fillStyle = "#fff6c4";
  ell(ctx, x + 7, y - 22, 1.5, 2.5 * flick);
}

// ---------------------------------------------------------------------------
// Тайлы
// ---------------------------------------------------------------------------

export function drawTiles(ctx, level, camX, camY, t) {
  const p = level.palette;
  const x0 = Math.max(0, Math.floor(camX / TILE) - 1);
  const x1 = Math.min(level.w - 1, Math.ceil((camX + VIEW_W) / TILE) + 1);
  const y0 = Math.max(0, Math.floor(camY / TILE) - 1);
  const y1 = Math.min(level.h - 1, Math.ceil((camY + VIEW_H) / TILE) + 1);

  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const tile = level.get(tx, ty);
      if (tile === TILES.EMPTY) continue;
      const x = Math.round(tx * TILE - camX);
      const y = Math.round(ty * TILE - camY);
      const above = level.get(tx, ty - 1);
      const seed = hash2(tx, ty);

      switch (tile) {
        case TILES.GROUND:
        case TILES.CASTLE: {
          const isCastle = tile === TILES.CASTLE;
          ctx.fillStyle = isCastle ? p.dirt : p.dirt;
          ctx.fillRect(x, y, TILE, TILE);
          // фактура земли
          ctx.fillStyle = isCastle ? p.dirtLight : p.dirtLight;
          if (seed > 0.55) ctx.fillRect(x + 3 + seed * 6, y + 5 + seed * 7, 2, 2);
          if (seed > 0.8) ctx.fillRect(x + 10, y + 11, 3, 2);
          ctx.fillStyle = isCastle ? p.dirtDark : p.dirtDark;
          ctx.fillRect(x, y + TILE - 2, TILE, 2);
          ctx.fillRect(x + TILE - 2, y, 2, TILE);
          if (above === TILES.EMPTY || above === TILES.LAVA) {
            // травяная кромка / гребень камня
            ctx.fillStyle = p.grass;
            ctx.fillRect(x, y, TILE, 4);
            ctx.fillStyle = p.grassDark;
            ctx.fillRect(x, y + 4, TILE, 2);
            if (isCastle) {
              ctx.fillStyle = p.grass;
              for (let i = 0; i < 3; i++) ctx.fillRect(x + 2 + i * 5, y - 2, 2, 2);
              ctx.fillStyle = p.grassDark;
              ctx.fillRect(x + 4, y + 2, 2, 2);
            } else {
              ctx.fillStyle = p.grass;
              ctx.fillRect(x + 2, y - 2, 2, 2);
              ctx.fillRect(x + 9, y - 1, 2, 1);
              ctx.fillRect(x + 13, y - 3, 2, 3);
            }
          }
          if (isCastle) {
            ctx.fillStyle = "rgba(20,12,32,0.22)";
            ctx.fillRect(x + 1, y + 6, TILE - 2, 1);
            ctx.fillRect(x + 5, y + 9, 1, TILE - 9);
          }
          break;
        }
        case TILES.STONE: {
          ctx.fillStyle = p.stone;
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = p.stoneDark;
          ctx.fillRect(x, y + TILE - 2, TILE, 2);
          ctx.fillRect(x + TILE - 2, y, 2, TILE);
          ctx.fillRect(x + 2, y + 6, TILE - 4, 1);
          ctx.fillStyle = "rgba(255,255,255,0.28)";
          ctx.fillRect(x + 1, y + 1, TILE - 3, 2);
          break;
        }
        case TILES.BRICK: {
          ctx.fillStyle = p.brick;
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = p.brickDark;
          ctx.fillRect(x, y + 7, TILE, 2);
          ctx.fillRect(x, y + 15, TILE, 1);
          ctx.fillRect(x + (ty % 2 ? 5 : 11), y, 2, 7);
          ctx.fillRect(x + (ty % 2 ? 11 : 5), y + 9, 2, 6);
          ctx.fillStyle = "rgba(255,255,255,0.16)";
          ctx.fillRect(x, y + 1, TILE, 1);
          break;
        }
        case TILES.QBLOCK: {
          const pulse = 0.5 + Math.sin(t * 5 + tx) * 0.5;
          ctx.fillStyle = "#f0a12c";
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = "#c8781a";
          ctx.fillRect(x, y + TILE - 3, TILE, 3);
          ctx.fillStyle = `rgba(255,240,170,${0.25 + pulse * 0.45})`;
          ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 6);
          ctx.fillStyle = "#7c4a10";
          ctx.font = "bold 11px 'Trebuchet MS', sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("?", x + TILE / 2, y + TILE / 2 - 1);
          // гвоздики
          ctx.fillStyle = "#8a5212";
          ctx.fillRect(x + 1, y + 1, 2, 2);
          ctx.fillRect(x + TILE - 3, y + 1, 2, 2);
          ctx.fillRect(x + 1, y + TILE - 3, 2, 2);
          ctx.fillRect(x + TILE - 3, y + TILE - 3, 2, 2);
          break;
        }
        case TILES.USED: {
          ctx.fillStyle = "#9a7a4a";
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = "#7a5d36";
          ctx.fillRect(x, y + TILE - 3, TILE, 3);
          ctx.fillStyle = "rgba(255,255,255,0.18)";
          ctx.fillRect(x + 2, y + 2, TILE - 4, 2);
          break;
        }
        case TILES.PIPE: {
          const isTop = level.get(tx, ty - 1) !== TILES.PIPE;
          const pipeColor = p.id === "lair" ? "#6a4f8e" : "#3fa64c";
          const pipeLight = p.id === "lair" ? "#9375c0" : "#7fe08a";
          const pipeDark = p.id === "lair" ? "#4a3468" : "#257635";
          if (isTop) {
            ctx.fillStyle = pipeDark;
            rr(ctx, x - 2, y, TILE + 4, 10, 2);
            ctx.fill();
            ctx.fillStyle = pipeColor;
            rr(ctx, x - 1, y + 1, TILE + 2, 8, 2);
            ctx.fill();
            ctx.fillStyle = pipeLight;
            ctx.fillRect(x + 2, y + 2, 3, 6);
            ctx.fillStyle = pipeColor;
            ctx.fillRect(x + 2, y + 10, TILE - 4, TILE - 10);
            ctx.fillStyle = pipeLight;
            ctx.fillRect(x + 3, y + 10, 3, TILE - 10);
            ctx.fillStyle = pipeDark;
            ctx.fillRect(x + TILE - 5, y + 10, 3, TILE - 10);
          } else {
            ctx.fillStyle = pipeColor;
            ctx.fillRect(x + 2, y, TILE - 4, TILE);
            ctx.fillStyle = pipeLight;
            ctx.fillRect(x + 3, y, 3, TILE);
            ctx.fillStyle = pipeDark;
            ctx.fillRect(x + TILE - 5, y, 3, TILE);
          }
          break;
        }
        case TILES.SPIKES: {
          ctx.fillStyle = p.id === "lair" ? "#b9aee0" : "#cfd7e3";
          for (let i = 0; i < 4; i++) {
            const sx = x + i * 4;
            ctx.beginPath();
            ctx.moveTo(sx, y + TILE);
            ctx.lineTo(sx + 2, y + 5);
            ctx.lineTo(sx + 4, y + TILE);
            ctx.closePath();
            ctx.fill();
          }
          ctx.fillStyle = "#8994a8";
          ctx.fillRect(x, y + TILE - 2, TILE, 2);
          break;
        }
        case TILES.LAVA: {
          const wobble = Math.sin(t * 3 + tx * 0.7) * 1.2;
          ctx.fillStyle = "#e2481f";
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = "#ff7a2a";
          ctx.fillRect(x, y + 2 + wobble, TILE, 5);
          ctx.fillStyle = "#ffc65a";
          const bx = x + ((t * 18 + tx * 7 + ty * 11) % TILE);
          ctx.fillRect(bx, y + 4 + wobble, 3, 2);
          ctx.fillStyle = "rgba(255,240,160,0.8)";
          ctx.fillRect(x + 3 + ((tx * 5) % 8), y + 9 + wobble, 2, 1);
          break;
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Хомяк
// ---------------------------------------------------------------------------

export function drawHamster(ctx, p, t) {
  const cx = p.x + p.w / 2;
  const baseY = p.y + p.h;
  const facing = p.facing;

  // тень
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ell(ctx, cx + p.w / 2, baseY + 1, p.w * 0.44, 2.6);

  ctx.save();
  ctx.translate(cx, baseY);
  ctx.scale(facing * p.squashX, p.squashY);
  ctx.translate(-8, -18); // рисуем в локальной сетке 16x18

  const running = p.onGround && Math.abs(p.vx) > 12;
  const cycle = Math.sin(t * 15);
  const bob = running ? Math.abs(cycle) * 1.1 : Math.sin(t * 2.6) * 0.4;
  const airborne = !p.onGround;

  // хвостик
  ctx.fillStyle = "#f6d3a0";
  ell(ctx, 1.6, 13.4, 2.2, 1.9);

  // задние лапки
  const swing = running ? cycle * 1.8 : 0;
  ctx.fillStyle = "#c07c3c";
  ell(ctx, 4.6 + swing, 16.4, 2.6, 1.5);
  ell(ctx, 9.6 - swing, 16.4, 2.6, 1.5);
  ctx.fillStyle = "#f6d3a0";
  ell(ctx, 4.4 + swing, 16.6, 1.6, 1);
  ell(ctx, 9.8 - swing, 16.6, 1.6, 1);

  // тушка
  const body = ctx.createLinearGradient(0, 6, 0, 17);
  body.addColorStop(0, "#f6bd72");
  body.addColorStop(0.6, "#e7a257");
  body.addColorStop(1, "#c07c3c");
  ctx.fillStyle = body;
  ell(ctx, 7.2, 12.2 + bob, 5.1, 4.8);
  // пузико
  ctx.fillStyle = "#ffedd0";
  ell(ctx, 6.6, 13.2 + bob, 3.3, 3.2);

  // бандана
  ctx.fillStyle = "#e2473c";
  ctx.beginPath();
  ctx.moveTo(3.4, 8.1 + bob);
  ctx.lineTo(11.6, 8.1 + bob);
  ctx.lineTo(10.6, 10.3 + bob);
  ctx.lineTo(4.6, 10.1 + bob);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#b8302a";
  ctx.beginPath();
  ctx.moveTo(4.2, 8.7 + bob);
  ctx.lineTo(0.4, 7.9 + bob);
  ctx.lineTo(1.6, 10.6 + bob);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ffd257";
  ctx.fillRect(6.6, 8.6 + bob, 1.6, 1.6);

  // ушки
  ctx.fillStyle = "#e7a35c";
  ell(ctx, 3.5, 2.4 + bob, 2.4, 2.3);
  ell(ctx, 11.6, 2.2 + bob, 2.4, 2.3);
  ctx.fillStyle = "#ffb9a0";
  ell(ctx, 3.6, 2.5 + bob, 1.2, 1.1);
  ell(ctx, 11.5, 2.3 + bob, 1.2, 1.1);

  // голова
  ctx.fillStyle = body;
  ell(ctx, 7.6, 5.9 + bob, 5.7, 5.1);
  // щёчки
  ctx.fillStyle = "#f9cf9a";
  ell(ctx, 10.6, 7.4 + bob, 3, 2.6);
  ell(ctx, 4.4, 7.4 + bob, 2.4, 2.2);
  // мордочка
  ctx.fillStyle = "#fff0d6";
  ell(ctx, 9.4, 7.2 + bob, 2.6, 2.1);

  // глаза
  const blink = Math.sin(t * 1.7) > 0.985 ? 0.25 : 1;
  ctx.fillStyle = "#241528";
  ell(ctx, 5.9, 5.2 + bob, 1.55, 1.85 * blink);
  ell(ctx, 10, 5.05 + bob, 1.55, 1.85 * blink);
  if (blink > 0.9) {
    ctx.fillStyle = "#ffffff";
    ell(ctx, 5.4, 4.6 + bob, 0.55, 0.6);
    ell(ctx, 9.5, 4.4 + bob, 0.5, 0.55);
  }
  // боевые брови
  ctx.strokeStyle = "#8d5a28";
  ctx.lineWidth = 1.1;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(4.2, 3.6 + bob);
  ctx.lineTo(7.2, 4.25 + bob);
  ctx.moveTo(11.7, 3.4 + bob);
  ctx.lineTo(8.7, 4.1 + bob);
  ctx.stroke();
  // носик
  ctx.fillStyle = "#c9603f";
  ell(ctx, 10.4, 6.9 + bob, 1, 0.85);
  // усики
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 0.55;
  ctx.beginPath();
  ctx.moveTo(11.6, 7.1 + bob);
  ctx.lineTo(15, 6.3 + bob);
  ctx.moveTo(11.6, 7.4 + bob);
  ctx.lineTo(15.1, 8 + bob);
  ctx.stroke();

  // рогатка
  const aim = p.aimAngle || 0;
  const recoil = p.recoil || 0;
  ctx.save();
  ctx.translate(11.4 - recoil * 0.7, 11.2 + bob);
  ctx.rotate(aim);
  // передняя лапка
  ctx.fillStyle = "#f6d3a0";
  ell(ctx, 0.2, 0.6, 1.7, 1.5);
  // рукоять
  ctx.fillStyle = "#8a5a2b";
  rr(ctx, -0.8, -2.2, 3.4, 5.4, 1.4);
  ctx.fill();
  ctx.fillStyle = "#a4692f";
  rr(ctx, -0.3, -2, 1.2, 4.8, 0.7);
  ctx.fill();
  // рогатинка
  ctx.strokeStyle = "#b1712f";
  ctx.lineWidth = 1.7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(2.4, 0.6);
  ctx.lineTo(6.2, -3);
  ctx.moveTo(2.4, 0.6);
  ctx.lineTo(6.4, 1.8);
  ctx.stroke();
  // резинка
  ctx.strokeStyle = "#f0e0d0";
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(6.2, -3);
  ctx.lineTo(2.6 - recoil * 0.6, 0.4);
  ctx.lineTo(6.4, 1.8);
  ctx.stroke();

  if (p.charge > 0) {
    const c = Math.min(1, p.charge / p.maxCharge);
    const r = 1.6 + c * 2.6;
    ctx.fillStyle = c >= 1 ? "#9be04f" : "#c9f26b";
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.arc(3, 0.2, r + 1.4, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(3, 0.2, r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.arc(2.4, -0.4, r * 0.4, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  // вторая лапка
  ctx.fillStyle = "#f6d3a0";
  ell(ctx, 6.2, 12.4 + bob, 1.7, 1.5);

  if (airborne) {
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ell(ctx, 3.2, 15.6, 1.6, 0.7);
  }
  ctx.restore();

  drawPlayerAura(ctx, p, cx, baseY);
}


function drawPlayerAura(ctx, p, cx, baseY) {
  if (p.invuln > 0) {
    const alpha = 0.35 + Math.sin(performance.now() / 60) * 0.25;
    ctx.strokeStyle = `rgba(255,255,255,${Math.max(0, alpha)})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(cx, baseY - p.h / 2, p.w * 0.62, p.h * 0.62, 0, 0, TAU);
    ctx.stroke();
  }
  if (p.transformed) {
    ctx.strokeStyle = "rgba(255,214,87,0.85)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, baseY - p.h / 2, p.w * 0.7 + Math.sin(performance.now() / 120) * 2, p.h * 0.7, 0, 0, TAU);
    ctx.stroke();
  }
}

// ---------------------------------------------------------------------------
// Враги
// ---------------------------------------------------------------------------

export function drawMole(ctx, e, t) {
  const cx = e.x + e.w / 2;
  const baseY = e.y + e.h;
  const walk = Math.sin(t * 9 + e.x * 0.1);
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ell(ctx, cx, baseY + 1, e.w * 0.45, 2.4);
  ctx.translate(cx, baseY);
  ctx.scale(e.dir, 1);
  ctx.translate(0, -e.h);

  // лапки
  ctx.fillStyle = "#5a4a52";
  ell(ctx, -4 + walk * 1.6, e.h - 2.5, 3.4, 2.2);
  ell(ctx, 4 - walk * 1.6, e.h - 2.5, 3.4, 2.2);

  // тело
  ctx.fillStyle = "#6d5b66";
  ell(ctx, 0, e.h * 0.55, e.w * 0.48, e.h * 0.42);
  ctx.fillStyle = "#8a7684";
  ell(ctx, 0, e.h * 0.62, e.w * 0.3, e.h * 0.26);

  // голова (приплюснутая)
  ctx.fillStyle = "#5e4d58";
  ell(ctx, 2, e.h * 0.3, e.w * 0.44, e.h * 0.28);

  // очки-«злые глазки»
  ctx.fillStyle = "#ffe066";
  ell(ctx, 3.5, e.h * 0.28, 2.2, 2.4);
  ell(ctx, 8.5, e.h * 0.28, 2.2, 2.4);
  ctx.fillStyle = "#1b1119";
  ell(ctx, 4.2, e.h * 0.29, 1, 1.3);
  ell(ctx, 9.2, e.h * 0.29, 1, 1.3);
  ctx.strokeStyle = "#3a2c34";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(1, e.h * 0.17);
  ctx.lineTo(5.5, e.h * 0.21);
  ctx.moveTo(11, e.h * 0.17);
  ctx.lineTo(7, e.h * 0.21);
  ctx.stroke();

  // носик
  ctx.fillStyle = "#e79bb0";
  ell(ctx, 8, e.h * 0.4, 1.8, 1.4);

  // когти-лопатки
  ctx.fillStyle = "#d9cdbf";
  ctx.beginPath();
  ctx.moveTo(-7, e.h * 0.5);
  ctx.lineTo(-12, e.h * 0.42);
  ctx.lineTo(-11, e.h * 0.58);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(7, e.h * 0.52);
  ctx.lineTo(12.5, e.h * 0.44);
  ctx.lineTo(11.5, e.h * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawCrow(ctx, e, t) {
  const cx = e.x + e.w / 2;
  const cy = e.y + e.h / 2;
  const flap = Math.sin(t * 12 + e.seed * 10);
  ctx.save();
  ctx.translate(cx, cy + Math.sin(t * 3 + e.seed * 6) * 1.5);
  ctx.scale(e.dir, 1);

  // крылья
  ctx.fillStyle = "#3c3450";
  ctx.beginPath();
  ctx.moveTo(-2, -1);
  ctx.lineTo(-14, -7 - flap * 6);
  ctx.lineTo(-6, 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#554a70";
  ctx.beginPath();
  ctx.moveTo(0, -2);
  ctx.lineTo(-9, -12 + flap * 5);
  ctx.lineTo(-2, 0);
  ctx.closePath();
  ctx.fill();

  // тело
  ctx.fillStyle = "#332c46";
  ell(ctx, 0, 1, 8, 6);
  ctx.fillStyle = "#443b5c";
  ell(ctx, -1, 2.5, 5, 3.4);

  // голова и клюв
  ctx.fillStyle = "#2b2439";
  ell(ctx, 5.5, -3, 4.4, 4);
  ctx.fillStyle = "#ffc75e";
  ctx.beginPath();
  ctx.moveTo(9.5, -3.4);
  ctx.lineTo(14.5, -2);
  ctx.lineTo(9.5, -0.8);
  ctx.closePath();
  ctx.fill();
  // глаз
  ctx.fillStyle = "#ff6b5e";
  ell(ctx, 6.6, -4, 1.6, 1.6);
  ctx.fillStyle = "#1a1220";
  ell(ctx, 6.9, -4, 0.8, 0.9);
  // хохолок
  ctx.fillStyle = "#2b2439";
  ctx.beginPath();
  ctx.moveTo(3, -6.5);
  ctx.lineTo(1, -11);
  ctx.lineTo(5, -7.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawCactusGuy(ctx, e, t) {
  const cx = e.x + e.w / 2;
  const baseY = e.y + e.h;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ell(ctx, cx, baseY + 1, e.w * 0.42, 2.4);
  ctx.translate(cx, baseY);
  ctx.scale(e.dir, 1);
  ctx.translate(0, -e.h);
  const hop = Math.abs(Math.sin(t * 5 + e.x * 0.05)) * 1.6;

  // горшок / лапки
  ctx.fillStyle = "#8a5a2b";
  ell(ctx, -4, e.h - 2, 3.4, 2.2);
  ell(ctx, 4, e.h - 2, 3.4, 2.2);

  // тело-кактус
  ctx.fillStyle = "#3f8a4a";
  rr(ctx, -e.w * 0.34, 4 - hop, e.w * 0.68, e.h - 5, 6);
  ctx.fill();
  ctx.fillStyle = "#4fa65b";
  rr(ctx, -e.w * 0.26, 5 - hop, e.w * 0.3, e.h - 8, 4);
  ctx.fill();
  // шипы
  ctx.fillStyle = "#e9e3bd";
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(-e.w * 0.36, 9 + i * 5 - hop, 1.6, 1.2);
    ctx.fillRect(e.w * 0.3, 11 + i * 5 - hop, 1.6, 1.2);
  }
  // ручки
  ctx.fillStyle = "#3f8a4a";
  ell(ctx, -e.w * 0.36, e.h * 0.55 - hop, 3, 4);
  ell(ctx, e.w * 0.36, e.h * 0.45 - hop, 3, 4);

  // глаза
  ctx.fillStyle = "#fff3c4";
  ell(ctx, 1, e.h * 0.3 - hop, 3.2, 3.4);
  ell(ctx, 7.5, e.h * 0.3 - hop, 3.2, 3.4);
  ctx.fillStyle = "#241528";
  ell(ctx, 2, e.h * 0.31 - hop, 1.4, 1.8);
  ell(ctx, 8.5, e.h * 0.31 - hop, 1.4, 1.8);
  // сердитые брови и рот
  ctx.strokeStyle = "#24522b";
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(-1.5, e.h * 0.2 - hop);
  ctx.lineTo(3.4, e.h * 0.23 - hop);
  ctx.moveTo(11, e.h * 0.2 - hop);
  ctx.lineTo(6.4, e.h * 0.23 - hop);
  ctx.stroke();
  ctx.fillStyle = "#24522b";
  rr(ctx, 2, e.h * 0.42 - hop, 5, 2, 1);
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Босс — кот Барсик
// ---------------------------------------------------------------------------

export function drawCatBoss(ctx, b, t) {
  const cx = b.x + b.w / 2;
  const baseY = b.y + b.h;
  const hurt = b.hurtFlash > 0;
  const rage = b.hp <= b.maxHp * 0.4;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ell(ctx, cx, baseY + 2, b.w * 0.44, 5);

  ctx.translate(cx, baseY);
  if (b.state === "dying") ctx.rotate(Math.sin(t * 30) * 0.12);
  ctx.scale(b.dir, 1);
  ctx.translate(0, -b.h);
  const breathe = Math.sin(t * 4) * 1.5;

  // хвост
  ctx.strokeStyle = rage ? "#5c4a80" : "#6b5a92";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-b.w * 0.36, b.h * 0.72);
  ctx.quadraticCurveTo(-b.w * 0.72, b.h * 0.6 - breathe, -b.w * 0.6, b.h * 0.36 + Math.sin(t * 6) * 6);
  ctx.stroke();

  // лапы
  ctx.fillStyle = rage ? "#4a3a68" : "#584676";
  ell(ctx, -b.w * 0.24, b.h - 5, b.w * 0.16, b.h * 0.07);
  ell(ctx, b.w * 0.22, b.h - 5, b.w * 0.16, b.h * 0.07);

  // тело
  const g = ctx.createLinearGradient(0, 10, 0, b.h);
  g.addColorStop(0, hurt ? "#ffd0d0" : rage ? "#8270b4" : "#9583c4");
  g.addColorStop(1, hurt ? "#ffb3b3" : rage ? "#5d4d8a" : "#6c5a9c");
  ctx.fillStyle = g;
  ell(ctx, 0, b.h * 0.62, b.w * 0.4, b.h * 0.36);
  // полоски
  ctx.fillStyle = rage ? "#3b2d5c" : "#4c3d70";
  for (let i = 0; i < 3; i++) {
    ell(ctx, -b.w * 0.2 + i * b.w * 0.18, b.h * 0.5 + i * 2, 2.5, 7, ctx.fillStyle, 0.25);
  }
  // нагрудник
  ctx.fillStyle = "#ece5f6";
  ell(ctx, 2, b.h * 0.68, b.w * 0.22, b.h * 0.26);

  // голова
  ctx.fillStyle = hurt ? "#ffd0d0" : rage ? "#7565a6" : "#8c7aba";
  ell(ctx, 2, b.h * 0.3, b.w * 0.36, b.h * 0.3);
  // уши
  ctx.beginPath();
  ctx.moveTo(-b.w * 0.3, b.h * 0.14);
  ctx.lineTo(-b.w * 0.34, -2);
  ctx.lineTo(-b.w * 0.1, b.h * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(b.w * 0.3, b.h * 0.12);
  ctx.lineTo(b.w * 0.34, -1);
  ctx.lineTo(b.w * 0.12, b.h * 0.09);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#e6a0b8";
  ctx.beginPath();
  ctx.moveTo(-b.w * 0.28, b.h * 0.12);
  ctx.lineTo(-b.w * 0.3, 2);
  ctx.lineTo(-b.w * 0.15, b.h * 0.1);
  ctx.closePath();
  ctx.fill();

  // глаза (в ярости светятся)
  const eyeGlow = rage ? "#ff5a4a" : "#ffe066";
  ctx.fillStyle = eyeGlow;
  ell(ctx, -6, b.h * 0.3, 5.5, 6);
  ell(ctx, 10, b.h * 0.3, 5.5, 6);
  ctx.fillStyle = "#151020";
  const pupilShift = b.state === "charge" ? 2.5 : 0.8;
  ell(ctx, -4.8 + pupilShift, b.h * 0.31, 1.6, 4.2);
  ell(ctx, 11.2 + pupilShift, b.h * 0.31, 1.6, 4.2);
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ell(ctx, -7, b.h * 0.28, 1.4, 1.6);
  ell(ctx, 9, b.h * 0.28, 1.4, 1.6);

  // нос и пасть
  ctx.fillStyle = "#e39ab2";
  ctx.beginPath();
  ctx.moveTo(2, b.h * 0.4);
  ctx.lineTo(5, b.h * 0.4);
  ctx.lineTo(3.5, b.h * 0.44);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#3a2c4c";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(3.5, b.h * 0.44);
  ctx.lineTo(3.5, b.h * 0.48);
  ctx.moveTo(-3, b.h * 0.5);
  ctx.quadraticCurveTo(1.5, b.h * 0.54, 3.5, b.h * 0.48);
  ctx.moveTo(10, b.h * 0.5);
  ctx.quadraticCurveTo(6, b.h * 0.54, 3.5, b.h * 0.48);
  ctx.stroke();
  // усы
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(6, b.h * 0.44);
  ctx.lineTo(20, b.h * 0.4);
  ctx.moveTo(6, b.h * 0.46);
  ctx.lineTo(20, b.h * 0.5);
  ctx.stroke();

  // клыки в ярости
  if (rage) {
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.moveTo(-1, b.h * 0.49);
    ctx.lineTo(1, b.h * 0.49);
    ctx.lineTo(0, b.h * 0.54);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(7, b.h * 0.49);
    ctx.lineTo(9, b.h * 0.49);
    ctx.lineTo(8, b.h * 0.54);
    ctx.closePath();
    ctx.fill();
  }

  // корона-«повелитель кладовки»
  ctx.fillStyle = "#ffcf4d";
  ctx.beginPath();
  ctx.moveTo(-b.w * 0.16, b.h * 0.08);
  ctx.lineTo(-b.w * 0.16, -6);
  ctx.lineTo(-b.w * 0.05, 0);
  ctx.lineTo(b.w * 0.04, -8);
  ctx.lineTo(b.w * 0.13, 0);
  ctx.lineTo(b.w * 0.24, -6);
  ctx.lineTo(b.w * 0.24, b.h * 0.08);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ff5f6d";
  ell(ctx, b.w * 0.04, -2, 1.8, 1.8);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Предметы и эффекты
// ---------------------------------------------------------------------------

export function drawCoin(ctx, c, t) {
  const cx = c.x + c.w / 2;
  const cy = c.y + c.h / 2 + Math.sin(t * 4 + c.spin) * 1.4;
  const squash = Math.abs(Math.cos(t * 5 + c.spin));
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(0.35 + squash * 0.65, 1);
  ctx.fillStyle = "#f0b429";
  ctx.beginPath();
  ctx.arc(0, 0, 5.4, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#ffd95e";
  ctx.beginPath();
  ctx.arc(-0.6, -0.7, 4, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#c98d12";
  ctx.beginPath();
  ctx.arc(0, 0, 2.2, 0, TAU);
  ctx.fill();
  ctx.restore();
  if (squash > 0.75) {
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillRect(cx - 3, cy - 3.4, 1.4, 1.4);
  }
}

export function drawAcorn(ctx, c, t) {
  const cx = c.x + c.w / 2;
  const cy = c.y + c.h / 2 + Math.sin(t * 3.4 + c.spin) * 1.6;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.sin(t * 2 + c.spin) * 0.16);
  ctx.fillStyle = "#d99a52";
  ell(ctx, 0, 1.5, 4.6, 5);
  ctx.fillStyle = "#8a5a2b";
  rr(ctx, -5, -5.5, 10, 5, 2.4);
  ctx.fill();
  ctx.fillStyle = "#6f4420";
  ctx.fillRect(-1, -8, 2, 3.5);
  ctx.fillStyle = "#ffd9a8";
  ell(ctx, -1.6, 1, 1.6, 2.2);
  ctx.restore();
}

export function drawPellet(ctx, p) {
  const cx = p.x + p.w / 2;
  const cy = p.y + p.h / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.atan2(p.vy, p.vx));
  if (p.kind === "bounce") {
    ctx.fillStyle = "#9be04f";
    ell(ctx, 0, 0, 4.4, 3.4);
    ctx.fillStyle = "#d9ff9a";
    ell(ctx, -1.2, -0.9, 2, 1.5);
  } else {
    ctx.fillStyle = "rgba(190,240,120,0.35)";
    ell(ctx, 0, 0, 6, 4);
    ctx.fillStyle = "#b6ef6a";
    ell(ctx, 0, 0, 3.4, 2.4);
    ctx.fillStyle = "#f2ffd0";
    ell(ctx, -1, -0.6, 1.2, 0.9);
  }
  ctx.restore();
}

export function drawDynamite(ctx, d, t) {
  const cx = d.x + d.w / 2;
  const cy = d.y + d.h / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(d.rot);
  ctx.fillStyle = "#c0392b";
  rr(ctx, -4, -8, 8, 16, 2);
  ctx.fill();
  ctx.fillStyle = "#e74c3c";
  rr(ctx, -2.6, -7, 3, 14, 1.4);
  ctx.fill();
  ctx.fillStyle = "#f5e6c8";
  ctx.fillRect(-4, -2, 8, 3);
  // искрящийся фитиль
  ctx.strokeStyle = "#8a6a3a";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.quadraticCurveTo(3, -11, 5, -9);
  ctx.stroke();
  const spark = 0.6 + Math.abs(Math.sin(t * 22 + d.x)) * 0.7;
  ctx.fillStyle = "#ffe27a";
  ell(ctx, 5, -9, 2.2 * spark, 2.2 * spark);
  ctx.fillStyle = "#fff";
  ell(ctx, 5, -9, 1 * spark, 1 * spark);
  ctx.restore();
}

export function drawGoal(ctx, g, t) {
  const x = g.x;
  const y = g.y;
  // «Кладовая свободы»: шест с флагом-семечкой
  const bob = Math.sin(t * 2.2) * 1.5;
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ell(ctx, x + 12, y + 17, 16, 3.5);
  ctx.fillStyle = "#9aa4b4";
  ctx.fillRect(x + 8, y - 100, 5, 118);
  ctx.fillStyle = "#c3ccdb";
  ctx.fillRect(x + 8, y - 100, 2, 118);
  // шар сверху
  ctx.fillStyle = "#ffd257";
  ctx.beginPath();
  ctx.arc(x + 10.5, y - 104, 5.5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#fff2b8";
  ctx.beginPath();
  ctx.arc(x + 9, y - 106, 2, 0, TAU);
  ctx.fill();
  // флаг-семечко
  ctx.save();
  ctx.translate(x + 13, y - 92 + bob);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(18, 3, 28, 12);
  ctx.quadraticCurveTo(16, 19, 0, 23);
  ctx.closePath();
  ctx.fillStyle = "#e2473c";
  ctx.fill();
  ctx.fillStyle = "#c2342b";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(28, 12);
  ctx.lineTo(0, 12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ffe9a8";
  ctx.font = "bold 7px 'Trebuchet MS', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("СЕМЕЧКО", 14, 17);
  ctx.restore();
  // пьедестал
  ctx.fillStyle = "#b9a27a";
  rr(ctx, x, y - 4, 21, 21, 3);
  ctx.fill();
  ctx.fillStyle = "#d8c39a";
  rr(ctx, x + 2, y - 2, 17, 6, 2);
  ctx.fill();
}

export function drawCheckpoint(ctx, c, t) {
  const x = c.x;
  const y = c.y;
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ell(ctx, x + 6, y + 17, 10, 3);
  ctx.fillStyle = "#6f5638";
  ctx.fillRect(x + 3, y - 30, 4, 47);
  ctx.fillStyle = "#8f7150";
  ctx.fillRect(x + 3, y - 30, 2, 47);
  const on = c.activated;
  ctx.save();
  ctx.translate(x + 6, y - 28);
  const wave = on ? Math.sin(t * 6) * 3 : 0;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(10 + wave, 2, 18 + wave, 6);
  ctx.quadraticCurveTo(10, 11, 0, 14);
  ctx.closePath();
  ctx.fillStyle = on ? "#6fce6a" : "#7f8794";
  ctx.fill();
  ctx.fillStyle = on ? "#d9ffcf" : "#b0b7c2";
  ctx.beginPath();
  ctx.arc(8 + wave * 0.4, 7, 3.4, 0, TAU);
  ctx.fill();
  ctx.restore();
  if (on) {
    const glow = ctx.createRadialGradient(x + 6, y - 22, 1, x + 6, y - 22, 22);
    glow.addColorStop(0, "rgba(140,255,140,0.28)");
    glow.addColorStop(1, "rgba(140,255,140,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x + 6, y - 22, 22, 0, TAU);
    ctx.fill();
  }
}

export function drawParticle(ctx, p) {
  const life = Math.max(0, p.life / p.maxLife);
  ctx.globalAlpha = Math.min(1, life * 1.6);
  ctx.fillStyle = p.color;
  if (p.shape === "spark") {
    ctx.fillRect(p.x, p.y, p.size, p.size);
  } else if (p.shape === "ring") {
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 2 * life;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (1.2 - life), 0, TAU);
    ctx.stroke();
  } else if (p.shape === "text") {
    ctx.fillStyle = p.color;
    ctx.font = `bold ${p.size}px 'Trebuchet MS', sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(p.text, p.x, p.y);
  } else {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * life, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

