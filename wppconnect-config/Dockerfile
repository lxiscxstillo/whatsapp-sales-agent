FROM wppconnect/server-cli:latest

WORKDIR /usr/src/wpp-server

# Update @wppconnect-team/wppconnect to latest compatible version
RUN npm install @wppconnect-team/wppconnect@latest --save 2>/dev/null || \
    npm install @wppconnect-team/wppconnect@1.41.1 --save

# Patch statusConnection middleware to skip phone validation for @lid (privacy mode) contacts.
# Without this, WPPConnect tries to validate the LID number as a @c.us phone, gets undefined,
# and returns 404 — blocking all message sends to privacy-mode WhatsApp accounts.
# Find the file dynamically in case the path changes between image versions.
RUN SC_FILE=$(find / -name statusConnection.js -path "*/middlewares/*" 2>/dev/null | head -1) && \
    if [ -z "$SC_FILE" ]; then \
      echo "WARNING: statusConnection.js not found — skipping @lid patch"; \
    else \
      sed -i \
        's/if(req\.body\.isGroup||req\.body\.isNewsletter)/if(req.body.isGroup||req.body.isNewsletter||req.body.isLid)/g' \
        "$SC_FILE" && \
      grep -q 'isLid' "$SC_FILE" && \
      echo "statusConnection.js patched OK at $SC_FILE" || \
      echo "WARNING: @lid pattern not found in $SC_FILE — already patched or changed upstream"; \
    fi

COPY config.json /usr/src/wpp-server/config.json
COPY start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 21465

ENTRYPOINT ["/start.sh"]
