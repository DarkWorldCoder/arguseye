import { useRouter } from "next/router";
import Head from "next/head";
import Script from "next/script";

export function LegacyRouterInfo() {
  const router = useRouter();
  return (
    <>
      <Head><title>Blog post</title></Head>
      <Script src="https://analytics.example.test/tag.js" />
      <p>Pages router at {router.pathname} with slug {String(router.query.slug)}</p>
    </>
  );
}
