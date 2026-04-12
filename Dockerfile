FROM --platform=$BUILDPLATFORM node:20 AS deps

WORKDIR /calcom

ARG TURBO_TOKEN
ARG TURBO_TEAM

COPY . .




FROM --platform=$BUILDPLATFORM node:20 AS builder

WORKDIR /calcom

ARG NEXT_PUBLIC_LICENSE_CONSENT
ARG NEXT_PUBLIC_WEBSITE_TERMS_URL
ARG NEXT_PUBLIC_WEBSITE_PRIVACY_POLICY_URL
ARG CALCOM_TELEMETRY_DISABLED
ARG DATABASE_URL
ARG NEXTAUTH_SECRET=secret
ARG CALENDSO_ENCRYPTION_KEY=secret
ARG MAX_OLD_SPACE_SIZE=8192
ARG NEXT_PUBLIC_API_V2_URL
ARG CSP_POLICY
ARG NEXT_PUBLIC_SINGLE_ORG_SLUG
ARG ORGANIZATIONS_ENABLED
ARG NEXT_PUBLIC_WEBAPP_URL_PLACEHOLDER

COPY --from=deps /calcom .

ENV NEXT_PUBLIC_WEBAPP_URL=$NEXT_PUBLIC_WEBAPP_URL_PLACEHOLDER \
  NEXT_PUBLIC_API_V2_URL=$NEXT_PUBLIC_API_V2_URL \
  NEXT_PUBLIC_LICENSE_CONSENT=$NEXT_PUBLIC_LICENSE_CONSENT \
  NEXT_PUBLIC_WEBSITE_TERMS_URL=$NEXT_PUBLIC_WEBSITE_TERMS_URL \
  NEXT_PUBLIC_WEBSITE_PRIVACY_POLICY_URL=$NEXT_PUBLIC_WEBSITE_PRIVACY_POLICY_URL \
  NEXTAUTH_URL=${NEXT_PUBLIC_WEBAPP_URL_PLACEHOLDER}/api/auth \
  DATABASE_URL=$DATABASE_URL \
  DATABASE_DIRECT_URL=$DATABASE_URL \
  NEXTAUTH_SECRET=${NEXTAUTH_SECRET} \
  CALENDSO_ENCRYPTION_KEY=${CALENDSO_ENCRYPTION_KEY} \
  NEXT_PUBLIC_SINGLE_ORG_SLUG=$NEXT_PUBLIC_SINGLE_ORG_SLUG \
  ORGANIZATIONS_ENABLED=$ORGANIZATIONS_ENABLED \
  NODE_OPTIONS=--max-old-space-size=${MAX_OLD_SPACE_SIZE} \
  BUILD_STANDALONE=true \
  CSP_POLICY=$CSP_POLICY

RUN corepack enable && corepack prepare yarn@4.12.0 --activate
RUN yarn config set httpTimeout 1200000
RUN yarn install

RUN yarn workspace @calcom/trpc run build
RUN yarn --cwd packages/embeds/embed-core workspace @calcom/embed-core run build
RUN yarn --cwd apps/web workspace @calcom/web run copy-app-store-static
RUN yarn --cwd apps/web workspace @calcom/web run build

RUN rm -rf node_modules/.cache .yarn/cache apps/web/.next/cache

COPY scripts scripts
RUN chmod +x scripts/*


FROM node:20 AS runner

WORKDIR /calcom

ENV NODE_ENV=production

RUN corepack enable

RUN apt-get update && apt-get install -y --no-install-recommends netcat-openbsd wget && rm -rf /var/lib/apt/lists/*

COPY --from=builder /calcom/apps/web/.next/standalone ./ 
COPY --from=builder /calcom/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /calcom/apps/web/public ./apps/web/public
COPY --from=builder /calcom/scripts ./scripts

ARG NEXT_PUBLIC_WEBAPP_URL_PLACEHOLDER

ARG NEXT_PUBLIC_WEBAPP_URL=$NEXT_PUBLIC_WEBAPP_URL_PLACEHOLDER

ENV NEXT_PUBLIC_WEBAPP_URL=$NEXT_PUBLIC_WEBAPP_URL \
  BUILT_NEXT_PUBLIC_WEBAPP_URL=$NEXT_PUBLIC_WEBAPP_URL_PLACEHOLDER

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=30s --retries=5 \
  CMD wget --spider http://localhost:3000 || exit 1

CMD ["/calcom/scripts/start.sh"]