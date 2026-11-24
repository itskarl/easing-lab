# Easing Lab

Shape a cubic Bézier curve or a spring, watch it drive real interface motion, and export it to CSS, Motion, the Web Animations API or design tokens.

## What's in it

- **Curve editor.** Drag the two control points, nudge them with the arrow keys (Shift for bigger steps), or type exact values. Ten presets with thumbnails.
- **Springs.** Stiffness, damping and mass, with the damping ratio and settle time shown live. The motion is solved in closed form, not simulated frame by frame.
- **Previews.** A spacing track, modal, toast, list reorder, disclosure, drawer and switch, all running at once.
- **Compare.** Pin any curve as B to overlay it on the graph and race it on the track. Swap A and B in one click.
- **Export.** CSS custom properties, a Motion transition, a Web Animations call, or DTCG design tokens, with a name you choose.
- **Shareable.** The URL holds the current curve and the comparison.

## What you see is what you copy

Every preview is animated with the Web Animations API, using the same easing string the export panel shows. Springs are sampled and simplified into a CSS `linear()` function (Ramer–Douglas–Peucker keeps it short), so a spring works in plain CSS with no runtime.

## Accessibility

- Graph handles are focusable sliders that work with the arrow keys and announce their x and y values.
- Every value has a labeled input, and the export tabs follow the ARIA tabs pattern.
- With reduced motion turned on, nothing plays until you press Play.
- Light and dark themes, following the system by default.

## Develop

```bash
npm install
npm run dev
```

`npm run build` typechecks and builds a static site into `dist/`.

## License

MIT © Karl Rodulfo
