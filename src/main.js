// Точка входа: загрузка, экраны, игровой цикл.
import { Audio } from "./audio.js";
import { Input } from "./input.js";
import { Game } from "./game.js";

const canvas = document.getElementById("game");
const overlay = document.getElementById("overlay");
const frame = document.getElementById("frame");
const audio = new Audio();
const input = new Input(window);
const STEP = 1 / 60;

function syncUnit() {
  const u = frame.clientWidth / 480;
  document.documentElement.style.setProperty("--u", `${u}px`);
}
syncUnit();
window.addEventListener("resize", syncUnit);

if (window.matchMedia("(pointer: coarse)").matches) {
  document.body.classList.add("touch-mode");
}
input.bindTouch(document.getElementById("touch"));

const game = new Game(canvas, audio, input, {
  onLevelStart(level) {
    audio.playSong(level.index === 2 ? "boss" : level.index === 1 ? "canyon" : "level");
  },
  onLevelClear(stats) {
    showLevelClear(stats);
  },
  onLevelFinished() {
    // Статистика уже показана в onLevelClear.
  },
  onBossDefeated() {
    // Панель победы откроется после анимации.
  },
  onVictory(stats) {
    showVictory(stats);
  },
  onGameOver(stats) {
    showGameOver(stats);
  },
});

// ---------------------------------------------------------------------------
// Экраны
// ---------------------------------------------------------------------------

function show(html) {
  overlay.innerHTML = html;
  overlay.classList.add("show");
}

function hide() {
  overlay.classList.remove("show");
  overlay.innerHTML = "";
}

const keyHint = `
  <div class="keys">
    <span><kbd>←</kbd><kbd>→</kbd> или <kbd>A</kbd><kbd>D</kbd> — бежать</span>
    <span><kbd>Пробел</kbd> — прыжок (в воздухе ещё раз — двойной)</span>
    <span><kbd>J</kbd> — рогатка: держи для заряда</span>
    <span><kbd>P</kbd> — пауза, <kbd>M</kbd> — звук</span>
  </div>`;

function showMenu() {
  show(`
    <div class="panel">
      <p class="lvl">Платформер · 3 уровня · 1 очень злой кот</p>
      <h1 class="title">🐹 Хомяк-Мститель</h1>
      <p class="subtitle">Рогатка судьбы</p>
      <p class="story">
        Барсик — кот-тиран — захватил кладовку и выгреб все запасы семечек.
        Хомяк Грызь надевает бандану, заряжает рогатку и идёт возвращать
        законный урожай. Три мира, коты, кроты и очень много семечек.
      </p>
      ${keyHint}
      <button class="cta" data-act="start">Начать охоту</button>
      <p class="hintline">Enter или пробел тоже подойдут</p>
    </div>`);
}

function showLevelClear(stats) {
  const nextIndex = stats.index + 1;
  show(`
    <div class="panel">
      <p class="lvl">Уровень ${stats.index + 1} пройден</p>
      <h2 class="big win">${stats.last ? "Кладовка близко!" : "Дорога свободна!"}</h2>
      <div class="stats">
        <div><b>${stats.score}</b>очки</div>
        <div><b>${stats.coins}</b>семечек</div>
        <div><b>${stats.kills}</b>врагов</div>
        <div><b>${Math.round(stats.time)}с</b>время</div>
      </div>
      <p class="story">Бонус за скорость: +${stats.bonus}</p>
      <button class="cta" data-act="next" data-next="${nextIndex}">Дальше</button>
      <p class="hintline">Enter — продолжить</p>
    </div>`);
}

function showGameOver(stats) {
  show(`
    <div class="panel">
      <h2 class="big over">Хомяк повержен</h2>
      <p class="story">Семечки рассыпались, бандана в пыли. Но настоящий боевой хомяк никогда не сдаётся.</p>
      <div class="stats">
        <div><b>${stats.score}</b>очки</div>
        <div><b>${stats.coins}</b>семечек</div>
        <div><b>${stats.kills}</b>врагов</div>
      </div>
      <button class="cta" data-act="retry">Ещё раз</button>
      <p class="hintline">Enter — повторить уровень, R — перезапуск</p>
    </div>`);
}

