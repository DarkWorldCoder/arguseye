import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/** A shadcn dialog: closed, only the trigger shows; open, the content is in a portal outside the component. */
export function ConfirmDelete({ item, open }: { item: string; open?: boolean }) {
  return (
    <Dialog defaultOpen={open}>
      <DialogTrigger asChild><Button variant="destructive">Delete {item}</Button></DialogTrigger>
      <DialogContent>
        <DialogTitle className="text-lg font-semibold">Delete {item}?</DialogTitle>
        <DialogDescription className="mt-2 text-sm text-zinc-500">This cannot be undone.</DialogDescription>
        <div className="mt-6 flex justify-end gap-2"><Button variant="outline">Cancel</Button><Button variant="destructive">Delete</Button></div>
      </DialogContent>
    </Dialog>
  );
}
