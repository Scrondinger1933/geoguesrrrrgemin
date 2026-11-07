import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { DecodedIdToken } from 'firebase-admin/auth';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1];

  // 1. Support Cloud SQL verified email accounts
  if (token.startsWith('email_')) {
    try {
      const { getUserByUid } = await import('../db/users.ts');
      const user = await getUserByUid(token);
      if (user) {
        req.user = {
          uid: user.uid,
          email: user.email,
          name: user.displayName || '',
          picture: user.avatarUrl || '',
        } as any;
        return next();
      }
    } catch (e) {
      console.error('Failed to verify email account token:', e);
    }
  }

  // 2. Support Firebase Auth ID tokens
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};
