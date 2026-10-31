import { Button, Card, CardContent, Chip, Typography } from "@mui/material";

export function MuiPlan({ name, price }: { name: string; price: number }) {
  return (
    <Card sx={{ width: 320 }}>
      <CardContent>
        <Chip label="Popular" color="primary" size="small" />
        <Typography variant="h5" sx={{ mt: 1 }}>{name}</Typography>
        <Typography color="text.secondary">${price}/month</Typography>
        <Button variant="contained" sx={{ mt: 2 }}>Choose {name}</Button>
      </CardContent>
    </Card>
  );
}
