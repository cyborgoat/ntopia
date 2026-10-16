import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { GadgetGrid } from "@/components/gadget-grid";

export const Route = createFileRoute("/_app/gadgets/")({ component: Gadgets });

function Gadgets() {
  return (
    <>
      <PageHeader title="Gadgets" />
      <GadgetGrid />
    </>
  );
}
