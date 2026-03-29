'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/app/components/Sidebar';
import NotificationBell from '@/app/components/NotificationBell';
import { getEvents, getTodos, getReminders, getCumulativeStats, getPendingItems, getUserStatus, getRecommendations, refreshRecommendations } from '@/lib/api';
import type { CalendarItem, AgentStats, PendingItemSchema, RecommendationCard } from '@/lib/api';
import styles from './dashboard.module.css';

function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
}

function formatTime(iso: string) {
    try {
        return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
        return iso;
    }
}

export default function DashboardPage() {
    const [events, setEvents] = useState<CalendarItem[]>([]);
    const [todos, setTodos] = useState<CalendarItem[]>([]);
    const [reminders, setReminders] = useState<CalendarItem[]>([]);
    const [stats, setStats] = useState<AgentStats[]>([]);
    const [pending, setPending] = useState<PendingItemSchema[]>([]);
    const [userStatus, setUserStatus] = useState<Record<string, unknown>>({});
    const [loading, setLoading] = useState(true);
    const [recommendations, setRecommendations] = useState<RecommendationCard[]>([]);
    const [recoRefreshing, setRecoRefreshing] = useState(false);
    const [recoToast, setRecoToast] = useState(false);

    useEffect(() => {
        loadDashboard();
    }, []);

    const loadDashboard = async () => {
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 7);

        const start = weekStart.toISOString();
        const end = weekEnd.toISOString();

        const results = await Promise.allSettled([
            getEvents(start, end),
            getTodos(start, end),
            getReminders(start, end),
            getCumulativeStats(),
            getPendingItems(),
            getUserStatus(),
            getRecommendations(10),
        ]);

        if (results[0].status === 'fulfilled') setEvents(results[0].value);
        if (results[1].status === 'fulfilled') setTodos(results[1].value);
        if (results[2].status === 'fulfilled') setReminders(results[2].value);
        if (results[3].status === 'fulfilled') setStats(results[3].value);
        if (results[4].status === 'fulfilled') setPending(results[4].value);
        if (results[5].status === 'fulfilled') setUserStatus(results[5].value);
        if (results[6].status === 'fulfilled') setRecommendations(results[6].value);
        setLoading(false);
    };

    const totalTokens = stats.reduce((sum, s) => sum + s.total_tokens, 0);
    const totalRequests = stats.reduce((sum, s) => sum + s.request_count, 0);
    const completedTodos = todos.filter(t => (t as Record<string, unknown>).completed).length;
    const progressPercent = todos.length > 0 ? Math.round((completedTodos / todos.length) * 100) : 0;
    const circumference = 2 * Math.PI * 58;
    const dashOffset = circumference - (circumference * progressPercent) / 100;

    const handleRecoRefresh = async () => {
        setRecoRefreshing(true);
        try {
            await refreshRecommendations();
            setRecoToast(true);
            setTimeout(() => setRecoToast(false), 3500);
        } catch {
            // silently fail
        } finally {
            setRecoRefreshing(false);
        }
    };

    const recoCategoryClass = (cat: string) => {
        const map: Record<string, string> = {
            wellbeing: styles['recoCat-wellbeing'],
            productivity: styles['recoCat-productivity'],
            focus: styles['recoCat-focus'],
            social: styles['recoCat-social'],
            break: styles['recoCat-break'],
        };
        return map[cat] ?? '';
    };

    const priorityColor = (p: number) => {
        if (p >= 5) return '#f43f5e';
        if (p >= 4) return '#f59e0b';
        if (p >= 3) return '#6366f1';
        if (p >= 2) return '#06b6d4';
        return '#22c55e';
    };

    const formatRelativeTime = (iso: string) => {
        try {
            const diff = Date.now() - new Date(iso).getTime();
            const mins = Math.floor(diff / 60000);
            if (mins < 1) return 'Just now';
            if (mins < 60) return `${mins}m ago`;
            const hrs = Math.floor(mins / 60);
            if (hrs < 24) return `${hrs}h ago`;
            return `${Math.floor(hrs / 24)}d ago`;
        } catch { return ''; }
    };

    return (
        <div className={styles.layout}>
            <Sidebar />
            <main className={styles.main}>
                {/* Header */}
                <header className={styles.header}>
                    <div className="animate-slide-right">
                        <h1 className={styles.greeting}>{getGreeting()}</h1>
                        <p className={styles.subtitle}>
                            {todos.length > 0
                                ? `You have ${todos.length} tasks${pending.length > 0 ? ` and ${pending.length} pending approvals` : ''}.`
                                : 'Your dashboard is ready.'}
                        </p>
                    </div>
                    <div className={styles.headerActions}>
                        <NotificationBell />
                        {/* Stats badges */}
                        <div className={`${styles.statBadge} glass-card animate-slide-left delay-100`}>
                            <span className="material-symbols-outlined" style={{ color: '#6366f1' }}>token</span>
                            <div>
                                <p className={styles.statValue}>{totalTokens.toLocaleString()}</p>
                                <p className={styles.statLabel}>TOKENS USED</p>
                            </div>
                        </div>
                        <div className={`${styles.statBadge} glass-card animate-slide-left delay-200`}>
                            <span className="material-symbols-outlined" style={{ color: '#22c55e' }}>bolt</span>
                            <div>
                                <p className={styles.statValue}>{totalRequests}</p>
                                <p className={styles.statLabel}>REQUESTS</p>
                            </div>
                        </div>
                    </div>
                </header>

                {/* This Week Events */}
                <section className={`${styles.section} animate-slide-up delay-100`}>
                    <div className={`${styles.sectionCard} glass-card`}>
                        <div className={styles.sectionHeader}>
                            <div className={styles.sectionTitleRow}>
                                <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>calendar_month</span>
                                <h2 className={styles.sectionTitle}>This Week</h2>
                            </div>
                        </div>
                        <div className={`${styles.eventsScroll} hide-scrollbar`}>
                            {loading ? (
                                <div className={styles.emptyState}>Loading events...</div>
                            ) : events.length === 0 ? (
                                <div className={styles.emptyState}>No events this week</div>
                            ) : (
                                events.map((ev, i) => (
                                    <div key={i} className={`${styles.eventCard} glass-card`}>
                                        <p className={styles.eventDate}>
                                            {ev.start_time ? new Date(ev.start_time).toLocaleDateString([], { weekday: 'long' }) : 'Event'}
                                        </p>
                                        <h4 className={styles.eventTitle}>{ev.title || 'Untitled Event'}</h4>
                                        <div className={styles.eventMeta}>
                                            <span className="material-symbols-outlined">schedule</span>
                                            <span>
                                                {ev.start_time ? formatTime(ev.start_time) : ''}
                                                {ev.end_time ? ` - ${formatTime(ev.end_time)}` : ''}
                                            </span>
                                        </div>
                                        {ev.description && (
                                            <div className={styles.eventMeta}>
                                                <span className="material-symbols-outlined">info</span>
                                                <span className="line-clamp-1">{ev.description}</span>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </section>

                {/* Main Grid */}
                <div className={styles.grid}>
                    {/* Tasks */}
                    <div className={`${styles.tasksCard} glass-card animate-slide-up delay-200`}>
                        <div className={styles.sectionHeader}>
                            <h2 className={styles.sectionTitle}>Today&apos;s Tasks</h2>
                        </div>
                        <div className={styles.taskList}>
                            {loading ? (
                                <div className={styles.emptyState}>Loading...</div>
                            ) : todos.length === 0 ? (
                                <div className={styles.emptyState}>No tasks for today</div>
                            ) : (
                                todos.map((todo, i) => {
                                    const t = todo as Record<string, unknown>;
                                    const isDone = !!t.completed;
                                    return (
                                        <div key={i} className={`${styles.taskItem} ${isDone ? styles.taskDone : ''}`}>
                                            <div className={`${styles.taskCheck} ${isDone ? styles.taskCheckDone : ''}`}>
                                                {isDone && <span className="material-symbols-outlined">check</span>}
                                            </div>
                                            <div className={styles.taskContent}>
                                                <h3 className={isDone ? styles.taskTextDone : ''}>{String(t.title || 'Untitled')}</h3>
                                                {!!t.description && <p className={styles.taskDesc}>{String(t.description)}</p>}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Right Column */}
                    <div className={styles.rightCol}>
                        {/* Progress Ring */}
                        <div className={`${styles.progressCard} glass-card animate-pop-in delay-300`}>
                            <h2 className={styles.progressTitle}>Daily Progress</h2>
                            <div className={styles.progressRing}>
                                <svg className={styles.ringSvg} viewBox="0 0 128 128">
                                    <circle
                                        cx="64" cy="64" r="58"
                                        fill="transparent"
                                        stroke="var(--border)"
                                        strokeWidth="8"
                                    />
                                    <circle
                                        cx="64" cy="64" r="58"
                                        fill="transparent"
                                        stroke="var(--primary)"
                                        strokeWidth="8"
                                        strokeDasharray={circumference}
                                        strokeDashoffset={dashOffset}
                                        strokeLinecap="round"
                                        style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
                                    />
                                </svg>
                                <div className={styles.ringText}>
                                    <span className={styles.ringPercent}>{progressPercent}%</span>
                                    <span className={styles.ringLabel}>COMPLETED</span>
                                </div>
                            </div>
                        </div>

                        {/* Reminders */}
                        <div className={`${styles.remindersCard} glass-card animate-slide-up delay-400`}>
                            <div className={styles.sectionHeader}>
                                <h2 className={styles.sectionTitle}>Reminders</h2>
                            </div>
                            <div className={styles.reminderList}>
                                {reminders.length === 0 ? (
                                    <div className={styles.emptyState}>No reminders</div>
                                ) : (
                                    reminders.slice(0, 5).map((r, i) => (
                                        <div key={i} className={styles.reminderItem}>
                                            <div className={styles.reminderDot} style={{ background: ['#f43f5e', '#f59e0b', '#6366f1', '#22c55e', '#06b6d4'][i % 5] }} />
                                            <div>
                                                <p className={styles.reminderTitle}>{r.title || 'Reminder'}</p>
                                                <p className={styles.reminderTime}>
                                                    {r.start_time ? new Date(r.start_time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : ''}
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Recommendations */}
                <section className={`${styles.section} animate-slide-up delay-400`}>
                    <div className={`${styles.sectionCard} glass-card`}>
                        <div className={styles.recommendationsSectionHeader}>
                            <div className={styles.recommendationsTitleRow}>
                                <span className="material-symbols-outlined" style={{ color: '#a855f7' }}>auto_awesome</span>
                                <h2 className={styles.sectionTitle}>Recommendations</h2>
                            </div>
                            <button
                                className={styles.recommendationsRefreshBtn}
                                onClick={handleRecoRefresh}
                                disabled={recoRefreshing}
                                title="Refresh recommendations"
                            >
                                <span className={`material-symbols-outlined ${recoRefreshing ? styles.recommendationsSpin : ''}`}>
                                    refresh
                                </span>
                                {recoRefreshing ? 'Refreshing…' : 'Refresh'}
                            </button>
                        </div>
                        <div className={`${styles.recommendationsScroll} hide-scrollbar`}>
                            {loading ? (
                                <div className={styles.emptyState}>Loading recommendations…</div>
                            ) : recommendations.length === 0 ? (
                                <div className={styles.emptyState}>No recommendations yet — click Refresh to generate some!</div>
                            ) : (
                                recommendations.map((rec) => {
                                    const color = priorityColor(rec.priority);
                                    return (
                                        <div key={rec.id} className={`${styles.recoCard}`}>
                                            <div className={styles.recoCardTop}>
                                                <span className={styles.recoIcon}>{rec.icon}</span>
                                                <div className={styles.recoPriority} title={`Priority ${rec.priority}/5`}>
                                                    {[1, 2, 3, 4, 5].map((dot) => (
                                                        <div
                                                            key={dot}
                                                            className={`${styles.recoPriorityDot} ${dot <= rec.priority ? styles.recoPriorityDotActive : ''}`}
                                                            style={{ background: color }}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                            <span className={`${styles.recoCategory} ${recoCategoryClass(rec.category)}`}>
                                                {rec.category}
                                            </span>
                                            <p className={styles.recoTitle}>{rec.title}</p>
                                            <p className={styles.recoBody}>{rec.body}</p>
                                            <p className={styles.recoTime}>{formatRelativeTime(rec.generated_at)}</p>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </section>

                {/* Pending Approvals */}
                {pending.length > 0 && (
                    <section className={`${styles.section} animate-slide-up delay-500`}>
                        <div className={`${styles.sectionCard} glass-card`}>
                            <div className={styles.sectionHeader}>
                                <div className={styles.sectionTitleRow}>
                                    <span className="material-symbols-outlined" style={{ color: '#f59e0b' }}>pending_actions</span>
                                    <h2 className={styles.sectionTitle}>Pending Approvals</h2>
                                </div>
                            </div>
                            <div className={styles.pendingList}>
                                {pending.map((item) => (
                                    <div key={item._id} className={`${styles.pendingItem} glass-card`}>
                                        <p className={styles.pendingQuestion}>{item.question}</p>
                                        <span className={styles.pendingStatus}>{item.status}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                )}

                {/* Agent Stats */}
                {stats.length > 0 && (
                    <section className={`${styles.section} animate-slide-up delay-500`}>
                        <div className={`${styles.sectionCard} glass-card`}>
                            <div className={styles.sectionHeader}>
                                <div className={styles.sectionTitleRow}>
                                    <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>analytics</span>
                                    <h2 className={styles.sectionTitle}>Agent Usage</h2>
                                </div>
                            </div>
                            <div className={styles.statsGrid}>
                                {stats.map((s) => (
                                    <div key={s.agent_name} className={`${styles.statCard} glass-card`}>
                                        <p className={styles.agentName}>{s.agent_name}</p>
                                        <p className={styles.agentTokens}>{s.total_tokens.toLocaleString()} tokens</p>
                                        <p className={styles.agentRequests}>{s.request_count} requests</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                )}
            </main>

            {/* Refresh toast */}
            {recoToast && (
                <div className={styles.recoToast}>✨ Recommendation refresh started!</div>
            )}
        </div>
    );
}
