#!/usr/bin/env node

/**
 * Email Service Demo Script
 * Demonstrates the key features of the resilient email service
 */

const EmailService = require('./src/services/EmailService');
const logger = require('./src/utils/Logger');

async function demonstrateEmailService() {
  console.log('🚀 Starting Email Service Demo\n');

  const emailService = new EmailService({
    maxRetries: 2,
    initialRetryDelay: 500,
    enableQueue: true,
    enableCircuitBreaker: true
  });

  try {
    // Demo 1: Basic email sending
    console.log('📧 Demo 1: Basic Email Sending');
    console.log('================================');
    
    const basicEmail = {
      to: 'demo@example.com',
      subject: 'Welcome to Resilient Email Service',
      body: 'This is a demonstration of our resilient email sending service with retry logic and fallback mechanisms.',
      idempotencyKey: `demo-basic-${Date.now()}`
    };

    const result1 = await emailService.sendEmail(basicEmail);
    console.log('✅ Email sent:', JSON.stringify(result1, null, 2));
    console.log();

    // Demo 2: Idempotency
    console.log('🔄 Demo 2: Idempotency (Duplicate Prevention)');
    console.log('===============================================');
    
    const idempotentEmail = {
      to: 'idempotent@example.com',
      subject: 'Idempotent Email Test',
      body: 'This email should only be sent once, even if requested multiple times.',
      idempotencyKey: 'demo-idempotent-123'
    };

    console.log('Sending email first time...');
    const result2a = await emailService.sendEmail(idempotentEmail);
    console.log('First attempt:', result2a.status);

    console.log('Sending same email again (should be idempotent)...');
    const result2b = await emailService.sendEmail(idempotentEmail);
    console.log('Second attempt:', result2b.status);
    console.log();

    // Demo 3: Priority and delayed emails
    console.log('⏰ Demo 3: Priority and Delayed Emails');
    console.log('======================================');
    
    const priorityEmails = [
      {
        to: 'low-priority@example.com',
        subject: 'Low Priority Email',
        body: 'This is a low priority email.',
        idempotencyKey: `demo-low-${Date.now()}`,
        priority: 1,
        delay: 2000 // 2 second delay
      },
      {
        to: 'high-priority@example.com',
        subject: 'High Priority Email',
        body: 'This is a high priority email that should be processed first.',
        idempotencyKey: `demo-high-${Date.now()}`,
        priority: 10
      }
    ];

    for (const email of priorityEmails) {
      const result = await emailService.sendEmail(email);
      console.log(`📨 ${email.subject}: ${result.status} (Priority: ${email.priority || 0})`);
    }
    console.log();

    // Demo 4: Status tracking
    console.log('📊 Demo 4: Email Status Tracking');
    console.log('=================================');
    
    const trackingEmail = {
      to: 'tracking@example.com',
      subject: 'Status Tracking Demo',
      body: 'This email demonstrates status tracking capabilities.',
      idempotencyKey: `demo-tracking-${Date.now()}`
    };

    const trackingResult = await emailService.sendEmail(trackingEmail);
    console.log('Email queued with ID:', trackingResult.idempotencyKey);

    // Check status multiple times
    for (let i = 0; i < 3; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const status = emailService.getEmailStatus(trackingEmail.idempotencyKey);
      console.log(`Status check ${i + 1}:`, status.status);
    }
    console.log();

    // Demo 5: Health monitoring
    console.log('🏥 Demo 5: Service Health Monitoring');
    console.log('====================================');
    
    const health = await emailService.getHealthStatus();
    console.log('Service Status:', health.status);
    console.log('Providers:');
    Object.entries(health.providers).forEach(([name, provider]) => {
      console.log(`  - ${name}: ${provider.healthy ? '✅ Healthy' : '❌ Unhealthy'}`);
    });
    
    console.log('\nQueue Statistics:');
    console.log(`  - Queued: ${health.queue.queued}`);
    console.log(`  - Processing: ${health.queue.processing}`);
    console.log(`  - Completed: ${health.queue.completed}`);
    console.log(`  - Failed: ${health.queue.failed}`);
    console.log();

    // Demo 6: Bulk email sending
    console.log('📬 Demo 6: Bulk Email Sending');
    console.log('=============================');
    
    const bulkEmails = Array(5).fill().map((_, i) => ({
      to: `bulk-${i}@example.com`,
      subject: `Bulk Email ${i + 1}`,
      body: `This is bulk email number ${i + 1} of 5.`,
      idempotencyKey: `demo-bulk-${i}-${Date.now()}`
    }));

    console.log(`Sending ${bulkEmails.length} emails in bulk...`);
    for (const email of bulkEmails) {
      await emailService.sendEmail(email);
    }
    console.log('✅ Bulk emails queued successfully');
    console.log();

    // Wait for processing
    console.log('⏳ Waiting for email processing to complete...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Final health check
    const finalHealth = await emailService.getHealthStatus();
    console.log('\n📈 Final Statistics:');
    console.log('====================');
    console.log(`Total Completed: ${finalHealth.queue.completed}`);
    console.log(`Total Failed: ${finalHealth.queue.failed}`);
    console.log(`Currently Processing: ${finalHealth.queue.processing}`);
    console.log(`Still Queued: ${finalHealth.queue.queued}`);

  } catch (error) {
    console.error('❌ Demo failed:', error.message);
  } finally {
    emailService.cleanup();
    console.log('\n🎉 Demo completed! Check the logs above for detailed results.');
    process.exit(0);
  }
}

// Run the demo
if (require.main === module) {
  demonstrateEmailService().catch(console.error);
}

module.exports = demonstrateEmailService;
