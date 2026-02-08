import TelegramBot from 'node-telegram-bot-api';
import { prisma } from '@/lib/db';
import { UserRole, BookingStatus } from '@/types';
import { BookingService } from './booking.service';

class TelegramService {
  private bot: TelegramBot | null = null;
  private botToken: string;
  private pollingStarted: boolean = false;
  private userStates: Map<number, any> = new Map(); // Хранение состояний пользователей
  private initializationPromise: Promise<void> | null = null;

  constructor() {
    this.botToken = process.env.BOT_TOKEN || '';
    // Не инициализируем бота в конструкторе, чтобы избежать проблем с Edge Runtime
    // Инициализация будет выполнена при первом использовании
  }

  /**
   * Check if bot is initialized
   */
  isInitialized(): boolean {
    const useWebhook = process.env.TELEGRAM_USE_WEBHOOK === 'true' || process.env.TELEGRAM_WEBHOOK_MODE === 'true';
    return !!this.bot && (this.pollingStarted || useWebhook);
  }

  /**
   * Ленивая инициализация бота (публичный метод для внешнего вызова)
   */
  async ensureInitialized() {
    // Если уже инициализирован, возвращаем
    const useWebhook = process.env.TELEGRAM_USE_WEBHOOK === 'true' || process.env.TELEGRAM_WEBHOOK_MODE === 'true';
    if (this.bot && (this.pollingStarted || useWebhook)) {
      return;
    }

    // Если инициализация уже идет, ждем её
    if (this.initializationPromise) {
      await this.initializationPromise;
      return;
    }

    // Начинаем инициализацию
    this.initializationPromise = this.initializeBot();
    await this.initializationPromise;
  }

  /**
   * Инициализация бота
   */
  private async initializeBot() {
    if (!this.botToken || this.botToken.trim() === '') {
      console.warn('⚠️ BOT_TOKEN not found in environment variables. Telegram notifications will be disabled.');
      return;
    }

    const useWebhookMode = process.env.TELEGRAM_USE_WEBHOOK === 'true' || process.env.TELEGRAM_WEBHOOK_MODE === 'true';

    try {
      if (this.bot && this.pollingStarted) {
        return;
      }

      console.log('🔄 Initializing Telegram Bot...');
      console.log(`[Telegram Bot] Token present: ${this.botToken.substring(0, 10)}...`);

      // Проверяем доступность Prisma (не в Edge Runtime)
      try {
        await prisma.$connect();
        await prisma.$disconnect();
      } catch (prismaError: any) {
        if (prismaError.message?.includes('Edge Runtime')) {
          console.warn('⚠️ Telegram Bot cannot be initialized in Edge Runtime');
          return;
        }
        throw prismaError;
      }

      if (useWebhookMode) {
        console.log('[Telegram Bot] Creating bot instance in webhook mode (no polling)');
        // Do not enable polling; webhook updates will be delivered to /api/telegram/webhook
        this.bot = new TelegramBot(this.botToken, { polling: false });
      } else {
        // Создаем бота с polling
        console.log('[Telegram Bot] Creating bot instance with polling...');
        this.bot = new TelegramBot(this.botToken, {
          polling: {
            interval: 1000,
            autoStart: false, // We'll start it manually to ensure it keeps running
            params: {
              timeout: 30,
              allowed_updates: ['message', 'callback_query']
            }
          }
        });
      }

      // Setup error handlers BEFORE starting polling
      this.bot.on('error', (error: any) => {
        console.error('[Telegram Bot] Error:', error?.message || error);
      });

      this.bot.on('polling_error', (error: any) => {
        console.error('[Telegram Bot] Polling error:', error?.message || error);
      });

      // Даем боту немного времени на инициализацию
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Проверяем, что бот действительно работает
      try {
        const botInfo = await this.bot.getMe();
        console.log(`[Telegram Bot] ✅ Bot connected: @${botInfo.username} (${botInfo.first_name})`);
      } catch (meError: any) {
        console.error('[Telegram Bot] ❌ Failed to get bot info:', meError?.message || meError);
        throw new Error(`Bot connection failed: ${meError?.message || 'Unknown error'}`);
      }

      // Настраиваем обработчики
      await this.setupHandlers();

      // Start polling AFTER handlers are set up (only when not using webhook)
      if (!useWebhookMode) {
        console.log('[Telegram Bot] Starting polling...');
        this.bot.startPolling();
        this.pollingStarted = true;
        console.log('✅ Telegram Bot initialized successfully with polling');
      } else {
        // In webhook mode we don't start polling; the webhook route will forward updates
        this.pollingStarted = false;
        console.log('✅ Telegram Bot initialized in webhook mode (polling disabled)');
      }

      // Keep a reference to prevent garbage collection
      (global as any).__telegramBot = this.bot;
    } catch (error: any) {
      console.error('❌ Error initializing Telegram Bot:', error?.message || error);
      console.error('[Telegram Bot] Full error:', error);
      this.bot = null;
      this.pollingStarted = false;
      this.initializationPromise = null;
      throw error; // Пробрасываем ошибку дальше
    }
  }

