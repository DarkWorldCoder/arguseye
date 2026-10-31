import { motion } from "framer-motion";
export default function FadeIn({ text = "Faded in with Framer Motion" }: { text?: string }) {
  return <motion.h2 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>{text}</motion.h2>;
}
