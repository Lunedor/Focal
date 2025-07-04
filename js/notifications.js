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
    async scanAndSchedule() {
        if (this.permission !== 'granted') return;

        const reminders = this.findAllRemindersWithTime();
        const user = firebase.auth().currentUser;
        if (!user) {
            console.warn('[Notifications] Cannot schedule. User not signed in.');
            return;
        }

        const now = new Date();
        const futureReminders = reminders.filter(reminder => reminder.date.getTime() > now.getTime());
        const localIds = new Set(futureReminders.map(r => r.id));

        // Fetch all reminders for this user from Firestore
        const snapshot = await firebase.firestore()
            .collection('reminders')
            .where('userId', '==', user.uid)
            .get();

        // Find cloud reminders not present locally (to delete)
        const toDelete = [];
        snapshot.forEach(doc => {
            if (!localIds.has(doc.id)) {
                toDelete.push(doc.ref);
            }
        });

        // Batch delete outdated reminders
        const batch = firebase.firestore().batch();
        toDelete.forEach(ref => batch.delete(ref));

        // Add/update all local future reminders
        futureReminders.forEach(reminder => {
            const reminderDocRef = firebase.firestore().collection('reminders').doc(reminder.id);
            batch.set(reminderDocRef, {
                userId: user.uid,
                reminderTime: firebase.firestore.Timestamp.fromDate(reminder.date),
                status: 'pending',
                notification: {
                    title: 'Focal Journal Reminder',
                    body: `${reminder.text}\nReminder from page: ${reminder.pageTitle || 'Weekly Planner'}`,
                    tag: reminder.id,
                    data: {
                        type: reminder.type,
                        pageKey: reminder.pageKey,
                        pageTitle: reminder.pageTitle,
                        plannerKey: reminder.plannerKey,
                    }
                }
            });
            console.log(`[Notifications] Queuing reminder for Firestore: "${reminder.text}"`);
        });

        await batch.commit();
        console.log(`[Notifications] Synced ${futureReminders.length} reminders, deleted ${toDelete.length} outdated reminders from Firestore.`);
    },

    /**
     * Scans all localStorage data for items with a (NOTIFY: ...) or (SCHEDULED: ...) tag containing a time.
     * @returns {Array<Object>} An array of reminder objects.
     */
    findAllRemindersWithTime() {
        const reminders = [];
        // This regex finds (SCHEDULED:...) or (NOTIFY:...) and captures the content inside.
        const reminderRegex = /\((SCHEDULED|NOTIFY):\s*([^)]+)\)/gi;

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('page-') || key.match(/^\d{4}-W\d{1,2}-/)) {
                const content = localStorage.getItem(key);
                const lines = content.split('\n');

                lines.forEach((line, index) => {
                    // Find all (SCHEDULED: ...) and (NOTIFY: ...) tags in the line
                    let scheduledDateTime = null;
                    let scheduledRaw = null;
                    let notifyRaw = null;
                    let notifyType = null;
                    let matches = [...line.matchAll(reminderRegex)];
                    matches.forEach(match => {
                        if (match[1] === 'SCHEDULED') {
                            scheduledRaw = match[2].trim();
                            if (typeof window.parseDateString === 'function') {
                                scheduledDateTime = window.parseDateString(scheduledRaw);
                            }
                        } else if (match[1] === 'NOTIFY') {
                            notifyRaw = match[2].trim();
                            notifyType = 'NOTIFY';
                        }
                    });

                    // If NOTIFY exists, process notification
                    if (notifyRaw && notifyRaw.includes(':')) {
                        let notifyDate = null;
                        // If NOTIFY is only a time (e.g., 09:00), combine with SCHEDULED date
                        if (/^\d{1,2}:\d{2}$/.test(notifyRaw) && scheduledDateTime && dateFns.isValid(scheduledDateTime)) {
                            // Combine scheduled date with NOTIFY time
                            const [h, m] = notifyRaw.split(':').map(Number);
                            notifyDate = new Date(scheduledDateTime);
                            notifyDate.setHours(h, m, 0, 0);
                        } else if (typeof window.parseDateString === 'function') {
                            notifyDate = window.parseDateString(notifyRaw);
                        }

                        if (notifyDate && dateFns.isValid(notifyDate)) {
                            const text = line.replace(/\((SCHEDULED|NOTIFY):[^)]+\)/gi, '').replace(/^[-*]\s*\[[x ]\]\s*/, '').trim();
                            let textHash = btoa(unescape(encodeURIComponent(text))).replace(/[^a-zA-Z0-9]/g, '').slice(0,8);

                            let type = null, pageKey = null, pageTitle = null, plannerKey = null, dayName = null;
                            if (key.startsWith('page-')) {
                                type = 'page';
                                pageKey = key;
                                pageTitle = key.substring(5);
                            } else if (key.match(/^\d{4}-W\d{1,2}-/)) {
                                type = 'planner';
                                plannerKey = key;
                                const parts = key.split('-');
                                dayName = parts[2] || null;
                            }

                            reminders.push({
                                id: `${notifyDate.getTime()}-${textHash}`,
                                text,
                                date: notifyDate,
                                type,
                                pageKey,
                                pageTitle,
                                plannerKey,
                                dayName
                            });
                        }
                    }
                    // If only SCHEDULED exists and you want to keep for visual/planning (not notification), skip adding to reminders
                });
            }
        }
        return reminders;
    },

    // updateStatusButton logic moved to settings.js for unified UI control
};

// Expose to global scope for easy access from other scripts
window.NotificationManager = NotificationManager;
