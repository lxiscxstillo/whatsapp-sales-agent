#!/bin/sh
set -e

# Ensure persistent directories exist inside the single volume
mkdir -p /data/tokens /data/userDataDir

# Symlink WPPConnect expected paths to the persistent volume
ln -sfn /data/tokens /usr/src/wpp-server/tokens
ln -sfn /data/userDataDir /usr/src/wpp-server/userDataDir

# Pass --secretKey from env var if available, falling back to the value in config.json
if [ -n "$WPPCONNECT_SECRET_KEY" ]; then
  exec node bin/wppserver.js --config /usr/src/wpp-server/config.json --secretKey "$WPPCONNECT_SECRET_KEY"
else
  exec node bin/wppserver.js --config /usr/src/wpp-server/config.json
fi
