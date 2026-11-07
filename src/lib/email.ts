import nodemailer, { type Transporter } from 'nodemailer';
import fs from 'fs';
import path from 'path';

interface SmtpConfig {
  host?: string;
  port?: number;
  secure?: boolean;
  user: string;
  pass: string;
  fromName?: string;
}

const CONFIG_PATH = path.resolve(process.cwd(), 'smtp-config.json');

// Get active SMTP configuration
export function getActiveSmtpConfig(): SmtpConfig | null {
  // 1. Check runtime smtp-config.json
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const data = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      if (data.user && data.pass) {
        return data;
      }
    } catch (e) {
      console.error('Failed to read smtp-config.json:', e);
    }
  }

  // 2. Check process.env
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    return {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
      secure: process.env.SMTP_PORT === '465',
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
      fromName: process.env.SMTP_FROM_NAME || 'GeoApex 3D',
    };
  }

  return null;
}

// Save SMTP configuration
export function saveSmtpConfig(config: SmtpConfig): void {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

// Create appropriate transporter
async function getTransporter(): Promise<{
  transporter: Transporter;
  isRealSmtp: boolean;
  senderAddress: string;
}> {
  const config = getActiveSmtpConfig();

  if (config && config.user && config.pass) {
    const host = config.host || (config.user.endsWith('@gmail.com') ? 'smtp.gmail.com' : 'smtp.gmail.com');
    const port = config.port || 587;
    const secure = config.secure ?? (port === 465);

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    return {
      transporter,
      isRealSmtp: true,
      senderAddress: `"${config.fromName || 'GeoApex'}" <${config.user}>`,
    };
  }

  // Fallback: Create test ethereal account for real formatted email rendering
  const testAccount = await nodemailer.createTestAccount();
  const transporter = nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });

  return {
    transporter,
    isRealSmtp: false,
    senderAddress: '"GeoApex Verification" <noreply@geoapex.game>',
  };
}

export interface SendEmailResult {
  success: boolean;
  isRealSmtp: boolean;
  messageId: string;
  previewUrl?: string | false;
  sender: string;
  error?: string;
}

// Send real verification code email with responsive HTML
export async function sendVerificationEmail(
  toEmail: string,
  code: string,
  playerName?: string
): Promise<SendEmailResult> {
  const { transporter, isRealSmtp, senderAddress } = await getTransporter();

  const recipientName = playerName || toEmail.split('@')[0];

  const htmlContent = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Votre code de vérification GeoApex</title>
</head>
<body style="margin: 0; padding: 0; background-color: #030712; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f3f4f6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #030712; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" max-width="520" style="max-width: 520px; background-color: #0f172a; border-radius: 24px; border: 1px solid #1e293b; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #0284c7 0%, #06b6d4 50%, #10b981 100%); padding: 32px 24px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 900; letter-spacing: 2px;">
                🌍 GEOAPEX 3D
              </h1>
              <p style="margin: 8px 0 0 0; color: #e0f2fe; font-size: 13px; font-weight: 500;">
                Street View Multijoueur & Cloud SQL
              </p>
            </td>
          </tr>

          <!-- Content Area -->
          <tr>
            <td style="padding: 32px 28px;">
              <p style="margin: 0 0 16px 0; font-size: 16px; color: #e2e8f0;">
                Bonjour <strong style="color: #38bdf8;">${recipientName}</strong>,
              </p>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #94a3b8;">
                Voici votre code de sécurité à 6 chiffres pour créer et activer votre compte joueur sur <strong>GeoApex</strong>.
              </p>

              <!-- Verification Code Box -->
              <div style="background-color: #030712; border: 2px solid #0284c7; border-radius: 16px; padding: 24px; text-align: center; margin-bottom: 24px;">
                <span style="font-size: 11px; font-weight: 700; color: #38bdf8; letter-spacing: 1.5px; text-transform: uppercase; display: block; margin-bottom: 8px;">
                  Code de Confirmation
                </span>
                <span style="font-size: 38px; font-weight: 900; letter-spacing: 10px; color: #fbbf24; font-family: monospace; display: block;">
                  ${code}
                </span>
              </div>

              <!-- Expiry Alert -->
              <p style="margin: 0 0 20px 0; font-size: 12px; color: #64748b; line-height: 1.5; text-align: center;">
                ⏳ Ce code est valable pendant <strong>15 minutes</strong>.<br>
                Si vous n'avez pas demandé ce code, ignorez cet e-mail.
              </p>

              <hr style="border: 0; border-top: 1px solid #1e293b; margin: 24px 0;">

              <!-- Footer info -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="font-size: 11px; color: #64748b; text-align: center;">
                    GeoApex &copy; 2026 &bull; Développé avec React, Cloud SQL (PostgreSQL) et Leaflet.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const textContent = `
Bonjour ${recipientName},

Votre code de vérification GeoApex est : ${code}

Ce code est valable pendant 15 minutes.
Entrez ce code dans le jeu pour finaliser la création de votre compte Cloud SQL.

À bientôt sur la carte !
L'équipe GeoApex
  `;

  try {
    const info = await transporter.sendMail({
      from: senderAddress,
      to: toEmail,
      subject: `[GeoApex] Votre code de vérification : ${code}`,
      text: textContent,
      html: htmlContent,
    });

    const previewUrl = !isRealSmtp ? nodemailer.getTestMessageUrl(info) : undefined;

    console.log(`[EMAIL DISPATCH] Sent to ${toEmail} | isRealSmtp: ${isRealSmtp} | MessageId: ${info.messageId}`);

    return {
      success: true,
      isRealSmtp,
      messageId: info.messageId,
      previewUrl,
      sender: senderAddress,
    };
  } catch (err: any) {
    console.error('[EMAIL ERROR] Failed to send email:', err);
    throw new Error(err.message || "Échec de l'envoi de l'e-mail");
  }
}
