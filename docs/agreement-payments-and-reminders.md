# Agreement payments, renewals, and task scheduling

Open Agreements, or School > Agreements, and choose Payments (web) or Payments & balance (mobile).

- The existing advance is counted once, separately from later payments.
- Schedule an instalment with its amount and due date. Add an optional payment reference.
- Select Already received today to record a payment immediately, or confirm Mark received on a scheduled instalment later.
- Outstanding means agreement value minus the advance and received payments. Unscheduled balance also subtracts unpaid instalments already scheduled.
- Unpaid instalments can be removed. Received payments remain in the audit history.
- The old instalment count is a plan; payment dates are entered explicitly rather than inferred from that count.

Renewal reminders create normal tasks at the 30-, 15-, and 7-day milestones. Existing agreements first encountered within a milestone window receive the current reminder only. Tasks go to the school's assigned salesperson, falling back to an administrator. They appear in the web/mobile task list and use the existing mobile push notification registration. Failed push submissions are retried. Expired agreements do not generate new reminders; extending an agreement cancels its old pending renewal tasks.

Tasks now have Today, Overdue, Upcoming, Pending, Completed, and All views. Calendar-day filters use the device's local timezone. Rescheduling to another day preserves the local time. Mobile New Task also provides a local time picker, and web saves local date/time inputs as explicit timestamps.

Validation includes an isolated SQLite database with all migrations, payment allocation and receipt tests, concurrent request checks, renewal deduplication/cancellation, and task date filtering. Physical-device location/notification testing and a fresh mobile release are still needed before claiming that installed apps include the changes.
