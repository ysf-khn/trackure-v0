import { AlertCircle, CheckCircle, Info } from "lucide-react";

export type Message =
  | { success: string }
  | { error: string }
  | { message: string };

// Helper function to check if the message contains HTML
function containsHTML(text: string): boolean {
  return /<[^>]*>/.test(text);
}

export function FormMessage({ message }: { message: Message }) {
  if (!message || Object.keys(message).length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 w-full max-w-md text-sm mt-4">
      {"success" in message && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-green-950/20 border border-green-500/20 text-green-400">
          <CheckCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            {containsHTML(message.success) ? (
              <span
                dangerouslySetInnerHTML={{ __html: message.success }}
                className="[&_a]:underline [&_a]:font-medium [&_a]:transition-colors [&_a]:duration-200"
              />
            ) : (
              message.success
            )}
          </div>
        </div>
      )}
      {"error" in message && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-red-950/20 border border-red-500/20 text-red-400">
          <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            {containsHTML(message.error) ? (
              <span
                dangerouslySetInnerHTML={{ __html: message.error }}
                className="[&_a]:underline [&_a]:font-medium [&_a]:transition-colors [&_a]:duration-200 [&_a:hover]:brightness-110"
              />
            ) : (
              message.error
            )}
          </div>
        </div>
      )}
      {"message" in message && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-950/20 border border-blue-500/20 text-blue-400">
          <Info className="h-5 w-5 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            {containsHTML(message.message) ? (
              <span
                dangerouslySetInnerHTML={{ __html: message.message }}
                className="[&_a]:underline [&_a]:font-medium [&_a]:transition-colors [&_a]:duration-200 [&_a:hover]:brightness-110"
              />
            ) : (
              message.message
            )}
          </div>
        </div>
      )}
    </div>
  );
}
