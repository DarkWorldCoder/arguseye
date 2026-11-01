<script>
  import { PUBLIC_SITE_NAME } from "$env/static/public";
  import { env } from "$env/dynamic/public";
  import { browser, dev } from "$app/environment";
</script>
<span>{PUBLIC_SITE_NAME} / {env.PUBLIC_SITE_NAME} browser={browser} dev={dev}</span>
