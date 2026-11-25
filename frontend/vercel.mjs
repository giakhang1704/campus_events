// Vercel project Root Directory: frontend. Set BACKEND_ORIGIN in each deploy environment.
const raw = process.env.BACKEND_ORIGIN;
if (!raw) throw new Error('Set BACKEND_ORIGIN to the HTTPS origin of the Render backend.');
const backend = new URL(raw);
if (backend.protocol !== 'https:' || backend.username || backend.password || backend.search || backend.hash || backend.pathname !== '/') {
  throw new Error('BACKEND_ORIGIN must be an HTTPS origin without credentials, path or query.');
}

export const config = {
  framework: 'angular',
  installCommand: 'npm ci',
  buildCommand: 'npm run build',
  outputDirectory: 'dist/campus-events/browser',
  rewrites: [
    { source: '/api/:path*', destination: `${backend.origin}/api/:path*` },
    { source: '/((?!api(?:/|$)|assets(?:/|$)|.*\\.).*)', destination: '/index.html' },
  ],
  headers: [
    { source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'private, no-store' }] },
    { source: '/(.*)', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(self), microphone=()' },
    ] },
  ],
};
