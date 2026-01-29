/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // CORS обрабатывается в middleware.ts динамически
  async rewrites() {
    return [
      // Перенаправление /auth/* на /api/auth/* для совместимости
      {
        source: '/auth/:path*',
        destination: '/api/auth/:path*',
      },
      // Перенаправление /users на /api/users
      {
        source: '/users/:path*',
        destination: '/api/users/:path*',
      },
      // Перенаправление /admin на /api/admin
      {
        source: '/admin/:path*',
        destination: '/api/admin/:path*',
      },
      // Перенаправление /barber на /api/barber
      {
        source: '/barber/:path*',
        destination: '/api/barber/:path*',
      },
      // Перенаправление /bookings на /api/bookings
      {
        source: '/bookings/:path*',
        destination: '/api/bookings/:path*',
      },
      // Перенаправление /barber-services на /api/barber-services
      {
        source: '/barber-services/:path*',
        destination: '/api/barber-services/:path*',
      },
      // Перенаправление /service-categories на /api/service-categories
      {
        source: '/service-categories/:path*',
        destination: '/api/service-categories/:path*',
      },
      // Перенаправление /client на /api/client
      {
        source: '/client/:path*',
        destination: '/api/client/:path*',
      },
      // Перенаправление /posts на /api/posts
      {
        source: '/posts/:path*',
        destination: '/api/posts/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
