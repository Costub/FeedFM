"use client";

import { cn } from "@/lib/utils";

type PixelWaveformProps = {
  active?: boolean;
  compact?: boolean;
  className?: string;
};

const bars = [18, 34, 58, 28, 72, 44, 82, 36, 64, 24, 52, 76, 32, 68, 46, 88];

export function PixelWaveform({ active = true, compact, className }: PixelWaveformProps) {
  return (
    <div
      className={cn(
        "flex h-28 items-end gap-1 overflow-hidden rounded-sm border-2 border-border bg-console-black p-3 shadow-inner",
        compact && "h-16 gap-0.5 p-2",
        className,
      )}
      aria-hidden="true"
    >
      {bars.map((height, index) => (
        <span
          key={`${height}-${index}`}
          className={cn(
            "block w-full origin-bottom rounded-[1px] bg-signal-green shadow-[0_0_10px_rgba(119,255,121,0.4)]",
            active && "animate-equalize",
          )}
          style={{
            height: `${height}%`,
            animationDelay: `${index * 70}ms`,
            animationDuration: `${820 + (index % 5) * 130}ms`,
          }}
        />
      ))}
    </div>
  );
}
