export default function Home() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: '40rem' }}>
      <h1>Telegram bot backend</h1>
      <p>
        This project only serves the booking Telegram bot and its webhook. To receive messages with{' '}
        <strong>long polling</strong>, run a separate Node process:
      </p>
      <pre
        style={{
          background: '#111',
          color: '#eee',
          padding: '1rem',
          borderRadius: 8,
          overflow: 'auto',
        }}
      >
        npm run bot
      </pre>
      <p>
        Keep <code>.env</code> with <code>DATABASE_URL</code> and <code>BOT_TOKEN</code>. For production with
        Vercel, set <code>TELEGRAM_USE_WEBHOOK=true</code> and point Telegram to <code>/api/telegram/webhook</code>.
      </p>
    </div>
  );
}
