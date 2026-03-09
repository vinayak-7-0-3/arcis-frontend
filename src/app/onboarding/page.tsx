'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onboardingStart, onboardingRespond, onboardingStatus } from '@/lib/api';
import Sidebar from '@/app/components/Sidebar';
import styles from './onboarding.module.css';

export default function OnboardingPage() {
    const router = useRouter();
    const [sessionId, setSessionId] = useState('');
    const [question, setQuestion] = useState('');
    const [answer, setAnswer] = useState('');
    const [step, setStep] = useState(1);
    const [totalSteps] = useState(6);
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);

    useEffect(() => {
        checkOnboardingStatus();
    }, []);

    const checkOnboardingStatus = async () => {
        try {
            const status = await onboardingStatus();
            if (status.onboarded) {
                router.push('/dashboard');
                return;
            }
            if (status.in_progress && status.session_id) {
                setSessionId(status.session_id);
                setQuestion('Continuing your onboarding session...');
            } else {
                const res = await onboardingStart();
                setSessionId(res.session_id);
                setQuestion(res.question);
            }
        } catch {
            // If status check fails, start fresh
            try {
                const res = await onboardingStart();
                setSessionId(res.session_id);
                setQuestion(res.question);
            } catch {
                setQuestion('Welcome! Let\'s get started. Tell me about yourself.');
            }
        } finally {
            setInitialLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!answer.trim()) return;
        setLoading(true);
        try {
            const res = await onboardingRespond(sessionId, answer);
            setAnswer('');
            setStep(prev => prev + 1);
            if (res.is_complete) {
                router.push('/dashboard');
            } else {
                setQuestion(res.question);
            }
        } catch {
            // Continue anyway
        } finally {
            setLoading(false);
        }
    };

    const progressPercent = ((step - 1) / totalSteps) * 100;

    if (initialLoading) {
        return (
            <div className={styles.layout}>
                <Sidebar />
                <main className={styles.main}>
                    <div className={`${styles.card} glass-card`}>
                        <div className={styles.loadingContainer}>
                            <div className={styles.spinner} />
                            <p>Preparing your onboarding...</p>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className={styles.layout}>
            <Sidebar />
            <main className={styles.main}>
                <div className={`${styles.card} glass-card animate-scale-in`}>
                    {/* Progress bar */}
                    <div className={styles.progressBar}>
                        <div className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
                    </div>

                    {/* Header */}
                    <div className={styles.header}>
                        <div>
                            <h1 className={styles.title}>Initial Context Sync</h1>
                            <p className={styles.subtitle}>Help ARCIS understand your needs and environment</p>
                        </div>
                        <span className={styles.stepBadge}>Step {step} of {totalSteps}</span>
                    </div>

                    {/* Question */}
                    <div className={styles.questionArea}>
                        <div className={styles.aiAvatar}>
                            <span className="material-symbols-outlined">smart_toy</span>
                        </div>
                        <p className={styles.questionText}>{question}</p>
                    </div>

                    {/* Input */}
                    <form onSubmit={handleSubmit} className={styles.inputArea}>
                        <div className={styles.inputWrapper}>
                            <input
                                type="text"
                                placeholder="Type your response here..."
                                value={answer}
                                onChange={(e) => setAnswer(e.target.value)}
                                className={styles.input}
                                disabled={loading}
                                autoFocus
                            />
                            <button type="submit" className={styles.sendBtn} disabled={loading || !answer.trim()}>
                                <span className="material-symbols-outlined">arrow_forward</span>
                            </button>
                        </div>

                        {/* Status */}
                        <div className={styles.statusBar}>
                            <div className={styles.statusIndicators}>
                                <span className={styles.statusItem}>
                                    <span className={styles.statusDotGreen} />
                                    CONTEXT ENGINE LIVE
                                </span>
                                <span className={styles.statusItem}>
                                    <span className={styles.statusDotBlue} />
                                    VOICE READY
                                </span>
                            </div>
                            <button
                                type="button"
                                className={styles.skipBtn}
                                onClick={() => router.push('/dashboard')}
                            >
                                Skip this step →
                            </button>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    );
}
