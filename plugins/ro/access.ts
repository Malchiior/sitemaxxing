// The owner administers this installation. Guests may chat and use only these
// measured-audit tools; arbitrary filesystem, shell, messaging, memory, browser,
// delegation and automation tools would bypass conversation-scoped reports.
const GUEST_TOOLS = new Set([
  "ro_check", "ro_check_pages", "ro_commands", "ro_greeting", "ro_fix_prompt", "ro_status",
]);
export function toolAccess(toolName: string, requester?: { senderId?: string; senderIsOwner?: boolean }) {
  const owner = Boolean(requester?.senderId) && requester?.senderIsOwner === true;
  if (owner || GUEST_TOOLS.has(toolName)) return;
  return {
    block: true as const,
    blockReason: toolName === "plow_start_thread"
      ? "Only the owner can send results to another number."
      : toolName === "ro_send_to_mac" || toolName.startsWith("plow_")
      ? "Only the owner can send results to their Mac."
      : "This conversation can use Sitemaxxing's website checks and reports, but only the owner can use other tools.",
  };
}
