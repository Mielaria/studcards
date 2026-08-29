// Sonidos de acierto/fallo generados con Web Audio (sin archivos ni descargas):
// coste cero en carga y latencia mínima.

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!Ctor) return null;
    if (!ctx) ctx = new Ctor();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(
  ac: AudioContext,
  freq: number,
  start: number,
  duration: number,
  type: OscillatorType,
  gain: number,
) {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ac.currentTime + start);
  g.gain.setValueAtTime(0.0001, ac.currentTime + start);
  g.gain.exponentialRampToValueAtTime(gain, ac.currentTime + start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + start + duration);
  osc.connect(g).connect(ac.destination);
  osc.start(ac.currentTime + start);
  osc.stop(ac.currentTime + start + duration + 0.02);
}

/** Sonido agradable de acierto (arpegio ascendente). */
export function playCorrectSound() {
  const ac = getCtx();
  if (!ac) return;
  tone(ac, 660, 0, 0.14, "sine", 0.18);
  tone(ac, 880, 0.1, 0.16, "sine", 0.18);
  tone(ac, 1320, 0.2, 0.28, "sine", 0.14);
}

/** Sonido de error (zumbido grave descendente). */
export function playWrongSound() {
  const ac = getCtx();
  if (!ac) return;
  tone(ac, 200, 0, 0.22, "sawtooth", 0.12);
  tone(ac, 120, 0.16, 0.32, "square", 0.1);
}

export function playAnswerSound(isCorrect: boolean) {
  if (isCorrect) playCorrectSound();
  else playWrongSound();
}
