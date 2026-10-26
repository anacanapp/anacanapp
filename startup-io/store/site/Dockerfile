FROM node:22-alpine
WORKDIR /app
COPY --chown=node:node . .
USER node
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server.mjs"]
