import { useTranslation } from "react-i18next";
export default function Greeting({ name = "Asha" }: { name?: string }) { const { t } = useTranslation(); return <h2>{t("greeting", { name })}</h2>; }
