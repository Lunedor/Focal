// functions/index.js - FINAL CORRECTED VERSION

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { CloudTasksClient } = require("@google-cloud/tasks");

// --- Initialization with EXPLICIT Project ID ---
// THIS IS THE FIX. We explicitly provide the Project ID from the environment.
admin.initializeApp({
  projectId: process.env.GCLOUD_PROJECT,
});
const db = admin.firestore();
const tasksClient = new CloudTasksClient();

// --- Configuration ---
const PROJECT_ID = process.env.GCLOUD_PROJECT;
const QUEUE_LOCATION = "europe-west6";
const QUEUE_NAME = "reminder-sender-queue";

// Set the region for all functions in this file
setGlobalOptions({ region: QUEUE_LOCATION });

/**
 * [Trigger] When a document is created in /reminders.
 */
exports.scheduleReminder = onDocumentCreated("reminders/{reminderId}", async (event) => {
  const snap = event.data;
  if (!snap) {
    
    return;
  }
  const reminderData = snap.data();
  const reminderTime = reminderData.reminderTime.toDate();

  if (reminderTime < new Date()) {
    
    return snap.ref.delete();
  }

  const queuePath = tasksClient.queuePath(PROJECT_ID, QUEUE_LOCATION, QUEUE_NAME);
  const taskPayload = { reminderId: event.params.reminderId };

  const task = {
    httpRequest: {
      httpMethod: "POST",
      url: `https://${QUEUE_LOCATION}-${PROJECT_ID}.cloudfunctions.net/sendReminderPush`,
      body: Buffer.from(JSON.stringify(taskPayload)).toString("base64"),
      headers: { "Content-Type": "application/json" },
    },
    scheduleTime: {
      seconds: reminderTime.getTime() / 1000,
    },
  };

  
  await tasksClient.createTask({ parent: queuePath, task });
  return snap.ref.update({ status: "scheduled" });
});


/**
 * [HTTP Trigger] Called by Cloud Tasks at the scheduled time.
 * This is the function with the corrected code from before.
 */
exports.sendReminderPush = onRequest(async (req, res) => {
  try {
    const { reminderId } = req.body;
    if (!reminderId) {
      console.error("No reminderId in request body");
      res.status(400).send("Bad Request: Missing reminderId");
      return;
    }

    const reminderRef = db.collection("reminders").doc(reminderId);
    const reminderDoc = await reminderRef.get();

    if (!reminderDoc.exists) {
      
      res.status(200).send("OK: Reminder deleted or already processed.");
      return;
    }

    const reminder = reminderDoc.data();
    const userId = reminder.userId;

    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();
    const tokens = userDoc.exists && userDoc.data().tokens ? userDoc.data().tokens : [];


    if (tokens.length > 0) {
      const notificationPayload = reminder.notification; // Bu obje zaten tüm bilgiyi içeriyor.

      // Anahtar değişiklik: Mesajı "sadece veri" (data-only) formatına çeviriyoruz.
      // 'notification' anahtarını kaldırarak FCM'nin otomatik bildirim göstermesini engelliyoruz.
      const message = {
        data: {
          // Tüm bildirim objesini JSON string olarak 'data' içine gömüyoruz.
          // Service worker bu string'i alıp parse edecek.
          notification: JSON.stringify(notificationPayload),
        },
        tokens: tokens,
        webpush: {
          notification: {
            // Etiketi (tag) burada belirlemek, bildirimlerin doğru şekilde
            // gruplanmasını/değiştirilmesini garanti eder.
            tag: String(notificationPayload.tag),
          },
        },
      };
      
      const response = await admin.messaging().sendEachForMulticast(message);
      // Remove invalid tokens
      const invalidTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const error = resp.error;
          if (
            error.code === 'messaging/invalid-registration-token' ||
            error.code === 'messaging/registration-token-not-registered'
          ) {
            invalidTokens.push(tokens[idx]);
          }
        }
      });
      if (invalidTokens.length > 0) {
        await userRef.update({
          tokens: admin.firestore.FieldValue.arrayRemove(...invalidTokens),
        });
        
      }
    } else {
      
    }

    await reminderRef.delete();
    
    res.status(200).send("Push sent successfully");
    
  } catch (error) {
    console.error("Failed to send push notification:", error);
    res.status(500).send("Internal Server Error");
  }
});
