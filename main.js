import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/* ============================================================
   NEON SNAKE 3D — змейка с неоновой 3D-графикой
   Уровни · Порталы · Power-ups · Комбо · Скины · AI-демо в меню
   ============================================================ */

// ---------- Константы ----------
const N = 21;                 // размер поля (клетки)
const CELL = 1;
const CENTER = (N - 1) / 2;
const BODY_Y = 0.42;

const $ = (id) => document.getElementById(id);

// ---------- RNG с сидом (стабильные уровни) ----------
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- Темы миров ----------
const THEMES = {
  garden:  { sky: 0x04070d, fog: 0x04070d, fogNear: 16, fogFar: 46, ground: 0x0a1510, grid1: 0x00ff9d, grid2: 0x0e3b2e, wall: 0x00ff9d, ambient: 0x88ffcc, deco: 'trees',     sun: 0x66ffcc, music: 0 },
  crystal: { sky: 0x0a0618, fog: 0x0b0618, fogNear: 16, fogFar: 44, ground: 0x120b26, grid1: 0xb366ff, grid2: 0x3a1d5e, wall: 0xc77dff, ambient: 0xcc99ff, deco: 'crystals',  sun: 0xb366ff, music: 2 },
  lava:    { sky: 0x160402, fog: 0x1c0503, fogNear: 14, fogFar: 40, ground: 0x1c0b06, grid1: 0xff5a1f, grid2: 0x5e1d0a, wall: 0xff6b35, ambient: 0xffaa66, deco: 'rocks',     sun: 0xff5a1f, music: 4 },
  ice:     { sky: 0x020a14, fog: 0x03141f, fogNear: 16, fogFar: 48, ground: 0x08131c, grid1: 0x5ee7ff, grid2: 0x14424f, wall: 0x7df9ff, ambient: 0xbfefff, deco: 'shards',    sun: 0x9beaff, music: 5 },
  synth:   { sky: 0x0d0221, fog: 0x0d0221, fogNear: 16, fogFar: 46, ground: 0x150833, grid1: 0xff2fb3, grid2: 0x541b6b, wall: 0xff2fb3, ambient: 0xff9de2, deco: 'pillars',   sun: 0xff2fb3, music: 7 },
  space:   { sky: 0x010103, fog: 0x020208, fogNear: 18, fogFar: 52, ground: 0x07070f, grid1: 0x8a7bff, grid2: 0x23234d, wall: 0x9d8cff, ambient: 0xaaaaff, deco: 'asteroids', sun: 0x8a7bff, music: 9 },
};

// ---------- Уровни ----------
const LEVELS = [
  { name: 'Неоновый сад',    emoji: '🌿', theme: 'garden',  speed: 6,   target: 8,  gen: 'empty'  },
  { name: 'Кристаллы',       emoji: '💎', theme: 'crystal', speed: 7,   target: 10, gen: 'pillars' },
  { name: 'Лава',            emoji: '🌋', theme: 'lava',    speed: 8,   target: 12, gen: 'cross'   },
  { name: 'Ледяной лабиринт',emoji: '❄️', theme: 'ice',     speed: 8,   target: 12, gen: 'maze'    },
  { name: 'Порталы',         emoji: '🌀', theme: 'synth',   speed: 9,   target: 14, gen: 'scatter', portals: true },
  { name: 'Космос',          emoji: '🚀', theme: 'space',   speed: 10,  target: 16, gen: 'arena', movers: true },
];

// ---------- Скины ----------
const SKINS = [
  { id: 'neon',    name: 'Неон',     dot: '#00ff9d', head: 0xccffe9, body: 0x00ff9d, tail: 0x00885a, glow: 0x00ff9d },
  { id: 'cyber',   name: 'Киберпанк',dot: '#ff2fb3', head: 0xffd7ef, body: 0xff2fb3, tail: 0x7b1e5c, glow: 0xff2fb3 },
  { id: 'gold',    name: 'Золото',   dot: '#ffd257', head: 0xfff3d0, body: 0xffc93c, tail: 0x9a6b00, glow: 0xffc93c, crown: true },
  { id: 'frost',   name: 'Мороз',    dot: '#5ee7ff', head: 0xe3fbff, body: 0x38c8ec, tail: 0x14607e, glow: 0x5ee7ff },
  { id: 'magma',   name: 'Магма',    dot: '#ff5a1f', head: 0xffe3d3, body: 0xff5a1f, tail: 0x7e1f00, glow: 0xff5a1f, horns: true },
  { id: 'rainbow', name: 'Радуга',   dot: 'linear-gradient(135deg,#ff5a5a,#ffd257,#00ff9d,#5ee7ff,#c77dff)', rainbow: true, head: 0xffffff, body: 0xffffff, tail: 0xffffff, glow: 0xffffff },
];

// ---------- Power-ups ----------
const POWERS = {
  magnet: { emoji: '🧲', name: 'МАГНИТ',        color: 0xff5d5d, dur: 12 },
  slow:   { emoji: '🐢', name: 'SLOW-MO',       color: 0x5ee7ff, dur: 8 },
  ghost:  { emoji: '👻', name: 'ПРИЗРАК',       color: 0xc9a7ff, dur: 8 },
  double: { emoji: '⭐', name: 'x2 ОЧКИ',       color: 0xffd257, dur: 12 },
  shield: { emoji: '🛡', name: 'ЩИТ',           color: 0x7dff9e, dur: 0 },
  shrink: { emoji: '✂️', name: '− ХВОСТ',       color: 0xff9de2, dur: 0 },
};
const POWER_KEYS = Object.keys(POWERS);

// ---------- Сохранение ----------
const store = {
  get best() { try { return JSON.parse(localStorage.getItem('neon3d_best') || '{}'); } catch { return {}; } },
  setBest(level, score) {
    const b = this.best;
    if (score > (b[level] || 0)) { b[level] = score; localStorage.setItem('neon3d_best', JSON.stringify(b)); return true; }
    return false;
  },
  get unlocked() { return parseInt(localStorage.getItem('neon3d_unlocked') || '1', 10); },
  set unlocked(v) { localStorage.setItem('neon3d_unlocked', String(v)); },
  get skin() { return localStorage.getItem('neon3d_skin') || 'neon'; },
  set skin(v) { localStorage.setItem('neon3d_skin', v); },
  get sound() { return localStorage.getItem('neon3d_sound') !== '0'; },
  set sound(v) { localStorage.setItem('neon3d_sound', v ? '1' : '0'); },
  get music() { return localStorage.getItem('neon3d_music') !== '0'; },
  set music(v) { localStorage.setItem('neon3d_music', v ? '1' : '0'); },
};

