export function AppHeader({ eyebrow }: { eyebrow?: string }) {
  return (
    <header className="flex items-center justify-between border-b border-[#d5dcd5] pb-6">
      <div className="flex items-center gap-3">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#174f43] text-lg font-bold text-white"
          aria-hidden="true"
        >
          А
        </span>
        <div>
          <p className="text-lg font-bold tracking-tight">AQYL</p>
          {eyebrow ? (
            <p className="text-xs font-semibold tracking-[0.14em] text-[#417463]">{eyebrow}</p>
          ) : null}
        </div>
      </div>
      <span className="text-xs font-semibold tracking-[0.18em] text-[#62736b]">КОМАНДА ILON</span>
    </header>
  );
}

export function StepNav({
  step,
  onSelect,
}: {
  step: "city" | "decisions" | "result";
  onSelect: (step: "city" | "decisions" | "result") => void;
}) {
  const items = [
    { id: "city" as const, label: "Город" },
    { id: "decisions" as const, label: "Решения" },
    { id: "result" as const, label: "Результат" },
  ];

  return (
    <nav aria-label="Этапы симулятора" className="flex flex-wrap gap-2">
      {items.map((item, index) => {
        const active = item.id === step;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              active
                ? "bg-[#174f43] text-white"
                : "bg-white text-[#5c6e64] ring-1 ring-[#d5dcd5] hover:bg-[#eef3ef]"
            }`}
          >
            {index + 1}. {item.label}
          </button>
        );
      })}
    </nav>
  );
}
