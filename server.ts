import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { requireAuth, AuthRequest } from './src/middleware/auth.ts';
import { getOrCreateUser, recordGameScore, getTopLeaderboard } from './src/db/users.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  app.use(express.json());

  // 1. Sync User Profile from Firebase to Cloud SQL PostgreSQL
  app.post('/api/auth/sync', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      const email = req.user?.email;
      const name = req.body.displayName || req.user?.name;
      const avatar = req.body.avatarUrl || req.user?.picture;

      if (!uid || !email) {
        return res.status(400).json({ error: 'UID and email are required' });
      }

      const user = await getOrCreateUser(uid, email, name, avatar);
      res.json({ user });
    } catch (error: any) {
      console.error('Failed to sync user:', error);
      res.status(500).json({ error: 'Failed to sync user' });
    }
  });

  // 2. Record Game Score & Update Statistics
  app.post('/api/scores', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      if (!uid) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { mode, score, roundsCompleted, isVictory } = req.body;
      if (!mode || typeof score !== 'number' || typeof roundsCompleted !== 'number') {
        return res.status(400).json({ error: 'Invalid score payload' });
      }

      await recordGameScore(uid, mode, score, roundsCompleted, !!isVictory);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to save score:', error);
      res.status(500).json({ error: 'Failed to save score' });
    }
  });

  // 3. Global Leaderboard from Cloud SQL
  app.get('/api/leaderboard', async (_req, res) => {
    try {
      const leaderboard = await getTopLeaderboard(10);
      res.json({ leaderboard });
    } catch (error: any) {
      console.error('Failed to fetch leaderboard:', error);
      res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
  });

  // 4. Vite Middleware (Dev) or Static Assets (Production)
  if (!isProduction) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT} in ${isProduction ? 'production' : 'development'} mode`);
  });
}

startServer();
