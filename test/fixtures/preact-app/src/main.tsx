import { render } from "preact";
import { ThemeProvider } from "./theme";
import { App } from "./App";
import "./style.css";

render(<ThemeProvider><App /></ThemeProvider>, document.getElementById("app")!);
