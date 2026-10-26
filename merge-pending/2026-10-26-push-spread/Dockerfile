FROM europe-west1-docker.pkg.dev/ninth-park-492111-m4/anacan-runtime/notification-jobs@sha256:c4ae47318db804324b45ce3ffa3a6d0b5b74a986f6ed952960838b00672ca0d8
WORKDIR /app
COPY send-daily-notifications.mjs send-daily-notifications.test.mjs /app/
RUN node --test send-daily-notifications.test.mjs > /tmp/test.log 2>&1 || (cat /tmp/test.log; exit 1); rm -f /tmp/test.log send-daily-notifications.test.mjs
