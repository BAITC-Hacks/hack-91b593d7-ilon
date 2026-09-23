# Этап 8 — часть B (AI-совет в UI)

Статус: **готово** (CouncilPanel на результате, proxy `/api/council/stream`, e2e).

## Чеклист

1. [x] README: proxy `/api/council/stream`, описание Result + совет  
2. [x] E2E `frontend/e2e/council.spec.ts`: demo-реплики; Score остаётся при ошибке AI  
3. [x] Скрипт защиты: [DEMO_SCRIPT.md](DEMO_SCRIPT.md)  
4. [x] DoD в [ROADMAP.md](ROADMAP.md)  
5. [x] Заморозка фич: до защиты только багфиксы / polish защиты  

## Быстрая проверка API

```bash
curl -sN -X POST http://127.0.0.1:8000/api/v1/council/stream \
  -H 'Content-Type: application/json' \
  --data-binary @backend/examples/scenario.json | head
```

Ожидаются NDJSON: `simulation` / `mode` / `review` / `reply` / `done`.