// ============================================================
//  ЗВУК — синтез через WebAudio, ноль аудиофайлов
// ============================================================
const AudioSys = {
  ctx: null, master: null, musicGain: null, musicTimer: null, step: 0,
  soundOn: store.sound, musicOn: store.music, musicKey: 0,

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.16;
      this.musicGain.connect(this.master);
    } catch { /* без звука */ }
  },
  tone({ f = 440, f2 = null, t = 0.15, type = 'sine', v = 0.5, at = 0, dest = null }) {
    if (!this.ctx || !this.soundOn && dest !== this.musicGain) return;
    if (dest === this.musicGain && !this.musicOn) return;
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    const t0 = c.currentTime + at;
    o.type = type; o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + t);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + t);
    o.connect(g); g.connect(dest || this.master);
    o.start(t0); o.stop(t0 + t + 0.05);
  },
  noise({ t = 0.2, v = 0.4, at = 0, hp = 800 }) {
    if (!this.ctx || !this.soundOn) return;
    const c = this.ctx, len = Math.floor(c.sampleRate * t);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource(); src.buffer = buf;
    const flt = c.createBiquadFilter(); flt.type = 'highpass'; flt.frequency.value = hp;
    const g = c.createGain(); g.gain.value = v;
    src.connect(flt); flt.connect(g); g.connect(this.master);
    src.start(c.currentTime + at);
  },
  click()  { this.tone({ f: 700, f2: 990, t: 0.07, type: 'square', v: 0.15 }); },
  eat(combo = 1) {
    const base = 420 + Math.min(combo, 8) * 70;
    this.tone({ f: base, f2: base * 1.8, t: 0.12, type: 'sine', v: 0.5 });
    this.tone({ f: base * 2, t: 0.08, type: 'triangle', v: 0.2, at: 0.03 });
  },
  golden() { [660, 880, 1320].forEach((f, i) => this.tone({ f, t: 0.14, type: 'triangle', v: 0.4, at: i * 0.07 })); },
  power()  {
    this.tone({ f: 220, f2: 880, t: 0.25, type: 'sawtooth', v: 0.16 });
    this.tone({ f: 440, f2: 1760, t: 0.3, type: 'sine', v: 0.3, at: 0.05 });
  },
  portal() { this.tone({ f: 900, f2: 200, t: 0.22, type: 'sine', v: 0.35 }); this.tone({ f: 300, f2: 1200, t: 0.2, type: 'sine', v: 0.25, at: 0.12 }); },
  shieldBreak() { this.tone({ f: 1200, f2: 300, t: 0.3, type: 'square', v: 0.25 }); this.noise({ t: 0.25, v: 0.3 }); },
  death()  {
    this.tone({ f: 320, f2: 55, t: 0.7, type: 'sawtooth', v: 0.3 });
    this.tone({ f: 160, f2: 40, t: 0.8, type: 'square', v: 0.2, at: 0.05 });
    this.noise({ t: 0.4, v: 0.35, hp: 200 });
  },
  win()    { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone({ f, t: 0.22, type: 'triangle', v: 0.4, at: i * 0.1 })); },
  turn()   { this.tone({ f: 240, t: 0.04, type: 'sine', v: 0.08 }); },

  // Генеративная музыка: пентатоника + бас + хэт
  startMusic(key = 0) {
    if (!this.ctx || this.musicTimer) { this.musicKey = key; return; }
    this.musicKey = key; this.step = 0;
    const roots = [110, 123.5, 130.8, 146.8, 164.8, 174.6];
    const root = roots[key % roots.length];
    const penta = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3, 2, 9 / 4, 5 / 2];
    this.musicTimer = setInterval(() => {
      if (!this.musicOn || !this.ctx) return;
      const s = this.step++;
      if (s % 2 === 0) this.tone({ f: root / 2, t: 0.3, type: 'triangle', v: 0.7, dest: this.musicGain });
      if (s % 4 === 2 && Math.random() < 0.8) {
        const n = penta[Math.floor(Math.random() * penta.length)];
        this.tone({ f: root * 2 * n, t: 0.35, type: 'sine', v: 0.5, dest: this.musicGain });
        if (Math.random() < 0.3) this.tone({ f: root * 4 * n, t: 0.25, type: 'sine', v: 0.25, at: 0.12, dest: this.musicGain });
      }
      if (s % 2 === 1 && Math.random() < 0.5) this.tone({ f: root * 8, t: 0.05, type: 'square', v: 0.06, dest: this.musicGain });
    }, 240);
  },
};

// ============================================================
//  ТЕКСТУРЫ (генерируем кодом)
// ============================================================
function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(255,255,255,.5)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); return t;
}
function emojiTexture(emoji) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.font = '96px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(emoji, 64, 70);
  return new THREE.CanvasTexture(c);
}
function ringTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.strokeStyle = 'white'; g.lineWidth = 10;
  g.beginPath(); g.arc(64, 64, 52, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 20;
  g.beginPath(); g.arc(64, 64, 48, 0, Math.PI * 2); g.stroke();
  return new THREE.CanvasTexture(c);
}

