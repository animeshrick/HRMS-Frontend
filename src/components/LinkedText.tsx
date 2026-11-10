// Shows text and turns https:// addresses into links (for example the temporary payslip link from the assistant).
// Only https links are made clickable, and they open in a new tab without access to this page.
const LINK_PATTERN = /(https:\/\/[^\s]+)/g;

export function LinkedText({ text }: { text: string }) {
  const parts = text.split(LINK_PATTERN);
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <a key={index} href={part} target="_blank" rel="noopener noreferrer" className="break-all text-indigo-600 underline">
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </>
  );
}
