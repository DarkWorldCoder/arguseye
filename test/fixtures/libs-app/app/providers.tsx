"use client";
import { ThemeProvider as MuiThemeProvider, createTheme } from "@mui/material/styles";
import { MantineProvider } from "@mantine/core";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { ThemeProvider as StyledThemeProvider } from "styled-components";

const muiTheme = createTheme({ palette: { primary: { main: "rgb(124, 58, 237)" } } });
const styledTheme = { accent: "rgb(234, 88, 12)" };

/** Every library's provider, as a real app nests them. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MuiThemeProvider theme={muiTheme}>
      <MantineProvider>
        <ChakraProvider value={defaultSystem}>
          <StyledThemeProvider theme={styledTheme}>{children}</StyledThemeProvider>
        </ChakraProvider>
      </MantineProvider>
    </MuiThemeProvider>
  );
}
