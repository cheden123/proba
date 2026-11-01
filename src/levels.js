// Уровни и тайлмап. Уровни собираются кодом через маленький «конструктор»,
// так что их легко править и невозможно рассогласовать по длине строк.
import { TILE } from "./core.js";

export const T = {
  EMPTY: 0,
  GROUND: 1,
  STONE: 2,
  BRICK: 3,
  QBLOCK: 4,
  USED: 5,
  SPIKES: 6,
  LAVA: 7,
  PIPE: 8,
  CASTLE: 9,
};

const SOLID = new Set([T.GROUND, T.STONE, T.BRICK, T.QBLOCK, T.USED, T.PIPE, T.CASTLE]);

export const PALETTES = {
  valley: {
    id: "valley",
    skyTop: "#5fb8f2",
    skyMid: "#a8e0f7",
    skyBot: "#e8fbff",
    sun: "#fff7c2",
    cloud: "#ffffff",
    hillFar: "#a9dfa4",
    hillNear: "#6fc46f",
    tree: "#2f7f4a",
    treeDark: "#22633a",
    trunk: "#7a4a2a",
    dirt: "#b37a45",
    dirtDark: "#8d5a30",
    dirtLight: "#c99560",
    grass: "#63c95a",
    grassDark: "#3d9a42",
    stone: "#bcc7d8",
    stoneDark: "#8b97ad",
    brick: "#c8693f",
    brickDark: "#95472a",
    accent: "#ffd257",
    ambient: "day",
  },
  canyon: {
    id: "canyon",
    skyTop: "#f2764a",
    skyMid: "#ffab5e",
    skyBot: "#ffe0a8",
    sun: "#fff1b8",
    cloud: "#ffd5a8",
    hillFar: "#e59a6a",
    hillNear: "#b96248",
    tree: "#7a3a2c",
    treeDark: "#552520",
    trunk: "#5a3524",
    dirt: "#e0a869",
    dirtDark: "#a86c37",
    dirtLight: "#f2c489",
    grass: "#ffd79a",
    grassDark: "#c98a4a",
    stone: "#e2b98d",
    stoneDark: "#b58a5f",
    brick: "#a9623a",
    brickDark: "#7d4227",
    accent: "#ffcf63",
    ambient: "sunset",
  },
  lair: {
    id: "lair",
    skyTop: "#150d26",
    skyMid: "#241540",
    skyBot: "#3d2560",
    sun: "#f4f1c8",
    cloud: "#3a2a58",
    hillFar: "#2a1a47",
    hillNear: "#1d1133",
    tree: "#2a1a47",
    treeDark: "#1a1030",
    trunk: "#241638",
    dirt: "#5a4878",
    dirtDark: "#3b2d55",
    dirtLight: "#715b92",
    grass: "#9481c4",
    grassDark: "#6b5a96",
    stone: "#645385",
    stoneDark: "#443559",
    brick: "#6b5490",
    brickDark: "#4a3568",
    accent: "#ff8f5e",
    ambient: "night",
  },
};

export class Level {
  constructor(w, h, name, palette, index) {
    this.w = w;
    this.h = h;
    this.name = name;
    this.palette = palette;
    this.index = index;
    this.grid = new Uint8Array(w * h);
    this.spawns = [];
    this.decor = [];
    this.start = { x: 3 * TILE, y: 12 * TILE };
    this.goal = null;
  }

  get(tx, ty) {
    if (tx < 0 || tx >= this.w) return T.CASTLE;
    if (ty < 0 || ty >= this.h) return T.EMPTY;
    return this.grid[ty * this.w + tx];
  }

  set(tx, ty, value) {
    if (tx < 0 || tx >= this.w || ty < 0 || ty >= this.h) return;
    this.grid[ty * this.w + tx] = value;
  }

  isSolid(tx, ty) {
    if (ty < 0) return false;
    if (tx < 0 || tx >= this.w) return true;
    if (ty >= this.h) return false;
    return SOLID.has(this.grid[ty * this.w + tx]);
  }

