# Backend AQYL

FastAPI обслуживает официальный учебный датасет и один расчётный движок. Все команды видят одинаковые исходные данные и бюджет 100. Пять решений проверяются на сервере до расчёта и до вызова AI. В каталоге есть контрольный сценарий.

## Запуск

Понадобятся Python 3.12 и [uv](https://docs.astral.sh/uv/getting-started/installation/). Из каталога `backend/`:

```bash
uv venv --python 3.12 .venv
uv pip sync --python .venv/bin/python requirements-dev.txt
AI_PROVIDER=demo .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Режим `demo` работает без ключа модели. После запуска доступны [описание API](http://127.0.0.1:8000/docs) и [проверка работоспособности](http://127.0.0.1:8000/health). Команды для второго терминала также выполняются из `backend/`:

```bash
curl -s http://127.0.0.1:8000/api/v1/catalog
curl -s -X POST http://127.0.0.1:8000/api/v1/simulate \
  -H 'Content-Type: application/json' \
  --data-binary @examples/scenario.json
curl -s -X POST http://127.0.0.1:8000/api/v1/challenge \
  -H 'Content-Type: application/json' \
  --data-binary @examples/scenario.json
curl -sN -X POST http://127.0.0.1:8000/api/v1/council/stream \
  -H 'Content-Type: application/json' \
  --data-binary @examples/scenario.json
```

`POST /api/v1/challenge` ищет лучшую **одну** замену среди допустимых планов тем же валидатором и движком (не глобальный оптимум). Для контрольного сценария ожидается замена M5 Сарыарка → M3 Нура.

`POST /api/v1/council/stream` возвращает NDJSON: сначала готовый расчёт, затем режим AI, мнения трёх ролей, ответы друг другу и завершение. Если провайдер не ответил, поток содержит явное событие `error`; вычисленный Score остаётся доступен.

Для реального совета скопируйте `../.env.example` в `../.env`, установите `AI_PROVIDER=openai`, `OPENAI_API_KEY` и доступную вашей учётной записи модель `OPENAI_MODEL`, после чего запустите ту же команду `uvicorn` без префикса `AI_PROVIDER=demo`. Файл `.env` исключён из Git. Режим с реальной моделью потребляет шесть запросов на один совет; он требует доступа к OpenAI API и в рамках этой версии не проверялся с пользовательским ключом.

## Контракт сценария

Пример [scenario.json](examples/scenario.json):

```json
{
  "decisions": [
    {"intervention_id": "M7", "district_id": "nura"},
    {"intervention_id": "M8", "district_id": "nura"},
    {"intervention_id": "M10", "district_id": "nura"},
    {"intervention_id": "M12"},
    {"intervention_id": "M5", "district_id": "saryarka"}
  ]
}
```

Для районной меры `district_id` обязателен, для городской его следует опустить или передать `null`. Цена, направление и эффект берутся из [city.v2.json](data/city.v2.json); клиент не может передать их в запросе. Старые идентификаторы и произвольные суммы не поддерживаются. Ровно пять различных мер, максимум две одного направления, действительный район, суммарная стоимость не выше 100 и отсутствие конфликтов обязательны. Охват всех пяти направлений не обязателен. Неверный итоговый сценарий получает HTTP 422 с причиной, без Score и без обращения к AI.

### Предварительный расчёт для интерфейса

`POST /api/v1/preview` принимает тот же формат решения и массив `decisions` длиной от 0 до 5. Проверка правил и предварительный расчёт объединены в этом маршруте; отдельного `/validate` нет. Для структурно корректного запроса, в том числе с шестью решениями или нарушениями игровых правил, HTTP-статус всегда **200**. `valid` показывает допустимость текущего набора, `complete` становится `true` только при пяти допустимых решениях. Примеры последовательных запросов:

```bash
# 0 решений — базовый Score 52.55768, расходы 0, valid=true, complete=false.
curl -s -X POST http://127.0.0.1:8000/api/v1/preview \
  -H 'Content-Type: application/json' \
  -d '{"decisions":[]}'

# 3 решения — предварительный Score 55.86166, расходы 56, остаток 44.
curl -s -X POST http://127.0.0.1:8000/api/v1/preview \
  -H 'Content-Type: application/json' \
  -d '{"decisions":[{"intervention_id":"M7","district_id":"nura"},{"intervention_id":"M8","district_id":"nura"},{"intervention_id":"M10","district_id":"nura"}]}'

# 5 решений — valid=true, complete=true, Score 56.54307.
curl -s -X POST http://127.0.0.1:8000/api/v1/preview \
  -H 'Content-Type: application/json' \
  --data-binary @examples/scenario.json

# Недопустимый набор — HTTP 200, valid=false, ошибка budget, расходы 101.
curl -s -X POST http://127.0.0.1:8000/api/v1/preview \
  -H 'Content-Type: application/json' \
  -d '{"decisions":[{"intervention_id":"M3","district_id":"nura"},{"intervention_id":"M5","district_id":"saryarka"},{"intervention_id":"M8","district_id":"nura"},{"intervention_id":"M10","district_id":"nura"},{"intervention_id":"M12"}]}'
```

Поля ответа `preview`: `dataset_version`, `engine_version`, `scenario_id`, `budget`, `spent`, `remaining`, `valid`, `complete`, `errors`, `score_before`, `score_after`, `score_delta`, `city_before`, `city_after`, `breakdown_before`, `breakdown_after`, `districts`, `applied_interventions`, `applied_synergies`, `warnings`. Каждый элемент `errors` имеет `code`, `message` и необязательный `intervention_id` (может быть `null`). В `breakdown_before.critical_indicators` и `breakdown_after.critical_indicators` находятся критические пары «район × показатель»; `applied_synergies` содержит сработавшие синергии. При допустимом частичном наборе показатели и Score уже рассчитаны, но сценарий ещё не завершён. Ноль решений возвращает базу без предупреждения о неизменившихся районах.

При нарушении правил `preview` возвращает список причин: `count`, `duplicate`, `intervention`, `district`, `scope`, `directions`, `budget`, `incompatibility`. `spent` суммирует цены всех известных мер в запросе, в том числе повторяющихся; неизвестные ID не добавляют стоимость. `remaining = budget − spent` может быть отрицательным. `score_before`, `city_before` и `breakdown_before` показывают базу; `scenario_id`, поля Score/показателей/разбивки «после» равны `null`, а `districts`, `applied_interventions`, `applied_synergies` и `warnings` пусты. Неверная структура JSON получает 422 с `{"detail":"...","code":"invalid_request"}`.

`GET /api/v1/catalog` возвращает каталог, правила, базовое состояние и готовый пример. `POST /api/v1/simulate` возвращает бюджет, расходы, остаток, Score до/после и прирост, десять показателей каждого района до/после, их изменения, оценки районов, среднее по долям населения, слабейшие районы при равенстве, критические пары «район × показатель», реализованные эффекты мер и сработавшие синергии. Формат итогового `Simulation` сохранён. При пяти допустимых решениях все общие поля `preview` и `/simulate` совпадают. `scenario_id` зависит от данных и канонически отсортированных решений; `dataset_version` и `engine_version` позволяют определить версию расчёта. Порядок решений не меняет результат и ID. Неполный или недопустимый итоговый запрос получает 422 с `detail` и `code`. Совет экспертов также принимает только полный сценарий.

Эффект меры = полный эффект × `(8 − лаг) / 8`; синергия добавляется один раз без уменьшения за лаг. После суммирования показатели ограничиваются диапазоном 0–100. Критическим считается значение строго ниже 40. Итоговый Score не ограничивается диапазоном 0–100, не получает бонуса за остаток и внутри рассчитывается через `Decimal` без промежуточного округления. JSON содержит числа, а округление для отображения относится к будущему интерфейсу. Базовое состояние рассчитывается отдельно; пустой пользовательский сценарий не допускается.

Контроль: база **52,55768**; [пример](examples/scenario.json) — расходы **95**, остаток **5**, Score **56,54307**, прирост **3,98539**. Детали формулы и контрольные значения: [DATASET_AND_RULES.md](../docs/DATASET_AND_RULES.md).

## Проверка

Из каталога `backend/`:

```bash
.venv/bin/python -m pytest -q
.venv/bin/ruff check app tests
.venv/bin/ruff format --check app tests
```

Тесты покрывают эталонные значения, правила бюджета и конфликтов, лаги, синергии, порог штрафа, точность, порядок решений, запрет изменения датасета, предварительные наборы от нуля до пяти решений, ошибки API и демонстрационный поток Council View.
