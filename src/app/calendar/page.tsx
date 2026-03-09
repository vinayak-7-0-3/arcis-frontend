'use client';

import { useState, useEffect, useCallback } from 'react';
import Sidebar from '@/app/components/Sidebar';
import { getEvents, getTodos, getReminders, type CalendarItem } from '@/lib/api';
import styles from './calendar.module.css';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

type ViewMode = 'month' | 'week';
type FilterType = 'events' | 'todos' | 'reminders';

interface CalendarEntry extends CalendarItem {
    entryType: FilterType;
}

export default function CalendarPage() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<ViewMode>('month');
    const [entries, setEntries] = useState<CalendarEntry[]>([]);
    const [activeFilters, setActiveFilters] = useState<FilterType[]>(['events', 'todos', 'reminders']);
    const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const loadCalendarData = useCallback(async () => {
        const start = new Date(year, month, 1);
        const end = new Date(year, month + 1, 0, 23, 59, 59);
        const startStr = start.toISOString();
        const endStr = end.toISOString();

        const results = await Promise.allSettled([
            getEvents(startStr, endStr),
            getTodos(startStr, endStr),
            getReminders(startStr, endStr),
        ]);

        const allEntries: CalendarEntry[] = [];
        if (results[0].status === 'fulfilled') {
            results[0].value.forEach(e => allEntries.push({ ...e, entryType: 'events' }));
        }
        if (results[1].status === 'fulfilled') {
            results[1].value.forEach(e => allEntries.push({ ...e, entryType: 'todos' }));
        }
        if (results[2].status === 'fulfilled') {
            results[2].value.forEach(e => allEntries.push({ ...e, entryType: 'reminders' }));
        }
        setEntries(allEntries);
    }, [year, month]);

    useEffect(() => {
        loadCalendarData();
    }, [loadCalendarData]);

    const toggleFilter = (f: FilterType) => {
        setActiveFilters(prev =>
            prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]
        );
    };

    const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
    const goToToday = () => {
        setCurrentDate(new Date());
        setSelectedDate(new Date());
    };

    // Calendar grid
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const calendarDays: { day: number; inMonth: boolean; date: Date }[] = [];
    // Previous month fill
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
        const d = daysInPrevMonth - i;
        calendarDays.push({ day: d, inMonth: false, date: new Date(year, month - 1, d) });
    }
    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
        calendarDays.push({ day: d, inMonth: true, date: new Date(year, month, d) });
    }
    // Next month fill
    const remaining = 42 - calendarDays.length;
    for (let d = 1; d <= remaining; d++) {
        calendarDays.push({ day: d, inMonth: false, date: new Date(year, month + 1, d) });
    }

    const getEntriesForDate = (date: Date) => {
        return entries.filter(e => {
            if (!activeFilters.includes(e.entryType)) return false;
            if (!e.start_time) return false;
            const eDate = new Date(e.start_time);
            return eDate.getFullYear() === date.getFullYear() &&
                eDate.getMonth() === date.getMonth() &&
                eDate.getDate() === date.getDate();
        });
    };

    const isToday = (date: Date) => {
        const t = new Date();
        return date.getDate() === t.getDate() && date.getMonth() === t.getMonth() && date.getFullYear() === t.getFullYear();
    };

    const isSelected = (date: Date) => {
        if (!selectedDate) return false;
        return date.getDate() === selectedDate.getDate() && date.getMonth() === selectedDate.getMonth() && date.getFullYear() === selectedDate.getFullYear();
    };

    const selectedEntries = selectedDate ? getEntriesForDate(selectedDate) : [];

    const filteredCounts = {
        events: entries.filter(e => e.entryType === 'events').length,
        todos: entries.filter(e => e.entryType === 'todos').length,
        reminders: entries.filter(e => e.entryType === 'reminders').length,
    };

    const ENTRY_COLORS: Record<FilterType, string> = {
        events: '#a855f7',
        todos: '#f59e0b',
        reminders: '#3b82f6',
    };

    return (
        <div className={styles.layout}>
            <Sidebar />

            {/* Main Calendar */}
            <div className={`${styles.calendarSection} animate-slide-up delay-100`}>
                {/* Top Bar */}
                <header className={`${styles.topBar} glass-card`}>
                    <div className={styles.topBarLeft}>
                        <div className={styles.navBtns}>
                            <button onClick={prevMonth} className={styles.navBtn}>
                                <span className="material-symbols-outlined">chevron_left</span>
                            </button>
                            <button onClick={nextMonth} className={styles.navBtn}>
                                <span className="material-symbols-outlined">chevron_right</span>
                            </button>
                        </div>
                        <h1 className={styles.monthTitle}>{MONTHS[month]} {year}</h1>
                        <div className={styles.viewToggle}>
                            <button onClick={goToToday} className={styles.viewBtn}>Today</button>
                            <button
                                className={`${styles.viewBtn} ${viewMode === 'month' ? styles.viewBtnActive : ''}`}
                                onClick={() => setViewMode('month')}
                            >Month</button>
                            <button
                                className={`${styles.viewBtn} ${viewMode === 'week' ? styles.viewBtnActive : ''}`}
                                onClick={() => setViewMode('week')}
                            >Week</button>
                        </div>
                    </div>
                    <div className={styles.filterChips}>
                        <button
                            className={`${styles.chip} ${styles.chipEvents} ${activeFilters.includes('events') ? styles.chipActive : ''}`}
                            onClick={() => toggleFilter('events')}
                        >Events</button>
                        <button
                            className={`${styles.chip} ${styles.chipTodos} ${activeFilters.includes('todos') ? styles.chipActive : ''}`}
                            onClick={() => toggleFilter('todos')}
                        >Todos</button>
                        <button
                            className={`${styles.chip} ${styles.chipReminders} ${activeFilters.includes('reminders') ? styles.chipActive : ''}`}
                            onClick={() => toggleFilter('reminders')}
                        >Reminders</button>
                    </div>
                </header>

                {/* Calendar Grid */}
                <main className={`${styles.calendarGrid} glass-card`}>
                    {/* Day Headers */}
                    {DAYS.map(d => (
                        <div key={d} className={styles.dayHeader}>{d}</div>
                    ))}
                    {/* Day Cells */}
                    {calendarDays.map(({ day, inMonth, date }, i) => {
                        const dayEntries = getEntriesForDate(date);
                        return (
                            <button
                                key={i}
                                className={`${styles.dayCell} ${!inMonth ? styles.dayCellMuted : ''} ${isToday(date) ? styles.dayCellToday : ''} ${isSelected(date) ? styles.dayCellSelected : ''}`}
                                onClick={() => setSelectedDate(date)}
                            >
                                <span className={`${styles.dayNumber} ${isToday(date) ? styles.dayNumberToday : ''}`}>
                                    {day}
                                </span>
                                {dayEntries.length > 0 && (
                                    <div className={styles.entryDots}>
                                        {dayEntries.slice(0, 3).map((e, j) => (
                                            <span key={j} className={styles.entryDot} style={{ background: ENTRY_COLORS[e.entryType] }} />
                                        ))}
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </main>
            </div>

            {/* Right Sidebar */}
            <aside className={`${styles.rightSidebar} animate-slide-left delay-200`}>
                {/* Mini Calendar */}
                <div className={`${styles.miniCal} glass-card`}>
                    <div className={styles.miniCalHeader}>
                        <h3 className={styles.miniCalTitle}>{MONTHS[month]} {year}</h3>
                        <div className={styles.miniCalNav}>
                            <button onClick={prevMonth}><span className="material-symbols-outlined">chevron_left</span></button>
                            <button onClick={nextMonth}><span className="material-symbols-outlined">chevron_right</span></button>
                        </div>
                    </div>
                    <div className={styles.miniGrid}>
                        {DAYS.map(d => (
                            <span key={d} className={styles.miniDayHeader}>{d.slice(0, 2)}</span>
                        ))}
                        {calendarDays.slice(0, 35).map(({ day, inMonth, date }, i) => (
                            <button
                                key={i}
                                className={`${styles.miniDay} ${!inMonth ? styles.miniDayMuted : ''} ${isToday(date) ? styles.miniDayToday : ''} ${isSelected(date) ? styles.miniDaySelected : ''}`}
                                onClick={() => setSelectedDate(date)}
                            >
                                {day}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Stats */}
                <div className={`${styles.statsCard} glass-card`}>
                    <div className={styles.statRow}>
                        <span className={styles.statName}>Events</span>
                        <span className={styles.statCount} style={{ color: '#a855f7' }}>{filteredCounts.events}</span>
                    </div>
                    <div className={styles.statDivider} />
                    <div className={styles.statRow}>
                        <span className={styles.statName}>Todos</span>
                        <span className={styles.statCount} style={{ color: '#f59e0b' }}>{filteredCounts.todos}</span>
                    </div>
                    <div className={styles.statDivider} />
                    <div className={styles.statRow}>
                        <span className={styles.statName}>Reminders</span>
                        <span className={styles.statCount} style={{ color: '#3b82f6' }}>{filteredCounts.reminders}</span>
                    </div>

                    {/* Selected Day Entries */}
                    {selectedDate && selectedEntries.length > 0 && (
                        <>
                            <div className={styles.statDivider} style={{ margin: '1rem 0' }} />
                            <p className={styles.selectedDateLabel}>
                                {selectedDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </p>
                            <div className={styles.selectedEntries}>
                                {selectedEntries.map((e, i) => (
                                    <div key={i} className={styles.selectedEntry}>
                                        <span className={styles.entryColorDot} style={{ background: ENTRY_COLORS[e.entryType] }} />
                                        <div>
                                            <p className={styles.entryTitle}>{e.title || 'Untitled'}</p>
                                            {e.start_time && (
                                                <p className={styles.entryTime}>
                                                    {new Date(e.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </aside>
        </div>
    );
}
