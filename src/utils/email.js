const nodemailer = require("nodemailer");

const getTransporter = () => {
  if (process.env.EMAIL_PROVIDER === "smtp") {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === "true",
      family: 4, // ⭐ force IPv4 (fixes Render Gmail issue)
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return null;
};

const sendOTP = async (to, otp, purpose) => {
  const subject = purpose === 'email_verification'
    ? 'Verify your AgriSense account'
    : 'Reset your AgriSense password';

  const text = `Your OTP is: ${otp}. It expires in 10 minutes.`;

  if (process.env.EMAIL_PROVIDER === 'smtp') {
    const transporter = getTransporter();
    if (!transporter) throw new Error('SMTP transporter not configured');
    await transporter.sendMail({
      from: `"AgriSense" <${process.env.SMTP_FROM}>`,
      to,
      subject,
      text,
    });
  } else {
    // Console logging – perfect for local development
    console.log('\n=================================');
    console.log(`📧 Email to: ${to}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   OTP: ${otp}`);
    console.log(`   Purpose: ${purpose}`);
    console.log('=================================\n');
  }
};

module.exports = { sendOTP };