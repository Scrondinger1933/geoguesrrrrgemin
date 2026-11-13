import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { DecodedIdToken } from 'firebase-admin/auth';
import { getUserByUid } from '../db/users.ts';

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

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Empty token' });
  }

  // 1. Direct Cloud SQL User lookup (supports email-verified accounts and persistent UIDs)
  try {
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
    console.error('Failed to query user by UID in Cloud SQL:', e);
  }

  // 2. Firebase Auth JWT verification (only if token is a valid 3-part base64 JWT)
  if (token.split('.').length === 3) {
    try {
      const decodedToken = await adminAuth.verifyIdToken(token);
      req.user = decodedToken;
      return next();
    } catch (error: any) {
      console.warn('Firebase ID token verification failed:', error?.message || error);
    }
  }

  return res.status(401).json({ error: 'Unauthorized: Invalid token' });
};
