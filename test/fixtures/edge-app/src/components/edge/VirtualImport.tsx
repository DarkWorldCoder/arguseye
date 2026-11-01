import "virtual:svg-icons-register";
import { registerSW } from "virtual:pwa-register";

registerSW({ immediate: true });
export default function VirtualImport() { return <p>Rendered despite Vite plugin modules</p>; }
