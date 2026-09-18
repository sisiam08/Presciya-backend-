import nodemailer from "nodemailer";
import config from "../config";

// Create a reusable transporter
const transporter = nodemailer.createTransport({
  host: config.nodemailer.host,
  port: config.nodemailer.port,
  secure: config.nodemailer.port === 465, // true for 465, false for other ports
  auth: {
    user: config.nodemailer.auth.user,
    pass: config.nodemailer.auth.pass,
  },
});

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

const sendEmail = async (options: EmailOptions): Promise<void> => {
  try {
    const mailOptions = {
      from: config.nodemailer.auth.user,
      to: options.to,
      subject: options.subject,
      text: options.text || "",
      html: options.html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully:", info.messageId);
  } catch (error) {
    console.error("Failed to send email:", error);
    throw error;
  }
};

// Password reset email template
const sendPasswordResetEmail = async (
  email: string,
  name: string,
  resetToken: string,
  resetUrl: string,
): Promise<void> => {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: 'Inter', sans-serif; color: #0b1c30; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #0058bc; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
          .content { background-color: #f8f9ff; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background-color: #0058bc; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
          .footer { font-size: 12px; color: #717786; margin-top: 20px; text-align: center; }
          .warning { background-color: #ffdad6; padding: 10px; border-radius: 4px; margin-top: 20px; color: #93000a; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Presciya Password Reset</h1>
          </div>
          <div class="content">
            <p>Hello ${name},</p>
            <p>You requested a password reset for your Presciya account. Click the button below to reset your password:</p>
            
            <center>
              <a href="${resetUrl}" class="button">Reset Password</a>
            </center>
            
            <p style="margin-top: 20px;">Or copy and paste this link in your browser:</p>
            <p style="word-break: break-all; background-color: #e5eeff; padding: 10px; border-radius: 4px;">
              ${resetUrl}
            </p>
            
            <div class="warning">
              <strong>⚠️ Security Notice:</strong>
              <ul>
                <li>This link will expire in 15 minutes</li>
                <li>Never share this link with anyone</li>
                <li>If you didn't request this, please ignore this email</li>
              </ul>
            </div>
            
            <p style="margin-top: 20px; color: #414755;">
              If you have any questions, please contact our support team.
            </p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Presciya. All rights reserved.</p>
            <p>This is an automated email. Please do not reply.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const textContent = `
Hello ${name},

You requested a password reset for your Presciya account. 

Click the link below to reset your password:
${resetUrl}

This link will expire in 15 minutes.

Never share this link with anyone. If you didn't request this, please ignore this email.

If you have any questions, please contact our support team.

---
Presciya
  `;

  await sendEmail({
    to: email,
    subject: "Reset Your Presciya Password",
    html: htmlContent,
    text: textContent,
  });
};

// Workspace invitation email template
const sendInvitationEmail = async (
  email: string,
  name: string,
  workspaceName: string,
  invitationToken: string,
  dummyPassword?: string,
  isNewUser?: boolean,
): Promise<void> => {
  const invitationUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/invitations/${invitationToken}`;

  const credentialsSection =
    isNewUser && dummyPassword
      ? `
            <div class="highlight" style="background-color: #fff3cd; border-left-color: #ff9800;">
              <p style="color: #856404;"><strong>⚠️ Temporary Login Credentials</strong></p>
              <p style="color: #856404; margin-bottom: 5px;">Your account has been created. Use these credentials to log in:</p>
              <p style="background-color: #fff; padding: 10px; border-radius: 4px; margin: 10px 0; font-family: 'Courier New', monospace; color: #0b1c30;">
                <strong>Email:</strong> ${email}<br/>
                <strong>Password:</strong> ${dummyPassword}
              </p>
              <p style="color: #d9534f; margin-top: 10px;"><strong>Important:</strong> This is a temporary password. After logging in, you <strong>must immediately change your password</strong> from your account settings for security reasons.</p>
            </div>
  `
      : "";

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: 'Inter', sans-serif; color: #0b1c30; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #0058bc; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
          .content { background-color: #f8f9ff; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background-color: #0058bc; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin-top: 20px; font-weight: bold; font-size: 14px; }
          .footer { font-size: 12px; color: #717786; margin-top: 20px; text-align: center; }
          .highlight { background-color: #e5eeff; padding: 10px; border-left: 4px solid #0058bc; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>You're Invited to ${workspaceName}</h1>
          </div>
          <div class="content">
            <p>Hello ${name},</p>
            <p>You've been invited to join <strong>${workspaceName}</strong> on Presciya!</p>
            
            <center>
              <a href="${invitationUrl}" class="button" style="color: white; font-weight: bold; font-size: 14px;">Accept Invitation</a>
            </center>
            
            <div class="highlight">
              <p><strong>Or copy this link:</strong></p>
              <p style="word-break: break-all; margin: 0;">
                ${invitationUrl}
              </p>
            </div>
            
            ${credentialsSection}
            
            <p style="margin-top: 20px; color: #414755;">
              <strong>Note:</strong> This invitation will expire in ${config.invitationExpiryDays} days.
            </p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Presciya. All rights reserved.</p>
            <p>This is an automated email. Please do not reply.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const credentialsTextSection =
    isNewUser && dummyPassword
      ? `

⚠️ TEMPORARY LOGIN CREDENTIALS
===============================
Your account has been created. Use these credentials to log in:

Email: ${email}
Password: ${dummyPassword}

IMPORTANT: This is a temporary password. After logging in, you MUST immediately change your password from your account settings for security reasons.
  `
      : "";

  const textContent = `
Hello ${name},

You've been invited to join ${workspaceName} on Presciya!

Click the link below to accept the invitation:
${invitationUrl}

This invitation will expire in ${config.invitationExpiryDays} days.
${credentialsTextSection}
---
Presciya
  `;

  await sendEmail({
    to: email,
    subject: `You're invited to ${workspaceName} on Presciya`,
    html: htmlContent,
    text: textContent,
  });
};

// OTP email template
const sendOTPEmail = async (
  email: string,
  name: string,
  otp: string,
): Promise<void> => {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: 'Inter', sans-serif; color: #0b1c30; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #0058bc; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
          .content { background-color: #f8f9ff; padding: 30px; border-radius: 0 0 8px 8px; }
          .otp-box { background-color: #0058bc; color: white; padding: 20px; border-radius: 6px; text-align: center; margin-top: 20px; }
          .otp-code { font-size: 32px; font-weight: bold; letter-spacing: 5px; font-family: 'Courier New', monospace; }
          .footer { font-size: 12px; color: #717786; margin-top: 20px; text-align: center; }
          .warning { background-color: #ffdad6; padding: 10px; border-radius: 4px; margin-top: 20px; color: #93000a; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Presciya Email Verification</h1>
          </div>
          <div class="content">
            <p>Hello ${name},</p>
            <p>Thank you for signing up to Presciya! To complete your registration, please verify your email address using the OTP below:</p>
            
            <div class="otp-box">
              <div class="otp-code">${otp}</div>
            </div>
            
            <p style="margin-top: 20px; text-align: center; color: #717786;">
              This code will expire in 15 minutes
            </p>
            
            <div class="warning">
              <strong>⚠️ Security Notice:</strong>
              <ul>
                <li>Never share this OTP with anyone</li>
                <li>Presciya staff will never ask for your OTP</li>
                <li>This code is valid for 15 minutes only</li>
              </ul>
            </div>
            
            <p style="margin-top: 20px; color: #414755;">
              If you didn't request this, please ignore this email or contact our support team.
            </p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Presciya. All rights reserved.</p>
            <p>This is an automated email. Please do not reply.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const textContent = `
Hello ${name},

Thank you for signing up to Presciya! To complete your registration, please verify your email using this OTP:

${otp}

This code will expire in 15 minutes.

Never share this OTP with anyone. If you didn't request this, please ignore this email.

---
Presciya
  `;

  await sendEmail({
    to: email,
    subject: "Verify Your Presciya Account - OTP: " + otp,
    html: htmlContent,
    text: textContent,
  });
};

export const emailService = {
  sendEmail,
  sendPasswordResetEmail,
  sendOTPEmail,
};

export { sendInvitationEmail };
