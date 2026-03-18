const nodemailer = require('nodemailer');
const config = require('../../utils/config');
const logger = require('../../utils/logger');

let transporter = null;

const getTransporter = () => {
  if (transporter) {
    return transporter;
  }

  if (config.env === 'test' || config.env === 'development') {
    // Use a no-op transporter in test/dev
    transporter = {
      sendMail: async (options) => {
        logger.debug('Mock email sent', { to: options.to, subject: options.subject });
        return { messageId: `mock_${Date.now()}` };
      },
    };
  } else {
    transporter = nodemailer.createTransport({
      service: config.email.provider,
      auth: {
        user: config.email.gmailUser,
        pass: config.email.gmailPassword,
      },
    });
  }

  return transporter;
};

const sendEmail = async ({ to, subject, html, text }) => {
  const transport = getTransporter();
  const result = await transport.sendMail({
    from: config.email.from,
    to,
    subject,
    html,
    text,
  });
  logger.info('Email sent', { to, subject, messageId: result.messageId });
  return result;
};

const sendApplicationConfirmation = async ({ email, jobTitle, company }) => {
  return sendEmail({
    to: email,
    subject: `Application Submitted: ${jobTitle} at ${company}`,
    html: `<h2>Application Submitted</h2><p>Your application for <strong>${jobTitle}</strong> at <strong>${company}</strong> has been submitted successfully.</p>`,
    text: `Application Submitted: Your application for ${jobTitle} at ${company} has been submitted successfully.`,
  });
};

const sendNewMatchNotification = async ({ email, matchCount }) => {
  return sendEmail({
    to: email,
    subject: `${matchCount} New Job Matches Found`,
    html: `<h2>New Job Matches</h2><p>We found <strong>${matchCount}</strong> new jobs matching your preferences. Log in to review them.</p>`,
    text: `New Job Matches: We found ${matchCount} new jobs matching your preferences.`,
  });
};

module.exports = {
  getTransporter,
  sendEmail,
  sendApplicationConfirmation,
  sendNewMatchNotification,
};
