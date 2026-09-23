# AQYL — «Аким на 5 часов»

Учебный AI-симулятор управления городом команды **ILON**. Пользователь распределяет общий бюджет **100 условных единиц**, выбирает **ровно пять** инициатив и видит, как они меняют показатели пяти условных районов Астаны.

Основной backend работает с синтетическим датасетом организаторов: **5 районов, 10 показателей, 14 мероприятий**. Цена каждой меры фиксирована. Движок учитывает лаг, районный или городской охват, синергии и несовместимости. Сервер отклоняет превышение бюджета и другие недопустимые сценарии до расчёта и до вызова AI.

Astana Quality of Life Score вычисляет детерминированный движок:

`Score = 0,7 × средняя оценка по населению + 0,3 × оценка слабейшего района − число показателей ниже 40`

AI и демонстрационный совет получают готовый расчёт и объясняют компромиссы. Их текст **не влияет** на Score. Данные относятся к учебной модели и не являются прогнозом реальных городских последствий. В интерфейсе говорим о «состоянии модельного города» и «правилах синтетической модели».

| Контрольный расчёт | База | Пример пяти решений | Одна замена (challenge) |
| --- | ---: | ---: | ---: |
| Расходы | 0 | 95 | 100 |
| Средняя оценка по населению | 56,8624 | 58,0776 | — |
| Оценка слабейшего района | 49,18 | 52,9625 | 54,9825 |
| Критических показателей | 2 | 0 | 0 |
| **Score** | **52,55768** | **56,54307** | **57,20556** |

Контрольный набор: M7/M8/M10 Нура, M12 город, M5 Сарыарка. Challenge находит замену **M5 Сарыарка → M3 Нура** (поиск ограничен одной заменой, не глобальный оптимум).

## Что уже работает в интерфейсе

После запуска открывается **игровой** сценарий из трёх экранов:

1. **Город** — базовый Score, критические пары, районы и схематическая карта.
2. **Решения** — карточки мер с фиксированными ценами, выбор района, счётчик `N/5`, бюджет, локальная и серверная проверка (`preview`).
3. **Результат** — Score до/после, районы, синергии, риски; кнопка **«Оспорить мой план»** (`challenge`).

Слот AI-совета экспертов (стрим `council`) подключается этапом 6; backend-маршрут уже есть.

Скрипт защиты 3–5 минут: [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md). После merge AI-совета: [docs/STAGE8_PART_B_CHECKLIST.md](docs/STAGE8_PART_B_CHECKLIST.md). План этапов: [docs/ROADMAP.md](docs/ROADMAP.md). Финальный бриф: [docs/DEVELOPER_HANDOFF.md](docs/DEVELOPER_HANDOFF.md).

## Запуск приложения

Нужны Git и запущенный Docker с Compose v2. Из корня репозитория:

```bash
docker compose up --build
```

Для демонстрационного режима `.env` и API-ключ не нужны. После запуска:

- приложение: http://localhost:3000
- документация API: http://localhost:8000/docs
- проверки: http://localhost:3000/health и http://localhost:8000/health

На главной странице должны появиться статус подключения, режим AI, версия датасета, пять районов, четырнадцать мероприятий и экран «Город».

Фоновый запуск с ожиданием готовности:

```bash
docker compose up --build --detach --wait --wait-timeout 120
docker compose ps
docker compose down
```

Если порты заняты: `WEB_PORT=3100 API_PORT=8100 docker compose up --build`. Внутреннее соединение контейнеров остаётся на `backend:8000`.

## Локальная разработка

Для backend нужен Python 3.12; для frontend — Node.js 24. Версии указаны в `.python-version` и `.nvmrc`. Backend, первый терминал:

```bash
cd backend
python3.12 -m venv .venv
.venv/bin/python -m pip install --require-hashes -r requirements-dev.txt
AI_PROVIDER=demo .venv/bin/python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Frontend, второй терминал:

```bash
cd frontend
npm ci
npm run dev
```

Next.js по умолчанию обращается к `http://127.0.0.1:8000`. Если адрес backend другой, укажите `API_INTERNAL_URL` в окружении команды `npm run dev` или в `frontend/.env.local`. Корневой `.env` используется backend и Compose, но не загружается Next.js автоматически. Для реального совета создайте корневой `.env` по `.env.example`, укажите `AI_PROVIDER=openai`, `OPENAI_API_KEY` и доступную вашему проекту модель `OPENAI_MODEL`. Ключ остаётся на сервере. Полный совет выполняет шесть запросов; работа с реальным ключом ещё не проверена.

## API и прокси frontend

Backend (подробности в [backend/README.md](backend/README.md)):

| Метод | Путь | Назначение |
| --- | --- | --- |
| `GET` | `/api/v1/catalog` | Каталог, baseline, default_scenario |
| `POST` | `/api/v1/preview` | 0…5 решений, бюджет и ошибки |
| `POST` | `/api/v1/simulate` | Ровно 5 допустимых → полный Score |
| `POST` | `/api/v1/challenge` | Одна лучшая допустимая замена |
| `POST` | `/api/v1/council/stream` | NDJSON-совет экспертов |

Frontend ходит на backend только через same-origin proxies: `/api/health`, `/api/catalog`, `/api/preview`, `/api/simulate`, `/api/challenge` (и `/api/council/stream` после этапа 6). Произвольный upstream URL не допускается. Если backend недоступен, страница показывает ошибку и кнопку повтора; Score не подменяется моками.

Пример контрольного расчёта:

```bash
curl -s -X POST http://127.0.0.1:8000/api/v1/simulate \
  -H 'Content-Type: application/json' \
  --data-binary @backend/examples/scenario.json
```

## Проверки

Из `backend/`: `.venv/bin/python -m pytest -q`, `.venv/bin/ruff check app tests`, `.venv/bin/ruff format --check app tests`.

Из `frontend/`: `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:e2e` (нужен поднятый стек или CI).

GitHub Actions запускает backend, frontend и интеграционные проверки (Compose + Playwright) при push в `main`.

Зависимости Python закреплены с SHA-256 хешами в `backend/requirements.txt` и `backend/requirements-dev.txt`; frontend использует `package-lock.json` и `npm ci`. Исходные данные и формула: [docs/DATASET_AND_RULES.md](docs/DATASET_AND_RULES.md). Прежняя модель сохранена в [docs/BACKEND_PROTOTYPE.md](docs/BACKEND_PROTOTYPE.md).
