'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Sidebar from '@/app/components/Sidebar';
import ReactMarkdown from 'react-markdown';
import {
    sendChat, getAllChats, getChatHistory, sendVoiceChat, sendVoiceChatStream,
    type MessageSchema, type ThreadPreviewSchema
} from '@/lib/api';
import styles from './chat.module.css';

export default function ChatPage() {
    const [threads, setThreads] = useState<ThreadPreviewSchema[]>([]);
    const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
    const [messages, setMessages] = useState<MessageSchema[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [chatMode, setChatMode] = useState<'text' | 'voice-text' | 'voice-stream'>('text');
    const [recording, setRecording] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    useEffect(() => {
        loadThreads();
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const loadThreads = async () => {
        try {
            const data = await getAllChats();
            setThreads(data.sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0)));
        } catch { /* ignore */ }
    };

    const loadThread = useCallback(async (threadId: string) => {
        setActiveThreadId(threadId);
        try {
            const history = await getChatHistory(threadId);
            setMessages(history);
        } catch {
            setMessages([]);
        }
    }, []);

    const handleSend = async () => {
        if (!input.trim() || loading) return;
        const userMsg: MessageSchema = {
            type: 'human',
            response: input,
            thread_id: activeThreadId || '',
        };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const res = await sendChat({
                message: input,
                thread_id: activeThreadId,
            });
            setMessages(prev => [...prev, res]);
            if (!activeThreadId) {
                setActiveThreadId(res.thread_id);
            }
            loadThreads();
        } catch (err) {
            setMessages(prev => [...prev, {
                type: 'ai',
                response: `Error: ${err instanceof Error ? err.message : 'Failed to send'}`,
                thread_id: activeThreadId || '',
            }]);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = async () => {
                stream.getTracks().forEach(t => t.stop());
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                if (chatMode === 'voice-stream') {
                    await handleVoiceStreamSend(audioBlob);
                } else {
                    await handleVoiceSend(audioBlob);
                }
            };

            mediaRecorder.start();
            setRecording(true);
        } catch {
            console.error('Microphone access denied');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && recording) {
            mediaRecorderRef.current.stop();
            setRecording(false);
        }
    };

    const handleVoiceSend = async (blob: Blob) => {
        setLoading(true);
        try {
            const res = await sendVoiceChat(blob, activeThreadId);
            setMessages(prev => [...prev, res]);
            if (!activeThreadId) {
                setActiveThreadId(res.thread_id);
            }
            loadThreads();
        } catch (err) {
            setMessages(prev => [...prev, {
                type: 'ai',
                response: `Voice error: ${err instanceof Error ? err.message : 'Failed'}`,
                thread_id: activeThreadId || '',
            }]);
        } finally {
            setLoading(false);
        }
    };

    const handleVoiceStreamSend = async (blob: Blob) => {
        setLoading(true);
        setMessages(prev => [...prev, {
            type: 'human',
            response: '🎤 Voice message sent',
            thread_id: activeThreadId || '',
        }]);

        try {
            const res = await sendVoiceChatStream(blob, activeThreadId);
            if (!res.ok) throw new Error(`Stream error: ${res.status}`);
            
            const threadHeader = res.headers.get('x-thread-id');
            const newThreadId = activeThreadId || threadHeader || '';
            if (!activeThreadId && threadHeader) {
                setActiveThreadId(threadHeader);
            }

            if (!res.body) throw new Error('No readable stream body');

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            
            setIsPlaying(true);
            
            setMessages(prev => [...prev, {
                type: 'ai',
                response: '',
                thread_id: newThreadId,
            }]);

            let buffer = '';
            let fullAudioChunks: Uint8Array[] = [];

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                
                for (let line of lines) {
                    line = line.trim();
                    if (line.startsWith('data: ')) {
                        const dataStr = line.slice(6).trim();
                        if (!dataStr || dataStr === '[DONE]') continue;
                        try {
                            const parsed = JSON.parse(dataStr);
                            if (parsed.type === 'text') {
                                const newText = parsed.text || parsed.content || parsed.response;
                                if (newText) {
                                    setMessages(prev => {
                                        const newMsgs = [...prev];
                                        const lastMsg = newMsgs[newMsgs.length - 1];
                                        if (lastMsg && lastMsg.type === 'ai') {
                                            newMsgs[newMsgs.length - 1] = {
                                                ...lastMsg,
                                                response: lastMsg.response + newText
                                            };
                                        }
                                        return newMsgs;
                                    });
                                }
                            } else if (parsed.type === 'audio' && parsed.data) {
                                const binaryString = atob(parsed.data);
                                const bytes = new Uint8Array(binaryString.length);
                                for (let i = 0; i < binaryString.length; i++) {
                                    bytes[i] = binaryString.charCodeAt(i);
                                }
                                fullAudioChunks.push(bytes);
                            }
                        } catch (e) {
                            // ignore partial JSON
                        }
                    }
                }
            }

            if (fullAudioChunks.length > 0) {
                const totalLength = fullAudioChunks.reduce((acc, val) => acc + val.length, 0);
                const concatenated = new Uint8Array(totalLength);
                let offset = 0;
                for (const chunk of fullAudioChunks) {
                    concatenated.set(chunk, offset);
                    offset += chunk.length;
                }
                const finalBlob = new Blob([concatenated], { type: 'audio/mpeg' });
                const url = URL.createObjectURL(finalBlob);
                const audio = new Audio(url);
                audio.onended = () => setIsPlaying(false);
                audio.onerror = () => setIsPlaying(false);
                audio.play().catch(e => {
                    console.error("Audio playback error:", e);
                    setIsPlaying(false);
                });
            } else {
                setIsPlaying(false);
            }

            loadThreads();
        } catch (err) {
            setMessages(prev => [...prev, {
                type: 'ai',
                response: `Voice stream error: ${err instanceof Error ? err.message : 'Failed'}`,
                thread_id: activeThreadId || '',
            }]);
        } finally {
            setLoading(false);
        }
    };

    const startNewChat = () => {
        setActiveThreadId(null);
        setMessages([]);
    };

    const filteredThreads = threads.filter(t =>
        !searchQuery || t.thread_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.last_message || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const formatThreadTime = (ts?: number | null) => {
        if (!ts) return '';
        const d = new Date(ts * 1000);
        const now = new Date();
        const diff = now.getTime() - d.getTime();
        if (diff < 60000) return 'Now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
        return `${Math.floor(diff / 86400000)}d`;
    };

    return (
        <div className={styles.layout}>
            <Sidebar />

            {/* Thread List */}
            <section className={`${styles.threadList} glass-card animate-slide-right`}>
                <div className={styles.threadListHeader}>
                    <h2 className={styles.threadListTitle}>Messages</h2>
                    <button className={styles.newChatBtn} onClick={startNewChat} title="New Chat">
                        <span className="material-symbols-outlined">edit_square</span>
                    </button>
                </div>

                <div className={styles.searchWrapper}>
                    <span className="material-symbols-outlined">search</span>
                    <input
                        type="text"
                        placeholder="Search conversations..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className={styles.searchInput}
                    />
                </div>

                <div className={styles.threadItems}>
                    {filteredThreads.map((t) => (
                        <button
                            key={t.thread_id}
                            className={`${styles.threadItem} ${activeThreadId === t.thread_id ? styles.threadItemActive : ''}`}
                            onClick={() => loadThread(t.thread_id)}
                        >
                            <div className={styles.threadItemHeader}>
                                <h3 className={styles.threadTitle}>
                                    {t.last_message?.slice(0, 30) || t.thread_id.slice(0, 12)}
                                </h3>
                                <span className={styles.threadTime}>{formatThreadTime(t.updated_at)}</span>
                            </div>
                            <p className={`${styles.threadPreview} line-clamp-1`}>
                                {t.last_role === 'ai' ? 'ARCIS: ' : ''}{t.last_message || 'No messages'}
                            </p>
                        </button>
                    ))}
                    {filteredThreads.length === 0 && (
                        <div className={styles.emptyThreads}>
                            <span className="material-symbols-outlined">chat_bubble_outline</span>
                            <p>No conversations yet</p>
                        </div>
                    )}
                </div>
            </section>

            {/* Main Chat Area */}
            <main className={`${styles.chatMain} glass-card animate-slide-up delay-200`}>
                {/* Chat Header */}
                <header className={styles.chatHeader}>
                    <div className={styles.chatHeaderLeft}>
                        <div className={styles.aiAvatarHeader}>AI</div>
                        <div>
                            <h1 className={styles.chatTitle}>ARCIS AI</h1>
                            <div className={styles.chatStatus}>
                                <span className={styles.statusDot} />
                                <span>{chatMode === 'voice-text' ? 'Voice Active' : chatMode === 'voice-stream' ? 'Voice Stream' : 'Online'}</span>
                            </div>
                        </div>
                    </div>
                    <div className={styles.chatHeaderActions}>
                        <button
                            className={`${styles.headerBtn} ${chatMode !== 'text' ? styles.headerBtnActive : ''}`}
                            onClick={() => {
                                setChatMode(prev => prev === 'text' ? 'voice-text' : prev === 'voice-text' ? 'voice-stream' : 'text');
                            }}
                            title={`Mode: ${chatMode === 'text' ? 'Text' : chatMode === 'voice-text' ? 'Voice -> Text' : 'Voice -> Stream'}`}
                        >
                            <span className="material-symbols-outlined">
                                {chatMode === 'text' ? 'keyboard' : chatMode === 'voice-text' ? 'mic' : 'graphic_eq'}
                            </span>
                        </button>
                    </div>
                </header>

                {/* Messages */}
                <div className={styles.messagesArea}>
                    {messages.length === 0 && (
                        <div className={styles.welcomeState}>
                            <div className={styles.welcomeIcon}>
                                <span className="material-symbols-outlined">smart_toy</span>
                            </div>
                            <h2>Start a conversation</h2>
                            <p>Ask ARCIS anything or switch to voice mode</p>
                        </div>
                    )}
                    {messages.map((msg, i) => (
                        <div
                            key={i}
                            className={`${styles.message} ${msg.type === 'human' ? styles.messageSent : styles.messageReceived} animate-fade-in`}
                        >
                            {msg.type !== 'human' && (
                                <div className={styles.aiAvatar}>AI</div>
                            )}
                            <div className={styles.messageContent}>
                                {msg.type !== 'human' && (
                                    <span className={styles.messageSender}>ARCIS</span>
                                )}
                                <div className={msg.type === 'human' ? 'glass-bubble-sent' : 'glass-bubble-received'}
                                    style={{
                                        padding: '0.85rem 1.1rem',
                                        borderRadius: '1rem',
                                        borderBottomRightRadius: msg.type === 'human' ? '0.25rem' : '1rem',
                                        borderBottomLeftRadius: msg.type !== 'human' ? '0.25rem' : '1rem',
                                        fontSize: '0.875rem',
                                        lineHeight: '1.6',
                                    }}>
                                    {msg.type === 'human' ? (
                                        <div style={{ whiteSpace: 'pre-wrap' }}>{msg.response}</div>
                                    ) : (
                                        <ReactMarkdown
                                            components={{
                                                p: ({ node, ...props }) => <p style={{ margin: 0, marginBottom: '0.5rem' }} {...props} />,
                                                ul: ({ node, ...props }) => <ul style={{ marginTop: '0.5rem', marginBottom: '0.5rem', paddingLeft: '1.5rem', listStyleType: 'disc' }} {...props} />,
                                                ol: ({ node, ...props }) => <ol style={{ marginTop: '0.5rem', marginBottom: '0.5rem', paddingLeft: '1.5rem', listStyleType: 'decimal' }} {...props} />,
                                                li: ({ node, ...props }) => <li style={{ marginBottom: '0.25rem' }} {...props} />,
                                                a: ({ node, ...props }) => <a style={{ color: '#3b82f6', textDecoration: 'underline' }} {...props} />,
                                                strong: ({ node, ...props }) => <strong style={{ fontWeight: 600 }} {...props} />,
                                            }}
                                        >
                                            {msg.response}
                                        </ReactMarkdown>
                                    )}
                                </div>
                                {msg.type === 'interrupt' && (
                                    <div className={styles.interruptBadge}>
                                        <span className="material-symbols-outlined">warning</span>
                                        Requires your input
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    {loading && (
                        <div className={`${styles.message} ${styles.messageReceived}`}>
                            <div className={styles.aiAvatar}>AI</div>
                            <div className={styles.typingIndicator}>
                                <span /><span /><span />
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className={styles.inputArea}>
                    {chatMode !== 'text' ? (
                        /* Voice Mode */
                        <div className={styles.voiceArea}>
                            <div className={styles.waveformContainer}>
                                {recording && (
                                    <div className={styles.waveform}>
                                        {Array.from({ length: 13 }).map((_, i) => (
                                            <div
                                                key={i}
                                                className={styles.waveBar}
                                                style={{
                                                    animationDelay: `${i * 0.08}s`,
                                                    animationDuration: `${0.8 + Math.random() * 0.6}s`,
                                                }}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                            <button
                                className={`${styles.micBtn} ${recording ? styles.micBtnRecording : ''}`}
                                onMouseDown={startRecording}
                                onMouseUp={stopRecording}
                                onTouchStart={startRecording}
                                onTouchEnd={stopRecording}
                                disabled={loading}
                            >
                                <span className="material-symbols-outlined">
                                    {recording ? 'graphic_eq' : 'mic'}
                                </span>
                            </button>
                            <p className={styles.voiceHint}>
                                {recording ? 'Listening...' : `Hold to speak (${chatMode === 'voice-stream' ? 'Stream Mode' : 'Text Mode'})`}
                            </p>
                        </div>
                    ) : (
                        /* Text Mode */
                        <div className={`${styles.textInputBar} glass-card`}>
                            <input
                                type="text"
                                placeholder="Type a message..."
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                className={styles.textInput}
                                disabled={loading}
                            />
                            <div className={styles.inputActions}>
                                <button
                                    className={styles.micToggle}
                                    onClick={() => setChatMode('voice-text')}
                                    title="Switch to Voice mode"
                                >
                                    <span className="material-symbols-outlined">mic</span>
                                </button>
                                <button
                                    className={styles.sendBtn}
                                    onClick={handleSend}
                                    disabled={!input.trim() || loading}
                                >
                                    <span className="material-symbols-outlined">send</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
