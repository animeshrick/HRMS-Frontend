// The opening screen: a short animation while the app starts. There are five, one for each working day,
// and the order moves on every week, so the same weekday does not always get the same one.
import { useEffect, useState, type ReactNode } from "react";

const SHOW_MILLISECONDS = 2200;
const FADE_MILLISECONDS = 450;
const TEAL = "#f8d058"; // the logo yellow, drawn on the charcoal background in both themes (the name is kept from the first design)
const SAFFRON = "#e5483f"; // the logo red
const PALE = "#d4d4d8";

/** Monday: the team in orbit round the company mark. */
function Orbit() {
  return (
    <>
      <image href="/logo.png" x="72" y="72" width="56" height="56" className="splash-pop" />
      {[
        { radius: 48, seconds: 2.6, colour: PALE, dot: 5 },
        { radius: 66, seconds: 3.8, colour: SAFFRON, dot: 6 },
        { radius: 84, seconds: 5.2, colour: PALE, dot: 4 },
      ].map((ring) => (
        <g key={ring.radius}>
          <circle cx="100" cy="100" r={ring.radius} fill="none" stroke={PALE} strokeOpacity="0.18" strokeWidth="1" />
          <g className="splash-spin" style={{ animationDuration: `${ring.seconds}s` }}>
            <circle cx="100" cy={100 - ring.radius} r={ring.dot} fill={ring.colour} />
          </g>
        </g>
      ))}
    </>
  );
}

/** Tuesday: a clock that draws itself and runs through the working day. */
function Clock() {
  return (
    <>
      <circle cx="100" cy="100" r="70" fill="none" stroke={TEAL} strokeWidth="5" strokeLinecap="round" pathLength="100" strokeDasharray="100" className="splash-draw" />
      {Array.from({ length: 12 }, (_, index) => (
        <line key={index} x1="100" y1="38" x2="100" y2={index % 3 === 0 ? 48 : 43} stroke={PALE} strokeWidth="2" strokeLinecap="round"
          transform={`rotate(${index * 30} 100 100)`} className="splash-fade" style={{ animationDelay: `${300 + index * 40}ms` }} />
      ))}
      <g className="splash-spin" style={{ animationDuration: "6s" }}>
        <line x1="100" y1="100" x2="100" y2="66" stroke={PALE} strokeWidth="5" strokeLinecap="round" />
      </g>
      <g className="splash-spin" style={{ animationDuration: "1.5s" }}>
        <line x1="100" y1="100" x2="100" y2="50" stroke={SAFFRON} strokeWidth="3" strokeLinecap="round" />
      </g>
      <circle cx="100" cy="100" r="5" fill={SAFFRON} />
    </>
  );
}

/** Wednesday: the five working days as bars, with today in saffron. */
function WeekBars({ todayIndex }: { todayIndex: number }) {
  return (
    <>
      {[62, 96, 78, 110, 70].map((height, index) => (
        <rect key={index} x={38 + index * 27} y={150 - height} width="16" height={height} rx="8" fill={index === todayIndex ? SAFFRON : TEAL}
          className="splash-grow" style={{ animationDelay: `${index * 110}ms` }} />
      ))}
      <line x1="30" y1="158" x2="170" y2="158" stroke={PALE} strokeOpacity="0.4" strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

/** Thursday: people joining up into one team. */
function Constellation() {
  const nodes: [number, number][] = [[100, 40], [152, 72], [146, 134], [100, 164], [52, 132], [48, 70], [100, 102]];
  const links: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [6, 0], [6, 2], [6, 4], [6, 1], [6, 5], [6, 3]];
  return (
    <>
      {links.map(([from, to], index) => (
        <line key={index} x1={nodes[from]![0]} y1={nodes[from]![1]} x2={nodes[to]![0]} y2={nodes[to]![1]} stroke={TEAL} strokeWidth="2" strokeLinecap="round"
          pathLength="100" strokeDasharray="100" className="splash-draw" style={{ animationDelay: `${250 + index * 90}ms`, animationDuration: "600ms" }} />
      ))}
      {nodes.map(([x, y], index) => (
        <circle key={index} cx={x} cy={y} r={index === 6 ? 9 : 6} fill={index === 6 ? SAFFRON : PALE} className="splash-pop" style={{ animationDelay: `${index * 80}ms` }} />
      ))}
    </>
  );
}

/** Friday: ripples going out, the week winding down. */
function Ripples() {
  return (
    <>
      {[0, 1, 2, 3].map((index) => (
        <circle key={index} cx="100" cy="100" r="78" fill="none" stroke={index % 2 === 0 ? TEAL : PALE} strokeWidth="3" className="splash-ripple"
          style={{ animationDelay: `${index * 450}ms` }} />
      ))}
      <circle cx="100" cy="100" r="11" fill={SAFFRON} className="splash-beat" />
    </>
  );
}

/** Which of the five animations today gets: one per weekday, shifted by the week number. A weekend gets any of them. */
function pickAnimation(now: Date): { index: number; weekdayIndex: number } {
  // For a preview, add ?splash=1 (1 to 5) to the address.
  const asked = Number(new URLSearchParams(window.location.search).get("splash"));
  if (asked >= 1 && asked <= 5) {
    return { index: asked - 1, weekdayIndex: 2 };
  }
  const weekday = now.getDay(); // 0 = Sunday
  if (weekday === 0 || weekday === 6) {
    return { index: Math.floor(Math.random() * 5), weekdayIndex: -1 };
  }
  const weekNumber = Math.floor(now.getTime() / (7 * 24 * 60 * 60 * 1000));
  return { index: (weekday - 1 + weekNumber) % 5, weekdayIndex: weekday - 1 };
}

export function Splash({ children }: { children: ReactNode }) {
  const [stage, setStage] = useState<"show" | "fade" | "gone">("show");
  const [choice] = useState(() => pickAnimation(new Date()));

  useEffect(() => {
    // People who asked their device for less motion get a much shorter, still screen.
    const prefersLessMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const fadeTimer = setTimeout(() => setStage("fade"), prefersLessMotion ? 500 : SHOW_MILLISECONDS);
    const goneTimer = setTimeout(() => setStage("gone"), (prefersLessMotion ? 500 : SHOW_MILLISECONDS) + FADE_MILLISECONDS);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(goneTimer);
    };
  }, []);

  const animations = [<Orbit />, <Clock />, <WeekBars todayIndex={choice.weekdayIndex} />, <Constellation />, <Ripples />];
  return (
    <>
      {children}
      {stage !== "gone" && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-side transition-opacity"
          style={{ opacity: stage === "fade" ? 0 : 1, transitionDuration: `${FADE_MILLISECONDS}ms` }}
        >
          <svg viewBox="0 0 200 200" className="h-48 w-48 sm:h-56 sm:w-56">
            {animations[choice.index]}
          </svg>
          <p className="splash-fade text-lg font-semibold tracking-tight text-white" style={{ animationDelay: "500ms" }}>
            HR Assistant
          </p>
        </div>
      )}
    </>
  );
}
