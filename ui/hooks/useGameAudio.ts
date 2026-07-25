"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type GameSoundEffect = "roll" | "play" | "roll-success" | "roll-fail" | "discard" | "skip";

const BACKGROUND_MUSIC_URL = process.env.NEXT_PUBLIC_BACKGROUND_MUSIC_URL?.trim() ?? "";
const WIN_MUSIC_URL = process.env.NEXT_PUBLIC_WIN_MUSIC_URL?.trim() ?? "";
const LOSE_MUSIC_URL = process.env.NEXT_PUBLIC_LOSE_MUSIC_URL?.trim() ?? "";

function trackSource(source: AudioScheduledSourceNode, sources: Set<AudioScheduledSourceNode>) {
  sources.add(source);
  source.addEventListener("ended", () => sources.delete(source), { once: true });
}

function tone(context: AudioContext, destination: AudioNode, sources: Set<AudioScheduledSourceNode>, frequency: number, start: number, duration: number, peak: number, type: OscillatorType = "triangle", endFrequency?: number) {
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(peak, start + Math.min(0.025, duration / 4));
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(envelope).connect(destination);
  trackSource(oscillator, sources);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.03);
}

function noise(context: AudioContext, destination: AudioNode, sources: Set<AudioScheduledSourceNode>, start: number, duration: number, peak: number) {
  const frameCount = Math.ceil(context.sampleRate * duration);
  const buffer = context.createBuffer(1, frameCount, context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < samples.length; index += 1) samples[index] = (Math.random() * 2 - 1) * (1 - index / samples.length);
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const envelope = context.createGain();
  source.buffer = buffer;
  filter.type = "bandpass";
  filter.frequency.value = 820;
  filter.Q.value = 0.8;
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(peak, start + 0.012);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter).connect(envelope).connect(destination);
  trackSource(source, sources);
  source.start(start);
  source.stop(start + duration + 0.02);
}

