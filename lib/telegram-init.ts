// Этот файл принудительно инициализирует Telegram бота при импорте
// Импортируйте его в middleware.ts или в начале приложения

import './services/telegram.service';

// Экспортируем для явной инициализации
export { telegramService } from './services/telegram.service';
