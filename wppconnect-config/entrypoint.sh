#!/bin/sh
# Generates WPPConnect config.ts dynamically from environment variables
# then starts WPPConnect Server

set -e

CONFIG_PATH="/usr/src/wpp-server/config.ts"

echo "Generating WPPConnect config.ts..."

cat > "$CONFIG_PATH" << EOF
export default {
  secretKey: '${WPPCONNECT_SECRET_KEY:-changeme}',
  host: 'http://localhost',
  port: '21465',
  deviceName: 'Asesor Inmobiliario',
  poweredBy: 'WPPConnect-Server',
  tokenStoreType: 'file',
  customUserDataDir: './userDataDir/',
  webhook: {
    url: '${WEBHOOK_URL:-http://backend-api:3001/api/v1/webhook/message}',
    readMessage: true,
    listenAcks: false,
    allUnreadOnStart: false,
    ignore: ['status@broadcast'],
    onPresenceChanged: false,
    onParticipantsChanged: false,
    onReactionMessage: false,
    onPollResponse: false,
    onRevokedMessage: false,
  },
};
EOF

echo "config.ts generated at $CONFIG_PATH"
echo "Starting WPPConnect Server..."
exec node dist/server.js
