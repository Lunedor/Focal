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
    console.log("No data associated with the event");
    return;
  }
  const reminderData = snap.data();
  const reminderTime = reminderData.reminderTime.toDate();

  if (reminderTime < new Date()) {
    console.log(`Reminder ${event.params.reminderId} is in the past. Deleting.`);
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

  console.log(`Scheduling task for reminder ${event.params.reminderId} at ${reminderTime.toISOString()}`);
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
      console.log(`Reminder ${reminderId} no longer exists.`);
      res.status(200).send("OK: Reminder deleted or already processed.");
      return;
    }

    const reminder = reminderDoc.data();
    const userId = reminder.userId;

    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();
    const tokens = userDoc.exists && userDoc.data().tokens ? userDoc.data().tokens : [];


    if (tokens.length > 0) {
      const notificationPayload = reminder.notification;
      const dataForWorker = {};
      if (notificationPayload.data) {
        for (const key in notificationPayload.data) {
            const value = notificationPayload.data[key];
            dataForWorker[key] = value !== null && value !== undefined ? String(value) : '';
        }
      }
      const message = {
        notification: {
          title: notificationPayload.title,
          body: notificationPayload.body,
        },
        data: dataForWorker,
        tokens: tokens,
        webpush: {
          notification: {
            tag: String(notificationPayload.tag),
          },
        },
      };
      console.log(`Sending push for reminder ${reminderId} to ${tokens.length} devices.`);
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
        console.log(`Removed ${invalidTokens.length} invalid tokens for user ${userId}.`);
      }
    } else {
      console.log(`No tokens found for user ${userId}. Skipping push.`);
    }

    await reminderRef.delete();
    console.log(`Successfully processed and deleted reminder ${reminderId}.`);
    res.status(200).send("Push sent successfully");
    
  } catch (error) {
    console.error("Failed to send push notification:", error);
    res.status(500).send("Internal Server Error");
  }
});