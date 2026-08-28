"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Dictation, using the browser's own speech recognition.
 *
 * Nothing is uploaded. The recogniser runs where the browser puts it and this
 * hook only ever handles the words that come back, which is why the feature
 * costs nothing and needs no second vendor.
 *
 * It is not available everywhere — Chrome and Safari have it, Firefox does not
 * — so `supported` is part of the contract rather than an afterthought.
 *
 * Stopping is the fiddly part and most of this file is about it. `stop()` on
 * the Web Speech API is the *polite* stop: it asks the recogniser to finish
 * and hand back the last phrase, and only then ends. Chrome's recognition is
 * server-backed, so that round trip can stall — and while it stalls the
 * microphone stays live with nothing to force it shut. So:
 *
 *   - "finishing" is a real state, not a gap. Tapping stop shows that the last
 *     phrase is still coming in, instead of looking like it ignored you.
 *   - A watchdog aborts outright if the polite stop hasn't landed in a couple
 *     of seconds. A lost final word beats a microphone that won't switch off.
 *   - Starting always tears the previous recogniser down first. Two taps used
 *     to leave one running with nothing holding a reference to it — still on
 *     the mic, still writing into the box.
 */

/**
 * The Web Speech API isn't in TypeScript's DOM library, and it's still
 * vendor-prefixed in Chrome. Only the parts used here are typed.
 */
interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}
interface SpeechRecognitionErrorEventLike {
  error: string;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getConstructor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** How long to wait for a polite stop before pulling the plug. */
const STOP_TIMEOUT_MS = 2500;

/** Why dictation stopped, in words a cook can act on. */
const PROBLEMS: Record<string, string> = {
  "not-allowed":
    "The browser blocked the microphone. Allow it for this site and try again.",
  "service-not-allowed":
    "The browser blocked the microphone. Allow it for this site and try again.",
  "audio-capture":
    "No microphone found. Check it's plugged in, or use the photo or typing instead.",
  network:
    "Speech recognition needs a connection and couldn't reach it. Try again, or type it in.",
  "no-speech": "Didn't catch anything. Tap it again and speak up.",
};

export type DictationState = "idle" | "listening" | "finishing";

export function useDictation() {
  // Read once on mount: `supported` must be false on the server and on the
  // first client render, or the button flickers during hydration.
  const [supported, setSupported] = useState(false);
  const [state, setState] = useState<DictationState>("idle");
  const [error, setError] = useState("");
  /** Everything recognised so far this session, as final phrases land. */
  const [transcript, setTranscript] = useState("");
  /** The phrase currently being spoken, before the recogniser commits to it. */
  const [interim, setInterim] = useState("");

  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearWatchdog = useCallback(() => {
    if (watchdog.current !== null) {
      clearTimeout(watchdog.current);
      watchdog.current = null;
    }
  }, []);

  /**
   * Pull the plug on whatever is running. Handlers come off first so a
   * recogniser that is mid-flight can't write into state on its way out —
   * that was the other half of "it wouldn't stop": text still arriving after
   * the button said it had stopped.
   */
  const teardown = useCallback(() => {
    clearWatchdog();
    const engine = recognition.current;
    recognition.current = null;
    if (!engine) return;
    engine.onresult = null;
    engine.onerror = null;
    engine.onend = null;
    try {
      engine.abort();
    } catch {
      // Already dead. Nothing to do — the handlers are off either way.
    }
  }, [clearWatchdog]);

  useEffect(() => {
    setSupported(getConstructor() !== null);
    // Leaving the page mid-sentence must release the microphone.
    return teardown;
  }, [teardown]);

  const stop = useCallback(() => {
    const engine = recognition.current;
    if (!engine) {
      setState("idle");
      return;
    }

    // Ask politely first: the last phrase is often still in flight, and it's
    // usually an ingredient.
    setState("finishing");
    try {
      engine.stop();
    } catch {
      teardown();
      setState("idle");
      setInterim("");
      return;
    }

    clearWatchdog();
    watchdog.current = setTimeout(() => {
      // The polite stop never landed. Losing the last word is a far smaller
      // problem than a microphone that stays on.
      teardown();
      setState("idle");
      setInterim("");
    }, STOP_TIMEOUT_MS);
  }, [clearWatchdog, teardown]);

  /**
   * Kill it now, keeping whatever has already been transcribed.
   *
   * The escape hatch behind the polite stop: a second tap always ends it
   * immediately. Nobody should ever be left watching a button and wondering
   * whether the microphone is still on.
   */
  const cancel = useCallback(() => {
    teardown();
    setState("idle");
    setInterim("");
  }, [teardown]);

  const start = useCallback(() => {
    const Ctor = getConstructor();
    if (!Ctor) return;

    // Whatever was running goes first. Without this a second tap left the old
    // recogniser alive on the microphone with nothing able to reach it.
    teardown();

    setError("");
    setInterim("");

    const engine = new Ctor();
    // Australian English: it gets "brisket", "chook" and local place names
    // that en-US mangles.
    engine.lang = "en-AU";
    // A recipe is a long thing to say. Without continuous the recogniser stops
    // at the first pause, which is somewhere in the middle of the ingredients.
    engine.continuous = true;
    engine.interimResults = true;

    engine.onresult = (event) => {
      // A result from a recogniser we've already replaced is not ours.
      if (recognition.current !== engine) return;
      let settled = "";
      let pending = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) settled += result[0].transcript;
        else pending += result[0].transcript;
      }
      if (settled) {
        setTranscript((current) =>
          current ? `${current} ${settled.trim()}` : settled.trim(),
        );
      }
      setInterim(pending);
    };

    engine.onerror = (event) => {
      if (recognition.current !== engine) return;
      // "aborted" is what a deliberate stop looks like — not a problem.
      if (event.error === "aborted") return;
      setError(PROBLEMS[event.error] ?? "Dictation stopped unexpectedly.");
      clearWatchdog();
      setState("idle");
      setInterim("");
    };

    engine.onend = () => {
      if (recognition.current !== engine) return;
      clearWatchdog();
      recognition.current = null;
      setState("idle");
      setInterim("");
    };

    recognition.current = engine;
    try {
      engine.start();
      setState("listening");
    } catch {
      // Chrome throws if start() is called while already running.
      teardown();
      setState("idle");
      setError("Dictation wouldn't start. Reload the page and try again.");
    }
  }, [clearWatchdog, teardown]);

  const reset = useCallback(() => {
    teardown();
    setState("idle");
    setTranscript("");
    setInterim("");
    setError("");
  }, [teardown]);

  return {
    supported,
    state,
    listening: state === "listening",
    finishing: state === "finishing",
    error,
    transcript,
    interim,
    setTranscript,
    start,
    stop,
    cancel,
    reset,
  };
}
