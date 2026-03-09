'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/app/components/Sidebar';
import {
    getModels, getAgentConfigs, updateAgentConfigs,
    gmailAuthStatus, gmailLogin, gmailLogout,
    uploadVoice,
    type AgentConfigModel, type LLMProvider,
} from '@/lib/api';
import styles from './settings.module.css';

const PROVIDERS: LLMProvider[] = ['openai', 'ollama', 'anthropic', 'gemini', 'openrouter', 'mistral', 'cerebras', 'groq', 'nvidia_nim'];
const TABS = ['Agent Configuration', 'OAuth Settings', 'Voice Settings'] as const;

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState<typeof TABS[number]>(TABS[0]);
    const [agents, setAgents] = useState<Record<string, AgentConfigModel>>({});
    const [models, setModels] = useState<Record<string, string[]>>({});
    const [gmailConnected, setGmailConnected] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState('');
    const [voiceId, setVoiceId] = useState('');
    const [voiceFile, setVoiceFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        const results = await Promise.allSettled([
            getAgentConfigs(),
            getModels(),
            gmailAuthStatus(),
        ]);
        if (results[0].status === 'fulfilled') setAgents(results[0].value);
        if (results[1].status === 'fulfilled') setModels(results[1].value);
        if (results[2].status === 'fulfilled') setGmailConnected((results[2].value as Record<string, boolean>).authenticated);
        setLoading(false);
    };

    const handleAgentChange = (agentName: string, field: keyof AgentConfigModel, value: string | number) => {
        setAgents(prev => ({
            ...prev,
            [agentName]: {
                ...prev[agentName],
                [field]: field === 'temperature' ? Number(value) : value,
            },
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        setSaveMsg('');
        try {
            await updateAgentConfigs({ agent_configs: agents });
            setSaveMsg('Settings saved successfully!');
            setTimeout(() => setSaveMsg(''), 3000);
        } catch {
            setSaveMsg('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const handleGmailConnect = async () => {
        try {
            const res = await gmailLogin();
            if (res.url) window.open(res.url, '_blank');
        } catch { /* ignore */ }
    };

    const handleGmailDisconnect = async () => {
        try {
            await gmailLogout();
            setGmailConnected(false);
        } catch { /* ignore */ }
    };

    const handleVoiceUpload = async () => {
        if (!voiceFile || !voiceId.trim()) return;
        try {
            await uploadVoice(voiceFile, voiceId);
            setVoiceFile(null);
            setVoiceId('');
            setSaveMsg('Voice uploaded successfully!');
            setTimeout(() => setSaveMsg(''), 3000);
        } catch {
            setSaveMsg('Voice upload failed');
        }
    };

    return (
        <div className={styles.layout}>
            <Sidebar />
            <main className={styles.main}>
                {/* Header */}
                <header className={styles.header}>
                    <div className="animate-slide-right delay-100">
                        <h1 className={styles.title}>Settings</h1>
                        <p className={styles.subtitle}>Manage your agents, connections, and voice preferences</p>
                    </div>
                    <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </header>

                {saveMsg && (
                    <div className={styles.saveMsg}>{saveMsg}</div>
                )}

                {/* Tabs */}
                <div className={`${styles.tabs} animate-slide-up delay-200`}>
                    {TABS.map(tab => (
                        <button
                            key={tab}
                            className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
                            onClick={() => setActiveTab(tab)}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className={styles.loadingState}>Loading settings...</div>
                ) : (
                    <>
                        {/* Agent Configuration */}
                        {activeTab === 'Agent Configuration' && (
                            <section className={`${styles.sectionCard} glass-card animate-slide-up delay-300`}>
                                <div className={styles.sectionHeader}>
                                    <div className={styles.sectionIcon}>
                                        <span className="material-symbols-outlined">smart_toy</span>
                                    </div>
                                    <div>
                                        <h2 className={styles.sectionTitle}>Agent Configuration</h2>
                                        <p className={styles.sectionSubtitle}>Configure LLM providers and parameters for each agent role</p>
                                    </div>
                                </div>

                                <div className={styles.table}>
                                    <div className={styles.tableHeader}>
                                        <span>AGENT ROLE</span>
                                        <span>PROVIDER</span>
                                        <span>MODEL</span>
                                        <span>TEMPERATURE</span>
                                    </div>
                                    {Object.entries(agents).map(([name, config]) => (
                                        <div key={name} className={styles.tableRow}>
                                            <div className={styles.agentRole}>
                                                <span className={styles.agentDot} />
                                                {name}
                                            </div>
                                            <div>
                                                <select
                                                    className={styles.select}
                                                    value={config.provider}
                                                    onChange={(e) => handleAgentChange(name, 'provider', e.target.value)}
                                                >
                                                    {PROVIDERS.map(p => (
                                                        <option key={p} value={p}>{p}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <select
                                                    className={styles.select}
                                                    value={config.model_name}
                                                    onChange={(e) => handleAgentChange(name, 'model_name', e.target.value)}
                                                >
                                                    <option value={config.model_name}>{config.model_name}</option>
                                                    {(models[config.provider] || []).filter(m => m !== config.model_name).map(m => (
                                                        <option key={m} value={m}>{m}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className={styles.tempCell}>
                                                <span className={styles.tempValue}>{config.temperature.toFixed(1)}</span>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="1"
                                                    step="0.1"
                                                    value={config.temperature}
                                                    onChange={(e) => handleAgentChange(name, 'temperature', e.target.value)}
                                                    className={styles.slider}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                    {Object.keys(agents).length === 0 && (
                                        <div className={styles.emptyRow}>No agents configured</div>
                                    )}
                                </div>
                            </section>
                        )}

                        {/* OAuth Settings */}
                        {activeTab === 'OAuth Settings' && (
                            <section className={`${styles.sectionCard} glass-card animate-slide-up delay-300`}>
                                <div className={styles.sectionHeader}>
                                    <div className={styles.sectionIcon} style={{ background: 'rgba(245, 158, 11, 0.15)' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#f59e0b' }}>lock</span>
                                    </div>
                                    <div>
                                        <h2 className={styles.sectionTitle}>OAuth Settings</h2>
                                        <p className={styles.sectionSubtitle}>Manage third-party integrations and access tokens</p>
                                    </div>
                                </div>

                                <div className={styles.oauthList}>
                                    <div className={styles.oauthItem}>
                                        <div className={styles.oauthInfo}>
                                            <div className={styles.oauthIcon}>
                                                <span className="material-symbols-outlined">mail</span>
                                            </div>
                                            <div>
                                                <p className={styles.oauthName}>Google Workspace</p>
                                                <p className={`${styles.oauthStatus} ${gmailConnected ? styles.oauthConnected : ''}`}>
                                                    <span className={styles.oauthDot} />
                                                    {gmailConnected ? 'CONNECTED' : 'NOT CONNECTED'}
                                                </p>
                                            </div>
                                        </div>
                                        {gmailConnected ? (
                                            <button className={styles.disconnectBtn} onClick={handleGmailDisconnect}>
                                                Disconnect
                                            </button>
                                        ) : (
                                            <button className={styles.connectBtn} onClick={handleGmailConnect}>
                                                Connect
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </section>
                        )}

                        {/* Voice Settings */}
                        {activeTab === 'Voice Settings' && (
                            <section className={`${styles.sectionCard} glass-card animate-slide-up delay-300`}>
                                <div className={styles.sectionHeader}>
                                    <div className={styles.sectionIcon} style={{ background: 'rgba(236, 72, 153, 0.15)' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#ec4899' }}>graphic_eq</span>
                                    </div>
                                    <div>
                                        <h2 className={styles.sectionTitle}>Voice Settings</h2>
                                        <p className={styles.sectionSubtitle}>Clone voices and set default speech models</p>
                                    </div>
                                </div>

                                <div className={styles.voiceUpload}>
                                    <label className={styles.uploadArea} htmlFor="voice-file">
                                        <span className="material-symbols-outlined">cloud_upload</span>
                                        <p className={styles.uploadTitle}>Upload Voice Sample</p>
                                        <p className={styles.uploadHint}>Drag & drop or click to upload (MP3, WAV)</p>
                                        <input
                                            id="voice-file"
                                            type="file"
                                            accept=".wav,.mp3"
                                            className={styles.fileInput}
                                            onChange={(e) => setVoiceFile(e.target.files?.[0] || null)}
                                        />
                                    </label>
                                    {voiceFile && <p className={styles.fileName}>{voiceFile.name}</p>}

                                    <div className={styles.voiceIdRow}>
                                        <input
                                            type="text"
                                            placeholder="Name your cloned voice..."
                                            value={voiceId}
                                            onChange={(e) => setVoiceId(e.target.value)}
                                            className={styles.voiceInput}
                                        />
                                        <button
                                            className={styles.uploadBtn}
                                            onClick={handleVoiceUpload}
                                            disabled={!voiceFile || !voiceId.trim()}
                                        >
                                            <span className="material-symbols-outlined">add</span>
                                        </button>
                                    </div>
                                </div>
                            </section>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}
