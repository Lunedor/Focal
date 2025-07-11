// js/habitTracker.js
const HabitTracker = (function() {
    'use strict';
    
    let placeholder = null;
    let onCommandChange = null;
    let habitDefinitions = [];
    let currentDate = new Date();
    
    // --- HABIT DEFINITIONS MANAGEMENT ---
    
    function getHabitDefinitions() {
        const definitions = getStorage('habit-definitions');
        if (!definitions) return [];
        try {
            return JSON.parse(definitions);
        } catch (e) {
            return [];
        }
    }
    
    function saveHabitDefinitions(definitions) {
        setStorage('habit-definitions', JSON.stringify(definitions));
        if (typeof debouncedSyncWithCloud === 'function') {
            debouncedSyncWithCloud();
        }
    }
    
    function parseHabitDefinitions(content) {
        const lines = content.split('\n');
        const definitions = [];
        let inDefineBlock = false;
        
        for (let line of lines) {
            line = line.trim();
            if (line.match(/^HABITS:\s*define$/i)) {
                inDefineBlock = true;
                continue;
            }
            if (inDefineBlock) {
                if (line.startsWith('- ')) {
                    const habitLine = line.substring(2).trim();
                    if (habitLine) { // Only process non-empty lines
                        // Parse habit with potential TARGET and SCHEDULE
                        const habit = parseHabitLine(habitLine);
                        if (habit && habit.name) {
                            definitions.push(habit);
                        }
                    }
                } else if (line && !line.startsWith('-') && !line.startsWith('#') && !line.startsWith('---')) {
                    // End of definition block if we hit a non-list item (but not horizontal rule)
                    break;
                }
            }
        }
        
        return definitions;
    }
    
    function parseHabitLine(habitLine) {
        let name = habitLine;
        let target = null;
        let schedule = { type: 'everyday', days: [] };
        let type = 'binary';
        let category = 'General';
        let goal = null;
        let achievement = null;
        
        // Parse TARGET
        const targetMatch = habitLine.match(/\(TARGET:\s*([^)]+)\)/i);
        if (targetMatch) {
            target = targetMatch[1].trim();
            type = 'quantified';
            name = habitLine.replace(/\(TARGET:\s*[^)]+\)/i, '').trim();
        }
        
        // Parse CATEGORY
        const categoryMatch = habitLine.match(/\(CATEGORY:\s*([^)]+)\)/i);
        if (categoryMatch) {
            category = categoryMatch[1].trim();
            name = name.replace(/\(CATEGORY:\s*[^)]+\)/i, '').trim();
        }
        
        // Parse GOAL
        const goalMatch = habitLine.match(/\(GOAL:\s*([^)]+)\)/i);
        if (goalMatch) {
            goal = parseGoalString(goalMatch[1].trim());
            name = name.replace(/\(GOAL:\s*[^)]+\)/i, '').trim();
        }
        
        // Parse ACHIEVEMENT(S) - support multiple achievements
        const achievementMatches = habitLine.match(/\(ACHIEVEMENT:\s*([^)]+)\)/gi);
        if (achievementMatches && achievementMatches.length > 0) {
            const achievements = [];
            for (const match of achievementMatches) {
                const achievementContent = match.match(/\(ACHIEVEMENT:\s*([^)]+)\)/i)[1].trim();
                const parsedAchievement = parseAchievementString(achievementContent);
                if (parsedAchievement) {
                    achievements.push(parsedAchievement);
                }
                name = name.replace(match, '').trim();
            }
            achievement = achievements.length === 1 ? achievements[0] : achievements;
        }
        
        // Parse SCHEDULE
        const scheduleMatch = habitLine.match(/\(SCHEDULE:\s*([^)]+)\)/i);
        if (scheduleMatch) {
            const scheduleStr = scheduleMatch[1].trim().toLowerCase();
            schedule = parseScheduleString(scheduleStr);
            name = name.replace(/\(SCHEDULE:\s*[^)]+\)/i, '').trim();
        }
        
        if (!name) return null;
        
        const habit = {
            name,
            type,
            id: generateHabitId(name),
            schedule,
            category
        };
        
        if (type === 'quantified') {
            habit.target = target;
        }
        
        if (goal) {
            habit.goal = goal;
        }
        
        if (achievement) {
            habit.achievement = achievement;
        }
        
        return habit;
    }
    
    function parseScheduleString(scheduleStr) {
        const schedule = { type: 'everyday', days: [] };
        
        if (scheduleStr === 'everyday' || scheduleStr === 'daily') {
            schedule.type = 'everyday';
            schedule.days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
        } else if (scheduleStr === 'weekdays') {
            schedule.type = 'weekdays';
            schedule.days = ['mon', 'tue', 'wed', 'thu', 'fri'];
        } else if (scheduleStr === 'weekends') {
            schedule.type = 'weekends';
            schedule.days = ['sat', 'sun'];
        } else {
            // Parse specific days like "mon, wed, fri" or "tuesday, thursday"
            schedule.type = 'specific';
            const dayMap = {
                'monday': 'mon', 'mon': 'mon',
                'tuesday': 'tue', 'tue': 'tue', 'tues': 'tue',
                'wednesday': 'wed', 'wed': 'wed',
                'thursday': 'thu', 'thu': 'thu', 'thurs': 'thu',
                'friday': 'fri', 'fri': 'fri',
                'saturday': 'sat', 'sat': 'sat',
                'sunday': 'sun', 'sun': 'sun'
            };
            
            const dayStrings = scheduleStr.split(',').map(d => d.trim().toLowerCase());
            schedule.days = dayStrings
                .map(dayStr => dayMap[dayStr])
                .filter(day => day); // Remove undefined values
        }
        
        return schedule;
    }
    
    function parseGoalString(goalStr) {
        const goal = { type: null, count: 1, period: 'week' };
        
        // Normalize the string
        const normalized = goalStr.toLowerCase().trim();
        
        // Parse patterns like "3 times per week", "5 times per month", "7 days in a row"
        
        // Weekly goals: "3 times per week", "3x per week", "3/week"
        const weeklyMatch = normalized.match(/(\d+)\s*(?:times?\s*(?:per|a)\s*week|x\s*(?:per|a)\s*week|\/\s*week)/);
        if (weeklyMatch) {
            goal.type = 'weekly';
            goal.count = parseInt(weeklyMatch[1]);
            goal.period = 'week';
            return goal;
        }
        
        // Monthly goals: "20 times per month", "20x per month", "20/month"
        const monthlyMatch = normalized.match(/(\d+)\s*(?:times?\s*(?:per|a)\s*month|x\s*(?:per|a)\s*month|\/\s*month)/);
        if (monthlyMatch) {
            goal.type = 'monthly';
            goal.count = parseInt(monthlyMatch[1]);
            goal.period = 'month';
            return goal;
        }
        
        // Streak goals: "7 days in a row", "10 day streak", "5 consecutive days"
        const streakMatch = normalized.match(/(\d+)\s*(?:days?\s*(?:in\s*a\s*row|consecutive|streak)|day\s*streak)/);
        if (streakMatch) {
            goal.type = 'streak';
            goal.count = parseInt(streakMatch[1]);
            goal.period = 'streak';
            return goal;
        }
        
        // Daily goals (every day): "every day", "daily", "all days"
        if (normalized.match(/(?:every\s*day|daily|all\s*days)/)) {
            goal.type = 'daily';
            goal.count = 7; // 7 days per week
            goal.period = 'week';
            return goal;
        }
        
        // Default: try to extract just a number and assume weekly
        const numberMatch = normalized.match(/(\d+)/);
        if (numberMatch) {
            goal.type = 'weekly';
            goal.count = parseInt(numberMatch[1]);
            goal.period = 'week';
            return goal;
        }
        
        return null;
    }
    
    function parseAchievementString(achievementStr) {
        // Parse achievement format: "7 day streak = Movie night"
        // Supported formats:
        // - "7 day streak = Reward text"
        // - "30 completions = Reward text"  
        // - "100% week = Reward text"
        // - "perfect month = Reward text"
        
        const parts = achievementStr.split('=');
        if (parts.length !== 2) {
            return null;
        }
        
        const trigger = parts[0].trim().toLowerCase();
        const reward = parts[1].trim();
        
        // Parse different trigger types
        
        // Streak triggers: "7 day streak", "10 days in a row", "5 consecutive days"
        const streakMatch = trigger.match(/(\d+)\s*(?:day|days?)\s*(?:streak|in\s*a\s*row|consecutive)/);
        if (streakMatch) {
            return {
                type: 'streak',
                target: parseInt(streakMatch[1]),
                reward: reward,
                id: generateAchievementId(achievementStr)
            };
        }
        
        // Completion count triggers: "30 completions", "100 times", "50 total"
        const countMatch = trigger.match(/(\d+)\s*(?:completions?|times?|total)/);
        if (countMatch) {
            return {
                type: 'total_completions',
                target: parseInt(countMatch[1]),
                reward: reward,
                id: generateAchievementId(achievementStr)
            };
        }
        
        // Perfect week trigger: "100% week", "perfect week"
        if (trigger.match(/(?:100%|perfect)\s*week/)) {
            return {
                type: 'perfect_week',
                target: 1, // Just need one perfect week
                reward: reward,
                id: generateAchievementId(achievementStr)
            };
        }
        
        // Perfect month trigger: "100% month", "perfect month"
        if (trigger.match(/(?:100%|perfect)\s*month/)) {
            return {
                type: 'perfect_month',
                target: 1, // Just need one perfect month
                reward: reward,
                id: generateAchievementId(achievementStr)
            };
        }
        
        return null;
    }
    
    function generateAchievementId(achievementStr) {
        return 'achievement-' + achievementStr.toLowerCase()
            .replace(/[^a-z0-9\s]/g, '') // Remove special characters except spaces
            .replace(/\s+/g, '-') // Replace spaces with hyphens
            .replace(/-+/g, '-') // Collapse multiple hyphens
            .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
    }
    
    function generateHabitId(name) {
        // Create a stable ID based only on the core habit name
        // This ensures the same habit keeps the same ID even when modified
        const coreId = name.toLowerCase()
            .replace(/[^a-z0-9\s]/g, '') // Remove special characters except spaces
            .replace(/\s+/g, '-') // Replace spaces with hyphens
            .replace(/-+/g, '-') // Collapse multiple hyphens
            .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
        
        // Check if this ID already exists in definitions and find existing ID if habit exists
        const existingDefinitions = getHabitDefinitions();
        const existingHabit = existingDefinitions.find(h => h.name === name);
        
        if (existingHabit) {
            return existingHabit.id; // Return existing ID to maintain data continuity
        }
        
        return coreId;
    }
    
    // --- SCHEDULE UTILITY FUNCTIONS ---
    
    function isHabitScheduledForDate(habit, date) {
        if (!habit.schedule || habit.schedule.type === 'everyday') {
            return true;
        }
        
        const dayOfWeek = getDayOfWeekShort(date);
        return habit.schedule.days.includes(dayOfWeek);
    }
    
    function getScheduledDaysInPeriod(habit, dates) {
        if (!habit.schedule || habit.schedule.type === 'everyday') {
            return dates;
        }
        
        return dates.filter(date => isHabitScheduledForDate(habit, date));
    }
    
    function getDayOfWeekShort(date) {
        const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        return days[date.getDay()];
    }
    
    function getScheduleDisplayString(schedule) {
        if (!schedule || schedule.type === 'everyday') {
            return 'Every day';
        }
        
        if (schedule.type === 'weekdays') {
            return 'Weekdays';
        }
        
        if (schedule.type === 'weekends') {
            return 'Weekends';
        }
        
        if (schedule.type === 'specific') {
            const dayNames = {
                'mon': 'Mon', 'tue': 'Tue', 'wed': 'Wed', 
                'thu': 'Thu', 'fri': 'Fri', 'sat': 'Sat', 'sun': 'Sun'
            };
            return schedule.days.map(day => dayNames[day]).join(', ');
        }
        
        return 'Every day';
    }
    
    function isHabitCompletedOnDate(habit, date, data = null) {
        if (!data) {
            data = getHabitData(date);
        }
        
        const value = data[habit.id] || (habit.type === 'binary' ? false : 0);
        
        if (habit.type === 'binary') {
            return value;
        } else {
            const target = parseFloat(habit.target) || 1;
            return parseFloat(value) >= target;
        }
    }
    
    // --- CATEGORY MANAGEMENT FUNCTIONS ---
    
    function getAllCategories() {
        const definitions = getHabitDefinitions();
        const categories = new Set(['General']); // Default category
        
        definitions.forEach(habit => {
            if (habit.category) {
                categories.add(habit.category);
            }
        });
        
        return Array.from(categories).sort();
    }
    
    function getHabitsByCategory() {
        const definitions = getHabitDefinitions();
        const categorized = {};
        
        definitions.forEach(habit => {
            const category = habit.category || 'General';
            if (!categorized[category]) {
                categorized[category] = [];
            }
            categorized[category].push(habit);
        });
        
        return categorized;
    }
    
    function getCategoryStats(category, period = 'last-30-days') {
        const definitions = getHabitDefinitions();
        const categoryHabits = definitions.filter(habit => 
            (habit.category || 'General') === category
        );
        
        if (categoryHabits.length === 0) {
            return {
                totalHabits: 0,
                averageCompletion: 0,
                bestStreak: 0,
                completedToday: 0
            };
        }
        
        let totalCompletion = 0;
        let bestStreak = 0;
        let completedToday = 0;
        const today = new Date();
        
        categoryHabits.forEach(habit => {
            const stats = calculateHabitStats(habit, period);
            totalCompletion += stats.completionRate;
            bestStreak = Math.max(bestStreak, stats.bestStreak);
            
            // Check if completed today
            if (isHabitScheduledForDate(habit, today)) {
                const todayData = getHabitData(today);
                const value = todayData[habit.id] || (habit.type === 'binary' ? false : 0);
                
                if (habit.type === 'binary' && value) {
                    completedToday++;
                } else if (habit.type === 'quantified') {
                    const target = parseFloat(habit.target) || 1;
                    if (value >= target) {
                        completedToday++;
                    }
                }
            }
        });
        
        return {
            totalHabits: categoryHabits.length,
            averageCompletion: Math.round(totalCompletion / categoryHabits.length),
            bestStreak,
            completedToday
        };
    }
    
    // --- GOAL TRACKING FUNCTIONS ---
    
    function getWeekDates(date = new Date()) {
        const week = [];
        const startOfWeek = new Date(date);
        const day = startOfWeek.getDay();
        const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Start from Monday
        startOfWeek.setDate(diff);
        
        for (let i = 0; i < 7; i++) {
            const weekDay = new Date(startOfWeek);
            weekDay.setDate(startOfWeek.getDate() + i);
            week.push(weekDay);
        }
        
        return week;
    }
    
    function getMonthDates(date = new Date()) {
        const month = [];
        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
        const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        
        for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
            month.push(new Date(d));
        }
        
        return month;
    }
    
    function calculateGoalProgress(habit, goalType = 'current') {
        if (!habit.goal) {
            return null;
        }
        
        const today = new Date();
        let dates = [];
        let goalTarget = habit.goal.count;
        let periodName = '';
        
        switch (habit.goal.type) {
            case 'weekly':
                dates = getWeekDates(today);
                periodName = 'This Week';
                break;
            case 'monthly':
                dates = getMonthDates(today);
                periodName = 'This Month';
                break;
            case 'daily':
                dates = getWeekDates(today);
                periodName = 'This Week';
                goalTarget = 7; // Every day of the week
                break;
            case 'streak':
                // For streaks, calculate current streak
                return calculateCurrentStreak(habit);
            default:
                return null;
        }
        
        // Filter to only past and present dates (not future)
        const relevantDates = dates.filter(date => date <= today);
        
        // Get scheduled dates within the period
        const scheduledDates = getScheduledDaysInPeriod(habit, relevantDates);
        
        // Count completions
        let completions = 0;
        for (const date of scheduledDates) {
            const data = getHabitData(date);
            const value = data[habit.id] || (habit.type === 'binary' ? false : 0);
            
            if (habit.type === 'binary' && value) {
                completions++;
            } else if (habit.type === 'quantified') {
                const target = parseFloat(habit.target) || 1;
                if (value >= target) {
                    completions++;
                }
            }
        }
        
        const progress = Math.min(100, (completions / goalTarget) * 100);
        
        return {
            current: completions,
            target: goalTarget,
            progress: Math.round(progress),
            periodName,
            type: habit.goal.type,
            isComplete: completions >= goalTarget,
            scheduledDays: scheduledDates.length,
            totalPeriodDays: dates.length
        };
    }
    
    function calculateCurrentStreak(habit, targetOverride = null) {
        const today = new Date();
        let currentStreak = 0;
        
        // Go backwards from today to find the current streak
        for (let i = 0; i < 365; i++) { // Max 365 days lookback
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            
            // Check if habit is scheduled for this date
            if (!isHabitScheduledForDate(habit, date)) {
                continue; // Skip non-scheduled days
            }
            
            const data = getHabitData(date);
            const value = data[habit.id] || (habit.type === 'binary' ? false : 0);
            
            let isCompleted = false;
            if (habit.type === 'binary') {
                isCompleted = value;
            } else if (habit.type === 'quantified') {
                const target = parseFloat(habit.target) || 1;
                isCompleted = value >= target;
            }
            
            if (isCompleted) {
                currentStreak++;
            } else {
                break; // Streak broken
            }
        }
        
        // Use targetOverride for achievements, or habit.goal.count for goal tracking
        const goalTarget = targetOverride || (habit.goal && habit.goal.count) || currentStreak;
        const progress = goalTarget > 0 ? Math.min(100, (currentStreak / goalTarget) * 100) : 100;
        
        return {
            current: currentStreak,
            target: goalTarget,
            progress: Math.round(progress),
            periodName: 'Current Streak',
            type: 'streak',
            isComplete: currentStreak >= goalTarget,
            scheduledDays: currentStreak,
            totalPeriodDays: goalTarget
        };
    }
    
    function getGoalDisplayString(goal) {
        if (!goal) return '';
        
        switch (goal.type) {
            case 'weekly':
                return `${goal.count} times per week`;
            case 'monthly':
                return `${goal.count} times per month`;
            case 'daily':
                return 'Every day';
            case 'streak':
                return `${goal.count} days in a row`;
            default:
                return `Goal: ${goal.count}`;
        }
    }
    
    // --- ACHIEVEMENT TRACKING FUNCTIONS ---
    
    function getAllAchievements() {
        const achievements = getStorage('habit-achievements');
        if (!achievements) return {};
        try {
            return JSON.parse(achievements);
        } catch (e) {
            return {};
        }
    }
    
    function saveAllAchievements(achievements) {
        setStorage('habit-achievements', JSON.stringify(achievements));
        if (typeof debouncedSyncWithCloud === 'function') {
            debouncedSyncWithCloud();
        }
    }
    
    function checkAndAwardAchievements(habitId, currentDate = new Date()) {
        const definitions = getHabitDefinitions();
        const habit = definitions.find(h => h.id === habitId);
        
        if (!habit || !habit.achievement) {
            return null;
        }
        
        const achievements = Array.isArray(habit.achievement) ? habit.achievement : [habit.achievement];
        const allAchievements = getAllAchievements();
        const habitAchievements = allAchievements[habitId] || {};
        
        const newlyEarnedAchievements = [];
        
        for (const achievement of achievements) {
            // Skip if already earned
            if (habitAchievements[achievement.id]) {
                continue;
            }
            
            let isEarned = false;
            let progress = { current: 0, target: achievement.target };
            
            switch (achievement.type) {
                case 'streak':
                    const streakData = calculateCurrentStreak(habit, achievement.target);
                    progress.current = streakData.current;
                    isEarned = streakData.current >= achievement.target;
                    break;
                    
                case 'total_completions':
                    const totalCompletions = calculateTotalCompletions(habit);
                    progress.current = totalCompletions;
                    isEarned = totalCompletions >= achievement.target;
                    break;
                    
                case 'perfect_week':
                    const weekProgress = calculatePerfectWeeks(habit);
                    progress.current = weekProgress;
                    isEarned = weekProgress >= achievement.target;
                    break;
                    
                case 'perfect_month':
                    const monthProgress = calculatePerfectMonths(habit);
                    progress.current = monthProgress;
                    isEarned = monthProgress >= achievement.target;
                    break;
            }
            
            if (isEarned) {
                // Award the achievement
                if (!allAchievements[habitId]) {
                    allAchievements[habitId] = {};
                }
                allAchievements[habitId][achievement.id] = {
                    ...achievement,
                    earnedDate: formatDate(currentDate),
                    habitName: habit.name
                };
                
                newlyEarnedAchievements.push({
                    ...achievement,
                    habitName: habit.name,
                    progress
                });
            }
        }
        
        if (newlyEarnedAchievements.length > 0) {
            saveAllAchievements(allAchievements);
            return newlyEarnedAchievements;
        }
        
        return null;
    }
    
    function calculateTotalCompletions(habit) {
        const allData = getAllHabitData();
        let totalCount = 0;
        
        for (const dateKey in allData) {
            const dayData = allData[dateKey];
            const value = dayData[habit.id] || (habit.type === 'binary' ? false : 0);
            
            if (habit.type === 'binary' && value) {
                totalCount++;
            } else if (habit.type === 'quantified') {
                const target = parseFloat(habit.target) || 1;
                if (value >= target) {
                    totalCount++;
                }
            }
        }
        
        return totalCount;
    }
    
    function calculatePerfectWeeks(habit) {
        const today = new Date();
        let perfectWeeks = 0;
        
        // Check last 12 weeks
        for (let weekOffset = 0; weekOffset < 12; weekOffset++) {
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - (weekOffset * 7) - today.getDay() + 1); // Monday
            
            const weekDates = getWeekDates(weekStart);
            const scheduledDates = getScheduledDaysInPeriod(habit, weekDates);
            
            let completedInWeek = 0;
            for (const date of scheduledDates) {
                const data = getHabitData(date);
                const value = data[habit.id] || (habit.type === 'binary' ? false : 0);
                
                let isCompleted = false;
                if (habit.type === 'binary') {
                    isCompleted = value;
                } else if (habit.type === 'quantified') {
                    const target = parseFloat(habit.target) || 1;
                    isCompleted = value >= target;
                }
                
                if (isCompleted) {
                    completedInWeek++;
                }
            }
            
            // Perfect week = completed all scheduled days
            if (scheduledDates.length > 0 && completedInWeek === scheduledDates.length) {
                perfectWeeks++;
            }
        }
        
        return perfectWeeks;
    }
    
    function calculatePerfectMonths(habit) {
        const today = new Date();
        let perfectMonths = 0;
        
        // Check last 12 months
        for (let monthOffset = 0; monthOffset < 12; monthOffset++) {
            const monthStart = new Date(today.getFullYear(), today.getMonth() - monthOffset, 1);
            const monthEnd = new Date(today.getFullYear(), today.getMonth() - monthOffset + 1, 0);
            
            const monthDates = [];
            for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
                monthDates.push(new Date(d));
            }
            
            const scheduledDates = getScheduledDaysInPeriod(habit, monthDates);
            
            let completedInMonth = 0;
            for (const date of scheduledDates) {
                const data = getHabitData(date);
                const value = data[habit.id] || (habit.type === 'binary' ? false : 0);
                
                let isCompleted = false;
                if (habit.type === 'binary') {
                    isCompleted = value;
                } else if (habit.type === 'quantified') {
                    const target = parseFloat(habit.target) || 1;
                    isCompleted = value >= target;
                }
                
                if (isCompleted) {
                    completedInMonth++;
                }
            }
            
            // Perfect month = completed all scheduled days
            if (scheduledDates.length > 0 && completedInMonth === scheduledDates.length) {
                perfectMonths++;
            }
        }
        
        return perfectMonths;
    }
    
    function showAchievementNotification(achievement) {
        if (!achievement || achievement.isEarned === false) {
            return;
        }
        
        // Create achievement modal HTML
        const achievementHtml = `
            <div class="achievement-modal-overlay">
                <div class="achievement-modal">
                    <div class="achievement-header">
                        <div class="achievement-icon">🏆</div>
                        <h2>Achievement Unlocked!</h2>
                    </div>
                    <div class="achievement-content">
                        <div class="achievement-habit">${achievement.habitName}</div>
                        <div class="achievement-title">${achievement.reward}</div>
                        <div class="achievement-description">
                            ${getAchievementDescription(achievement)}
                        </div>
                    </div>
                    <div class="achievement-actions">
                        <button class="achievement-close-btn">Celebrate! 🎉</button>
                    </div>
                </div>
            </div>
        `;
        
        // Add to page
        const modalElement = document.createElement('div');
        modalElement.innerHTML = achievementHtml;
        document.body.appendChild(modalElement.firstElementChild);
        
        // Add event listener to close
        const closeBtn = document.querySelector('.achievement-close-btn');
        const overlay = document.querySelector('.achievement-modal-overlay');
        
        const closeModal = () => {
            if (overlay && overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        };
        
        closeBtn.addEventListener('click', closeModal);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeModal();
            }
        });
        
        // Auto-close after 10 seconds
        setTimeout(closeModal, 10000);
    }
    
    function getAchievementDescription(achievement) {
        switch (achievement.type) {
            case 'streak':
                return `Completed ${achievement.target} days in a row!`;
            case 'total_completions':
                return `Reached ${achievement.target} total completions!`;
            case 'perfect_week':
                return `Achieved a perfect week (100% completion)!`;
            case 'perfect_month':
                return `Achieved a perfect month (100% completion)!`;
            default:
                return 'Great job!';
        }
    }
    
    function getHabitAchievements(habitId) {
        const allAchievements = getAllAchievements();
        return allAchievements[habitId] || {};
    }
    
    // --- HABIT DATA MANAGEMENT ---
    
    function getAllHabitData() {
        const data = getStorage('habit-data-all');
        if (!data) return {};
        try {
            return JSON.parse(data);
        } catch (e) {
            return {};
        }
    }
    
    function saveAllHabitData(allData) {
        setStorage('habit-data-all', JSON.stringify(allData));
        if (typeof debouncedSyncWithCloud === 'function') {
            debouncedSyncWithCloud();
        }
    }
    
    function getHabitData(date) {
        const dateKey = formatDate(date);
        const allData = getAllHabitData();
        return allData[dateKey] || {};
    }
    
    function saveHabitData(date, data) {
        const dateKey = formatDate(date);
        const allData = getAllHabitData();
        allData[dateKey] = data;
        saveAllHabitData(allData);
    }
    
    function updateHabitValue(habitId, value, date = new Date()) {
        const data = getHabitData(date);
        data[habitId] = value;
        saveHabitData(date, data);
        
        // Check for achievements after updating habit value
        setTimeout(() => {
            const achievements = checkAndAwardAchievements(habitId, date);
            if (achievements && Array.isArray(achievements)) {
                // Show notification for each newly earned achievement
                achievements.forEach(achievement => {
                    showAchievementNotification(achievement);
                });
            } else if (achievements) {
                showAchievementNotification(achievements);
            }
        }, 100); // Small delay to ensure data is saved
    }
    
    function removeHabitDataCompletely(habitId) {
        const allData = getAllHabitData();
        let removedCount = 0;
        
        // Remove habit data from all dates
        for (const dateKey in allData) {
            if (allData[dateKey] && allData[dateKey][habitId] !== undefined) {
                delete allData[dateKey][habitId];
                removedCount++;
                
                // If the date has no more habit data, remove the date entry entirely
                if (Object.keys(allData[dateKey]).length === 0) {
                    delete allData[dateKey];
                }
            }
        }
        
        saveAllHabitData(allData);
        
        // Also remove achievements for this habit
        const allAchievements = getAllAchievements();
        if (allAchievements[habitId]) {
            delete allAchievements[habitId];
            saveAllAchievements(allAchievements);
        }
    }
    
    function deleteHabit(habitName) {
        const definitions = getHabitDefinitions();
        const habitToDelete = definitions.find(h => h.name === habitName);
        
        if (!habitToDelete) {
            return { success: false, message: `Habit "${habitName}" not found.` };
        }
        
        // Remove from definitions
        const updatedDefinitions = definitions.filter(h => h.name !== habitName);
        saveHabitDefinitions(updatedDefinitions);
        
        // Remove all associated data and achievements
        removeHabitDataCompletely(habitToDelete.id);
        
        return { 
            success: true, 
            message: `Habit "${habitName}" and all its data have been deleted.`,
            deletedHabitId: habitToDelete.id
        };
    }
    
    function updateHabitDefinition(oldName, newDefinition) {
        const definitions = getHabitDefinitions();
        const existingHabitIndex = definitions.findIndex(h => h.name === oldName);
        
        if (existingHabitIndex === -1) {
            return { success: false, message: `Habit "${oldName}" not found.` };
        }
        
        const oldHabit = definitions[existingHabitIndex];
        const parsedNewHabit = parseHabitLine(newDefinition);
        
        if (!parsedNewHabit) {
            return { success: false, message: 'Invalid habit definition format.' };
        }
        
        // Preserve the original ID to maintain data continuity
        parsedNewHabit.id = oldHabit.id;
        
        // Update the definition
        definitions[existingHabitIndex] = parsedNewHabit;
        saveHabitDefinitions(definitions);
        
        return { 
            success: true, 
            message: `Habit updated successfully. Data continuity preserved.`,
            updatedHabit: parsedNewHabit
        };
    }
    
    function cleanupOrphanedHabitData(currentDefinitions) {
        // Get all existing habit data and achievements
        const allHabitData = getAllHabitData();
        const allAchievements = getAllAchievements();
        
        // Create sets of current habit IDs and names for fast lookup
        const currentHabitIds = new Set(currentDefinitions.map(h => h.id));
        const currentHabitNames = new Set(currentDefinitions.map(h => h.name));
        
        // Find orphaned habit IDs in data
        const orphanedIds = new Set();
        
        // Check habit data for orphaned IDs
        for (const dateKey in allHabitData) {
            const dayData = allHabitData[dateKey];
            for (const habitId in dayData) {
                if (!currentHabitIds.has(habitId)) {
                    orphanedIds.add(habitId);
                }
            }
        }
        
        // Check achievements for orphaned IDs
        for (const habitId in allAchievements) {
            if (!currentHabitIds.has(habitId)) {
                orphanedIds.add(habitId);
            }
        }
        
        // Remove orphaned data if any found
        if (orphanedIds.size > 0) {
            console.log(`🧹 Cleaning up ${orphanedIds.size} orphaned habit(s):`, Array.from(orphanedIds));
            
            // Clean up habit data
            let dataModified = false;
            for (const dateKey in allHabitData) {
                const dayData = allHabitData[dateKey];
                for (const orphanedId of orphanedIds) {
                    if (dayData[orphanedId] !== undefined) {
                        delete dayData[orphanedId];
                        dataModified = true;
                    }
                }
                
                // Remove empty date entries
                if (Object.keys(dayData).length === 0) {
                    delete allHabitData[dateKey];
                    dataModified = true;
                }
            }
            
            if (dataModified) {
                saveAllHabitData(allHabitData);
                console.log('✅ Orphaned habit data cleaned up');
            }
            
            // Clean up achievements
            let achievementsModified = false;
            for (const orphanedId of orphanedIds) {
                if (allAchievements[orphanedId]) {
                    delete allAchievements[orphanedId];
                    achievementsModified = true;
                }
            }
            
            if (achievementsModified) {
                saveAllAchievements(allAchievements);
                console.log('✅ Orphaned achievements cleaned up');
            }
            
            return Array.from(orphanedIds);
        }
        
        return [];
    }
    
    // --- PARSING AND COMMAND HANDLING ---
    
    function parseCommand(command) {
        // Handle both old format (HABITS: config) and new format (just config)
        let configPart = command;
        if (command.startsWith('HABITS:')) {
            configPart = command.replace('HABITS:', '').trim();
        }
        
        const parts = configPart.split(',').map(p => p.trim());
        const widgetType = parts[0] || 'today';
        
        let config = {
            type: widgetType,
            period: 'last-30-days',  // Default period changed to 30 days
            habit: null,
            date: null
        };
        
        // Handle define command
        if (widgetType === 'define') {
            return config;
        }
        
        // Parse additional parameters
        for (let i = 1; i < parts.length; i++) {
            const part = parts[i];
            
            // Check for date format (YYYY-MM-DD)
            if (part.match(/^\d{4}-\d{2}-\d{2}$/)) {
                config.date = part;
            }
            // Check for time periods - comprehensive list of valid periods
            else if (['last-7-days', 'last-30-days', 'last-90-days', 'last-180-days', 'last-365-days',
                     'this-week', 'this-month', 'this-year', 'last-three-months', 'last-six-months'].includes(part)) {
                config.period = part;
            } 
            // Habit name for specific habit widgets
            else if (part.match(/^[a-zA-Z]/)) {
                config.habit = part;
            }
        }
        
        return config;
    }
    
    // --- RENDER FUNCTIONS ---
    
    function renderGridWidget(period) {
        const definitions = getHabitDefinitions();
        if (definitions.length === 0) {
            return `<div class="habit-widget">
                <div class="habit-header">
                    <div class="habit-header-content">
                        <h3>📊 Habit Grid</h3>
                        <div class="habit-help">
                            <span>📈 The habit grid shows your progress across multiple days. Add some habits to get started!</span>
                            <br><br>
                            <strong>What you'll see here:</strong><br>
                            • Visual grid of your habit completion across days<br>
                            • Easy-to-spot patterns and streaks<br>
                            • Color-coded progress indicators<br>
                            <br>
                            <strong>Example habits to add:</strong><br>
                            <code>- Meditate</code><br>
                            <code>- Exercise</code><br>
                            <code>- Drink Water (TARGET: 8 glasses)</code><br>
                            <code>- Read (SCHEDULE: weekdays)</code>
                        </div>
                    </div>
                    <div class="finance-widget-controls">
                        <button class="finance-add-button habit-add-button">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            New Habit
                        </button>
                    </div>
                </div>
            </div>`;
        }
        
        const dates = getDateRange(period);
        const totalCols = dates.length + 1; // +1 for habit name column
        
        let html = `<div class="habit-widget grid">
            <div class="habit-header">
                <div class="habit-header-content">
                    <h3>📊 Habit Grid</h3>
                    <div class="habit-grid-controls">
                        <div class="habit-grid-nav">
                            <button class="habit-grid-range-btn ${period === 'last-7-days' ? 'active' : ''}" data-range="last-7-days">7 Days</button>
                            <button class="habit-grid-range-btn ${period === 'last-30-days' ? 'active' : ''}" data-range="last-30-days">30 Days</button>
                            <button class="habit-grid-range-btn ${period === 'last-90-days' ? 'active' : ''}" data-range="last-90-days">90 Days</button>
                            <button class="habit-grid-range-btn ${period === 'this-month' ? 'active' : ''}" data-range="this-month">This Month</button>
                        </div>
                        <div class="habit-grid-view-options">
                            <button class="habit-grid-density-btn" title="Toggle compact view">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="9" x2="15" y2="9"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
                                Compact
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div class="habit-grid-legend">
                <div class="habit-legend-title">Legend:</div>
                <div class="habit-legend-items">
                    <div class="habit-legend-item">
                        <div class="habit-legend-color habit-cell completed"></div>
                        <span>Completed</span>
                    </div>
                    <div class="habit-legend-item">
                        <div class="habit-legend-color habit-cell partial"></div>
                        <span>Partial</span>
                    </div>
                    <div class="habit-legend-item">
                        <div class="habit-legend-color habit-cell incomplete"></div>
                        <span>Incomplete</span>
                    </div>
                    <div class="habit-legend-item">
                        <div class="habit-legend-color habit-cell not-scheduled"></div>
                        <span>Not Scheduled</span>
                    </div>
                </div>
            </div>
            <div class="habit-grid" style="grid-template-columns: minmax(120px, 1fr) repeat(${dates.length}, 1fr);">
                <div class="habit-grid-header">
                    <div class="habit-name-col">Habit</div>`;
        
        // Date headers
        for (const date of dates) {
            const dateStr = formatDate(date);
            const displayStr = formatDateDisplay(date);
            html += `<div class="habit-date-col" title="${displayStr} (${dateStr})">
                ${date.getDate()}
            </div>`;
        }
        
        html += `</div>`;
        
        // Habit rows
        for (const habit of definitions) {
            html += `<div class="habit-grid-row">
                <div class="habit-name-col">
                    ${habit.name}
                    <div class="habit-schedule-small">${getScheduleDisplayString(habit.schedule)}</div>
                </div>`;
            
            for (const date of dates) {
                const data = getHabitData(date);
                const value = data[habit.id] || (habit.type === 'binary' ? false : 0);
                const isScheduled = isHabitScheduledForDate(habit, date);
                const dateStr = formatDate(date);
                const displayStr = formatDateDisplay(date);
                
                let cellClass = 'habit-cell';
                let cellContent = '';
                let tooltipText = '';
                
                if (!isScheduled) {
                    // Not scheduled for this day
                    cellClass += ' not-scheduled';
                    cellContent = '—';
                    tooltipText = `${habit.name}\n${displayStr}\nNot scheduled`;
                } else if (habit.type === 'binary') {
                    cellClass += value ? ' completed' : ' incomplete';
                    cellContent = value ? '✓' : '';
                    tooltipText = `${habit.name}\n${displayStr}\n${value ? 'Completed ✓' : 'Not completed'}`;
                } else {
                    const target = parseFloat(habit.target) || 1;
                    const percentage = Math.min(100, (value / target) * 100);
                    cellClass += percentage >= 100 ? ' completed' : percentage > 0 ? ' partial' : ' incomplete';
                    cellContent = percentage >= 100 ? '✓' : percentage > 0 ? Math.round(percentage) + '%' : '';
                    tooltipText = `${habit.name}\n${displayStr}\n${value} / ${target} (${Math.round(percentage)}%)`;
                }
                
                html += `<div class="${cellClass}" 
                              title="${tooltipText}"
                              data-habit-id="${habit.id}"
                              data-date="${dateStr}"
                              data-habit-name="${habit.name}"
                              data-value="${value}"
                              data-target="${habit.target || 1}"
                              data-scheduled="${isScheduled}">
                    ${cellContent}
                </div>`;
            }
            
            html += `</div>`;
        }
        
        html += `</div></div>`;
        return html;
    }
    
    function renderStatsWidget(period = 'last-30-days') {
        const definitions = getHabitDefinitions();
        if (definitions.length === 0) {
            return `<div class="habit-widget">
                <div class="habit-header">
                    <div class="habit-header-content">
                        <h3>📈 Habit Statistics</h3>
                        <div class="habit-help">
                            <span>📊 Track your habit performance with detailed statistics. Start by adding some habits!</span>
                            <br><br>
                            <strong>Statistics you'll see:</strong><br>
                            • Completion rates and percentages<br>
                            • Current and best streaks<br>
                            • Scheduled vs completed days<br>
                            • Performance trends over time<br>
                            <br>
                            <strong>Example habits to track:</strong><br>
                            <code>- Meditate</code><br>
                            <code>- Exercise</code><br>
                            <code>- Drink Water (TARGET: 8 glasses)</code><br>
                            <code>- Study (SCHEDULE: weekdays)</code>
                        </div>
                    </div>
                </div>
            </div>`;
        }
        
        // Calculate comprehensive statistics
        const overallStats = calculateOverallStats(definitions, period);
        const periodDisplay = getPeriodDisplayName(period);
        
        let html = `<div class="habit-widget stats">
            <div class="habit-header">
                <div class="habit-header-content">
                    <h3>📈 Habit Statistics - ${periodDisplay}</h3>
                </div>
                <div class="finance-widget-controls">
                    <button class="finance-filter-button habit-filter-button" data-current-period="${period}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                        Filter
                    </button>
                </div>
            </div>
            
            <!-- Statistics Overview -->
            <div class="stats-overview">
                <div class="stats-overview-main">
                    <div class="stats-overview-stat">
                        <div class="stats-stat-number">${overallStats.totalHabits}</div>
                        <div class="stats-stat-label">Total Habits</div>
                    </div>
                    <div class="stats-overview-stat">
                        <div class="stats-stat-number">${overallStats.averageCompletion}%</div>
                        <div class="stats-stat-label">Average Completion</div>
                    </div>
                    <div class="stats-overview-stat">
                        <div class="stats-stat-number">${overallStats.totalCompletions}</div>
                        <div class="stats-stat-label">Total Completions</div>
                    </div>
                    <div class="stats-overview-stat">
                        <div class="stats-stat-number">${overallStats.bestStreak}</div>
                        <div class="stats-stat-label">Best Streak</div>
                    </div>
                </div>
                <div class="stats-completion-chart">
                    <div class="stats-completion-title">Overall Progress</div>
                    <div class="stats-completion-circle">
                        <svg class="stats-circle-svg" viewBox="0 0 100 100">
                            <circle class="stats-circle-bg" cx="50" cy="50" r="40" fill="none" stroke-width="8"/>
                            <circle class="stats-circle-fill" cx="50" cy="50" r="40" fill="none" stroke-width="8" 
                                    stroke-dasharray="${overallStats.averageCompletion * 2.51327} 251.327" 
                                    transform="rotate(-90 50 50)"/>
                        </svg>
                        <div class="stats-circle-text">
                            <div class="stats-circle-percentage">${overallStats.averageCompletion}%</div>
                            <div class="stats-circle-label">Complete</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Performance Insights -->
            <div class="stats-insights">
                ${getStatsInsights(definitions, period).map(insight => `
                    <div class="stats-insight-card">
                        <div class="stats-insight-icon">${insight.icon}</div>
                        <div class="stats-insight-content">
                            <div class="stats-insight-title">${insight.title}</div>
                            <div class="stats-insight-text">${insight.text}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <!-- Habit Statistics Grid -->
            <div class="habit-stats-grid">`;
        
        // Sort habits by performance for better organization
        const sortedHabits = definitions
            .map(habit => ({
                ...habit,
                stats: calculateHabitStats(habit, period)
            }))
            .sort((a, b) => {
                // Sort by completion rate, then by current streak
                if (b.stats.completionRate !== a.stats.completionRate) {
                    return b.stats.completionRate - a.stats.completionRate;
                }
                return b.stats.currentStreak - a.stats.currentStreak;
            });
        
        for (const habit of sortedHabits) {
            const stats = habit.stats;
            const performance = getHabitPerformanceLevel(stats);
            const trend = getHabitTrend(habit, period);
            
            html += `<div class="habit-stat-card ${performance.class}">
                <div class="habit-stat-header">
                    <div class="habit-stat-name">
                        ${habit.name}
                        <div class="habit-schedule-small">${getScheduleDisplayString(habit.schedule)}</div>
                    </div>
                    <div class="habit-stat-performance">
                        <div class="habit-stat-completion">${stats.completionRate}%</div>
                        <div class="habit-stat-emoji">${performance.emoji}</div>
                    </div>
                </div>
                
                <div class="habit-stat-progress">
                    <div class="habit-stat-progress-bar">
                        <div class="habit-stat-progress-fill" style="width: ${stats.completionRate}%; background: ${performance.color};"></div>
                    </div>
                    <div class="habit-stat-progress-details">
                        <span class="habit-stat-completed">${stats.completedDays}/${stats.scheduledDays} completed</span>
                        <span class="habit-stat-trend ${trend.direction}">${trend.icon} ${trend.text}</span>
                    </div>
                </div>
                
                <div class="habit-stat-metrics">
                    <div class="habit-stat-metric">
                        <div class="habit-stat-metric-label">Current Streak</div>
                        <div class="habit-stat-metric-value">${stats.currentStreak} days</div>
                    </div>
                    <div class="habit-stat-metric">
                        <div class="habit-stat-metric-label">Best Streak</div>
                        <div class="habit-stat-metric-value">${stats.bestStreak} days</div>
                    </div>
                    <div class="habit-stat-metric">
                        <div class="habit-stat-metric-label">Weekly Avg</div>
                        <div class="habit-stat-metric-value">${stats.weeklyAverage}%</div>
                    </div>
                    ${stats.averageValue ? `
                        <div class="habit-stat-metric">
                            <div class="habit-stat-metric-label">Daily Avg</div>
                            <div class="habit-stat-metric-value">${stats.averageValue}</div>
                        </div>
                    ` : ''}
                </div>
                
                <div class="habit-stat-insights">
                    <div class="habit-stat-insight">${getHabitStatInsight(habit, stats, trend)}</div>
                </div>
            </div>`;
        }
        
        html += `</div></div>`;
        return html;
    }
    
    function renderChartWidget(habitName, period) {
        const definitions = getHabitDefinitions();
        const habit = definitions.find(h => h.name === habitName);
        
        if (!habit) {
            return `<div class="habit-widget">
                <div class="habit-header">
                    <h3>📊 Habit Chart</h3>
                    <div class="habit-help">
                        <span>Habit "${habitName}" not found. Check your habit definitions.</span>
                        <br><br>
                        <strong>Usage:</strong> <code>HABITS: chart, [HabitName], [period]</code><br>
                        <strong>Example:</strong> <code>HABITS: chart, Meditate, last-30-days</code>
                    </div>
                </div>
            </div>`;
        }
        
        const dates = getDateRange(period);
        const chartData = dates.map(date => {
            const data = getHabitData(date);
            const value = data[habit.id] || (habit.type === 'binary' ? false : 0);
            return {
                date,
                value: habit.type === 'binary' ? (value ? 1 : 0) : parseFloat(value) || 0
            };
        });
        
        const maxValue = habit.type === 'binary' ? 1 : Math.max(...chartData.map(d => d.value), parseFloat(habit.target) || 1);
        
        let html = `<div class="habit-widget chart">
            <div class="habit-header">
                <div class="habit-header-content">
                    <h3>📊 ${habit.name} - ${period}</h3>
                </div>
                <div class="finance-widget-controls">
                    <button class="finance-filter-button habit-filter-button" data-current-period="${period}" data-habit-name="${habitName}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                        Filter
                    </button>
                </div>
            </div>
            <div class="habit-chart">`;
        
        for (const point of chartData) {
            const height = (point.value / maxValue) * 100;
            html += `<div class="habit-chart-bar" style="height: ${height}%" title="${formatDateDisplay(point.date)}: ${point.value}"></div>`;
        }
        
        html += `</div></div>`;
        return html;
    }
    
    function getAchievementIndicators(habit, selectedDate) {
        if (!habit.achievement) {
            return '';
        }
        
        const achievements = Array.isArray(habit.achievement) ? habit.achievement : [habit.achievement];
        const allAchievements = getAllAchievements();
        const habitAchievements = allAchievements[habit.id] || {};
        
        let indicators = '';
        let completedCount = 0;
        let totalCount = achievements.length;
        
        for (const achievement of achievements) {
            if (habitAchievements[achievement.id]) {
                // Achievement already earned
                completedCount++;
                indicators += `<div class="habit-achievement-indicator completed" title="Achievement unlocked: ${achievement.reward}">🏆</div>`;
            } else {
                // Check progress toward this achievement
                let progress = { current: 0, target: achievement.target };
                
                switch (achievement.type) {
                    case 'streak':
                        const streakData = calculateCurrentStreak(habit, achievement.target);
                        progress.current = streakData.current;
                        break;
                    case 'total_completions':
                        progress.current = calculateTotalCompletions(habit);
                        break;
                    case 'perfect_week':
                        progress.current = calculatePerfectWeeks(habit);
                        break;
                    case 'perfect_month':
                        progress.current = calculatePerfectMonths(habit);
                        break;
                }
                
                if (progress.current >= progress.target) {
                    // Achievement should be awarded (but hasn't been saved yet)
                    indicators += `<div class="habit-achievement-indicator completed" title="Achievement unlocked: ${achievement.reward}">🏆</div>`;
                    completedCount++;
                } else {
                    const progressPercent = Math.round((progress.current / progress.target) * 100);
                    indicators += `<div class="habit-achievement-indicator" title="Achievement progress: ${progress.current}/${progress.target} (${progressPercent}%) - ${achievement.reward}">🎯</div>`;
                }
            }
        }
        
        // If multiple achievements, add a summary indicator
        if (totalCount > 1) {
            indicators = `<div class="habit-achievement-summary" title="${completedCount}/${totalCount} achievements unlocked">${indicators}</div>`;
        }
        
        return indicators;
    }
    
    function renderDayWidget(dateString) {
        // If no dateString is provided, try to extract it from the command
        if (!dateString) {
            const pageWrapper = placeholder && placeholder.closest('[data-key]');
            if (pageWrapper) {
                const key = pageWrapper.dataset.key;
                const content = getStorage(key);
                if (content) {
                    // Extract date from HABITS: day, YYYY-MM-DD
                    const match = content.match(/HABITS:\s*day(?:,\s*(\d{4}-\d{2}-\d{2}))?/i);
                    if (match) {
                        dateString = match[1] || formatDate(new Date());
                    }
                }
            }
        }
        const selectedDate = dateString ? new Date(dateString + 'T00:00:00') : new Date();
        const dayData = getHabitData(selectedDate);
        const definitions = getHabitDefinitions();
        const today = new Date();
        
        // Check if this is a future date
        const isFuture = selectedDate > today;
        const isToday = formatDate(selectedDate) === formatDate(today);
        
        if (definitions.length === 0) {
            return `<div class="habit-widget">
                <div class="habit-header">
                    <div class="habit-header-content">
                        <h3>📅 Daily Habits</h3>
                        <div class="habit-help">
                            <span>✨ Welcome to Habit Tracking! Get started by adding your first habit.</span>
                            <br><br>
                            <strong>Quick Start:</strong><br>
                            1. Click "New Habit" below to add your first habit<br>
                            2. Examples: "Meditate", "Exercise", "Drink Water (TARGET: 8 glasses)"<br>
                            3. Add goals and achievements for extra motivation!<br>
                            <br>
                            <strong>Advanced Usage:</strong><br>
                            <code>HABITS: categories</code> - Organize by category<br>
                            <code>HABITS: goals</code> - Track goal progress<br>
                            <code>HABITS: achievements</code> - View earned rewards<br>
                            <code>HABITS: stats</code> - View statistics<br>
                            <br>
                            <strong>Example habit definitions:</strong><br>
                            <code>- Meditate (CATEGORY: Wellness) (GOAL: every day)</code><br>
                            <code>- Exercise (CATEGORY: Health) (GOAL: 3 times per week)</code><br>
                            <code>- Drink Water (CATEGORY: Health) (TARGET: 8 glasses) (GOAL: 7 days in a row)</code><br>
                            <code>- Read (ACHIEVEMENT: 30 completions = Buy new books)</code>
                        </div>
                    </div>
                    <div class="finance-widget-controls">
                        <button class="finance-add-button habit-add-button">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            New Habit
                        </button>
                    </div>
                </div>
            </div>`;
        }
        
        // Filter habits scheduled for this day
        const dayHabits = definitions.filter(habit => isHabitScheduledForDate(habit, selectedDate));
        
        // Navigation dates
        const prevDate = new Date(selectedDate);
        prevDate.setDate(prevDate.getDate() - 1);
        const nextDate = new Date(selectedDate);
        nextDate.setDate(nextDate.getDate() + 1);
        
        const prevDateStr = formatDate(prevDate);
        const nextDateStr = formatDate(nextDate);
        const currentDateStr = formatDate(selectedDate);
        
        let html = `<div class="habit-widget day">
            <div class="habit-header">
                <div class="habit-header-content">
                    <h3>📅 ${isToday ? "Today's" : "Day"} Habits</h3>
                    <div class="habit-date-nav">
                        <button class="habit-nav-btn" data-nav-date="${prevDateStr}" title="Previous day">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15,18 9,12 15,6"></polyline></svg>
                        </button>
                        <div class="habit-date-display">
                            <div class="habit-date-main">${formatDateDisplay(selectedDate)}</div>
                            <div class="habit-date-info">
                                ${isToday ? 'Today' : isFuture ? 'Future' : 'Past'}
                                ${isFuture ? ' (View only)' : ''}
                            </div>
                        </div>
                        <button class="habit-nav-btn" data-nav-date="${nextDateStr}" title="Next day">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9,18 15,12 9,6"></polyline></svg>
                        </button>
                    </div>
                </div>
                <div class="finance-widget-controls">
                    <button class="finance-add-button habit-add-button">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        New
                    </button>
                    ${!isToday ? `<button class="habit-today-btn" data-nav-date="${formatDate(today)}" title="Go to today">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12,6 12,12 16,14"></polyline></svg>
                        Today
                    </button>` : ''}
                    <button class="finance-filter-button habit-date-picker-button" data-current-date="${currentDateStr}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        Date
                    </button>
                    
                </div>
            </div>`;
        
        if (dayHabits.length === 0) {
            html += `<div class="habit-rest-day">
                <div class="habit-rest-message">
                    <h4>🌿 Rest Day</h4>
                    <p>No habits scheduled for this date.</p>
                </div>
            </div>`;
        } else {
            // Calculate daily progress
            let completedHabits = 0;
            let totalHabits = dayHabits.length;
            
            dayHabits.forEach(habit => {
                const value = dayData[habit.id] || (habit.type === 'binary' ? false : 0);
                
                if (habit.type === 'binary' && value) {
                    completedHabits++;
                } else if (habit.type === 'quantified') {
                    const target = parseFloat(habit.target) || 1;
                    if (value >= target) {
                        completedHabits++;
                    }
                }
            });
            
            const progressPercentage = totalHabits > 0 ? Math.round((completedHabits / totalHabits) * 100) : 0;
            const progressColor = progressPercentage >= 100 ? '#4CAF50' : 
                                progressPercentage >= 75 ? '#8BC34A' :
                                progressPercentage >= 50 ? '#FF9800' :
                                progressPercentage >= 25 ? '#FF5722' : '#757575';
            
            // Add progress overview
            html += `<div class="habit-progress-overview">
                <div class="habit-progress-info">
                    <div class="habit-progress-stats">
                        <span class="habit-progress-completed">${completedHabits}</span>
                        <span class="habit-progress-separator">/</span>
                        <span class="habit-progress-total">${totalHabits}</span>
                        <span class="habit-progress-label">habits completed</span>
                    </div>
                    <div class="habit-progress-percentage" style="color: ${progressColor}">
                        ${progressPercentage}%
                    </div>
                </div>
                <div class="habit-progress-bar">
                    <div class="habit-progress-fill" style="width: ${progressPercentage}%; background-color: ${progressColor}"></div>
                </div>
                ${!isFuture && progressPercentage < 100 ? `
                    <div class="habit-progress-actions">
                        <button class="habit-mark-all-btn" title="Mark all remaining habits as complete" data-date="${currentDateStr}">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20,6 9,17 4,12"></polyline></svg>
                            Complete All
                        </button>
                    </div>
                ` : ''}
            </div>`;
            
            // Group habits by category
            const categorizedDayHabits = {};
            dayHabits.forEach(habit => {
                const category = habit.category || 'General';
                if (!categorizedDayHabits[category]) {
                    categorizedDayHabits[category] = [];
                }
                categorizedDayHabits[category].push(habit);
            });
            
            const categories = Object.keys(categorizedDayHabits).sort();
            
            html += `<div class="habit-list">`;
            
            for (const category of categories) {
                const categoryHabits = categorizedDayHabits[category];
                
                // Smart sorting: incomplete habits first, then completed habits
                // This helps users focus on what they still need to do
                categoryHabits.sort((a, b) => {
                    const valueA = dayData[a.id] || (a.type === 'binary' ? false : 0);
                    const valueB = dayData[b.id] || (b.type === 'binary' ? false : 0);
                    
                    let isCompletedA = false;
                    let isCompletedB = false;
                    
                    if (a.type === 'binary') {
                        isCompletedA = valueA;
                    } else if (a.type === 'quantified') {
                        const targetA = parseFloat(a.target) || 1;
                        isCompletedA = valueA >= targetA;
                    }
                    
                    if (b.type === 'binary') {
                        isCompletedB = valueB;
                    } else if (b.type === 'quantified') {
                        const targetB = parseFloat(b.target) || 1;
                        isCompletedB = valueB >= targetB;
                    }
                    
                    // Incomplete habits first (false < true)
                    if (isCompletedA !== isCompletedB) {
                        return isCompletedA - isCompletedB;
                    }
                    
                    // If same completion status, sort alphabetically
                    return a.name.localeCompare(b.name);
                });
                
                const categoryEmoji = getCategoryEmoji(category);
                
                html += `<div class="habit-category-section">
                    <div class="habit-category-header-day">
                        <span class="habit-category-title-day">${categoryEmoji} ${category}</span>
                        <span class="habit-category-count-day">${categoryHabits.length}</span>
                    </div>`;
                
                for (const habit of categoryHabits) {
                    const currentValue = dayData[habit.id] || (habit.type === 'binary' ? false : 0);
                    const isDisabled = isFuture ? 'disabled' : '';
                    
                    if (habit.type === 'binary') {
                        // Get achievement indicators and streak data
                        const achievementIndicator = getAchievementIndicators(habit, selectedDate);
                        const streakData = calculateCurrentStreak(habit);
                        const streakDisplay = streakData.current > 0 ? 
                            `<div class="habit-streak-indicator" title="Current streak: ${streakData.current} days">
                                🔥 ${streakData.current}
                            </div>` : '';
                        
                        html += `<div class="habit-item binary ${isFuture ? 'future-date' : ''}">
                            <div class="habit-checkbox-container">
                                <input type="checkbox" 
                                       id="habit-day-${habit.id}" 
                                       class="habit-checkbox" 
                                       data-habit-id="${habit.id}"
                                       data-habit-date="${currentDateStr}"
                                       ${currentValue ? 'checked' : ''}
                                       ${isDisabled}>
                                <label for="habit-day-${habit.id}" class="habit-label">
                                    ${habit.name}
                                    <div class="habit-schedule">${getScheduleDisplayString(habit.schedule)}</div>
                                </label>
                            </div>
                            <div class="habit-actions">
                                ${streakDisplay}
                                <div class="habit-status">
                                    ${currentValue ? '✅' : '⏳'}
                                </div>
                                ${achievementIndicator}
                                <button class="habit-remove-btn" data-habit-id="${habit.id}" title="Remove habit">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                            </div>
                        </div>`;
                    } else {
                        const target = parseFloat(habit.target) || 1;
                        const percentage = Math.min(100, (currentValue / target) * 100);
                        
                        // Get achievement indicators and streak data
                        const achievementIndicator = getAchievementIndicators(habit, selectedDate);
                        const streakData = calculateCurrentStreak(habit);
                        const streakDisplay = streakData.current > 0 ? 
                            `<div class="habit-streak-indicator" title="Current streak: ${streakData.current} days">
                                🔥 ${streakData.current}
                            </div>` : '';
                        
                        html += `<div class="habit-item quantified ${isFuture ? 'future-date' : ''}">
                            <div class="habit-info">
                                <div class="habit-name">
                                    ${habit.name}
                                    <div class="habit-schedule">${getScheduleDisplayString(habit.schedule)}</div>
                                </div>
                                <div class="habit-target">Target: ${habit.target}</div>
                            </div>
                            <div class="habit-controls">
                                <button class="habit-btn decrease" data-habit-id="${habit.id}" data-habit-date="${currentDateStr}" ${isDisabled}>-</button>
                                <input type="number" 
                                       class="habit-input" 
                                       data-habit-id="${habit.id}"
                                       data-habit-date="${currentDateStr}"
                                       value="${currentValue}" 
                                       min="0" 
                                       step="0.1"
                                       ${isDisabled}>
                                <button class="habit-btn increase" data-habit-id="${habit.id}" data-habit-date="${currentDateStr}" ${isDisabled}>+</button>
                            </div>
                            <div class="habit-progress">
                                <div class="habit-progress-bar">
                                    <div class="habit-progress-fill" style="width: ${percentage}%"></div>
                                </div>
                                <div class="habit-progress-text">${currentValue} / ${habit.target}</div>
                            </div>
                            <div class="habit-actions-bottom">
                                ${streakDisplay}
                                ${achievementIndicator}
                                <button class="habit-remove-btn" data-habit-id="${habit.id}" title="Remove habit">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                            </div>
                        </div>`;
                    }
                }
                
                html += `</div>`; // Close habit-category-section
            }
            
            html += `</div>`; // Close habit-list
        }
        
        html += `</div>`;
        return html;
    }
    
    function renderCategoriesWidget() {
        const definitions = getHabitDefinitions();
        if (definitions.length === 0) {
            return `<div class="habit-widget">
                <div class="habit-header">
                    <div class="habit-header-content">
                        <h3>📂 Habit Categories</h3>
                        <div class="habit-help">
                            <span>🗂️ Organize your habits by categories for better focus and balance. Add some habits to get started!</span>
                            <br><br>
                            <strong>Why use categories:</strong><br>
                            • Group related habits together<br>
                            • Balance different life areas<br>
                            • Track category-specific progress<br>
                            • Get insights into your priorities<br>
                            <br>
                            <strong>Example categorized habits:</strong><br>
                            <code>- Exercise (CATEGORY: Health)</code><br>
                            <code>- Read (CATEGORY: Learning)</code><br>
                            <code>- Meditate (CATEGORY: Wellness)</code><br>
                            <code>- Call Family (CATEGORY: Relationships)</code>
                        </div>
                    </div>
                </div>
            </div>`;
        }
        
        const categorizedHabits = getHabitsByCategory();
        const categories = Object.keys(categorizedHabits).sort();
        const today = new Date();
        
        // Calculate overall category stats
        let totalCategories = categories.length;
        let categoriesOnTrack = 0;
        let totalHabits = definitions.length;
        let completedToday = 0;
        
        categories.forEach(category => {
            const stats = getCategoryStats(category);
            if (stats.averageCompletion >= 70) categoriesOnTrack++;
            completedToday += stats.completedToday;
        });
        
        const overallProgress = totalHabits > 0 ? Math.round((completedToday / totalHabits) * 100) : 0;
        
        let html = `<div class="habit-widget categories">
            <div class="habit-header">
                <div class="habit-header-content">
                    <h3>📂 Habit Categories</h3>
                    <div class="category-overview">
                        <div class="category-overview-stats">
                            <div class="category-overview-stat">
                                <div class="category-stat-number">${totalCategories}</div>
                                <div class="category-stat-label">Categories</div>
                            </div>
                            <div class="category-overview-stat">
                                <div class="category-stat-number">${categoriesOnTrack}</div>
                                <div class="category-stat-label">On Track</div>
                            </div>
                            <div class="category-overview-stat">
                                <div class="category-stat-number">${overallProgress}%</div>
                                <div class="category-stat-label">Today</div>
                            </div>
                        </div>
                        <div class="category-balance-indicator">
                            <div class="category-balance-title">Category Balance</div>
                            <div class="category-balance-bars">`;
        
        // Show category distribution
        categories.forEach(category => {
            const habits = categorizedHabits[category];
            const percentage = (habits.length / totalHabits) * 100;
            const categoryEmoji = getCategoryEmoji(category);
            
            html += `<div class="category-balance-bar" title="${category}: ${habits.length} habits (${Math.round(percentage)}%)">
                <div class="category-balance-fill" style="width: ${percentage}%; background-color: ${getCategoryColor(category)}"></div>
                <span class="category-balance-label">${categoryEmoji}</span>
            </div>`;
        });
        
        html += `</div>
                        </div>
                    </div>
                </div>
            </div>
            </div>
            
            <div class="category-insights">
                <div class="category-insight-card">
                    <div class="category-insight-icon">🎯</div>
                    <div class="category-insight-content">
                        <div class="category-insight-title">Focus Area</div>
                        <div class="category-insight-text">${getFocusAreaInsight(categorizedHabits)}</div>
                    </div>
                </div>
                <div class="category-insight-card">
                    <div class="category-insight-icon">📈</div>
                    <div class="category-insight-content">
                        <div class="category-insight-title">Performance</div>
                        <div class="category-insight-text">${getPerformanceInsight(categories, categorizedHabits)}</div>
                    </div>
                </div>
                <div class="category-insight-card">
                    <div class="category-insight-icon">⚖️</div>
                    <div class="category-insight-content">
                        <div class="category-insight-title">Balance</div>
                        <div class="category-insight-text">${getBalanceInsight(categorizedHabits, totalHabits)}</div>
                    </div>
                </div>
            </div>
            
            <div class="habit-categories-grid" data-view="cards">`;
        
        for (const category of categories) {
            const habits = categorizedHabits[category];
            const stats = getCategoryStats(category);
            const categoryEmoji = getCategoryEmoji(category);
            const categoryColor = getCategoryColor(category);
            
            // Determine category health
            const healthLevel = stats.averageCompletion >= 80 ? 'excellent' :
                               stats.averageCompletion >= 60 ? 'good' :
                               stats.averageCompletion >= 40 ? 'fair' : 'needs-attention';
            
            const healthEmoji = {
                'excellent': '🟢',
                'good': '🟡',
                'fair': '🟠',
                'needs-attention': '🔴'
            }[healthLevel];
            
            // Calculate trend (simplified - comparing last 7 days vs previous 7 days)
            const trendDirection = getCategoryTrend(category);
            const trendEmoji = trendDirection > 0 ? '📈' : trendDirection < 0 ? '📉' : '➡️';
            
            html += `<div class="habit-category-card ${healthLevel}" style="border-left: 4px solid ${categoryColor}">
                <div class="habit-category-header">
                    <div class="habit-category-title">
                        <div class="category-title-main">
                            ${categoryEmoji} ${category}
                            <span class="category-health-indicator" title="Category health: ${healthLevel}">${healthEmoji}</span>
                            <span class="category-trend-indicator" title="7-day trend">${trendEmoji}</span>
                        </div>
                        <div class="habit-category-count">${habits.length} habit${habits.length === 1 ? '' : 's'}</div>
                    </div>
                    <div class="habit-category-completion">
                        <div class="category-completion-percentage">${stats.averageCompletion}%</div>
                        <div class="category-completion-label">avg completion</div>
                    </div>
                </div>
                
                <div class="habit-category-stats">
                    <div class="category-stat-row">
                        <div class="habit-category-stat">
                            <span class="habit-stat-icon">📅</span>
                            <span class="habit-stat-label">Today:</span>
                            <span class="habit-stat-value">${stats.completedToday}/${stats.totalHabits}</span>
                        </div>
                        <div class="habit-category-stat">
                            <span class="habit-stat-icon">🔥</span>
                            <span class="habit-stat-label">Best streak:</span>
                            <span class="habit-stat-value">${stats.bestStreak} days</span>
                        </div>
                    </div>
                    <div class="category-progress-bar">
                        <div class="category-progress-fill" style="width: ${stats.averageCompletion}%; background-color: ${categoryColor}"></div>
                    </div>
                </div>
                
                <div class="habit-category-habits">
                    <div class="category-habits-header">
                        <span class="category-habits-title">Habits in this category</span>
                        <button class="category-habits-toggle" data-category="${category}">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,9 12,15 18,9"></polyline></svg>
                        </button>
                    </div>
                    <div class="category-habits-list expanded" data-category="${category}">`;
            
            for (const habit of habits) {
                const isScheduled = isHabitScheduledForDate(habit, today);
                const todayData = getHabitData(today);
                const value = todayData[habit.id] || (habit.type === 'binary' ? false : 0);
                
                let statusIcon = '⏳';
                let statusClass = 'pending';
                
                if (isScheduled) {
                    if (habit.type === 'binary') {
                        statusIcon = value ? '✅' : '⭕';
                        statusClass = value ? 'completed' : 'incomplete';
                    } else {
                        const target = parseFloat(habit.target) || 1;
                        const percentage = (value / target) * 100;
                        if (percentage >= 100) {
                            statusIcon = '✅';
                            statusClass = 'completed';
                        } else if (percentage > 0) {
                            statusIcon = `${Math.round(percentage)}%`;
                            statusClass = 'partial';
                        } else {
                            statusIcon = '⭕';
                            statusClass = 'incomplete';
                        }
                    }
                } else {
                    statusIcon = '—';
                    statusClass = 'not-scheduled';
                }
                
                // Get habit-specific stats for additional info
                const habitStats = calculateHabitStats(habit, 'last-7-days');
                
                html += `<div class="habit-category-habit ${statusClass}">
                    <div class="habit-category-habit-info">
                        <div class="habit-category-habit-name">${habit.name}</div>
                        <div class="habit-category-habit-details">
                            <span class="habit-detail">Streak: ${habitStats.currentStreak}</span>
                            <span class="habit-detail">7d: ${habitStats.completionRate}%</span>
                            ${habit.goal ? `<span class="habit-detail">Goal: ${getGoalDisplayString(habit.goal)}</span>` : ''}
                        </div>
                    </div>
                    <div class="habit-category-habit-status">${statusIcon}</div>
                </div>`;
            }
            
            html += `</div>
                </div>
            </div>`;
        }
        
        html += `</div></div>`;
        return html;
    }
    
    function getCategoryEmoji(category) {
        const emojiMap = {
            'Health': '💪',
            'Learning': '📚',
            'Work': '💼',
            'Personal': '🧘',
            'Creative': '🎨',
            'Fitness': '🏃',
            'Wellness': '🌱',
            'Finance': '💰',
            'Social': '👥',
            'Hobbies': '🎯',
            'General': '📝'
        };
        
        return emojiMap[category] || '📌';
    }
    
    function getCategoryColor(category) {
        const colorMap = {
            'Health': '#10b981',
            'Learning': '#3b82f6',
            'Work': '#6366f1',
            'Personal': '#8b5cf6',
            'Creative': '#f59e0b',
            'Fitness': '#ef4444',
            'Wellness': '#059669',
            'Finance': '#22c55e',
            'Social': '#ec4899',
            'Hobbies': '#14b8a6',
            'General': '#6b7280'
        };
        
        return colorMap[category] || '#6b7280';
    }
    
    function getCategoryTrend(category) {
        const categorizedHabits = getHabitsByCategory();
        const habits = categorizedHabits[category] || [];
        
        if (habits.length === 0) return 0;
        
        const today = new Date();
        let recentCompletion = 0;
        let pastCompletion = 0;
        
        // Calculate completion rates for last 7 days vs previous 7 days
        for (let i = 0; i < 14; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dayData = getHabitData(date);
            
            let dayTotal = 0;
            let dayCompleted = 0;
            
            habits.forEach(habit => {
                if (isHabitScheduledForDate(habit, date)) {
                    dayTotal++;
                    const value = dayData[habit.id] || (habit.type === 'binary' ? false : 0);
                    if (habit.type === 'binary') {
                        if (value) dayCompleted++;
                    } else {
                        const target = parseFloat(habit.target) || 1;
                        if (value >= target) dayCompleted++;
                    }
                }
            });
            
            if (dayTotal > 0) {
                const completion = (dayCompleted / dayTotal) * 100;
                if (i < 7) {
                    recentCompletion += completion;
                } else {
                    pastCompletion += completion;
                }
            }
        }
        
        recentCompletion /= 7;
        pastCompletion /= 7;
        
        const trend = recentCompletion - pastCompletion;
        return trend > 5 ? 1 : trend < -5 ? -1 : 0;
    }
    
    function getFocusAreaInsight(categorizedHabits) {
        const categories = Object.keys(categorizedHabits);
        if (categories.length === 0) return "No categories yet";
        
        // Find category with most habits
        let maxHabits = 0;
        let focusCategory = '';
        
        categories.forEach(category => {
            const count = categorizedHabits[category].length;
            if (count > maxHabits) {
                maxHabits = count;
                focusCategory = category;
            }
        });
        
        return `${focusCategory} is your main focus (${maxHabits} habits)`;
    }
    
    function getGoalMotivationInsight(habitsWithGoals) {
        if (habitsWithGoals.length === 0) return "No goals set yet";
        
        let completedCount = 0;
        let almostCompleteCount = 0;
        
        habitsWithGoals.forEach(habit => {
            const progress = calculateGoalProgress(habit);
            if (progress) {
                if (progress.isComplete) completedCount++;
                else if (progress.progress >= 80) almostCompleteCount++;
            }
        });
        
        if (completedCount > 0) {
            return `${completedCount} goal${completedCount === 1 ? '' : 's'} completed this period! 🎉`;
        } else if (almostCompleteCount > 0) {
            return `${almostCompleteCount} goal${almostCompleteCount === 1 ? ' is' : 's are'} almost complete! 💪`;
        } else {
            return "Keep pushing forward - every step counts! 🚀";
        }
    }
    
    function getGoalFocusInsight(habitsWithGoals) {
        if (habitsWithGoals.length === 0) return "No goals to focus on yet";
        
        let strugglingGoals = 0;
        let mostStrugglingHabit = null;
        let lowestProgress = 100;
        
        habitsWithGoals.forEach(habit => {
            const progress = calculateGoalProgress(habit);
            if (progress && !progress.isComplete) {
                if (progress.progress < 50) strugglingGoals++;
                if (progress.progress < lowestProgress) {
                    lowestProgress = progress.progress;
                    mostStrugglingHabit = habit.name;
                }
            }
        });
        
        if (strugglingGoals > 0 && mostStrugglingHabit) {
            return `Focus on "${mostStrugglingHabit}" - needs the most attention`;
        } else {
            return "All goals are on track - maintain the momentum! ⚡";
        }
    }
    
    function getGoalPerformanceInsight(habitsWithGoals) {
        if (habitsWithGoals.length === 0) return "No performance data yet";
        
        let totalProgress = 0;
        let completedGoals = 0;
        
        habitsWithGoals.forEach(habit => {
            const progress = calculateGoalProgress(habit);
            if (progress) {
                totalProgress += progress.progress;
                if (progress.isComplete) completedGoals++;
            }
        });
        
        const avgProgress = Math.round(totalProgress / habitsWithGoals.length);
        const completionRate = Math.round((completedGoals / habitsWithGoals.length) * 100);
        
        if (avgProgress >= 80) {
            return `Excellent performance! ${avgProgress}% average progress`;
        } else if (avgProgress >= 60) {
            return `Good progress overall - ${avgProgress}% average completion`;
        } else {
            return `Room for improvement - ${avgProgress}% average, let's boost it! 📈`;
        }
    }
    
    function getAveragePerDay(habit, goalProgress) {
        if (goalProgress.type === 'streak') return 'N/A';
        
        const today = new Date();
        let daysPassed = 0;
        
        if (goalProgress.type === 'weekly') {
            const startOfWeek = new Date(today);
            const day = startOfWeek.getDay();
            const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
            startOfWeek.setDate(diff);
            daysPassed = Math.ceil((today - startOfWeek) / (1000 * 60 * 60 * 24)) + 1;
        } else if (goalProgress.type === 'monthly') {
            daysPassed = today.getDate();
        } else {
            daysPassed = 1; // For daily goals
        }
        
        const avgPerDay = daysPassed > 0 ? (goalProgress.current / daysPassed).toFixed(1) : '0';
        return avgPerDay;
    }
    
    function getPerformanceInsight(categories, categorizedHabits) {
        if (categories.length === 0) return "No performance data yet";
        
        let bestCategory = '';
        let bestScore = 0;
        
        categories.forEach(category => {
            const stats = getCategoryStats(category);
            if (stats.averageCompletion > bestScore) {
                bestScore = stats.averageCompletion;
                bestCategory = category;
            }
        });
        
        if (bestScore >= 80) {
            return `${bestCategory} is performing excellently (${bestScore}%)`;
        } else if (bestScore >= 60) {
            return `${bestCategory} is your best performing category (${bestScore}%)`;
        } else {
            return "All categories need attention - consider reducing habits or improving consistency";
        }
    }
    
    function getBalanceInsight(categorizedHabits, totalHabits) {
        const categories = Object.keys(categorizedHabits);
        if (categories.length === 0) return "No balance data yet";
        
        const categoryCounts = categories.map(cat => categorizedHabits[cat].length);
        const maxCount = Math.max(...categoryCounts);
        const minCount = Math.min(...categoryCounts);
        const avgCount = totalHabits / categories.length;
        
        if (maxCount - minCount <= 1) {
            return "Great balance across all categories!";
        } else if (maxCount > avgCount * 2) {
            const dominantCategory = categories.find(cat => categorizedHabits[cat].length === maxCount);
            return `Consider balancing - ${dominantCategory} dominates with ${maxCount} habits`;
        } else {
            return `Fairly balanced - ${categories.length} categories with ${Math.round(avgCount)} habits each on average`;
        }
    }
    
    // --- STATISTICS WIDGET UTILITY FUNCTIONS ---
    
    function calculateOverallStats(definitions, period) {
        if (definitions.length === 0) {
            return {
                totalHabits: 0,
                averageCompletion: 0,
                totalCompletions: 0,
                bestStreak: 0
            };
        }
        
        let totalCompletion = 0;
        let totalCompletions = 0;
        let bestStreak = 0;
        
        definitions.forEach(habit => {
            const stats = calculateHabitStats(habit, period);
            totalCompletion += stats.completionRate;
            totalCompletions += stats.completedDays;
            if (stats.bestStreak > bestStreak) {
                bestStreak = stats.bestStreak;
            }
        });
        
        return {
            totalHabits: definitions.length,
            averageCompletion: Math.round(totalCompletion / definitions.length),
            totalCompletions,
            bestStreak
        };
    }
    
    function getStatsInsights(definitions, period) {
        if (definitions.length === 0) return [];
        
        const insights = [];
        const overallStats = calculateOverallStats(definitions, period);
        
        // Performance insight
        if (overallStats.averageCompletion >= 80) {
            insights.push({
                icon: '🎯',
                title: 'Excellent Performance',
                text: `${overallStats.averageCompletion}% completion rate - you're crushing it!`
            });
        } else if (overallStats.averageCompletion >= 60) {
            insights.push({
                icon: '📈',
                title: 'Good Progress',
                text: `${overallStats.averageCompletion}% completion rate - solid consistency!`
            });
        } else {
            insights.push({
                icon: '💪',
                title: 'Room for Improvement',
                text: `${overallStats.averageCompletion}% completion rate - focus on consistency`
            });
        }
        
        // Streak insight
        if (overallStats.bestStreak >= 30) {
            insights.push({
                icon: '🔥',
                title: 'Streak Master',
                text: `${overallStats.bestStreak} day best streak - incredible dedication!`
            });
        } else if (overallStats.bestStreak >= 7) {
            insights.push({
                icon: '⚡',
                title: 'Building Momentum',
                text: `${overallStats.bestStreak} day best streak - keep the momentum going!`
            });
        } else {
            insights.push({
                icon: '🎯',
                title: 'Focus on Streaks',
                text: 'Building longer streaks will boost your success rate'
            });
        }
        
        // Volume insight
        const totalDays = getPeriodDays(period);
        const possibleCompletions = definitions.length * totalDays;
        const completionDensity = possibleCompletions > 0 ? (overallStats.totalCompletions / possibleCompletions) * 100 : 0;
        
        if (completionDensity >= 70) {
            insights.push({
                icon: '🌟',
                title: 'High Activity',
                text: `${overallStats.totalCompletions} total completions - very active period!`
            });
        } else if (completionDensity >= 40) {
            insights.push({
                icon: '📊',
                title: 'Moderate Activity',
                text: `${overallStats.totalCompletions} total completions - decent activity level`
            });
        } else {
            insights.push({
                icon: '🎯',
                title: 'Increase Activity',
                text: 'More frequent habit completion will improve your results'
            });
        }
        
        return insights;
    }
    
    function getHabitPerformanceLevel(stats) {
        if (stats.completionRate >= 90) {
            return { class: 'excellent', emoji: '🏆', color: '#4CAF50' };
        } else if (stats.completionRate >= 75) {
            return { class: 'good', emoji: '⭐', color: '#8BC34A' };
        } else if (stats.completionRate >= 60) {
            return { class: 'average', emoji: '📈', color: '#FF9800' };
        } else if (stats.completionRate >= 40) {
            return { class: 'below-average', emoji: '📊', color: '#2196F3' };
        } else if (stats.completionRate >= 20) {
            return { class: 'poor', emoji: '📉', color: '#FF5722' };
        } else {
            return { class: 'very-poor', emoji: '❌', color: '#9E9E9E' };
        }
    }
    
    function getHabitTrend(habit, period) {
        // Calculate trend by comparing first half vs second half of period
        const dates = getDateRange(period);
        const midPoint = Math.floor(dates.length / 2);
        const firstHalf = dates.slice(0, midPoint);
        const secondHalf = dates.slice(midPoint);
        
        let firstHalfCompletions = 0;
        let secondHalfCompletions = 0;
        
        firstHalf.forEach(date => {
            const data = getHabitData(date);
            if (isHabitCompletedOnDate(habit, date, data)) {
                firstHalfCompletions++;
            }
        });
        
        secondHalf.forEach(date => {
            const data = getHabitData(date);
            if (isHabitCompletedOnDate(habit, date, data)) {
                secondHalfCompletions++;
            }
        });
        
        const firstHalfRate = firstHalf.length > 0 ? (firstHalfCompletions / firstHalf.length) * 100 : 0;
        const secondHalfRate = secondHalf.length > 0 ? (secondHalfCompletions / secondHalf.length) * 100 : 0;
        const difference = secondHalfRate - firstHalfRate;
        
        if (difference > 10) {
            return { direction: 'up', icon: '📈', text: 'Improving' };
        } else if (difference < -10) {
            return { direction: 'down', icon: '📉', text: 'Declining' };
        } else {
            return { direction: 'stable', icon: '➡️', text: 'Stable' };
        }
    }
    
    function getHabitStatInsight(habit, stats, trend) {
        if (stats.completionRate >= 90) {
            return `Outstanding consistency! Your ${stats.currentStreak}-day streak shows real commitment.`;
        } else if (stats.completionRate >= 75) {
            return `Great work! ${trend.text} trend with ${stats.completionRate}% completion rate.`;
        } else if (stats.completionRate >= 60) {
            if (trend.direction === 'up') {
                return `Good improvement! Keep building on this ${trend.text.toLowerCase()} momentum.`;
            } else {
                return `Solid foundation. Focus on consistency to reach the next level.`;
            }
        } else if (stats.completionRate >= 40) {
            if (stats.currentStreak >= 3) {
                return `Your current ${stats.currentStreak}-day streak is promising - keep it going!`;
            } else {
                return `Building habits takes time. Focus on small, consistent wins.`;
            }
        } else {
            if (stats.bestStreak >= 5) {
                return `You've done ${stats.bestStreak} days before - you can do it again!`;
            } else {
                return `Start small and focus on just showing up consistently.`;
            }
        }
    }
    
    function getPeriodDisplayName(period) {
        switch (period) {
            case 'last-7-days': return 'Last 7 Days';
            case 'last-30-days': return 'Last 30 Days';
            case 'last-90-days': return 'Last 90 Days';
            case 'last-365-days': return 'Last Year';
            case 'this-week': return 'This Week';
            case 'this-month': return 'This Month';
            case 'this-year': return 'This Year';
            default: return period;
        }
    }
    
    function getPeriodDays(period) {
        switch (period) {
            case 'last-7-days': return 7;
            case 'last-30-days': return 30;
            case 'last-90-days': return 90;
            case 'last-365-days': return 365;
            case 'this-week': return 7;
            case 'this-month': return 30;
            case 'this-year': return 365;
            default: return 30;
        }
    }
    
    function renderGoalsWidget() {
        const definitions = getHabitDefinitions();
        const habitsWithGoals = definitions.filter(habit => habit.goal);
        
        if (habitsWithGoals.length === 0) {
            return `<div class="habit-widget">
                <div class="habit-header">
                    <div class="habit-header-content">
                        <h3>🎯 Habit Goals</h3>
                        <div class="habit-help">
                            <span>🏃‍♀️ Set specific goals for your habits to stay motivated and track progress. Add some goals to get started!</span>
                            <br><br>
                            <strong>Types of goals you can set:</strong><br>
                            • <strong>Weekly:</strong> "3 times per week", "5x per week"<br>
                            • <strong>Monthly:</strong> "20 times per month", "15/month"<br>
                            • <strong>Streak:</strong> "7 days in a row", "10 day streak"<br>
                            • <strong>Daily:</strong> "every day", "daily"<br>
                            <br>
                            <strong>Example habits with goals:</strong><br>
                            <code>- Exercise (GOAL: 3 times per week)</code><br>
                            <code>- Read (GOAL: 20 times per month)</code><br>
                            <code>- Meditate (GOAL: 7 days in a row)</code><br>
                            <code>- Drink Water (TARGET: 8 glasses) (GOAL: every day)</code>
                        </div>
                    </div>
                </div>
            </div>`;
        }
        
        // Calculate overall goal statistics
        let totalGoals = habitsWithGoals.length;
        let completedGoals = 0;
        let onTrackGoals = 0;
        let strugglingGoals = 0;
        
        habitsWithGoals.forEach(habit => {
            const goalProgress = calculateGoalProgress(habit);
            if (goalProgress) {
                if (goalProgress.isComplete) {
                    completedGoals++;
                } else if (goalProgress.progress >= 75) {
                    onTrackGoals++;
                } else if (goalProgress.progress < 50) {
                    strugglingGoals++;
                }
            }
        });
        
        const overallProgress = totalGoals > 0 ? Math.round(((completedGoals + onTrackGoals * 0.8) / totalGoals) * 100) : 0;
        
        let html = `<div class="habit-widget goals">
            <div class="habit-header">
                <div class="habit-header-content">
                    <h3>🎯 Habit Goals</h3>
                    <div class="goals-overview">
                        <div class="goals-overview-stats">
                            <div class="goals-overview-stat">
                                <div class="goals-stat-number">${totalGoals}</div>
                                <div class="goals-stat-label">Total Goals</div>
                            </div>
                            <div class="goals-overview-stat">
                                <div class="goals-stat-number">${completedGoals}</div>
                                <div class="goals-stat-label">Completed</div>
                            </div>
                            <div class="goals-overview-stat">
                                <div class="goals-stat-number">${onTrackGoals}</div>
                                <div class="goals-stat-label">On Track</div>
                            </div>
                            <div class="goals-overview-stat">
                                <div class="goals-stat-number">${strugglingGoals}</div>
                                <div class="goals-stat-label">Struggling</div>
                            </div>
                        </div>
                        <div class="goals-progress-summary">
                            <div class="goals-progress-title">Overall Progress</div>
                            <div class="goals-progress-bar">
                                <div class="goals-progress-fill" style="width: ${overallProgress}%"></div>
                            </div>
                            <div class="goals-progress-percentage">${overallProgress}%</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="goals-insights">
                <div class="goals-insight-card">
                    <div class="goals-insight-icon">🚀</div>
                    <div class="goals-insight-content">
                        <div class="goals-insight-title">Motivation</div>
                        <div class="goals-insight-text">${getGoalMotivationInsight(habitsWithGoals)}</div>
                    </div>
                </div>
                <div class="goals-insight-card">
                    <div class="goals-insight-icon">⚡</div>
                    <div class="goals-insight-content">
                        <div class="goals-insight-title">Focus</div>
                        <div class="goals-insight-text">${getGoalFocusInsight(habitsWithGoals)}</div>
                    </div>
                </div>
                <div class="goals-insight-card">
                    <div class="goals-insight-icon">📊</div>
                    <div class="goals-insight-content">
                        <div class="goals-insight-title">Performance</div>
                        <div class="goals-insight-text">${getGoalPerformanceInsight(habitsWithGoals)}</div>
                    </div>
                </div>
            </div>
            
            <div class="habit-goals-grid">`;
        
        // Sort goals by priority: completed goals last, struggling goals first, then by progress
        const sortedHabits = [...habitsWithGoals].sort((a, b) => {
            const progressA = calculateGoalProgress(a);
            const progressB = calculateGoalProgress(b);
            
            if (!progressA || !progressB) return 0;
            
            // Completed goals go to the end
            if (progressA.isComplete && !progressB.isComplete) return 1;
            if (!progressA.isComplete && progressB.isComplete) return -1;
            
            // If both completed or both incomplete, sort by progress (lower progress first to focus attention)
            return progressA.progress - progressB.progress;
        });
        
        for (const habit of sortedHabits) {
            const goalProgress = calculateGoalProgress(habit);
            if (!goalProgress) continue;
            
            const categoryEmoji = getCategoryEmoji(habit.category || 'General');
            const categoryColor = getCategoryColor(habit.category || 'General');
            
            // Enhanced progress color and status
            let progressColor, statusClass, motivationText;
            if (goalProgress.isComplete) {
                progressColor = '#4CAF50';
                statusClass = 'complete';
                motivationText = 'Goal achieved! 🎉';
            } else if (goalProgress.progress >= 90) {
                progressColor = '#8BC34A';
                statusClass = 'almost-complete';
                motivationText = 'Almost there! 💪';
            } else if (goalProgress.progress >= 75) {
                progressColor = '#FF9800';
                statusClass = 'on-track';
                motivationText = 'Great progress! 👍';
            } else if (goalProgress.progress >= 50) {
                progressColor = '#2196F3';
                statusClass = 'making-progress';
                motivationText = 'Keep going! 🔥';
            } else if (goalProgress.progress >= 25) {
                progressColor = '#FF5722';
                statusClass = 'needs-focus';
                motivationText = 'Needs attention 📋';
            } else {
                progressColor = '#757575';
                statusClass = 'struggling';
                motivationText = 'Let\'s get started! 💭';
            }
            
            // Calculate days remaining for time-based goals
            let timeInfo = '';
            if (goalProgress.type === 'weekly' || goalProgress.type === 'monthly') {
                const now = new Date();
                let endDate;
                
                if (goalProgress.type === 'weekly') {
                    const startOfWeek = new Date(now);
                    const day = startOfWeek.getDay();
                    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
                    startOfWeek.setDate(diff);
                    endDate = new Date(startOfWeek);
                    endDate.setDate(endDate.getDate() + 6);
                } else {
                    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                }
                
                const daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
                timeInfo = daysRemaining > 0 ? `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left` : 'Last day!';
            }
            
            html += `<div class="habit-goal-card ${statusClass}" style="border-left: 4px solid ${categoryColor}">
                <div class="habit-goal-header">
                    <div class="habit-goal-info">
                        <div class="habit-goal-name">
                            ${categoryEmoji} ${habit.name}
                        </div>
                        <div class="habit-goal-description">
                            ${getGoalDisplayString(habit.goal)}
                        </div>
                        ${timeInfo ? `<div class="habit-goal-time-remaining">${timeInfo}</div>` : ''}
                    </div>
                    <div class="habit-goal-status-indicator">
                        <div class="habit-goal-percentage-large">${goalProgress.progress}%</div>
                        <div class="habit-goal-status-emoji">
                            ${goalProgress.isComplete ? '🎉' : 
                              goalProgress.progress >= 75 ? '🚀' :
                              goalProgress.progress >= 50 ? '💪' :
                              goalProgress.progress >= 25 ? '🔁' : '⏳'}
                        </div>
                    </div>
                </div>
                
                <div class="habit-goal-progress">
                    <div class="habit-goal-progress-bar">
                        <div class="habit-goal-progress-fill" style="width: ${goalProgress.progress}%; background-color: ${progressColor}"></div>
                    </div>
                    <div class="habit-goal-progress-details">
                        <div class="habit-goal-progress-text">
                            ${goalProgress.current} / ${goalProgress.target} ${goalProgress.type === 'streak' ? 'days' : 'times'}
                        </div>
                        <div class="habit-goal-motivation">${motivationText}</div>
                    </div>
                </div>
                
                <div class="habit-goal-stats">
                    <div class="habit-goal-stat">
                        <span class="habit-goal-stat-label">Period:</span>
                        <span class="habit-goal-stat-value">${goalProgress.periodName}</span>
                    </div>
                    <div class="habit-goal-stat">
                        <span class="habit-goal-stat-label">Type:</span>
                        <span class="habit-goal-stat-value">${goalProgress.type === 'streak' ? 'Streak Goal' : 'Frequency Goal'}</span>
                    </div>
                    ${goalProgress.type !== 'streak' && goalProgress.current > 0 ? `
                        <div class="habit-goal-stat">
                            <span class="habit-goal-stat-label">Avg/day:</span>
                            <span class="habit-goal-stat-value">${getAveragePerDay(habit, goalProgress)}</span>
                        </div>
                    ` : ''}
                </div>
            </div>`;
        }
        
        html += `</div></div>`;
        return html;
    }
    
