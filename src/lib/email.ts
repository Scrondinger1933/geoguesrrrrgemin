/**
 * GeoApex Reusable SMTP & Transactional Email Service
 * Supports standard .env variables:
 *   - SMTP_HOST
 *   - SMTP_PORT
 *   - SMTP_USER
 *   - SMTP_PASSWORD (or legacy SMTP_PASS)
 *   - SMTP_FROM (or SMTP_FROM_EMAIL / SMTP_FROM_NAME)
 *   - SMTP_SECURE ('true' | 'false')
 * Plus optional Brevo / Resend REST relays and Ethereal preview fallback when unconfigured.
 *
 * STRICT RULE: Verification and password-reset emails NEVER include URLs or links —
 * exclusively a cryptographically random 6-digit numeric code valid for 10 minutes.
 */

import nodemailer, { type Transporter } from 'nodemailer';
import fs from 'fs';
import path from 'path';

export const DEFAULT_SENDER_NAME = 'GeoApex';
export const DEFAULT_SENDER_EMAIL = 'studiomaldecenasoeiro@gmail.com';

export type EmailProviderType = 'gmail' | 'smtp' | 'brevo' | 'resend';
export type EmailRelayType = 'gmail' | 'smtp' | 'brevo' | 'resend' | 'ethereal' | 'local';

export interface SmtpCredentials {
  provider?: EmailProviderType;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  fromEmail: string;
  fromName: string;
  resendApiKey?: string;
  brevoApiKey?: string;
}

export interface EmailProviderStatus {
  configured: boolean;
  provider: EmailRelayType;
  user: string | null;
  fromEmail: string;
  fromName: string;
  host: string;
  port: number;
  secure: boolean;
  hasResendKey: boolean;
  hasBrevoKey: boolean;
  hasSmtpPass: boolean;
}

const SMTP_CONFIG_PATH = path.resolve(process.cwd(), 'smtp-config.json');
const EMAIL_CONFIG_PATH = path.resolve(process.cwd(), 'email-config.json');
const ENV_PATH = path.resolve(process.cwd(), '.env');

let customTestTransport: {
  sendMail: (mail: { from: string; to: string; subject: string; text: string; html: string }) => Promise<{ messageId: string }>;
} | null = null;

export function setMailTransportForTesting(
  transport: {
    sendMail: (mail: { from: string; to: string; subject: string; text: string; html: string }) => Promise<{ messageId: string }>;
  } | null
): void {
  customTestTransport = transport;
}

export function maskEmail(email: string): string {
  const parts = email.split('@');
  if (parts.length !== 2) return '***';
  const name = parts[0];
  const domain = parts[1];
  const maskedName = name.length > 2 ? `${name.slice(0, 2)}***` : `${name.slice(0, 1)}***`;
  return `${maskedName}@${domain}`;
}

function parseEnvFile(): Record<string, string> {
  const envObj: Record<string, string> = {};
  if (!fs.existsSync(ENV_PATH)) return envObj;
  try {
    const content = fs.readFileSync(ENV_PATH, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const idx = trimmed.indexOf('=');
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        envObj[key] = val;
      }
    }
  } catch {
    // Ignore parse failure
  }
  return envObj;
}

function writeEnvKeys(updates: Record<string, string>): void {
  let envLines: string[] = [];
  if (fs.existsSync(ENV_PATH)) {
    envLines = fs.readFileSync(ENV_PATH, 'utf-8').split('\n');
  }
  for (const [key, val] of Object.entries(updates)) {
    const idx = envLines.findIndex((l) => l.trim().startsWith(`${key}=`));
    const safeVal = String(val ?? '').replace(/\r|\n/g, '');
    if (idx >= 0) {
      envLines[idx] = `${key}="${safeVal}"`;
    } else {
      envLines.push(`${key}="${safeVal}"`);
    }
  }
  fs.writeFileSync(ENV_PATH, envLines.join('\n'), 'utf-8');
}

function isRealSecret(val?: string): boolean {
  if (!val) return false;
  const cleaned = val.trim();
  if (cleaned.length < 8) return false;
  const blocked = [
    'xsvdfv',
    'password',
    '123456',
    'changeme',
    'your_api_key',
    'your_16_char_app_password',
    'none',
  ];
  return !blocked.includes(cleaned.toLowerCase());
}

