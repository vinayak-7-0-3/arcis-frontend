'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '@/lib/api';
import styles from './login.module.css';

export default function LoginPage() {
    const router = useRouter();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await login({ username, password });
            // Store token in cookie
            document.cookie = `arcis-token=${res.token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
            router.push('/dashboard');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={`${styles.card} glass-card animate-scale-in`}>
                {/* Logo */}
                <div className={styles.logoContainer}>
                    <div className={styles.logoIcon}>
                        <span className="material-symbols-outlined">architecture</span>
                    </div>
                    <h1 className={styles.logoText}>ARCIS</h1>
                    <p className={styles.tagline}>Elevate your productivity</p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className={styles.fieldGroup}>
                        <label className={styles.label}>Username</label>
                        <div className={styles.inputWrapper}>
                            <span className="material-symbols-outlined">person</span>
                            <input
                                type="text"
                                placeholder="Enter username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className={styles.input}
                                required
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className={styles.fieldGroup}>
                        <label className={styles.label}>Password</label>
                        <div className={styles.inputWrapper}>
                            <span className="material-symbols-outlined">lock</span>
                            <input
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className={styles.input}
                                required
                            />
                        </div>
                    </div>

                    {error && <p className={styles.error}>{error}</p>}

                    <button
                        type="submit"
                        className={styles.submitBtn}
                        disabled={loading}
                    >
                        {loading ? (
                            <span className={styles.spinner} />
                        ) : (
                            <>
                                Sign In
                                <span className="material-symbols-outlined">login</span>
                            </>
                        )}
                    </button>
                </form>
            </div>

            {/* Version badge */}
            <div className={styles.versionBadge}>
                <span className={styles.statusDot} />
                ARCIS SYSTEM V2.5.0
            </div>
        </div>
    );
}