// Helper to prevent XSS attacks by escaping HTML special characters.
const escapeHTML = (str) => {
    if (typeof str !== 'string') return str;
    return str.replace(/[&<>"']/g, (match) => {
        switch (match) {
            case '&': return '&';
            case '<': return '<';
            case '>': return '>';
            case '"': return '"';
            case "'": return '"';
            default: return match;
        }
    });
};

// --- RENDER HELPER FUNCTIONS (for readability and reusability) ---

function renderEarnedCard(achievement) {
    const categoryEmoji = getCategoryEmoji(getHabitCategory(achievement.habitName));
    const timeAgo = getTimeAgo(new Date(achievement.earnedDate));

    return `
        <div class="achievement-card earned">
            <div class="achievement-card-header">
                <div class="achievement-icon-large">🏆</div>
                <div class="achievement-type-badge earned">${escapeHTML(getAchievementTypeName(achievement.type))}</div>
            </div>
            <div class="achievement-card-content">
                <div class="achievement-habit-info">
                    ${escapeHTML(categoryEmoji)} ${escapeHTML(achievement.habitName)}
                </div>
                <div class="achievement-reward-title">
                    ${escapeHTML(achievement.reward)}
                </div>
                <div class="achievement-description">
                    ${escapeHTML(getAchievementDescription(achievement))}
                </div>
            </div>
            <div class="achievement-card-footer">
                <div class="achievement-earned-date">
                    🎉 Earned ${escapeHTML(timeAgo)}
                </div>
            </div>
        </div>`;
}

