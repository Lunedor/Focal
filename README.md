# Focal Journal 🎯

A minimalist, local-first digital bullet journal designed for clarity and focus. Organize your tasks, notes, and goals using a powerful markdown-based system that runs entirely in your browser.

![Focal Journal Screenshot](https://github.com/Lunedor/Focal/blob/main/Screenshots/Screenshot_1.jpg)


## ✨ Key Features

*   **Dynamic Planner**: Seamlessly switch between a detailed **Weekly Planner** and a high-level **Monthly Calendar** view.
*   **Powerful Note-Taking**: All notes are written in Markdown. Create a personal knowledge base with wiki-style `[[bi-directional links]]`.
*   **Integrated Task Management**: Create tasks with `- [ ]` syntax. Summarize progress on related tasks with `TASKS:` blocks.
*   **Advanced Goal Tracking**: Define goals with `GOAL:` and track them automatically via checklists, counters, or manual `PROGRESS: [x%]` bars.
*   **Visual Mood Tracking**: Log your daily moods with an interactive widget. Choose between calendar, circular, or chart views and customize the display with colors or emojis to visualize your emotional patterns over time. Easy-to-use interface lets you record your mood with a simple click.
*   **Comprehensive Finance Tracking**: Monitor your income, expenses, and spending patterns with powerful finance widgets. Features include transaction categorization, multiple currency support, flexible time period filtering (daily, weekly, monthly, yearly, or custom date ranges), and various visualization options (summary tables, bar charts for trends, and pie charts for category breakdowns).
*   **Smart Scheduling**: Schedule tasks for specific dates with `(SCHEDULED: YYYY-MM-DD)` and create recurring events with `(REPEAT: ...)` syntax. These automatically appear in your weekly planner. Also can be set reminders with `(NOTIFY: YYYY-MM-DD HH:mm)` syntax for push notifications.
*   **Push Notifications**: Set reminders with `(NOTIFY: YYYY-MM-DD HH:mm)` syntax to receive push notifications for important tasks and events, even when the app is closed.
*   **Local-First & Private**: Your data lives in your browser's `localStorage` by default. No account is needed to get started.
*   **Optional Cloud Sync**: Securely back up and sync your journal across devices using **Firebase**. Your data is tied to your private Google account and synced in near real-time.
*   **Highly Customizable**: Choose from over 10 themes (including light, dark, solarized, dracula, and more) to personalize your experience.
*   **Keyboard-First Design**: Navigate and create with a rich set of keyboard shortcuts for maximum efficiency.

## 🛠️ Technology Stack

*   **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES6+)
*   **Backend & Cloud**:
    *   **Firebase**: Used for Authentication, Firestore (real-time database sync), Cloud Functions, and Cloud Messaging (for push notifications).
*   **Libraries**:
    *   date-fns for robust date manipulation.
    *   marked.js for Markdown parsing with custom extensions.
    *   Feather Icons for a clean, minimalist UI.
*   **Storage**: Browser `localStorage` (for local-first operation).

## ⚙️ How It Works

Focal is a single-page application (SPA) that runs entirely in your browser. All your data—planner entries, notes, and settings—is stored directly in your browser's `localStorage`. This makes it fast, offline-capable, and completely private.

### Markdown Extensions

Focal extends standard Markdown to create a rich, interconnected planning system:

*   `[[Page Title]]`: Creates a link to another page. If the page doesn't exist, it's created on the fly. All pages that link to the current page are shown in a "Linked Mentions" section, creating backlinks.
*   `GOAL: Track 10 books`: Defines a goal. Progress can be tracked automatically from checklists or numbered lists below it, or manually with a `PROGRESS: [50%]` line.
*   `TASKS: Project Alpha`: Creates a summary block that counts all `- [ ]` checklist items below it until the next major heading or horizontal rule.
*   `FINANCE: summary+chart, USD, this-month`: Creates a finance widget with the specified visualization types (summary, chart, chartpie), currency, and time filter. After the widget declaration, list transactions in this format:
    ```
    - YYYY-MM-DD, Description, +/-Amount, Category
    ```
    Examples:
    ```
    - 2025-01-01, Coffee, -4.50, Food
    - 2025-01-02, Freelance Payment, +500.00, Income
    ```

*   `MOOD: calendar, color, 2025-01-01:happy`: Creates a mood tracking widget with the specified display type (calendar, circular, chart) and style (color, emoji, all). Optionally add mood data directly in the format `date:mood_state`. Available mood states include: happy, excited, content, calm, neutral, tired, anxious, sad, angry.
*   `(SCHEDULED: 2025-12-25)`: Attaches a date to a task, making it appear in the weekly planner on that day.
*   `(REPEAT: every monday)`: Creates a recurring event that appears in the weekly planner.
*   `(NOTIFY: 2025-12-25 09:00)`: Schedules a push notification for a specific date and time.

### Cloud Sync

When you sign in with your Google account and enable Cloud Sync, Focal saves your journal data to a secure, private document in **Firebase's Firestore database**. This allows for near real-time synchronization across all your logged-in devices. The sync logic uses a "last write wins" approach based on timestamps, ensuring that the most recent version of your data is preserved. This process is seamless and keeps your journal up-to-date everywhere.

## 🚀 Getting Started

Focal is a static web application and requires no build process.

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/Lunedor/Focal.git
    ```

2.  **Navigate to the directory:**
    ```bash
    cd Focal
    ```

3.  **Open `index.html` in your web browser.**

> **Note**: For features like Google Sign-In and Cloud Sync to work correctly, it's recommended to serve the files from a local web server (e.g., using the VS Code "Live Server" extension or Python's `http.server`) rather than opening the `index.html` file directly from the filesystem. This is because Firebase's authentication and services require a valid `http://` or `https://` origin.

### Example: Using Python's built-in server

```bash
# From within the project directory
python -m http.server
# Or for Python 2
# python -m SimpleHTTPServer
```
Now you can access the app at http://localhost:8000.

📜 License
This project is licensed under the MIT License.

Created by Lunedor.
