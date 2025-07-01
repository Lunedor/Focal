# Focal Journal 🎯

A minimalist, local-first digital bullet journal designed for clarity and focus. Organize your tasks, notes, and goals using a powerful markdown-based system that runs entirely in your browser.

![Focal Journal Screenshot](https://github.com/Lunedor/Focal/blob/main/Screenshots/Screenshot_1.jpg) 
*(Replace this with a real screenshot of your application)*

## ✨ Key Features

*   **Dynamic Planner**: Seamlessly switch between a detailed **Weekly Planner** and a high-level **Monthly Calendar** view.
*   **Powerful Note-Taking**: All notes are written in Markdown. Create a personal knowledge base with wiki-style `[[bi-directional links]]`.
*   **Integrated Task Management**: Create tasks with `- [ ]` syntax. Summarize progress on related tasks with `TASKS:` blocks.
*   **Advanced Goal Tracking**: Define goals with `GOAL:` and track them automatically via checklists, counters, or manual `PROGRESS: [x%]` bars.
*   **Smart Scheduling**: Schedule tasks for specific dates with `(SCHEDULED: YYYY-MM-DD)` and create recurring events with `(REPEAT: ...)` syntax. These automatically appear in your weekly planner.
*   **Local-First & Private**: Your data lives in your browser's `localStorage` by default. No account is needed to get started.
*   **Optional Cloud Sync**: Securely back up and sync your journal across devices using your own Google Drive account. Data is stored in a private application folder that only Focal can access.
*   **Highly Customizable**: Choose from over 10 themes (including light, dark, solarized, dracula, and more) to personalize your experience.
*   **Keyboard-First Design**: Navigate and create with a rich set of keyboard shortcuts for maximum efficiency.

## 🛠️ Technology Stack

*   **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES6+)
*   **Libraries**:
    *   date-fns for robust date manipulation.
    *   marked.js for Markdown parsing with custom extensions.
    *   Feather Icons for a clean, minimalist UI.
*   **APIs**:
    *   Google Identity Services for authentication.
    *   Google Drive API (v3) for cloud sync to the AppData folder.
*   **Storage**: Browser `localStorage`.

## ⚙️ How It Works

Focal is a single-page application (SPA) that runs entirely in your browser. All your data—planner entries, notes, and settings—is stored directly in your browser's `localStorage`. This makes it fast, offline-capable, and completely private.

### Markdown Extensions

Focal extends standard Markdown to create a rich, interconnected planning system:

*   `[[Page Title]]`: Creates a link to another page. If the page doesn't exist, it's created on the fly. All pages that link to the current page are shown in a "Linked Mentions" section, creating backlinks.
*   `GOAL: Track 10 books`: Defines a goal. Progress can be tracked automatically from checklists or numbered lists below it, or manually with a `PROGRESS: [50%]` line.
*   `TASKS: Project Alpha`: Creates a summary block that counts all `- [ ]` checklist items below it until the next major heading or horizontal rule.
*   `(SCHEDULED: 2025-12-25)`: Attaches a date to a task, making it appear in the weekly planner on that day.
*   `(REPEAT: every monday)`: Creates a recurring event that appears in the weekly planner.

### Cloud Sync

When you sign in with Google and enable Cloud Sync, Focal periodically saves a `focal-data.json` file containing your `localStorage` data to a special, hidden "AppData" folder in your Google Drive. This folder is only accessible by this application, ensuring your data remains private. On another device, you can sign in and restore your data from this backup.

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

> **Note**: For features like Google Sign-In to work correctly, it's recommended to serve the files from a local web server (e.g., using the VS Code "Live Server" extension or Python's `http.server`) rather than opening the `index.html` file directly from the filesystem. This is because Google's authentication libraries require a valid `http://` or `https://` origin.

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
