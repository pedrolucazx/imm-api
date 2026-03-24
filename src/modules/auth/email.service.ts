import { Resend } from "resend";
import { env } from "../../core/config/env.js";
import { logger } from "../../core/config/logger.js";

const resend = new Resend(env.RESEND_API_KEY);

const FROM_EMAIL = "Inside My Mind <no-reply@insidemymind.tech>";

export interface SendVerificationEmailParams {
  to: string;
  verificationLink: string;
  name: string;
}

export async function sendVerificationEmail({
  to,
  verificationLink,
  name,
}: SendVerificationEmailParams): Promise<void> {
  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    </head>
    <body style="margin:0;padding:0;background-color:#f5f5ec;font-family:system-ui,-apple-system,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#f5f5ec;padding:40px 16px;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;background-color:#ffffff;border:3px solid #000000;box-shadow:6px 6px 0px 0px #000000;">
              <tr>
                <td style="background-color:#e6c200;border-bottom:3px solid #000000;padding:20px 32px;">
                  <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#000000;">INSIDE MY MIND</p>
                </td>
              </tr>
              <tr>
                <td style="padding:32px;">
                  <h1 style="margin:0 0 16px 0;font-size:24px;font-weight:700;letter-spacing:-0.025em;color:#000000;line-height:1.2;">Confirme seu e-mail</h1>
                  <p style="margin:0 0 8px 0;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#000000;">OLÁ, ${name.toUpperCase()}!</p>
                  <p style="margin:0 0 32px 0;font-size:15px;color:#000000;line-height:1.6;">
                    Sua conta foi criada com sucesso. Clique no botão abaixo para confirmar seu e-mail e começar sua jornada:
                  </p>
                  <table cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                      <td>
                        <a href="${verificationLink}" style="display:inline-block;background-color:#e6c200;color:#000000;padding:14px 28px;font-size:14px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;text-decoration:none;border:3px solid #000000;box-shadow:4px 4px 0px 0px #000000;">
                          CONFIRMAR E-MAIL →
                        </a>
                      </td>
                    </tr>
                  </table>
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:32px;">
                    <tr>
                      <td style="border-top:2px solid #000000;padding-top:24px;">
                        <p style="margin:0 0 8px 0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#000000;">ATENÇÃO</p>
                        <p style="margin:0;font-size:13px;color:#000000;line-height:1.5;">
                          Este link expira em <strong>24 horas</strong>. Se você não criou uma conta, ignore este email.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="background-color:#000000;padding:16px 32px;">
                  <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:#e6c200;">INSIDE MY MIND — SUA PLATAFORMA DE ACOMPANHAMENTO PESSOAL</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const text = `
INSIDE MY MIND — Confirme seu e-mail

Olá, ${name}!

Sua conta foi criada com sucesso. Acesse o link abaixo para confirmar seu e-mail:
${verificationLink}

Este link expira em 24 horas. Se você não criou uma conta, ignore este email.

INSIDE MY MIND — Sua plataforma de acompanhamento pessoal
  `;

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: "Confirme seu e-mail - Inside My Mind",
      html,
      text,
    });

    if (error) {
      logger.error({ msg: "Failed to send verification email", error, to });
      throw new Error("Failed to send email");
    }

    logger.info({ msg: "Verification email sent", to });
  } catch (err) {
    logger.error({ msg: "Error sending verification email", error: err, to });
    throw err;
  }
}

export interface SendPasswordResetEmailParams {
  to: string;
  resetLink: string;
  name: string;
}

export async function sendPasswordResetEmail({
  to,
  resetLink,
  name,
}: SendPasswordResetEmailParams): Promise<void> {
  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    </head>
    <body style="margin:0;padding:0;background-color:#f5f5ec;font-family:system-ui,-apple-system,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#f5f5ec;padding:40px 16px;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;background-color:#ffffff;border:3px solid #000000;box-shadow:6px 6px 0px 0px #000000;">
              <tr>
                <td style="background-color:#e6c200;border-bottom:3px solid #000000;padding:20px 32px;">
                  <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#000000;">INSIDE MY MIND</p>
                </td>
              </tr>
              <tr>
                <td style="padding:32px;">
                  <h1 style="margin:0 0 16px 0;font-size:24px;font-weight:700;letter-spacing:-0.025em;color:#000000;line-height:1.2;">Redefinição de senha</h1>
                  <p style="margin:0 0 8px 0;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#000000;">OLÁ, ${name.toUpperCase()}!</p>
                  <p style="margin:0 0 32px 0;font-size:15px;color:#000000;line-height:1.6;">
                    Recebemos uma solicitação para redefinir sua senha. Clique no botão abaixo para criar uma nova senha:
                  </p>
                  <table cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                      <td>
                        <a href="${resetLink}" style="display:inline-block;background-color:#e6c200;color:#000000;padding:14px 28px;font-size:14px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;text-decoration:none;border:3px solid #000000;box-shadow:4px 4px 0px 0px #000000;">
                          REDEFINIR SENHA →
                        </a>
                      </td>
                    </tr>
                  </table>
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:32px;">
                    <tr>
                      <td style="border-top:2px solid #000000;padding-top:24px;">
                        <p style="margin:0 0 8px 0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#000000;">ATENÇÃO</p>
                        <p style="margin:0;font-size:13px;color:#000000;line-height:1.5;">
                          Este link expira em <strong>1 hora</strong>. Se você não solicitou esta redefinição, ignore este email.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="background-color:#000000;padding:16px 32px;">
                  <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:#e6c200;">INSIDE MY MIND — SUA PLATAFORMA DE ACOMPANHAMENTO PESSOAL</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const text = `
INSIDE MY MIND — Redefinição de senha

Olá, ${name}!

Recebemos uma solicitação para redefinir sua senha. Acesse o link abaixo:
${resetLink}

Este link expira em 1 hora. Se você não solicitou esta redefinição, ignore este email.

INSIDE MY MIND — Sua plataforma de acompanhamento pessoal
  `;

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: "Redefinição de senha - Inside My Mind",
      html,
      text,
    });

    if (error) {
      logger.error({ msg: "Failed to send password reset email", error, to });
      throw new Error("Failed to send email");
    }

    logger.info({ msg: "Password reset email sent", to });
  } catch (err) {
    logger.error({ msg: "Error sending password reset email", error: err, to });
    throw err;
  }
}
