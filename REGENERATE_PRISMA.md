# ⚠️ ВАЖНО: Перегенерировать Prisma Client

После добавления модели Service в schema.prisma нужно перегенерировать Prisma Client.

## Инструкция:

1. **Остановите сервер** (Ctrl+C в терминале где запущен `npm run dev`)

2. **Перегенерируйте Prisma Client:**
   ```bash
   cd backend-nextjs
   npx prisma generate
   ```

3. **Запустите сервер снова:**
   ```bash
   npm run dev
   ```

После этого модель Service будет доступна и ошибка исчезнет.
