const { z } = require('zod');

const Day = z.enum(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
const Hour = z.number().int().min(0).max(23);
const Minute = z.number().int().min(0).max(59);
const Timezone = z.string().min(1).max(80).refine((value) => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}, 'Use a valid IANA timezone');

const SameTimeSchedule = z.object({
  days: z.array(Day).min(1).max(7).transform((days) => [...new Set(days)]),
  time_mode: z.literal('same'),
  same_hour: Hour,
  same_minute: Minute,
}).strict();

const CustomTimeSchedule = z.object({
  days: z.array(Day).min(1).max(7).transform((days) => [...new Set(days)]),
  time_mode: z.literal('custom'),
  custom_times: z.array(z.object({ day: Day, hour: Hour, minute: Minute }).strict()).min(1).max(7),
}).strict().superRefine((schedule, ctx) => {
  const configured = new Set(schedule.custom_times.map((entry) => entry.day));
  if (configured.size !== schedule.custom_times.length) {
    ctx.addIssue({ code: 'custom', path: ['custom_times'], message: 'Each day may have only one time' });
  }
  for (const day of schedule.days) {
    if (!configured.has(day)) ctx.addIssue({ code: 'custom', path: ['custom_times'], message: `Missing time for ${day}` });
  }
  for (const day of configured) {
    if (!schedule.days.includes(day)) ctx.addIssue({ code: 'custom', path: ['custom_times'], message: `Time supplied for unselected day ${day}` });
  }
});

const AlertSchedule = z.union([SameTimeSchedule, CustomTimeSchedule]);
const AlertTime = z.string().datetime({ offset: true });

const CreateAlertSchema = z.object({
  routeId: z.string().uuid().nullable().optional().default(null),
  routeName: z.string().min(1).max(120).optional(),
  stopId: z.string().uuid(),
  stopName: z.string().min(1).max(120).optional(),
  alertTime: AlertTime.nullable().optional(),
  schedule: AlertSchedule.nullable().optional(),
  timezone: Timezone.default('Africa/Accra'),
  isActive: z.boolean().optional().default(true),
}).strict().superRefine((data, ctx) => {
  if (!data.alertTime && !data.schedule) {
    ctx.addIssue({ code: 'custom', path: ['alertTime'], message: 'Provide an alert time or recurring schedule' });
  }
});

const UpdateAlertSchema = z.object({
  alertTime: AlertTime.nullable().optional(),
  schedule: AlertSchedule.nullable().optional(),
  timezone: Timezone.optional(),
  isActive: z.boolean().optional(),
}).strict().refine((data) => Object.keys(data).length > 0, 'Provide at least one change');

module.exports = { AlertSchedule, CreateAlertSchema, UpdateAlertSchema };
