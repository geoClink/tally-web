import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { PushNotifications } from '@capacitor/push-notifications'
import { supabase } from './supabase'

const DAILY_NOTIF_ID = 1001
const CHANNEL_ID = 'daily-reminder'
const PREF_KEY = 'tally_daily_notif_scheduled'
const PUSH_REG_KEY = 'tally_push_registered'

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

// Call once after the user's first session save on iOS.
// Asks for APNs permission, gets the device token, and saves it to Supabase
// so admin push notifications can reach this device.
export async function registerPushNotifications() {
  if (Capacitor.getPlatform() !== 'ios') return
  if (localStorage.getItem(PUSH_REG_KEY)) return

  try {
    const { receive } = await PushNotifications.requestPermissions()
    if (receive !== 'granted') return

    // Wire up listeners before calling register() so we don't miss the event
    await PushNotifications.addListener('registration', async (token) => {
      // Sandbox tokens come from debug/TestFlight builds; production from App Store.
      // VITE_APNS_ENV defaults to 'production' — set to 'sandbox' in .env.local for dev.
      const environment = import.meta.env.VITE_APNS_ENV ?? 'production'

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      await supabase.from('device_tokens').upsert(
        { user_id: user.id, token: token.value, platform: 'ios', environment },
        { onConflict: 'user_id,token' }
      )

      localStorage.setItem(PUSH_REG_KEY, '1')
    })

    await PushNotifications.addListener('registrationError', () => {
      // Registration failed — we'll try again next session save
    })

    await PushNotifications.register()
  } catch {
    // Push registration is best-effort — never block the save flow
  }
}
