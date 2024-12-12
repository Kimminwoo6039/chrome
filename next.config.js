// next.config.js

const fs = require('fs');
const path = require('path');
const withPWA = require('next-pwa');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // PWA 관련 설정
  poweredByHeader: false,
  reactStrictMode: false,
  images: {
    unoptimized: true // base64 이미지를 위해 필요할 수 있음
  },
  typescript: {
    // !! WARN !!
    // 프로덕션 환경에서는 권장되지 않습니다!
    ignoreBuildErrors: true,
  },
  // HTTPS 서버 설정
  server: {
    https: {
      key: fs.readFileSync(path.join(process.cwd(), 'private_key.pem')),
      cert: fs.readFileSync(path.join(process.cwd(), 'certificate.pem')),
    },
    // 기본 포트 설정 (선택사항)
    port: 8089
  },

  // 보안 헤더 설정
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          }
        ],
      },
    ];
  },

  // PWA를 위한 캐싱 설정
  async rewrites() {
    return [
      {
        source: '/service-worker.js',
        destination: '/_next/static/service-worker.js',
      },
    ];
  },
};

module.exports = withPWA({
  pwa: {
    dest: 'public',
    register: true,
    skipWaiting: true,
  },
});

module.exports = nextConfig;