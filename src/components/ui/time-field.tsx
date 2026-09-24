"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const hours = Array.from({ length: 24 }, (_, hour) =>
  String(hour).padStart(2, "0"),
);
const minutes = ["00", "15", "30", "45"];

export function TimeField({
  id,
  label,
  value,
  disabled = false,
  required = false,
  onValueChange,
}: {
  id: string;
  label: string;
  value: string;
  disabled?: boolean;
  required?: boolean;
  onValueChange: (value: string) => void;
}) {
  const [hour, minute] = value.split(":");

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5">
        <Select
          value={hour}
          disabled={disabled}
          required={required}
          onValueChange={(nextHour) => onValueChange(`${nextHour}:${minute}`)}
        >
          <SelectTrigger
            id={id}
            aria-label={`${label}: ora`}
            className="h-(--control-height) w-full min-w-0 bg-input/30 px-2 tabular-nums"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {hours.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span aria-hidden="true">:</span>
        <Select
          value={minute}
          disabled={disabled}
          required={required}
          onValueChange={(nextMinute) => onValueChange(`${hour}:${nextMinute}`)}
        >
          <SelectTrigger
            aria-label={`${label}: minutele`}
            className="h-(--control-height) w-full min-w-0 bg-input/30 px-2 tabular-nums"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {minutes.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
