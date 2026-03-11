const DEFAULT_ORIGINS = [
    'http://localhost:5173',
    'http://localhost:80',
    'http://localhost',
    'https://p-chater-q.vercel.app',
].join(',');
const DEFAULT_ORIGIN_PATTERNS = 'https://*.vercel.app';

const normalizeOrigin = (origin) => String(origin || '').replace(/\/+$/, '');

const parseCsv = (value) => String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

const escapeRegex = (value) => value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');

const patternToRegex = (pattern) => new RegExp(
    `^${escapeRegex(normalizeOrigin(pattern)).replace(/\*/g, '.*')}$`,
    'i'
);

const allowedOrigins = parseCsv(process.env.CORS_ORIGINS || DEFAULT_ORIGINS)
    .map(normalizeOrigin);

const allowedOriginPatterns = parseCsv(process.env.CORS_ORIGIN_PATTERNS || DEFAULT_ORIGIN_PATTERNS)
    .map(patternToRegex);

const isOriginAllowed = (origin) => {
    const normalizedOrigin = normalizeOrigin(origin);

    if (allowedOrigins.includes(normalizedOrigin)) {
        return true;
    }

    return allowedOriginPatterns.some(pattern => pattern.test(normalizedOrigin));
};

const corsOptions = {
    origin: function (origin, callback) {
        // Cho phép requests không có origin (mobile apps, curl, Postman...)
        if (!origin) return callback(null, true);

        if (isOriginAllowed(origin)) {
            callback(null, true);
        } else {
            console.warn(`⚠️ CORS blocked origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
    optionsSuccessStatus: 204,
};

module.exports = { corsOptions, allowedOrigins, allowedOriginPatterns, isOriginAllowed };
