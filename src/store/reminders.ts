// Reminders without a server:
//  1. a calendar file with a repeating event — reliable on any phone or desktop, even when the app is closed;
//  2. a browser notification while the app (or its tab) is open;
//  3. an in-app banner when you open the app past your study time and haven't studied yet.
// Server push arrives with the optional backend in a later phase.
import { dayKey, getState, setState, type Reminder } from './store'

const NUDGES = [
  'Ten minutes of plasma today keeps the streak glowing.',
  'Your electrons are drifting. Come steer them.',
  'One problem, one card, one step closer to ignition.',
  'The Debye sphere misses you.',
  'A short session now beats a long one someday.',
]

export function nudge(): string {
  const d = new Date()
  return NUDGES[(d.getDate() + d.getMonth()) % NUDGES.length]
}

export function studiedToday(): boolean {
  return getState().streak.lastDay === dayKey()
}

/** True when today is a reminder day, the chosen time has passed and nothing was studied yet. */
export function reminderDue(r: Reminder = getState().reminder, now = new Date()): boolean {
  if (!r.enabled || !r.days.includes(now.getDay()) || studiedToday()) return false
  const [h, m] = r.time.split(':').map(Number)
  return now.getHours() * 60 + now.getMinutes() >= h * 60 + m
}

export async function requestNotifications(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof Notification === 'undefined') return 'unsupported'
  try {
    return await Notification.requestPermission()
  } catch {
    return 'unsupported'
  }
}

/** Called every minute while the app is open. */
export function tickReminder() {
  const s = getState()
  if (!reminderDue(s.reminder) || s.lastNotified === dayKey()) return
  setState((st) => {
    st.lastNotified = dayKey()
  })
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      new Notification('Debye · time to study', { body: nudge(), icon: 'icon.svg', tag: 'debye-daily' })
    } catch {
      /* some mobile browsers only allow notifications from a service worker */
    }
  }
}

const ICS_DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

/** A repeating calendar event with a built-in alarm. */
export function reminderIcs(r: Reminder, appUrl: string): string {
  const [h, m] = r.time.split(':')
  const start = new Date()
  const ymd = dayKey(start).replace(/-/g, '')
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')
  const days = r.days.length ? r.days.map((d) => ICS_DAYS[d]).join(',') : 'MO,TU,WE,TH,FR,SA,SU'
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Debye//Plasma Study//EN',
    'BEGIN:VEVENT',
    `UID:debye-study-${stamp}@debye.app`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${ymd}T${h}${m}00`,
    'DURATION:PT20M',
    `RRULE:FREQ=WEEKLY;BYDAY=${days}`,
    'SUMMARY:Plasma physics · Debye',
    `DESCRIPTION:${nudge()} ${appUrl}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Time to study plasma physics',
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n')
}

export function downloadIcs(r: Reminder) {
  const blob = new Blob([reminderIcs(r, location.href.split('#')[0])], { type: 'text/calendar' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'debye-study-reminder.ics'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}

/** Google Calendar link with the same weekly repeat; works where file downloads are blocked. */
export function googleCalendarUrl(r: Reminder, appUrl: string): string {
  const [h, m] = r.time.split(':').map(Number)
  const start = new Date()
  start.setHours(h, m, 0, 0)
  const end = new Date(start.getTime() + 20 * 60000)
  const fmt = (d: Date) => `${dayKey(d).replace(/-/g, '')}T${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}00`
  const days = (r.days.length ? r.days : [0, 1, 2, 3, 4, 5, 6]).map((d) => ICS_DAYS[d]).join(',')
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: 'Plasma physics · Debye',
    details: `${nudge()} ${appUrl}`,
    dates: `${fmt(start)}/${fmt(end)}`,
    recur: `RRULE:FREQ=WEEKLY;BYDAY=${days}`,
  })
  return `https://calendar.google.com/calendar/render?${q}`
}