function renderAvailableCard(achievement) {
    const categoryEmoji = getCategoryEmoji(getHabitCategory(achievement.habitName));
    const progressPercentage = achievement.progress.percentage;
    const isCloseToEarning = progressPercentage >= 80;

    return `
        <div class="achievement-card available ${isCloseToEarning ? 'close-to-earning' : ''}">
            <div class="achievement-card-header">
                <div class="achievement-icon-large">🎯</div>
                <div class="achievement-type-badge available">${escapeHTML(getAchievementTypeName(achievement.type))}</div>
            </div>
            <div class="achievement-card-content">
                <div class="achievement-habit-info">
                    ${escapeHTML(categoryEmoji)} ${escapeHTML(achievement.habitName)}
                </div>
                <div class="achievement-reward-title">
                    ${escapeHTML(achievement.reward)}
                </div>
                <div class="achievement-description">
                    ${escapeHTML(getAchievementDescription(achievement))}
                </div>
                <div class="achievement-progress">
                    <div class="achievement-progress-text">
                        ${achievement.progress.current} / ${achievement.progress.target}
                        ${isCloseToEarning ? '🔥 Almost there!' : ''}
                    </div>
                    <div class="achievement-progress-bar">
                        <div class="achievement-progress-fill" style="width: ${progressPercentage}%"></div>
                    </div>
                </div>
            </div>
        </div>`;
}

