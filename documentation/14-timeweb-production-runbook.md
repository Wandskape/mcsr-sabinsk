# Развёртывание на Timeweb Cloud

## Схема

Один облачный сервер запускает Caddy, frontend, backend, PostgreSQL и MinIO через
`compose.production.yaml`. Из интернета доступны только `80/tcp`, `443/tcp` и
`443/udp`. PostgreSQL и MinIO не публикуют служебные порты.

Caddy автоматически получает и продлевает TLS-сертификаты:

- `https://<домен>` — сайт и API;
- `https://media.<домен>` — публичные обложки.

## DNS

До запуска контейнеров создать записи для корневого домена и поддомена `media`:

| Имя | Тип | Значение |
| --- | --- | --- |
| `@` | `A` | IPv4 сервера |
| `@` | `AAAA` | IPv6 сервера |
| `media` | `A` | IPv4 сервера |
| `media` | `AAAA` | IPv6 сервера |

## Подготовка Ubuntu

Рекомендуется Ubuntu 24.04 LTS. В облачном firewall разрешить входящие
`22/tcp`, `80/tcp`, `443/tcp`, `443/udp`. Порт SSH по возможности ограничить
своим IP.

Установить Git и Docker Engine с Compose plugin по официальной инструкции Docker.
Затем:

```bash
git clone https://github.com/Wandskape/mcsr-sabinsk.git
cd mcsr-sabinsk
cp .env.production.example .env.production
nano .env.production
```

Заменить домен и все значения `replace-with-*`. Секреты можно создать командой:

```bash
openssl rand -base64 48
```

## Первый запуск

```bash
docker compose --env-file .env.production -f compose.production.yaml up -d postgres minio minio-init
docker compose --env-file .env.production -f compose.production.yaml build
docker compose --env-file .env.production -f compose.production.yaml run --rm backend pnpm prisma:deploy
docker compose --env-file .env.production -f compose.production.yaml run --rm backend node dist/cli/bootstrap-admin.js
docker compose --env-file .env.production -f compose.production.yaml up -d
```

После успешного создания администратора удалить `ADMIN_PASSWORD` из
`.env.production`. Проверить:

```bash
docker compose --env-file .env.production -f compose.production.yaml ps
curl -fsS https://<домен>/api/v1/health/ready
```

## Обновление

```bash
git pull --ff-only
docker compose --env-file .env.production -f compose.production.yaml build
docker compose --env-file .env.production -f compose.production.yaml run --rm backend pnpm prisma:deploy
docker compose --env-file .env.production -f compose.production.yaml up -d
```

Перед обновлением необходимо сделать резервную копию PostgreSQL и каталога MinIO.
Файл `.env.production` и Docker volumes не должны попадать в Git.
