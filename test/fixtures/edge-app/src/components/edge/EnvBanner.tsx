declare const __APP_VERSION__: string;
export default function EnvBanner() { return <p>{import.meta.env.VITE_APP_TITLE} v{__APP_VERSION__} ({import.meta.env.MODE}) {process.env.NODE_ENV}</p>; }