function showVictory(stats) {
  show(`
    <div class="panel">
      <p class="lvl">Финал</p>
      <h2 class="big win">Кладовка свободна! 🏆</h2>
      <p class="story">
        Барсик бежал, теряя корону. Грызь стоит на горе семечек, и весь
        подвал скандирует его имя. Рогатка судьбы сделала своё дело.
      </p>
      <div class="stats">
        <div><b>${stats.score}</b>очки</div>
        <div><b>${stats.coins}</b>семечек</div>
        <div><b>${stats.kills}</b>врагов</div>
      </div>
      <button class="cta" data-act="again">Сыграть снова</button>
      <p class="hintline">Спасибо, что спасли урожай!</p>
    </div>`);
}

function showPause() {
  show(`
    <div class="panel">
      <h2 class="big">Пауза</h2>
      <p class="story">Хомяк переводит дух и проверяет запас семечек.</p>
      ${keyHint}
      <button class="cta" data-act="resume">Продолжить</button>
      <p class="hintline">P или Esc — назад в бой · R — начать уровень заново</p>
    </div>`);
}

// ---------------------------------------------------------------------------
// Управление экранами
// ---------------------------------------------------------------------------

function startGame() {
  audio.ensure();
  audio.ui();
  hide();
  game.startRun();
}

function nextLevel(index) {
  audio.ui();
  hide();
  game.loadLevel(index);
}

function retryLevel() {
  audio.ui();
  hide();
  game.loadLevel(game.levelIndex);
}

function resume() {
  audio.ui();
  hide();
  game.paused = false;
}

function pauseGame() {
  game.paused = true;
  showPause();
}

overlay.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  const act = btn.dataset.act;
  if (act === "start") startGame();
  else if (act === "next") nextLevel(Number(btn.dataset.next));
  else if (act === "retry") retryLevel();
  else if (act === "again") startGame();
  else if (act === "resume") resume();
});

window.addEventListener("keydown", (e) => {
  const shown = overlay.classList.contains("show");
  if (e.code === "KeyM") {
    const muted = audio.toggleMute();
    if (muted) audio.stopMusic();
    else if (game.level) audio.playSong(game.level.index === 2 ? "boss" : game.level.index === 1 ? "canyon" : "level");
    return;
  }
  if (e.code === "KeyR" && game.level && !shown) {
    retryLevel();
    return;
  }
  if (e.code === "Escape" || e.code === "KeyP") {
    if (!game.level) return;
    if (game.paused) resume();
    else if (game.state === "playing") pauseGame();
    return;
  }
  if (e.code === "Enter" || e.code === "NumpadEnter" || e.code === "Space") {
    if (!shown) return;
    const btn = overlay.querySelector("[data-act]");
    if (btn) {
      e.preventDefault();
      btn.click();
    }
  }
});

// ---------------------------------------------------------------------------
// Цикл
// ---------------------------------------------------------------------------

let last = performance.now();
let acc = 0;

function loop(now) {
  const raw = (now - last) / 1000;
  last = now;
  const dt = Math.min(raw, 0.1);
  acc += dt;
  let guard = 0;
  while (acc >= STEP && guard < 6) {
    game.update(STEP);
    input.endFrame();
    acc -= STEP;
    guard++;
  }
  if (guard >= 6) acc = 0;
  game.render();
  requestAnimationFrame(loop);
}

// Живая сцена за меню: грузим первый уровень и замораживаем его.
game.loadLevel(0);
game.state = "idle";
game.hintTimer = 0;
game.bannerTimer = 0;
audio.stopMusic();
showMenu();
requestAnimationFrame(loop);

// Небольшая пасхалка: щёлкните по заголовку 5 раз.
let quacks = 0;
document.addEventListener("click", (e) => {
  if (!e.target.closest(".title")) return;
  quacks++;
  if (quacks === 5) {
    quacks = 0;
    audio.ensure();
    [60, 64, 67, 72, 76, 79, 84].forEach((n, i) =>
      setTimeout(() => audio.tone({ freq: 440 * Math.pow(2, (n - 69) / 12), dur: 0.2, type: "square", vol: 0.12 }), i * 90)
    );
  }
});
