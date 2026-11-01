import { render } from "solid-js/web";
import { ThemeProvider } from "./theme";
import App from "./App";
import "./index.css";

render(() => <ThemeProvider><App /></ThemeProvider>, document.getElementById("root")!);
