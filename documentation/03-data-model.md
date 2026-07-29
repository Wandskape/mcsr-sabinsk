# Модель данных

## 1. Общие правила

- Идентификаторы внутренних сущностей — UUID.
- Ranked UUID хранится без дефисов в каноническом lowercase-виде.
- Все таблицы имеют `createdAt` и `updatedAt`, если явно не указано иное.
- Редактируемые агрегаты имеют `version` для optimistic locking.
- Физическое удаление исторических турнирных данных запрещено через штатную админ-панель.

## 2. Перечисления

### `TournamentStatus`

```text
DRAFT
UPCOMING
QUALIFICATION
PLAYOFF
COMPLETED
```

### `DivisionType`

```text
BEGINNER
EXPERIENCED
PRO
```

### `QualificationResultStatus`

```text
COMPLETED
DNF
MISSED
```

### `ImportStatus`

```text
PENDING
APPLIED
FAILED
SUPERSEDED
```

### `PlayoffMatchKind`

```text
MAIN
THIRD_PLACE
```

### `PlayoffMatchStatus`

```text
EMPTY
READY
COMPLETED
```

## 3. Сущности

### `AdminUser`

| Поле | Тип | Ограничения |
|---|---|---|
| `id` | UUID | PK |
| `username` | string | unique, case-insensitive |
| `passwordHash` | string | Argon2id |
| `isActive` | boolean | default true |
| `passwordChangedAt` | timestamptz | required |
| `lastLoginAt` | timestamptz? | nullable |
| `failedLoginCount` | int | default 0 |
| `lockedUntil` | timestamptz? | nullable |

Публичной регистрации администратора нет.

### `AdminSession`

| Поле | Тип | Ограничения |
|---|---|---|
| `id` | UUID | PK |
| `adminUserId` | UUID | FK |
| `tokenHash` | string | unique |
| `expiresAt` | timestamptz | required |
| `lastSeenAt` | timestamptz | required |
| `ipHash` | string? | nullable |
| `userAgent` | string? | ограниченная длина |
| `revokedAt` | timestamptz? | nullable |

### `Tournament`

| Поле | Тип | Ограничения |
|---|---|---|
| `id` | UUID | PK |
| `name` | string | 1–120 |
| `slug` | string | unique, `^[a-z0-9-]+$` |
| `description` | text | 0–10000 |
| `startsAt` | timestamptz | required |
| `endsAt` | timestamptz | позже `startsAt` |
| `status` | TournamentStatus | required |
| `coverObjectKey` | string? | nullable |
| `coverUrl` | string? | nullable |
| `version` | int | default 1 |
| `completedAt` | timestamptz? | nullable |

При создании турнира backend автоматически создаёт три `Division`.

### `Division`

| Поле | Тип | Ограничения |
|---|---|---|
| `id` | UUID | PK |
| `tournamentId` | UUID | FK |
| `type` | DivisionType | unique с `tournamentId` |
| `displayName` | string | фиксированное русское имя |
| `timeLimitMs` | int | > 0 |
| `sortOrder` | int | 1, 2, 3 |
| `isParticipating` | boolean | фиксируется при старте квалификации, default false |
| `version` | int | default 1 |

### `Participant`

| Поле | Тип | Ограничения |
|---|---|---|
| `id` | UUID | PK |
| `rankedUuid` | string | unique, 32 hex |
| `currentNickname` | string | 1–32 |
| `nicknameLower` | string | индекс |
| `lastRankedSyncAt` | timestamptz | required |
| `rankedProfileSnapshot` | jsonb | минимальный публичный профиль |

### `TournamentRegistration`

| Поле | Тип | Ограничения |
|---|---|---|
| `id` | UUID | PK |
| `tournamentId` | UUID | FK |
| `divisionId` | UUID | FK |
| `participantId` | UUID | FK |
| `nicknameSnapshot` | string | снимок для истории |
| `qualificationPoints` | int | кеш, default 0 |
| `averageTimeMs` | int? | кеш |
| `playedMatches` | int | кеш, default 0 |
| `dnfCount` | int | кеш, default 0 |
| `missedCount` | int | кеш, default 0 |
| `version` | int | default 1 |

Ограничения:

- unique (`tournamentId`, `participantId`);
- регистрация обязана ссылаться на дивизион того же турнира;
- кеши пересчитываются backend из активных `QualificationResult`.

### `QualificationMatch`

| Поле | Тип | Ограничения |
|---|---|---|
| `id` | UUID | PK |
| `divisionId` | UUID | FK |
| `matchNumber` | int | > 0, unique с `divisionId` |
| `rankedMatchId` | bigint/string | global unique |
| `completionLimit` | int? | 4, 6, 8, 10 или 12; null только для legacy |
| `rankedPlayedAt` | timestamptz? | из API |
| `winnerRegistrationId` | UUID? | FK |
| `activeImportId` | UUID? | FK |
| `version` | int | default 1 |

`rankedMatchId` передаётся наружу строкой, чтобы не зависеть от ограничений JavaScript integer.

### `QualificationMatchImport`

| Поле | Тип | Ограничения |
|---|---|---|
| `id` | UUID | PK |
| `qualificationMatchId` | UUID | FK |
| `importVersion` | int | unique с матчем |
| `completionLimit` | int? | снимок правила этой версии; null только для legacy |
| `seedType` | varchar(32)? | нормализованный тип мира из Ranked API |
| `bastionType` | varchar(32)? | нормализованный тип бастиона из Ranked API |
| `status` | ImportStatus | required |
| `rawPayload` | jsonb | полный ответ Ranked API |
| `payloadHash` | string | SHA-256 |
| `rankedFetchedAt` | timestamptz | required |
| `initiatedByAdminId` | UUID | FK |
| `correctionReason` | text? | обязательно после завершения |
| `errorCode` | string? | для FAILED |
| `errorMessage` | text? | безопасное описание |
| `appliedAt` | timestamptz? | nullable |

