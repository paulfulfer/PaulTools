import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Show alerts when a notification arrives while the app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ─── Date rolling ─────────────────────────────────────────────────────────────

/**
 * Roll a past renewal date forward by its billing period until it lands in
 * the future. Returns a YYYY-MM-DD string.
 */
export function nextRenewalDate(dateStr, freq) {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00:00');
  if (d >= today) return dateStr; // already in the future
  while (d < today) {
    if      (freq === 'annual') d.setFullYear(d.getFullYear() + 1);
    else if (freq === 'weekly') d.setDate(d.getDate() + 7);
    else                        d.setMonth(d.getMonth() + 1);   // monthly default
  }
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dy}`;
}

// ─── Notification scheduling ──────────────────────────────────────────────────

/**
 * Schedule a local notification 3 days before the next renewal.
 * Identifier is `renewal_<subId>` so it can always be cancelled by ID without
 * persisting anything extra in Firestore.
 */
export async function scheduleRenewalReminder(sub) {
  if (Platform.OS === 'web') return;
  const next = nextRenewalDate(sub.renewalDate, sub.freq);
  if (!next) return;

  // Fire at 9 AM, 3 days before renewal
  const renewDay  = new Date(next + 'T09:00:00');
  const notifDate = new Date(renewDay);
  notifDate.setDate(notifDate.getDate() - 3);

  if (notifDate <= new Date()) return; // window already passed

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: `renewal_${sub.id}`,
      content: {
        title: 'Subscription Renewal',
        body:  `${sub.name} renews in 3 days - $${Number(sub.amount || 0).toFixed(2)}`,
        data:  { subscriptionId: sub.id, screen: 'ExpenseLog' },
      },
      trigger: { date: notifDate },
    });
  } catch (_) {}
}

/**
 * Cancel the scheduled reminder for one subscription.
 */
export async function cancelRenewalReminder(subId) {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(`renewal_${subId}`);
  } catch (_) {}
}

/**
 * Cancel all existing renewal notifications and reschedule them fresh.
 * Call this on screen focus to stay in sync after date changes.
 */
export async function rescheduleAllReminders(subscriptions) {
  if (Platform.OS === 'web') return;
  try {
    const existing = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      existing
        .filter(n => n.identifier.startsWith('renewal_'))
        .map(n => Notifications.cancelScheduledNotificationAsync(n.identifier))
    );
    await Promise.all(subscriptions.map(scheduleRenewalReminder));
  } catch (_) {}
}
