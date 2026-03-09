// ─── ARCIS API Layer ───
const API_BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${API_BASE}${path}`;
    const res = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
        },
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || `API error ${res.status}`);
    }
    return res.json();
}

// ─── Auth ───
export interface LoginRequest {
    username: string;
    password: string;
}
export interface LoginResponse {
    status: string;
    token: string;
}
export const login = (data: LoginRequest) =>
    request<LoginResponse>('/login', { method: 'POST', body: JSON.stringify(data) });

// ─── Settings ───
export type LLMProvider = 'openai' | 'ollama' | 'anthropic' | 'gemini' | 'openrouter' | 'mistral' | 'cerebras' | 'groq' | 'nvidia_nim';

export interface AgentConfigModel {
    provider: LLMProvider;
    model_name: string;
    temperature: number;
}
export interface SettingsUpdateModel {
    agent_configs: Record<string, AgentConfigModel>;
}

export const getModels = () => request<Record<string, string[]>>('/settings/models');
export const getAgentConfigs = () => request<Record<string, AgentConfigModel>>('/settings/agents');
export const updateAgentConfigs = (data: SettingsUpdateModel) =>
    request('/settings/agents', { method: 'PUT', body: JSON.stringify(data) });

// ─── Calendar ───
export interface CalendarItem {
    _id?: string;
    title?: string;
    description?: string;
    start_time?: string;
    end_time?: string;
    type?: string;
    [key: string]: unknown;
}

export const getEvents = (start: string, end: string) =>
    request<CalendarItem[]>(`/calendar/events?start_time=${encodeURIComponent(start)}&end_time=${encodeURIComponent(end)}`);
export const getTodos = (start: string, end: string) =>
    request<CalendarItem[]>(`/calendar/todos?start_time=${encodeURIComponent(start)}&end_time=${encodeURIComponent(end)}`);
export const getReminders = (start: string, end: string) =>
    request<CalendarItem[]>(`/calendar/reminders?start_time=${encodeURIComponent(start)}&end_time=${encodeURIComponent(end)}`);

// ─── Chat ───
export interface ChatRequest {
    message: string;
    thread_id?: string | null;
}
export interface MessageSchema {
    type: string; // 'human' | 'ai' | 'interrupt'
    response: string;
    plan?: Record<string, unknown>[] | null;
    thread_id: string;
}
export interface ThreadPreviewSchema {
    thread_id: string;
    updated_at?: number | null;
    last_message?: string | null;
    last_role?: string | null;
}

export const sendChat = (data: ChatRequest) =>
    request<MessageSchema>('/chat', { method: 'POST', body: JSON.stringify(data) });

export const streamChat = async (data: ChatRequest, voiceId = 'default') => {
    const url = `${API_BASE}/chat/stream?voice_id=${encodeURIComponent(voiceId)}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    return res;
};

export const sendVoiceChat = async (file: Blob, threadId?: string | null) => {
    const formData = new FormData();
    formData.append('file', file, 'recording.webm');
    if (threadId) formData.append('thread_id', threadId);
    const res = await fetch(`${API_BASE}/chat/voice`, {
        method: 'POST',
        body: formData,
    });
    if (!res.ok) throw new Error(`Voice chat error ${res.status}`);
    return res.json() as Promise<MessageSchema>;
};

export const sendVoiceChatStream = async (file: Blob, threadId?: string | null, voiceId = 'default') => {
    const formData = new FormData();
    formData.append('file', file, 'recording.webm');
    if (threadId) formData.append('thread_id', threadId);
    formData.append('voice_id', voiceId);
    const res = await fetch(`${API_BASE}/chat/voice/stream`, {
        method: 'POST',
        body: formData,
    });
    return res;
};

export const getAllChats = () => request<ThreadPreviewSchema[]>('/chat/all_chats');
export const getChatHistory = (threadId: string) =>
    request<MessageSchema[]>(`/chat/${encodeURIComponent(threadId)}`);

export const uploadVoice = async (file: File, voiceId: string) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/chat/voice-upload?voice_id=${encodeURIComponent(voiceId)}`, {
        method: 'POST',
        body: formData,
    });
    if (!res.ok) throw new Error(`Upload error ${res.status}`);
    return res.json();
};

// ─── Token Tracker ───
export interface AgentStats {
    agent_name: string;
    total_prompt_tokens: number;
    total_completion_tokens: number;
    total_tokens: number;
    request_count: number;
}
export interface TokenUsageRecord {
    agent_name: string;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    model_name?: string | null;
    timestamp: string;
}

export const getTokenAgents = () => request<string[]>('/token-tracker/agents');
export const getCumulativeStats = () => request<AgentStats[]>('/token-tracker/cumulative');
export const getAgentHistory = (name: string) =>
    request<TokenUsageRecord[]>(`/token-tracker/agent/${encodeURIComponent(name)}`);

// ─── Auto Flow ───
export interface PendingItemSchema {
    _id: string;
    thread_id: string;
    question: string;
    status: string;
    source_context?: Record<string, unknown>;
    created_at: number;
}
export interface ResolveResponse {
    status: string;
    message: string;
    workflow_status?: string | null;
}

export const getPendingItems = () => request<PendingItemSchema[]>('/auto_flow/pending');
export const resolveItem = (interruptId: string, answer: string) =>
    request<ResolveResponse>('/auto_flow/resolve', {
        method: 'POST',
        body: JSON.stringify({ interrupt_id: interruptId, answer }),
    });
export const dismissItem = (interruptId: string) =>
    request<ResolveResponse>('/auto_flow/dismiss', {
        method: 'POST',
        body: JSON.stringify({ interrupt_id: interruptId }),
    });

// ─── Gmail ───
export const gmailLogin = () => request<{ url: string }>('/gmail/auth/login');
export const gmailAuthStatus = () => request<{ authenticated: boolean }>('/gmail/auth/status');
export const gmailLogout = () => request('/gmail/auth/logout');

// ─── Onboarding ───
export interface OnboardingStartResponse {
    session_id: string;
    question: string;
    is_complete: boolean;
}
export interface OnboardingRespondResponse {
    question: string;
    is_complete: boolean;
    extracted_facts?: unknown[] | null;
}
export interface OnboardingStatusResponse {
    onboarded: boolean;
    in_progress?: boolean | null;
    session_id?: string | null;
    completed_at?: string | null;
}

export const onboardingStart = () =>
    request<OnboardingStartResponse>('/onboarding/start', { method: 'POST' });
export const onboardingRespond = (sessionId: string, answer: string) =>
    request<OnboardingRespondResponse>('/onboarding/respond', {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId, answer }),
    });
export const onboardingStatus = () => request<OnboardingStatusResponse>('/onboarding/status');

// ─── User ───
export const getUserStatus = () => request<Record<string, unknown>>('/user/status');
