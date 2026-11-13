/**
 * Standalone SMTP verification and test email dispatch script.
 * Can be run via: npx tsx scripts/test-smtp.ts [recipient@email.com]
 * Uses process.env.SMTP_HOST, process.env.SMTP_PORT, process.env.SMTP_USER, process.env.SMTP_PASS
 * Strictly protects credentials (never logs them).
 */

import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { maskEmail, formatSmtpError } from '../src/lib/email.ts';

dotenv.config();

async function runSmtpTest() {
  const host = process.env.SMTP_HOST?.trim() || 'smtp.gmail.com';
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT.trim(), 10) : 587;
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const fromName = process.env.SMTP_FROM_NAME?.trim() || 'Studio Maldecena Soeiro';

  console.log('====================================================');
  console.log('   GeoApex & Studio Maldecena Soeiro - SMTP Tester  ');
  console.log('====================================================');
  console.log(`Server Host: ${host}`);
  console.log(`Server Port: ${port}`);
  console.log(`Sender Name: ${fromName}`);
  console.log(`Sender User: ${user ? maskEmail(user) : '[NOT CONFIGURED]'}`);
  console.log(`Password   : ${pass ? '[PRESENT - 16-char secret masked]' : '[MISSING]'}`);
  console.log('----------------------------------------------------');

  if (!user || !pass) {
    console.error('❌ ERROR: Missing SMTP_USER or SMTP_PASS in environment variables.');
    console.error('Please configure SMTP_USER and SMTP_PASS in .env or GitHub Secrets.');
    process.exit(1);
  }

  const isSecure = port === 465;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: isSecure,
    requireTLS: !isSecure,
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: true,
      minVersion: 'TLSv1.2',
    },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
  });

  console.log('⏳ 1. Verifying SMTP server connection handshake...');
  try {
    await transporter.verify();
    console.log('✅ Connection verified successfully! Google SMTP server accepted credentials.');
  } catch (err: any) {
    console.error('❌ Connection verification failed!');
    console.error(formatSmtpError(err));
    process.exit(1);
  }

  // Recipient: argument or default
  const recipient = process.argv[2] || process.env.TEST_EMAIL_RECIPIENT || user || 'alexandre.soeirofrance@gmail.com';
  const maskedRecipient = maskEmail(recipient);

  console.log(`⏳ 2. Sending test verification email to ${maskedRecipient}...`);

  const timestamp = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
  const htmlContent = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Test SMTP GeoApex Réussi</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #f8fafc;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background-color: #161c2e; border-radius: 20px; border: 1px solid #2d3748; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
          <tr>
            <td style="background: linear-gradient(135deg, #0284c7 0%, #2563eb 100%); padding: 28px 24px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 800;">Studio Maldecena Soeiro</h1>
              <p style="margin: 6px 0 0 0; color: #e0f2fe; font-size: 13px;">GeoApex 3D &bull; Test de Connexion SMTP Réussi</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 28px;">
              <p style="margin: 0 0 16px 0; font-size: 16px; color: #38bdf8; font-weight: 700;">
                ✓ Connexion SMTP 100% Fonctionnelle !
              </p>
              <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #cbd5e1;">
                Ce message confirme que les variables d'environnement <strong>SMTP_HOST</strong>, <strong>SMTP_PORT</strong>, <strong>SMTP_USER</strong> et <strong>SMTP_PASS</strong> sont correctement initialisées et que le serveur Google SMTP a validé l'acheminement direct des e-mails.
              </p>
              <div style="background-color: #0b0f19; border: 1px solid #38bdf8; border-radius: 12px; padding: 16px; margin: 0 0 24px 0; font-size: 12px; color: #94a3b8; font-family: monospace;">
                <div>Serveur : <span style="color: #f8fafc;">${host}:${port}</span></div>
                <div>Sécurité : <span style="color: #34d399;">STARTTLS (TLSv1.2)</span></div>
                <div>Expéditeur : <span style="color: #f8fafc;">${fromName} &lt;${user}&gt;</span></div>
                <div>Date : <span style="color: #fbbf24;">${timestamp}</span></div>
              </div>
              <p style="margin: 0; font-size: 12px; color: #64748b; text-align: center;">
                GeoApex 3D &bull; Studio Maldecena Soeiro
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

  try {
    const info = await transporter.sendMail({
      from: `"${fromName}" <${user}>`,
      to: recipient,
      subject: `[GeoApex] Test SMTP Réussi - ${fromName}`,
      text: `Test de connexion SMTP GeoApex réussi !\n\nServeur : ${host}:${port}\nExpéditeur : ${fromName} <${user}>\nDate : ${timestamp}\n\nLe système d'envoi d'e-mails réels est 100% opérationnel.`,
      html: htmlContent,
    });

    console.log(`✅ Test email delivered successfully!`);
    console.log(`MessageId : ${info.messageId}`);
    console.log(`Response  : ${info.response}`);
    console.log('====================================================');
    console.log('STATUS: isRealSmtp: true (SUCCESS)');
    console.log('====================================================');
  } catch (err: any) {
    console.error('❌ Failed to dispatch test email!');
    console.error(formatSmtpError(err));
    process.exit(1);
  }
}

runSmtpTest();
