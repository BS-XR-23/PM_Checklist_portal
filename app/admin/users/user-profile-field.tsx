"use client";

import { InlineText } from "@/components/ui/inline-edit";
import { updateUserProfile } from "./user-actions";

export function UserProfileField({ userId, field, value }: { userId: string; field: "name" | "email"; value: string }) {
  return <InlineText value={value} onSave={(v) => updateUserProfile(userId, { [field]: v })} />;
}
