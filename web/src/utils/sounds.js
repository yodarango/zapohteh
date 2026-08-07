// Central interface sound effects powered by @foleyjs/core.
// Uses global event delegation so every button, link, and text input
// (present and future) gets sounds without touching each component.
import { play, set, unlock } from "@foleyjs/core";

const INTERACTIVE_SELECTOR =
  'button, a[href], [role="button"], input[type="checkbox"], input[type="radio"], select';
const TEXT_INPUT_SELECTOR =
  'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="range"]):not([type="file"]), textarea, [contenteditable="true"]';

// Map toast types to their specific feedback cue.
const TOAST_CUES = {
  success: "success",
  warning: "warning",
  danger: "error",
  error: "error",
  info: "chime",
};

let initialized = false;

const isTextInput = (el) => el && el.closest && el.closest(TEXT_INPUT_SELECTOR);
const isInteractive = (el) =>
  el && el.closest && el.closest(INTERACTIVE_SELECTOR);

export function initSounds() {
  if (initialized) return;
  initialized = true;

  set({ volume: 0.7, theme: "default" });

  // Unlock the AudioContext on the first user gesture (browser requirement).
  const unlockOnce = () => {
    unlock();
    window.removeEventListener("pointerdown", unlockOnce);
    window.removeEventListener("keydown", unlockOnce);
  };
  window.addEventListener("pointerdown", unlockOnce);
  window.addEventListener("keydown", unlockOnce);

  // Press on pointerdown, release on pointerup for buttons/links.
  document.addEventListener("pointerdown", (e) => {
    if (isInteractive(e.target)) play("press", { volume: 0.5 });
  });
  document.addEventListener("pointerup", (e) => {
    if (isInteractive(e.target)) play("release", { volume: 0.5 });
  });

  // Typing sound on text inputs / textareas.
  document.addEventListener("keydown", (e) => {
    if (!isTextInput(e.target)) return;
    if (e.key === "Enter") {
      play("complete", { volume: 0.4 });
    } else if (e.key.length === 1 || e.key === "Backspace") {
      play("thock", { volume: 0.3 });
    }
  });
}

// Play the feedback sound tied to a toast type (success/warning/error/info).
export function playToastSound(type) {
  const cue = TOAST_CUES[type] || "chime";
  play(cue);
}
