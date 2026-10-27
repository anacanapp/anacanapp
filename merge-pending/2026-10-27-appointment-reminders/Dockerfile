# Overlay on the live notification-jobs image (pass its digest as BASE at build time).
# Adds appointment reminders, the 5-minute vitamin slices with a per-slice sent guard and admin
# test sends to the vitamin run; no other job file changes.
ARG BASE
FROM ${BASE}
WORKDIR /app
COPY send-appointment-reminders.mjs send-vitamin-reminders.mjs vitamin-window.mjs run-notification-tests.mjs vitamin-guard.mjs \
     send-appointment-reminders.test.mjs vitamin-window.test.mjs run-notification-tests.test.mjs vitamin-guard.test.mjs /app/
# Fail the build if a local import of the job scripts is missing (node --check and node --test
# do not catch that: --test silently skips a test path that does not exist).
RUN set -e; \
    for f in send-vitamin-reminders.mjs send-appointment-reminders.mjs run-notification-tests.mjs vitamin-guard.mjs; do \
      node --check "$f"; \
      for dep in $(grep -oE "from '\./[^']+'" "$f" | cut -d"'" -f2); do test -f "$dep" || { echo "missing import $dep in $f"; exit 1; }; done; \
    done; \
    TESTS="send-appointment-reminders.test.mjs vitamin-window.test.mjs run-notification-tests.test.mjs vitamin-guard.test.mjs"; \
    for t in $TESTS; do test -f "$t" || { echo "missing test $t"; exit 1; }; done; \
    node --test $TESTS > /tmp/test.log 2>&1 || (cat /tmp/test.log; exit 1); \
    grep -q "pass 12" /tmp/test.log || { cat /tmp/test.log; echo "expected 12 passing tests"; exit 1; }; \
    rm -f /tmp/test.log $TESTS
