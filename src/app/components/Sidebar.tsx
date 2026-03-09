'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useTheme } from './ThemeProvider';
import styles from './Sidebar.module.css';

const navItems = [
    { href: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
    { href: '/chat', icon: 'chat_bubble', label: 'Chat' },
    { href: '/calendar', icon: 'calendar_month', label: 'Calendar' },
    { href: '/settings', icon: 'settings', label: 'Settings' },
];

export default function Sidebar() {
    const pathname = usePathname();
    const { theme, toggleTheme } = useTheme();

    return (
        <aside className={`${styles.sidebar} glass-card`}>
            {/* Logo */}
            <div className={styles.logo}>
                <div className={styles.logoIcon}>
                    <span className="material-symbols-outlined">architecture</span>
                </div>
            </div>

            {/* Navigation */}
            <nav className={styles.nav}>
                {navItems.map((item) => {
                    const isActive = pathname.startsWith(item.href);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                            title={item.label}
                        >
                            <span className="material-symbols-outlined">{item.icon}</span>
                        </Link>
                    );
                })}
            </nav>

            {/* Bottom actions */}
            <div className={styles.bottomActions}>
                <button
                    className={styles.navItem}
                    onClick={toggleTheme}
                    title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                >
                    <span className="material-symbols-outlined">
                        {theme === 'dark' ? 'light_mode' : 'dark_mode'}
                    </span>
                </button>
                <div className={styles.avatar}>
                    <span className="material-symbols-outlined">person</span>
                </div>
            </div>
        </aside>
    );
}
