import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { round, type Curve, type Resolved } from "../easing";

type Tab = "css" | "motion" | "waapi" | "tokens";
const TABS: { id: Tab; label: string }[] = [
  { id: "css", label: "CSS" },
  { id: "motion", label: "Motion" },
  { id: "waapi", label: "Web Animations" },
  { id: "tokens", label: "Design tokens" },
];

const slug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "custom";
const camel = (s: string) => slug(s).replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());

/** Wraps a long linear() list so it reads as code rather than one endless line. */
function wrapLinear(css: string, indent: string) {
  if (!css.startsWith("linear(") || css.length < 70) return css;
  const stops = css.slice(7, -1).split(", ");
  const lines: string[] = [];
  let line = "";
  for (const s of stops) {
    if ((line + s).length > 64) { lines.push(line.trimEnd()); line = ""; }
    line += `${s}, `;
  }
  lines.push(line.replace(/, $/, ""));
  return `linear(\n${lines.map((l) => indent + "  " + l).join("\n")}\n${indent})`;
}

function snippet(tab: Tab, curve: Curve, r: Resolved, name: string) {
  const s = slug(name);
  const durS = round(r.duration / 1000, 3);
  switch (tab) {
    case "css":
      return `:root {
  --ease-${s}: ${wrapLinear(r.css, "  ")};
  --duration-${s}: ${r.duration}ms;
}

.panel {
  transition: transform var(--duration-${s}) var(--ease-${s});
}`;
    case "motion":
      return curve.kind === "bezier"
        ? `import { motion } from "motion/react";

export const ${camel(name)} = {
  duration: ${durS},
  ease: [${round(curve.x1)}, ${round(curve.y1)}, ${round(curve.x2)}, ${round(curve.y2)}],
};

<motion.div animate={{ x: 240 }} transition={${camel(name)}} />`
        : `import { motion } from "motion/react";

export const ${camel(name)} = {
  type: "spring",
  stiffness: ${curve.stiffness},
  damping: ${curve.damping},
  mass: ${curve.mass},
};

// Settles in about ${r.duration}ms
<motion.div animate={{ x: 240 }} transition={${camel(name)}} />`;
    case "waapi":
      return `element.animate(
  [{ transform: "translateX(0)" }, { transform: "translateX(240px)" }],
  {
    duration: ${r.duration},
    easing: "${r.css}",
    fill: "both",
  },
);`;
    case "tokens": {
      const easing =
        curve.kind === "bezier"
          ? { $type: "cubicBezier", $value: [round(curve.x1), round(curve.y1), round(curve.x2), round(curve.y2)] }
          : {
              $description: "Spring sampled to a CSS linear() curve. No DTCG type exists for springs yet, so the physics travel in $extensions.",
              $value: r.css,
              $extensions: {
                "dev.easing-lab.spring": { stiffness: curve.stiffness, damping: curve.damping, mass: curve.mass },
              },
            };
      return JSON.stringify(
        {
          motion: {
            duration: { [s]: { $type: "duration", $value: { value: r.duration, unit: "ms" } } },
            easing: { [s]: easing },
          },
        },
        null,
        2,
      );
    }
  }
}

export function ExportPanel({ curve, resolved }: { curve: Curve; resolved: Resolved }) {
  const [tab, setTab] = useState<Tab>("css");
  const [name, setName] = useState("custom");
  const [status, setStatus] = useState("");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const code = snippet(tab, curve, resolved, name);

  useEffect(() => {
    if (!status) return;
    const id = setTimeout(() => setStatus(""), 1800);
    return () => clearTimeout(id);
  }, [status]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setStatus("Copied");
    } catch {
      setStatus("Couldn't copy. Select the code and copy it manually.");
    }
  };

  const onTabKey = (e: KeyboardEvent, i: number) => {
    const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    const next = e.key === "Home" ? 0 : e.key === "End" ? TABS.length - 1 : dir ? (i + dir + TABS.length) % TABS.length : -1;
    if (next < 0) return;
    e.preventDefault();
    setTab(TABS[next].id);
    tabRefs.current[next]?.focus();
  };

  return (
    <section className="export" aria-labelledby="export-title">
      <div className="export__head">
        <h2 id="export-title">Export</h2>
        <label className="export__name">
          <span>Token name</span>
          <input value={name} onChange={(e) => setName(e.currentTarget.value)} spellCheck={false} maxLength={32} />
        </label>
      </div>
      <div className="export__bar">
      <div className="tabs" role="tablist" aria-label="Export format">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => { tabRefs.current[i] = el; }}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls="export-code"
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
            onKeyDown={(e) => onTabKey(e, i)}
          >
            {t.label}
          </button>
        ))}
      </div>
        <button type="button" className="code__copy" onClick={copy}>{status === "Copied" ? "Copied" : "Copy"}</button>
      </div>
      <div className="code" role="tabpanel" id="export-code" aria-labelledby={`tab-${tab}`}>
        <pre tabIndex={0} aria-label={`${TABS.find((t) => t.id === tab)!.label} code`}><code>{code}</code></pre>
      </div>
      <p className="sr-only" role="status">{status}</p>
    </section>
  );
}
