import express from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.ts';
import { getOrCreateUser } from '../db/users.ts';
import {
  getEmailProviderStatus,
  saveEmailConfiguration,
  saveSmtpConfig,
  verifySmtpConnection,
  testAndSendLiveEmail,
  maskEmail,
  getLatestEmailFor,
  type EmailProviderType,
} from '../lib/email.ts';
import { authService } from './authService.ts';
import { OtpError } from './otpService.ts';

function getClientIp(req: express.Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) {
    return fwd.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

function handleAuthError(res: express.Response, err: any, fallbackMsg: string) {
  if (err instanceof OtpError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      ...(err.retryAfterSeconds ? { retryAfterSeconds: err.retryAfterSeconds } : {}),
    });
  }
  return res.status(400).json({
    success: false,
    error: err?.message || fallbackMsg,
  });
}

export function createAuthRouter() {
  const router = express.Router();

  // Sync Firebase OAuth user with PostgreSQL
  router.post('/sync', requireAuth, async (req: AuthRequest, res) => {
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
    } catch (error) {
      console.error('Failed to sync user:', error);
      res.status(500).json({ error: 'Failed to sync user' });
    }
  });

  // 1. Account Registration -> Issue & Email 6-digit OTP (10 min TTL)
  router.post('/request-register-code', async (req, res) => {
    try {
      const { email, password, displayName, avatarUrl } = req.body || {};
      const result = await authService.requestRegistrationCode({
        email,
        password,
        displayName,
        avatarUrl,
        clientIp: getClientIp(req),
      });
      res.json(result);
    } catch (err) {
      handleAuthError(res, err, 'Erreur lors de la demande d’inscription.');
    }
  });

  // 2. Verify 6-digit OTP & Activate Account
  router.post('/confirm-register-code', async (req, res) => {
    try {
      const { email, code } = req.body || {};
      const result = await authService.confirmRegistrationCode({
        email,
        code,
        clientIp: getClientIp(req),
      });
      res.json(result);
    } catch (err) {
      handleAuthError(res, err, 'Code invalide ou expiré.');
    }
  });

  // 3. Login with Email + Password
  router.post('/login-password', async (req, res) => {
    try {
      const { email, password } = req.body || {};
      const result = await authService.loginWithPassword({ email, password });
      res.json(result);
    } catch (err) {
      handleAuthError(res, err, 'Identifiants incorrects.');
    }
  });

  // 4. Forgot Password Step 1 -> Request 6-digit OTP via SMTP (NO links)
  router.post('/request-reset-code', async (req, res) => {
    try {
      const { email } = req.body || {};
      const result = await authService.requestResetCode({
        email,
        clientIp: getClientIp(req),
      });
      res.json(result);
    } catch (err) {
      handleAuthError(res, err, 'Erreur lors de la demande de réinitialisation.');
    }
  });

  // 5. Forgot Password Step 2 -> Verify 6-digit OTP validity before showing new password UI
  router.post('/verify-reset-code', async (req, res) => {
    try {
      const { email, code } = req.body || {};
      const result = await authService.verifyResetCode({
        email,
        code,
        clientIp: getClientIp(req),
      });
      res.json(result);
    } catch (err) {
      handleAuthError(res, err, 'Code invalide ou expiré.');
    }
  });

  // 6. Forgot Password Step 3 -> Set New Password & Immediately Invalidate Code
  router.post('/confirm-reset-code', async (req, res) => {
    try {
      const { email, code, newPassword } = req.body || {};
      const result = await authService.confirmPasswordReset({
        email,
        code,
        newPassword,
        clientIp: getClientIp(req),
      });
      res.json(result);
    } catch (err) {
      handleAuthError(res, err, 'Échec de réinitialisation du mot de passe.');
    }
  });

  // SMTP / Email Provider Status (safe non-secret metadata only)
  router.get('/smtp-status', (_req, res) => {
    res.json(getEmailProviderStatus());
  });
  router.get('/email-status', (_req, res) => {
    res.json(getEmailProviderStatus());
  });

  // Save and test Email Configuration
  router.post('/configure-email', async (req, res) => {
    try {
      const {
        provider = 'gmail',
        user,
        pass,
        host,
        port,
        secure,
        fromEmail,
        fromName,
        resendApiKey,
        brevoApiKey,
        testRecipient,
      } = req.body as {
        provider?: EmailProviderType;
        user?: string;
        pass?: string;
        host?: string;
        port?: number;
        secure?: boolean;
        fromEmail?: string;
        fromName?: string;
        resendApiKey?: string;
        brevoApiKey?: string;
        testRecipient?: string;
      };

      if (provider === 'gmail' || provider === 'smtp') {
        if (!user || !pass) {
          return res.status(400).json({ error: 'Email expéditeur et mot de passe / App Password requis.' });
        }
        const targetHost = (host || (provider === 'gmail' ? 'smtp.gmail.com' : '')).trim();
        const targetPort = port ? Number(port) : 587;
        const isSecure = typeof secure === 'boolean' ? secure : targetPort === 465;
        if (!targetHost) {
          return res.status(400).json({ error: 'Serveur SMTP (host) requis.' });
        }
        await verifySmtpConnection(user.trim(), pass.trim(), targetHost, targetPort, isSecure);
        saveEmailConfiguration({
          provider,
          user: user.trim(),
          pass: pass.trim(),
          host: targetHost,
          port: targetPort,
          secure: isSecure,
          fromEmail: (fromEmail || user).trim(),
          fromName: (fromName || 'GeoApex').trim(),
        });
      } else if (provider === 'brevo') {
        if (!brevoApiKey || brevoApiKey.trim().length < 10) {
          return res.status(400).json({ error: 'Clé API Brevo valide requise.' });
        }
        saveEmailConfiguration({
          provider: 'brevo',
          brevoApiKey: brevoApiKey.trim(),
          fromEmail: (fromEmail || user || 'studiomaldecenasoeiro@gmail.com').trim(),
          fromName: (fromName || 'GeoApex').trim(),
        });
      } else if (provider === 'resend') {
        if (!resendApiKey || resendApiKey.trim().length < 10) {
          return res.status(400).json({ error: 'Clé API Resend valide requise (commence par re_).' });
        }
        saveEmailConfiguration({
          provider: 'resend',
          resendApiKey: resendApiKey.trim(),
          fromEmail: (fromEmail || user || 'onboarding@resend.dev').trim(),
          fromName: (fromName || 'GeoApex').trim(),
        });
      }

      const recipient = (testRecipient || user || 'alexandre.soeirofrance@gmail.com').trim();
      const testRes = await testAndSendLiveEmail(recipient);

      return res.json({
        success: true,
        status: getEmailProviderStatus(),
        messageId: testRes.messageId,
        relayType: testRes.relayType,
        message: `Messagerie réelle (${testRes.relayType.toUpperCase()}) configurée et e-mail test envoyé à ${recipient}.`,
      });
    } catch (err: any) {
      console.error('[EMAIL CONFIG ERROR]', err.message);
      return res.status(400).json({ error: err.message || 'Impossible de valider la configuration SMTP.' });
    }
  });

  router.post('/configure-smtp', async (req, res) => {
    try {
      const { user, pass, host, port, secure, fromName } = req.body;
      if (!user || !pass) {
        return res.status(400).json({ error: 'Identifiant (email) et mot de passe requis.' });
      }
      const cleanUser = user.trim();
      const cleanPass = pass.trim();
      const cleanHost = (host || 'smtp.gmail.com').trim();
      const cleanPort = port ? parseInt(port, 10) : 587;
      const isSecure = typeof secure === 'boolean' ? secure : cleanPort === 465;

      await verifySmtpConnection(cleanUser, cleanPass, cleanHost, cleanPort, isSecure);
      saveSmtpConfig({
        user: cleanUser,
        pass: cleanPass,
        host: cleanHost,
        port: cleanPort,
        secure: isSecure,
        fromName: fromName ? fromName.trim() : 'GeoApex',
      });

      res.json({
        success: true,
        message: 'Identifiants SMTP validés et enregistrés avec succès.',
        user: maskEmail(cleanUser),
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Impossible de vérifier la configuration SMTP.' });
    }
  });

  router.get('/latest-email', (req, res) => {
    const email = req.query.email as string;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Paramètre email manquant.' });
    }
    const latest = getLatestEmailFor(email);
    // Never leak OTP code via public endpoint
    res.json({
      success: true,
      email: latest ? { ...latest, code: undefined } : null,
    });
  });

  const handleTestSmtp = async (req: express.Request, res: express.Response) => {
    try {
      const targetEmail = (
        req.body?.targetEmail ||
        req.query?.targetEmail ||
        'alexandre.soeirofrance@gmail.com'
      )
        .toString()
        .trim()
        .toLowerCase();

      const result = await testAndSendLiveEmail(targetEmail);
      const status = getEmailProviderStatus();

      return res.json({
        success: true,
        verified: true,
        isRealSmtp: true,
        deliveredToRealInbox: true,
        relayType: result.relayType,
        messageId: result.messageId,
        recipient: maskEmail(targetEmail),
        host: status.host,
        port: status.port,
        message: `E-mail réel expédié dans la boîte de ${targetEmail} via ${result.relayType.toUpperCase()}.`,
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        verified: false,
        deliveredToRealInbox: false,
        error: err.message || 'Impossible d’envoyer l’e-mail réel.',
      });
    }
  };

  router.post('/test-smtp', handleTestSmtp);
  router.get('/test-smtp', handleTestSmtp);

  return router;
}
