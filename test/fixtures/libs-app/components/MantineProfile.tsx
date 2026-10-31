import { Badge, Button, Card, Group, Text } from "@mantine/core";

export function MantineProfile({ name, role }: { name: string; role: string }) {
  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder w={320}>
      <Group justify="space-between">
        <Text fw={600}>{name}</Text>
        <Badge color="teal">{role}</Badge>
      </Group>
      <Button color="teal" fullWidth mt="md">Message {name}</Button>
    </Card>
  );
}
