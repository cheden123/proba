// Клавиатура + виртуальные кнопки для тача.
const KEYMAP = {
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  Space: "jump",
  ArrowUp: "jump",
  KeyW: "jump",
  KeyJ: "shoot",
  KeyX: "shoot",
  KeyZ: "shoot",
  KeyK: "shoot",
  Enter: "start",
  NumpadEnter: "start",
  Escape: "pause",
  KeyP: "pause",
  KeyM: "mute",
  KeyR: "restart",
};

export class Input {
  constructor(target = window) {
    this.down = new Set();
    this.tap = new Set(); // нажатия за текущий кадр
    this.target = target;

    target.addEventListener("keydown", (e) => {
      const action = KEYMAP[e.code];
      if (!action) return;
      e.preventDefault();
      if (!this.down.has(action)) this.tap.add(action);
      this.down.add(action);
      this.anyKey = true;
    });

    target.addEventListener("keyup", (e) => {
      const action = KEYMAP[e.code];
      if (!action) return;
      e.preventDefault();
      this.down.delete(action);
      if (action === "jump") this.virtualJumpReleased = true;
    });

    target.addEventListener("blur", () => this.down.clear());
  }

  bindTouch(root) {
    if (!root) return;
    root.querySelectorAll("[data-action]").forEach((btn) => {
      const action = btn.dataset.action;
      const press = (e) => {
        e.preventDefault();
        if (!this.down.has(action)) this.tap.add(action);
        this.down.add(action);
        btn.classList.add("active");
        this.anyKey = true;
      };
      const release = (e) => {
        e.preventDefault();
        this.down.delete(action);
        btn.classList.remove("active");
      };
      btn.addEventListener("pointerdown", press);
      btn.addEventListener("pointerup", release);
      btn.addEventListener("pointercancel", release);
      btn.addEventListener("pointerleave", release);
      btn.addEventListener("contextmenu", (e) => e.preventDefault());
    });
  }

  isDown(action) {
    return this.down.has(action);
  }

  pressed(action) {
    return this.tap.has(action);
  }

  /** Вызывается в конце кадра: сбрасывает «нажатия». */
  endFrame() {
    this.tap.clear();
    this.anyKey = false;
  }

  reset() {
    this.down.clear();
    this.tap.clear();
  }
}