function renderEmptyState() {
    return `
        <div class="habit-widget">
            <div class="habit-header">
                <div class="habit-header-content">
                    <h3>🏆 Achievements</h3>
                    <div class="habit-help">
                        <span>🎉 Unlock achievements by reaching habit milestones! Add some achievement rewards to your habits to get started.</span>
                        <br><br>
                        <strong>Achievement types you can earn:</strong><br>
                        • <strong>Streaks:</strong> "7 day streak = Movie night"<br>
                        • <strong>Total completions:</strong> "50 completions = New gear"<br>
                        • <strong>Perfect periods:</strong> "perfect week = Treat myself"<br>
                        • <strong>Multiple rewards:</strong> Add several achievements per habit<br>
                        <br>
                        <strong>Example habits with achievements:</strong><br>
                        <code>- Exercise (ACHIEVEMENT: 7 day streak = Movie night)</code><br>
                        <code>- Read (ACHIEVEMENT: 30 completions = Buy new books)</code><br>
                        <code>- Meditate (ACHIEVEMENT: perfect week = Spa day)</code>
                    </div>
                </div>
                <div class="finance-widget-controls">
                    <button class="finance-add-button habit-add-button">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        New Habit
                    </button>
                </div>
            </div>
        </div>`;
}

// --- MAIN WIDGET FUNCTION ---

