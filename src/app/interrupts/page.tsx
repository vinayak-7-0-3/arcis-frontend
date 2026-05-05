'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/app/components/Sidebar';
import NotificationBell from '@/app/components/NotificationBell';
import { getInterrupts, resolveItem, dismissItem } from '@/lib/api';
import type { PendingItemSchema } from '@/lib/api';
import styles from '../dashboard/dashboard.module.css';

export default function InterruptsPage() {
    const [interrupts, setInterrupts] = useState<PendingItemSchema[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [answerInputs, setAnswerInputs] = useState<Record<string, string>>({});
    const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

    useEffect(() => {
        loadInterrupts();
    }, [statusFilter]);

    const loadInterrupts = async () => {
        setLoading(true);
        try {
            const status = statusFilter === 'all' ? undefined : statusFilter;
            const data = await getInterrupts(status, 0, 100);
            setInterrupts(data);
        } catch (e) {
            console.error('Failed to load interrupts', e);
        } finally {
            setLoading(false);
        }
    };

    const handleResolve = async (id: string) => {
        const answer = answerInputs[id] || '';
        if (!answer.trim()) return;
        
        setActionLoading(prev => ({ ...prev, [id]: true }));
        try {
            await resolveItem(id, answer);
            await loadInterrupts();
        } catch (e) {
            console.error('Resolve error', e);
        } finally {
            setActionLoading(prev => ({ ...prev, [id]: false }));
            setAnswerInputs(prev => ({ ...prev, [id]: '' }));
        }
    };

    const handleDismiss = async (id: string) => {
        setActionLoading(prev => ({ ...prev, [id]: true }));
        try {
            await dismissItem(id);
            await loadInterrupts();
        } catch (e) {
            console.error('Dismiss error', e);
        } finally {
            setActionLoading(prev => ({ ...prev, [id]: false }));
        }
    };

    return (
        <div className={styles.layout}>
            <Sidebar />
            <main className={styles.main}>
                <header className={styles.header}>
                    <div className="animate-slide-right">
                        <h1 className={styles.greeting}>Workflow Interrupts</h1>
                        <p className={styles.subtitle}>
                            Manage and resolve autonomous workflow pauses.
                        </p>
                    </div>
                    <div className={styles.headerActions}>
                        <NotificationBell />
                    </div>
                </header>

                <section className={`${styles.section} animate-slide-up delay-100`}>
                    <div className={`${styles.sectionCard} glass-card`}>
                        <div className={styles.sectionHeader}>
                            <div className={styles.sectionTitleRow}>
                                <span className="material-symbols-outlined" style={{ color: '#f59e0b' }}>pending_actions</span>
                                <h2 className={styles.sectionTitle}>Interrupt History</h2>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                {['all', 'pending', 'resolved', 'dismissed'].map(s => (
                                    <button
                                        key={s}
                                        onClick={() => setStatusFilter(s)}
                                        className={styles.recommendationsRefreshBtn}
                                        style={{
                                            background: statusFilter === s ? 'rgba(var(--primary-rgb), 0.15)' : '',
                                            borderColor: statusFilter === s ? 'rgba(var(--primary-rgb), 0.4)' : '',
                                            color: statusFilter === s ? 'var(--primary)' : ''
                                        }}
                                    >
                                        {s.charAt(0).toUpperCase() + s.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className={styles.pendingList}>
                            {loading ? (
                                <div className={styles.emptyState}>Loading interrupts...</div>
                            ) : interrupts.length === 0 ? (
                                <div className={styles.emptyState}>No interrupts found.</div>
                            ) : (
                                interrupts.map((item) => (
                                    <div key={item._id} className={`${styles.pendingItem} glass-card`} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '1rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                                            <div>
                                                <p className={styles.pendingQuestion} style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>{item.question}</p>
                                                <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                                    Thread: {item.thread_id} • {new Date(item.created_at * 1000).toLocaleString()}
                                                </p>
                                            </div>
                                            <span className={styles.pendingStatus} style={{
                                                color: item.status === 'pending' ? '#f59e0b' : item.status === 'resolved' ? '#22c55e' : '#6366f1',
                                                background: item.status === 'pending' ? 'rgba(245, 158, 11, 0.1)' : item.status === 'resolved' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(99, 102, 241, 0.1)'
                                            }}>
                                                {item.status}
                                            </span>
                                        </div>
                                        
                                        {item.status === 'pending' && (
                                            <div style={{ display: 'flex', width: '100%', gap: '0.5rem', marginTop: '0.5rem' }}>
                                                <input 
                                                    type="text" 
                                                    placeholder="Provide an answer..." 
                                                    value={answerInputs[item._id] || ''}
                                                    onChange={(e) => setAnswerInputs(prev => ({ ...prev, [item._id]: e.target.value }))}
                                                    style={{ 
                                                        flex: 1, 
                                                        background: 'var(--card-bg)', 
                                                        border: '1px solid var(--border)', 
                                                        borderRadius: 'var(--radius-md)', 
                                                        padding: '0.5rem 0.75rem',
                                                        color: 'var(--text-primary)',
                                                        outline: 'none'
                                                    }}
                                                    disabled={actionLoading[item._id]}
                                                />
                                                <button 
                                                    className={styles.recommendationsRefreshBtn}
                                                    onClick={() => handleResolve(item._id)}
                                                    disabled={!answerInputs[item._id]?.trim() || actionLoading[item._id]}
                                                    style={{ background: 'rgba(34, 197, 94, 0.1)', borderColor: '#22c55e', color: '#22c55e' }}
                                                >
                                                    <span className="material-symbols-outlined">check</span>
                                                    Resolve
                                                </button>
                                                <button 
                                                    className={styles.recommendationsRefreshBtn}
                                                    onClick={() => handleDismiss(item._id)}
                                                    disabled={actionLoading[item._id]}
                                                    style={{ background: 'rgba(244, 63, 94, 0.1)', borderColor: '#f43f5e', color: '#f43f5e' }}
                                                >
                                                    <span className="material-symbols-outlined">close</span>
                                                    Dismiss
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}
