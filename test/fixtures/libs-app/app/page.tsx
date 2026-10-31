import { MuiPlan } from "@/components/MuiPlan";
import { MantineProfile } from "@/components/MantineProfile";
import { ChakraStat } from "@/components/ChakraStat";
import { StyledTag } from "@/components/StyledTag";
import { ConfirmDelete } from "@/components/ConfirmDelete";

export default function Page() {
  return (
    <main className="grid gap-6 p-10">
      <MuiPlan name="Pro" price={19} />
      <MantineProfile name="Asha Rai" role="Admin" />
      <ChakraStat label="Revenue" value="$48,210" />
      <StyledTag text="Beta" />
      <ConfirmDelete item="project" open />
    </main>
  );
}
