FROM node:20-alpine AS build

WORKDIR /calcom

RUN apk add --no-cache build-base python3 make openssl
RUN ln -s /usr/lib/libssl.so.3 /lib/libssl.so.3 || true

ENV NODE_ENV=production \
    NODE_OPTIONS=--max-old-space-size=8192 \
    USE_POOL=true

COPY . .

ARG DATABASE_URL
ARG DATABASE_DIRECT_URL

RUN corepack enable
RUN yarn install
RUN yarn workspace @calcom/api-v2 run generate-schemas
RUN yarn workspace @calcom/api-v2 run build:docker
RUN yarn workspace @calcom/api-v2 run build

RUN echo "=== api v2 related files ===" && find /calcom -path "*/api/v2/*" | sort | head -400
RUN echo "=== dist directories ===" && find /calcom -type d -name dist | sort
RUN echo "=== app main candidates ===" && find /calcom -path "*/api/v2/*main.js" | sort

FROM node:20-alpine AS runner

WORKDIR /calcom/apps/api/v2

RUN apk add --no-cache openssl
RUN ln -s /usr/lib/libssl.so.3 /lib/libssl.so.3 || true

COPY --from=build /calcom/apps/api/v2/dist ./dist
COPY --from=build /calcom/node_modules /calcom/node_modules
COPY --from=build /calcom/package.json /calcom/package.json

EXPOSE 80

CMD ["node", "dist/apps/api/v2/src/main.js"]