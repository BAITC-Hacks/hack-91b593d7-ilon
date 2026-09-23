# Этап 8 — часть B (после merge Codex / этап 6)

Выполнить **только когда** в репозитории есть `frontend/src/components/CouncilPanel.tsx` и слот `data-stage="council-slot"` заменён на `<CouncilPanel />`.

## Чеклист

1. [ ] Обновить корневой [README.md](../README.md): same-origin proxy `/api/council/stream`, шаг «Слушать совет» в описании Result.
2. [ ] E2E: Result → запуск совета → видна хотя бы одна review-реплика в режиме `demo`; Score (`score-after`) остаётся при ошибке AI (если Codex не добавил тест сам).
3. [ ] Пройти [DEMO_SCRIPT.md](DEMO_SCRIPT.md) **три раза подряд** из чистого `docker compose up --build`.
4. [ ] Отметить DoD в [ROADMAP.md](ROADMAP.md) (этап 8 полностью готов).
5. [ ] Заморозка: до защиты только багфиксы; этап 9 не начинать.

## Быстрая проверка API (уже зелёная без UI)

```bash
curl -sN -X POST http://127.0.0.1:8000/api/v1/council/stream \
  -H 'Content-Type: application/json' \
  --data-binary @backend/examples/scenario.json | head
```

Ожидаются строки NDJSON с `simulation` / `mode` / `review` / `reply` / `done`.
