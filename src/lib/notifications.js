import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'

const DAILY_NOTIF_ID = 1001
const CHANNEL_ID = 'daily-reminder'
const PREF_KEY = 'tally_daily_notif_scheduled'

// Call after saving the first session ever. Requests permission and schedules
// a daily 6pm nudge on native Android. No-ops on web (handled by Dashboard banner).
export async function scheduleDailyReminder() {
  if (!Capacitor.isNativePlatform()) return

  // Only schedule once — check a localStorage flag
  if (localStorage.getItem(PREF_KEY)) return

  try {
    const { display } = await LocalNotifications.requestPermissions()
    if (display !== 'granted') return

    // Android 8+ requires a channel to exist before scheduling
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Daily Reminder',
      description: 'Reminds you to log your hours each day',
      importance: 3, // IMPORTANCE_DEFAULT
      sound: 'default',
      vibration: true,
    })

    await LocalNotifications.schedule({
      notifications: [
        {
          id: DAILY_NOTIF_ID,
          title: 'Time to log your hours',
          body: "Don't forget to track your work today.",
          schedule: {
            on: { hour: 18, minute: 0 },
            repeats: true,
            allowWhileIdle: true,
          },
          smallIcon: 'ic_stat_tally',
          channelId: CHANNEL_ID,
        },
      ],
    })

    localStorage.setItem(PREF_KEY, '1')
  } catch {
    // Notification scheduling is best-effort — never block the save flow
  }
}
