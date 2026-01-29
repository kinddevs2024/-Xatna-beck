# Инструкция по настройке и запуску

## Шаг 1: Установка зависимостей

```bash
cd backend-nextjs
npm install
```

## Шаг 2: Настройка базы данных

1. Создайте базу данных PostgreSQL:
```sql
CREATE DATABASE doctor_appointment_db;
```

2. Скопируйте `.env.example` в `.env`:
```bash
cp .env.example .env
```

3. Заполните `.env` файл:
```env
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/doctor_appointment_db?schema=public"
JWT_SECRET=your_very_secure_secret_key_minimum_32_characters_long
JWT_EXPIRATION=7d
SUPER_ADMIN_USERNAME=super_admin
SUPER_ADMIN_PASSWORD=super_admin123
SUPER_ADMIN_NAME=Super Admin
SUPER_ADMIN_PHONE=+998900000000
FRONTEND_URL=https://xatna-markasi-n1.uz
NODE_ENV=development
```

## Шаг 3: Инициализация базы данных

```bash
# Сгенерировать Prisma Client
npm run db:generate

# Применить схему к базе данных
npm run db:push
```

## Шаг 4: Инициализация пользователей

После запуска сервера, отправьте POST запрос на `/api/init` или просто сделайте любой API запрос - база данных инициализируется автоматически.

Или вручную:
```bash
curl -X POST http://localhost:3000/api/init
```

## Шаг 5: Запуск

```bash
# Development
npm run dev

# Production
npm run build
npm run start
```

## Проверка работы

1. Проверьте, что сервер запустился: `http://localhost:3000`
2. Проверьте Swagger (если добавлен) или просто сделайте тестовый запрос:
```bash
curl http://localhost:3000/api/doctor
```

## Подключение фронтенда

В файле `Xatna_Front/src/data/api.js` измените:
```javascript
export const BASE_URL = "http://localhost:3000"; // или ваш production URL
```

Или используйте переменные окружения:
```env
VITE_API_BASE_URL=http://localhost:3000/api
VITE_AUTH_BASE_URL=http://localhost:3000
VITE_BOOKINGS_BASE_URL=http://localhost:3000
VITE_BARBERS_BASE_URL=http://localhost:3000
```

## Важные замечания

1. **Фиксированные 30 минут**: Все бронирования длятся ровно 30 минут
2. **Один доктор**: Система автоматически использует первого созданного доктора
3. **Совместимость**: API принимает `barber_id` и `service_ids` для совместимости, но `service_ids` игнорируется
4. **CORS**: Настроен для домена `xatna-markasi-n1.uz`
