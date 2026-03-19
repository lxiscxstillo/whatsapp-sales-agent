FROM wppconnect/server-cli:latest

WORKDIR /usr/src/wpp-server

# Update @wppconnect-team/wppconnect to latest compatible version
RUN npm install @wppconnect-team/wppconnect@latest --save 2>/dev/null || \
    npm install @wppconnect-team/wppconnect@1.41.1 --save

EXPOSE 21465

CMD ["node", "dist/server.js"]
