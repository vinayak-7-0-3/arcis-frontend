'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import styles from './onboarding.module.css';
import { onboardingStart, onboardingRespond, onboardingStatus } from '@/lib/api';

interface ChatMessage {
    id: string;
    type: 'ai' | 'human';
    content: string;
}

export default function OnboardingPage() {
    const router = useRouter();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(true);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [isComplete, setIsComplete] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        checkStatus();
    }, []);

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, loading]);

    const checkStatus = async () => {
        try {
            const status = await onboardingStatus();
            if (status.onboarded) {
                // Already completed, redirect to dashboard
                router.push('/dashboard');
                return;
            }
            startSession();
        } catch (error) {
            console.error('Failed to check onboarding status', error);
            startSession(); // Fallback to start
        }
    };

    const startSession = async () => {
        try {
            const res = await onboardingStart();
            setSessionId(res.session_id);
            setIsComplete(res.is_complete);
            setMessages([{
                id: Date.now().toString(),
                type: 'ai',
                content: res.question
            }]);
            
            if (res.is_complete) {
                completeOnboarding();
            }
        } catch (error) {
            console.error('Failed to start onboarding', error);
            setMessages([{
                id: 'err',
                type: 'ai',
                content: 'Sorry, I am having trouble starting the onboarding process right now.'
            }]);
        } finally {
            setLoading(false);
        }
    };

    const handleSend = async () => {
        if (!input.trim() || loading || !sessionId) return;
        
        const answer = input.trim();
        setInput('');
        setMessages(prev => [...prev, { id: Date.now().toString(), type: 'human', content: answer }]);
        setLoading(true);

        try {
            const res = await onboardingRespond(sessionId, answer);
            setIsComplete(res.is_complete);
            
            // Add slight delay for more natural feel
            setTimeout(() => {
                setMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    type: 'ai',
                    content: res.question
                }]);
                setLoading(false);

                if (res.is_complete) {
                    completeOnboarding();
                }
            }, 600);
            
        } catch (error) {
            console.error('Failed to submit answer', error);
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                type: 'ai',
                content: 'There was an error processing your response. Please try again.'
            }]);
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const completeOnboarding = () => {
        setIsComplete(true);
        setTimeout(() => {
            router.push('/dashboard');
        }, 2000);
    };

    const handleSkip = () => {
        router.push('/dashboard');
    };

    return (
        <div className={styles.container}>
            {/* Ambient Backgrounds from layout */}
            
            <button className={styles.skipButton} onClick={handleSkip}>
                Skip Onboarding
            </button>

            {isComplete ? (
                <div className={styles.successOverlay}>
                    <span className={`material-symbols-outlined ${styles.successIcon}`}>
                        check_circle
                    </span>
                    <h1 className={styles.successText}>All Set!</h1>
                </div>
            ) : (
                <div className={styles.chatWindow}>
                    <div className={styles.messagesArea}>
                        {messages.map((msg, index) => {
                            const isOld = index < messages.length - (loading ? 0 : 1);
                            
                            return (
                                <div 
                                    key={msg.id} 
                                    className={`${styles.message} ${msg.type === 'human' ? styles.messageSent : styles.messageReceived} ${isOld ? styles.messageOld : styles.messageCurrent}`}
                                >
                                    <div className={msg.type === 'human' ? styles.bubbleSent : styles.bubbleReceived}>
                                        {msg.content}
                                    </div>
                                </div>
                            );
                        })}
                        {loading && messages.length > 0 && (
                            <div className={`${styles.message} ${styles.messageReceived} ${styles.messageCurrent}`}>
                                <div className={styles.typingIndicator}>
                                    <span /><span /><span />
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className={styles.inputArea}>
                        <div className={styles.inputGlass}>
                            <input
                                autoFocus
                                type="text"
                                className={styles.textInput}
                                placeholder="Type your answer..."
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                disabled={loading || isComplete}
                            />
                            <button 
                                className={styles.sendBtn}
                                onClick={handleSend}
                                disabled={!input.trim() || loading || isComplete}
                            >
                                <span className="material-symbols-outlined">arrow_upward</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
