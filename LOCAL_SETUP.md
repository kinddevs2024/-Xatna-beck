# Локальная настройка для разработки

## Шаг 1: Запуск бэкенда

```bash
cd backend-nextjs
npm install
npm run db:generate
npm run db:push
npm run dev
```

Бэкенд будет доступен на: `http://localhost:3000`

## Шаг 2: Настройка фронтенда

Файл `.env` уже создан во фронтенде с правильными настройками для локальной разработки:

```env
VITE_API_BASE_URL=http://localhost:3000/api
VITE_AUTH_BASE_URL=http://localhost:3000
VITE_SERVICES_BASE_URL=http://localhost:3000
VITE_BARBERS_BASE_URL=http://localhost:3000
VITE_BOOKINGS_BASE_URL=http://localhost:3000
VITE_SOCKET_IO_URL=http://localhost:3000
```

## Шаг 3: Запуск фронтенда

```bash
cd Xatna_Front
npm install
npm run dev
```

Фронтенд будет доступен на: `http://localhost:5173` (или другой порт, который укажет Vite)

## Проверка подключения

1. Убедитесь, что бэкенд запущен на `http://localhost:3000`
2. Убедитесь, что фронтенд запущен (обычно `http://localhost:5173`)
3. Откройте консоль браузера (F12) и проверьте, что запросы идут на `http://localhost:3000/api/*`

## Тестирование API

Проверьте, что API работает:

```bash
# Проверка доктора
curl http://localhost:3000/api/doctor

# Проверка бронирований (требует авторизации)
curl http://localhost:3000/api/bookings
```

## Если возникают проблемы с CORS

Если видите ошибки CORS в консоли браузера:

1. Убедитесь, что бэкенд запущен
2. Проверьте, что в `backend-nextjs/.env` есть `NODE_ENV=development`
3. Перезапустите бэкенд после изменения `.env`

## Для продакшена

Перед деплоем в продакшен:

1. Обновите `.env` во фронтенде с production URL
2. Обновите `FRONTEND_URL` в бэкенде `.env`
3. Убедитесь, что `NODE_ENV=production` в бэкенде