### `QualificationResult`

| Поле | Тип | Ограничения |
|---|---|---|
| `id` | UUID | PK |
| `qualificationMatchId` | UUID | FK |
| `registrationId` | UUID | FK |
| `importId` | UUID | FK |
| `status` | QualificationResultStatus | required |
| `placement` | int? | только COMPLETED |
| `rawTimeMs` | int? | фактическое время или null |
| `effectiveTimeMs` | int | raw для COMPLETED, лимит для DNF/MISSED |
| `points` | int | >= 0 |
| `lastPhase` | string? | nullable |
| `timeline` | jsonb | массив нормализованных сегментов |

Ограничения:

- unique (`importId`, `registrationId`);
- active results определяются через `QualificationMatch.activeImportId`;
- DNF и MISSED имеют `placement = null`, `points = 0`;
- timeline MISSED является пустым массивом.

### `PlayoffBracket`

| Поле | Тип | Ограничения |
|---|---|---|
| `id` | UUID | PK |
| `divisionId` | UUID | unique FK |
| `size` | int | 4, 8 или 16 |
| `showThirdPlace` | boolean | default false |
| `isPublished` | boolean | default false |
| `version` | int | default 1 |

### `PlayoffSeed`

| Поле | Тип | Ограничения |
|---|---|---|
| `id` | UUID | PK |
| `bracketId` | UUID | FK |
| `seedNumber` | int | 1..size |
| `registrationId` | UUID? | FK |

Ограничения:

- unique (`bracketId`, `seedNumber`);
- unique (`bracketId`, `registrationId`) для ненулевого участника;
- участник должен принадлежать дивизиону сетки.

### `PlayoffMatch`

| Поле | Тип | Ограничения |
|---|---|---|
| `id` | UUID | PK |
| `bracketId` | UUID | FK |
| `kind` | PlayoffMatchKind | MAIN или THIRD_PLACE |
| `roundNumber` | int | 1 — первый раунд |
| `position` | int | позиция внутри раунда |
| `participant1RegistrationId` | UUID? | FK |
| `participant2RegistrationId` | UUID? | FK |
| `score1` | int? | >= 0 |
| `score2` | int? | >= 0 |
| `winnerRegistrationId` | UUID? | FK |
| `status` | PlayoffMatchStatus | required |
| `version` | int | default 1 |

Ограничения:

- unique (`bracketId`, `kind`, `roundNumber`, `position`);
- winner обязан быть одним из двух участников;
- при равном счёте winner должен быть null;
- состав `PlayoffSeed` фиксирует top-N квалификации на момент создания сетки;
- backend автоматически переносит winner в связанную позицию следующего раунда;
- проигравшие полуфиналов автоматически попадают в матч за третье место;
- изменение раннего результата сбрасывает затронутые последующие результаты.

### `AuditLog`

| Поле | Тип | Ограничения |
|---|---|---|
| `id` | UUID | PK |
| `adminUserId` | UUID | FK |
| `action` | string | индекс |
| `entityType` | string | индекс |
| `entityId` | UUID/string | индекс |
| `before` | jsonb? | безопасный снимок |
| `after` | jsonb? | безопасный снимок |
| `reason` | text? | для коррекций |
| `requestId` | string | индекс |
| `ipHash` | string? | nullable |
| `createdAt` | timestamptz | индекс |

Пароль, hash сессии и полный raw Ranked payload в аудит не попадают.

`AuditLog.actorUsernameSnapshot` заполняется для восстановленных архивных
записей. Он позволяет сохранить исходного автора события без переноса его
учётной записи; для обычных событий интерфейс использует актуальное имя
связанного администратора.

`AnalyticsEvent` хранит тип просмотра, UUID публичного объекта и время не более
180 дней. `AnalyticsDailyMetric` хранит бессрочный дневной агрегат по типу
события. Идентификаторов посетителей и связей с пользователями в модели нет.

## 4. Связи

```text
Tournament 1 ── 3 Division
Tournament 1 ── * TournamentRegistration
Division   1 ── * TournamentRegistration
Participant 1 ── * TournamentRegistration

Division 1 ── * QualificationMatch
QualificationMatch 1 ── * QualificationMatchImport
QualificationMatchImport 1 ── * QualificationResult
TournamentRegistration 1 ── * QualificationResult

Division 1 ── 0..1 PlayoffBracket
PlayoffBracket 1 ── * PlayoffSeed
PlayoffBracket 1 ── * PlayoffMatch
```

## 5. Индексы

Обязательные индексы:

- `Tournament(status, startsAt)`;
- `Tournament(slug)`;
- `Division(tournamentId, sortOrder)`;
- `Participant(nicknameLower)`;
- `TournamentRegistration(divisionId, qualificationPoints)`;
- `QualificationMatch(divisionId, matchNumber)`;
- `QualificationMatch(rankedMatchId)`;
- `QualificationResult(registrationId)`;
- `QualificationMatchImport(qualificationMatchId, importVersion)`;
- `PlayoffMatch(bracketId, roundNumber, position)`;
- `AuditLog(createdAt)`;
- `AuditLog(entityType, entityId)`.

## 6. Удаление

- Черновик без импортов можно удалить после подтверждения.
- Турнир с импортированными матчами нельзя удалить; после завершения он остаётся историческим.
- Удаление регистрации после первого импорта запрещено; вместо этого исправляется состав с обязательным пересчётом и аудитом.
- Неактивные версии импорта сохраняются.
- Удаление администратора заменяется `isActive = false`.