function renderAchievementsWidget() {
    // --- 1. DATA PREPARATION ---
    const allAchievements = getAllAchievements();
    const definitions = getHabitDefinitions();
    const earnedAchievements = [];
    const availableAchievements = [];

    // Flatten all earned achievements into a single list
    for (const habitId in allAchievements) {
        const habitAchievements = allAchievements[habitId];
        for (const achievementId in habitAchievements) {
            earnedAchievements.push(habitAchievements[achievementId]);
        } // FIXED: Added missing closing brace here
    }

    // Find available (not yet earned) achievements and calculate their progress
    for (const habit of definitions) {
        if (!habit.achievement) continue;

        const achievements = Array.isArray(habit.achievement) ? habit.achievement : [habit.achievement];
        const earnedHabitAchievements = allAchievements[habit.id] || {};

        for (const achievement of achievements) {
            if (!earnedHabitAchievements[achievement.id]) {
                availableAchievements.push({
                    ...achievement,
                    habitName: habit.name,
                    habitId: habit.id,
                    progress: calculateAchievementProgress(habit, achievement),
                });
            }
        }
    }

    // Sort the lists
    earnedAchievements.sort((a, b) => new Date(b.earnedDate) - new Date(a.earnedDate));
    availableAchievements.sort((a, b) => b.progress.percentage - a.progress.percentage);

    // --- 2. RENDER EMPTY STATE (if necessary) ---
    if (earnedAchievements.length === 0 && availableAchievements.length === 0) {
        return renderEmptyState();
    }

    // --- 3. CALCULATE STATS ---
    const totalEarned = earnedAchievements.length;
    const totalAvailable = availableAchievements.length;
    const totalPossible = totalEarned + totalAvailable;
    const completionPercentage = totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : 0;
    
    // --- 4. GENERATE DYNAMIC CONTENT ---
    const earnedCardsHtml = earnedAchievements.length > 0
        ? earnedAchievements.map(renderEarnedCard).join('')
        : `<div class="achievement-empty">
               <div class="achievement-empty-icon">🎯</div>
               <div class="achievement-empty-title">No achievements earned yet</div>
               <div class="achievement-empty-message">Keep working on your habits to unlock achievements!</div>
           </div>`;

    const availableCardsHtml = availableAchievements.length > 0
        ? availableAchievements.map(renderAvailableCard).join('')
        : `<div class="achievement-empty">
               <div class="achievement-empty-icon">✨</div>
               <div class="achievement-empty-title">All achievements earned!</div>
               <div class="achievement-empty-message">Add more achievement rewards to your habits to unlock more.</div>
           </div>`;

    // --- 5. ASSEMBLE THE FINAL WIDGET ---
    // FIXED: The duplicated, broken code block at the end has been removed.
    return `
        <div class="habit-widget achievements">
            <div class="habit-header">
                <div class="habit-header-content">
                    <div style="
    display: flex;
    justify-content: space-between;
"><h3>🏆 Achievements</h3>
                    <div class="finance-widget-controls">
                    <button class="finance-add-button habit-add-button">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        New Habit
                    </button></div>
                </div><div class="achievement-summary">
                        <div class="achievement-stats">
                            <div class="achievement-stat">
                                <div class="achievement-stat-number">0</div>
                                <div class="achievement-stat-label">Earned</div>
                            </div>
                            <div class="achievement-stat">
                                <div class="achievement-stat-number">8</div>
                                <div class="achievement-stat-label">Available</div>
                            </div>
                            <div class="achievement-stat">
                                <div class="achievement-stat-number">0%</div>
                                <div class="achievement-stat-label">Complete</div>
                            </div>
                        </div>
                        <div class="achievement-progress-bar">
                            <div class="achievement-progress-fill" style="width: 0%"></div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="achievement-tabs">
                <button class="achievement-tab active" data-tab="earned">
                    🏆 Earned (${totalEarned})
                </button>
                <button class="achievement-tab" data-tab="available">
                    🎯 Available (${totalAvailable})
                </button>
            </div>
            
            <div class="achievement-content">
                <div class="achievement-tab-content active" data-content="earned">
                    <div class="achievements-grid">
                        ${earnedCardsHtml}
                    </div>
                </div>
                
                <div class="achievement-tab-content" data-content="available">
                    <div class="achievements-grid">
                        ${availableCardsHtml}
                    </div>
                </div>
            </div>
        </div>`;
}
    
    
    function calculateAchievementProgress(habit, achievement) {
        let current = 0;
        let target = achievement.target;
        let percentage = 0;
        
        switch (achievement.type) {
            case 'streak':
                const streakData = calculateCurrentStreak(habit, target);
                current = streakData.current;
                percentage = streakData.progress;
                break;
                
            case 'total_completions':
                current = calculateTotalCompletions(habit);
                percentage = Math.min(100, (current / target) * 100);
                break;
                
            case 'perfect_week':
                current = calculatePerfectWeeks(habit);
                percentage = Math.min(100, (current / target) * 100);
                break;
                
            case 'perfect_month':
                current = calculatePerfectMonths(habit);
                percentage = Math.min(100, (current / target) * 100);
                break;
        }
        
        return {
            current: Math.floor(current),
            target,
            percentage: Math.floor(percentage)
        };
    }
    
    function getHabitCategory(habitName) {
        const definitions = getHabitDefinitions();
        const habit = definitions.find(h => h.name === habitName);
        return habit ? habit.category || 'General' : 'General';
    }
    
    function getAchievementTypeName(type) {
        switch (type) {
            case 'streak': return 'Streak';
            case 'total_completions': return 'Milestone';
            case 'perfect_week': return 'Perfect Week';
            case 'perfect_month': return 'Perfect Month';
            default: return 'Achievement';
        }
    }
    
    function getTimeAgo(date) {
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);
        
        if (diffInSeconds < 60) return 'just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
        if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
        if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)} months ago`;
        return `${Math.floor(diffInSeconds / 31536000)} years ago`;
    }
    
    // --- UTILITY FUNCTIONS ---
    
    function formatDate(date) {
        // Use local timezone to avoid date shifting issues
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    function formatDateDisplay(date) {
        return date.toLocaleDateString('en-US', { 
            weekday: 'short', 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    }
    
    function getDateRange(period) {
        const today = new Date();
        const dates = [];
        
        switch (period) {
            case 'this-week':
                // Get current week (Monday to Sunday)
                const currentWeekStart = new Date(today);
                const day = currentWeekStart.getDay();
                const diff = currentWeekStart.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
                currentWeekStart.setDate(diff);
                
                for (let i = 0; i < 7; i++) {
                    const date = new Date(currentWeekStart);
                    date.setDate(currentWeekStart.getDate() + i);
                    dates.push(date);
                }
                break;
                
            case 'this-month':
                const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
                const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                for (let d = new Date(firstDay); d <= lastDay && d <= today; d.setDate(d.getDate() + 1)) {
                    dates.push(new Date(d));
                }
                break;
                
            case 'this-year':
                const yearStart = new Date(today.getFullYear(), 0, 1);
                for (let d = new Date(yearStart); d <= today; d.setDate(d.getDate() + 1)) {
                    dates.push(new Date(d));
                }
                break;
                
            case 'last-7-days':
                for (let i = 6; i >= 0; i--) {
                    const date = new Date(today);
                    date.setDate(date.getDate() - i);
                    dates.push(date);
                }
                break;
                
            case 'last-30-days':
                for (let i = 29; i >= 0; i--) {
                    const date = new Date(today);
                    date.setDate(date.getDate() - i);
                    dates.push(date);
                }
                break;
                
            case 'last-90-days':
                for (let i = 89; i >= 0; i--) {
                    const date = new Date(today);
                    date.setDate(date.getDate() - i);
                    dates.push(date);
                }
                break;
                
            case 'last-180-days':
                for (let i = 179; i >= 0; i--) {
                    const date = new Date(today);
                    date.setDate(date.getDate() - i);
                    dates.push(date);
                }
                break;
                
            case 'last-365-days':
                for (let i = 364; i >= 0; i--) {
                    const date = new Date(today);
                    date.setDate(date.getDate() - i);
                    dates.push(date);
                }
                break;
                
            case 'last-three-months':
                const threeMonthsAgo = new Date(today);
                threeMonthsAgo.setMonth(today.getMonth() - 3);
                for (let d = new Date(threeMonthsAgo); d <= today; d.setDate(d.getDate() + 1)) {
                    dates.push(new Date(d));
                }
                break;
                
            case 'last-six-months':
                const sixMonthsAgo = new Date(today);
                sixMonthsAgo.setMonth(today.getMonth() - 6);
                for (let d = new Date(sixMonthsAgo); d <= today; d.setDate(d.getDate() + 1)) {
                    dates.push(new Date(d));
                }
                break;
                
            default:
                dates.push(today);
                break;
        }
        
        return dates;
    }
    
    function calculateHabitStats(habit, period = 'last-30-days') {
        const dates = getDateRange(period);
        const scheduledDates = getScheduledDaysInPeriod(habit, dates);
        
        let completedDays = 0;
        let currentStreak = 0;
        let bestStreak = 0;
        let tempStreak = 0;
        
        // Calculate completion based on scheduled days only
        for (const date of scheduledDates.reverse()) {
            const data = getHabitData(date);
            const value = data[habit.id] || (habit.type === 'binary' ? false : 0);
            
            let isCompleted = false;
            if (habit.type === 'binary') {
                isCompleted = value;
            } else {
                const target = parseFloat(habit.target) || 1;
                isCompleted = value >= target;
            }
            
            if (isCompleted) {
                completedDays++;
                tempStreak++;
                bestStreak = Math.max(bestStreak, tempStreak);
            } else {
                tempStreak = 0;
            }
        }
        
        // Calculate current streak from today backwards (only scheduled days)
        const reversedScheduledDates = [...scheduledDates].reverse();
        for (const date of reversedScheduledDates) {
            const data = getHabitData(date);
            const value = data[habit.id] || (habit.type === 'binary' ? false : 0);
            
            let isCompleted = false;
            if (habit.type === 'binary') {
                isCompleted = value;
            } else {
                const target = parseFloat(habit.target) || 1;
                isCompleted = value >= target;
            }
            
            if (isCompleted) {
                currentStreak++;
            } else {
                break;
            }
        }
        
        const totalScheduledDays = scheduledDates.length;
        const completionRate = totalScheduledDays > 0 ? Math.round((completedDays / totalScheduledDays) * 100) : 0;
        
        // Calculate weekly average
        const weeklyAverage = totalScheduledDays >= 7 ? Math.round((completedDays / totalScheduledDays) * 100) : completionRate;
        
        // Calculate average value for numeric habits
        let averageValue = null;
        if (habit.type === 'numeric') {
            let totalValue = 0;
            let valueCount = 0;
            
            scheduledDates.forEach(date => {
                const data = getHabitData(date);
                const value = parseFloat(data[habit.id]) || 0;
                if (value > 0) {
                    totalValue += value;
                    valueCount++;
                }
            });
            
            if (valueCount > 0) {
                averageValue = (totalValue / valueCount).toFixed(1);
            }
        }
        
        return {
            completionRate,
            currentStreak,
            bestStreak,
            totalDays: totalScheduledDays,
            scheduledDays: totalScheduledDays,
            completedDays,
            weeklyAverage,
            averageValue
        };
    }
    
    // --- EVENT HANDLERS ---
    
    function attachEventListeners() {
        if (!placeholder) return;
        
        // Stop propagation on the entire widget to prevent edit mode
        placeholder.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        // Handle checkbox changes
        placeholder.addEventListener('change', (e) => {
            if (e.target.classList.contains('habit-checkbox')) {
                e.stopPropagation();
                const habitId = e.target.dataset.habitId;
                const value = e.target.checked;
                
                // Handle historical date context for day widget
                const habitDate = e.target.dataset.habitDate;
                const dateToUpdate = habitDate ? new Date(habitDate + 'T00:00:00') : new Date();
                
                updateHabitValue(habitId, value, dateToUpdate);
                
                // Update status icon
                const statusIcon = e.target.closest('.habit-item').querySelector('.habit-status');
                if (statusIcon) {
                    statusIcon.textContent = value ? '✅' : '⏳';
                }
                
                // Refresh the entire UI to update all widgets
                if (typeof renderApp === 'function') {
                    setTimeout(() => renderApp(), 0);
                }
            }
        });
        
        // Handle number input changes
        placeholder.addEventListener('input', (e) => {
            if (e.target.classList.contains('habit-input')) {
                e.stopPropagation();
                const habitId = e.target.dataset.habitId;
                const value = parseFloat(e.target.value) || 0;
                
                // Handle historical date context for day widget
                const habitDate = e.target.dataset.habitDate;
                const dateToUpdate = habitDate ? new Date(habitDate + 'T00:00:00') : new Date();
                
                updateHabitValue(habitId, value, dateToUpdate);
                
                // Update progress bar
                const progressBar = e.target.closest('.habit-item').querySelector('.habit-progress-fill');
                const progressText = e.target.closest('.habit-item').querySelector('.habit-progress-text');
                if (progressBar && progressText) {
                    const definitions = getHabitDefinitions();
                    const habit = definitions.find(h => h.id === habitId);
                    if (habit) {
                        const target = parseFloat(habit.target) || 1;
                        const percentage = Math.min(100, (value / target) * 100);
                        progressBar.style.width = percentage + '%';
                        progressText.textContent = `${value} / ${habit.target}`;
                    }
                }
                
                // Refresh the entire UI to update all widgets
                if (typeof renderApp === 'function') {
                    setTimeout(() => renderApp(), 0);
                }
            }
        });
        
        // Handle increment/decrement buttons and other click events
        placeholder.addEventListener('click', (e) => {
            // Always stop propagation for clicks inside the widget
            e.stopPropagation();
            
            if (e.target.classList.contains('habit-btn')) {
                const habitId = e.target.dataset.habitId;
                
                // Find the input relative to the clicked button instead of searching the whole placeholder
                const input = e.target.closest('.habit-controls').querySelector(`input[data-habit-id="${habitId}"]`);
                if (input) {
                    const currentValue = parseFloat(input.value) || 0;
                    const step = 1; // Use 1 as default step
                    const newValue = e.target.classList.contains('increase') ? 
                        currentValue + step : Math.max(0, currentValue - step);
                    input.value = newValue;
                    
                    // Handle historical date context for day widget
                    const habitDate = e.target.dataset.habitDate;
                    const dateToUpdate = habitDate ? new Date(habitDate + 'T00:00:00') : new Date();
                    
                    updateHabitValue(habitId, newValue, dateToUpdate);
                    
                    // Update progress bar
                    const progressBar = input.closest('.habit-item').querySelector('.habit-progress-fill');
                    const progressText = input.closest('.habit-item').querySelector('.habit-progress-text');
                    if (progressBar && progressText) {
                        const definitions = getHabitDefinitions();
                        const habit = definitions.find(h => h.id === habitId);
                        if (habit) {
                            const target = parseFloat(habit.target) || 1;
                            const percentage = Math.min(100, (newValue / target) * 100);
                            progressBar.style.width = percentage + '%';
                            progressText.textContent = `${newValue} / ${habit.target}`;
                        }
                    }
                    
                    // Refresh the entire UI to update all widgets
                    if (typeof renderApp === 'function') {
                        setTimeout(() => renderApp(), 0);
                    }
                }
            }
            
            // Handle add habit button
            else if (e.target.closest('.habit-add-button')) {
                showHabitModal();
            }
            
            // Handle filter button
            else if (e.target.closest('.habit-filter-button')) {
                const button = e.target.closest('.habit-filter-button');
                const currentPeriod = button.getAttribute('data-current-period');
                const habitName = button.getAttribute('data-habit-name');
                console.log('Filter button clicked:');
                console.log('- Button element:', button);
                console.log('- Current period:', currentPeriod);
                console.log('- Habit name:', habitName);
                console.log('- Button classes:', button.className);
                
                // Find the specific widget that contains this button
                const widgetElement = button.closest('.habit-widget');
                console.log('- Widget element from button:', widgetElement);
                console.log('- Widget classes:', widgetElement ? widgetElement.className : 'null');
                
                showFilterModal(currentPeriod, habitName, widgetElement);
            }
            
            // Handle toggle visibility button for define widget
            else if (e.target.closest('.habit-toggle-visibility-button')) {
                const defineWidget = placeholder.querySelector('.define-widget');
                if (defineWidget) {
                    const isHidden = defineWidget.style.display === 'none';
                    defineWidget.style.display = isHidden ? 'block' : 'none';
                }
            }
            
            // Handle remove habit button
            else if (e.target.closest('.habit-remove-btn')) {
                const button = e.target.closest('.habit-remove-btn');
                const habitId = button.dataset.habitId;
                if (habitId) {
                    showCustomConfirm('Are you sure you want to remove this habit?', () => {
                        removeHabit(habitId);
                    });
                }
            }
            
            // Handle day navigation buttons
            else if (e.target.closest('.habit-nav-btn') || e.target.closest('.habit-today-btn')) {
                const button = e.target.closest('.habit-nav-btn') || e.target.closest('.habit-today-btn');
                const navDate = button.dataset.navDate;
                if (navDate) {
                    updateDayWidgetDate(navDate);
                }
            }
            
            // Handle date picker button
            else if (e.target.closest('.habit-date-picker-button')) {
                const button = e.target.closest('.habit-date-picker-button');
                const currentDate = button.dataset.currentDate;
                showDatePickerModal(currentDate);
            }
            
            // Handle mark all complete button
            else if (e.target.closest('.habit-mark-all-btn')) {
                const button = e.target.closest('.habit-mark-all-btn');
                const dateStr = button.getAttribute('data-date');
                showCustomConfirm('Mark all remaining habits as complete for this day?', () => {
                    markAllHabitsComplete(dateStr);
                });
            }
            
            // Handle grid range buttons
            else if (e.target.closest('.habit-grid-range-btn')) {
                const button = e.target.closest('.habit-grid-range-btn');
                const newRange = button.dataset.range;
                
                if (newRange && !button.classList.contains('active')) {
                    // Update the command and trigger re-render
                    updateGridWidgetPeriod(newRange);
                }
            }
            
            // Handle grid density toggle
            else if (e.target.closest('.habit-grid-density-btn')) {
                const button = e.target.closest('.habit-grid-density-btn');
                const gridWidget = button.closest('.habit-widget.grid');
                if (gridWidget) {
                    const isCompact = gridWidget.classList.contains('compact');
                    gridWidget.classList.toggle('compact', !isCompact);
                    
                    // Update button text
                    const textNode = button.childNodes[button.childNodes.length - 1];
                    if (textNode && textNode.nodeType === Node.TEXT_NODE) {
                        textNode.textContent = isCompact ? ' Compact' : ' Detailed';
                    }
                }
            }
            
            // Handle achievement tab switching
            else if (e.target.closest('.achievement-tab')) {
                const tabButton = e.target.closest('.achievement-tab');
                const targetTab = tabButton.dataset.tab;
                const widget = tabButton.closest('.habit-widget.achievements');
                
                if (widget) {
                    // Update active tab button
                    const allTabs = widget.querySelectorAll('.achievement-tab');
                    allTabs.forEach(tab => tab.classList.remove('active'));
                    tabButton.classList.add('active');
                    
                    // Update active content
                    const allContent = widget.querySelectorAll('.achievement-tab-content');
                    allContent.forEach(content => content.classList.remove('active'));
                    const targetContent = widget.querySelector(`[data-content="${targetTab}"]`);
                    if (targetContent) {
                        targetContent.classList.add('active');
                    }
                }
            }
            
            // Handle category habits list toggle
            else if (e.target.closest('.category-habits-toggle') || e.target.closest('.category-habits-header')) {
                const toggleButton = e.target.closest('.category-habits-toggle') || e.target.closest('.category-habits-header').querySelector('.category-habits-toggle');
                const category = toggleButton.dataset.category;
                const habitsList = placeholder.querySelector(`.category-habits-list[data-category="${category}"]`);
                
                if (habitsList) {
                    const isExpanded = habitsList.classList.contains('expanded');
                    habitsList.classList.toggle('expanded', !isExpanded);
                    
                    // Rotate the toggle icon
                    const icon = toggleButton.querySelector('svg');
                    if (icon) {
                        icon.style.transform = isExpanded ? 'rotate(0deg)' : 'rotate(180deg)';
                    }
                }
            }
        });
    }
    
    // --- HABIT MANAGEMENT FUNCTIONS ---
    
    function showCustomConfirm(message, onConfirm) {
        // Create confirm modal HTML
        const modalHTML = `
            <div class="modal-overlay active" id="habit-confirm-modal-overlay">
                <div class="modal">
                    <div class="modal-header">
                        <h3>Confirm Action</h3>
                        <button class="modal-close" id="habit-confirm-modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="modal-message">${message}</div>
                        <div class="modal-footer">
                            <button type="button" class="btn-secondary" id="habit-confirm-cancel-btn">Cancel</button>
                            <button type="button" class="btn-primary" id="habit-confirm-ok-btn">OK</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Add event listeners
        const modal = document.getElementById('habit-confirm-modal-overlay');
        const closeBtn = document.getElementById('habit-confirm-modal-close');
        const cancelBtn = document.getElementById('habit-confirm-cancel-btn');
        const okBtn = document.getElementById('habit-confirm-ok-btn');
        
        // Close modal handlers
        const closeModal = () => {
            modal.remove();
        };
        
        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        
        // OK button handler
        okBtn.addEventListener('click', () => {
            closeModal();
            if (onConfirm) onConfirm();
        });
        
        // Focus on OK button
        okBtn.focus();
    }
    
    function showHabitModal() {
        // Create modal HTML
        const modalHTML = `
            <div class="modal-overlay active" id="habit-modal-overlay">
                <div class="modal">
                    <div class="modal-header">
                        <h3>Add New Habit</h3>
                        <button class="modal-close" id="habit-modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="habit-form" class="habit-form">
                            <div class="habit-form-group">
                                <label for="habit-name">Habit Name:</label>
                                <input type="text" id="habit-name" name="habitName" required placeholder="e.g. Exercise, Meditate, Read">
                            </div>
                            
                            <div class="habit-form-group">
                                <label for="habit-category">Category:</label>
                                <select id="habit-category" name="habitCategory">
                                    <option value="General">General</option>
                                    <option value="Health">Health</option>
                                    <option value="Learning">Learning</option>
                                    <option value="Work">Work</option>
                                    <option value="Personal">Personal</option>
                                    <option value="Creative">Creative</option>
                                    <option value="Fitness">Fitness</option>
                                    <option value="Wellness">Wellness</option>
                                    <option value="Finance">Finance</option>
                                    <option value="Social">Social</option>
                                    <option value="Hobbies">Hobbies</option>
                                    <option value="custom">Custom category...</option>
                                </select>
                            </div>
                            
                            <div id="custom-category-group" class="habit-form-group" style="display: none;">
                                <label for="custom-category-input">Custom Category:</label>
                                <input type="text" id="custom-category-input" name="customCategory" placeholder="Enter category name">
                            </div>
                            
                            <div class="habit-form-group">
                                <label>Habit Type:</label>
                                <div class="habit-type-selection">
                                    <label>
                                        <input type="radio" id="habit-type-binary" name="habitType" value="binary" checked>
                                        Binary (Yes/No)
                                    </label>
                                    <label>
                                        <input type="radio" id="habit-type-quantified" name="habitType" value="quantified">
                                        Quantified (With Target)
                                    </label>
                                </div>
                            </div>
                            
                            <div id="target-group" class="habit-form-group" style="display: none;">
                                <label for="habit-target">Target:</label>
                                <input type="text" id="habit-target" name="habitTarget" placeholder="e.g. 8 glasses, 30 minutes, 10000 steps">
                            </div>
                            
                            <div class="habit-form-group">
                                <label for="habit-goal">Goal (Optional):</label>
                                <select id="habit-goal" name="habitGoal">
                                    <option value="">No goal</option>
                                    <option value="every day">Every day</option>
                                    <option value="3 times per week">3 times per week</option>
                                    <option value="4 times per week">4 times per week</option>
                                    <option value="5 times per week">5 times per week</option>
                                    <option value="10 times per month">10 times per month</option>
                                    <option value="15 times per month">15 times per month</option>
                                    <option value="20 times per month">20 times per month</option>
                                    <option value="7 days in a row">7 day streak</option>
                                    <option value="14 days in a row">14 day streak</option>
                                    <option value="30 days in a row">30 day streak</option>
                                    <option value="custom">Custom goal...</option>
                                </select>
                            </div>
                            
                            <div id="custom-goal-group" class="habit-form-group" style="display: none;">
                                <label for="custom-goal-input">Custom Goal:</label>
                                <input type="text" id="custom-goal-input" name="customGoal" placeholder="e.g. 6 times per week, 25 times per month, 10 days in a row">
                            </div>
                            
                            <div class="habit-form-group">
                                <label for="habit-achievement">Achievement (Optional):</label>
                                <select id="habit-achievement" name="habitAchievement">
                                    <option value="">No achievement</option>
                                    <option value="7 day streak = Movie night">7 day streak = Movie night</option>
                                    <option value="30 day streak = New book">30 day streak = New book</option>
                                    <option value="50 completions = Treat myself">50 completions = Treat myself</option>
                                    <option value="100 completions = Big reward">100 completions = Big reward</option>
                                    <option value="perfect week = Weekend fun">Perfect week = Weekend fun</option>
                                    <option value="perfect month = Spa day">Perfect month = Spa day</option>
                                    <option value="custom">Custom achievement...</option>
                                </select>
                            </div>
                            
                            <div id="custom-achievement-group" class="habit-form-group" style="display: none;">
                                <label for="custom-achievement-input">Custom Achievement:</label>
                                <input type="text" id="custom-achievement-input" name="customAchievement" placeholder="e.g. 14 day streak = New equipment">
                                <small class="form-help">Format: [trigger] = [reward]. Examples: "10 day streak = Pizza night", "25 completions = New gear"</small>
                            </div>
                            
                            <div class="habit-form-group">
                                <label for="habit-schedule">Schedule:</label>
                                <select id="habit-schedule" name="habitSchedule">
                                    <option value="everyday">Every day</option>
                                    <option value="weekdays">Weekdays (Mon-Fri)</option>
                                    <option value="weekends">Weekends (Sat-Sun)</option>
                                    <option value="custom">Custom days...</option>
                                </select>
                            </div>
                            
                            <div id="custom-schedule-group" class="habit-form-group" style="display: none;">
                                <label>Select days:</label>
                                <div class="custom-days-selection">
                                    <label><input type="checkbox" name="customDays" value="mon"> Monday</label>
                                    <label><input type="checkbox" name="customDays" value="tue"> Tuesday</label>
                                    <label><input type="checkbox" name="customDays" value="wed"> Wednesday</label>
                                    <label><input type="checkbox" name="customDays" value="thu"> Thursday</label>
                                    <label><input type="checkbox" name="customDays" value="fri"> Friday</label>
                                    <label><input type="checkbox" name="customDays" value="sat"> Saturday</label>
                                    <label><input type="checkbox" name="customDays" value="sun"> Sunday</label>
                                </div>
                            </div>
                            
                            <div class="modal-footer">
                                <button type="button" class="btn-secondary" id="habit-cancel-btn">Cancel</button>
                                <button type="submit" class="btn-primary">Add Habit</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Add event listeners
        const modal = document.getElementById('habit-modal-overlay');
        const form = document.getElementById('habit-form');
        const closeBtn = document.getElementById('habit-modal-close');
        const cancelBtn = document.getElementById('habit-cancel-btn');
        const typeRadios = document.querySelectorAll('input[name="habitType"]');
        const targetGroup = document.getElementById('target-group');
        const scheduleSelect = document.getElementById('habit-schedule');
        const customScheduleGroup = document.getElementById('custom-schedule-group');
        const categorySelect = document.getElementById('habit-category');
        const customCategoryGroup = document.getElementById('custom-category-group');
        const goalSelect = document.getElementById('habit-goal');
        const customGoalGroup = document.getElementById('custom-goal-group');
        const achievementSelect = document.getElementById('habit-achievement');
        const customAchievementGroup = document.getElementById('custom-achievement-group');
        
        // Show/hide target input based on type selection
        typeRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                targetGroup.style.display = radio.value === 'quantified' ? 'block' : 'none';
            });
        });
        
        // Show/hide custom schedule selection
        scheduleSelect.addEventListener('change', () => {
            customScheduleGroup.style.display = scheduleSelect.value === 'custom' ? 'block' : 'none';
        });
        
        // Show/hide custom category input
        categorySelect.addEventListener('change', () => {
            customCategoryGroup.style.display = categorySelect.value === 'custom' ? 'block' : 'none';
        });
        
        // Show/hide custom goal input
        goalSelect.addEventListener('change', () => {
            customGoalGroup.style.display = goalSelect.value === 'custom' ? 'block' : 'none';
        });
        
        // Show/hide custom achievement input
        achievementSelect.addEventListener('change', () => {
            customAchievementGroup.style.display = achievementSelect.value === 'custom' ? 'block' : 'none';
        });
        
        // Close modal handlers
        const closeModal = () => {
            modal.remove();
        };
        
        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        
        // Form submission
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const habitName = formData.get('habitName').trim();
            const habitType = formData.get('habitType');
            const habitTarget = formData.get('habitTarget').trim();
            const habitSchedule = formData.get('habitSchedule');
            const habitCategory = formData.get('habitCategory');
            const customCategory = formData.get('customCategory');
            const habitGoal = formData.get('habitGoal');
            const customGoal = formData.get('customGoal');
            const habitAchievement = formData.get('habitAchievement');
            const customAchievement = formData.get('customAchievement');
            
            if (!habitName) {
                alert('Please enter a habit name');
                return;
            }
            
            if (habitType === 'quantified' && !habitTarget) {
                alert('Please enter a target for quantified habits');
                return;
            }
            
            // Determine final category
            let finalCategory = 'General';
            if (habitCategory === 'custom') {
                if (customCategory && customCategory.trim()) {
                    finalCategory = customCategory.trim();
                } else {
                    alert('Please enter a custom category name');
                    return;
                }
            } else if (habitCategory) {
                finalCategory = habitCategory;
            }
            
            // Determine final goal
            let finalGoal = null;
            if (habitGoal === 'custom') {
                if (customGoal && customGoal.trim()) {
                    finalGoal = customGoal.trim();
                } else {
                    alert('Please enter a custom goal');
                    return;
                }
            } else if (habitGoal) {
                finalGoal = habitGoal;
            }
            
            // Determine final achievement
            let finalAchievement = null;
            if (habitAchievement === 'custom') {
                if (customAchievement && customAchievement.trim()) {
                    finalAchievement = customAchievement.trim();
                } else {
                    alert('Please enter a custom achievement');
                    return;
                }
            } else if (habitAchievement) {
                finalAchievement = habitAchievement;
            }
            
            // Build schedule string
            let scheduleString = '';
            if (habitSchedule === 'custom') {
                const selectedDays = Array.from(form.querySelectorAll('input[name="customDays"]:checked'))
                    .map(cb => cb.value);
                
                if (selectedDays.length === 0) {
                    alert('Please select at least one day for custom schedule');
                    return;
                }
                
                scheduleString = selectedDays.join(', ');
            } else {
                scheduleString = habitSchedule;
            }
            
            // Add the new habit
            addNewHabitWithSchedule(habitName, habitType, habitTarget, scheduleString, finalCategory, finalGoal, finalAchievement);
            closeModal();
        });
        
        // Focus on the name input
        document.getElementById('habit-name').focus();
    }
    
    function showFilterModal(currentPeriod, habitName, widgetElement) {
        const periodOptions = [
            { value: 'last-7-days', label: 'Last 7 Days' },
            { value: 'last-30-days', label: 'Last 30 Days' },
            { value: 'last-90-days', label: 'Last 90 Days' },
            { value: 'last-180-days', label: 'Last 180 Days' },
            { value: 'last-365-days', label: 'Last 365 Days' },
            { value: 'this-week', label: 'This Week' },
            { value: 'this-month', label: 'This Month' },
            { value: 'last-three-months', label: 'Last 3 Months' },
            { value: 'last-six-months', label: 'Last 6 Months' },
            { value: 'this-year', label: 'This Year' }
        ];
        
        const optionsHTML = periodOptions.map(option => 
            `<div class="filter-option ${option.value === currentPeriod ? 'selected' : ''}" data-value="${option.value}">
                ${option.label}
            </div>`
        ).join('');
        
        const modalHTML = `
            <div class="modal-overlay active" id="habit-filter-modal-overlay">
                <div class="modal">
                    <div class="modal-header">
                        <h3>Change Time Period</h3>
                        <button class="modal-close" id="habit-filter-modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="filter-options">
                            ${optionsHTML}
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn-secondary" id="habit-filter-cancel-btn">Cancel</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Add event listeners
        const modal = document.getElementById('habit-filter-modal-overlay');
        const closeBtn = document.getElementById('habit-filter-modal-close');
        const cancelBtn = document.getElementById('habit-filter-cancel-btn');
        const filterOptions = modal.querySelectorAll('.filter-option');
        
        // Close modal handlers
        const closeModal = () => {
            modal.remove();
        };
        
        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        
        // Filter option selection
        filterOptions.forEach(option => {
            option.addEventListener('click', () => {
                const newPeriod = option.dataset.value;
                console.log('Filter option selected:');
                console.log('- Current period:', currentPeriod);
                console.log('- New period:', newPeriod);
                console.log('- Habit name:', habitName);
                console.log('- Widget element:', widgetElement);
                updateWidgetPeriod(currentPeriod, newPeriod, habitName, widgetElement);
                closeModal();
            });
        });
    }
    
    function updateWidgetPeriod(oldPeriod, newPeriod, habitName, widgetElement) {
        console.log('=== updateWidgetPeriod DEBUG ===');
        console.log('oldPeriod:', oldPeriod);
        console.log('newPeriod:', newPeriod);
        console.log('habitName:', habitName);
        console.log('widgetElement passed:', widgetElement);
        
        if (!placeholder || !onCommandChange) {
            console.log('Missing placeholder or onCommandChange');
            return;
        }
        
        const pageWrapper = placeholder.closest('[data-key]');
        if (!pageWrapper) {
            console.log('No pageWrapper found');
            return;
        }
        
        const key = pageWrapper.dataset.key;
        const content = getStorage(key);
        console.log('Storage key:', key);
        console.log('Original content:', content);
        
        if (!content) {
            console.log('No content found');
            return;
        }
        
        // Determine widget type from the passed widget element
        const widgetType = widgetElement && widgetElement.classList.contains('grid') ? 'grid' :
                          widgetElement && widgetElement.classList.contains('stats') ? 'stats' :
                          widgetElement && widgetElement.classList.contains('chart') ? 'chart' : null;
        
        console.log('Widget element classes:', widgetElement ? widgetElement.className : 'null');
        console.log('Widget type detected:', widgetType);
        
        if (!widgetType) {
            console.log('No widget type detected');
            return;
        }
        
        let updatedContent = content;
        
        // Update the specific widget instance using global replace like chart widgets
        if (habitName && widgetType === 'chart') {
            // For chart widgets (with habit name)
            const chartRegex = new RegExp(`HABITS:\\s*chart,\\s*${habitName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')},\\s*${oldPeriod.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi');
            console.log('Chart regex:', chartRegex);
            const matches = content.match(chartRegex);
            console.log('Chart matches found:', matches);
            updatedContent = updatedContent.replace(chartRegex, `HABITS: chart, ${habitName}, ${newPeriod}`);
        } else {
            // For grid and stats widgets, handle both with and without explicit periods
            let widgetRegex, replacement;
            
            // First try to match widget with explicit period
            widgetRegex = new RegExp(`HABITS:\\s*${widgetType},\\s*${oldPeriod.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi');
            console.log(`${widgetType} regex (with period):`, widgetRegex);
            let matches = content.match(widgetRegex);
            console.log(`${widgetType} matches found (with period):`, matches);
            
            if (matches && matches.length > 0) {
                // Found widget with explicit period, replace it
                replacement = `HABITS: ${widgetType}, ${newPeriod}`;
                updatedContent = updatedContent.replace(widgetRegex, replacement);
            } else {
                // Try to match widget without explicit period
                widgetRegex = new RegExp(`HABITS:\\s*${widgetType}(?!,)`, 'gi');
                console.log(`${widgetType} regex (without period):`, widgetRegex);
                matches = content.match(widgetRegex);
                console.log(`${widgetType} matches found (without period):`, matches);
                
                if (matches && matches.length > 0) {
                    // Found widget without explicit period, add the period
                    replacement = `HABITS: ${widgetType}, ${newPeriod}`;
                    updatedContent = updatedContent.replace(widgetRegex, replacement);
                }
            }
        }
        
        console.log('Updated content:', updatedContent);
        console.log('Content changed:', content !== updatedContent);
        
        // Save updated content
        setStorage(key, updatedContent);
        
        // Sync to cloud
        if (typeof debouncedSyncWithCloud === 'function') {
            debouncedSyncWithCloud();
        }
        
        // Trigger full page re-render
        if (typeof renderApp === 'function') {
            setTimeout(() => renderApp(), 0);
        }
        
        console.log('=== END DEBUG ===');
    }
    
    function addNewHabitWithSchedule(name, type, target = null, scheduleString = 'everyday', category = 'General', goalString = null, achievementString = null) {
        const currentDefinitions = getHabitDefinitions();
        
        // Check for duplicate names
        if (currentDefinitions.some(h => h.name === name)) {
            alert('A habit with this name already exists');
            return;
        }
        
        const newHabit = {
            name,
            type,
            id: generateHabitId(name),
            schedule: parseScheduleString(scheduleString),
            category
        };
        
        if (type === 'quantified') {
            newHabit.target = target;
        }
        
        if (goalString) {
            const goal = parseGoalString(goalString);
            if (goal) {
                newHabit.goal = goal;
            }
        }
        
        if (achievementString) {
            const achievement = parseAchievementString(achievementString);
            if (achievement) {
                newHabit.achievement = achievement;
            }
        }
        
        // Add to current definitions
        currentDefinitions.push(newHabit);
        saveHabitDefinitions(currentDefinitions);
        
        // Update the page content to include the new habit
        updatePageContentWithNewHabitSchedule(newHabit, scheduleString, category, goalString, achievementString);
        
        // Force a complete page re-render to show the changes
        if (typeof renderApp === 'function') {
            setTimeout(() => {
                renderApp();
            }, 100);
        }
    }
    
    function addNewHabit(name, type, target = null) {
        const currentDefinitions = getHabitDefinitions();
        
        // Check for duplicate names
        if (currentDefinitions.some(h => h.name === name)) {
            alert('A habit with this name already exists');
            return;
        }
        
        const newHabit = {
            name,
            type,
            id: generateHabitId(name)
        };
        
        if (type === 'quantified') {
            newHabit.target = target;
        }
        
        // Add to current definitions
        currentDefinitions.push(newHabit);
        saveHabitDefinitions(currentDefinitions);
        
        // Update the page content to include the new habit
        updatePageContentWithNewHabit(newHabit);
        
        // Force a complete page re-render to show the changes
        if (typeof renderApp === 'function') {
            setTimeout(() => {
                renderApp();
            }, 100);
        }
    }
    
    function removeHabit(habitId) {
        const currentDefinitions = getHabitDefinitions();
        const habitToRemove = currentDefinitions.find(h => h.id === habitId);
        
        if (!habitToRemove) {
            console.log(`❌ Habit with ID "${habitId}" not found`);
            return;
        }
        
        console.log(`🗑️ Removing habit: "${habitToRemove.name}"`);
        
        // Remove the habit line from the page content (single source of truth)
        updatePageContentRemoveHabitByName(habitToRemove.name);
        
        // Force a complete page re-render to trigger parsing and cleanup
        if (typeof renderApp === 'function') {
            setTimeout(() => {
                renderApp();
            }, 100);
        } else {
            // Fallback: manually trigger parsing and cleanup
            setTimeout(() => {
                if (placeholder) {
                    const pageWrapper = placeholder.closest('[data-key]');
                    if (pageWrapper) {
                        const key = pageWrapper.dataset.key;
                        const content = getStorage(key);
                        if (content) {
                            const definitions = parseHabitDefinitions(content);
                            saveHabitDefinitions(definitions);
                            
                            // Re-render the current widget
                            const event = new CustomEvent('widget-update');
                            placeholder.dispatchEvent(event);
                        }
                    }
                }
            }, 100);
        }
    }
    
    function markAllHabitsComplete(dateStr) {
        // Use the provided date string, fallback to today if not provided
        const currentDateStr = dateStr || formatDate(new Date());
        const selectedDate = new Date(currentDateStr + 'T00:00:00');
        
        const definitions = getHabitDefinitions();
        const dayHabits = definitions.filter(habit => isHabitScheduledForDate(habit, selectedDate));
        const dayData = getHabitData(selectedDate);
        
        let updatedCount = 0;
        
        // Mark all incomplete habits as complete
        dayHabits.forEach(habit => {
            const currentValue = dayData[habit.id] || (habit.type === 'binary' ? false : 0);
            if (habit.type === 'binary' && !currentValue) {
                updateHabitValue(habit.id, true, selectedDate);
                updatedCount++;
            } else if (habit.type === 'quantified' || habit.type === 'numeric') {
                const target = parseFloat(habit.target) || 1;
                if (currentValue < target) {
                    updateHabitValue(habit.id, target, selectedDate);
                    updatedCount++;
                }
            }
        });
        
        // Show notification
        if (updatedCount > 0) {
            // Create success notification
            const notification = document.createElement('div');
            notification.className = 'habit-notification success';
            notification.innerHTML = `
                <div class="habit-notification-content">
                    <div class="habit-notification-icon">🎉</div>
                    <div class="habit-notification-message">
                        Completed ${updatedCount} habit${updatedCount === 1 ? '' : 's'}!
                    </div>
                </div>
            `;
            document.body.appendChild(notification);
            setTimeout(() => {
                notification.remove();
            }, 3000);
            // Force re-render to update the progress
            if (typeof renderApp === 'function') {
                setTimeout(() => {
                    renderApp();
                }, 100);
            }
        }
    }
    
    // --- GRID WIDGET FUNCTIONS ---
    
    function toggleGridDensity() {
        const gridWidget = placeholder.querySelector('.habit-widget.grid');
        if (!gridWidget) return;
        
        const isCompact = gridWidget.classList.contains('compact');
        gridWidget.classList.toggle('compact', !isCompact);
        
        // Update button text
        const densityBtn = gridWidget.querySelector('.habit-grid-density-btn');
        if (densityBtn) {
            const textSpan = densityBtn.lastChild;
            if (textSpan && textSpan.nodeType === Node.TEXT_NODE) {
                textSpan.textContent = isCompact ? 'Compact' : 'Detailed';
            }
        }
    }
    
    function exportGridAsImage() {
        const gridElement = placeholder.querySelector('.habit-grid');
        if (!gridElement) return;
        
        // Create notification
        const notification = document.createElement('div');
        notification.className = 'habit-notification';
        notification.innerHTML = `
            <div class="habit-notification-content">
                <div class="habit-notification-icon">📸</div>
                <div class="habit-notification-message">
                    Grid exported! Check your downloads folder.
                </div>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Remove notification after 3 seconds
        setTimeout(() => {
            notification.remove();
        }, 3000);
        
        // Note: For a complete implementation, you would use a library like html2canvas
        // to actually capture and download the grid as an image
        console.log('🎯 Grid export feature - would implement with html2canvas library');
    }
    
    function updatePageContentWithNewHabitSchedule(newHabit, scheduleString, category = 'General', goalString = null, achievementString = null) {
        if (!placeholder) return;
        
        const pageWrapper = placeholder.closest('[data-key]');
        if (!pageWrapper) return;
        
        const key = pageWrapper.dataset.key;
        const content = getStorage(key);
        if (!content) return;
        
        // Find HABITS: define block and add the new habit
        const lines = content.split('\n');
        let updatedContent = content;
        
        // Look for existing HABITS: define block
        let defineBlockIndex = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim().match(/^HABITS:\s*define$/i)) {
                defineBlockIndex = i;
                break;
            }
        }
        
        if (defineBlockIndex !== -1) {
            // Find the end of the definition block
            let insertIndex = defineBlockIndex + 1;
            while (insertIndex < lines.length && lines[insertIndex].trim().startsWith('- ')) {
                insertIndex++;
            }
            
            // Build habit line with category, target, goal, achievement, and schedule
            let habitLine = `- ${newHabit.name}`;
            
            if (category !== 'General') {
                habitLine += ` (CATEGORY: ${category})`;
            }
            
            if (newHabit.type === 'quantified') {
                habitLine += ` (TARGET: ${newHabit.target})`;
            }
            
            if (goalString) {
                habitLine += ` (GOAL: ${goalString})`;
            }
            
            if (achievementString) {
                habitLine += ` (ACHIEVEMENT: ${achievementString})`;
            }
            
            if (scheduleString !== 'everyday') {
                habitLine += ` (SCHEDULE: ${scheduleString})`;
            }
            
            lines.splice(insertIndex, 0, habitLine);
            updatedContent = lines.join('\n');
        } else {
            // Create a new HABITS: define block at the end
            let habitLine = `- ${newHabit.name}`;
            
            if (category !== 'General') {
                habitLine += ` (CATEGORY: ${category})`;
            }
            
            if (newHabit.type === 'quantified') {
                habitLine += ` (TARGET: ${newHabit.target})`;
            }
            
            if (goalString) {
                habitLine += ` (GOAL: ${goalString})`;
            }
            
            if (achievementString) {
                habitLine += ` (ACHIEVEMENT: ${achievementString})`;
            }
            
            if (scheduleString !== 'everyday') {
                habitLine += ` (SCHEDULE: ${scheduleString})`;
            }
            
            updatedContent += `\n\nHABITS: define\n${habitLine}`;
        }
        
        // Save updated content
        setStorage(key, updatedContent);
        
        // Sync to cloud
        if (typeof debouncedSyncWithCloud === 'function') {
            debouncedSyncWithCloud();
        }
    }
    
    function updatePageContentWithNewHabit(newHabit) {
        if (!placeholder) return;
        
        const pageWrapper = placeholder.closest('[data-key]');
        if (!pageWrapper) return;
        
        const key = pageWrapper.dataset.key;
        const content = getStorage(key);
        if (!content) return;
        
        // Find HABITS: define block and add the new habit
        const lines = content.split('\n');
        let updatedContent = content;
        
        // Look for existing HABITS: define block
        let defineBlockIndex = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim().match(/^HABITS:\s*define$/i)) {
                defineBlockIndex = i;
                break;
            }
        }
        
        if (defineBlockIndex !== -1) {
            // Find the end of the definition block
            let insertIndex = defineBlockIndex + 1;
            while (insertIndex < lines.length && lines[insertIndex].trim().startsWith('- ')) {
                insertIndex++;
            }
            
            // Insert the new habit
            const habitLine = newHabit.type === 'quantified' 
                ? `- ${newHabit.name} (TARGET: ${newHabit.target})`
                : `- ${newHabit.name}`;
            
            lines.splice(insertIndex, 0, habitLine);
            updatedContent = lines.join('\n');
        } else {
            // Create a new HABITS: define block at the end
            const habitLine = newHabit.type === 'quantified' 
                ? `- ${newHabit.name} (TARGET: ${newHabit.target})`
                : `- ${newHabit.name}`;
            
            updatedContent += `\n\nHABITS: define\n${habitLine}`;
        }
        
        // Save updated content
        setStorage(key, updatedContent);
        
        // Sync to cloud
        if (typeof debouncedSyncWithCloud === 'function') {
            debouncedSyncWithCloud();
        }
    }
    
    function updatePageContentRemoveHabitByName(habitName) {
        if (!placeholder) return;
        
        const pageWrapper = placeholder.closest('[data-key]');
        if (!pageWrapper) return;
        
        const key = pageWrapper.dataset.key;
        const content = getStorage(key);
        if (!content) return;
        
        const lines = content.split('\n');
        let updatedLines = [];
        let foundAndRemoved = false;
        
        for (const line of lines) {
            // Skip lines that match this habit
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('- ')) {
                const habitText = trimmedLine.substring(2).trim();
                
                // Parse the habit line to get the clean name (same logic as parseHabitLine)
                let habitName_clean = habitText;
                
                // Remove all patterns to get the clean habit name
                habitName_clean = habitName_clean.replace(/\(TARGET:\s*[^)]+\)/gi, '').trim();
                habitName_clean = habitName_clean.replace(/\(CATEGORY:\s*[^)]+\)/gi, '').trim();
                habitName_clean = habitName_clean.replace(/\(GOAL:\s*[^)]+\)/gi, '').trim();
                habitName_clean = habitName_clean.replace(/\(ACHIEVEMENT:\s*[^)]+\)/gi, '').trim();
                habitName_clean = habitName_clean.replace(/\(SCHEDULE:\s*[^)]+\)/gi, '').trim();
                
                console.log(`Comparing: "${habitName_clean}" === "${habitName}"`);
                
                if (habitName_clean === habitName) {
                    foundAndRemoved = true;
                    console.log(`✅ Removing habit line: ${trimmedLine}`);
                    continue; // Skip this line (don't add it to updatedLines)
                }
            }
            updatedLines.push(line);
        }
        
        if (foundAndRemoved) {
            const updatedContent = updatedLines.join('\n');
            
            // Save updated content
            setStorage(key, updatedContent);
            console.log('✅ Page content updated, habit line removed');
            
            // Trigger cloud sync if available
            if (typeof debouncedSyncWithCloud === 'function') {
                debouncedSyncWithCloud();
            }
        } else {
            console.log(`❌ Habit "${habitName}" not found in page content`);
        }
    }
    
    // --- MAIN INITIALIZATION ---
    
    function init(options) {
        const currentPlaceholder = options.placeholder;
        
        // Allow re-initialization if this is a re-render after data changes
        const isReInitialization = currentPlaceholder.classList.contains('habit-initialized');
        if (isReInitialization) {
            
            // Remove the old class and content to allow fresh rendering
            currentPlaceholder.classList.remove('habit-initialized');
            currentPlaceholder.innerHTML = '';
        }
        
        currentPlaceholder.classList.add('habit-initialized');
        
        // Now assign to global variables after validation
        placeholder = currentPlaceholder;
        onCommandChange = options.onCommandChange;
        
        const command = options.command || 'HABITS: today';
        
        const config = parseCommand(command);
        
        // Only parse and save habit definitions if we encounter a define command
        if (config.type === 'define') {
            const pageWrapper = placeholder.closest('[data-key]');
            if (pageWrapper) {
                const key = pageWrapper.dataset.key;
                const content = getStorage(key);
                if (content) {
                    const definitions = parseHabitDefinitions(content);
                    if (definitions.length > 0) {
                        // Clean up orphaned data before saving new definitions
                        cleanupOrphanedHabitData(definitions);
                        
                        habitDefinitions = definitions;
                        saveHabitDefinitions(definitions);
                    } else {
                        // If no habits are defined, clean up all data
                        cleanupOrphanedHabitData([]);
                        habitDefinitions = [];
                        saveHabitDefinitions([]);
                    }
                }
            }
            // For define commands, render a hidden widget by default
            placeholder.innerHTML = `<div class="habit-widget define-widget" style="display: none;">
                <div class="habit-header">
                    <div class="habit-header-content">
                        <h3>📋 Habit Definitions</h3>
                        <div class="habit-help">
                            <span>✅ ${habitDefinitions.length} habit(s) defined successfully!</span>
                            <br><br>
                            <strong>Defined habits:</strong><br>
                            ${habitDefinitions.map(h => `• ${h.name}${h.type === 'quantified' ? ` (Target: ${h.target})` : ''}`).join('<br>')}
                            <br><br>
                            <small style="color: #666;">💡 This widget is hidden by default. You can add habits using the "New Habit" button in other habit widgets.</small>
                        </div>
                    </div>
                    <div class="finance-widget-controls">
                        <button class="finance-add-button habit-add-button">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            New Habit
                        </button>
                        <button class="finance-add-button habit-toggle-visibility-button" style="margin-left: 0.5rem;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                            Show/Hide
                        </button>
                    </div>
                </div>
            </div>`;
            attachEventListeners();
            return;
        }
        
        // For other commands, load existing definitions
        const pageWrapper = placeholder.closest('[data-key]');
        if (pageWrapper) {
            const key = pageWrapper.dataset.key;
            const content = getStorage(key);
            if (content) {
                const definitions = parseHabitDefinitions(content);
                if (definitions.length > 0) {
                    habitDefinitions = definitions;
                          // Clean up orphaned data before saving
                cleanupOrphanedHabitData(definitions);
                    
                    saveHabitDefinitions(definitions);
                }
            }
        }
        
        // Render appropriate widget
        let html = '';
        switch (config.type) {
            case 'day':
                html = renderDayWidget(config.date);
                break;
            case 'grid':
                html = renderGridWidget(config.period);
                break;
            case 'stats':
                html = renderStatsWidget(config.period);
                break;
            case 'chart':
                html = renderChartWidget(config.habit, config.period);
                break;
            case 'categories':
                html = renderCategoriesWidget();
                break;
            case 'goals':
                html = renderGoalsWidget();
                break;
            case 'achievements':
                html = renderAchievementsWidget();
                break;
            default:
                // Default to day widget (today)
                html = renderDayWidget(null);
        }
        
        placeholder.innerHTML = html;
        attachEventListeners();
    }
    
    // --- DAY WIDGET NAVIGATION FUNCTIONS ---
    
    function updateDayWidgetDate(newDate) {
        if (!placeholder || !onCommandChange) return;
        
        const pageWrapper = placeholder.closest('[data-key]');
        if (!pageWrapper) return;
        
        const key = pageWrapper.dataset.key;
        const content = getStorage(key);
        if (!content) return;
        
        // Find and update HABITS: day command with new date
        let updatedContent = content;
        
        // Check if the new date is today's date
        const today = new Date();
        const todayStr = formatDate(today);
        const isToday = newDate === todayStr;
        
        // Look for existing HABITS: day command
        const dayRegex = /HABITS:\s*day(?:,\s*\d{4}-\d{2}-\d{2})?/gi;
        const matches = content.match(dayRegex);
        
        if (matches && matches.length > 0) {
            // If navigating to today, use simple "HABITS: day" without date
            // If navigating to another date, include the specific date
            const newCommand = isToday ? 'HABITS: day' : `HABITS: day, ${newDate}`;
            updatedContent = updatedContent.replace(dayRegex, newCommand);
        } else {
            // If no day widget found, append it
            const newCommand = isToday ? '\n\nHABITS: day' : `\n\nHABITS: day, ${newDate}`;
            updatedContent += newCommand;
        }
        
        // Save updated content
        setStorage(key, updatedContent);
        
        // Sync to cloud
        if (typeof debouncedSyncWithCloud === 'function') {
            debouncedSyncWithCloud();
        }
        
        // Trigger full page re-render
        if (typeof renderApp === 'function') {
            setTimeout(() => renderApp(), 0);
        } else {
            // Fallback: directly re-render the day widget if possible
            if (typeof renderDayWidget === 'function') {
                const dayWidgetContainer = document.querySelector('.habit-widget.day');
                if (dayWidgetContainer) {
                    dayWidgetContainer.innerHTML = renderDayWidget(newDate);
                }
            }
        }
    }
    
    function updateGridWidgetPeriod(newPeriod) {
        if (!placeholder || !onCommandChange) return;
        
        const pageWrapper = placeholder.closest('[data-key]');
        if (!pageWrapper) return;
        
        const key = pageWrapper.dataset.key;
        const content = getStorage(key);
        if (!content) return;
        
        // Find and update HABITS: grid command with new period
        let updatedContent = content;
        
        // Look for existing HABITS: grid command
        const gridRegex = /HABITS:\s*grid(?:,\s*[a-zA-Z0-9-]+)?/gi;
        const matches = content.match(gridRegex);
        
        if (matches && matches.length > 0) {
            // Update existing grid command with new period
            const newCommand = `HABITS: grid, ${newPeriod}`;
            updatedContent = updatedContent.replace(gridRegex, newCommand);
        } else {
            // If no grid widget found, append it
            const newCommand = `\n\nHABITS: grid, ${newPeriod}`;
            updatedContent += newCommand;
        }
        
        // Save updated content
        setStorage(key, updatedContent);
        
        // Sync to cloud
        if (typeof debouncedSyncWithCloud === 'function') {
            debouncedSyncWithCloud();
        }
        
        // Trigger full page re-render
        if (typeof renderApp === 'function') {
            setTimeout(() => renderApp(), 0);
        }
    }
    
    function showDatePickerModal(currentDate) {
        const modalHTML = `
            <div class="modal-overlay active" id="habit-date-picker-modal-overlay">
                <div class="modal">
                    <div class="modal-header">
                        <h3>Select Date</h3>
                        <button class="modal-close" id="habit-date-picker-modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="habit-form-group">
                            <label for="date-picker-input">Date:</label>
                            <input type="date" id="date-picker-input" value="${currentDate}" max="${formatDate(new Date())}">
                            <div class="date-picker-help">
                                <small>Select any date up to today to view historical habit data.</small>
                            </div>
                        </div>
                        <div class="date-picker-shortcuts">
                            <button type="button" class="btn-secondary date-shortcut" data-days-ago="1">Yesterday</button>
                            <button type="button" class="btn-secondary date-shortcut" data-days-ago="7">1 Week Ago</button>
                            <button type="button" class="btn-secondary date-shortcut" data-days-ago="30">1 Month Ago</button>
                            <button type="button" class="btn-secondary date-shortcut" data-days-ago="0">Today</button>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn-secondary" id="habit-date-picker-cancel-btn">Cancel</button>
                            <button type="button" class="btn-primary" id="habit-date-picker-ok-btn">Go to Date</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Add event listeners
        const modal = document.getElementById('habit-date-picker-modal-overlay');
        const closeBtn = document.getElementById('habit-date-picker-modal-close');
        const cancelBtn = document.getElementById('habit-date-picker-cancel-btn');
        const okBtn = document.getElementById('habit-date-picker-ok-btn');
        const dateInput = document.getElementById('date-picker-input');
        const shortcuts = modal.querySelectorAll('.date-shortcut');
        
        // Close modal handlers
        const closeModal = () => {
            modal.remove();
        };
        
        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        
        // Shortcut button handlers
        shortcuts.forEach(button => {
            button.addEventListener('click', () => {
                const daysAgo = parseInt(button.dataset.daysAgo);
                const targetDate = new Date();
                targetDate.setDate(targetDate.getDate() - daysAgo);
                dateInput.value = formatDate(targetDate);
            });
        });
        
        // OK button handler
        okBtn.addEventListener('click', () => {
            const selectedDate = dateInput.value;
            if (selectedDate) {
                updateDayWidgetDate(selectedDate);
                closeModal();
            }
        });
        
        // Focus on date input
        dateInput.focus();
    }
    
    // --- PUBLIC API ---
    
    return {
        init,
        parseHabitDefinitions,
        getHabitDefinitions,
        saveHabitDefinitions,
        getHabitData,
        updateHabitValue,
        getAllHabitData,
        deleteHabit,
        updateHabitDefinition,
        removeHabitDataCompletely,
        cleanupOrphanedHabitData
    }
})();

// Make it globally available
window.HabitTracker = HabitTracker;
