"use client";

import { useEffect, useState } from "react";
import { D20Dice } from "./D20Dice";
import type { D20AnimationState, D20Quality, D20RollInput } from "./D20Types";

export function D20DebugPanel() {
  const [enabled, setEnabled] = useState(false);
  const [rawResult, setRawResult] = useState(12);
  const [modifier, setModifier] = useState(1);
  const [finalResult, setFinalResult] = useState(13);
  const [quality, setQuality] = useState<D20Quality>("high");
  const [pauseAt, setPauseAt] = useState<"result" | "">("");
  const [startAt, setStartAt] = useState<"result" | "">("");
  const [active, setActive] = useState<(D20RollInput & { id: number; allFaces: boolean }) | null>(null);
  const [state, setState] = useState<D20AnimationState>("idle");
  const [rollCounter, setRollCounter] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const debugEnabled = process.env.NODE_ENV !== "production" && params.get("d20Debug") === "1";
    setEnabled(debugEnabled);
    const automaticRoll = params.get("d20Auto")?.split(",").map(Number);
    const automaticPause = params.get("d20Pause");
    const automaticStart = params.get("d20Instant");
    if (automaticPause === "result" || automaticPause === "final") setPauseAt("result");
    if (automaticStart === "result" || automaticStart === "final") setStartAt("result");
    if (debugEnabled && automaticRoll?.length === 3 && automaticRoll.every(Number.isFinite)) {
      const [automaticRaw, automaticModifier, automaticFinal] = automaticRoll;
      setRawResult(automaticRaw);
      setModifier(automaticModifier);
      setFinalResult(automaticFinal);
      setRollCounter(1);
      setActive({ rawResult: automaticRaw, modifier: automaticModifier, finalResult: automaticFinal, id: 1, allFaces: false });
    }
  }, []);
  if (!enabled) return null;

  const start = (input: D20RollInput, allFaces = false) => {
    const id = rollCounter + 1;
    setRollCounter(id);
    setActive({ ...input, id, allFaces });
  };
  const finish = () => {
    if (active?.allFaces && active.rawResult < 20) {
      const next = active.rawResult + 1;
      start({ rawResult: next, modifier: 0, finalResult: next }, true);
      return;
    }
    setActive(null);
  };

  return <>
    {active && <D20Dice
      {...active}
      rollId={`debug:${active.id}`}
      quality={quality}
      pauseAt={pauseAt || undefined}
      startAt={startAt || undefined}
      onStateChange={setState}
      onRollComplete={finish}
      onRollError={(error) => { console.error(error); setState("error"); setActive(null); }}
    />}
    <aside className="d20-debug-panel" aria-label="D20 developer controls">
      <strong>D20 debug</strong>
      <label>Raw <input type="number" min="1" max="20" value={rawResult} onChange={(event) => setRawResult(Number(event.target.value))}/></label>
      <label>Modifier <input type="number" min="-20" max="20" value={modifier} onChange={(event) => setModifier(Number(event.target.value))}/></label>
      <label>Final <input type="number" min="-20" max="40" value={finalResult} onChange={(event) => setFinalResult(Number(event.target.value))}/></label>
      <label>Resin <select value={quality} onChange={(event) => setQuality(event.target.value as D20Quality)}><option value="high">High</option><option value="low">Low</option></select></label>
      <label>Pause <select value={pauseAt} onChange={(event) => setPauseAt(event.target.value as "result" | "")}><option value="">None</option><option value="result">Result</option></select></label>
      <label>Start <select value={startAt} onChange={(event) => setStartAt(event.target.value as "result" | "")}><option value="">Throw</option><option value="result">Result face</option></select></label>
      <output>{state}</output>
      <div><button onClick={() => start({ rawResult, modifier, finalResult })} disabled={Boolean(active)}>Roll</button><button onClick={() => setActive(null)} disabled={!active}>Cancel</button></div>
      <div><button onClick={() => start({ rawResult: rawResult >= 20 ? 1 : rawResult + 1, modifier: 0, finalResult: rawResult >= 20 ? 1 : rawResult + 1 })} disabled={Boolean(active)}>Next face</button><button onClick={() => start({ rawResult: 1, modifier: 0, finalResult: 1 }, true)} disabled={Boolean(active)}>All 20</button></div>
    </aside>
  </>;
}
