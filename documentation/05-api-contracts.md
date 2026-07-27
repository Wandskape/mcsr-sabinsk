# API-контракты

## 1. Общие правила

- Base path: `/api/v1`.
- Формат: JSON UTF-8.
- Даты: ISO 8601 UTC.
- Времена прохождения: integer milliseconds.
- Ranked match ID: string.
- Внутренние ID: UUID string.
- Пагинация списков администратора: cursor-based.
- OpenAPI backend является машинно-проверяемой версией этого документа.

## 2. Формат ответа

### Успех

```json
{
  "data": {},
  "meta": {
    "requestId": "req_..."
  }
}
```

### Ошибка

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Проверьте введённые данные.",
    "details": {
      "field": "startsAt"
    },
    "requestId": "req_..."
  }
}
```

Стандартные статусы:

- `400` — невалидная команда;
- `401` — нет сессии;
- `403` — операция запрещена состоянием;
- `404` — сущность не найдена;
- `409` — конфликт версии или уникальности;
- `422` — Ranked payload валиден технически, но непригоден для турнира;
- `429` — rate limit;
- `502` — Ranked API недоступен или вернул ошибку;
- `503` — временная проблема инфраструктуры.

## 3. Авторизация

Сессия хранится в `HttpOnly`, `Secure`, `SameSite=Strict` cookie.

### `POST /auth/login`

Request:

```json
{
  "username": "admin",
  "password": "..."
}
```

Response `200`:

```json
{
  "data": {
    "admin": {
      "id": "uuid",
      "username": "admin"
    },
    "expiresAt": "2026-08-01T12:00:00.000Z"
  }
}
```

### `POST /auth/logout`

Отзывает текущую сессию.

### `GET /auth/me`

Возвращает текущего администратора либо `401`.

## 4. Публичные endpoints

### `GET /tournaments`

Query:

- `status` — опциональный повторяемый фильтр;
- `cursor`;
- `limit`, default 20, max 100.

Черновики никогда не возвращаются.

Элемент:

```json
{
  "id": "uuid",
  "name": "Кубок Сабинска #1",
  "slug": "kubok-sabinska-1",
  "description": "...",
  "startsAt": "2026-08-10T15:00:00.000Z",
  "endsAt": "2026-08-17T18:00:00.000Z",
  "status": "QUALIFICATION",
  "coverUrl": "https://...",
  "divisions": [
    {
      "id": "uuid",
      "type": "BEGINNER",
      "displayName": "Новички",
      "timeLimitMs": 3600000,
      "hasPublishedPlayoff": true
    }
  ]
}
```

### `GET /tournaments/default`

Возвращает турнир по правилу выбора:

1. активный;
2. ближайший предстоящий;
3. последний завершённый.

### `GET /tournaments/:slug`

Для `QUALIFICATION`, `PLAYOFF` и `COMPLETED` массив `divisions` содержит только дивизионы, зафиксированные как участвующие при старте квалификации. В `UPCOMING` доступны все три типа для предварительного просмотра составов.

Публичная карточка турнира и дивизионы.

### `GET /tournaments/:slug/divisions/:divisionType/standings`

Response:

```json
{
  "data": {
    "division": {
      "type": "BEGINNER",
      "displayName": "Новички",
      "timeLimitMs": 3600000
    },
    "standings": [
      {
        "rank": 1,
        "registrationId": "uuid",
        "participantUuid": "ranked-uuid",
        "nickname": "Player",
        "points": 45,
        "averageTimeMs": 712345,
        "playedMatches": 8,
        "dnfCount": 1,
        "missedCount": 0
      }
    ]
  }
}
```

### `GET /tournaments/:slug/divisions/:divisionType/matches`

Response element:

```json
{
  "id": "uuid",
  "matchNumber": 1,
  "rankedMatchId": "123456",
  "playedAt": "2026-08-10T15:00:00.000Z",
  "winner": {
    "registrationId": "uuid",
    "nickname": "Player"
  },
  "importVersion": 2
}
```

### `GET /qualification-matches/:matchId`

Возвращает только сохранённые данные активного импорта:

```json
{
  "data": {
    "id": "uuid",
    "matchNumber": 1,
    "rankedMatchId": "123456",
    "timeLimitMs": 900000,
    "results": [
      {
        "registrationId": "uuid",
        "participantUuid": "ranked-uuid",
        "nickname": "Player",
        "avatarUrl": "https://mc-heads.net/avatar/ranked-uuid/40",
        "status": "COMPLETED",
        "placement": 1,
        "timeMs": 514000,
        "effectiveTimeMs": 514000,
        "lastPhase": "FINISHED",
        "timeline": [
          {
            "phase": "OVERWORLD",
            "startMs": 0,
            "endMs": 35000
          }
        ]
      }
    ]
  }
}
```

### `GET /registrations/:registrationId/qualification`

Данные только выбранного турнира:

```json
{
  "data": {
    "rank": 1,
    "nickname": "Player",
    "participantUuid": "ranked-uuid",
    "points": 45,
    "averageTimeMs": 712345,
    "matches": [
      {
        "matchId": "uuid",
        "matchNumber": 1,
        "status": "COMPLETED",
        "placement": 1,
        "timeMs": 514000,
        "points": 12
      }
    ]
  }
}
```

### `GET /tournaments/:slug/divisions/:divisionType/playoff`

`404`, если опубликованной сетки нет.

Response:

```json
{
  "data": {
    "size": 8,
    "showThirdPlace": true,
    "rounds": [
      {
        "roundNumber": 1,
        "name": "Четвертьфиналы",
        "matches": [
          {
            "id": "uuid",
            "position": 1,
            "participant1": {
              "registrationId": "uuid",
              "nickname": "Player 1"
            },
            "participant2": {
              "registrationId": "uuid",
              "nickname": "Player 8"
            },
            "score1": 3,
            "score2": 1,
            "winnerRegistrationId": "uuid",
            "status": "COMPLETED"
          }
        ]
      }
    ],
    "thirdPlaceMatch": null
  }
}
```

## 5. Административные endpoints

Все endpoints ниже требуют сессию и CSRF-защиту.

### Турниры

- `POST /admin/tournaments`
- `GET /admin/tournaments`
- `GET /admin/tournaments/:id`
- `PATCH /admin/tournaments/:id`
- `DELETE /admin/tournaments/:id` — только чистый черновик
- `POST /admin/tournaments/:id/status`

Создание:

```json
{
  "name": "Кубок Сабинска #1",
  "slug": "kubok-sabinska-1",
  "description": "...",
  "startsAt": "2026-08-10T15:00:00.000Z",
  "endsAt": "2026-08-17T18:00:00.000Z",
  "divisionTimeLimitsMs": {
    "BEGINNER": 3600000,
    "EXPERIENCED": 1800000,
    "PRO": 900000
  }
}
```

Изменение статуса:

```json
{
  "status": "QUALIFICATION",
  "expectedVersion": 3
}
```

### Обложки

- `POST /admin/media/cover-upload`
- `POST /admin/tournaments/:id/cover`
- `DELETE /admin/tournaments/:id/cover`

### Участники и регистрации

- `POST /admin/ranked/resolve-user`
- `GET /admin/divisions/:divisionId/registrations`
- `POST /admin/divisions/:divisionId/registrations/preview`
- `POST /admin/divisions/:divisionId/registrations`
- `POST /admin/divisions/:divisionId/registrations/bulk`
- `PATCH /admin/registrations/:id`
- `DELETE /admin/registrations/:id`

Resolve:

```json
{
  "identifier": "nickname"
}
```

Bulk:

```json
{
  "nicknames": ["Player1", "Player2"],
  "expectedDivisionVersion": 2
}
```

Сначала те же `nicknames` отправляются на
`POST /admin/divisions/:divisionId/registrations/preview` без
`expectedDivisionVersion`. Preview возвращает для каждой строки статус
`READY`, `ALREADY_REGISTERED`, `CONFLICT`, `DUPLICATE_INPUT`, `NOT_FOUND` или
`ERROR`, подтверждённый ник, UUID и текущую версию дивизиона. Запись готовых
строк применяется одной транзакцией только после подтверждения.

Перемещение участника:

```json
{
  "targetDivisionId": "uuid",
  "expectedRegistrationVersion": 1,
  "expectedSourceDivisionVersion": 3,
  "expectedTargetDivisionVersion": 2
}
```

Удаление участника:

```json
{
  "expectedRegistrationVersion": 1,
  "expectedDivisionVersion": 3
}
```

Добавление, перемещение и удаление запрещены для дивизиона после первого
успешного импорта квалификационного матча.

### Квалификационные матчи

- `GET /admin/divisions/:divisionId/qualification-matches`
- `POST /admin/divisions/:divisionId/qualification-matches/import-preview`
- `POST /admin/divisions/:divisionId/qualification-matches/import`
- `POST /admin/qualification-matches/:matchId/reimport-preview`
- `POST /admin/qualification-matches/:matchId/reimport`
- `POST /admin/qualification-matches/:matchId/completed-correction`
- `GET /admin/qualification-matches/:matchId/imports`

Preview:

```json
{
  "rankedMatchId": "123456"
}
```

Preview response показывает:

- сопоставленных участников;
- пропустивших;
- проигнорированных;
- DNF;
- рассчитанные места и очки;
- предупреждения.

Обычный импорт:

```json
{
  "rankedMatchId": "123456",
  "previewToken": "short-lived-signed-token",
  "expectedDivisionVersion": 5
}
```

Коррекция завершённого:

```json
{
  "previewToken": "short-lived-signed-token",
  "confirm": true,
  "reason": "Ranked API исправил время участника Player1",
  "expectedMatchVersion": 3
}
```

### Плей-офф

- `POST /admin/divisions/:divisionId/playoff`
- `GET /admin/playoffs/:id`
- `PATCH /admin/playoffs/:id`
- `PUT /admin/playoffs/:id/seeds`
- `PATCH /admin/playoff-matches/:matchId`
- `POST /admin/playoffs/:id/publish`
- `POST /admin/playoffs/:id/unpublish`

Создание:

```json
{
  "size": 8,
  "showThirdPlace": true,
  "expectedDivisionVersion": 6
}
```

Обновление матча:

```json
{
  "participant1RegistrationId": "uuid",
  "participant2RegistrationId": "uuid",
  "score1": 3,
  "score2": 1,
  "winnerRegistrationId": "uuid",
  "status": "COMPLETED",
  "expectedVersion": 2
}
```

### Аудит

- `GET /admin/audit-logs`
- `GET /admin/audit-logs/:id`

Фильтры: admin, action, entity type, entity ID, date range.

## 6. Идемпотентность

- Операции импорта принимают `Idempotency-Key`.
- Повтор с тем же ключом и payload возвращает исходный ответ.
- Повтор с тем же ключом и другим payload возвращает `409`.
- PATCH использует `expectedVersion`.

## 7. Ranked API adapter

Используемые внешние endpoints:

- `GET https://api.mcsrranked.com/users/{identifier}`;
- `GET https://api.mcsrranked.com/matches/{match_id}`.

Backend:

- timeout 10 секунд;
- не более двух повторов для network/5xx;
- `429` не ретраится немедленно, учитывается `Retry-After`;
- ответ проходит runtime-валидацию;
- внутренний API не проксирует внешний payload публично;
- приватный Ranked API key не используется.