  setWhenEmpty(tx, ty, value) {
    if (this.get(tx, ty) === T.EMPTY) this.set(tx, ty, value);
  }
}

class Builder {
  constructor(w, h, name, palette, index) {
    this.lv = new Level(w, h, name, palette, index);
  }

  fill(x, y, w, h, tile) {
    for (let ty = y; ty < y + h; ty++) for (let tx = x; tx < x + w; tx++) this.lv.set(tx, ty, tile);
    return this;
  }

  groundAll(top = 15, tile = T.GROUND) {
    this.fill(0, top, this.lv.w, this.lv.h - top, tile);
    return this;
  }

  pit(x0, x1, top = 15) {
    for (let x = x0; x < x1; x++) for (let y = top; y < this.lv.h; y++) this.lv.set(x, y, T.EMPTY);
    return this;
  }

  platform(x, y, w, tile = T.STONE) {
    this.fill(x, y, w, 1, tile);
    return this;
  }

  block(x, y, tile = T.BRICK) {
    this.lv.setWhenEmpty(x, y, tile);
    return this;
  }

  brickRow(x, y, w) {
    for (let i = 0; i < w; i++) this.block(x + i, y, T.BRICK);
    return this;
  }

  qblock(x, y, contents = "seed") {
    this.lv.set(x, y, T.QBLOCK);
    this.lv.spawns.push({ type: "qblock-content", tileX: x, tileY: y, contents });
    return this;
  }

  coins(x, y, count, dx = 1) {
    for (let i = 0; i < count; i++) {
      this.lv.spawns.push({ type: "coin", tileX: x + i * dx, tileY: y });
    }
    return this;
  }

  arc(cx, y, count) {
    for (let i = 0; i < count; i++) {
      const offset = i - (count - 1) / 2;
      this.lv.spawns.push({ type: "coin", tileX: cx + offset, tileY: y + Math.round(Math.abs(offset) * 0.8) });
    }
    return this;
  }

  spikes(x, count, y = 14) {
    for (let i = 0; i < count; i++) this.lv.set(x + i, y, T.SPIKES);
    return this;
  }

  lava(x0, x1, y = 16) {
    for (let x = x0; x < x1; x++) this.lv.set(x, y, T.LAVA);
    return this;
  }

  pipe(x, height, top = 15) {
    for (let i = 0; i < height; i++) {
      const y = top - 1 - i;
      this.lv.set(x, y, T.PIPE);
      this.lv.set(x + 1, y, T.PIPE);
    }
    return this;
  }

  stairs(x, steps, dir = 1, top = 15) {
    for (let i = 0; i < steps; i++) {
      const columnX = dir > 0 ? x + i : x + (steps - 1 - i);
      const height = i + 1;
      for (let h = 0; h < height; h++) this.lv.set(columnX, top - 1 - h, T.STONE);
    }
    return this;
  }

  enemy(type, tileX, tileY) {
    this.lv.spawns.push({ type: "enemy", kind: type, tileX, tileY });
    return this;
  }

  boss(tileX, tileY) {
    this.lv.spawns.push({ type: "boss", kind: "cat", tileX, tileY });
    return this;
  }

  decor(kind, tileX, tileY) {
    this.lv.decor.push({ kind, x: tileX * TILE, y: tileY * TILE });
    return this;
  }

  checkpoint(tileX, tileY) {
    this.lv.spawns.push({ type: "checkpoint", tileX, tileY });
    return this;
  }

  goal(tileX, tileY) {
    this.lv.spawns.push({ type: "goal", tileX, tileY });
    this.lv.goal = { x: tileX * TILE, y: tileY * TILE };
    return this;
  }

  start(tileX, tileY) {
    this.lv.start = { x: tileX * TILE, y: tileY * TILE };
    return this;
  }

  done() {
    return this.lv;
  }
}

