import { Box, Button, Heading, Text } from "@chakra-ui/react";

export function ChakraStat({ label, value }: { label: string; value: string }) {
  return (
    <Box borderWidth="1px" borderRadius="lg" p="5" w="320px">
      <Text color="gray.500">{label}</Text>
      <Heading size="2xl">{value}</Heading>
      <Button colorPalette="blue" mt="3">View report</Button>
    </Box>
  );
}