  /**
   * Настройка обработчиков команд и сообщений
   */
  private async setupHandlers() {
    if (!this.bot) return;

    // Команда /start
    this.bot.onText(/\/start/, async (msg) => {
      try {
        await this.ensureInitialized();
        await this.handleStart(msg);
      } catch (error: any) {
        console.error('Error in /start handler:', error);
      }
    });

    // Команда /help
    this.bot.onText(/\/help/, async (msg) => {
      try {
        await this.ensureInitialized();
        await this.handleHelp(msg);
      } catch (error: any) {
        console.error('Error in /help handler:', error);
      }
    });

    // Команда /mybookings
    this.bot.onText(/\/mybookings/, async (msg) => {
      try {
        await this.ensureInitialized();
        await this.handleMyBookings(msg);
      } catch (error: any) {
        console.error('Error in /mybookings handler:', error);
      }
    });

    // Команда /book - создать бронирование
    this.bot.onText(/\/book/, async (msg) => {
      try {
        await this.ensureInitialized();
        await this.handleBook(msg);
      } catch (error: any) {
        console.error('Error in /book handler:', error);
      }
    });

    // Команда /available - доступные слоты
    this.bot.onText(/\/available/, async (msg) => {
      try {
        await this.ensureInitialized();
        await this.handleAvailable(msg);
      } catch (error: any) {
        console.error('Error in /available handler:', error);
      }
    });

    // Команда /cancel - отменить бронирование
    this.bot.onText(/\/cancel/, async (msg) => {
      try {
        await this.ensureInitialized();
        await this.handleCancel(msg);
      } catch (error: any) {
        console.error('Error in /cancel handler:', error);
      }
    });

    // Обработка callback_query (нажатия на кнопки)
    this.bot.on('callback_query', async (query) => {
      try {
        await this.ensureInitialized();
        await this.handleCallbackQuery(query);
      } catch (error: any) {
        console.error('Error in callback_query handler:', error);
      }
    });

    // Обработка всех остальных сообщений
    this.bot.on('message', async (msg) => {
      try {
        await this.ensureInitialized();
        const userId = msg.from?.id;
        const chatId = msg.chat.id;

        console.log(`[Message] Received: userId=${userId}, chatId=${chatId}, text="${msg.text?.substring(0, 50)}..."`);

        // Игнорируем команды (они обрабатываются отдельно)
        if (msg.text?.startsWith('/')) {
          console.log(`[Message] Ignoring command: ${msg.text}`);
          return;
        }

        // Обработка контакта (телефона) - ПРИОРИТЕТНАЯ обработка
        if (msg.contact && userId) {
          console.log(`[Message] Contact received: phone=${msg.contact.phone_number}, userId=${userId}`);
          let phoneNumber = msg.contact.phone_number;
          if (!phoneNumber.startsWith('+')) {
            phoneNumber = '+' + phoneNumber;
          }
          console.log(`[Message] Normalized phone: ${phoneNumber}`);

          // Ищем пользователя по tg_id
          let user = await prisma.user.findFirst({
            where: {
              OR: [
                { tg_id: String(userId) },
                { tg_username: msg.from?.username },
              ],
            },
          });

          // Если пользователь не найден, создаем нового
          if (!user) {
            try {
              user = await prisma.user.create({
                data: {
                  tg_id: String(userId),
                  tg_username: msg.from?.username,
                  role: UserRole.CLIENT,
                  name: msg.from?.first_name || 'Foydalanuvchi',
                  phone_number: phoneNumber,
                },
              });
            } catch (error: any) {
              // Если ошибка уникальности, пытаемся найти снова
              if (error.code === 'P2002') {
                user = await prisma.user.findFirst({
                  where: {
                    OR: [
                      { tg_id: String(userId) },
                      { tg_username: msg.from?.username },
                    ],
                  },
                });
              } else {
                throw error;
              }
            }
          }

          // Обновляем телефон пользователя
          if (user) {
            // Обновляем телефон и tg_id
            await prisma.user.update({
              where: { id: user.id },
              data: {
                phone_number: phoneNumber,
                tg_id: String(userId), // Убеждаемся, что tg_id установлен
              },
            });

            // Очищаем состояние
            this.userStates.delete(userId);

            // Перезагружаем пользователя из базы для проверки
            const updatedUser = await prisma.user.findUnique({
              where: { id: user.id }
            });

            console.log(`[Contact handler] Updated user ${user.id}, phone_number:`, updatedUser?.phone_number);

            // Очищаем состояние
            this.userStates.delete(userId);

            // Показываем главную страницу
            await this.bot!.sendMessage(
              chatId,
              `✅ *Ro'yxatdan o'tdingiz!*\n\n` +
              `📱 Telefon raqamingiz: ${phoneNumber}\n\n` +
              `Siz bosh sahifadasiz.`,
              { parse_mode: 'Markdown' }
            );

            if (updatedUser) {
              await this.showHomePage(chatId, updatedUser);
            }
            return;
          }
        }

        // Обработка текстовых сообщений в зависимости от состояния
        if (userId) {
          const state = this.userStates.get(userId);
          if (state) {
            await this.handleStateMessage(msg, state);
            return;
          }
        }

        // Если не поняли сообщение
        await this.bot!.sendMessage(
          chatId,
          '🤔 Tushunmadim. Yordam uchun /help buyrug\'ini yuboring yoki quyidagi tugmalardan foydalaning:',
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🚀 Ro\'yxatdan o\'tish', callback_data: 'start' }],
                [{ text: '❓ Yordam', callback_data: 'help' }]
              ]
            }
          }
        );
      } catch (error: any) {
        console.error(`[Telegram Bot] Error in message handler for user ${msg.from?.id}:`, {
          errorMessage: error.message || error,
          messageText: msg.text,
          chatId: msg.chat.id
        });
        if (this.bot && msg.chat) {
          try {
            await this.bot.sendMessage(
              msg.chat.id,
              `❌ Xatolik yuz berdi.\n\n${error.message || 'Noma\'lum xatolik'}\n\nIltimos, keyinroq urinib ko'ring.`
            );
          } catch (sendError) {
            console.error(`[Telegram Bot] Error sending error message to ${msg.chat.id}:`, sendError);
          }
        }
      }
    });

    // Обработка ошибок polling
    this.bot.on('polling_error', (error) => {
      const message = error?.message || String(error);
      if (message.includes('ETELEGRAM: 409 Conflict')) {
        console.error('[Telegram Bot] Polling conflict detected. Stopping polling for this instance.');
        this.stopPolling().catch(() => { });
        return;
      }
      console.error('[Telegram Bot] Polling error:', {
        errorMessage: error.message || error,
        timestamp: new Date().toISOString()
      });
    });

    console.log('✅ Telegram Bot handlers setup completed');
  }

  /**
   * Обработка команды /start
   */
  private async handleStart(msg: TelegramBot.Message) {
    await this.ensureInitialized();
    const chatId = msg.chat.id;
    const userId = msg.from?.id;

    try {
      console.log(`[handleStart] User ID: ${userId}`);

      // Проверяем, зарегистрирован ли пользователь
      const user = await this.getUserByTelegramId(userId);

      // Если пользователь зарегистрирован и имеет имя и телефон - показываем главную страницу
      if (user && user.name && user.phone_number && user.phone_number.trim() !== '') {
        console.log(`[handleStart] User ${user.id} is registered, showing home page`);
        await this.showHomePage(chatId, user);
        return;
      }

      // Показываем информацию о боте и кнопку регистрации
      const keyboard = {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📝 Ro\'yxatdan o\'tish', callback_data: 'register' }]
          ]
        }
      };

      await this.bot!.sendMessage(
        chatId,
        `👋 Salom! Xatna Markazi botiga xush kelibsiz!\n\n` +
        `🏥 *Xatna Markazi* - bu professional tibbiy xizmatlar markazi.\n\n` +
        `Bizning bot orqali siz:\n` +
        `• 📅 Bron qilishingiz mumkin\n` +
        `• 📋 Bronlaringizni ko'rishingiz mumkin\n` +
        `• 💬 Doktor bilan bog'lanishingiz mumkin\n\n` +
        `Boshlash uchun ro'yxatdan o'ting:`,
        { parse_mode: 'Markdown', ...keyboard }
      );
    } catch (error: any) {
      console.error('Error in /start handler:', error);
      await this.bot!.sendMessage(chatId, '❌ Xatolik yuz berdi. Iltimos, keyinroq urinib ko\'ring.');
    }
  }

  /**
   * Показать главную страницу (домашняя страница)
   */
  private async showHomePage(chatId: number, user: any) {
    console.log(`[showHomePage] Showing home page for user ${user.id}, name=${user.name}, phone=${user.phone_number}`);

    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📅 Yangi bron qilish', callback_data: 'book_new' }],
          [{ text: '📋 Mening bronlarim', callback_data: 'my_bookings' }],
          [{ text: '💬 Yordam so\'rash', callback_data: 'help_request' }],
          [{ text: '❓ Qo\'llanma', callback_data: 'help' }]
        ]
      }
    };

    try {
      await this.bot!.sendMessage(
        chatId,
        `🏥 *Xatna Markazi Botiga Xush Kelibsiz*\n\n` +
        `👤 Shaxsingiz: *${user.name}*\n` +
        `📱 Raqamingiz: *${user.phone_number || '—'}*\n\n` +
        `Quyidagi tugmalardan foydalaning:`,
        { parse_mode: 'Markdown', ...keyboard }
      );
      console.log(`[showHomePage] Home page sent successfully`);
    } catch (error: any) {
      console.error(`[showHomePage] Error sending home page:`, error.message);
      throw error;
    }
  }

  /**
   * Обработка команды /help
   */
  private async handleHelp(msg: TelegramBot.Message) {
    await this.ensureInitialized();
    const chatId = msg.chat.id;

    if (!this.bot) {
      console.error('Bot not initialized in handleHelp');
      return;
    }

    await this.bot.sendMessage(
      chatId,
      `📚 *Qo'llanma*\n\n` +
      `🤖 *Bot buyruqlari:*\n\n` +
      `📍 */start* - Botni qayta boshlash\n` +
      `📍 */book* - Yangi bron qilish\n` +
      `📍 */mybookings* - Mening bronlarim\n` +
      `📍 */available* - Bugun va ertaga mavjud vaqtlar\n` +
      `📍 */cancel* - Broningizni bekor qilish\n` +
      `📍 */help* - Bu yordam xabari\n\n` +
      `ℹ️ *Eslatma:*\n` +
      `Vaqt slotlari 30 daqiqalik oralikda mavjud.\n` +
      `Bron qilish uchun 30 daqiqa oldin bekor qilib bo'lasiz.\n\n` +
      `Quyidagi tugmalardan ham foydalanishingiz mumkin:`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📅 Yangi bron', callback_data: 'book_new' }],
            [{ text: '📋 Mening bronlarim', callback_data: 'my_bookings' }],
            [{ text: '🏠 Bosh sahifa', callback_data: 'start' }]
          ]
        }
      }
    );
  }

  /**
   * Обработка команды /mybookings
   */
  private async handleMyBookings(msg: TelegramBot.Message) {
    await this.ensureInitialized();
    const chatId = msg.chat.id;
    const userId = msg.from?.id;
    await this.handleMyBookingsDirect(chatId, userId);
  }

  /**
   * Прямая обработка "Мои бронирования" по chatId и userId
   */
  private async handleMyBookingsDirect(chatId: number, userId?: number) {
    await this.ensureInitialized();

    try {
      console.log(`[handleMyBookingsDirect] User ID from Telegram: ${userId}, Chat ID: ${chatId}`);

      if (!userId) {
        await this.bot!.sendMessage(
          chatId,
          '❌ Xatolik: Foydalanuvchi ID topilmadi.'
        );
        return;
      }

      const user = await this.getUserByTelegramId(userId);
      if (!user) {
        console.log(`[handleMyBookingsDirect] User not found for tg_id: ${userId}`);
        await this.bot!.sendMessage(
          chatId,
          '❌ Siz ro\'yxatdan o\'tmagansiz. /start buyrug\'ini yuboring.'
        );
        return;
      }

      console.log(`[handleMyBookingsDirect] Found user: ID=${user.id}, name=${user.name}, phone=${user.phone_number || 'null'}, tg_id=${user.tg_id || 'null'}`);

      // Ищем бронирования по client_id
      let bookings = await prisma.booking.findMany({
        where: { client_id: user.id },
        include: {
          doctor: true,
        },
        orderBy: [
          { date: 'desc' },
          { time: 'desc' },
        ],
        take: 10,
      });

      console.log(`[handleMyBookingsDirect] Found ${bookings.length} bookings for user ${user.id} by client_id`);

      // Если не нашли бронирования по client_id, пробуем найти по телефону (на случай старых бронирований)
      // Также ищем бронирования, где client_id может быть null или другим пользователем с таким же телефоном
      if (bookings.length === 0) {
        console.log(`[handleMyBookingsDirect] No bookings found by client_id, trying alternative search methods`);

        // Метод 1: Ищем по телефону через других пользователей
        if (user.phone_number) {
          console.log(`[handleMyBookingsDirect] Trying to find bookings by phone: ${user.phone_number}`);

          // Ищем всех пользователей с таким же телефоном
          const clientsByPhone = await prisma.user.findMany({
            where: {
              phone_number: user.phone_number,
              role: UserRole.CLIENT
            },
          });

          console.log(`[handleMyBookingsDirect] Found ${clientsByPhone.length} clients with same phone number`);

          // Ищем бронирования для всех найденных клиентов
          for (const clientByPhone of clientsByPhone) {
            if (clientByPhone.id !== user.id) {
              console.log(`[handleMyBookingsDirect] Checking bookings for client ID=${clientByPhone.id}`);
              const bookingsByPhone = await prisma.booking.findMany({
                where: { client_id: clientByPhone.id },
                include: {
                  doctor: true,
                },
                orderBy: [
                  { date: 'desc' },
                  { time: 'desc' },
                ],
                take: 10,
              });

              if (bookingsByPhone.length > 0) {
                console.log(`[handleMyBookingsDirect] Found ${bookingsByPhone.length} bookings for client ${clientByPhone.id}, updating client_id to ${user.id}`);
                // Обновляем client_id на правильный пользователь
                for (const booking of bookingsByPhone) {
                  await prisma.booking.update({
                    where: { id: booking.id },
                    data: { client_id: user.id },
                  });
                }
              }
            }
          }
        }

        // Метод 2: Ищем все бронирования без client_id или с null client_id, которые могут быть связаны с этим пользователем
        // Это для случаев, когда бронирования были созданы до привязки к пользователю
        const allBookingsWithoutClient = await prisma.booking.findMany({
          where: {
            OR: [
              { client_id: null },
              // Можно добавить поиск по другим полям, если они есть
            ]
          },
          include: {
            doctor: true,
          },
          orderBy: [
            { date: 'desc' },
            { time: 'desc' },
          ],
          take: 20, // Берем больше, чтобы найти подходящие
        });

        console.log(`[handleMyBookingsDirect] Found ${allBookingsWithoutClient.length} bookings without client_id`);

        // Если у пользователя есть телефон, пытаемся сопоставить бронирования
        if (user.phone_number && allBookingsWithoutClient.length > 0) {
          // Здесь можно добавить логику сопоставления по другим полям, если они есть в Booking
          // Например, по phone_number, если оно хранится в Booking
        }

        // Перезагружаем бронирования после миграции
        bookings = await prisma.booking.findMany({
          where: { client_id: user.id },
          include: {
            doctor: true,
          },
          orderBy: [
            { date: 'desc' },
            { time: 'desc' },
          ],
          take: 10,
        });

        console.log(`[handleMyBookingsDirect] After migration, found ${bookings.length} bookings for user ${user.id}`);
      }

      if (bookings.length === 0) {
        await this.bot!.sendMessage(
          chatId,
          '📭 Bronlariz ko\'rish uchun quyidagi tugmani bosing.',
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '📅 Yangi bron qilish', callback_data: 'book_new' }],
                [{ text: '🏠 Bosh sahifa', callback_data: 'start' }]
              ]
            }
          }
        );
        return;
      }

      // Отправляем каждое бронирование отдельным сообщением с кнопкой отмены
      for (const booking of bookings) {
        const statusEmoji = {
          'PENDING': '⏳',
          'APPROVED': '✅',
          'REJECTED': '❌',
          'CANCELLED': '🚫',
          'COMPLETED': '✔️',
        }[booking.status] || '📅';

        const statusText = {
          'PENDING': 'Kutilmoqda',
          'APPROVED': 'Tasdiqlandi',
          'REJECTED': 'Rad etildi',
          'CANCELLED': 'Bekor qilindi',
          'COMPLETED': 'Yakunlandi',
        }[booking.status] || booking.status;

        const message = `${statusEmoji} *Bron #${booking.id}*\n\n` +
          `📆 Sana: ${booking.date}\n` +
          `⏰ Vaqt: ${booking.time}\n` +
          `👨‍⚕️ Shifokor: ${booking.doctor?.name || 'Shifokor'}\n` +
          `📊 Holat: ${statusText}`;

        const keyboard: any = {
          reply_markup: {
            inline_keyboard: []
          }
        };

        // Добавляем кнопку отмены только для активных бронирований
        if (booking.status === 'PENDING' || booking.status === 'APPROVED') {
          keyboard.reply_markup.inline_keyboard.push([
            { text: '🚫 Bekor qilish', callback_data: `cancel_${booking.id}` }
          ]);
        }

        await this.bot!.sendMessage(chatId, message, { parse_mode: 'Markdown', ...keyboard });
      }
    } catch (error: any) {
      console.error('Error in handleMyBookingsDirect:', error);
      console.error('Error stack:', error.stack);
      await this.bot!.sendMessage(
        chatId,
        `❌ Xatolik yuz berdi: ${error.message || 'Noma\'lum xatolik'}. Iltimos, keyinroq urinib ko'ring.`
      );
    }
  }

  /**
   * Обработка команды /book
   */
  private async handleBook(msg: TelegramBot.Message) {
    await this.ensureInitialized();
    const chatId = msg.chat.id;
    const userId = msg.from?.id;

    try {
      // Сначала ищем пользователя
      let user = await this.getUserByTelegramId(userId);

      if (!user) {
        await this.bot!.sendMessage(
          chatId,
          `❌ Siz ro'yxatdan o'tmagansiz.\n\n` +
          `Iltimos, avval /start buyrug'ini yuboring va ro'yxatdan o'ting.`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🚀 Ro\'yxatdan o\'tish', callback_data: 'start' }]
              ]
            }
          }
        );
        return;
      }

      // Перезагружаем пользователя из базы, чтобы получить актуальные данные
      user = await prisma.user.findUnique({
        where: { id: user.id }
      });

      if (!user) {
        await this.bot!.sendMessage(chatId, '❌ Xatolik yuz berdi. Iltimos, qayta urinib ko\'ring.');
        return;
      }

      // Проверяем, есть ли телефон (проверяем и null, и пустую строку)
      const phoneNumber = user.phone_number?.trim() || '';
      if (!phoneNumber || phoneNumber === '') {
        console.log(`[handleBook] User ${user.id} has no phone_number. Current value:`, user.phone_number);
        this.userStates.set(userId!, {
          action: 'registration_phone',
          step: 1,
          userId: user.id
        });

        await this.bot!.sendMessage(
          chatId,
          `📱 Bron qilish uchun telefon raqamingiz kerak.\n\n` +
          `Iltimos, telefon raqamingizni yuboring (masalan: +998901234567):`,
          {
            reply_markup: {
              keyboard: [
                [{ text: '📱 Telefon raqamini yuborish', request_contact: true }]
              ],
              resize_keyboard: true,
              one_time_keyboard: true
            }
          }
        );
        return;
      }

      console.log(`[handleBook] User ${user.id} has phone_number:`, phoneNumber);

      // Устанавливаем состояние для создания бронирования
      this.userStates.set(userId!, {
        action: 'booking_month',
        step: 1
      });

      // Получаем доступные месяцы
      const availableMonths = this.getAvailableMonths();

      await this.bot!.sendMessage(
        chatId,
        `📅 *Yangi bron qilish*\n\n` +
        `Bugungi kundan boshlab 30 kunlik davrda bron qilishingiz mumkin.\n\n` +
        `Oyni tanlang:`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: this.createMonthKeyboard(availableMonths)
          }
        }
      );
    } catch (error: any) {
      console.error('Error in /book handler:', error);
      await this.bot!.sendMessage(chatId, '❌ Xatolik yuz berdi. Iltimos, keyinroq urinib ko\'ring.');
    }
  }

  /**
   * Обработка команды /available
   */
  private async handleAvailable(msg: TelegramBot.Message) {
    await this.ensureInitialized();
    const chatId = msg.chat.id;

    try {
      const doctor = await prisma.user.findFirst({
        where: { role: UserRole.DOCTOR, working: true }
      });

      if (!doctor) {
        await this.bot!.sendMessage(chatId, '❌ Hozircha doktor mavjud emas.');
        return;
      }

      // Получаем доступные слоты на сегодня и завтра
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

      const availableSlots = await this.getAvailableSlots(doctor.id, today);
      const tomorrowSlots = await this.getAvailableSlots(doctor.id, tomorrow);

      let message = `📊 *Mavjud vaqtlar*\n\n`;
      message += `*Bugun (${today}):*\n`;
      if (availableSlots.length > 0) {
        message += availableSlots.join(', ') + '\n\n';
      } else {
        message += 'Mavjud vaqtlar yo\'q\n\n';
      }

      message += `*Ertaga (${tomorrow}):*\n`;
      if (tomorrowSlots.length > 0) {
        message += tomorrowSlots.join(', ');
      } else {
        message += 'Mavjud vaqtlar yo\'q';
      }

      await this.bot!.sendMessage(
        chatId,
        message,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📅 Yangi bron qilish', callback_data: 'book_new' }]
            ]
          }
        }
      );
    } catch (error: any) {
      console.error('Error in /available handler:', error);
      await this.bot!.sendMessage(chatId, '❌ Xatolik yuz berdi. Iltimos, keyinroq urinib ko\'ring.');
    }
  }

  /**
   * Обработка команды /cancel
   */
  private async handleCancel(msg: TelegramBot.Message) {
    await this.ensureInitialized();
    const chatId = msg.chat.id;
    const userId = msg.from?.id;

    try {
      const user = await this.getUserByTelegramId(userId);
      if (!user) {
        await this.bot!.sendMessage(
          chatId,
          '❌ Siz ro\'yxatdan o\'tmagansiz. /start buyrug\'ini yuboring.'
        );
        return;
      }

      // Получаем активные бронирования
      const bookings = await prisma.booking.findMany({
        where: {
          client_id: user.id,
          status: { in: ['PENDING', 'APPROVED'] }
        },
        orderBy: [
          { date: 'asc' },
          { time: 'asc' }
        ]
      });

      if (bookings.length === 0) {
        await this.bot!.sendMessage(chatId, '❌ Bekor qilish uchun faol bronlar topilmadi.');
        return;
      }

      // Показываем список бронирований для отмены
      const keyboard = {
        reply_markup: {
          inline_keyboard: bookings.map(booking => [
            {
              text: `${booking.date} ${booking.time}`,
              callback_data: `cancel_${booking.id}`
            }
          ])
        }
      };

      await this.bot!.sendMessage(
        chatId,
        `🚫 *Bronni bekor qilish*\n\n` +
        `Bekor qilmoqchi bo'lgan broningizni tanlang:`,
        { parse_mode: 'Markdown', ...keyboard }
      );
    } catch (error: any) {
      console.error('Error in /cancel handler:', error);
      await this.bot!.sendMessage(chatId, '❌ Xatolik yuz berdi. Iltimos, keyinroq urinib ko\'ring.');
    }
  }

  /**
   * Обработка callback_query (нажатия на кнопки)
   */
  private async handleCallbackQuery(query: TelegramBot.CallbackQuery) {
    await this.ensureInitialized();

    const chatId = query.message?.chat.id;
    const userId = query.from.id;
    const data = query.data;

    console.log(`[Callback] Received: data=${data}, userId=${userId}, chatId=${chatId}`);

    if (!chatId || !data || !this.bot) {
      console.warn(`[Callback] Missing fields: chatId=${chatId}, data=${data}, bot=${!!this.bot}`);
      return;
    }

    try {
      console.log(`[Callback] Processing: ${data}`);
      await this.bot.answerCallbackQuery(query.id);

      if (data === 'start') {
        await this.handleStart(query.message!);
      } else if (data === 'register') {
        // Начало регистрации - спрашиваем имя
        const userId = query.from.id;
        this.userStates.set(userId, {
          action: 'registration_name',
          step: 1
        });

        if (query.message) {
          await this.bot!.editMessageText(
            `📝 *Ro'yxatdan o'tish*\n\n` +
            `Iltimos, ismingizni yuboring:`,
            {
              chat_id: chatId,
              message_id: query.message.message_id,
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: []
              }
            }
          );
        } else {
          await this.bot!.sendMessage(
            chatId,
            `📝 *Ro'yxatdan o'tish*\n\n` +
            `Iltimos, ismingizni yuboring:`,
            { parse_mode: 'Markdown' }
          );
        }
      } else if (data === 'help') {
        await this.handleHelp(query.message!);
      } else if (data === 'help_request') {
        // Запрос помощи - отправляем сообщение доктору
        const userId = query.from.id;
        const user = await this.getUserByTelegramId(userId);

        if (!user) {
          await this.bot!.editMessageText(
            `❌ Siz ro'yxatdan o'tmagansiz.`,
            {
              chat_id: chatId,
              message_id: query.message?.message_id,
              reply_markup: {
                inline_keyboard: []
              }
            }
          );
          return;
        }

        this.userStates.set(userId, {
          action: 'help_message',
          step: 1,
          userId: user.id
        });

        if (query.message) {
          await this.bot!.editMessageText(
            `💬 *Yordam so'rovi*\n\n` +
            `Iltimos, savolingiz yoki muammoingizni yozing. Doktor sizga javob beradi:`,
            {
              chat_id: chatId,
              message_id: query.message.message_id,
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: []
              }
            }
          );
        } else {
          await this.bot!.sendMessage(
            chatId,
            `💬 *Yordam so'rovi*\n\n` +
            `Iltimos, savolingiz yoki muammoingizni yozing. Doktor sizga javob beradi:`,
            { parse_mode: 'Markdown' }
          );
        }
      } else if (data === 'my_bookings') {
        console.log(`[handleCallbackQuery] my_bookings callback received from user ${query.from.id}`);

        // Показываем загрузку сразу, без предварительных проверок
        let loadingMessageId: number | undefined;
        if (query.message) {
          try {
            const edited = await this.bot!.editMessageText(
              '📋 Mening bronlarim yuklanmoqda...',
              {
                chat_id: chatId,
                message_id: query.message.message_id,
                reply_markup: {
                  inline_keyboard: []
                }
              }
            );
            // Если editMessageText вернул объект Message, используем его ID
            if (edited && typeof edited === 'object' && 'message_id' in edited) {
              loadingMessageId = edited.message_id as number;
            } else {
              loadingMessageId = query.message.message_id;
            }
          } catch (error) {
            console.error('[handleCallbackQuery] Error editing message:', error);
            // Если не удалось отредактировать, отправляем новое сообщение
            try {
              const sent = await this.bot!.sendMessage(chatId, '📋 Mening bronlarim yuklanmoqda...');
              if (sent && typeof sent === 'object' && 'message_id' in sent) {
                loadingMessageId = sent.message_id as number;
              }
            } catch (sendError) {
              console.error('[handleCallbackQuery] Error sending loading message:', sendError);
            }
          }
        } else {
          try {
            const sent = await this.bot!.sendMessage(chatId, '📋 Mening bronlarim yuklanmoqda...');
            if (sent && typeof sent === 'object' && 'message_id' in sent) {
              loadingMessageId = sent.message_id as number;
            }
          } catch (error) {
            console.error('[handleCallbackQuery] Error sending loading message:', error);
          }
        }

        // Небольшая задержка для отображения сообщения загрузки
        await new Promise(resolve => setTimeout(resolve, 300));

        // Вызываем handleMyBookings напрямую с chatId и userId
        // Вся логика проверки пользователя и поиска бронирований будет внутри handleMyBookingsDirect
        console.log(`[handleCallbackQuery] Calling handleMyBookingsDirect for user ${query.from.id}, chatId ${chatId}`);
        try {
          await this.handleMyBookingsDirect(chatId, query.from.id);

          // Удаляем сообщение загрузки после успешного выполнения
          if (loadingMessageId) {
            try {
              await this.bot!.deleteMessage(chatId, loadingMessageId).catch(() => {
                // Игнорируем ошибки удаления
              });
            } catch (error) {
              // Игнорируем ошибки удаления
            }
          }
        } catch (error) {
          console.error('[handleCallbackQuery] Error in handleMyBookingsDirect:', error);
          // Удаляем сообщение загрузки даже при ошибке
          if (loadingMessageId) {
            try {
              await this.bot!.deleteMessage(chatId, loadingMessageId).catch(() => { });
            } catch (deleteError) {
              // Игнорируем ошибки удаления
            }
          }
          // Не пробрасываем ошибку, чтобы не сломать callback обработчик
        }
      } else if (data === 'book_new') {
        // Проверяем регистрацию перед показом меню бронирования
        const userId = query.from.id;
        let user = await this.getUserByTelegramId(userId);

        if (!user) {
          await this.bot!.editMessageText(
            `❌ Siz ro'yxatdan o'tmagansiz.\n\n` +
            `Iltimos, avval ro'yxatdan o'ting.`,
            {
              chat_id: chatId,
              message_id: query.message?.message_id,
              reply_markup: {
                inline_keyboard: [
                  [{ text: '🚀 Ro\'yxatdan o\'tish', callback_data: 'start' }]
                ]
              }
            }
          );
          return;
        }

        // Перезагружаем пользователя из базы, чтобы получить актуальные данные
        user = await prisma.user.findUnique({
          where: { id: user.id }
        });

        if (!user) {
          await this.bot!.editMessageText(
            '❌ Xatolik yuz berdi. Iltimos, qayta urinib ko\'ring.',
            {
              chat_id: chatId,
              message_id: query.message?.message_id,
              reply_markup: {
                inline_keyboard: []
              }
            }
          );
          return;
        }

        // Проверяем, есть ли телефон (проверяем и null, и пустую строку)
        const phoneNumber = user.phone_number?.trim() || '';
        if (!phoneNumber || phoneNumber === '') {
          console.log(`[book_new callback] User ${user.id} has no phone_number. Current value:`, user.phone_number);
          this.userStates.set(userId, {
            action: 'registration_phone',
            step: 1,
            userId: user.id
          });

          // Для запроса телефона нужно использовать sendMessage, а не editMessageText
          // потому что keyboard не поддерживается в editMessageText
          if (query.message) {
            await this.bot!.deleteMessage(chatId, query.message.message_id).catch(() => { });
          }
          await this.bot!.sendMessage(
            chatId,
            `📱 Bron qilish uchun telefon raqamingiz kerak.\n\n` +
            `Iltimos, telefon raqamingizni yuboring:`,
            {
              reply_markup: {
                keyboard: [
                  [{ text: '📱 Telefon raqamini yuborish', request_contact: true }]
                ],
                resize_keyboard: true,
                one_time_keyboard: true
              } as any
            }
          );
          return;
        }

        console.log(`[book_new callback] User ${user.id} has phone_number:`, phoneNumber);

        // Проверяем, что у пользователя есть имя
        if (!user.name || user.name === 'Foydalanuvchi' || user.name.trim().length < 2) {
          this.userStates.set(userId, {
            action: 'registration_name',
            step: 2,
            userId: user.id,
            phoneNumber: user.phone_number
          });

          await this.bot!.editMessageText(
            `📝 Bron qilish uchun ismingiz kerak.\n\n` +
            `Iltimos, ismingizni yuboring:`,
            {
              chat_id: chatId,
              message_id: query.message?.message_id,
              reply_markup: {
                remove_keyboard: true
              } as any
            }
          );
          return;
        }

        // Все проверки пройдены - показываем меню бронирования (месяцы)
        // userId уже определен выше, не нужно переопределять

        // Устанавливаем состояние для создания бронирования
        this.userStates.set(userId, {
          action: 'booking_month',
          step: 1
        });

        // Получаем доступные месяцы
        const availableMonths = this.getAvailableMonths();

        await this.bot!.editMessageText(
          `📅 *Yangi bron qilish*\n\n` +
          `Avval oyni tanlang:`,
          {
            chat_id: chatId,
            message_id: query.message?.message_id,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: this.createMonthKeyboard(availableMonths)
            }
          }
        );
      } else if (data === 'available_slots') {
        // Проверяем регистрацию
        const user = await this.getUserByTelegramId(query.from.id);
        if (!user) {
          await this.bot!.editMessageText(
            `❌ Siz ro'yxatdan o'tmagansiz.\n\n` +
            `Iltimos, avval ro'yxatdan o'ting.`,
            {
              chat_id: chatId,
              message_id: query.message?.message_id,
              reply_markup: {
                inline_keyboard: [
                  [{ text: '🚀 Ro\'yxatdan o\'tish', callback_data: 'start' }]
                ]
              }
            }
          );
          return;
        }
        await this.handleAvailable(query.message!);
      } else if (data.startsWith('month_')) {
        await this.handleMonthSelection(query, data);
      } else if (data.startsWith('date_')) {
        await this.handleDateSelection(query, data);
      } else if (data === 'back_to_date') {
        // Возврат к выбору даты
        const state = this.userStates.get(userId);
        if (state && state.bookingMonth) {
          const monthKey = state.bookingMonth;
          const availableDays = this.getAvailableDaysForMonth(monthKey);
          await this.bot!.editMessageText(
            `📅 *Kunni tanlang*\n\nOy: ${this.formatMonthName(monthKey)}`,
            {
              chat_id: chatId,
              message_id: query.message?.message_id,
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: this.createDayKeyboard(availableDays, monthKey)
              }
            }
          );
        }
      } else if (data.startsWith('time_')) {
        await this.handleTimeSelection(query, data);
      } else if (data.startsWith('service_')) {
        await this.handleServiceSelection(query, data);
      } else if (data.startsWith('cancel_')) {
        await this.handleCancelBooking(query, data);
      } else if (data === 'confirm_booking') {
        await this.handleConfirmBooking(query);
      } else {
        console.warn(`[Telegram Bot] Unknown callback data: ${data}`);
      }
    } catch (error: any) {
      console.error(`[Telegram Bot] Error in callback query handler:`, {
        userId: query.from.id,
        data: query.data,
        error: error.message || error
      });
      if (chatId) {
        await this.bot!.sendMessage(
          chatId,
          `❌ Xatolik yuz berdi.\n\n` +
          `${error.message || 'Noma\'lum xatolik'}\n\n` +
          `Iltimos, keyinroq urinib ko'ring yoki /start buyrug'ini yuboring.`
        ).catch(e => console.error('Error sending error message:', e));
      }
    }
  }

  /**
   * Обработка выбора даты
   */
  /**
   * Обработка выбора месяца
   */
  private async handleMonthSelection(query: TelegramBot.CallbackQuery, data: string) {
    const chatId = query.message?.chat.id;
    const userId = query.from.id;
    const monthKey = data.replace('month_', ''); // Формат: "2026-01"

    if (!chatId) return;

    // Сохраняем выбранный месяц
    const state = this.userStates.get(userId) || {};
    state.bookingMonth = monthKey;
    state.action = 'booking_day';
    state.step = 2;
    this.userStates.set(userId, state);

    // Получаем доступные дни для выбранного месяца
    const availableDays = this.getAvailableDaysForMonth(monthKey);

    if (availableDays.length === 0) {
      await this.bot!.editMessageText(
        `❌ ${this.formatMonthName(monthKey)} oyida mavjud kunlar yo'q. Boshqa oyni tanlang:`,
        {
          chat_id: chatId,
          message_id: query.message?.message_id,
          reply_markup: {
            inline_keyboard: this.createMonthKeyboard(this.getAvailableMonths())
          }
        }
      );
      return;
    }

    await this.bot!.editMessageText(
      `📅 *Kunni tanlang*\n\nOy: ${this.formatMonthName(monthKey)}`,
      {
        chat_id: chatId,
        message_id: query.message?.message_id,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: this.createDayKeyboard(availableDays, monthKey)
        }
      }
    );
  }

  /**
   * Обработка выбора дня
   */
  private async handleDateSelection(query: TelegramBot.CallbackQuery, data: string) {
    const chatId = query.message?.chat.id;
    const userId = query.from.id;
    const date = data.replace('date_', ''); // Формат: "2026-01-15"

    if (!chatId) return;

    // Сохраняем выбранную дату
    const state = this.userStates.get(userId) || {};
    state.bookingDate = date;
    state.action = 'booking_time';
    state.step = 3;
    this.userStates.set(userId, state);

    // Получаем доступные времена для выбранной даты
    const doctor = await prisma.user.findFirst({
      where: { role: UserRole.DOCTOR, working: true }
    });

    if (!doctor) {
      await this.bot!.sendMessage(chatId, '❌ Doktor topilmadi.');
      return;
    }

    try {
      const availableSlots = await this.getAvailableSlots(doctor.id, date);

      if (availableSlots.length === 0) {
        const monthKey = state.bookingMonth;

        // Если месяц не сохранен, извлекаем его из даты
        let monthKeyToUse = monthKey;
        if (!monthKeyToUse && date) {
          const dateParts = date.split('-');
          if (dateParts.length >= 2) {
            monthKeyToUse = `${dateParts[0]}-${dateParts[1]}`;
          }
        }

        if (monthKeyToUse) {
          const availableDays = this.getAvailableDaysForMonth(monthKeyToUse);

          try {
            await this.bot!.editMessageText(
              `❌ ${date} kuni mavjud vaqtlar yo'q.\n\n` +
              `Boshqa kunni tanlang:`,
              {
                chat_id: chatId,
                message_id: query.message?.message_id,
                reply_markup: {
                  inline_keyboard: this.createDayKeyboard(availableDays, monthKeyToUse)
                }
              }
            );
          } catch (editError: any) {
            if (!editError?.message?.includes('message is not modified')) {
              throw editError;
            }
          }
        } else {
          // Если не можем определить месяц, возвращаем к выбору месяца
          try {
            await this.bot!.editMessageText(
              `❌ ${date} kuni mavjud vaqtlar yo'q. Boshqa oyni tanlang:`,
              {
                chat_id: chatId,
                message_id: query.message?.message_id,
                reply_markup: {
                  inline_keyboard: this.createMonthKeyboard(this.getAvailableMonths())
                }
              }
            );
          } catch (editError: any) {
            if (!editError?.message?.includes('message is not modified')) {
              throw editError;
            }
          }
        }
        return;
      }

      try {
        await this.bot!.editMessageText(
          `⏰ *Vaqtni tanlang*\n\n` +
          `📅 Sana: ${new Date(date).toLocaleDateString('uz-UZ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n` +
          `👨‍⚕️ Shifokor: ${doctor.name}\n\n` +
          `Mavjud vaqtlar: ${availableSlots.length} ta`,
          {
            chat_id: chatId,
            message_id: query.message?.message_id,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: this.createTimeKeyboard(availableSlots)
            }
          }
        );
      } catch (editError: any) {
        if (!editError?.message?.includes('message is not modified')) {
          throw editError;
        }
      }
    } catch (error: any) {
      console.error('Error in handleDateSelection:', error);
      await this.bot!.sendMessage(
        chatId,
        `❌ Xatolik yuz berdi: vaqtlarni yuklashda muammo.\n\n` +
        `Iltimos, keyinroq urinib ko'ring.`
      );
    }
  }

  /**
   * Обработка выбора времени
   */
  private async handleTimeSelection(query: TelegramBot.CallbackQuery, data: string) {
    const chatId = query.message?.chat.id;
    const userId = query.from.id;
    const time = data.replace('time_', '');

    if (!chatId) {
      console.error('[Telegram Bot] handleTimeSelection: chatId not found');
      return;
    }

    const state = this.userStates.get(userId);
    if (!state || !state.bookingDate) {
      console.error(`[Telegram Bot] handleTimeSelection: Invalid state for user ${userId}`);
      await this.bot!.sendMessage(chatId, '❌ Xatolik. Qaytadan boshlang: /book');
      return;
    }

    console.log(`[Telegram Bot] handleTimeSelection: User ${userId} selected time ${time} for date ${state.bookingDate}`);

    // Сохраняем выбранное время
    state.bookingTime = time;
    state.action = 'booking_service';
    state.step = 4;
    this.userStates.set(userId, state);

    // Получаем список сервисов
    try {
      const services = await this.getServices();

      if (services.length === 0) {
        console.log(`[Telegram Bot] handleTimeSelection: No services found, showing booking confirmation`);
        // Если сервисов нет, переходим сразу к подтверждению
        await this.showBookingConfirmation(query, state);
        return;
      }

      // Показываем выбор сервиса
      await this.bot!.editMessageText(
        `💼 *Xizmatni tanlang*\n\n` +
        `📅 Sana: ${new Date(state.bookingDate).toLocaleDateString('uz-UZ')}\n` +
        `⏰ Vaqt: ${time}\n\n` +
        `Mavjud xizmatlar: ${services.length} ta`,
        {
          chat_id: chatId,
          message_id: query.message?.message_id,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: this.createServiceKeyboard(services)
          }
        }
      );
    } catch (error: any) {
      console.error(`[Telegram Bot] handleTimeSelection: Error - ${error.message}`);
      await this.bot!.sendMessage(
        chatId,
        `❌ Xatolik yuz berdi sервис yuklashda.\n\nIltimos, keyinroq urinib ko'ring.`
      );
    }
  }

  /**
   * Получить список сервисов
   */
  private async getServices(): Promise<any[]> {
    try {
      const services = await (prisma as any).service?.findMany({
        orderBy: { created_at: 'desc' },
      }) || [];
      return services;
    } catch (error) {
      console.error('Error fetching services:', error);
      return [];
    }
  }

  /**
   * Создать клавиатуру для выбора сервиса
   */
  private createServiceKeyboard(services: any[]): TelegramBot.InlineKeyboardButton[][] {
    const buttons: TelegramBot.InlineKeyboardButton[][] = [];

    // Добавляем кнопки для каждого сервиса
    for (const service of services) {
      const price = service.price ? `${service.price.toLocaleString()} UZS` : 'Bepul';
      buttons.push([
        {
          text: `${service.name} - ${price}`,
          callback_data: `service_${service.id}`
        }
      ]);
    }

    // Добавляем кнопку "Без сервиса" или "Пропустить"
    buttons.push([
      { text: '⏭️ Xizmatni o\'tkazib yuborish', callback_data: 'service_skip' }
    ]);

    return buttons;
  }

  /**
   * Обработка выбора сервиса
   */
  private async handleServiceSelection(query: TelegramBot.CallbackQuery, data: string) {
    const chatId = query.message?.chat.id;
    const userId = query.from.id;

    if (!chatId) return;

    const state = this.userStates.get(userId);
    if (!state || !state.bookingDate || !state.bookingTime) {
      await this.bot!.sendMessage(chatId, '❌ Xatolik. Qaytadan boshlang: /book');
      return;
    }

    if (data === 'service_skip') {
      // Пользователь пропустил выбор сервиса
      state.serviceName = 'Xizmat tanlanmadi';
      state.serviceId = null;
    } else {
      // Пользователь выбрал сервис
      const serviceId = data.replace('service_', '');
      const services = await this.getServices();
      const selectedService = services.find(s => s.id === serviceId);

      if (selectedService) {
        state.serviceName = selectedService.name;
        state.serviceId = serviceId;
      } else {
        state.serviceName = 'Xizmat tanlanmadi';
        state.serviceId = null;
      }
    }

    state.action = 'confirm';
    state.step = 5;
    this.userStates.set(userId, state);

    // Показываем подтверждение
    await this.showBookingConfirmation(query, state);
  }

  /**
   * Показать подтверждение бронирования
   */
  private async showBookingConfirmation(query: TelegramBot.CallbackQuery, state: any) {
    const chatId = query.message?.chat.id;
    const userId = query.from.id;

    if (!chatId) return;

    const doctor = await prisma.user.findFirst({
      where: { role: UserRole.DOCTOR, working: true }
    });

    const serviceName = state.serviceName || '—';

    // Форматируем дату для более понятного вывода
    const dateObj = new Date(state.bookingDate);
    const formattedDate = dateObj.toLocaleDateString('uz-UZ', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    await this.bot!.editMessageText(
      `📋 *Bron ma'lumotlari*\n\n` +
      `📆 Sana: ${formattedDate}\n` +
      `⏰ Vaqt: ${state.bookingTime}\n` +
      `👨‍⚕️ Shifokor: ${doctor?.name || 'Shifokor'}\n` +
      `💼 Xizmat: ${serviceName}\n\n` +
      `Bronni tasdiqlaysizmi?`,
      {
        chat_id: chatId,
        message_id: query.message?.message_id,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '✅ Tasdiqlash', callback_data: 'confirm_booking' }],
            [{ text: '❌ Bekor qilish', callback_data: 'book_new' }]
          ]
        }
      }
    );
  }

  /**
   * Подтверждение бронирования
   */
  private async handleConfirmBooking(query: TelegramBot.CallbackQuery) {
    const chatId = query.message?.chat.id;
    const userId = query.from.id;

    if (!chatId) return;

    const state = this.userStates.get(userId);
    if (!state || !state.bookingDate || !state.bookingTime) {
      await this.bot!.sendMessage(chatId, '❌ Xatolik. Qaytadan boshlang: /book');
      return;
    }

    try {
      const user = await this.getUserByTelegramId(userId);
      if (!user) {
        await this.bot!.sendMessage(chatId, '❌ Foydalanuvchi topilmadi.');
        return;
      }

      const doctor = await prisma.user.findFirst({
        where: { role: UserRole.DOCTOR, working: true }
      });

      if (!doctor) {
        await this.bot!.sendMessage(chatId, '❌ Doktor topilmadi.');
        return;
      }

      // Проверяем телефон перед созданием бронирования
      if (!user.phone_number) {
        this.userStates.set(userId, {
          action: 'registration_phone',
          step: 1,
          userId: user.id
        });

        // Для запроса телефона нужно использовать sendMessage, а не editMessageText
        if (query.message) {
          await this.bot!.deleteMessage(chatId, query.message.message_id).catch(() => { });
        }
        await this.bot!.sendMessage(
          chatId,
          `📱 Bron qilish uchun telefon raqamingiz kerak.\n\n` +
          `Iltimos, telefon raqamingizni yuboring:`,
          {
            reply_markup: {
              keyboard: [
                [{ text: '📱 Telefon raqamini yuborish', request_contact: true }]
              ],
              resize_keyboard: true,
              one_time_keyboard: true
            } as any
          }
        );
        return;
      }

      // Создаем бронирование
      // ВАЖНО: Используем user.id напрямую, чтобы гарантировать, что бронирование будет связано с правильным пользователем
      const bookingService = new BookingService();

      // Сначала проверяем, что у пользователя есть телефон
      if (!user.phone_number || user.phone_number.trim() === '') {
        await this.bot!.sendMessage(chatId, '❌ Telefon raqamingiz topilmadi. Iltimos, qayta ro\'yxatdan o\'ting.');
        return;
      }

      // Создаем бронирование с явным указанием client_id (user.id)
      // Это гарантирует, что бронирование будет связано с правильным пользователем Telegram
      if (!user.phone_number || user.phone_number.trim() === '') {
        await this.bot!.sendMessage(chatId, '❌ Telefon raqamingiz topilmadi. Iltimos, qayta ro\'yxatdan o\'ting.');
        return;
      }

      const booking = await bookingService.create({
        phone_number: user.phone_number,
        client_name: user.name || undefined,
        doctor_id: doctor.id,
        date: state.bookingDate,
        time: state.bookingTime,
        client_id: user.id, // Явно указываем client_id из Telegram пользователя
      });

      console.log(`[Telegram Bot] Created booking ${booking.id} for user ${user.id} (tg_id: ${user.tg_id})`);

      // Очищаем состояние
      this.userStates.delete(userId);

      // Перезагружаем пользователя для главной страницы
      const updatedUser = await prisma.user.findUnique({
        where: { id: user.id }
      });

      // Форматируем дату для вывода
      const dateObj = new Date(state.bookingDate);
      const formattedDate = dateObj.toLocaleDateString('uz-UZ', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      await this.bot!.editMessageText(
        `✅ *Bron muvaffaqiyatli yaratildi!*\n\n` +
        `🎫 Bron raqami: #${booking.id}\n` +
        `📆 Sana: ${formattedDate}\n` +
        `⏰ Vaqt: ${state.bookingTime}\n` +
        `👨‍⚕️ Shifokor: ${doctor.name}\n` +
        `📊 Holat: ⏳ Kutilmoqda\n\n` +
        `💬 Sizga tasdiqlash haqida xabar yuboramiz.\n` +
        `📞 Savollar bo'lsa, biz bilan bog'lanishingiz mumkin.`,
        {
          chat_id: chatId,
          message_id: query.message?.message_id,
          parse_mode: 'Markdown'
        }
      );

      // Показываем главную страницу
      if (updatedUser) {
        await this.showHomePage(chatId, updatedUser);
      }
    } catch (error: any) {
      console.error('Error creating booking:', error);
      await this.bot!.sendMessage(
        chatId,
        `❌ Xatolik: ${error.message || 'Bron yaratishda xatolik yuz berdi'}`
      );
    }
  }

  /**
   * Отмена бронирования
   */
  private async handleCancelBooking(query: TelegramBot.CallbackQuery, data: string) {
    const chatId = query.message?.chat.id;
    const userId = query.from.id;
    const bookingId = data.replace('cancel_', '');

    if (!chatId || !bookingId) return;

    try {
      const user = await this.getUserByTelegramId(userId);
      if (!user) {
        await this.bot!.sendMessage(chatId, '❌ Foydalanuvchi topilmadi.');
        return;
      }

      const booking = await prisma.booking.findFirst({
        where: {
          id: bookingId,
          client_id: user.id
        },
        include: {
          doctor: true
        }
      });

      if (!booking) {
        await this.bot!.sendMessage(chatId, '❌ Bron topilmadi yoki sizga tegishli emas.');
        return;
      }

      if (booking.status === 'CANCELLED' || booking.status === 'COMPLETED') {
        await this.bot!.sendMessage(chatId, '❌ Bu bron allaqachon bekor qilingan yoki yakunlangan.');
        return;
      }

      // Обновляем статус
      await prisma.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.CANCELLED }
      });

      const dateObj = new Date(booking.date);
      const formattedDate = dateObj.toLocaleDateString('uz-UZ', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      await this.bot!.editMessageText(
        `✅ *Bron muvaffaqiyatli bekor qilindi*\n\n` +
        `🎫 Bron raqami: #${bookingId}\n` +
        `📅 Sana: ${formattedDate}\n` +
        `⏰ Vaqt: ${booking.time}\n` +
        `👨‍⚕️ Shifokor: ${booking.doctor?.name || 'Shifokor'}\n\n` +
        `Bron bekor qilinganligi tushuntirildi.`,
        {
          chat_id: chatId,
          message_id: query.message?.message_id,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📋 Mening bronlarim', callback_data: 'my_bookings' }],
              [{ text: '📅 Yangi bron qilish', callback_data: 'book_new' }],
              [{ text: '🏠 Bosh sahifa', callback_data: 'start' }]
            ]
          }
        }
      );
    } catch (error: any) {
      console.error('Error cancelling booking:', error);
      await this.bot!.sendMessage(chatId, `❌ Xatolik yuz berdi: ${error.message || 'Noma\'lum xatolik'}`);
    }
  }

  /**
   * Обработка текстовых сообщений в зависимости от состояния
   */
  private async handleStateMessage(msg: TelegramBot.Message, state: any) {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;

    if (!userId) return;

    console.log(`[handleStateMessage] Processing action=${state.action}, step=${state.step}, userId=${userId}`);

    try {
      // Обработка регистрации имени
      if (state.action === 'registration_name') {
        const name = msg.text?.trim() || '';

        if (!name || name.length < 2) {
          await this.bot!.sendMessage(
            chatId,
            `❌ Iltimos, to'liq ismingizni yuboring (kamida 2 belgi).`
          );
          return;
        }

        // Создаем или обновляем пользователя
        let user = await this.getUserByTelegramId(userId);

        if (!user) {
          user = await prisma.user.create({
            data: {
              tg_id: String(userId),
              tg_username: msg.from?.username,
              role: UserRole.CLIENT,
              name: name,
              phone_number: undefined,
            },
          });
        } else {
          await prisma.user.update({
            where: { id: user.id },
            data: { name: name },
          });
        }

        // Переходим к запросу телефона
        this.userStates.set(userId, {
          action: 'registration_phone',
          step: 2,
          userId: user.id,
          userName: name
        });

        await this.bot!.sendMessage(
          chatId,
          `✅ *Ism saqlandi*\n\n` +
          `👤 Sizning ismingiz: *${name}*\n\n` +
          `📱 Endi telefon raqamingizni yuboring.`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              keyboard: [
                [{ text: '📱 Telefon raqamini yuborish', request_contact: true }]
              ],
              resize_keyboard: true,
              one_time_keyboard: true
            } as any
          }
        );
        return;
      }

      // Обработка регистрации телефона (только текстовый ввод, контакт обрабатывается выше)
      if (state.action === 'registration_phone') {
        // Если это контакт, он уже обработан выше, пропускаем
        if (msg.contact) {
          return;
        }

        let phoneNumber: string | null = null;

        // Парсим телефон из текста
        if (msg.text) {
          const phoneText = msg.text.trim();
          // Проверяем формат телефона
          if (/^\+?[0-9]{10,15}$/.test(phoneText.replace(/\s/g, ''))) {
            phoneNumber = phoneText.replace(/\s/g, '');
            if (!phoneNumber.startsWith('+')) {
              // Если начинается с 998, добавляем +
              if (phoneNumber.startsWith('998')) {
                phoneNumber = '+' + phoneNumber;
              } else {
                phoneNumber = '+998' + phoneNumber;
              }
            }
          }
        }

        if (!phoneNumber) {
          await this.bot!.sendMessage(
            chatId,
            `❌ Noto'g'ri telefon raqami.\n\n` +
            `Iltimos, telefon raqamingizni to'g'ri formatda yuboring:\n` +
            `• +998901234567\n` +
            `• 998901234567\n` +
            `• 901234567\n\n` +
            `Yoki "📱 Telefon raqamini yuborish" tugmasini bosing.`,
            {
              reply_markup: {
                keyboard: [
                  [{ text: '📱 Telefon raqamini yuborish', request_contact: true }]
                ],
                resize_keyboard: true,
                one_time_keyboard: true
              } as any
            }
          );
          return;
        }

        // Обновляем телефон пользователя
        const user = await prisma.user.findUnique({
          where: { id: state.userId }
        });

        if (user) {
          // Обновляем телефон и tg_id
          await prisma.user.update({
            where: { id: user.id },
            data: {
              phone_number: phoneNumber,
              tg_id: String(userId),
            }
          });

          // Очищаем состояние
          this.userStates.delete(userId);

          // Перезагружаем пользователя
          const updatedUser = await prisma.user.findUnique({
            where: { id: user.id }
          });

          if (updatedUser) {
            // Показываем главную страницу
            await this.bot!.sendMessage(
              chatId,
              `✅ *Ro'yxatdan o'tdingiz!*\n\n` +
              `� Ism: *${updatedUser.name}*\n` +
              `📱 Telefon: *${phoneNumber}*\n\n` +
              `🎉 Tabriklayimiz! Endi bron qila olasiz.`,
              { parse_mode: 'Markdown' }
            );
            await this.showHomePage(chatId, updatedUser);
          }
        }
      } else if (state.action === 'help_message') {
        // Обработка сообщения помощи - отправляем доктору
        const helpMessage = msg.text?.trim() || '';

        if (!helpMessage || helpMessage.length < 5) {
          await this.bot!.sendMessage(
            chatId,
            `❌ Iltimos, savolingizni yozing (kamida 5 belgi).`
          );
          return;
        }

        const user = await this.getUserByTelegramId(userId);
        if (!user) {
          await this.bot!.sendMessage(chatId, '❌ Foydalanuvchi topilmadi.');
          this.userStates.delete(userId);
          return;
        }

        // Находим доктора
        const doctor = await prisma.user.findFirst({
          where: { role: UserRole.DOCTOR, working: true }
        });

        if (doctor && doctor.tg_id) {
          // Отправляем сообщение доктору
          await this.bot!.sendMessage(
            parseInt(doctor.tg_id),
            `💬 *Yangi yordam so'rovi*\n\n` +
            `👤 Foydalanuvchi: ${user.name}\n` +
            `📱 Telefon: ${user.phone_number || 'N/A'}\n\n` +
            `💬 Xabar:\n${helpMessage}`,
            { parse_mode: 'Markdown' }
          );

          await this.bot!.sendMessage(
            chatId,
            `✅ *Xabaringiz yuborildi!*\n\n` +
            `Doktor sizga tez orada javob beradi.`,
            { parse_mode: 'Markdown' }
          );
        } else {
          await this.bot!.sendMessage(
            chatId,
            `❌ Doktor hozir mavjud emas. Iltimos, keyinroq urinib ko'ring.`
          );
        }

        // Очищаем состояние и возвращаем на главную
        this.userStates.delete(userId);
        if (user) {
          await this.showHomePage(chatId, user);
        }
      } else if (state.action === 'booking_service') {
        // Обработка выбора сервиса (текстовый ввод не используется, только callback)
        // Это состояние используется только для хранения данных
      }
    } catch (error: any) {
      console.error('Error in handleStateMessage:', error);
      await this.bot!.sendMessage(chatId, '❌ Xatolik yuz berdi. Iltimos, keyinroq urinib ko\'ring.');
      this.userStates.delete(userId);
    }
  }

  /**
   * Получить пользователя по Telegram ID
   */
  private async getUserByTelegramId(userId?: number) {
    if (!userId) return null;

    try {
      // Ищем по tg_id (основной способ) - точное совпадение
      let user = await prisma.user.findFirst({
        where: {
          tg_id: String(userId),
        },
      });

      console.log(`[getUserByTelegramId] Search by tg_id=${userId}, found:`, user ? `User ID ${user.id}, phone: ${user.phone_number || 'null'}` : 'not found');

      // Если не нашли, пробуем найти по username как fallback
      if (!user && this.bot) {
        try {
          const chat = await this.bot.getChat(userId).catch(() => null);
          if (chat && 'username' in chat && chat.username) {
            user = await prisma.user.findFirst({
              where: {
                tg_username: chat.username,
              },
            });

            console.log(`[getUserByTelegramId] Search by username=${chat.username}, found:`, user ? `User ID ${user.id}, phone: ${user.phone_number || 'null'}` : 'not found');

            // Если нашли по username, обновляем tg_id
            if (user && !user.tg_id) {
              await prisma.user.update({
                where: { id: user.id },
                data: { tg_id: String(userId) },
              });
              console.log(`[getUserByTelegramId] Updated tg_id for user ${user.id}`);
            }
          }
        } catch (error) {
          // Игнорируем ошибки получения чата
          console.error('[getUserByTelegramId] Error getting chat:', error);
        }
      }

      return user;
    } catch (error: any) {
      // Если ошибка Edge Runtime, возвращаем null
      if (error.message?.includes('Edge Runtime')) {
        console.warn('getUserByTelegramId: Edge Runtime detected');
        return null;
      }
      console.error('[getUserByTelegramId] Error:', error);
      throw error;
    }
  }

  /**
   * Получить доступные месяцы (текущий месяц + следующие 2 месяца)
   */
  private getAvailableMonths(): string[] {
    const months: string[] = [];
    const today = new Date();

    for (let i = 0; i < 3; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      months.push(`${year}-${month}`);
    }

    return months;
  }

  /**
   * Форматировать название месяца для отображения
   */
  private formatMonthName(monthKey: string): string {
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString('uz-UZ', { month: 'long', year: 'numeric' });
  }

  /**
   * Создать клавиатуру с месяцами
   */
  private createMonthKeyboard(months: string[]): TelegramBot.InlineKeyboardButton[][] {
    const buttons: TelegramBot.InlineKeyboardButton[][] = [];

    months.forEach(monthKey => {
      const monthName = this.formatMonthName(monthKey);
      buttons.push([{
        text: `📅 ${monthName}`,
        callback_data: `month_${monthKey}`
      }]);
    });

    // Добавляем кнопку "Назад" на главное меню
    buttons.push([{
      text: '🏠 Bosh sahifa',
      callback_data: 'start'
    }]);

    return buttons;
  }

  /**
   * Получить доступные дни для выбранного месяца
   */
  private getAvailableDaysForMonth(monthKey: string): number[] {
    const [year, month] = monthKey.split('-').map(Number);
    const today = new Date();
    const days: number[] = [];

    // Получаем первый и последний день месяца
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);

    // Начинаем с сегодняшнего дня, если месяц текущий
    const startDay = (year === today.getFullYear() && month === today.getMonth() + 1)
      ? today.getDate()
      : 1;

    // Максимум 30 дней от сегодня
    const maxDate = new Date(today);
    maxDate.setDate(today.getDate() + 30);

    for (let day = startDay; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month - 1, day);
      // Проверяем, что дата не превышает 30 дней от сегодня
      if (date <= maxDate) {
        days.push(day);
      } else {
        break;
      }
    }

    return days;
  }

  /**
   * Создать клавиатуру с днями месяца
   */
  private createDayKeyboard(days: number[], monthKey: string): TelegramBot.InlineKeyboardButton[][] {
    const buttons: TelegramBot.InlineKeyboardButton[][] = [];
    const chunkSize = 4; // 4 кнопки в ряд (для лучшей читаемости и компактности)
    const [year, month] = monthKey.split('-').map(Number);

    for (let i = 0; i < days.length; i += chunkSize) {
      const row = days.slice(i, i + chunkSize).map(day => {
        const date = new Date(year, month - 1, day);
        const dayName = date.toLocaleDateString('uz-UZ', { weekday: 'short' });
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        // Выделяем выходные дни (суббота и воскресенье)
        const dayOfWeek = date.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const emoji = isWeekend ? '📌' : '📆';

        return {
          text: `${emoji} ${day}`,
          callback_data: `date_${dateStr}`
        };
      });
      buttons.push(row);
    }

    // Добавляем кнопку "Назад" для возврата к выбору месяца
    buttons.push([{
      text: '◀️ Oyni qayta tanlash',
      callback_data: 'book_new'
    }]);

    return buttons;
  }

  /**
   * Создать клавиатуру с временами
   */
  private createTimeKeyboard(times: string[]): TelegramBot.InlineKeyboardButton[][] {
    const buttons: TelegramBot.InlineKeyboardButton[][] = [];
    const chunkSize = 2; // 2 кнопки в ряд (для лучшей читаемости)

    for (let i = 0; i < times.length; i += chunkSize) {
      const row = times.slice(i, i + chunkSize).map(time => ({
        text: `⏰ ${time}`,
        callback_data: `time_${time}`
      }));
      buttons.push(row);
    }

    // Добавляем кнопку "Назад"
    buttons.push([
      { text: '⬅️ Назад', callback_data: 'back_to_date' }
    ]);

    return buttons;
  }

  /**
   * Получить доступные слоты для даты (с интервалом 30 минут)
   */
  private async getAvailableSlots(doctorId: string, date: string): Promise<string[]> {
    const bookingService = new BookingService();
    const slots: string[] = [];

    // Рабочие часы (9:00 - 18:00)
    const startHour = 9;
    const endHour = 18;

    // Генерируем слоты каждые 30 минут
    for (let hour = startHour; hour < endHour; hour++) {
      // :00
      const time00 = `${hour.toString().padStart(2, '0')}:00`;
      try {
        const isAvailable00 = await bookingService.checkTimeSlotAvailability(
          doctorId,
          date,
          time00,
          30
        );
        if (isAvailable00) {
          slots.push(time00);
        }
      } catch (error) {
        // Игнорируем ошибки проверки
      }

      // :30
      const time30 = `${hour.toString().padStart(2, '0')}:30`;
      try {
        const isAvailable30 = await bookingService.checkTimeSlotAvailability(
          doctorId,
          date,
          time30,
          30
        );
        if (isAvailable30) {
          slots.push(time30);
        }
      } catch (error) {
        // Игнорируем ошибки проверки
      }
    }

    return slots;
  }

  /**
   * Отправить сообщение пользователю по Telegram ID
   */
  async sendMessage(chatId: number | string, message: string, options?: TelegramBot.SendMessageOptions): Promise<boolean> {
    await this.ensureInitialized();

    if (!this.bot) {
      console.warn('Telegram Bot not initialized');
      return false;
    }

    try {
      await this.bot.sendMessage(chatId, message, options);
      return true;
    } catch (error: any) {
      console.error(`Error sending message to ${chatId}:`, error.message);
      if (error.response?.statusCode === 403 || error.response?.statusCode === 400) {
        console.warn(`User ${chatId} blocked the bot or chat not found`);
      }
      return false;
    }
  }

  /**
   * Отправить сообщение с изображением
   */
  async sendPhoto(chatId: number | string, photo: string | Buffer, caption?: string, options?: TelegramBot.SendPhotoOptions): Promise<boolean> {
    await this.ensureInitialized();

    if (!this.bot) {
      console.warn('Telegram Bot not initialized');
      return false;
    }

    try {
      await this.bot.sendPhoto(chatId, photo, { caption, ...options });
      return true;
    } catch (error: any) {
      console.error(`Error sending photo to ${chatId}:`, error.message);
      if (error.response?.statusCode === 403 || error.response?.statusCode === 400) {
        console.warn(`User ${chatId} blocked the bot or chat not found`);
      }
      return false;
    }
  }

  /**
   * Отправить broadcast сообщение нескольким пользователям
   */
  async sendBroadcast(chatIds: (number | string)[], message: string, options?: TelegramBot.SendMessageOptions): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    for (const chatId of chatIds) {
      const success = await this.sendMessage(chatId, message, options);
      if (success) {
        sent++;
      } else {
        failed++;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return { sent, failed };
  }

  /**
   * Отправить broadcast сообщение с изображением
   */
  async sendBroadcastPhoto(chatIds: (number | string)[], photo: string | Buffer, caption?: string, options?: TelegramBot.SendPhotoOptions): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    for (const chatId of chatIds) {
      const success = await this.sendPhoto(chatId, photo, caption, options);
      if (success) {
        sent++;
      } else {
        failed++;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return { sent, failed };
  }

  /**
   * Отправить уведомление о новом бронировании
   */
  async sendBookingNotification(chatId: number | string, bookingData: {
    date: string;
    time: string;
    doctorName: string;
    status: string;
  }): Promise<boolean> {
    const message = `📅 Yangi bron qilindi!\n\n` +
      `📆 Sana: ${bookingData.date}\n` +
      `⏰ Vaqt: ${bookingData.time}\n` +
      `👨‍⚕️ Shifokor: ${bookingData.doctorName}\n` +
      `📊 Holat: ${bookingData.status}`;

    return this.sendMessage(chatId, message);
  }

  /**
   * Отправить уведомление об изменении статуса бронирования
   */
  async sendBookingStatusUpdate(chatId: number | string, bookingData: {
    date: string;
    time: string;
    doctorName: string;
    oldStatus: string;
    newStatus: string;
  }): Promise<boolean> {
    const message = `🔄 Bron holati yangilandi!\n\n` +
      `📆 Sana: ${bookingData.date}\n` +
      `⏰ Vaqt: ${bookingData.time}\n` +
      `👨‍⚕️ Shifokor: ${bookingData.doctorName}\n` +
      `📊 Eski holat: ${bookingData.oldStatus}\n` +
      `✅ Yangi holat: ${bookingData.newStatus}`;

    return this.sendMessage(chatId, message);
  }

  /**
   * Webhook handler for regular messages
   */
  async handleWebhookMessage(message: TelegramBot.Message): Promise<void> {
    try {
      await this.ensureInitialized();

      const chatId = message.chat?.id;
      const userId = message.from?.id;

      if (!chatId || !userId) {
        console.warn('[Webhook] Invalid message: missing chatId or userId');
        return;
      }

      console.log(`[Webhook] Received message: userId=${userId}, chatId=${chatId}, text="${message.text?.substring(0, 50) || 'no text'}..."`);

      // Handle contact sharing
      if (message.contact && userId) {
        const phoneNumber = message.contact.phone_number;
        let formattedPhone = phoneNumber;
        if (!formattedPhone.startsWith('+')) {
          formattedPhone = '+' + formattedPhone;
        }

        let user = await prisma.user.findFirst({
          where: {
            OR: [
              { tg_id: String(userId) },
              { tg_username: message.from?.username },
            ],
          },
        });

        if (!user) {
          user = await prisma.user.create({
            data: {
              tg_id: String(userId),
              tg_username: message.from?.username,
              role: UserRole.CLIENT,
              name: message.from?.first_name || 'Foydalanuvchi',
              phone_number: formattedPhone,
            },
          });
        } else {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              phone_number: formattedPhone,
              tg_id: String(userId),
            },
          });
        }

        this.userStates.delete(userId);

        const updatedUser = await prisma.user.findUnique({
          where: { id: user.id }
        });

        if (this.bot && updatedUser) {
          await this.bot.sendMessage(
            chatId,
            `✅ *Ro'yxatdan o'tdingiz!*\n\n📱 Telefon: ${formattedPhone}\n\nSiz bosh sahifadasiz.`,
            { parse_mode: 'Markdown' }
          );
          await this.showHomePage(chatId, updatedUser);
        }
        return;
      }

      // Handle text messages based on user state
      if (userId) {
        const state = this.userStates.get(userId);
        if (state && message) {
          await this.handleStateMessage(message, state);
          return;
        }
      }

      // If no handler matched, send default response
      if (this.bot) {
        await this.bot.sendMessage(
          chatId,
          '🤔 Tushunmadim. Yordam uchun /help buyrug\'ini yuboring.',
        );
      }
    } catch (error: any) {
      console.error('[Telegram Bot] Error in handleWebhookMessage:', error?.message || error);
    }
  }

  /**
   * Webhook handler for callback queries
   */
  async handleWebhookCallback(query: TelegramBot.CallbackQuery): Promise<void> {
    try {
      await this.ensureInitialized();

      // Delegate to existing callback query handler
      await this.handleCallbackQuery(query);
    } catch (error: any) {
      console.error('[Telegram Bot] Error in handleWebhookCallback:', error?.message || error);
    }
  }

  /**
   * Остановить polling
   */
  async stopPolling(): Promise<void> {
    if (this.bot && this.pollingStarted) {
      try {
        await this.bot.stopPolling();
        this.pollingStarted = false;
        console.log('✅ Telegram Bot polling stopped');
      } catch (error: any) {
        console.error('❌ Error stopping Telegram Bot polling:', error?.message || error);
      }
    }
  }

  /**
   * Получить экземпляр бота
   */
  getBot(): TelegramBot | null {
    return this.bot;
  }
}

// Singleton instance - создается при импорте, но инициализируется лениво
const globalForTelegram = globalThis as unknown as {
  telegramService?: TelegramService;
};

export const telegramService = globalForTelegram.telegramService ?? new TelegramService();

if (!globalForTelegram.telegramService) {
  globalForTelegram.telegramService = telegramService;
}

// Инициализируем бота при первом API запросе (не в Edge Runtime)
// Инициализация будет выполнена через ensureInitialized() при первом использовании

export default telegramService;
