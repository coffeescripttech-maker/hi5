import { useMemo } from "react";

const CONFETTI_COLORS = [
  "#10b981", "#f59e0b", "#3b82f6", "#ef4444",
  "#8b5cf6", "#f43f5e", "#22c55e", "#eab308",
];

interface ConfettiProps {
  count?: number;
}

/**
 * Lightweight zero-dependency confetti shower (pure CSS animation, keyframes
 * live in src/styles/index.css). Rendered inside a success modal's overlay so
 * it unmounts automatically when the modal closes — no timers to clean up.
 */
export function Confetti({ count = 70 }: ConfettiProps) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 1.2,
        duration: 2.8 + Math.random() * 2.5,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        width: 7 + Math.random() * 6,
        height: 4 + Math.random() * 5,
        drift: -50 + Math.random() * 100,
      })),
    [count]
  );

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-[70]" aria-hidden="true">
      {pieces.map(p => (
        <span
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            width: p.width,
            height: p.height,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            ["--drift" as any]: `${p.drift}px`,
          }}
        />
      ))}
    </div>
  );
}