// ============================================================
//  ЧАСТИЦЫ
// ============================================================
class ParticleBurst {
  constructor(scene, max = 1200) {
    this.max = max; this.i = 0;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.mat = new THREE.PointsMaterial({
      size: 0.28, vertexColors: true, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false, map: glowTexture(),
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.pos.fill(9999);
  }
  spawn(p, color, count = 20, speed = 5, life = 0.8, up = 2) {
    const c = new THREE.Color(color);
    for (let k = 0; k < count; k++) {
      const j = this.i; this.i = (this.i + 1) % this.max;
      this.pos[j * 3] = p.x; this.pos[j * 3 + 1] = p.y; this.pos[j * 3 + 2] = p.z;
      const a = Math.random() * Math.PI * 2, r = speed * (0.3 + Math.random() * 0.7);
      this.vel[j * 3] = Math.cos(a) * r;
      this.vel[j * 3 + 1] = Math.random() * up + 1;
      this.vel[j * 3 + 2] = Math.sin(a) * r;
      const shade = 0.7 + Math.random() * 0.5;
      this.col[j * 3] = Math.min(1, c.r * shade + 0.15);
      this.col[j * 3 + 1] = Math.min(1, c.g * shade + 0.15);
      this.col[j * 3 + 2] = Math.min(1, c.b * shade + 0.15);
      this.life[j] = this.maxLife[j] = life * (0.6 + Math.random() * 0.7);
    }
  }
  update(dt) {
    for (let j = 0; j < this.max; j++) {
      if (this.life[j] <= 0) continue;
      this.life[j] -= dt;
      if (this.life[j] <= 0) { this.pos[j * 3 + 1] = 9999; continue; }
      this.vel[j * 3 + 1] -= 6 * dt;
      this.pos[j * 3] += this.vel[j * 3] * dt;
      this.pos[j * 3 + 1] += this.vel[j * 3 + 1] * dt;
      this.pos[j * 3 + 2] += this.vel[j * 3 + 2] * dt;
      if (this.pos[j * 3 + 1] < 0.05) { this.pos[j * 3 + 1] = 0.05; this.vel[j * 3 + 1] *= -0.4; }
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}

// ============================================================
//  ИГРА
// ============================================================
class Game {
  constructor() {
    this.screen = 'loading';
    this.levelIndex = 0;
    this.demoMode = true;
    this.skin = SKINS.find((s) => s.id === store.skin) || SKINS[0];
    this.cameraMode = parseInt(localStorage.getItem('neon3d_cam') || '0', 10); // 0 follow, 1 top, 2 cine
    this.camNames = ['следящая', 'сверху', 'кино'];
    this.time = 0;
    this.menuThemeTimer = 0;
    this.demoLevel = 0;

    this.snake = []; this.prev = [];
    this.dir = { x: 1, z: 0 }; this.dirQueue = [];
    this.acc = 0;
    this.score = 0; this.foodEaten = 0; this.combo = 0; this.comboTimer = 0; this.maxCombo = 0;
    this.effects = { magnet: 0, slow: 0, ghost: 0, double: 0 };
    this.hasShield = false;
    this.food = null; this.golden = null; this.goldenTimer = 8; this.powerItem = null; this.powerTimer = 6;
    this.obstacles = new Set();
    this.movers = []; this.portals = [];
    this.shake = 0;
    this.dead = false; this.completed = false;
    this.hintTimer = 0;

    this.initThree();
    this.initUI();
    this.buildLevel(0, true);
    this.startDemo();
    this.loop();
  }

  // ---------------- THREE setup ----------------
  initThree() {
    const container = $('game-container');
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    const isMobile = Math.min(screen.width, screen.height) < 700;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1.6 : 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 200);
    this.camera.position.set(0, 14, 12);

    this.hemi = new THREE.HemisphereLight(0xbfefff, 0x0a0f1e, 0.7);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 1.1);
    this.sun.position.set(8, 16, 6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -16; this.sun.shadow.camera.right = 16;
    this.sun.shadow.camera.top = 16; this.sun.shadow.camera.bottom = -16;
    this.scene.add(this.sun);
    this.headLight = new THREE.PointLight(0x00ff9d, 12, 14, 1.6);
    this.scene.add(this.headLight);

    // Пост-обработка: bloom
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.85, 0.65, 0.22);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.world = new THREE.Group(); this.scene.add(this.world);
    this.bursts = new ParticleBurst(this.scene);
    this.glowTex = glowTexture();

    // Змейка: пул сегментов
    this.segGeo = new THREE.SphereGeometry(0.42, 20, 16);
    this.segMeshes = [];
    this.headGroup = new THREE.Group();
    const headMesh = new THREE.Mesh(this.segGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x00ff9d, emissiveIntensity: 0.7, roughness: 0.3 }));
    headMesh.scale.setScalar(1.15); headMesh.castShadow = true;
    this.headGroup.add(headMesh);
    this.headMesh = headMesh;
    // глаза
    const eyeW = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const eyeB = new THREE.MeshBasicMaterial({ color: 0x0a0a12 });
    this.eyes = [];
    [-1, 1].forEach((s) => {
      const e = new THREE.Group();
      const w = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), eyeW);
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), eyeB);
      b.position.z = 0.09;
      e.add(w); e.add(b);
      e.position.set(s * 0.2, 0.22, 0.34);
      this.headGroup.add(e); this.eyes.push(e);
    });
    // язык
    this.tongue = new THREE.Mesh(
      new THREE.ConeGeometry(0.06, 0.34, 8),
      new THREE.MeshBasicMaterial({ color: 0xff3355 })
    );
    this.tongue.rotation.x = Math.PI / 2;
    this.tongue.position.set(0, -0.02, 0.62);
    this.tongue.visible = false;
    this.headGroup.add(this.tongue);
    // корона / рога скинов
    this.crown = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.2, 8), new THREE.MeshStandardMaterial({ color: 0xffd257, emissive: 0xaa7700, emissiveIntensity: 0.8, roughness: 0.25, metalness: 0.8 }));
    this.crown.position.y = 0.5; this.crown.visible = false;
    this.headGroup.add(this.crown);
    this.horns = [];
    [-1, 1].forEach((s) => {
      const h = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.35, 8), new THREE.MeshStandardMaterial({ color: 0x331111, emissive: 0xff4400, emissiveIntensity: 0.9 }));
      h.position.set(s * 0.28, 0.42, -0.05); h.rotation.z = -s * 0.4; h.visible = false;
      this.headGroup.add(h); this.horns.push(h);
    });
    // щит-кольцо
    this.shieldRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.75, 0.07, 10, 32),
      new THREE.MeshBasicMaterial({ color: 0x7dff9e, transparent: true, opacity: 0.9 })
    );
    this.shieldRing.visible = false;
    this.headGroup.add(this.shieldRing);
    this.scene.add(this.headGroup);
    this.headYaw = 0;

    addEventListener('resize', () => this.onResize());
  }

  onResize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
    this.composer.setSize(innerWidth, innerHeight);
  }

  // ---------------- Построение уровня ----------------
  clearWorld() {
    this.world.traverse((o) => {
      if (o.geometry) o.geometry.dispose?.();
      if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.map?.dispose?.(); m.dispose?.(); }); }
    });
    this.scene.remove(this.world);
    this.world = new THREE.Group();
    this.scene.add(this.world);
    this.obstacles.clear();
    this.movers = []; this.portals = [];
    this.foodMesh = null; this.goldenMesh = null; this.powerMesh = null;
    this.ambientPts = null; this.decoAnims = [];
  }

  gridToWorld(gx, gz, y = BODY_Y) {
    return new THREE.Vector3((gx - CENTER) * CELL, y, (gz - CENTER) * CELL);
  }
  key(x, z) { return x + ',' + z; }

  genObstacles(level, idx) {
    const rnd = mulberry32(1234 + idx * 777);
    const obs = new Set();
    const cx = 10, cz = 10;
    const free = (x, z) => Math.abs(x - cx) + Math.abs(z - cz) > 4;
    const add = (x, z) => { if (x > 0 && x < N - 1 && z > 0 && z < N - 1 && free(x, z)) obs.add(this.key(x, z)); };
    if (level.gen === 'pillars') {
      let placed = 0, guard = 0;
      while (placed < 12 && guard++ < 500) {
        const x = 2 + Math.floor(rnd() * (N - 4)), z = 2 + Math.floor(rnd() * (N - 4));
        if (!free(x, z) || obs.has(this.key(x, z))) continue;
        obs.add(this.key(x, z)); placed++;
      }
    } else if (level.gen === 'cross') {
      for (let i = 2; i <= 18; i++) {
        if (Math.abs(i - 10) > 2) { add(i, 7); add(i, 13); add(7, i); add(13, i); }
      }
    } else if (level.gen === 'maze') {
      const gaps = [4, 15, 8, 12];
      [4, 8, 12, 16].forEach((z, r) => {
        for (let x = 2; x <= 18; x++) {
          if (Math.abs(x - gaps[r]) > 1) add(x, z);
        }
      });
      add(10, 8); // не перекрывать спавн-проход полностью — gaps уже есть
      obs.delete(this.key(10, 10));
    } else if (level.gen === 'scatter') {
      let placed = 0, guard = 0;
      while (placed < 14 && guard++ < 600) {
        const x = 2 + Math.floor(rnd() * (N - 4)), z = 2 + Math.floor(rnd() * (N - 4));
        const k = this.key(x, z);
        if (!free(x, z) || obs.has(k)) continue;
        if ((x === 4 || x === 16) && (z === 4 || z === 16)) continue; // места порталов
        obs.add(k); placed++;
      }
    } else if (level.gen === 'arena') {
      [[4, 4], [16, 4], [4, 16], [16, 16], [10, 4], [10, 16], [4, 10], [16, 10]].forEach(([x, z]) => add(x, z));
    }
    return obs;
  }

  buildLevel(idx, isDemo = false) {
    this.clearWorld();
    const level = LEVELS[idx];
    const T = THEMES[level.theme];
    this.theme = T; this.levelDef = level;

    this.scene.background = new THREE.Color(T.sky);
    this.scene.fog = new THREE.Fog(T.fog, T.fogNear, T.fogFar);
    this.sun.color.set(T.sun);
    this.hemi.color.set(T.ambient);

    // Земля
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(N + 26, N + 26),
      new THREE.MeshStandardMaterial({ color: T.ground, roughness: 0.85, metalness: 0.15 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.world.add(ground);

    // Неоновая сетка
    const grid = new THREE.GridHelper(N, N, T.grid1, T.grid2);
    grid.position.y = 0.02;
    grid.material.transparent = true; grid.material.opacity = 0.85;
    this.world.add(grid);
    const grid2 = new THREE.GridHelper(N + 26, 30, T.grid2, T.grid2);
    grid2.position.y = 0.01;
    grid2.material.transparent = true; grid2.material.opacity = 0.25;
    this.world.add(grid2);

    // Стены-рамка
    const wallMat = new THREE.MeshStandardMaterial({ color: T.wall, emissive: T.wall, emissiveIntensity: 1.4, roughness: 0.3 });
    const wallH = 0.9, half = N / 2 + 0.5;
    const mkWall = (w, d, x, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), wallMat);
      m.position.set(x, wallH / 2, z); m.castShadow = true;
      this.world.add(m);
    };
    mkWall(N + 2, 0.5, 0, -half); mkWall(N + 2, 0.5, 0, half);
    mkWall(0.5, N + 2, -half, 0); mkWall(0.5, N + 2, half, 0);
    // угловые башни
    const towerGeo = new THREE.CylinderGeometry(0.45, 0.6, 2.4, 8);
    [[-half, -half], [half, -half], [-half, half], [half, half]].forEach(([x, z]) => {
      const t = new THREE.Mesh(towerGeo, wallMat);
      t.position.set(x, 1.2, z); t.castShadow = true;
      this.world.add(t);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: T.wall, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
      halo.scale.setScalar(2.4); halo.position.set(x, 2.7, z);
      this.world.add(halo);
    });

    // Препятствия
    this.obstacles = this.genObstacles(level, idx);
    const obsGeo = this.obstacleGeo(T.deco);
    const obsMat = new THREE.MeshStandardMaterial({ color: T.grid1, emissive: T.grid1, emissiveIntensity: 0.55, roughness: 0.35, metalness: 0.3 });
    const obsMat2 = new THREE.MeshStandardMaterial({ color: 0x111122, emissive: T.grid2, emissiveIntensity: 0.4, roughness: 0.6 });
    this.obstacles.forEach((k) => {
      const [x, z] = k.split(',').map(Number);
      const p = this.gridToWorld(x, z, 0);
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.5, 0.96), obsMat2);
      base.position.set(p.x, 0.25, p.z); base.castShadow = base.receiveShadow = true;
      this.world.add(base);
      const top = new THREE.Mesh(obsGeo, obsMat);
      top.position.set(p.x, 0.5 + obsGeo.userData.h / 2, p.z);
      top.castShadow = true;
      top.rotation.y = (x * 7 + z * 13) % 4;
      this.world.add(top);
      this.decoAnims.push({ m: top, y: top.position.y, ph: (x + z) * 0.7, kind: 'bob' });
    });

    // Порталы
    if (level.portals) {
      this.addPortalPair([4, 4], [16, 16], 0xff2fb3);
      this.addPortalPair([16, 4], [4, 16], 0x5ee7ff);
    }

    // Движущиеся ловушки
    if (level.movers) {
      const defs = [
        { a: [2, 6], b: [18, 6], sp: 0.5, ph: 0 },
        { a: [18, 14], b: [2, 14], sp: 0.42, ph: 1 },
        { a: [6, 18], b: [6, 2], sp: 0.55, ph: 2 },
        { a: [14, 2], b: [14, 18], sp: 0.47, ph: 3 },
      ];
      defs.forEach((d) => {
        const m = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.55),
          new THREE.MeshStandardMaterial({ color: 0xff3355, emissive: 0xff1133, emissiveIntensity: 1.6, roughness: 0.25 })
        );
        m.castShadow = true;
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: 0xff2244, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
        halo.scale.setScalar(2.6);
        m.add(halo);
        this.world.add(m);
        this.movers.push({ ...d, t: Math.random(), mesh: m, cell: { x: d.a[0], z: d.a[1] } });
      });
    }

    this.buildDecorations(T);
    this.buildAmbient(T);
    this.applySkin();
  }

  obstacleGeo(deco) {
    let g;
    if (deco === 'crystals') g = new THREE.OctahedronGeometry(0.55);
    else if (deco === 'rocks') g = new THREE.DodecahedronGeometry(0.5);
    else if (deco === 'shards') g = new THREE.BoxGeometry(0.5, 1.1, 0.5);
    else if (deco === 'pillars') g = new THREE.BoxGeometry(0.6, 0.9, 0.6);
    else if (deco === 'asteroids') g = new THREE.IcosahedronGeometry(0.5, 0);
    else g = new THREE.ConeGeometry(0.45, 1.0, 7);
    g.userData.h = 1.0;
    return g;
  }

  buildDecorations(T) {
    const rnd = mulberry32(99);
    const group = new THREE.Group();
    const R = N / 2 + 4;
    const put = (m) => {
      const a = rnd() * Math.PI * 2, r = R + rnd() * 7;
      m.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      m.rotation.y = rnd() * Math.PI * 2;
      group.add(m);
    };
    const mat1 = new THREE.MeshStandardMaterial({ color: T.grid1, emissive: T.grid1, emissiveIntensity: 0.7, roughness: 0.4 });
    const mat2 = new THREE.MeshStandardMaterial({ color: 0x0c0c18, roughness: 0.8 });
    for (let i = 0; i < 42; i++) {
      let m;
      const s = 0.6 + rnd() * 1.4;
      if (T.deco === 'trees') {
        m = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.8, 6), mat2);
        trunk.position.y = 0.4;
        const top = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.6, 7), mat1);
        top.position.y = 1.5;
        m.add(trunk, top);
      } else if (T.deco === 'crystals') {
        m = new THREE.Mesh(new THREE.OctahedronGeometry(0.7, 0), mat1);
        m.position.y = 0; m.scale.y = 1.6;
        this.decoAnims.push({ m, y: 0.8, ph: i, kind: 'spin' });
        m.position.y = 0.8;
      } else if (T.deco === 'rocks') {
        m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7, 0), new THREE.MeshStandardMaterial({ color: 0x221110, emissive: T.grid1, emissiveIntensity: 0.5, roughness: 0.9 }));
        m.position.y = 0.4;
      } else if (T.deco === 'shards') {
        m = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.2, 0.4), new THREE.MeshStandardMaterial({ color: T.grid1, emissive: T.grid1, emissiveIntensity: 0.6, roughness: 0.2, transparent: true, opacity: 0.9 }));
        m.position.y = 1.0; m.rotation.z = (rnd() - 0.5) * 0.3;
      } else if (T.deco === 'pillars') {
        const h = 1.5 + rnd() * 3;
        m = new THREE.Mesh(new THREE.BoxGeometry(0.7, h, 0.7), i % 2 ? mat1 : new THREE.MeshStandardMaterial({ color: 0x5ee7ff, emissive: 0x5ee7ff, emissiveIntensity: 0.7 }));
        m.position.y = h / 2;
      } else {
        m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6, 0), mat2);
        m.position.y = 1 + rnd() * 3;
        this.decoAnims.push({ m, y: m.position.y, ph: i * 0.5, kind: 'float' });
      }
      m.scale.setScalar(s);
      if (T.deco !== 'crystals' && T.deco !== 'asteroids') put(m);
      else { const a = rnd() * Math.PI * 2, r = R + rnd() * 7; m.position.x = Math.cos(a) * r; m.position.z = Math.sin(a) * r; m.rotation.y = rnd() * 6; group.add(m); }
    }
    // «Солнце» мира — большой светящийся диск в небе
    const sunSpr = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: T.sun, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    sunSpr.scale.setScalar(16);
    sunSpr.position.set(-22, 16, -30);
    group.add(sunSpr);
    this.world.add(group);
  }

  buildAmbient(T) {
    const count = 320;
    const pos = new Float32Array(count * 3);
    const rnd = mulberry32(7);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (rnd() - 0.5) * 70;
      pos[i * 3 + 1] = rnd() * 18 + 0.5;
      pos[i * 3 + 2] = (rnd() - 0.5) * 70;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.ambientPts = new THREE.Points(geo, new THREE.PointsMaterial({
      color: T.ambient, size: 0.22, transparent: true, opacity: 0.8,
      blending: THREE.AdditiveBlending, depthWrite: false, map: this.glowTex,
    }));
    this.ambientPts.frustumCulled = false;
    this.world.add(this.ambientPts);
  }

  addPortalPair(a, b, color) {
    [a, b].forEach(([gx, gz]) => {
      const p = this.gridToWorld(gx, gz, 0);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.62, 0.1, 12, 28),
        new THREE.MeshBasicMaterial({ color })
      );
      ring.position.set(p.x, 0.75, p.z);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
      halo.scale.setScalar(2.6); halo.position.copy(ring.position);
      const base = new THREE.Mesh(new THREE.CircleGeometry(0.55, 24), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35 }));
      base.rotation.x = -Math.PI / 2; base.position.set(p.x, 0.03, p.z);
      this.world.add(ring, halo, base);
      this.decoAnims.push({ m: ring, kind: 'portal', ph: Math.random() * 6 });
      this.decoAnims.push({ m: base, kind: 'portalBase', ph: Math.random() * 6 });
    });
    this.portals.push({ a: { x: a[0], z: a[1] }, b: { x: b[0], z: b[1] }, color });
  }

  // ---------------- Скин ----------------
  applySkin() {
    const s = this.skin;
    this.headMesh.material.color.set(s.head);
    this.headMesh.material.emissive.set(s.glow);
    this.crown.visible = !!s.crown;
    this.horns.forEach((h) => (h.visible = !!s.horns));
    this.headLight.color.set(s.glow);
    this.segMeshes.forEach((m, i) => this.paintSegment(m, i, this.segMeshes.length));
  }

  paintSegment(m, i, total) {
    const s = this.skin;
    const f = total <= 1 ? 0 : i / (total - 1);
    if (s.rainbow) {
      const c = new THREE.Color().setHSL((this.time * 0.25 + i * 0.045) % 1, 0.9, 0.55);
      m.material.color.copy(c); m.material.emissive.copy(c);
    } else {
      const c = new THREE.Color(s.body).lerp(new THREE.Color(s.tail), f * 0.9);
      m.material.color.copy(c);
      m.material.emissive.set(s.glow).multiplyScalar(0.55 * (1 - f * 0.5));
    }
  }

  ensureSegments(n) {
    while (this.segMeshes.length < n) {
      const m = new THREE.Mesh(this.segGeo, new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.1 }));
      m.castShadow = true;
      const squash = Math.max(0.72, 1 - this.segMeshes.length * 0.012);
      m.scale.setScalar(squash);
      this.scene.add(m);
      this.segMeshes.push(m);
    }
    this.segMeshes.forEach((m, i) => { m.visible = i < n; });
    this.segMeshes.forEach((m, i) => { if (i < n) this.paintSegment(m, i, n); });
  }

  // ---------------- Игровой процесс ----------------
  resetSnake(demo = false) {
    const c = 10;
    this.snake = demo
      ? [{ x: c, z: c }, { x: c - 1, z: c }, { x: c - 2, z: c }, { x: c - 3, z: c }]
      : [{ x: c, z: c }, { x: c - 1, z: c }, { x: c - 2, z: c }, { x: c - 3, z: c }];
    this.prev = JSON.parse(JSON.stringify(this.snake));
    this.dir = { x: 1, z: 0 }; this.dirQueue = [];
    this.acc = 0;
    this.dead = false; this.completed = false;
    this.headGroup.visible = true;
    this.ensureSegments(this.snake.length - 1);
  }

  startGame(idx) {
    this.demoMode = false;
    this.levelIndex = idx;
    this.score = 0; this.foodEaten = 0; this.combo = 0; this.comboTimer = 0; this.maxCombo = 0;
    this.effects = { magnet: 0, slow: 0, ghost: 0, double: 0 };
    this.hasShield = false;
    this.goldenTimer = 10; this.powerTimer = 7;
    this.golden = null; this.powerItem = null;
    this.buildLevel(idx);
    this.resetSnake();
    this.spawnFood();
    this.screen = 'playing';
    this.showScreen(null);
    $('hud').classList.remove('hidden');
    this.hintTimer = 6;
    $('hint').style.opacity = 1;
    this.updateHUD();
    AudioSys.init();
    AudioSys.startMusic(this.theme.music);
  }

  startDemo() {
    this.demoMode = true;
    this.screen = 'menu';
    this.golden = null; this.powerItem = null;
    this.effects = { magnet: 0, slow: 0, ghost: 0, double: 0 };
    this.resetSnake(true);
    this.spawnFood();
  }

  effectiveSpeed() {
    const base = this.demoMode ? 7 : this.levelDef.speed + Math.min(3, this.foodEaten * 0.15);
    return this.effects.slow > 0 ? base * 0.55 : base;
  }

  freeCells(exclude = new Set()) {
    const taken = new Set([...this.obstacles, ...exclude]);
    this.snake.forEach((s) => taken.add(this.key(s.x, s.z)));
    this.movers.forEach((m) => taken.add(this.key(m.cell.x, m.cell.z)));
    this.portals.forEach((p) => { taken.add(this.key(p.a.x, p.a.z)); taken.add(this.key(p.b.x, p.b.z)); });
    if (this.food) taken.add(this.key(this.food.x, this.food.z));
    if (this.golden) taken.add(this.key(this.golden.x, this.golden.z));
    if (this.powerItem) taken.add(this.key(this.powerItem.x, this.powerItem.z));
    const cells = [];
    for (let x = 0; x < N; x++) for (let z = 0; z < N; z++) {
      if (!taken.has(this.key(x, z))) cells.push({ x, z });
    }
    return cells;
  }

  randomFreeCell() {
    const cells = this.freeCells();
    if (!cells.length) return null;
    return cells[Math.floor(Math.random() * cells.length)];
  }

  spawnFood() {
    const c = this.randomFreeCell();
    if (!c) return;
    this.food = c;
    this.buildFoodMesh();
  }

  buildFoodMesh() {
    if (this.foodMesh) { this.world.remove(this.foodMesh); }
    const g = new THREE.Group();
    const apple = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 18, 14),
      new THREE.MeshStandardMaterial({ color: 0xff2244, emissive: 0xcc0022, emissiveIntensity: 1.1, roughness: 0.25 })
    );
    apple.scale.y = 0.9; apple.castShadow = true;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.25, 6), new THREE.MeshStandardMaterial({ color: 0x5a3a1a }));
    stem.position.y = 0.36;
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), new THREE.MeshStandardMaterial({ color: 0x33ff88, emissive: 0x00aa44, emissiveIntensity: 0.8 }));
    leaf.scale.set(1.4, 0.5, 0.7); leaf.position.set(0.13, 0.42, 0);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: 0xff3355, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.scale.setScalar(1.9);
    g.add(apple, stem, leaf, halo);
    const p = this.gridToWorld(this.food.x, this.food.z, 0.45);
    g.position.copy(p);
    this.world.add(g);
    this.foodMesh = g;
  }

  buildGoldenMesh() {
    if (!this.golden) return;
    const g = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.34, 0),
      new THREE.MeshStandardMaterial({ color: 0xffd257, emissive: 0xff9d00, emissiveIntensity: 1.5, roughness: 0.2, metalness: 0.6 })
    );
    core.castShadow = true;
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: 0xffc93c, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.scale.setScalar(2.4);
    g.add(core, halo);
    const p = this.gridToWorld(this.golden.x, this.golden.z, 0.5);
    g.position.copy(p);
    this.world.add(g);
    this.goldenMesh = g;
  }

  buildPowerMesh() {
    if (!this.powerItem) return;
    const P = POWERS[this.powerItem.kind];
    const g = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.32, 0),
      new THREE.MeshStandardMaterial({ color: P.color, emissive: P.color, emissiveIntensity: 1.4, roughness: 0.25 })
    );
    core.castShadow = true;
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTexture(P.emoji), transparent: true, depthWrite: false }));
    label.scale.setScalar(0.85); label.position.y = 0.72;
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: P.color, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.scale.setScalar(2.2);
    g.add(core, label, halo);
    const p = this.gridToWorld(this.powerItem.x, this.powerItem.z, 0.5);
    g.position.copy(p);
    this.world.add(g);
    this.powerMesh = g;
  }

  setDirection(x, z) {
    if (this.screen !== 'playing' || this.demoMode) return;
    const last = this.dirQueue.length ? this.dirQueue[this.dirQueue.length - 1] : this.dir;
    if ((x === -last.x && z === -last.z) || (x === last.x && z === last.z)) return;
    if (this.dirQueue.length < 3) { this.dirQueue.push({ x, z }); AudioSys.turn(); }
  }

  hitFlash() {
    const f = $('damage-flash');
    f.classList.remove('hit'); void f.offsetWidth; f.classList.add('hit');
  }

  useShield(reason) {
    this.hasShield = false;
    this.effects.ghost = Math.max(this.effects.ghost, 2);
    AudioSys.shieldBreak();
    this.hitFlash();
    const p = this.gridToWorld(this.snake[0].x, this.snake[0].z, 0.8);
    this.bursts.spawn(p, 0x7dff9e, 40, 6, 1);
    this.popup(p, '🛡 ЩИТ СПАС!', 'power');
    this.updateHUD();
  }

  // ----- один шаг логики -----
  tick() {
    if (this.demoMode) this.aiSteer();
    if (this.dirQueue.length) this.dir = this.dirQueue.shift();

    const head = this.snake[0];
    let nx = head.x + this.dir.x, nz = head.z + this.dir.z;
    const ghost = this.effects.ghost > 0;

    // Стены
    if (nx < 0 || nx >= N || nz < 0 || nz >= N) {
      if (this.demoMode) { this.startDemo(); return; }
      if (ghost) { nx = (nx + N) % N; nz = (nz + N) % N; }
      else if (this.hasShield) { this.useShield(); nx = (nx + N) % N; nz = (nz + N) % N; }
      else return this.die();
    }

    // Порталы
    for (const p of this.portals) {
      if (nx === p.a.x && nz === p.a.z) { nx = p.b.x; nz = p.b.z; this.onTeleport(p); break; }
      if (nx === p.b.x && nz === p.b.z) { nx = p.a.x; nz = p.a.z; this.onTeleport(p); break; }
    }

    const willEat = this.food && nx === this.food.x && nz === this.food.z;
    const willGold = this.golden && nx === this.golden.x && nz === this.golden.z;
    const growing = willEat || willGold;

    // Препятствия / хвост / ловушки
    const k = this.key(nx, nz);
    let hit = this.obstacles.has(k);
    if (!hit) {
      for (const m of this.movers) if (m.cell.x === nx && m.cell.z === nz) { hit = true; break; }
    }
    if (!hit) {
      const lim = growing ? this.snake.length : this.snake.length - 1;
      for (let i = 0; i < lim; i++) if (this.snake[i].x === nx && this.snake[i].z === nz) { hit = true; break; }
    }
    if (hit && !ghost) {
      if (this.demoMode) { this.startDemo(); return; }
      if (this.hasShield) this.useShield();
      else return this.die();
    }

    this.prev = JSON.parse(JSON.stringify(this.snake));
    this.snake.unshift({ x: nx, z: nz });

    // Еда
    if (willEat) this.eatFood(false);
    else if (willGold) this.eatFood(true);
    else this.snake.pop();

    // Power-up
    if (!this.demoMode && this.powerItem && nx === this.powerItem.x && nz === this.powerItem.z) {
      this.applyPower(this.powerItem.kind);
      this.world.remove(this.powerMesh); this.powerMesh = null; this.powerItem = null;
      this.powerTimer = 9 + Math.random() * 8;
    }

    // Магнит: еда ползёт к голове
    if (!this.demoMode && this.effects.magnet > 0 && this.food) this.magnetPull();

    this.ensureSegments(this.snake.length - 1);
    this.updateHUD();
  }

  onTeleport(p) {
    if (this.demoMode) return;
    AudioSys.portal();
    const w = this.gridToWorld(p.a.x, p.a.z, 0.8);
    this.bursts.spawn(w, p.color, 25, 4, 0.7);
  }

  magnetPull() {
    const h = this.snake[0], f = this.food;
    const dx = Math.sign(h.x - f.x), dz = Math.sign(h.z - f.z);
    const opts = [];
    if (dx !== 0) opts.push({ x: f.x + dx, z: f.z });
    if (dz !== 0) opts.push({ x: f.x, z: f.z + dz });
    for (const o of opts) {
      if (o.x < 0 || o.x >= N || o.z < 0 || o.z >= N) continue;
      if (this.obstacles.has(this.key(o.x, o.z))) continue;
      if (this.snake.some((s) => s.x === o.x && s.z === o.z)) continue;
      this.food = o;
      const p = this.gridToWorld(o.x, o.z, 0.45);
      this.foodMesh.position.copy(p);
      break;
    }
  }

  eatFood(isGolden) {
    const head = this.snake[0];
    const w = this.gridToWorld(head.x, head.z, 0.6);
    if (this.demoMode) {
      this.bursts.spawn(w, isGolden ? 0xffd257 : 0xff3355, 18, 4, 0.7);
      if (isGolden) { this.world.remove(this.goldenMesh); this.goldenMesh = null; this.golden = null; }
      else this.spawnFood();
      if (this.snake.length > 26) this.startDemo();
      return;
    }
    this.combo = this.comboTimer > 0 ? this.combo + 1 : 1;
    this.comboTimer = 4;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    const mult = (this.effects.double > 0 ? 2 : 1) * (1 + (this.combo - 1) * 0.25);
    const pts = Math.round((isGolden ? 50 : 10) * mult);
    this.score += pts;
    this.foodEaten++;
    this.shake = Math.min(0.35, this.shake + (isGolden ? 0.22 : 0.1));
    if (isGolden) {
      AudioSys.golden();
      this.bursts.spawn(w, 0xffd257, 45, 6, 1);
      this.popup(w, `+${pts} ✨`, 'gold');
      this.world.remove(this.goldenMesh); this.goldenMesh = null; this.golden = null;
      this.goldenTimer = 12 + Math.random() * 10;
    } else {
      AudioSys.eat(this.combo);
      this.bursts.spawn(w, 0xff3355, 22, 4.5, 0.7);
      this.bursts.spawn(w, this.skin.glow, 10, 3, 0.5);
      this.popup(w, `+${pts}`, this.combo >= 3 ? 'combo' : '');
      this.spawnFood();
    }
    if (this.combo >= 2) {
      $('combo-badge').classList.remove('hidden');
      $('combo-num').textContent = this.combo;
    }
    const sc = $('hud-score');
    sc.classList.remove('bump'); void sc.offsetWidth; sc.classList.add('bump');

    if (this.foodEaten >= this.levelDef.target) this.completeLevel();
  }

  applyPower(kind) {
    const P = POWERS[kind];
    const w = this.gridToWorld(this.snake[0].x, this.snake[0].z, 0.8);
    AudioSys.power();
    this.bursts.spawn(w, P.color, 35, 5, 0.9);
    this.popup(w, `${P.emoji} ${P.name}!`, 'power');
    if (kind === 'shield') this.hasShield = true;
    else if (kind === 'shrink') {
      const cut = Math.min(3, this.snake.length - 4);
      for (let i = 0; i < cut; i++) this.snake.pop();
      this.prev = JSON.parse(JSON.stringify(this.snake));
      this.ensureSegments(this.snake.length - 1);
    }
    else this.effects[kind] = P.dur;
    this.shieldRing.visible = this.hasShield;
    this.updateHUD();
  }

  die() {
    if (this.dead || this.demoMode) return;
    this.dead = true;
    this.screen = 'dying';
    AudioSys.death();
    this.hitFlash();
    this.shake = 0.8;
    const w = this.gridToWorld(this.snake[0].x, this.snake[0].z, 0.6);
    this.bursts.spawn(w, this.skin.glow, 60, 7, 1.2);
    this.bursts.spawn(w, 0xffffff, 25, 5, 0.8);
    // взрыв по всему телу
    this.snake.forEach((s, i) => {
      if (i % 2) return;
      setTimeout(() => {
        if (this.screen !== 'dying') return;
        this.bursts.spawn(this.gridToWorld(s.x, s.z, 0.5), this.skin.glow, 8, 3, 0.6);
      }, i * 40);
    });
    setTimeout(() => {
      this.headGroup.visible = false;
      this.segMeshes.forEach((m) => (m.visible = false));
    }, 350);
    setTimeout(() => this.showGameOver(), 1000);
  }

  completeLevel() {
    if (this.completed) return;
    this.completed = true;
    this.screen = 'completing';
    AudioSys.win();
    // салют!
    const cols = [0xffd257, 0x00ff9d, 0xff2fb3, 0x5ee7ff];
    for (let i = 0; i < 6; i++) {
      setTimeout(() => {
        const p = new THREE.Vector3((Math.random() - 0.5) * 16, 2 + Math.random() * 3, (Math.random() - 0.5) * 16);
        this.bursts.spawn(p, cols[i % cols.length], 40, 7, 1.3, 4);
      }, i * 160);
    }
    const isLast = this.levelIndex >= LEVELS.length - 1;
    if (!isLast) store.unlocked = Math.max(store.unlocked, this.levelIndex + 2);
    const isBest = store.setBest(this.levelIndex, this.score);
    setTimeout(() => {
      this.screen = 'complete';
      $('complete-score').textContent = this.score;
      $('complete-food').textContent = this.foodEaten;
      $('complete-combo').textContent = 'x' + Math.max(1, this.maxCombo);
      const par = this.levelDef.target * 10;
      const stars = this.score >= par * 2 ? 3 : this.score >= par * 1.3 ? 2 : 1;
      $('complete-stars').innerHTML = [1, 2, 3].map((i) => `<span class="${i <= stars ? '' : 'off'}">★</span>`).join('');
      $('btn-next').style.display = isLast ? 'none' : 'block';
      $('btn-next').innerHTML = isLast ? '' : '⏭ Следующий мир: ' + LEVELS[this.levelIndex + 1].emoji + ' ' + LEVELS[this.levelIndex + 1].name;
      this.showScreen('screen-complete');
      this.refreshMenu();
    }, 1400);
  }

  showGameOver() {
    this.screen = 'over';
    const isBest = store.setBest(this.levelIndex, this.score);
    $('over-score').textContent = this.score;
    $('over-food').textContent = this.foodEaten;
    $('over-combo').textContent = 'x' + Math.max(1, this.maxCombo);
    $('over-best').textContent = store.best[this.levelIndex] || 0;
    $('over-newbest').classList.toggle('hidden', !isBest);
    this.showScreen('screen-over');
    this.refreshMenu();
  }

  // ---------------- AI для демо в меню ----------------
  aiSteer() {
    const head = this.snake[0];
    const target = this.golden || this.food;
    const dirs = [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }]
      .filter((d) => !(d.x === -this.dir.x && d.z === -this.dir.z));
    const danger = (x, z) => {
      if (x < 0 || x >= N || z < 0 || z >= N) return 100;
      if (this.obstacles.has(this.key(x, z))) return 100;
      for (const m of this.movers) if (m.cell.x === x && m.cell.z === z) return 100;
      for (let i = 0; i < this.snake.length - 1; i++) if (this.snake[i].x === x && this.snake[i].z === z) return 60;
      return 0;
    };
    let best = null, bestScore = -1e9;
    for (const d of dirs) {
      const nx = head.x + d.x, nz = head.z + d.z;
      const dist = target ? Math.abs(nx - target.x) + Math.abs(nz - target.z) : 0;
      let score = -dist * 10 - danger(nx, nz);
      // смотреть на 2 клетки вперёд
      score -= danger(nx + d.x, nz + d.z) * 0.5;
      // свободное пространство (защита от самозапирания)
      let free = 0;
      [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }].forEach((o) => {
        if (danger(nx + o.x, nz + o.z) < 50) free++;
      });
      score += free * 8 + Math.random() * 4;
      if (score > bestScore) { bestScore = score; best = d; }
    }
    if (best) this.dirQueue.push(best);
  }

  // ---------------- Кадр ----------------
  update(dt) {
    this.time += dt;
    const animT = this.time;

    // Анимации мира (идут даже в меню)
    for (const a of this.decoAnims) {
      if (a.kind === 'bob') a.m.position.y = a.y + Math.sin(animT * 2 + a.ph) * 0.08;
      else if (a.kind === 'spin') { a.m.rotation.y += dt * 0.6; a.m.position.y = a.y + Math.sin(animT + a.ph) * 0.15; }
      else if (a.kind === 'float') { a.m.rotation.y += dt * 0.3; a.m.rotation.x += dt * 0.12; a.m.position.y = a.y + Math.sin(animT * 0.7 + a.ph) * 0.35; }
      else if (a.kind === 'portal') { a.m.rotation.z += dt * 1.6; a.m.rotation.y = Math.sin(animT * 0.8 + a.ph) * 0.4; }
    }
    if (this.ambientPts) {
      this.ambientPts.rotation.y += dt * 0.014;
      this.ambientPts.position.y = Math.sin(animT * 0.4) * 0.4;
    }
    // еда: парение и вращение
    if (this.foodMesh) {
      this.foodMesh.position.y = 0.45 + Math.sin(animT * 3) * 0.1;
      this.foodMesh.rotation.y += dt * 1.4;
    }
    if (this.goldenMesh) {
      const left = this.golden?.ttl ?? 10;
      this.goldenMesh.position.y = 0.55 + Math.sin(animT * 4) * 0.14;
      this.goldenMesh.rotation.y += dt * 2.6;
      this.goldenMesh.visible = left > 3 || Math.sin(animT * 14) > -0.2;
    }
    if (this.powerMesh) {
      this.powerMesh.position.y = 0.55 + Math.sin(animT * 3.4) * 0.14;
      this.powerMesh.rotation.y += dt * 2;
      this.powerMesh.visible = (this.powerItem?.ttl ?? 10) > 3 || Math.sin(animT * 14) > -0.2;
    }
    // ловушки
    for (const m of this.movers) {
      m.t += dt * m.sp * 0.28;
      const k = (Math.sin(m.t * Math.PI * 2 + m.ph) + 1) / 2;
      const gx = m.a[0] + (m.b[0] - m.a[0]) * k;
      const gz = m.a[1] + (m.b[1] - m.a[1]) * k;
      m.cell = { x: Math.round(gx), z: Math.round(gz) };
      const w = this.gridToWorld(gx, gz, 0.6 + Math.sin(animT * 3 + m.ph) * 0.12);
      m.mesh.position.copy(w);
      m.mesh.rotation.y += dt * 2.4;
    }
    this.bursts.update(dt);
    if (this.shieldRing.visible) {
      this.shieldRing.rotation.x += dt * 2;
      this.shieldRing.rotation.y += dt * 1.3;
    }
    // язык змейки
    this.tongue.visible = (animT % 2.2) < 0.35;
    if (this.tongue.visible) this.tongue.scale.z = 0.6 + (animT % 2.2) * 2;

    if (this.screen === 'menu') {
      // AI-демо + смена тем
      this.acc += dt;
      const interval = 1 / this.effectiveSpeed();
      let guard = 0;
      while (this.acc >= interval && guard++ < 4) { this.acc -= interval; this.tick(); }
      this.menuThemeTimer += dt;
      if (this.menuThemeTimer > 26) {
        this.menuThemeTimer = 0;
        this.demoLevel = (this.demoLevel + 1) % LEVELS.length;
        this.buildLevel(this.demoLevel, true);
        this.startDemo();
      }
    } else if (this.screen === 'playing') {
      // таймеры эффектов
      for (const k of Object.keys(this.effects)) if (this.effects[k] > 0) this.effects[k] -= dt;
      if (this.comboTimer > 0) {
        this.comboTimer -= dt;
        if (this.comboTimer <= 0) { this.combo = 0; $('combo-badge').classList.add('hidden'); }
      }
      // спавн золотого яблока и power-up'ов
      this.goldenTimer -= dt;
      if (this.goldenTimer <= 0 && !this.golden) {
        const c = this.randomFreeCell();
        if (c) { this.golden = { ...c, ttl: 10 }; this.buildGoldenMesh(); }
        this.goldenTimer = 14 + Math.random() * 10;
      }
      if (this.golden) {
        this.golden.ttl -= dt;
        if (this.golden.ttl <= 0) { this.world.remove(this.goldenMesh); this.goldenMesh = null; this.golden = null; this.goldenTimer = 10 + Math.random() * 8; }
      }
      this.powerTimer -= dt;
      if (this.powerTimer <= 0 && !this.powerItem) {
        const c = this.randomFreeCell();
        if (c) {
          this.powerItem = { ...c, kind: POWER_KEYS[Math.floor(Math.random() * POWER_KEYS.length)], ttl: 12 };
          this.buildPowerMesh();
        }
        this.powerTimer = 11 + Math.random() * 9;
      }
      if (this.powerItem) {
        this.powerItem.ttl -= dt;
        if (this.powerItem.ttl <= 0) { this.world.remove(this.powerMesh); this.powerMesh = null; this.powerItem = null; this.powerTimer = 8 + Math.random() * 8; }
      }
      // шаги змейки
      this.acc += dt;
      const interval = 1 / this.effectiveSpeed();
      let guard = 0;
      while (this.acc >= interval && guard++ < 5 && this.screen === 'playing') {
        this.acc -= interval;
        this.tick();
      }
      if (this.hintTimer > 0) {
        this.hintTimer -= dt;
        if (this.hintTimer <= 0) $('hint').style.opacity = 0;
      }
      // тинт эффектов
      const tint = $('effect-tint');
      tint.className = this.effects.slow > 0 ? 'slow' : this.effects.ghost > 0 ? 'ghost' : this.effects.double > 0 ? 'double' : '';
      // чипы эффектов
      const chips = [];
      const chip = (ico, label, frac, color) =>
        `<div class="effect-chip" style="border-color:${color}"><span class="ico">${ico}</span>${label}<span class="tbar"><i style="width:${Math.round(frac * 100)}%;background:${color}"></i></span></div>`;
      if (this.effects.magnet > 0) chips.push(chip('🧲', 'магнит', this.effects.magnet / 12, '#ff5d5d'));
      if (this.effects.slow > 0) chips.push(chip('🐢', 'slow-mo', this.effects.slow / 8, '#5ee7ff'));
      if (this.effects.ghost > 0) chips.push(chip('👻', 'призрак', this.effects.ghost / 8, '#c9a7ff'));
      if (this.effects.double > 0) chips.push(chip('⭐', 'x2', this.effects.double / 12, '#ffd257'));
      if (this.hasShield) chips.push(`<div class="effect-chip" style="border-color:#7dff9e"><span class="ico">🛡</span>щит</div>`);
      $('effects-row').innerHTML = chips.join('');
    }

    this.renderSnake(dt);
    this.updateCamera(dt);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 1.6);
      const s = this.shake * 0.5;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
    }
  }

  renderSnake(dt) {
    if (!this.snake.length) return;
    const interval = 1 / this.effectiveSpeed();
    const t = Math.min(1, this.acc / interval);
    const ghost = this.effects.ghost > 0;
    // голова
    const h = this.snake[0];
    const ph = this.prev[0] || h;
    let hx = ph.x + (h.x - ph.x) * t, hz = ph.z + (h.z - ph.z) * t;
    // телепорт через край — не тянуть через всё поле
    if (Math.abs(h.x - ph.x) > 1.5) hx = h.x;
    if (Math.abs(h.z - ph.z) > 1.5) hz = h.z;
    const hw = this.gridToWorld(hx, hz, BODY_Y + Math.sin(this.time * 7) * 0.045);
    this.headGroup.position.copy(hw);
    this.headLight.position.set(hw.x, hw.y + 1.2, hw.z);
    const targetYaw = Math.atan2(this.dir.x, this.dir.z);
    let dy = targetYaw - this.headYaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.headYaw += dy * Math.min(1, dt * 14);
    this.headGroup.rotation.y = this.headYaw;
    const breathe = 1 + Math.sin(this.time * 6) * 0.035;
    this.headGroup.scale.set(breathe, 2 - breathe, breathe);
    this.headMesh.material.transparent = ghost;
    this.headMesh.material.opacity = ghost ? 0.55 + Math.sin(this.time * 10) * 0.2 : 1;

    // тело
    const n = this.snake.length - 1;
    for (let i = 0; i < n; i++) {
      const m = this.segMeshes[i];
      if (!m) continue;
      const cur = this.snake[i + 1];
      const prv = this.prev[i + 1] || this.prev[this.prev.length - 1] || cur;
      let ix = prv.x + (cur.x - prv.x) * t, iz = prv.z + (cur.z - prv.z) * t;
      if (Math.abs(cur.x - prv.x) > 1.5) ix = cur.x;
      if (Math.abs(cur.z - prv.z) > 1.5) iz = cur.z;
      const w = this.gridToWorld(ix, iz, BODY_Y + Math.sin(this.time * 7 - (i + 1) * 0.55) * 0.05);
      m.position.copy(w);
      m.material.transparent = ghost;
      m.material.opacity = ghost ? 0.45 + Math.sin(this.time * 10 + i) * 0.15 : 1;
      if (this.skin.rainbow) this.paintSegment(m, i, n);
    }
    // гало головы
    if (!this.headHalo) {
      this.headHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: this.skin.glow, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
      this.headHalo.scale.setScalar(2.2);
      this.headGroup.add(this.headHalo);
    }
    this.headHalo.material.color.set(this.skin.rainbow ? new THREE.Color().setHSL((this.time * 0.25) % 1, 0.9, 0.6) : this.skin.glow);
  }

  updateCamera(dt) {
    const h = this.snake[0] || { x: 10, z: 10 };
    const hw = this.gridToWorld(h.x, h.z, 0);
    const mode = this.screen === 'menu' ? 2 : this.cameraMode;
    const pos = new THREE.Vector3(), look = new THREE.Vector3();
    if (mode === 0) {
      const back = 6.4, up = 7.4;
      pos.set(hw.x - this.dir.x * back, up, hw.z - this.dir.z * back);
      look.set(hw.x + this.dir.x * 1.6, 0.4, hw.z + this.dir.z * 1.6);
      pos.x = THREE.MathUtils.clamp(pos.x, -15, 15);
      pos.z = THREE.MathUtils.clamp(pos.z, -15, 15);
    } else if (mode === 1) {
      pos.set(hw.x * 0.35, 21, hw.z * 0.35 + 3.2);
      look.set(hw.x * 0.35, 0, hw.z * 0.35);
    } else {
      const a = this.time * 0.12;
      pos.set(Math.cos(a) * 15, 10 + Math.sin(this.time * 0.2) * 2, Math.sin(a) * 15);
      look.set(hw.x * 0.3, 0, hw.z * 0.3);
    }
    const k = Math.min(1, dt * (mode === 0 ? 5 : 2.2));
    this.camera.position.lerp(pos, k);
    this.camLook = this.camLook || look.clone();
    this.camLook.lerp(look, k);
    this.camera.lookAt(this.camLook);
  }

  popup(worldPos, text, cls = '') {
    const v = worldPos.clone().project(this.camera);
    if (v.z > 1) return;
    const el = document.createElement('div');
    el.className = 'popup ' + cls;
    el.textContent = text;
    el.style.left = ((v.x * 0.5 + 0.5) * innerWidth) + 'px';
    el.style.top = ((-v.y * 0.5 + 0.5) * innerHeight) + 'px';
    $('popups').appendChild(el);
    setTimeout(() => el.remove(), 1050);
  }

  // ---------------- HUD / UI ----------------
  updateHUD() {
    if (this.demoMode) return;
    $('hud-level').textContent = `${this.levelIndex + 1} · ${this.levelDef.name}`;
    $('hud-score').textContent = this.score;
    $('hud-best').textContent = Math.max(this.score, store.best[this.levelIndex] || 0);
    $('hud-food').textContent = `${Math.min(this.foodEaten, this.levelDef.target)}/${this.levelDef.target}`;
    $('hud-progress').style.width = Math.min(100, (this.foodEaten / this.levelDef.target) * 100) + '%';
  }

  showScreen(id) {
    ['screen-menu', 'screen-pause', 'screen-over', 'screen-complete'].forEach((s) =>
      $(s).classList.toggle('hidden', s !== id));
    $('hud').classList.toggle('hidden', !(this.screen === 'playing' || this.screen === 'paused' || this.screen === 'dying' || this.screen === 'completing'));
  }

  refreshMenu() {
    const grid = $('level-grid');
    grid.innerHTML = '';
    const best = store.best, unlocked = store.unlocked;
    LEVELS.forEach((L, i) => {
      const locked = i + 1 > unlocked;
      const card = document.createElement('div');
      card.className = 'level-card' + (locked ? ' locked' : '') + (i === this.levelIndex ? ' selected' : '');
      card.innerHTML = `<span class="lnum">${i + 1}</span><span class="emoji">${locked ? '🔒' : L.emoji}</span>
        <div class="lname">${L.name}</div><div class="lbest">${best[i] ? '🏆 ' + best[i] : locked ? 'закрыто' : '—'}</div>`;
      if (!locked) card.onclick = () => { AudioSys.init(); AudioSys.click(); this.levelIndex = i; this.refreshMenu(); this.startGame(i); };
      grid.appendChild(card);
    });
    const row = $('skin-row');
    row.innerHTML = '';
    SKINS.forEach((s) => {
      const b = document.createElement('button');
      b.className = 'skin-btn' + (s.id === this.skin.id ? ' selected' : '');
      b.innerHTML = `<span class="skin-dot" style="background:${s.dot};color:${s.dot}"></span>${s.name}`;
      b.onclick = () => { AudioSys.init(); AudioSys.click(); this.skin = s; store.skin = s.id; this.applySkin(); this.refreshMenu(); };
      row.appendChild(b);
    });
    this.syncSettingsButtons();
  }

  syncSettingsButtons() {
    $('btn-menu-sound').textContent = `${AudioSys.soundOn ? '🔊' : '🔇'} Звук: ${AudioSys.soundOn ? 'вкл' : 'выкл'}`;
    $('btn-menu-music').textContent = `🎵 Музыка: ${AudioSys.musicOn ? 'вкл' : 'выкл'}`;
    $('btn-menu-camera').textContent = `🎥 Камера: ${this.camNames[this.cameraMode]}`;
    $('btn-pause-camera').textContent = `🎥 Камера: ${this.camNames[this.cameraMode]}`;
    $('btn-sound').textContent = AudioSys.soundOn ? '🔊' : '🔇';
  }

  cycleCamera() {
    this.cameraMode = (this.cameraMode + 1) % 3;
    localStorage.setItem('neon3d_cam', String(this.cameraMode));
    this.syncSettingsButtons();
  }

  toggleSound() {
    AudioSys.soundOn = !AudioSys.soundOn;
    store.sound = AudioSys.soundOn;
    this.syncSettingsButtons();
  }

  toggleMusic() {
    AudioSys.musicOn = !AudioSys.musicOn;
    store.music = AudioSys.musicOn;
    this.syncSettingsButtons();
  }

  pause() {
    if (this.screen !== 'playing') return;
    this.screen = 'paused';
    $('pause-score').textContent = this.score;
    this.showScreen('screen-pause');
  }

  resume() {
    if (this.screen !== 'paused') return;
    this.screen = 'playing';
    this.showScreen(null);
    this.acc = 0;
  }

  toMenu() {
    this.demoMode = true;
    this.screen = 'menu';
    this.menuThemeTimer = 0;
    this.demoLevel = this.levelIndex;
    $('effect-tint').className = '';
    $('combo-badge').classList.add('hidden');
    $('effects-row').innerHTML = '';
    this.buildLevel(this.demoLevel, true);
    this.startDemo();
    this.refreshMenu();
    this.showScreen('screen-menu');
  }

  initUI() {
    const click = (id, fn) => $(id).addEventListener('click', (e) => { e.stopPropagation(); AudioSys.init(); AudioSys.click(); fn(); });
    click('btn-play', () => this.startGame(Math.min(this.levelIndex, store.unlocked - 1)));
    click('btn-resume', () => this.resume());
    click('btn-restart', () => this.startGame(this.levelIndex));
    click('btn-quit', () => this.toMenu());
    click('btn-retry', () => this.startGame(this.levelIndex));
    click('btn-over-menu', () => this.toMenu());
    click('btn-replay', () => this.startGame(this.levelIndex));
    click('btn-complete-menu', () => this.toMenu());
    click('btn-next', () => this.startGame(Math.min(this.levelIndex + 1, LEVELS.length - 1)));
    click('btn-pause', () => this.screen === 'playing' ? this.pause() : this.resume());
    click('btn-camera', () => this.cycleCamera());
    click('btn-pause-camera', () => this.cycleCamera());
    click('btn-sound', () => this.toggleSound());
    click('btn-menu-sound', () => this.toggleSound());
    click('btn-menu-music', () => this.toggleMusic());
    click('btn-menu-camera', () => this.cycleCamera());

    addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k) || e.key === ' ') e.preventDefault();
      AudioSys.init();
      if (k === 'arrowup' || k === 'w' || k === 'ц') this.setDirection(0, -1);
      else if (k === 'arrowdown' || k === 's' || k === 'ы' || k === 'і') this.setDirection(0, 1);
      else if (k === 'arrowleft' || k === 'a' || k === 'ф') this.setDirection(-1, 0);
      else if (k === 'arrowright' || k === 'd' || k === 'в') this.setDirection(1, 0);
      else if (k === ' ' || k === 'escape' || k === 'p' || k === 'з') {
        if (this.screen === 'playing') this.pause();
        else if (this.screen === 'paused') this.resume();
      }
      else if (k === 'c' || k === 'с') this.cycleCamera();
      else if (k === 'm' || k === 'ь') this.toggleSound();
      else if (k === 'enter' && this.screen === 'menu') this.startGame(Math.min(this.levelIndex, store.unlocked - 1));
    });

    // Свайпы для мобильных
    let sx = 0, sy = 0;
    const el = this.renderer.domElement;
    el.addEventListener('touchstart', (e) => {
      AudioSys.init();
      const t = e.changedTouches[0]; sx = t.clientX; sy = t.clientY;
    }, { passive: true });
    el.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    el.addEventListener('touchend', (e) => {
      const t = e.changedTouches[0];
      const dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.hypot(dx, dy) < 24) return;
      if (Math.abs(dx) > Math.abs(dy)) this.setDirection(Math.sign(dx), 0);
      else this.setDirection(0, Math.sign(dy));
    });

    document.addEventListener('visibilitychange', () => { if (document.hidden) this.pause(); });

    this.refreshMenu();
  }

  loop() {
    const clock = new THREE.Clock();
    const frame = () => {
      requestAnimationFrame(frame);
      const dt = Math.min(0.05, clock.getDelta());
      if (this.screen !== 'paused') this.update(dt);
      this.composer.render();
    };
    frame();
  }
}

// ---------- Старт ----------
try {
  const game = new Game();
  game.showScreen('screen-menu');
  const loader = $('loading');
  loader.style.opacity = 0;
  setTimeout(() => loader.remove(), 550);
  window.__game = game;
} catch (err) {
  console.error(err);
  $('loading').classList.add('hidden');
  $('webgl-error').classList.remove('hidden');
}
