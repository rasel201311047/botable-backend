const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

const SUPPORT_EMAIL = 'support@bootble.com';

const hasBasicCredentials = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
const hasCustomSmtp = Boolean(process.env.SMTP_HOST);

if (!hasBasicCredentials) {
  logger.warn('Email configuration missing. OTP emails will not be sent.');
}

// Create transporter
const transporter = hasCustomSmtp
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: String(process.env.SMTP_ALLOW_SELF_SIGNED || '').toLowerCase() !== 'true',
      },
    })
  : nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: String(process.env.SMTP_ALLOW_SELF_SIGNED || '').toLowerCase() !== 'true',
      },
    });

// Verify connection only when credentials are present and production-like usage is expected
if (
  process.env.SMTP_HOST &&
  process.env.SMTP_USER &&
  process.env.SMTP_PASS &&
  process.env.NODE_ENV === 'production'
) {
  transporter.verify(function (error) {
    if (error) {
      logger.warn(`Email transporter verification skipped: ${error.message}`);
    } else {
      logger.info('Email transporter ready');
    }
  });
}

/**
 * Send OTP email
 * @param {string} to - Recipient email
 * @param {string} otp - OTP code
 * @param {string} type - Type of OTP (email_verification, password_reset, login_verification)
 * @returns {Promise<boolean>} Success status
 */
const sendOTPEmail = async (to, otp, type = 'verification') => {
  try {
    logger.info(`Attempting to send ${type} OTP email to ${to}`);

    const otpType = type === 'verification' ? 'email_verification' : type;

    const subject =
      otpType === 'email_verification'
        ? 'Verify Your Email - Bootble'
        : otpType === 'password_reset'
          ? 'Password Reset - Bootble'
          : 'Login Verification - Bootble';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Bootble</h1>
          <p style="color: rgba(255,255,255,0.8); margin: 10px 0 0;">Shift Work Optimization</p>
        </div>

        <div style="padding: 30px; background: #f9f9f9;">
          <h2 style="color: #333; margin-top: 0;">
            ${
              otpType === 'email_verification'
                ? 'Verify Your Email Address'
                : otpType === 'password_reset'
                  ? 'Reset Your Password'
                  : 'Complete Your Login'
            }
          </h2>

          <p style="color: #666; line-height: 1.6;">
            ${
              otpType === 'email_verification'
                ? 'Thank you for registering with Bootble. Please use the following OTP to verify your email address:'
                : otpType === 'password_reset'
                  ? 'You have requested to reset your password. Please use the following OTP to create a new password:'
                  : 'You are attempting to log in to Bootble. Please use the following OTP to complete your login:'
            }
          </p>

          <div style="text-align: center; margin: 40px 0;">
            <div style="display: inline-block; background: white; padding: 20px 40px; border-radius: 10px; border: 2px dashed #667eea;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #667eea;">
                ${otp}
              </span>
            </div>
          </div>

          <p style="color: #666; line-height: 1.6;">
            This OTP will expire in 10 minutes.
            ${
              otpType === 'email_verification'
                ? 'If you did not create an account with Bootble, please ignore this email.'
                : otpType === 'login_verification'
                  ? 'If you did not attempt to log in to Bootble, please ignore this email.'
                  : 'If you did not request a password reset, please ignore this email and consider securing your account.'
            }
          </p>

          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 12px;">
            <p>This is an automated message from Bootble. Please do not reply to this email.</p>
            <p>Need help? Contact ${SUPPORT_EMAIL}.</p>
            <p>© ${new Date().getFullYear()} Bootble. All rights reserved.</p>
          </div>
        </div>
      </div>
    `;

    const mailOptions = {
      from: `"Bootble" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    };

    await transporter.sendMail(mailOptions);
    logger.info(`OTP email sent successfully to ${to}`);
    return true;
  } catch (error) {
    logger.error(`Send OTP email error: ${error.message}`, {
      email: to,
      type,
      error: error.code || 'UNKNOWN_ERROR',
    });

    if (!hasBasicCredentials) {
      throw new Error('Email service is not configured. OTP email was not sent.');
    }

    throw new Error(`Failed to send OTP email: ${error.message}`);
  }
};

/**
 * Send welcome email
 * @param {string} to - Recipient email
 * @param {string} name - User name
 * @returns {Promise<boolean>} Success status
 */
