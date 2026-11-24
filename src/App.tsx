import { useCallback, useEffect, useMemo, useState } from "react";
import { CurveEditor } from "./components/CurveEditor";
import { BezierControls, SpringControls } from "./components/Controls";
import { ExportPanel } from "./components/ExportPanel";
import { Previews } from "./components/Previews";
import {
  DEFAULT_BEZIER, DEFAULT_SPRING, encode, readHash, resolve, writeHash,
  type Bezier, type Curve, type Spring,
} from "./easing";
import { useReducedMotion } from "./usePlayhead";

const initial = readHash();

function describe(c: Curve) {
  return c.kind === "bezier"
    ? `cubic-bezier(${c.x1}, ${c.y1}, ${c.x2}, ${c.y2}) · ${c.duration} ms`
    : `spring ${c.stiffness} / ${c.damping} / ${c.mass}`;
}

function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const set = document.documentElement.dataset.theme;
    if (set === "light" || set === "dark") return set;
    return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("el-theme", next); } catch { /* storage may be unavailable */ }
  };
  return [theme, toggle] as const;
}

export function App() {
  const [mode, setMode] = useState<Curve["kind"]>(initial.a?.kind ?? "bezier");
  const [bezier, setBezier] = useState<Bezier>(initial.a?.kind === "bezier" ? initial.a : DEFAULT_BEZIER);
  const [spring, setSpring] = useState<Spring>(initial.a?.kind === "spring" ? initial.a : DEFAULT_SPRING);
  const [ghost, setGhost] = useState<Curve | null>(initial.b);
  const [playId, setPlayId] = useState(0);
  const [theme, toggleTheme] = useTheme();
  const reduced = useReducedMotion();

  const curve: Curve = mode === "bezier" ? bezier : spring;
  const resolved = useMemo(() => resolve(curve), [curve]);
  const ghostResolved = useMemo(() => (ghost ? resolve(ghost) : null), [ghost]);
  const play = useCallback(() => setPlayId((n) => n + 1), []);

  const apply = (c: Curve) => {
    setMode(c.kind);
    if (c.kind === "bezier") setBezier(c); else setSpring(c);
  };

  useEffect(() => writeHash(curve, ghost), [curve, ghost]);

  // Replay shortly after the curve settles, so tweaking feels live. Reduced motion waits for Play.
  const key = encode(curve) + (ghost ? encode(ghost) : "");
  useEffect(() => {
    if (reduced) return;
    const id = setTimeout(play, 380);
    return () => clearTimeout(id);
  }, [key, reduced, play]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== " " || e.repeat) return;
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, button, [role=slider], [role=tab], pre")) return;
      e.preventDefault();
      play();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [play]);

  return (
    <div className="app">
      <a className="skip" href="#export-title">Skip to export</a>
      <header className="top">
        <div className="brand">
          <svg viewBox="0 0 32 32" aria-hidden="true" className="brand__mark">
            <path d="M5 27 C 13 27, 11 5, 27 5" />
          </svg>
          <div>
            <h1>Easing Lab</h1>
            <p>Shape a curve or a spring, watch it move real UI, then take it with you.</p>
          </div>
        </div>
        <div className="top__actions">
          <button type="button" className="btn btn--primary" onClick={play}>
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" /></svg>
            Play <kbd>Space</kbd>
          </button>
          <button
            type="button"
            className="btn btn--icon"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          >
            {theme === "dark" ? (
              <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="4" /><path d="M10 1.5v2M10 16.5v2M1.5 10h2M16.5 10h2M4 4l1.4 1.4M14.6 14.6 16 16M4 16l1.4-1.4M14.6 5.4 16 4" /></svg>
            ) : (
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M16.5 12.5A7 7 0 0 1 7.5 3.5a7 7 0 1 0 9 9z" /></svg>
            )}
          </button>
        </div>
      </header>

      {reduced && (
        <p className="notice">Your system asks for reduced motion, so previews only play when you press Play.</p>
      )}

      <main className="layout">
        <section className="editor" aria-label="Curve">
          <div className="modes" role="radiogroup" aria-label="Curve type">
            {(["bezier", "spring"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                className="modes__btn"
                onClick={() => setMode(m)}
              >
                {m === "bezier" ? "Cubic Bézier" : "Spring"}
              </button>
            ))}
          </div>

          <CurveEditor
            curve={curve}
            resolved={resolved}
            ghost={ghostResolved}
            playId={playId}
            onChange={setBezier}
          />

          <div className="legend" aria-hidden={!ghost}>
            <span className="legend__a">A {describe(curve)}</span>
            {ghost && <span className="legend__b">B {describe(ghost)}</span>}
          </div>

          <div className="compare">
            {ghost ? (
              <>
                <button type="button" className="btn" onClick={() => { const g = ghost; setGhost(curve); apply(g); }}>
                  Swap A and B
                </button>
                <button type="button" className="btn btn--quiet" onClick={() => setGhost(null)}>Clear B</button>
              </>
            ) : (
              <button type="button" className="btn" onClick={() => setGhost(curve)}>
                Pin as B to compare
              </button>
            )}
          </div>

          {mode === "bezier"
            ? <BezierControls value={bezier} onChange={setBezier} />
            : <SpringControls value={spring} onChange={setSpring} />}
        </section>

        <div className="stage">
          <Previews a={resolved} b={ghostResolved} playId={playId} />
          <ExportPanel curve={curve} resolved={resolved} />
        </div>
      </main>

      <footer className="foot">
        <span>Every preview runs the exact easing string in the export panel, through the Web Animations API.</span>
        <span>
          Made by <a href="https://karlrodulfo.com">Karl Rodulfo</a> ·{" "}
          <a href="https://github.com/itskarl/easing-lab">Source</a>
        </span>
      </footer>
    </div>
  );
}
