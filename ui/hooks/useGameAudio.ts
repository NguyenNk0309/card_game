"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type GameSoundEffect = "roll" | "play" | "success" | "fail" | "discard" | "skip";

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
    setMusicOn(false);
  }, []);

  const toggleMusic = useCallback(async () => {
    if (musicOnRef.current) return stopMusic();
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
    } else if (effect === "success") {
      [293.66, 369.99, 440].forEach((frequency, index) => tone(context, destination, sources, frequency, when + index * 0.07, 0.65, 0.095, "triangle"));
    } else if (effect === "fail") {
      tone(context, destination, sources, 196, when, 0.75, 0.12, "sawtooth", 82.41);
      noise(context, destination, sources, when + 0.05, 0.42, 0.075);
    } else if (effect === "discard") {
      tone(context, destination, sources, 420, when, 0.46, 0.095, "triangle", 105);
      noise(context, destination, sources, when + 0.05, 0.26, 0.06);
    } else {
      tone(context, destination, sources, 246.94, when, 0.22, 0.07, "sine");
      tone(context, destination, sources, 196, when + 0.14, 0.34, 0.065, "sine");
    }
  }, [ensureAudio]);

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
    for (const source of [...musicSourcesRef.current, ...effectSourcesRef.current]) {
      try { source.stop(); } catch { /* The source may already have ended. */ }
    }
    void contextRef.current?.close();
  }, []);

  return { musicOn, volume, setVolume, toggleMusic, playEffect };
}