// ---------------------------------------------------------------------------
// Уровень 1 — «Семечковая долина»
// ---------------------------------------------------------------------------
function levelValley() {
  const b = new Builder(172, 17, "Семечковая долина", PALETTES.valley, 0);
  b.groundAll(15);
  b.start(3, 13);

  // Спокойное начало: учимся бегать, прыгать и стрелять.
  b.coins(6, 12, 4);
  b.qblock(10, 11, "seed");
  b.decor("tree", 2, 15);
  b.decor("bush", 8, 15);
  b.enemy("mole", 15, 14);

  // Первая ямка.
  b.pit(21, 24);
  b.arc(22, 11, 4);
  b.enemy("crow", 26, 8);

  // Уступы и кирпичи.
  b.platform(28, 11, 3);
  b.coins(28, 10, 3);
  b.enemy("mole", 33, 14);
  b.brickRow(37, 10, 4);
  b.decor("bush", 40, 15);

  // Труба-нора и блоки.
  b.pipe(44, 2);
  b.enemy("mole", 48, 14);
  b.qblock(51, 10, "seed");
  b.qblock(53, 10, "acorn");
  b.qblock(55, 10, "seed");
  b.enemy("crow", 57, 7);

  // Лесенка.
  b.stairs(60, 3, 1);
  b.coins(60, 10, 3);
  b.enemy("mole", 66, 14);
  b.checkpoint(69, 14);
  b.decor("tree", 72, 15);

  // Каменные островки над пропастью.
  b.pit(73, 79);
  b.platform(74, 12, 2);
  b.platform(77, 10, 2);
  b.coins(74, 11, 2);
  b.coins(77, 9, 2);

  // Колючки и кактус-страж.
  b.enemy("cactus", 83, 14);
  b.spikes(87, 3, 14);
  b.coins(87, 11, 3);
  b.platform(86, 12, 5);
  b.enemy("crow", 91, 8);

  // Кирпичная стена.
  b.brickRow(95, 11, 5);
  b.qblock(97, 11, "seed");
  b.enemy("mole", 99, 14);
  b.pit(102, 105);
  b.arc(103, 11, 3);
  b.platform(107, 11, 4);
  b.coins(107, 10, 4);
  b.enemy("cactus", 112, 14);

  // Второй чекпоинт и финишная прямая.
  b.checkpoint(116, 14);
  b.enemy("mole", 120, 14);
  b.enemy("crow", 124, 9);
  b.qblock(127, 10, "acorn");
  b.coins(129, 12, 5);
  b.stairs(134, 4, 1);
  b.platform(138, 8, 3);
  b.coins(138, 7, 3);
  b.decor("bush", 145, 15);
  b.goal(152, 14);
  b.decor("tree", 160, 15);
  b.decor("bush", 165, 15);

  return b.done();
}