export function useGameAudio() {
  const [musicOn, setMusicOn] = useState(false);
  const [volume, setVolumeState] = useState(56);
  const contextRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const musicGainRef = useRef<GainNode | null>(null);
  const sfxGainRef = useRef<GainNode | null>(null);
  const musicSourcesRef = useRef(new Set<AudioScheduledSourceNode>());
  const effectSourcesRef = useRef(new Set<AudioScheduledSourceNode>());
  const resultSourcesRef = useRef(new Set<AudioScheduledSourceNode>());
  const backgroundAudioRef = useRef<HTMLAudioElement | null>(null);
  const resultAudioRef = useRef<HTMLAudioElement | null>(null);
  const musicTimerRef = useRef<number | null>(null);
  const nextMusicTimeRef = useRef(0);
  const musicStepRef = useRef(0);
  const musicOnRef = useRef(false);
  const volumeRef = useRef(56);

  const ensureAudio = useCallback(() => {
    if (contextRef.current && masterGainRef.current && musicGainRef.current && sfxGainRef.current) return contextRef.current;
    const context = new AudioContext();
    const master = context.createGain();
    const music = context.createGain();
    const effects = context.createGain();
    master.gain.value = volumeRef.current / 100;
    music.gain.value = 0.32;
    effects.gain.value = 0.72;
    music.connect(master);
    effects.connect(master);
    master.connect(context.destination);
    contextRef.current = context;
    masterGainRef.current = master;
    musicGainRef.current = music;
    sfxGainRef.current = effects;
    return context;
  }, []);

  const fillMusicQueue = useCallback(() => {
    if (!musicOnRef.current) return;
    const context = ensureAudio();
    const destination = musicGainRef.current;
    if (!destination) return;
    if (nextMusicTimeRef.current < context.currentTime) nextMusicTimeRef.current = context.currentTime + 0.04;
    const melody = [293.66, 349.23, 440, 523.25, 440, 392, 349.23, 329.63, 293.66, 349.23, 392, 440, 392, 349.23, 329.63, 261.63];
    while (nextMusicTimeRef.current < context.currentTime + 1.8) {
      const step = musicStepRef.current;
      const when = nextMusicTimeRef.current;
      tone(context, destination, musicSourcesRef.current, melody[step % melody.length], when, 0.72, 0.075, "triangle");
      tone(context, destination, musicSourcesRef.current, melody[step % melody.length] * 2, when + 0.015, 0.34, 0.018, "sine");
      if (step % 4 === 0) tone(context, destination, musicSourcesRef.current, step % 8 === 0 ? 73.42 : 87.31, when, 1.55, 0.045, "sine");
      if (step % 8 === 0) tone(context, destination, musicSourcesRef.current, 146.83, when, 3.1, 0.026, "triangle");
      musicStepRef.current += 1;
      nextMusicTimeRef.current += 0.43;
    }
  }, [ensureAudio]);

  const stopMusic = useCallback(() => {
    musicOnRef.current = false;
    if (musicTimerRef.current !== null) window.clearInterval(musicTimerRef.current);
    musicTimerRef.current = null;
    for (const source of musicSourcesRef.current) {
      try { source.stop(); } catch { /* The source may already have ended. */ }
    }
    musicSourcesRef.current.clear();
    backgroundAudioRef.current?.pause();
    setMusicOn(false);
  }, []);

  const toggleMusic = useCallback(async () => {
    if (musicOnRef.current) return stopMusic();
    if (BACKGROUND_MUSIC_URL) {
      const audio = backgroundAudioRef.current ?? new Audio(BACKGROUND_MUSIC_URL);
      audio.loop = true;
      audio.preload = "auto";
      audio.volume = volumeRef.current / 100;
      backgroundAudioRef.current = audio;
      try {
        await audio.play();
        musicOnRef.current = true;
        setMusicOn(true);
        return;
      } catch {
        backgroundAudioRef.current = null;
      }
    }
    const context = ensureAudio();
    await context.resume();
    musicOnRef.current = true;
    nextMusicTimeRef.current = context.currentTime + 0.04;
    musicStepRef.current = 0;
    setMusicOn(true);
    fillMusicQueue();
    musicTimerRef.current = window.setInterval(fillMusicQueue, 480);
  }, [ensureAudio, fillMusicQueue, stopMusic]);

  const setVolume = useCallback((nextVolume: number) => {
    const safeVolume = Math.max(0, Math.min(100, Math.round(nextVolume)));
    volumeRef.current = safeVolume;
    setVolumeState(safeVolume);
    const context = contextRef.current;
    if (context && masterGainRef.current) masterGainRef.current.gain.setTargetAtTime(safeVolume / 100, context.currentTime, 0.025);
    if (backgroundAudioRef.current) backgroundAudioRef.current.volume = safeVolume / 100;
    if (resultAudioRef.current) resultAudioRef.current.volume = safeVolume / 100;
    window.localStorage.setItem("shattered-oath-audio-volume", String(safeVolume));
  }, []);

  const playEffect = useCallback((effect: GameSoundEffect) => {
    const context = ensureAudio();
    const destination = sfxGainRef.current;
    if (!destination) return;
    void context.resume();
    const when = context.currentTime + 0.012;
    const sources = effectSourcesRef.current;
    if (effect === "roll") {
      noise(context, destination, sources, when, 0.38, 0.13);
      [0, 0.07, 0.14, 0.22, 0.31].forEach((offset, index) => tone(context, destination, sources, 180 + index * 42, when + offset, 0.09, 0.065, "square"));
    } else if (effect === "play") {
      tone(context, destination, sources, 220, when, 0.42, 0.11, "triangle", 440);
      tone(context, destination, sources, 329.63, when + 0.08, 0.45, 0.085, "triangle");
    } else if (effect === "roll-success") {
      [293.66, 369.99, 440, 587.33].forEach((frequency, index) => tone(context, destination, sources, frequency, when + index * 0.075, 0.72, 0.1, "triangle"));
      tone(context, destination, sources, 880, when + 0.25, 0.52, 0.055, "sine");
    } else if (effect === "roll-fail") {
      tone(context, destination, sources, 220, when, 0.84, 0.14, "sawtooth", 73.42);
      tone(context, destination, sources, 110, when + 0.12, 0.72, 0.105, "square", 55);
      noise(context, destination, sources, when + 0.04, 0.5, 0.09);
    } else if (effect === "discard") {
      tone(context, destination, sources, 420, when, 0.46, 0.095, "triangle", 105);
      noise(context, destination, sources, when + 0.05, 0.26, 0.06);
    } else {
      tone(context, destination, sources, 246.94, when, 0.22, 0.07, "sine");
      tone(context, destination, sources, 196, when + 0.14, 0.34, 0.065, "sine");
    }
  }, [ensureAudio]);

  const stopBattleResult = useCallback(() => {
    resultAudioRef.current?.pause();
    resultAudioRef.current = null;
    for (const source of resultSourcesRef.current) {
      try { source.stop(); } catch { /* The source may already have ended. */ }
    }
    resultSourcesRef.current.clear();
  }, []);

  const playBattleResult = useCallback((result: "win" | "lose") => {
    stopMusic();
    stopBattleResult();
    const configuredUrl = result === "win" ? WIN_MUSIC_URL : LOSE_MUSIC_URL;
    const playFallback = () => {
      const context = ensureAudio();
      const destination = sfxGainRef.current;
      if (!destination) return;
      void context.resume();
      const when = context.currentTime + 0.02;
      const sources = resultSourcesRef.current;
      if (result === "win") {
        [293.66, 369.99, 440, 587.33].forEach((frequency, index) => tone(context, destination, sources, frequency, when + index * 0.2, 1.25, 0.11, "triangle"));
        tone(context, destination, sources, 146.83, when, 2.2, 0.075, "sine");
      } else {
        tone(context, destination, sources, 196, when, 1.35, 0.12, "triangle", 98);
        tone(context, destination, sources, 146.83, when + 0.35, 1.7, 0.1, "sawtooth", 73.42);
      }
    };
    if (!configuredUrl) return playFallback();
    const audio = new Audio(configuredUrl);
    audio.preload = "auto";
    audio.volume = volumeRef.current / 100;
    resultAudioRef.current = audio;
    void audio.play().catch(() => {
      resultAudioRef.current = null;
      playFallback();
    });
  }, [ensureAudio, stopBattleResult, stopMusic]);

  useEffect(() => {
    const savedValue = window.localStorage.getItem("shattered-oath-audio-volume");
    const savedVolume = savedValue === null ? Number.NaN : Number(savedValue);
    if (Number.isFinite(savedVolume) && savedVolume >= 0 && savedVolume <= 100) setVolume(savedVolume);
    const unlock = () => { void ensureAudio().resume(); };
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, [ensureAudio, setVolume]);

  useEffect(() => () => {
    if (musicTimerRef.current !== null) window.clearInterval(musicTimerRef.current);
    backgroundAudioRef.current?.pause();
    resultAudioRef.current?.pause();
    for (const source of [...musicSourcesRef.current, ...effectSourcesRef.current, ...resultSourcesRef.current]) {
      try { source.stop(); } catch { /* The source may already have ended. */ }
    }
    void contextRef.current?.close();
  }, []);

  return { musicOn, volume, setVolume, toggleMusic, playEffect, playBattleResult, stopBattleResult };
}
