const EmailService = require('./EmailService');

/**
 * Shared Email Service Instance
 * Ensures a single instance is used across the application
 * to maintain queue consistency and proper job processing
 */
let emailServiceInstance = null;

function getEmailServiceInstance() {
  if (!emailServiceInstance) {
    emailServiceInstance = new EmailService();
  }
  return emailServiceInstance;
}

module.exports = {
  getEmailServiceInstance,
  // For testing - allow resetting the instance
  resetInstance: () => {
    if (emailServiceInstance) {
      emailServiceInstance.cleanup();
      emailServiceInstance = null;
    }
  }
};
