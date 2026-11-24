import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { clamp, round, Y_MAX, Y_MIN, type Bezier, type Curve, type Resolved } from "../easing";
import { usePlayhead } from "../usePlayhead";

const W = 400;
const H = 480;
const PAD = 28;
const X = (x: number) => PAD + x * (W - 2 * PAD);
const Y = (y: number) => PAD + ((Y_MAX - y) / (Y_MAX - Y_MIN)) * (H - 2 * PAD);

function pathFor(fn: (t: number) => number, steps = 200) {
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    d += `${i ? "L" : "M"}${X(t).toFixed(2)},${Y(fn(t)).toFixed(2)}`;
  }
  return d;
}

type Props = {
  curve: Curve;
  resolved: Resolved;
  ghost: Resolved | null;
  playId: number;
  onChange: (c: Bezier) => void;
};

export function CurveEditor({ curve, resolved, ghost, playId, onChange }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<1 | 2 | null>(null);
  const elapsed = usePlayhead(playId, Math.max(resolved.duration, ghost?.duration ?? 0));

  const bez = curve.kind === "bezier" ? curve : null;

  const move = (which: 1 | 2, x: number, y: number) => {
    if (!bez) return;
    const nx = round(clamp(x, 0, 1), 3);
    const ny = round(clamp(y, Y_MIN, Y_MAX), 3);
    onChange(which === 1 ? { ...bez, x1: nx, y1: ny } : { ...bez, x2: nx, y2: ny });
  };

  const fromPointer = (e: PointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * W;
    const sy = ((e.clientY - r.top) / r.height) * H;
    return {
      x: (sx - PAD) / (W - 2 * PAD),
      y: Y_MAX - ((sy - PAD) / (H - 2 * PAD)) * (Y_MAX - Y_MIN),
    };
  };

  const onDown = (which: 1 | 2) => (e: PointerEvent<SVGGElement>) => {
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    setDragging(which);
  };
  const onMove = (which: 1 | 2) => (e: PointerEvent<SVGGElement>) => {
    if (dragging !== which) return;
    const p = fromPointer(e);
    move(which, p.x, p.y);
  };
  const onUp = () => setDragging(null);

  const onKey = (which: 1 | 2) => (e: KeyboardEvent<SVGGElement>) => {
    if (!bez) return;
    const step = e.shiftKey ? 0.1 : 0.01;
    const x = which === 1 ? bez.x1 : bez.x2;
    const y = which === 1 ? bez.y1 : bez.y2;
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step],
    };
    const d = delta[e.key];
    if (!d) return;
    e.preventDefault();
    move(which, x + d[0], y + d[1]);
  };

  const head = (r: Resolved) => {
    if (elapsed === null) return null;
    const t = Math.min(1, elapsed / r.duration);
    return { x: X(t), y: Y(r.fn(t)) };
  };
  const headA = head(resolved);
  const headB = ghost ? head(ghost) : null;

  const handles = bez
    ? ([
        [1, bez.x1, bez.y1, 0, 0],
        [2, bez.x2, bez.y2, 1, 1],
      ] as const)
    : [];

  const gridY = [-0.5, -0.25, 0, 0.25, 0.5, 0.75, 1, 1.25, 1.5];
  const gridX = [0, 0.25, 0.5, 0.75, 1];

  return (
    <figure className="graph">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className={dragging ? "graph__svg is-dragging" : "graph__svg"}
        role="group"
        aria-labelledby="graph-title"
      >
        <title id="graph-title">
          {bez ? "Easing curve. Drag a handle, or focus it and use the arrow keys." : "Spring response over time."}
        </title>
        <defs>
          <clipPath id="plot-clip">
            <rect x={PAD} y={PAD} width={W - 2 * PAD} height={H - 2 * PAD} />
          </clipPath>
        </defs>

        {/* overshoot bands */}
        <rect className="graph__band" x={X(0)} y={Y(Y_MAX)} width={X(1) - X(0)} height={Y(1) - Y(Y_MAX)} />
        <rect className="graph__band" x={X(0)} y={Y(0)} width={X(1) - X(0)} height={Y(Y_MIN) - Y(0)} />

        {gridY.map((g) => (
          <line key={`y${g}`} className={g === 0 || g === 1 ? "graph__axis" : "graph__grid"} x1={X(0)} x2={X(1)} y1={Y(g)} y2={Y(g)} />
        ))}
        {gridX.map((g) => (
          <line key={`x${g}`} className={g === 0 || g === 1 ? "graph__axis" : "graph__grid"} x1={X(g)} x2={X(g)} y1={Y(Y_MIN)} y2={Y(Y_MAX)} />
        ))}
        <text className="graph__label" x={X(0) - 8} y={Y(1) + 4} textAnchor="end">1</text>
        <text className="graph__label" x={X(0) - 8} y={Y(0) + 4} textAnchor="end">0</text>
        <text className="graph__label" x={X(1)} y={H - 8} textAnchor="end">time →</text>
        <text className="graph__label" x={X(0)} y={18}>progress</text>

        <g clipPath="url(#plot-clip)">
          {ghost && <path className="graph__curve graph__curve--b" d={pathFor(ghost.fn)} />}
          <path className="graph__curve" d={pathFor(resolved.fn)} />
        </g>

        {handles.map(([id, hx, hy, ox, oy]) => (
          <line key={`arm${id}`} className="graph__arm" x1={X(ox)} y1={Y(oy)} x2={X(hx)} y2={Y(hy)} />
        ))}

        {elapsed !== null && headA && (
          <g aria-hidden="true">
            <line className="graph__playline" x1={headA.x} x2={headA.x} y1={Y(Y_MIN)} y2={Y(Y_MAX)} />
            {headB && <circle className="graph__head graph__head--b" cx={headB.x} cy={headB.y} r={6} />}
            <circle className="graph__head" cx={headA.x} cy={headA.y} r={7} />
          </g>
        )}

        {handles.map(([id, hx, hy]) => (
          <g
            key={`h${id}`}
            className={`graph__handle${dragging === id ? " is-active" : ""}`}
            transform={`translate(${X(hx)} ${Y(hy)})`}
            tabIndex={0}
            role="slider"
            aria-label={`Handle ${id}`}
            aria-valuetext={`x ${hx.toFixed(2)}, y ${hy.toFixed(2)}`}
            aria-valuenow={hy}
            aria-valuemin={Y_MIN}
            aria-valuemax={Y_MAX}
            onPointerDown={onDown(id)}
            onPointerMove={onMove(id)}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onKeyDown={onKey(id)}
          >
            <circle className="graph__hit" r={22} />
            <circle className="graph__ring" r={13} />
            <circle className="graph__dot" r={7} />
          </g>
        ))}
      </svg>
    </figure>
  );
}
