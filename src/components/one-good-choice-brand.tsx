import React from "react";

export function OneGoodChoiceBrand({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3" data-testid="one-good-choice-brand">
      <span
        aria-hidden="true"
        className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-control bg-care text-white shadow-[0_0_0_1px_rgba(0,51,160,0.18)]"
      >
        <span className="text-[2rem] font-black leading-none tracking-[-0.08em]">1</span>
        <span className="absolute bottom-1 right-1 grid h-4 w-4 place-items-center rounded-full bg-white text-[0.7rem] font-black leading-none text-care">
          ✓
        </span>
      </span>
      <div>
        <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-care">
          Food Compass
        </p>
        <h1 className="text-2xl font-black lowercase tracking-[-0.035em] text-ink">{title}</h1>
      </div>
    </div>
  );
}
