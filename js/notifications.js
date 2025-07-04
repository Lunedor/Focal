// --- NOTIFICATION MANAGER ---

const NotificationManager = {
    permission: 'default',
    timeoutIds: [], // To keep track of scheduled notifications

    /**
     * Initializes the manager, checks for existing permissions, and schedules notifications if granted.
     */
    async init() {
        if (!('Notification' in window) || !('serviceWorker' in navigator)) {
            console.warn('This browser does not support desktop notifications.');
            return;
        }

        this.permission = Notification.permission;
        this.updateStatusButton && this.updateStatusButton();

        if (this.permission === 'granted') {
            this.scanAndSchedule();
        }
    },

    /**
     * Requests permission from the user to show notifications.
     * @returns {Promise<string>} The permission status ('granted', 'denied', 'default').
     */
    async requestPermission() {
        if (this.permission !== 'granted') {
            const status = await Notification.requestPermission();
            this.permission = status;
            if (this.updateStatusButton) this.updateStatusButton();
            if (status === 'granted') {
                console.log('[Notifications] Permission granted.');
                this.scanAndSchedule(); // Scan immediately after getting permission
            } else {
                console.log('[Notifications] Permission denied.');
            }
        }
        return this.permission;
    },

    /**
     * Clears all previously scheduled notification timeouts.
     */
    clearScheduled() {
        this.timeoutIds.forEach(id => clearTimeout(id));
        this.timeoutIds = [];
    },

    /**
     * The main worker function. It finds all reminders and creates them in Firestore.
    **/
    scanAndSchedule() {
        if (this.permission !== 'granted') {
            return;
        }

        const reminders = this.findAllRemindersWithTime(); // Your existing function is fine
        const user = firebase.auth().currentUser;

        if (!user) {
            console.warn('[Notifications] Cannot schedule. User not signed in.');
            return;
        }

        console.log(`[Notifications] Found ${reminders.length} reminders to sync with the cloud.`);
        
        // Use a batch write for efficiency
        const batch = firebase.firestore().batch();

        reminders.forEach(reminder => {
            const reminderTime = reminder.date;
            // Only schedule for the future
            if (reminderTime.getTime() > new Date().getTime()) {
                
                // Create a document in a new 'reminders' collection
                // The document ID should be unique to prevent duplicates if the user re-scans
                const reminderDocRef = firebase.firestore().collection('reminders').doc(reminder.id);

                batch.set(reminderDocRef, {
                    userId: user.uid,
                    reminderTime: firebase.firestore.Timestamp.fromDate(reminderTime),
                    status: 'pending', // We can track the status
                    notification: {
                        title: 'Focal Journal Reminder',
                        body: `${reminder.text}\nReminder from page: ${reminder.pageTitle || 'Weekly Planner'}`,
                        tag: reminder.id,
                        data: { // This is the data your service worker will receive
                            type: reminder.type,
                            pageKey: reminder.pageKey,
                            pageTitle: reminder.pageTitle,
                            plannerKey: reminder.plannerKey,
                        }
                    }
                });
                console.log(`[Notifications] Queuing reminder for Firestore: "${reminder.text}"`);
            }
        });

        // Commit the batch
        batch.commit()
            .then(() => console.log('[Notifications] Batch of reminders successfully sent to Firestore.'))
            .catch(err => console.error('Error sending reminders to Firestore:', err));
        
    },

    /**
     * Scans all localStorage data for items with a (NOTIFY: ...) or (SCHEDULED: ...) tag containing a time.
     * @returns {Array<Object>} An array of reminder objects.
     */
    findAllRemindersWithTime() {
        const reminders = [];
        // This regex finds (SCHEDULED:...) or (NOTIFY:...) and captures the content inside.
        const reminderRegex = /(?:\(SCHEDULED:|\(NOTIFY:)\s*([^)]+)\)/gi;

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('page-') || key.match(/^\d{4}-W\d{1,2}-/)) {
                const content = localStorage.getItem(key);
                const lines = content.split('\n');

                lines.forEach((line, index) => {
                    // Use matchAll to find all reminders in the line
                    const matches = [...line.matchAll(reminderRegex)];
                    matches.forEach(match => {
                        if (match && match[1] && match[1].includes(':')) { // Only consider tags that have a time (e.g., "09:00")
                            const dateTimeString = match[1].trim();
                            // Use centralized parseDateString for all supported formats
                            const parsedDate = (typeof window.parseDateString === 'function')
                                ? window.parseDateString(dateTimeString)
                                : null;

                            if (parsedDate && dateFns.isValid(parsedDate)) {
                                const text = line.replace(match[0], '').replace(/^[-*]\s*\[[x ]\]\s*/, '').trim();
                                // Make tag unique: use timestamp and a short hash of the text
                                let textHash = btoa(unescape(encodeURIComponent(text))).replace(/[^a-zA-Z0-9]/g, '').slice(0,8);

                                // Determine context for notification
                                let type = null, pageKey = null, pageTitle = null, plannerKey = null, dayName = null;
                                if (key.startsWith('page-')) {
                                    type = 'page';
                                    pageKey = key;
                                    pageTitle = key.substring(5);
                                } else if (key.match(/^\d{4}-W\d{1,2}-/)) {
                                    type = 'planner';
                                    plannerKey = key;
                                    // Try to extract day name from key (e.g., 2025-W27-monday)
                                    const parts = key.split('-');
                                    dayName = parts[2] || null;
                                }

                                reminders.push({
                                    id: `${parsedDate.getTime()}-${textHash}`,
                                    text,
                                    date: parsedDate,
                                    type,
                                    pageKey,
                                    pageTitle,
                                    plannerKey,
                                    dayName
                                });
                            }
                        }
                    });
                });
            }
        }
        return reminders;
    },

    // updateStatusButton logic moved to settings.js for unified UI control
};

// Expose to global scope for easy access from other scripts
window.NotificationManager = NotificationManager;
