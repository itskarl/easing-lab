import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { Resolved } from "../easing";

/** Run a Web Animation with the exact easing string the export panel hands out. */
function run(el: Element | null, keyframes: Keyframe[], r: Resolved) {
  if (!el) return undefined;
  const opts: KeyframeAnimationOptions = { duration: r.duration, easing: r.css, fill: "both" };
  try {
    return el.animate(keyframes, opts);
  } catch {
    // Browsers without linear() support fall back to a stock curve rather than not moving at all.
    return el.animate(keyframes, { ...opts, easing: "ease-out" });
  }
}

/** Calls `effect` on every play after the first render, and cancels what it started on the next one. */
function useOnPlay(playId: number, effect: () => (Animation | undefined)[] | void) {
  useEffect(() => {
    if (!playId) return;
    const anims = effect() || [];
    return () => anims.forEach((a) => a?.cancel());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playId]);
}

/** Lets a card replay only its own preview. Provided by Slot, read by Card. */
const PlayOne = createContext<(() => void) | null>(null);

/** Gives one preview its own play counter on top of the global one, so it can replay alone. */
function Slot({ playId, children }: { playId: number; children: (id: number) => ReactNode }) {
  const [local, setLocal] = useState(0);
  return <PlayOne.Provider value={() => setLocal((n) => n + 1)}>{children(playId + local)}</PlayOne.Provider>;
}

function Card({ title, note, children, wide }: { title: string; note: string; children: ReactNode; wide?: boolean }) {
  const play = useContext(PlayOne);
  return (
    <article className={wide ? "card card--wide" : "card"}>
      {/* The stage is a mouse shortcut; the button is the accessible way to replay. */}
      <div className="card__stage" onClick={play ?? undefined}>{children}</div>
      <div className="card__meta">
        <div>
          <h3>{title}</h3>
          <p>{note}</p>
        </div>
        {play && (
          <button type="button" className="card__play" onClick={play} aria-label={`Play ${title}`}>
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.2v9.6l7.6-4.8z" /></svg>
          </button>
        )}
      </div>
    </article>
  );
}

const STROBE = 12;
const RAIL_INSET = 0.12;

function TrackRow({ r, label, variant, playId }: { r: Resolved; label: string; variant: "a" | "b"; playId: number }) {
  const ball = useRef<HTMLDivElement>(null);
  useOnPlay(playId, () => {
    const el = ball.current;
    if (!el?.parentElement) return;
    // 0 → 1 spans the middle of the rail; the margins leave room to show overshoot and anticipation.
    const travel = el.parentElement.clientWidth * (1 - 2 * RAIL_INSET);
    return [run(el, [{ transform: "translateX(0)" }, { transform: `translateX(${travel}px)` }], r)];
  });
  return (
    <div className={`track track--${variant}`}>
      <span className="track__label">{label}<em>{r.duration} ms</em></span>
      <div className="track__rail">
        {Array.from({ length: STROBE + 1 }, (_, i) => (
          <span key={i} className="track__ghost" style={{ "--p": r.fn(i / STROBE) } as React.CSSProperties} />
        ))}
        <span className="track__mark track__mark--start" />
        <span className="track__mark track__mark--end" />
        <div ref={ball} className="track__ball" />
      </div>
    </div>
  );
}

function Track({ a, b, playId }: { a: Resolved; b: Resolved | null; playId: number }) {
  return (
    <Card
      wide
      title="Spacing"
      note={`The faint dots mark where the ball sits at each twelfth of the duration. Bunched dots are slow, spread dots are fast.${b ? " A and B start together." : ""}`}
    >
      <div className="tracks">
        <TrackRow r={a} label="A" variant="a" playId={playId} />
        {b && <TrackRow r={b} label="B" variant="b" playId={playId} />}
      </div>
    </Card>
  );
}

function Modal({ r, playId }: { r: Resolved; playId: number }) {
  const scrim = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  useOnPlay(playId, () => [
    run(scrim.current, [{ opacity: 0 }, { opacity: 1 }], r),
    run(dialog.current, [
      { opacity: 0, transform: "translateY(24px) scale(0.92)" },
      { opacity: 1, transform: "none" },
    ], r),
  ]);
  return (
    <Card title="Modal" note="Scales and rises into place over a fading scrim.">
      <div className="mini-screen">
        <div className="mini-screen__lines" aria-hidden="true"><i /><i /><i /></div>
        <div ref={scrim} className="mini-modal__scrim" />
        <div ref={dialog} className="mini-modal" aria-hidden="true">
          <b>Delete project?</b>
          <span>This can't be undone.</span>
          <div className="mini-modal__actions"><i /><i /></div>
        </div>
      </div>
    </Card>
  );
}

function Toast({ r, playId }: { r: Resolved; playId: number }) {
  const toast = useRef<HTMLDivElement>(null);
  useOnPlay(playId, () => [
    run(toast.current, [{ transform: "translateY(calc(100% + 24px))" }, { transform: "none" }], r),
  ]);
  return (
    <Card title="Toast" note="Slides up from below the edge of the screen.">
      <div className="mini-screen mini-screen--clip">
        <div className="mini-screen__lines" aria-hidden="true"><i /><i /><i /></div>
        <div ref={toast} className="mini-toast" aria-hidden="true">
          <span className="mini-toast__icon" />Changes saved<em>Undo</em>
        </div>
      </div>
    </Card>
  );
}