// ---------------------------------------------------------------------------
// Уровень 2 — «Тыквенный каньон» (лавоопасный закат)
// ---------------------------------------------------------------------------
function levelCanyon() {
  const b = new Builder(168, 17, "Тыквенный каньон", PALETTES.canyon, 1);
  b.groundAll(15);
  b.start(3, 13);

  b.decor("pumpkin", 5, 15);
  b.coins(6, 12, 3);
  b.enemy("mole", 11, 14);
  b.qblock(13, 10, "seed");
  b.decor("cactus-decor", 16, 15);

  b.pit(19, 22);
  b.lava(19, 22);
  b.arc(20, 10, 4);

  b.platform(24, 12, 2);
  b.platform(28, 10, 2);
  b.platform(32, 12, 2);
  b.coins(24, 11, 2);
  b.coins(28, 9, 2);
  b.coins(32, 11, 2);
  b.enemy("crow", 30, 7);

  b.enemy("cactus", 37, 14);
  b.spikes(41, 2, 14);
  b.qblock(44, 10, "acorn");
  b.enemy("mole", 46, 14);

  b.pit(49, 52);
  b.lava(49, 52);
  b.platform(50, 11, 3);
  b.coins(50, 10, 3);
  b.checkpoint(57, 14);
  b.decor("pumpkin", 60, 15);

  // Длинное лавовое озеро.
  b.pit(62, 74);
  b.lava(62, 74);
  b.platform(64, 12, 2);
  b.platform(68, 10, 2);
  b.platform(71, 12, 2);
  b.coins(64, 11, 2);
  b.coins(68, 9, 2);
  b.coins(71, 11, 2);
  b.enemy("crow", 67, 6);
  b.enemy("crow", 72, 7);

  b.enemy("cactus", 78, 14);
  b.brickRow(82, 11, 3);
  b.qblock(85, 11, "seed");
  b.enemy("mole", 87, 14);
  b.enemy("mole", 90, 14);
  b.spikes(93, 4, 14);
  b.platform(92, 11, 6);
  b.coins(92, 10, 6);

  b.pit(99, 103);
  b.lava(99, 103);
  b.arc(100, 10, 5);
  b.enemy("crow", 104, 7);

  b.checkpoint(108, 14);
  b.enemy("cactus", 112, 14);
  b.brickRow(115, 10, 4);
  b.qblock(118, 10, "seed");
  b.enemy("mole", 121, 14);

  b.pit(124, 127);
  b.lava(124, 127);
  b.platform(125, 12, 2);
  b.coins(125, 11, 2);

  b.stairs(131, 4, 1);
  b.coins(131, 9, 4);
  b.enemy("crow", 138, 8);
  b.decor("pumpkin", 142, 15);
  b.decor("cactus-decor", 146, 15);
  b.goal(150, 14);

  return b.done();
}

// ---------------------------------------------------------------------------
// Уровень 3 — «Логово Барсика» (замок кота-тирана)
// ---------------------------------------------------------------------------
function levelLair() {
  const b = new Builder(132, 17, "Логово Барсика", PALETTES.lair, 2);
  b.groundAll(15, T.CASTLE);
  b.start(3, 13);
  b.decor("torch", 4, 12);
  b.coins(5, 12, 3);

  b.enemy("crow", 9, 8);
  b.decor("torch", 12, 12);
  b.spikes(13, 2, 14);
  b.platform(12, 11, 4);
  b.coins(12, 10, 4);

  b.enemy("cactus", 18, 14);
  b.qblock(20, 10, "seed");
  b.brickRow(23, 11, 4);
  b.enemy("crow", 26, 7);
  b.decor("torch", 28, 12);
  b.coins(29, 12, 4);

  b.pit(33, 36);
  b.lava(33, 36);
  b.arc(34, 10, 4);
  b.platform(38, 11, 3);
  b.coins(38, 10, 3);

  b.enemy("mole", 43, 14);
  b.enemy("cactus", 47, 14);
  b.spikes(50, 3, 14);
  b.platform(49, 11, 4);
  b.coins(49, 10, 4);

  b.checkpoint(56, 14);
  b.decor("torch", 58, 12);
  b.brickRow(60, 10, 5);
  b.qblock(62, 10, "acorn");
  b.enemy("crow", 63, 7);
  b.enemy("mole", 66, 14);

  b.pit(69, 73);
  b.lava(69, 73);
  b.platform(70, 12, 2);
  b.platform(73, 10, 2);
  b.coins(70, 11, 2);
  b.coins(73, 9, 2);

  b.enemy("cactus", 78, 14);
  b.enemy("crow", 82, 8);
  b.spikes(84, 2, 14);
  b.qblock(86, 10, "seed");
  b.checkpoint(89, 14);

  // Арена босса: ровная площадка, справа — глухая стена.
  b.fill(129, 11, 3, 4, T.BRICK);
  b.decor("torch", 96, 12);
  b.decor("torch", 126, 12);
  b.boss(112, 13);

  return b.done();
}

export const LEVELS = [
  { name: "Семечковая долина", build: levelValley, song: "level" },
  { name: "Тыквенный каньон", build: levelCanyon, song: "canyon" },
  { name: "Логово Барсика", build: levelLair, song: "boss" },
];

export function buildLevel(index) {
  return LEVELS[index].build();
}
