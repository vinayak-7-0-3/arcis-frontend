'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getNotifications, markNotificationRead, markAllNotificationsRead, Notification } from '@/lib/api';
import styles from './NotificationBell.module.css';

function timeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
}

export default function NotificationBell() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const popoverRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    const fetchNotifications = async () => {
        try {
            const data = await getNotifications(false, 50);
            setNotifications(data);
            setUnreadCount(data.filter(n => !n.read).length);
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
        }
    };

    useEffect(() => {
        fetchNotifications();
        const intervalId = setInterval(fetchNotifications, 60000); // Poll every 60 seconds
        return () => clearInterval(intervalId);
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
        if (e) {
            e.stopPropagation();
        }
        try {
            await markNotificationRead(id);
            setNotifications(prev => 
                prev.map(n => n.id === id ? { ...n, read: true } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            console.error('Failed to mark notification as read:', error);
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            await markAllNotificationsRead();
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            setUnreadCount(0);
        } catch (error) {
            console.error('Failed to mark all as read:', error);
        }
    };

    const handleNotificationClick = (notification: Notification) => {
        if (!notification.read) {
            handleMarkAsRead(notification.id);
        }
        
        if (notification.job_id) {
            // Adjust this route based on the actual scheduled jobs route
            router.push(`/jobs/${notification.job_id}`);
            setIsOpen(false);
        }
    };

    return (
        <div className={styles.container} ref={popoverRef}>
            <button 
                className={styles.bellButton} 
                onClick={() => setIsOpen(!isOpen)}
                aria-label="Notifications"
            >
                <span className="material-symbols-outlined">notifications</span>
                {unreadCount > 0 && (
                    <span className={styles.badge}>{unreadCount > 99 ? '99+' : unreadCount}</span>
                )}
            </button>

            {isOpen && (
                <div className={`${styles.popover} glass-card animate-pop-in`}>
                    <div className={styles.header}>
                        <h3 className={styles.title}>Notifications</h3>
                        {unreadCount > 0 && (
                            <button className={styles.markAllButton} onClick={handleMarkAllAsRead}>
                                Mark all as read
                            </button>
                        )}
                    </div>
                    
                    <div className={`${styles.list} hide-scrollbar`}>
                        {notifications.length === 0 ? (
                            <div className={styles.emptyState}>
                                <span className={`material-symbols-outlined ${styles.emptyIcon}`}>notifications_paused</span>
                                <p>No notifications yet</p>
                            </div>
                        ) : (
                            notifications.map(notification => (
                                <div 
                                    key={notification.id} 
                                    className={`${styles.notificationItem} ${!notification.read ? styles.unread : ''} ${notification.job_id ? styles.clickable : ''}`}
                                    onClick={() => handleNotificationClick(notification)}
                                >
                                    <div className={`${styles.iconContainer} ${styles[notification.level]}`}>
                                        <span className="material-symbols-outlined">
                                            {notification.level === 'info' ? 'info' : 
                                             notification.level === 'success' ? 'check_circle' : 'error'}
                                        </span>
                                    </div>
                                    <div className={styles.content}>
                                        <h4 className={styles.notificationTitle}>{notification.title}</h4>
                                        <p className={styles.message}>{notification.message}</p>
                                        <span className={styles.time}>{timeAgo(notification.created_at)}</span>
                                    </div>
                                    {!notification.read && (
                                        <button 
                                            className={styles.checkButton}
                                            onClick={(e) => handleMarkAsRead(notification.id, e)}
                                            title="Mark as read"
                                        >
                                            <span className="material-symbols-outlined">done</span>
                                        </button>
                                    )}
                                    {notification.read && <div className={styles.spacer}></div>}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
