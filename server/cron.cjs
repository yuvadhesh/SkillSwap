let cron = null;
try {
  cron = require('node-cron');
} catch (e) {
  console.warn("⚠️ node-cron is not installed! Cron jobs will be disabled.");
}

const db = require('./db.cjs');

function initCronJobs(admin) {
  if (!cron) return;
  // Utility function to send FCM messages
  const sendFCM = async (email, title, body) => {
    if (!admin) return;
    const tokens = await db.getUserFcmTokens(email);
    if (!tokens || tokens.length === 0) return;

    const message = {
      notification: { title, body },
      tokens: tokens
    };

    try {
      await admin.messaging().sendEachForMulticast(message);
    } catch (e) {
      console.error('Error sending FCM to', email, ':', e.message);
    }
  };

  // Task 1: Session Reminders (Runs every hour)
  cron.schedule('0 * * * *', async () => {
    console.log('[CRON] Running session reminders job...');
    try {
      const sessions = await db.getAllBookingSessions();
      const now = new Date();
      
      sessions.forEach(session => {
        if (session.status === 'accepted') {
          // Parse date and time correctly depending on storage format
          const sessionDateStr = typeof session.date === 'string' ? session.date : session.date.toISOString().split('T')[0];
          const sessionDateTime = new Date(`${sessionDateStr}T${session.time}:00`);
          const diffMs = sessionDateTime.getTime() - now.getTime();
          const diffHours = diffMs / (1000 * 60 * 60);

          // If the session starts within the next hour
          if (diffHours > 0 && diffHours <= 1) {
            const title = 'Upcoming SkillSwap Session!';
            const body = `Your session on ${session.topic} starts in less than an hour.`;
            
            sendFCM(session.requester, title, body);
            sendFCM(session.provider, title, body);
          }
        }
      });
    } catch (err) {
      console.error('[CRON] Error in session reminders:', err);
    }
  });

  // Task 2: New Match / Request Digest (Runs daily at 9:00 AM)
  cron.schedule('0 9 * * *', async () => {
    console.log('[CRON] Running daily match digest job...');
    try {
      const requests = await db.getAllSwapRequests();
      
      // Group pending requests by receiver
      const pendingByReceiver = {};
      requests.forEach(req => {
        if (req.status === 'pending') {
          if (!pendingByReceiver[req.receiver]) pendingByReceiver[req.receiver] = 0;
          pendingByReceiver[req.receiver]++;
        }
      });

      for (const [receiver, count] of Object.entries(pendingByReceiver)) {
        if (count > 0) {
          sendFCM(
            receiver,
            'SkillSwap Daily Digest',
            `You have ${count} pending swap request(s) waiting for your response!`
          );
        }
      }
    } catch (err) {
      console.error('[CRON] Error in daily digest:', err);
    }
  });

  console.log('Cron jobs initialized successfully.');
}

module.exports = { initCronJobs };
