import { useEffect, useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface ActionDialogValues {
  reason: string;
  conditions: string;
  risk: boolean;
}

interface ActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  requireReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  showConditions?: boolean;
  conditionsLabel?: string;
  showRisk?: boolean;
  riskLabel?: string;
  children?: ReactNode;
  onConfirm: (values: ActionDialogValues) => void;
}

export function ActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  requireReason = true,
  reasonLabel = "Reason",
  reasonPlaceholder = "Record the reason. This is written to the append-only audit trail.",
  showConditions = false,
  conditionsLabel = "Conditions (if applicable)",
  showRisk = false,
  riskLabel = "Accept this finding with documented risk instead of resolving it",
  children,
  onConfirm,
}: ActionDialogProps) {
  const [reason, setReason] = useState("");
  const [conditions, setConditions] = useState("");
  const [risk, setRisk] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setReason("");
      setConditions("");
      setRisk(false);
      setError("");
    }
  }, [open]);

  const submit = () => {
    if (requireReason && !reason.trim()) {
      setError("A reason is required and will appear in the audit trail.");
      return;
    }
    onConfirm({ reason: reason.trim(), conditions: conditions.trim(), risk });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="action-reason">{reasonLabel}</Label>
            <Textarea
              id="action-reason"
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                setError("");
              }}
              placeholder={reasonPlaceholder}
              rows={3}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          {showConditions && (
            <div className="space-y-1.5">
              <Label htmlFor="action-conditions">{conditionsLabel}</Label>
              <Input
                id="action-conditions"
                value={conditions}
                onChange={(event) => setConditions(event.target.value)}
                placeholder="Conditions recorded with the decision"
              />
            </div>
          )}

          {showRisk && (
            <label className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-xs">
              <Checkbox
                checked={risk}
                onCheckedChange={(checked) => setRisk(checked === true)}
                className="mt-0.5"
              />
              <span>{riskLabel}</span>
            </label>
          )}

          {children}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button variant={destructive ? "destructive" : "default"} onClick={submit}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
