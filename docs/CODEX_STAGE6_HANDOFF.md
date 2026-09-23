# Codex — этап 6: AI-совет в интерфейсе

Скопируйте этот файл целиком в задачу Codex. Параллельно другой разработчик делает **этап 7 (challenge)**. Ниже жёсткие границы, чтобы не было merge-конфликтов.

## Цель этапа 6

Подключить уже готовый backend `POST /api/v1/council/stream` к экрану результата: стрим NDJSON, три роли (урбанист / финдиректор / житель), два раунда, ошибка AI не прячет Score.

## ВАМ МОЖНО трогать только

| Файл | Действие |
| --- | --- |
| `frontend/src/app/api/council/stream/route.ts` | **создать** — proxy на `/api/v1/council/stream`, без произвольного upstream |
| `frontend/src/components/CouncilPanel.tsx` | **создать** — UI стрима (кнопка, loading, reviews, replies, error) |
| `frontend/src/lib/contracts.ts` | **добавить только** типы событий council (не трогать Challenge*) |
| `frontend/src/lib/backend.ts` | **добавить** отдельную функцию `proxyBackendStream(...)` для NDJSON; **не менять** сигнатуру `proxyBackendPost` кроме расширения union path, если нужно — лучше отдельная функция |
| `frontend/src/components/ResultScreen.tsx` | **только** заменить блок с `data-stage="council-slot"` на `<CouncilPanel />` |
| `frontend/e2e/` | опционально smoke на появление реплик в demo-режиме |

При необходимости локального состояния council — держите его **внутри `CouncilPanel`**. Не раздувайте `SimulatorProvider`, если можно обойтись `useSimulator().decisions` / `simulation`.

## ВАМ ЗАПРЕЩЕНО трогать (этап 7 / чужая зона)

- `backend/app/challenge.py`, `backend/tests/test_challenge.py`
- `frontend/src/components/ChallengePanel.tsx`
- `frontend/src/app/api/challenge/**`
- любые `Challenge*` типы/схемы в `backend/app/schemas.py`
- маршрут `/api/v1/challenge` в `backend/app/main.py`
- логику выбора решений: `DecisionsScreen`, `CityScreen`, `scenario.ts`, `DistrictMap*`
- не рефакторить `SimulatorProvider` «заодно»
- не менять `engine.py`, формулу Score, датасет
- не добавлять UrbanLens / challenge / Shapley

Если `ResultScreen` уже содержит `<ChallengePanel />` — **оставьте его**, работайте только со слотом council.

## Контракт stream (уже есть на backend)

`POST /api/v1/council/stream` с телом `{ "decisions": [ ... ровно 5 ... ] }`.

Ответ: `application/x-ndjson`, по строке JSON. Типичные события:

- `{"type":"simulation", ...}` — полный расчёт (Score уже есть на экране; можно игнорировать или сверить)
- `{"type":"mode","ai_mode":"demo"|"openai"}`
- `{"type":"review","role","name","opinion":{summary,strengths,risks,recommendations}}`
- `{"type":"reply","role","name","reply":{reply_to,stance,argument,recommendation}}`
- `{"type":"done"}` или `{"type":"error","message":"..."}`

422 на невалидный сценарий — показать человеку `detail`, Score с предыдущего simulate не стирать.

## UX

1. На Result после успешного simulate: кнопка **«Слушать совет»** (не автозапуск обязателен).
2. Реплики появляются по мере чтения stream.
3. Режим `demo` явно подписать: «Программная демонстрация» / не выдавать за живую модель.
4. При `error` — alert, математический блок Score остаётся.
5. Язык: модельный город, без «решили проблемы Астаны».

## Backend

**Не менять.** Council уже в `backend/app/council.py` и `main.py`. Только frontend.

## Приёмка

- `npm run lint && npm run typecheck && npm run build` в `frontend/`
- Контрольный сценарий (кнопка примера) → Result → совет стримится в demo
- Обрыв/ошибка AI не убирает Score
- Diff не содержит файлов этапа 7 из чёрного списка

## Коммит

Отдельный commit, например: `feat: stream AI council into result screen`.
