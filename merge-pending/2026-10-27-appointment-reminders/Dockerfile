# Overlay on the live notification-jobs image (pass its digest as BASE at build time).
# Adds appointment reminders to the vitamin-reminders run; no other job file changes.
ARG BASE
FROM ${BASE}
WORKDIR /app
COPY send-appointment-reminders.mjs send-appointment-reminders.test.mjs send-vitamin-reminders.mjs /app/
RUN node --check send-vitamin-reminders.mjs \
 && node --test send-appointment-reminders.test.mjs > /tmp/test.log 2>&1 || (cat /tmp/test.log; exit 1); \
    rm -f /tmp/test.log send-appointment-reminders.test.mjs
