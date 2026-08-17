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
 * — so `supported` is part of the contract rather than an afterthought. A
 * caller that ignores it shows a mic button that does nothing.
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

export function useDictation() {
  // Read once on mount: `supported` must be false on the server and on the
  // first client render, or the button flickers in and out during hydration.
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  /** Everything recognised so far this session, as final phrases land. */
  const [transcript, setTranscript] = useState("");
  /** The phrase currently being spoken, before the recogniser commits to it. */
  const [interim, setInterim] = useState("");

  const recognition = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    setSupported(getConstructor() !== null);
    return () => {
      // Leaving the page mid-sentence must release the microphone.
      recognition.current?.abort();
      recognition.current = null;
    };
  }, []);

  const stop = useCallback(() => {
    recognition.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = getConstructor();
    if (!Ctor) return;

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
      let settled = "";
      let pending = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) settled += result[0].transcript;
        else pending += result[0].transcript;
      }
      if (settled) {
        setTranscript((current) => (current ? `${current} ${settled.trim()}` : settled.trim()));
      }
      setInterim(pending);
    };

    engine.onerror = (event) => {
      // "aborted" is what a deliberate stop looks like — not a problem.
      if (event.error === "aborted") return;
      setError(PROBLEMS[event.error] ?? "Dictation stopped unexpectedly.");
      setListening(false);
    };

    engine.onend = () => {
      setListening(false);
      setInterim("");
    };

    recognition.current = engine;
    try {
      engine.start();
      setListening(true);
    } catch {
      // Chrome throws if start() is called while already running.
      setError("Dictation is already running.");
    }
  }, []);

  const reset = useCallback(() => {
    recognition.current?.abort();
    setListening(false);
    setTranscript("");
    setInterim("");
    setError("");
  }, []);

  return {
    supported,
    listening,
    error,
    transcript,
    interim,
    setTranscript,
    start,
    stop,
    reset,
  };
}
