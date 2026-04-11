FROM node:20-alpine AS build

ARG DATABASE_DIRECT_URL
ARG DATABASE_URL

WORKDIR /calcom

RUN apk add --no-cache build-base python3 make
RUN set -eux;
RUN ln -s /usr/lib/libssl.so.3 /lib/libssl.so.3

ENV NODE_ENV="production"
ENV NODE_OPTIONS="--max-old-space-size=8192"
ENV DATABASE_DIRECT_URL=${DATABASE_DIRECT_URL}
ENV DATABASE_URL=${DATABASE_URL}
ENV USE_POOL="true"

# Copy the entire monorepo
COPY . .

# Install all dependencies for the entire workspace
RUN corepack enable
RUN yarn install --immutable --inline-builds

# Set environment variables for the build
ENV NODE_ENV="production"
ENV NODE_OPTIONS="--max-old-space-size=8192"
ENV DATABASE_DIRECT_URL=${DATABASE_DIRECT_URL}
ENV DATABASE_URL=${DATABASE_URL}
ENV USE_POOL="true"

# Build the specific api/v2 workspace
RUN yarn workspace @calcom/api-v2 run build:docker

# Final image
FROM node:20-alpine

WORKDIR /calcom

# Copy the built application from the build stage
COPY --from=build /calcom/apps/api/v2/dist /calcom/apps/api/v2/dist
COPY --from=build /calcom/node_modules /calcom/node_modules
COPY --from=build /calcom/package.json /calcom/

# Expose the port and start the application
EXPOSE 80
CMD ["node", "apps/api/v2/dist/apps/api/v2/src/main.js"]
