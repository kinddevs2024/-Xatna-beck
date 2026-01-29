# Doctor Appointment Booking API (Next.js)

Backend API для системы записи к доктору с фиксированными 30-минутными слотами на Next.js.

## Особенности

- ✅ Next.js 14 с App Router
- ✅ Prisma ORM для работы с PostgreSQL
- ✅ Фиксированные 30-минутные слоты для каждого приема
- ✅ Работа с одним доктором (автоматически создается при инициализации)
- ✅ JWT аутентификация
- ✅ CORS настроен для домена `xatna-markasi-n1.uz`
- ✅ TypeScript
- ✅ Полная совместимость с фронтендом

## Установка

```bash
npm install
```

## Настройка

1. Скопируйте `.env.example` в `.env`
2. Заполните переменные окружения:
   - `DATABASE_URL` - строка подключения к PostgreSQL (например: `postgresql://postgres:password@localhost:5432/doctor_appointment_db?schema=public`)
   - `JWT_SECRET` - секретный ключ для JWT (минимум 32 символа)
   - `JWT_EXPIRATION` - срок действия токена (например, `7d`)
   - `SUPER_ADMIN_USERNAME`, `SUPER_ADMIN_PASSWORD` - учетные данные супер-админа
   - `FRONTEND_URL` - URL фронтенда (по умолчанию: `https://xatna-markasi-n1.uz`)

3. Инициализируйте базу данных:
```bash
# Сгенерировать Prisma Client
npm run db:generate

# Применить схему к базе данных
npm run db:push

# Инициализировать default пользователей (опционально, автоматически при первом запросе)
# POST запрос на /api/init
```

## Запуск

```bash
# Development
npm run dev

# Production
npm run build
npm run start
```

## API Endpoints

### Бронирование
- `POST /api/bookings` - Создать бронирование (публичный)
  - Принимает: `phone_number`, `barber_id` (или `doctor_id`), `service_ids` (игнорируется), `date`, `time`, `client_name`
  - Каждое бронирование длится 30 минут (фиксировано)
- `GET /api/bookings` - Получить все бронирования (требует авторизации)
- `GET /api/bookings/:id` - Получить бронирование по ID
- `PATCH /api/bookings/:id/status` - Изменить статус бронирования (только админ)
- `DELETE /api/bookings/:id` - Удалить бронирование (только админ)
- `GET /api/bookings/pending` - Получить все pending бронирования (только админ)
- `POST /api/bookings/statistics` - Получить статистику (только админ)
- `POST /api/bookings/admin/statistics` - Получить статистику (только админ, альтернативный путь)
- `GET /api/bookings/doctor` - Получить бронирования default доктора
- `GET /api/bookings/doctor/:doctorId` - Получить бронирования конкретного доктора
- `GET /api/bookings/barber` - Alias для /api/bookings/doctor (совместимость)
- `GET /api/bookings/comments` - Получить все бронирования с комментариями

### Пользователи
- `GET /api/users` - Получить всех пользователей (только админ)
- `GET /api/users/:id` - Получить пользователя по ID
- `PATCH /api/users/:id/role` - Изменить роль пользователя (только админ)
- `DELETE /api/users/:id` - Удалить пользователя (только админ)
- `GET /api/users/barbers` - Получить всех докторов (для совместимости с фронтендом)

### Доктор (Doctor)
- `GET /api/doctor` - Получить информацию о default докторе (публичный)
- `POST /api/doctor` - Создать доктора (только админ)
- `PATCH /api/doctor/:id` - Обновить доктора (только админ или сам доктор)
- `GET /api/barber` - Alias для /api/doctor (совместимость)
- `POST /api/barber` - Alias для /api/doctor (совместимость)
- `PATCH /api/barber/:id` - Alias для /api/doctor/:id (совместимость)

### Админ (Admin)
- `POST /api/admin` - Создать админа (только SUPER_ADMIN)
- `PATCH /api/admin/:id` - Обновить админа (только SUPER_ADMIN)

### Аутентификация
- `POST /api/auth/login` - Вход (только для админов)
  - Принимает: `tg_username`, `password`
  - Возвращает: `{ token, user }`

### Инициализация
- `POST /api/init` - Инициализировать базу данных (создать SUPER_ADMIN и DOCTOR)

## Структура проекта

```
app/
├── api/              # API routes
│   ├── auth/         # Аутентификация
│   ├── bookings/     # Бронирования
│   ├── users/        # Пользователи
│   ├── doctor/       # Доктор
│   ├── barber/       # Alias для doctor (совместимость)
│   └── admin/        # Админ
lib/
├── auth.ts           # JWT функции
├── db.ts             # Prisma client
├── cors.ts           # CORS функции
├── middleware.ts     # Middleware функции
└── services/         # Бизнес-логика
    ├── booking.service.ts
    └── user.service.ts
prisma/
└── schema.prisma     # Схема базы данных
types/
└── index.ts          # TypeScript типы
```

## База данных

Проект использует PostgreSQL с Prisma ORM. При первом запуске автоматически создается:
- SUPER_ADMIN пользователь
- Default DOCTOR пользователь

## Домен

Frontend URL: `https://xatna-markasi-n1.uz`

CORS настроен для работы с этим доменом в `next.config.js` и `lib/cors.ts`.

## Важные особенности

1. **Фиксированные 30 минут**: Каждое бронирование длится ровно 30 минут, независимо от параметров запроса
2. **Один доктор**: Система работает с одним default доктором, который создается автоматически
3. **Совместимость с фронтендом**: API принимает `barber_id` и `service_ids` для совместимости, но `service_ids` игнорируется
4. **Статусы бронирований**: Принимаются как строки в нижнем регистре ("approved", "rejected") и преобразуются в enum

## Примеры запросов

### Создать бронирование
```bash
curl -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "+998901234567",
    "barber_id": 1,
    "service_ids": [1],
    "date": "2025-01-27",
    "time": "14:00",
    "client_name": "John Doe"
  }'
```

### Войти
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "tg_username": "super_admin",
    "password": "super_admin123"
  }'
```

### Получить все бронирования
```bash
curl -X GET http://localhost:3000/api/bookings \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Изменить статус бронирования
```bash
curl -X PATCH http://localhost:3000/api/bookings/1/status \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved"
  }'
```

## Готовность к продакшену

✅ Все endpoints созданы и протестированы
✅ CORS настроен для домена xatna-markasi-n1.uz
✅ JWT аутентификация работает
✅ Фиксированные 30-минутные слоты реализованы
✅ Один доктор по умолчанию
✅ Совместимость с фронтендом обеспечена
