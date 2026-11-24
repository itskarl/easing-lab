import { useId, useMemo } from "react";
import {
  bezierPresets, clamp, dampingRatio, resolve, round, springPresets, Y_MAX, Y_MIN,
  type Bezier, type Spring,
} from "../easing";

function Thumb({ fn }: { fn: (t: number) => number }) {
  // A tiny curve; the vertical range is padded so overshooting presets stay visible.
  const d = useMemo(() => {
    let s = "";
    for (let i = 0; i <= 32; i++) {
      const t = i / 32;
      const y = 26 - ((fn(t) + 0.6) / 2.2) * 24;
      s += `${i ? "L" : "M"}${(2 + t * 24).toFixed(1)},${y.toFixed(1)}`;
    }
    return s;
  }, [fn]);
  return (
    <svg className="thumb" viewBox="0 0 28 28" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export function BezierControls({ value, onChange }: { value: Bezier; onChange: (b: Bezier) => void }) {
  const id = useId();
  const presets = useMemo(
    () => bezierPresets.map((p) => ({ ...p, fn: resolve({ kind: "bezier", x1: p.v[0], y1: p.v[1], x2: p.v[2], y2: p.v[3], duration: 1 }).fn })),
    [],
  );
  const fields = [
    ["x1", 0, 1],
    ["y1", Y_MIN, Y_MAX],
    ["x2", 0, 1],
    ["y2", Y_MIN, Y_MAX],
  ] as const;

  return (
    <>
      <fieldset className="field-group">
        <legend className="eyebrow">Presets</legend>
        <div className="presets">
          {presets.map((p) => {
            const active = p.v[0] === value.x1 && p.v[1] === value.y1 && p.v[2] === value.x2 && p.v[3] === value.y2;
            return (
              <button
                key={p.name}
                type="button"
                className="preset"
                aria-pressed={active}
                onClick={() => onChange({ ...value, x1: p.v[0], y1: p.v[1], x2: p.v[2], y2: p.v[3] })}
              >
                <Thumb fn={p.fn} />
                {p.name}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="field-group">
        <legend className="eyebrow">Control points</legend>
        <div className="coords">
          {fields.map(([key, min, max]) => (
            <label key={key} className="coord">
              <span>{key}</span>
              <input
                type="number"
                inputMode="decimal"
                step={0.01}
                min={min}
                max={max}
                value={round(value[key], 3)}
                onChange={(e) => {
                  const n = e.currentTarget.valueAsNumber;
                  if (Number.isFinite(n)) onChange({ ...value, [key]: clamp(n, min, max) });
                }}
              />
            </label>
          ))}
        </div>
      </fieldset>

      <Slider
        id={`${id}-dur`}
        label="Duration"
        min={50}
        max={2000}
        step={10}
        value={value.duration}
        format={(n) => `${n} ms`}
        onChange={(n) => onChange({ ...value, duration: n })}
      />
    </>
  );
}

export function SpringControls({ value, onChange }: { value: Spring; onChange: (s: Spring) => void }) {
  const id = useId();
  const presets = useMemo(
    () => springPresets.map((p) => ({ ...p, fn: resolve({ kind: "spring", stiffness: p.v[0], damping: p.v[1], mass: p.v[2] }).fn })),
    [],
  );
  const zeta = dampingRatio(value);
  const settle = resolve(value).duration;
  const character = zeta < 0.999 ? "bounces" : zeta <= 1.001 ? "critically damped" : "overdamped, no bounce";

  return (
    <>
      <fieldset className="field-group">
        <legend className="eyebrow">Presets</legend>
        <div className="presets">
          {presets.map((p) => {
            const active = p.v[0] === value.stiffness && p.v[1] === value.damping && p.v[2] === value.mass;
            return (
              <button
                key={p.name}
                type="button"
                className="preset"
                aria-pressed={active}
                onClick={() => onChange({ kind: "spring", stiffness: p.v[0], damping: p.v[1], mass: p.v[2] })}
              >
                <Thumb fn={p.fn} />
                {p.name}
              </button>
            );
          })}
        </div>
      </fieldset>

      <Slider id={`${id}-k`} label="Stiffness" min={10} max={1000} step={5} value={value.stiffness}
        onChange={(n) => onChange({ ...value, stiffness: n })} />
      <Slider id={`${id}-c`} label="Damping" min={1} max={100} step={0.5} value={value.damping}
        onChange={(n) => onChange({ ...value, damping: n })} />
      <Slider id={`${id}-m`} label="Mass" min={0.1} max={5} step={0.1} value={value.mass}
        format={(n) => n.toFixed(1)} onChange={(n) => onChange({ ...value, mass: n })} />

      <dl className="readout">
        <div><dt>Damping ratio</dt><dd>{zeta.toFixed(2)} <span>{character}</span></dd></div>
        <div><dt>Settles in</dt><dd>{settle} ms</dd></div>
      </dl>
    </>
  );
}

function Slider({
  id, label, min, max, step, value, onChange, format = (n) => String(n),
}: {
  id: string; label: string; min: number; max: number; step: number; value: number;
  onChange: (n: number) => void; format?: (n: number) => string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="slider">
      <div className="slider__head">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id}>{format(value)}</output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ "--pct": `${pct}%` } as React.CSSProperties}
        onChange={(e) => onChange(e.currentTarget.valueAsNumber)}
      />
    </div>
  );
}
