// Voz en el navegador (sin IA): reconocimiento de voz (Web Speech API) y
// síntesis de voz para leer la palabra en inglés.

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
};

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getRecognitionCtor() !== null;
}

/** Crea un reconocedor de voz en inglés. Devuelve null si no hay soporte. */
export function createEnglishRecognition(): SpeechRecognitionLike | null {
  const Ctor = getRecognitionCtor();
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = "en-US";
  rec.interimResults = true;
  // Modo continuo: palabras muy cortas ("key", "view") no cierran la sesión
  // de escucha, así el navegador sigue capturando hasta que el usuario pare.
  rec.continuous = true;
  rec.maxAlternatives = 10;
  return rec;
}

/** Lee un texto en inglés con la voz del navegador. */
export function speakEnglish(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.95;
    const voice = window.speechSynthesis
      .getVoices()
      .find((v) => v.lang.toLowerCase().startsWith("en"));
    if (voice) u.voice = voice;
    window.speechSynthesis.speak(u);
  } catch {
    /* síntesis no disponible */
  }
}
