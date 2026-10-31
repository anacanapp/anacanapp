FROM europe-west1-docker.pkg.dev/ninth-park-492111-m4/anacan-runtime/notification-jobs@sha256:133332019c41180ac9a6b035be30e73307329cde84a9efa7c521198e47ae77c5
WORKDIR /app
COPY send-daily-notifications.mjs send-daily-notifications.test.mjs /app/
RUN node --test send-daily-notifications.test.mjs > /tmp/test.log 2>&1 || (cat /tmp/test.log; exit 1); grep -E "^# (pass|fail)" /tmp/test.log; test "$(grep -c '^# fail 0' /tmp/test.log)" = 1; rm -f /tmp/test.log send-daily-notifications.test.mjs
