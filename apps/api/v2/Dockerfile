FROM node:20-alpine AS build

WORKDIR /calcom

RUN apk add --no-cache build-base python3 make
RUN ln -s /usr/lib/libssl.so.3 /lib/libssl.so.3

ENV NODE_ENV="production" \
    NODE_OPTIONS="--max-old-space-size=8192" \
    USE_POOL="true"

COPY . .

ARG DATABASE_URL
ARG DATABASE_DIRECT_URL

RUN yarn install
RUN yarn workspace @calcom/api-v2 run generate-schemas
RUN yarn workspace @calcom/api-v2 run build:docker

RUN echo "=== dist directories ===" && find /calcom -type d -name dist | sort
RUN echo "=== main.js files ===" && find /calcom -type f -name main.js | sort

FROM node:20-alpine AS runner

WORKDIR /calcom/apps/api/v2
COPY --from=build /calcom/dist/apps/api-v2 ./dist

EXPOSE 80

CMD [ "node", "dist/main.js" ]