function Toggle({ r, playId }: { r: Resolved; playId: number }) {
  const knob = useRef<HTMLSpanElement>(null);
  const fill = useRef<HTMLSpanElement>(null);
  const [on, setOn] = useState(true);
  useOnPlay(playId, () => {
    const next = !on;
    setOn(next);
    const [from, to] = next ? [0, 1] : [1, 0];
    return [
      run(knob.current, [{ transform: `translateX(${from * 28}px)` }, { transform: `translateX(${to * 28}px)` }], r),
      run(fill.current, [{ opacity: from }, { opacity: to }], r),
    ];
  });
  return (
    <Card title="Switch" note="Flips direction on every play.">
      <div className="mini-toggle" aria-hidden="true">
        <span ref={fill} className="mini-toggle__fill" />
        <span ref={knob} className="mini-toggle__knob" />
      </div>
    </Card>
  );
}

const ITEMS = ["Inbox", "Drafts", "Archive", "Spam"];

function Reorder({ r, playId }: { r: Resolved; playId: number }) {
  const [order, setOrder] = useState(ITEMS);
  const els = useRef(new Map<string, HTMLLIElement>());
  const before = useRef(new Map<string, number>());
  const anims = useRef<Animation[]>([]);

  useEffect(() => {
    if (!playId) return;
    els.current.forEach((el, key) => before.current.set(key, el.getBoundingClientRect().top));
    // Two patterns that each move every row, alternating so consecutive plays differ.
    setOrder((o) => (playId % 2 ? [o[1], o[0], o[3], o[2]] : [o[2], o[0], o[3], o[1]]));
  }, [playId]);

  useLayoutEffect(() => {
    if (!before.current.size) return;
    anims.current.forEach((a) => a.cancel());
    anims.current = [];
    els.current.forEach((el, key) => {
      const prev = before.current.get(key);
      if (prev === undefined) return;
      const dy = prev - el.getBoundingClientRect().top;
      if (!dy) return;
      const a = run(el, [{ transform: `translateY(${dy}px)` }, { transform: "none" }], r);
      if (a) anims.current.push(a);
    });
    before.current.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order]);

  return (
    <Card title="Reorder" note="Each row glides from its old slot to its new one.">
      <ul className="mini-list" aria-hidden="true">
        {order.map((item) => (
          <li key={item} ref={(el) => { if (el) els.current.set(item, el); else els.current.delete(item); }}>
            <span className="mini-list__grip" />{item}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Expand({ r, playId }: { r: Resolved; playId: number }) {
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  useOnPlay(playId, () => {
    const next = !open;
    setOpen(next);
    const [from, to] = next ? [44, 132] : [132, 44];
    return [run(panel.current, [{ height: `${from}px` }, { height: `${to}px` }], r)];
  });
  return (
    <Card title="Disclosure" note="Opens and closes on alternate plays.">
      <div ref={panel} className="mini-disclosure" aria-hidden="true">
        <div className="mini-disclosure__head">Shipping details <span className={open ? "chev is-open" : "chev"} /></div>
        <p>Orders leave the warehouse within two business days. Tracking arrives by email.</p>
      </div>
    </Card>
  );
}

function Drawer({ r, playId }: { r: Resolved; playId: number }) {
  const panel = useRef<HTMLDivElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  useOnPlay(playId, () => [
    run(scrim.current, [{ opacity: 0 }, { opacity: 1 }], r),
    run(panel.current, [{ transform: "translateX(-100%)" }, { transform: "none" }], r),
  ]);
  return (
    <Card title="Drawer" note="Pushes in from the left edge.">
      <div className="mini-screen">
        <div className="mini-screen__lines" aria-hidden="true"><i /><i /><i /></div>
        <div ref={scrim} className="mini-modal__scrim" />
        <div ref={panel} className="mini-drawer" aria-hidden="true">
          <b>Menu</b><i /><i /><i /><i />
        </div>
      </div>
    </Card>
  );
}

export function Previews({ a, b, playId }: { a: Resolved; b: Resolved | null; playId: number }) {
  return (
    <div className="previews">
      <Slot playId={playId}>{(id) => <Track a={a} b={b} playId={id} />}</Slot>
      <Slot playId={playId}>{(id) => <Modal r={a} playId={id} />}</Slot>
      <Slot playId={playId}>{(id) => <Toast r={a} playId={id} />}</Slot>
      <Slot playId={playId}>{(id) => <Reorder r={a} playId={id} />}</Slot>
      <Slot playId={playId}>{(id) => <Expand r={a} playId={id} />}</Slot>
      <Slot playId={playId}>{(id) => <Drawer r={a} playId={id} />}</Slot>
      <Slot playId={playId}>{(id) => <Toggle r={a} playId={id} />}</Slot>
    </div>
  );
}
