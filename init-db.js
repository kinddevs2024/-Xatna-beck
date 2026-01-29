// Простой скрипт для инициализации базы данных
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/init',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
};

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('Response:', data);
    if (res.statusCode === 200) {
      console.log('✅ База данных успешно инициализирована!');
    } else {
      console.log('❌ Ошибка инициализации:', res.statusCode);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Ошибка запроса:', error.message);
  console.log('Убедитесь, что сервер запущен на http://localhost:3000');
});

req.end();
