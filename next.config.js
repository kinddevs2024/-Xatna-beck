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
      // Перенаправление /doctor на /api/doctor
      {
        source: '/doctor/:path*',
        destination: '/api/doctor/:path*',
      },
      // Перенаправление /bookings на /api/bookings
      {
        source: '/bookings/:path*',
        destination: '/api/bookings/:path*',
      },
      // Перенаправление /doctor-services на /api/doctor-services
      {
        source: '/doctor-services/:path*',
        destination: '/api/doctor-services/:path*',
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
