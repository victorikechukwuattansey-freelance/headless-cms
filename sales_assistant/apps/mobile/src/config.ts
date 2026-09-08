const fromEnv = process.env.EXPO_PUBLIC_API_URL;
if (fromEnv) {
  process.env.API_URL = fromEnv;
} else if (process.env.NODE_ENV === 'production') {
  throw new Error('EXPO_PUBLIC_API_URL must be set in production builds');
} else {
  process.env.API_URL = 'http://localhost:3000';
}
