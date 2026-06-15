import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-display uppercase tracking-wider",
  {
    variants: {
      variant: {
        pending: "bg-muted text-muted-foreground border border-border",
        confirmed: "bg-primary/15 text-primary border border-primary/40",
        cancelled: "bg-destructive/15 text-destructive border border-destructive/40",
        paid: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/40",
        unpaid: "bg-muted text-muted-foreground border border-border",
        outline: "border border-primary/50 text-primary",
      },
    },
    defaultVariants: { variant: "pending" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