function parseFromHeader(rawFrom: string, fallbackEmail: string, fallbackName: string) {
  const trimmed = rawFrom.trim();
  const match = trimmed.match(/^(?:"?([^"<]+?)"?\s*)?<([^<>@\s]+@[^<>@\s]+)>$/);
  if (match) {
    return {
      fromName: (match[1] || fallbackName).trim(),
      fromEmail: match[2].trim(),
      from: trimmed,
    };
  }
  if (trimmed.includes('@')) {
    return {
      fromName: fallbackName,
      fromEmail: trimmed,
      from: `"${fallbackName}" <${trimmed}>`,
    };
  }
  return {
    fromName: fallbackName,
    fromEmail: fallbackEmail,
    from: `"${fallbackName}" <${fallbackEmail}>`,
  };
}

export function getActiveSmtpCredentials(): SmtpCredentials | null {
  const envFile = parseEnvFile();
  const readVal = (key: string) => (process.env[key] || envFile[key] || '').trim();

  let jsonCfg: Partial<SmtpCredentials> = {};
  for (const cfgPath of [EMAIL_CONFIG_PATH, SMTP_CONFIG_PATH]) {
    if (fs.existsSync(cfgPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
        jsonCfg = { ...jsonCfg, ...parsed };
      } catch {
        // Ignore invalid JSON
      }
    }
  }

  const resendApiKey = readVal('RESEND_API_KEY') || jsonCfg.resendApiKey?.trim() || '';
  const brevoApiKey = readVal('BREVO_API_KEY') || jsonCfg.brevoApiKey?.trim() || '';

  const host = (readVal('SMTP_HOST') || jsonCfg.host || 'smtp.gmail.com').trim();
  const portRaw = readVal('SMTP_PORT') || (jsonCfg.port ? String(jsonCfg.port) : '587');
  const port = parseInt(portRaw, 10) || 587;

  const secureEnv = readVal('SMTP_SECURE').toLowerCase();
  const secure =
    secureEnv === 'true'
      ? true
      : secureEnv === 'false'
      ? false
      : typeof jsonCfg.secure === 'boolean'
      ? jsonCfg.secure
      : port === 465;

  const user = (readVal('SMTP_USER') || jsonCfg.user || DEFAULT_SENDER_EMAIL).trim();
  const rawPass = readVal('SMTP_PASSWORD') || readVal('SMTP_PASS') || jsonCfg.pass || '';
  const pass = host.includes('gmail') ? rawPass.replace(/["'\s]+/g, '') : rawPass.trim();

  const rawFrom = readVal('SMTP_FROM') || jsonCfg.from || '';
  const fallbackFromEmail = (readVal('SMTP_FROM_EMAIL') || jsonCfg.fromEmail || user || DEFAULT_SENDER_EMAIL).trim();
  const fallbackFromName = (readVal('SMTP_FROM_NAME') || jsonCfg.fromName || DEFAULT_SENDER_NAME).trim();
  const parsedFrom = parseFromHeader(rawFrom, fallbackFromEmail, fallbackFromName);

  const hasResend = isRealSecret(resendApiKey);
  const hasBrevo = isRealSecret(brevoApiKey);
  const hasSmtp = isRealSecret(pass) && user.includes('@');

  if (!hasResend && !hasBrevo && !hasSmtp) {
    return null;
  }

  let provider: EmailProviderType = 'gmail';
  if (jsonCfg.provider) {
    provider = jsonCfg.provider;
  } else if (hasResend) {
    provider = 'resend';
  } else if (hasBrevo) {
    provider = 'brevo';
  } else if (!host.includes('gmail')) {
    provider = 'smtp';
  }

  return {
    provider,
    host,
    port,
    secure,
    user,
    pass,
    from: parsedFrom.from,
    fromEmail: parsedFrom.fromEmail,
    fromName: parsedFrom.fromName,
    resendApiKey: hasResend ? resendApiKey : undefined,
    brevoApiKey: hasBrevo ? brevoApiKey : undefined,
  };
}

export function getEmailProviderStatus(): EmailProviderStatus {
  const creds = getActiveSmtpCredentials();
  const envFile = parseEnvFile();
  const readVal = (key: string) => (process.env[key] || envFile[key] || '').trim();
  const rawHost = readVal('SMTP_HOST') || 'smtp.gmail.com';
  const validHost = rawHost.includes('.') ? rawHost : 'smtp.gmail.com';
  const port = parseInt(readVal('SMTP_PORT') || '587', 10) || 587;
  const secure = readVal('SMTP_SECURE').toLowerCase() === 'true' || port === 465;

  const rawFrom = readVal('SMTP_FROM');
  const fallbackEmail = readVal('SMTP_FROM_EMAIL') || readVal('SMTP_USER') || DEFAULT_SENDER_EMAIL;
  const fallbackName = readVal('SMTP_FROM_NAME') || DEFAULT_SENDER_NAME;
  const parsedFrom = parseFromHeader(rawFrom, creds?.fromEmail || fallbackEmail, creds?.fromName || fallbackName);

  if (!creds) {
    return {
      configured: false,
      provider: 'ethereal',
      user: null,
      fromEmail: parsedFrom.fromEmail.includes('@') ? parsedFrom.fromEmail : DEFAULT_SENDER_EMAIL,
      fromName: parsedFrom.fromName,
      host: validHost,
      port,
      secure,
      hasResendKey: false,
      hasBrevoKey: false,
      hasSmtpPass: false,
    };
  }

  let activeProvider: EmailRelayType = creds.provider || 'gmail';
  if (creds.resendApiKey && creds.provider === 'resend') activeProvider = 'resend';
  else if (creds.brevoApiKey && creds.provider === 'brevo') activeProvider = 'brevo';
  else if (creds.pass) activeProvider = creds.host.includes('gmail') ? 'gmail' : 'smtp';

  return {
    configured: true,
    provider: activeProvider,
    user: creds.user ? maskEmail(creds.user) : null,
    fromEmail: creds.fromEmail,
    fromName: creds.fromName || DEFAULT_SENDER_NAME,
    host: creds.host,
    port: creds.port,
    secure: creds.secure,
    hasResendKey: !!creds.resendApiKey,
    hasBrevoKey: !!creds.brevoApiKey,
    hasSmtpPass: isRealSecret(creds.pass),
  };
}

export function saveEmailConfiguration(cfg: {
  provider: EmailProviderType;
  user?: string;
  pass?: string;
  host?: string;
  port?: number;
  secure?: boolean;
  fromEmail?: string;
  fromName?: string;
  resendApiKey?: string;
  brevoApiKey?: string;
}): void {
  const existing = getActiveSmtpCredentials();
  const host = (cfg.host || existing?.host || 'smtp.gmail.com').trim();
  const port = cfg.port || existing?.port || 587;
  const secure = typeof cfg.secure === 'boolean' ? cfg.secure : port === 465;
  const user = (cfg.user || existing?.user || DEFAULT_SENDER_EMAIL).trim();
  const rawPass = cfg.pass ?? existing?.pass ?? '';
  const pass = host.includes('gmail') ? rawPass.replace(/["'\s]+/g, '') : rawPass.trim();
  const fromEmail = (cfg.fromEmail || cfg.user || existing?.fromEmail || DEFAULT_SENDER_EMAIL).trim();
  const fromName = (cfg.fromName || existing?.fromName || DEFAULT_SENDER_NAME).trim();
  const from = `"${fromName}" <${fromEmail}>`;
  const resendApiKey = (cfg.resendApiKey ?? existing?.resendApiKey ?? '').trim();
  const brevoApiKey = (cfg.brevoApiKey ?? existing?.brevoApiKey ?? '').trim();

  process.env.SMTP_HOST = host;
  process.env.SMTP_PORT = String(port);
  process.env.SMTP_SECURE = secure ? 'true' : 'false';
  process.env.SMTP_USER = user;
  process.env.SMTP_PASSWORD = pass;
  process.env.SMTP_PASS = pass;
  process.env.SMTP_FROM = from;
  process.env.SMTP_FROM_EMAIL = fromEmail;
  process.env.SMTP_FROM_NAME = fromName;
  if (resendApiKey) process.env.RESEND_API_KEY = resendApiKey;
  if (brevoApiKey) process.env.BREVO_API_KEY = brevoApiKey;

  const fullConfig: SmtpCredentials = {
    provider: cfg.provider,
    host,
    port,
    secure,
    user,
    pass,
    from,
    fromEmail,
    fromName,
    ...(resendApiKey ? { resendApiKey } : {}),
    ...(brevoApiKey ? { brevoApiKey } : {}),
  };

  fs.writeFileSync(EMAIL_CONFIG_PATH, JSON.stringify(fullConfig, null, 2), 'utf-8');
  if (pass) {
    fs.writeFileSync(
      SMTP_CONFIG_PATH,
      JSON.stringify({ host, port, secure, user, pass, from, fromName }, null, 2),
      'utf-8'
    );
  }

  writeEnvKeys({
    SMTP_HOST: host,
    SMTP_PORT: String(port),
    SMTP_SECURE: secure ? 'true' : 'false',
    SMTP_USER: user,
    SMTP_PASSWORD: pass,
    SMTP_PASS: pass,
    SMTP_FROM: from,
    SMTP_FROM_EMAIL: fromEmail,
    SMTP_FROM_NAME: fromName,
    ...(resendApiKey ? { RESEND_API_KEY: resendApiKey } : {}),
    ...(brevoApiKey ? { BREVO_API_KEY: brevoApiKey } : {}),
  });
}

export function saveSmtpCredentials(creds: {
  user: string;
  pass: string;
  host?: string;
  port?: number;
  secure?: boolean;
  fromName?: string;
}): void {
  const host = creds.host || 'smtp.gmail.com';
  saveEmailConfiguration({
    provider: host.includes('gmail') ? 'gmail' : 'smtp',
    user: creds.user,
    pass: creds.pass,
    host,
    port: creds.port || 587,
    secure: creds.secure,
    fromEmail: creds.user,
    fromName: creds.fromName || DEFAULT_SENDER_NAME,
  });
}

export function createSmtpTransporter(creds: SmtpCredentials): Transporter {
  return nodemailer.createTransport({
    host: creds.host,
    port: creds.port,
    secure: creds.secure,
    requireTLS: !creds.secure && creds.port === 587,
    auth: {
      user: creds.user,
      pass: creds.pass,
    },
    tls: {
      rejectUnauthorized: true,
      minVersion: 'TLSv1.2',
    },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
  });
}

export const createGmailTransporter = createSmtpTransporter;

export async function verifySmtpConnection(
  user: string,
  pass: string,
  host = 'smtp.gmail.com',
  port = 587,
  secure = port === 465
): Promise<boolean> {
  const cleanedPass = host.includes('gmail') ? pass.trim().replace(/["'\s]+/g, '') : pass.trim();
  const transporter = createSmtpTransporter({
    host: host.trim(),
    port,
    secure,
    user: user.trim(),
    pass: cleanedPass,
    from: `"${DEFAULT_SENDER_NAME}" <${user.trim()}>`,
    fromEmail: user.trim(),
    fromName: DEFAULT_SENDER_NAME,
  });

  try {
    await transporter.verify();
    return true;
  } catch (err: any) {
    throw new Error(formatSmtpError(err));
  }
}

export function formatSmtpError(err: any): string {
  const code = err?.code || '';
  const message = err?.message || '';

  if (code === 'EAUTH' || message.includes('535') || message.includes('BadCredentials')) {
    return "Authentification Gmail SMTP refusée (535 Bad Credentials). Utilisez un Mot de Passe d'Application Google à 16 caractères généré sur https://myaccount.google.com/apppasswords (et non votre mot de passe Gmail habituel).";
  }
  if (code === 'ESOCKET' || code === 'ECONNECTION' || code === 'ETIMEDOUT') {
    return "Connexion au serveur SMTP impossible (serveur inaccessible ou délai d'attente dépassé).";
  }
  if (code === 'EENVELOPE' || message.includes('550') || message.includes('553')) {
    return "L'adresse e-mail destinataire ou expéditeur a été rejetée par le serveur SMTP.";
  }

  return `Erreur messagerie : ${message || 'Échec de transmission vers le serveur'}`;
}

async function sendViaResendApi(params: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ messageId: string }> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: params.from,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      text: params.text,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || data?.error?.message || `Erreur Resend (${res.status})`);
  }
  return { messageId: data.id || `resend_${Date.now()}` };
}

async function sendViaBrevoApi(params: {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ messageId: string }> {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': params.apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { email: params.fromEmail, name: params.fromName },
      to: [{ email: params.to }],
      subject: params.subject,
      htmlContent: params.html,
      textContent: params.text,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || `Erreur Brevo (${res.status})`);
  }
  return { messageId: data.messageId || `brevo_${Date.now()}` };
}

let cachedEtherealTransporter: Transporter | null = null;
async function getEtherealTransporter(): Promise<Transporter> {
  if (cachedEtherealTransporter) return cachedEtherealTransporter;
  const testAccount = await nodemailer.createTestAccount();
  cachedEtherealTransporter = nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });
  return cachedEtherealTransporter;
}

