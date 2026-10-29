#!/usr/bin/env bash
# Live 1:1 captures of the demo components (and a Vue component from the repo's fixtures) for the film.
set -e
cd "$(dirname "$0")/../.."
R=film/demo-app
cap() { node film/scripts/capture-live.mjs "$@" 2>&1 | tail -1; }
cap $R components/PricingCard.tsx "app/(marketing)/pricing/page.tsx" 390x844 pricing PricingCard '{"plan":"Pro","price":19,"features":["Unlimited projects","Priority support","Custom domains"],"highlighted":true}'
cap $R components/PricingCard.tsx "app/(marketing)/pricing/page.tsx" 600x900 pricing-starter PricingCard '{"plan":"Starter","price":0,"features":["3 projects","Community support"]}'
cap $R components/SignInForm.tsx "app/(auth)/sign-in/page.tsx" 600x900 signin SignInForm '{"product":"Acme"}'
cap $R components/StatsCard.tsx "app/(app)/dashboard/page.tsx" 600x900 stats StatsCard '{"label":"Weekly active users","value":"12,480","change":"+8.2%","points":[3,4,3.6,5,4.8,6.2,7,6.6,8.1,9]}'
cap $R components/Toast.tsx "app/(app)/dashboard/page.tsx" 600x900 toast Toast '{"title":"Deployed to production","detail":"acme-web · main · 41 files changed"}'
cap $R components/ProfileCard.tsx "app/(app)/dashboard/page.tsx" 600x900 profile ProfileCard '{"name":"Maya Chen","role":"Design lead","avatar":"/avatars/maya.svg","followers":2481}'
cap $R components/CommandMenu.tsx "app/(app)/dashboard/page.tsx" 600x900 command CommandMenu '{"query":"open sett","items":[{"label":"Open settings","hint":"⌘ ,"},{"label":"Open billing","hint":"G B"},{"label":"Open team","hint":"G T"}]}'
cap film/demo-vue src/components/UsageMeter.vue - 600x900 vue-meter default '{"label":"Storage","used":6.8,"total":10,"unit":"GB"}'
