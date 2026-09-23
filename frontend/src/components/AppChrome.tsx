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

const STEP_META = [
  {
    id: "city" as const,
    short: "Город",
    title: "Изучите город",
    hint: "Исходное состояние",
  },
  {
    id: "decisions" as const,
    short: "Решения",
    title: "Примите 5 решений",
    hint: "Бюджет и инициативы",
  },
  {
    id: "result" as const,
    short: "Результат",
    title: "Посмотрите последствия",
    hint: "Score и объяснение",
  },
];

export function StepNav({
  step,
  onSelect,
}: {
  step: "city" | "decisions" | "result";
  onSelect: (step: "city" | "decisions" | "result") => void;
}) {
  const currentIndex = STEP_META.findIndex((item) => item.id === step);

  return (
    <nav aria-label="Экраны симулятора" className="grid gap-2 sm:grid-cols-3">
      {STEP_META.map((item, index) => {
        const active = item.id === step;
        const completed = index < currentIndex;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            aria-current={active ? "step" : undefined}
            className={`rounded-2xl px-4 py-3 text-left transition-colors ${
              active
                ? "bg-[#174f43] text-white"
                : completed
                  ? "bg-[#e7f2ec] text-[#174f43] ring-1 ring-[#c5d9cf]"
                  : "bg-white text-[#5c6e64] ring-1 ring-[#d5dcd5] hover:bg-[#eef3ef]"
            }`}
          >
            <p className="text-xs font-bold tracking-wide">
              {completed ? "Готово" : `${index + 1}`} · {item.short}
            </p>
            <p className={`mt-1 text-sm font-semibold ${active ? "text-white" : ""}`}>
              {item.title}
            </p>
            <p className={`mt-1 text-xs ${active ? "text-white/80" : "text-[#6c7b73]"}`}>
              {item.hint}
            </p>
          </button>
        );
      })}
    </nav>
  );
}