export interface SendRealEmailResult {
  success: boolean;
  isRealSmtp: boolean;
  deliveredToRealInbox: boolean;
  messageId: string;
  sender: string;
  previewUrl?: string | false;
  relayType: EmailRelayType;
  notice?: string;
}

async function dispatchEmailEnvelope(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendRealEmailResult> {
  const masked = maskEmail(params.to);

  if (customTestTransport) {
    const senderAddress = `"${DEFAULT_SENDER_NAME}" <${DEFAULT_SENDER_EMAIL}>`;
    const info = await customTestTransport.sendMail({
      from: senderAddress,
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });
    return {
      success: true,
      isRealSmtp: true,
      deliveredToRealInbox: true,
      messageId: info.messageId,
      sender: senderAddress,
      relayType: 'smtp',
    };
  }

  const creds = getActiveSmtpCredentials();
  if (creds) {
    const senderName = creds.fromName || DEFAULT_SENDER_NAME;
    const senderEmail = creds.fromEmail || creds.user || DEFAULT_SENDER_EMAIL;
    const senderAddress = creds.from || `"${senderName}" <${senderEmail}>`;

    const tryOrder: EmailProviderType[] = [];
    if (creds.provider) tryOrder.push(creds.provider);
    if (creds.resendApiKey && !tryOrder.includes('resend')) tryOrder.push('resend');
    if (creds.brevoApiKey && !tryOrder.includes('brevo')) tryOrder.push('brevo');
    if (isRealSecret(creds.pass) && !tryOrder.includes('gmail')) {
      tryOrder.push(creds.host.includes('gmail') ? 'gmail' : 'smtp');
    }

    for (const transport of tryOrder) {
      try {
        if (transport === 'resend' && creds.resendApiKey) {
          const fromHeader = senderEmail.includes('gmail.com')
            ? `${senderName} <onboarding@resend.dev>`
            : senderAddress;
          const res = await sendViaResendApi({
            apiKey: creds.resendApiKey,
            from: fromHeader,
            to: params.to,
            subject: params.subject,
            html: params.html,
            text: params.text,
          });
          console.log(`[RESEND] Real inbox delivery confirmed to ${masked} (${res.messageId})`);
          return {
            success: true,
            isRealSmtp: true,
            deliveredToRealInbox: true,
            messageId: res.messageId,
            sender: fromHeader,
            relayType: 'resend',
          };
        }

        if (transport === 'brevo' && creds.brevoApiKey) {
          const res = await sendViaBrevoApi({
            apiKey: creds.brevoApiKey,
            fromEmail: senderEmail,
            fromName: senderName,
            to: params.to,
            subject: params.subject,
            html: params.html,
            text: params.text,
          });
          console.log(`[BREVO] Real inbox delivery confirmed to ${masked} (${res.messageId})`);
          return {
            success: true,
            isRealSmtp: true,
            deliveredToRealInbox: true,
            messageId: res.messageId,
            sender: senderAddress,
            relayType: 'brevo',
          };
        }

        if ((transport === 'gmail' || transport === 'smtp') && isRealSecret(creds.pass) && creds.user) {
          const transporter = createSmtpTransporter(creds);
          const info = await transporter.sendMail({
            from: senderAddress,
            to: params.to,
            subject: params.subject,
            text: params.text,
            html: params.html,
          });
          const relayType: EmailRelayType = creds.host.includes('gmail') ? 'gmail' : 'smtp';
          console.log(`[SMTP ${relayType.toUpperCase()}] Real inbox delivery confirmed to ${masked} (${info.messageId})`);
          return {
            success: true,
            isRealSmtp: true,
            deliveredToRealInbox: true,
            messageId: info.messageId,
            sender: senderAddress,
            relayType,
          };
        }
      } catch (err: any) {
        console.log(`[MAIL ${transport.toUpperCase()} NOTICE] Delivery failed (${err.message}).`);
      }
    }
  }

  const senderAddress = `"${DEFAULT_SENDER_NAME}" <${DEFAULT_SENDER_EMAIL}>`;
  try {
    const etherealTransporter = await getEtherealTransporter();
    const info = await etherealTransporter.sendMail({
      from: senderAddress,
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });
    const previewUrl = nodemailer.getTestMessageUrl(info) || false;
    console.log(`[ETHEREAL PREVIEW] Captured preview for ${masked} (not delivered to real inbox): ${previewUrl}`);
    return {
      success: true,
      isRealSmtp: false,
      deliveredToRealInbox: false,
      messageId: info.messageId,
      sender: senderAddress,
      previewUrl,
      relayType: 'ethereal',
      notice:
        'Mode aperçu web (Ethereal) : configurez SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASSWORD dans .env ou Messagerie Réelle pour livrer directement dans votre boîte mail.',
    };
  } catch {
    return {
      success: true,
      isRealSmtp: false,
      deliveredToRealInbox: false,
      messageId: `local_${Date.now()}`,
      sender: senderAddress,
      relayType: 'local',
      notice: 'Aucun relais SMTP réel configuré.',
    };
  }
}

/**
 * Builds and sends an OTP verification email containing ONLY a 6-digit numeric code.
 * ABSOLUTE RULE: Zero URLs, zero links, zero clickable anchors anywhere in HTML or text.
 */
export function buildOtpEmailContent(params: {
  recipientName: string;
  code: string;
  purpose: 'account_creation' | 'password_reset' | 'general';
}) {
  const isPasswordReset = params.purpose === 'password_reset';
  const emailTitle = isPasswordReset ? 'Réinitialisation de mot de passe' : 'Vérification de votre compte';
  const emailSubtitle = isPasswordReset
    ? 'Code de sécurité à 6 chiffres (valable 10 minutes)'
    : 'Code de confirmation à 6 chiffres (valable 10 minutes)';
  const introMessage = isPasswordReset
    ? 'Vous avez demandé à réinitialiser votre mot de passe. Saisissez le code numérique à 6 chiffres ci-dessous dans l’application :'
    : 'Merci pour votre inscription sur GeoApex. Saisissez le code numérique à 6 chiffres ci-dessous pour activer votre compte :';
  const subject = isPasswordReset
    ? `[GeoApex] Code de réinitialisation à 6 chiffres : ${params.code}`
    : `[GeoApex] Code de vérification à 6 chiffres : ${params.code}`;

  const safeName = params.recipientName.replace(/[<>&"]/g, '');

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${emailTitle}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #07090f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #07090f; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 500px; background-color: #0e131d; border-radius: 16px; border: 1px solid #1e293b; overflow: hidden;">
          <tr>
            <td style="background: linear-gradient(135deg, ${isPasswordReset ? '#e11d48 0%, #9333ea 100%' : '#0284c7 0%, #0f172a 100%'}); padding: 28px 24px; text-align: center; border-bottom: 1px solid #334155;">
              <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: 1px;">GEOAPEX · STUDIO MALDECENA SOEIRO</h1>
              <p style="margin: 6px 0 0 0; color: #cbd5e1; font-size: 13px;">${emailSubtitle}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 28px;">
              <p style="margin: 0 0 16px 0; font-size: 15px; color: #e2e8f0;">
                Bonjour <strong style="color: #22d3ee;">${safeName}</strong>,
              </p>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #94a3b8;">${introMessage}</p>
              <div style="background-color: #07090f; border: 2px solid ${isPasswordReset ? '#fb7185' : '#22d3ee'}; border-radius: 12px; padding: 22px; text-align: center; margin: 0 0 24px 0;">
                <span style="font-size: 11px; font-weight: 700; color: ${isPasswordReset ? '#fb7185' : '#22d3ee'}; letter-spacing: 2px; text-transform: uppercase; display: block; margin-bottom: 8px;">VOTRE CODE À 6 CHIFFRES</span>
                <span style="font-size: 38px; font-weight: 900; letter-spacing: 10px; color: #f59e0b; font-family: monospace; display: block;">${params.code}</span>
              </div>
              <p style="margin: 0; font-size: 12px; color: #94a3b8; text-align: center; line-height: 1.6;">
                Saisissez uniquement ce code à 6 chiffres dans l’application.<br>
                Validité stricte : <strong>10 minutes</strong> · Usage unique.<br>
                Si vous n’êtes pas à l’origine de cette demande, ignorez ce message.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  const text = [
    'GeoApex - Studio Maldecena Soeiro',
    emailTitle,
    '',
    `Bonjour ${safeName},`,
    '',
    introMessage,
    '',
    `CODE DE VÉRIFICATION : ${params.code}`,
    '',
    'Ce code est valable 10 minutes et ne peut être utilisé qu’une seule fois.',
    'Ne partagez jamais ce code.',
  ].join('\n');

  return { subject, html, text, introMessage };
}

export async function sendVerificationEmail(
  toEmail: string,
  code: string,
  playerName?: string,
  purpose: 'account_creation' | 'password_reset' | 'general' = 'account_creation'
): Promise<SendRealEmailResult> {
  const recipientName = playerName || toEmail.split('@')[0];
  const envelope = buildOtpEmailContent({ recipientName, code, purpose });

  const result = await dispatchEmailEnvelope({
    to: toEmail,
    subject: envelope.subject,
    html: envelope.html,
    text: envelope.text,
  });

  recordDispatchedEmail({
    to: toEmail,
    from: result.sender,
    subject: envelope.subject,
    purpose,
    isRealSmtp: result.isRealSmtp,
    deliveredToRealInbox: result.deliveredToRealInbox,
    messageId: result.messageId,
    timestamp: Date.now(),
    previewText: envelope.introMessage,
    previewUrl: result.previewUrl,
    relayType: result.relayType,
  });

  return result;
}

export interface DispatchedEmail {
  to: string;
  from: string;
  subject: string;
  code?: string;
  purpose: 'account_creation' | 'password_reset' | 'general' | 'game_summary';
  isRealSmtp: boolean;
  deliveredToRealInbox: boolean;
  messageId?: string;
  timestamp: number;
  previewText: string;
  score?: number;
  mode?: string;
  previewUrl?: string | false;
  relayType: EmailRelayType;
}

const latestEmails: Record<string, DispatchedEmail> = {};

export function recordDispatchedEmail(email: DispatchedEmail): void {
  latestEmails[email.to.toLowerCase()] = email;
}

export function getLatestEmailFor(email: string): DispatchedEmail | null {
  return latestEmails[email.toLowerCase()] || null;
}

export interface GameSummaryPayload {
  score: number;
  mode: string;
  roundsCompleted: number;
  isVictory?: boolean;
  rankTitle?: string;
  date?: string;
}

export interface GameSummaryEmailResult {
  success: boolean;
  isRealSmtp: boolean;
  deliveredToRealInbox: boolean;
  messageId?: string;
  sender: string;
  previewUrl?: string | false;
  relayType: EmailRelayType;
  notice?: string;
}

export async function sendGameSummaryEmail(
  toEmail: string,
  playerName?: string,
  summary: GameSummaryPayload = { score: 0, mode: 'classic', roundsCompleted: 5 }
): Promise<GameSummaryEmailResult> {
  const recipientName = (playerName || toEmail.split('@')[0]).replace(/[<>&"]/g, '');
  const modeName =
    summary.mode === 'duel'
      ? 'Duel PvP'
      : summary.mode === 'streak'
      ? 'Country Streak'
      : summary.mode === 'blitz'
      ? 'Blitz 30s'
      : 'Classique Mondial';
  const statusBadge = summary.isVictory ? 'Victoire' : 'Session Terminée';
  const subjectLine = `[GeoApex] Vos résultats : ${summary.score.toLocaleString('fr-FR')} pts (${modeName})`;
  const dateFormatted =
    summary.date ||
    new Date().toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const htmlContent = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><title>Récapitulatif de Partie GeoApex</title></head>
<body style="margin: 0; padding: 0; background-color: #07090f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #f8fafc;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #07090f; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background-color: #0e131d; border-radius: 16px; border: 1px solid #1e293b; overflow: hidden;">
          <tr>
            <td style="background: linear-gradient(135deg, #0284c7 0%, #0f172a 100%); padding: 28px 24px; text-align: center; border-bottom: 1px solid #334155;">
              <span style="display: inline-block; color: #f59e0b; font-size: 11px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 6px;">RAPPORT D’EXPÉDITION GEOAPEX</span>
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 900;">Studio Maldecena Soeiro</h1>
              <p style="margin: 6px 0 0 0; color: #cbd5e1; font-size: 13px;">Mode ${modeName} &bull; ${dateFormatted}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 28px;">
              <p style="margin: 0 0 16px 0; font-size: 15px; color: #e2e8f0;">
                Félicitations <strong style="color: #22d3ee;">${recipientName}</strong>,
              </p>
              <div style="background-color: #07090f; border: 2px solid #22d3ee; border-radius: 12px; padding: 22px; text-align: center; margin: 0 0 24px 0;">
                <span style="font-size: 11px; font-weight: 700; color: #22d3ee; letter-spacing: 2px; text-transform: uppercase; display: block; margin-bottom: 6px;">SCORE FINAL ENREGISTRÉ</span>
                <span style="font-size: 42px; font-weight: 900; color: #f59e0b; font-family: monospace; display: block;">${summary.score.toLocaleString('fr-FR')}</span>
                <span style="font-size: 12px; color: #94a3b8; display: block; margin-top: 4px;">${statusBadge} &bull; ${summary.roundsCompleted} manches</span>
              </div>
              <p style="margin: 0; font-size: 12px; color: #64748b; text-align: center;">
                GeoApex &bull; Bande sonore : Across the Meridian
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  const textContent = `GeoApex - Studio Maldecena Soeiro\nRapport de partie (${modeName})\n\nJoueur : ${recipientName}\nScore Final : ${summary.score.toLocaleString('fr-FR')} pts\nStatut : ${statusBadge}\nManches : ${summary.roundsCompleted}\nDate : ${dateFormatted}`;

  const result = await dispatchEmailEnvelope({
    to: toEmail,
    subject: subjectLine,
    html: htmlContent,
    text: textContent,
  });

  recordDispatchedEmail({
    to: toEmail,
    from: result.sender,
    subject: subjectLine,
    purpose: 'game_summary',
    isRealSmtp: result.isRealSmtp,
    deliveredToRealInbox: result.deliveredToRealInbox,
    messageId: result.messageId,
    timestamp: Date.now(),
    previewText: `Score enregistré : ${summary.score.toLocaleString('fr-FR')} pts (${modeName})`,
    score: summary.score,
    mode: summary.mode,
    previewUrl: result.previewUrl,
    relayType: result.relayType,
  });

  return {
    success: result.success,
    isRealSmtp: result.isRealSmtp,
    deliveredToRealInbox: result.deliveredToRealInbox,
    messageId: result.messageId,
    sender: result.sender,
    previewUrl: result.previewUrl,
    relayType: result.relayType,
    notice: result.notice,
  };
}

export async function testAndSendLiveEmail(targetEmail: string): Promise<SendRealEmailResult> {
  const creds = getActiveSmtpCredentials();
  if (!creds) {
    throw new Error(
      "Aucun fournisseur SMTP / API e-mail réel configuré (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD requis)."
    );
  }

  if ((creds.provider === 'gmail' || creds.provider === 'smtp') && creds.pass && creds.user) {
    await verifySmtpConnection(creds.user, creds.pass, creds.host, creds.port, creds.secure);
  }

  const timestamp = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
  const html = `
<!DOCTYPE html>
<html lang="fr">
<body style="margin:0;padding:32px;background:#07090f;font-family:sans-serif;color:#f8fafc;">
  <div style="max-width:500px;margin:0 auto;background:#0e131d;border:1px solid #22d3ee;border-radius:16px;padding:28px;">
    <h1 style="margin:0 0 8px 0;font-size:20px;color:#ffffff;">GeoApex · Test Messagerie Réelle</h1>
    <p style="margin:0 0 18px 0;font-size:14px;color:#22d3ee;font-weight:bold;">Livraison directe en boîte de réception vérifiée</p>
    <p style="font-size:13px;line-height:1.6;color:#cbd5e1;">Cet e-mail confirme que le serveur SMTP expédie vos codes à 6 chiffres et bilans de partie vers ${targetEmail}.</p>
    <p style="font-size:12px;color:#94a3b8;margin-top:20px;">Fournisseur actif : <strong style="color:#f59e0b;">${creds.provider?.toUpperCase()}</strong> · ${timestamp}</p>
  </div>
</body>
</html>`.trim();

  const text = `GeoApex - Test Messagerie Réelle réussi !\nDestinataire: ${targetEmail}\nFournisseur: ${creds.provider}\nHeure: ${timestamp}`;

  const result = await dispatchEmailEnvelope({
    to: targetEmail,
    subject: `[GeoApex] Test de livraison SMTP (${creds.provider?.toUpperCase()})`,
    html,
    text,
  });

  if (!result.deliveredToRealInbox) {
    throw new Error(
      "La vérification a échoué lors de l'envoi réel vers le serveur SMTP. Vérifiez vos identifiants."
    );
  }

  return result;
}

export const getActiveSmtpConfig = getActiveSmtpCredentials;
export const saveSmtpConfig = saveSmtpCredentials;