const sendWelcomeEmail = async (to, name) => {
  if (!process.env.SMTP_USER) {
    logger.warn(`Email service not configured. Welcome email for ${to} skipped.`);
    return true;
  }

  try {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Welcome to Bootble!</h1>
          <p style="color: rgba(255,255,255,0.8); margin: 10px 0 0;">Shift Work Optimization</p>
        </div>
        
        <div style="padding: 30px; background: #f9f9f9;">
          <h2 style="color: #333; margin-top: 0;">Hi ${name},</h2>
          
          <p style="color: #666; line-height: 1.6;">
            Welcome to Bootble! We're excited to help you optimize your fitness routine around your shift schedule.
          </p>
          
          <div style="background: white; border-radius: 10px; padding: 20px; margin: 20px 0; border-left: 4px solid #667eea;">
            <h3 style="color: #333; margin-top: 0;">Getting Started:</h3>
            <ol style="color: #666; line-height: 1.8;">
              <li>Complete your onboarding to set your shift type and fitness goals</li>
              <li>Explore your personalized dashboard</li>
              <li>Log your first workout or meal</li>
              <li>Set up your schedule in the calendar</li>
            </ol>
          </div>
          
          <p style="color: #666; line-height: 1.6;">
            Our platform is designed specifically for shift workers like you. 
            We'll help you navigate the unique challenges of maintaining fitness with changing schedules.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.APP_URL}/dashboard" 
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                      color: white; padding: 15px 30px; text-decoration: none; 
                      border-radius: 25px; font-weight: bold; display: inline-block;">
              Go to Dashboard
            </a>
          </div>
          
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 12px;">
            <p>Need help? Contact our support team at ${SUPPORT_EMAIL}</p>
            <p>© ${new Date().getFullYear()} Bootble. All rights reserved.</p>
          </div>
        </div>
      </div>
    `;

    const mailOptions = {
      from: `"Bootble" <${process.env.SMTP_USER}>`,
      to,
      subject: 'Welcome to Bootble!',
      html,
    };

    await transporter.sendMail(mailOptions);
    logger.info(`Welcome email sent to ${to}`);
    return true;
  } catch (error) {
    logger.error(`Send welcome email error: ${error.message}`);
    throw new Error(`Failed to send welcome email: ${error.message}`);
  }
};

/**
 * Send password changed notification
 * @param {string} to - Recipient email
 * @param {string} name - User name
 * @returns {Promise<boolean>} Success status
 */
const sendPasswordChangedEmail = async (to, name) => {
  if (!process.env.SMTP_USER) {
    logger.warn(`Email service not configured. Password changed email for ${to} skipped.`);
    return true;
  }

  try {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Password Changed</h1>
          <p style="color: rgba(255,255,255,0.8); margin: 10px 0 0;">Bootble Security</p>
        </div>
        
        <div style="padding: 30px; background: #f9f9f9;">
          <h2 style="color: #333; margin-top: 0;">Hi ${name},</h2>
          
          <p style="color: #666; line-height: 1.6;">
            This is a confirmation that your Bootble account password was recently changed.
          </p>
          
          <div style="background: #fff3cd; border: 1px solid #ffecb5; border-radius: 5px; padding: 15px; margin: 20px 0;">
            <p style="color: #856404; margin: 0;">
              <strong>Security Notice:</strong> If you did not make this change, please contact our support team immediately at ${SUPPORT_EMAIL}.
            </p>
          </div>
          
          <p style="color: #666; line-height: 1.6;">
            For security reasons, we recommend:
          </p>
          
          <ul style="color: #666; line-height: 1.8;">
            <li>Using a strong, unique password</li>
            <li>Enabling two-factor authentication if available</li>
            <li>Regularly updating your password</li>
            <li>Not sharing your password with anyone</li>
          </ul>
          
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 12px;">
            <p>This is an automated security message from Bootble.</p>
            <p>© ${new Date().getFullYear()} Bootble. All rights reserved.</p>
          </div>
        </div>
      </div>
    `;

    const mailOptions = {
      from: `"Bootble Security" <${process.env.SMTP_USER}>`,
      to,
      subject: 'Your Bootble Password Was Changed',
      html,
    };

    await transporter.sendMail(mailOptions);
    logger.info(`Password changed email sent to ${to}`);
    return true;
  } catch (error) {
    logger.error(`Send password changed email error: ${error.message}`);
    throw new Error(`Failed to send password changed email: ${error.message}`);
  }
};

module.exports = {
  transporter,
  sendOTPEmail,
  sendWelcomeEmail,
  sendPasswordChangedEmail,
};
