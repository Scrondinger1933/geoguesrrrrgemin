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

// Default personalized brand requested by user
export const DEFAULT_SENDER_NAME = 'Studio Maldecena Soeiro';
export const DEFAULT_SENDER_EMAIL = 'studiomaldecenasoeiro@gmail.com';

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
      fromName: process.env.SMTP_FROM_NAME || DEFAULT_SENDER_NAME,
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
    const host = config.host || 'smtp.gmail.com';
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
      senderAddress: `"${config.fromName || DEFAULT_SENDER_NAME}" <${config.user}>`,
    };
  }

  // Fallback: Ethereal test account with Studio Maldecena Soeiro header
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
    senderAddress: `"${DEFAULT_SENDER_NAME}" <${DEFAULT_SENDER_EMAIL}>`,
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

// Send real verification code email with STRICTLY NO HYPERLINKS
export async function sendVerificationEmail(
  toEmail: string,
  code: string,
  playerName?: string
): Promise<SendEmailResult> {
  const { transporter, isRealSmtp, senderAddress } = await getTransporter();

  const recipientName = playerName || toEmail.split('@')[0];

  // Pure HTML template with ABSOLUTELY ZERO HYPERLINKS or CLICKABLE URLS
  const htmlContent = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Votre code de vérification</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #0b0f19; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Main Container Card -->
        <table role="presentation" width="100%" style="max-width: 500px; background-color: #161c2e; border-radius: 20px; border: 1px solid #2d3748; overflow: hidden; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0284c7 0%, #2563eb 100%); padding: 28px 24px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 800; letter-spacing: 1px;">
                Studio Maldecena Soeiro
              </h1>
              <p style="margin: 6px 0 0 0; color: #e0f2fe; font-size: 13px; font-weight: 500;">
                GeoApex 3D &bull; Code d'authentification
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px 28px;">
              <p style="margin: 0 0 16px 0; font-size: 15px; color: #e2e8f0; line-height: 1.5;">
                Bonjour <strong style="color: #38bdf8;">${recipientName}</strong>,
              </p>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #94a3b8;">
                Voici votre code de vérification à 6 chiffres pour activer votre compte joueur :
              </p>

              <!-- Code Box (NO LINK) -->
              <div style="background-color: #0b0f19; border: 2px solid #38bdf8; border-radius: 16px; padding: 24px; text-align: center; margin: 0 0 24px 0;">
                <span style="font-size: 11px; font-weight: 700; color: #38bdf8; letter-spacing: 2px; text-transform: uppercase; display: block; margin-bottom: 8px;">
                  VOTRE CODE DE SÉCURITÉ
                </span>
                <span style="font-size: 40px; font-weight: 900; letter-spacing: 12px; color: #fbbf24; font-family: monospace; display: block;">
                  ${code}
                </span>
              </div>

              <!-- Expiry & Instructions -->
              <p style="margin: 0 0 16px 0; font-size: 13px; color: #cbd5e1; line-height: 1.6; text-align: center;">
                Recopiez ce code directement dans l'application pour valider votre compte.<br>
                Ce code est strictement personnel et expire dans <strong>15 minutes</strong>.
              </p>

              <hr style="border: 0; border-top: 1px solid #2d3748; margin: 24px 0;">

              <p style="margin: 0; font-size: 11px; color: #64748b; text-align: center;">
                Studio Maldecena Soeiro &bull; GeoApex Cloud SQL
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  // Plain text version (strictly NO URLs, just the code)
  const textContent = `
Studio Maldecena Soeiro - GeoApex

Bonjour ${recipientName},

Voici votre code de vérification à 6 chiffres :

${code}

Recopiez ce code dans l'application pour activer votre compte.
Ce code est valable pendant 15 minutes.
  `.trim();

  try {
    const info = await transporter.sendMail({
      from: senderAddress,
      to: toEmail,
      subject: `[Studio Maldecena Soeiro] Votre Code de Vérification : ${code}`,
      text: textContent,
      html: htmlContent,
    });

    const previewUrl = !isRealSmtp ? nodemailer.getTestMessageUrl(info) : undefined;

    console.log(`[EMAIL DISPATCH] Sent from ${senderAddress} to ${toEmail} | isRealSmtp: ${isRealSmtp} | MessageId: ${info.messageId}`);

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
