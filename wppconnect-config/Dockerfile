FROM wppconnect/server-cli:latest

WORKDIR /usr/src/wpp-server

# Update @wppconnect-team/wppconnect to latest compatible version
RUN npm install @wppconnect-team/wppconnect@latest --save 2>/dev/null || \
    npm install @wppconnect-team/wppconnect@1.41.1 --save

# Patch statusConnection middleware to skip phone validation for @lid (privacy mode) contacts.
# Without this, WPPConnect tries to validate the LID number as a @c.us phone, gets undefined,
# and returns 404 — blocking all message sends to privacy-mode WhatsApp accounts.
RUN sed -i \
    's/if(req\.body\.isGroup||req\.body\.isNewsletter)/if(req.body.isGroup||req.body.isNewsletter||req.body.isLid)/g' \
    dist/middlewares/statusConnection.js && \
    grep -q 'isLid' dist/middlewares/statusConnection.js && \
    echo "statusConnection.js patched OK" || \
    (echo "PATCH FAILED — pattern not found" && exit 1)

EXPOSE 21465

CMD ["node", "dist/server.js"]
