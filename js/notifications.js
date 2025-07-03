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
     * The main worker function. It clears old notifications, finds all new ones, and schedules them.
     */
    scanAndSchedule() {
        if (this.permission !== 'granted') {
            return;
        }

        this.clearScheduled();
        const reminders = this.findAllRemindersWithTime();
        const now = new Date();

        console.log(`[Notifications] Found ${reminders.length} reminders to schedule.`);
        reminders.forEach(reminder => {
            const delay = reminder.date.getTime() - now.getTime();

            // Only schedule notifications for the future
            if (delay > 0) {
                // Compose a better notification body with context
                let contextText = '';
                if (reminder.type === 'planner') {
                    contextText = `Scheduled task for ${reminder.dayName}, ${reminder.date.toLocaleDateString()} in Weekly Planner.`;
                } else if (reminder.type === 'page') {
                    contextText = `Reminder from page: ${reminder.pageTitle}`;
                } else {
                    contextText = 'Focal Journal Reminder';
                }
                const notificationBody = `${reminder.text}\n${contextText}`;

                console.log(`[Notifications] Scheduling notification: "${notificationBody}" at ${reminder.date.toString()} (in ${Math.round(delay/1000)}s)`);
                const timeoutId = setTimeout(() => {
                    console.log(`[Notifications] Triggering notification: "${notificationBody}" at ${new Date().toString()}`);
                    // Use the service worker to show the notification for PWA offline support
                    navigator.serviceWorker.getRegistration().then(reg => {
                        if (!reg) {
                            console.warn('[Notifications] No service worker registration found.');
                            return;
                        }
                        reg.showNotification('Focal Journal Reminder', {
                            body: notificationBody,
                            icon: 'favicon192.png',
                            tag: reminder.id, // A unique tag prevents duplicate notifications
                            data: {
                                type: reminder.type,
                                pageKey: reminder.pageKey,
                                pageTitle: reminder.pageTitle,
                                plannerKey: reminder.plannerKey,
                                dayName: reminder.dayName,
                                date: reminder.date.toISOString(),
                                text: reminder.text
                            }
                        });
                    });
                }, delay);
                this.timeoutIds.push(timeoutId);
            } else {
                console.log(`[Notifications] Skipping past reminder: "${reminder.text}" at ${reminder.date.toString()}`);
            }
        });

        if (this.timeoutIds.length > 0) {
            console.log(`[Notifications] Scheduled ${this.timeoutIds.length} new reminders.`);
        } else {
            console.log('[Notifications] No future reminders to schedule.');
        }
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
