import React, { useRef } from "react";
import { Braces } from "lucide-react";

/** Variables available in Alert messages. Labels are shown on hover. */
export const ALERT_MESSAGE_VARIABLES = [
  { token: "price", label: "Precio del trigger" },
  { token: "asset", label: "Activo" },
  { token: "priceChange24h", label: "Cambio de precio en 24 h" },
  { token: "condition", label: "Condición del trigger" },
  { token: "value", label: "Umbral configurado" },
  { token: "timestamp", label: "Fecha y hora" },
  { token: "txUrl", label: "Enlace de la transacción en Solana Explorer" },
  { token: "explorerUrl", label: "Alias de txUrl" },
  { token: "txSignature", label: "Firma de la transacción" },
];

const TOKEN_SPLIT = /(\{\{\s*[\w.]+\s*\}\})/g;
const TOKEN_ONLY = /^\{\{\s*[\w.]+\s*\}\}$/;

function HighlightedMessage({ value }: { value: string }) {
  const parts = value.split(TOKEN_SPLIT);
  return (
    <>
      {parts.map((part, index) =>
        TOKEN_ONLY.test(part) ? (
          <span
            key={index}
            className="rounded bg-purple/20 font-semibold text-purple"
          >
            {part}
          </span>
        ) : (
          <React.Fragment key={index}>{part}</React.Fragment>
        ),
      )}
      {"\n"}
    </>
  );
}

type AlertMessageEditorProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

/**
 * Textarea with a mirrored layer that paints `{{variables}}` in purple while
 * typing, plus purple chips that insert a variable at the cursor position.
 */
export default function AlertMessageEditor({
  id,
  value,
  onChange,
  placeholder,
}: AlertMessageEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const insertVariable = (token: string) => {
    const textarea = textareaRef.current;
    const tokenText = `{{${token}}}`;
    const start = textarea?.selectionStart ?? value.length;
    const end = textarea?.selectionEnd ?? value.length;
    const next = `${value.slice(0, start)}${tokenText}${value.slice(end)}`;
    onChange(next);

    requestAnimationFrame(() => {
      if (!textarea) return;
      textarea.focus();
      const caret = start + tokenText.length;
      textarea.setSelectionRange(caret, caret);
    });
  };

  return (
    <div className="overflow-hidden rounded-lg border border-border/40 bg-muted/50 transition-all focus-within:ring-2 focus-within:ring-primary/50">
      <div className="relative">
        <div
          ref={overlayRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words px-3 py-3 font-mono text-base leading-6 sm:py-2.5 sm:text-sm"
        >
          <HighlightedMessage value={value} />
        </div>
        <textarea
          ref={textareaRef}
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onScroll={(event) => {
            if (overlayRef.current) {
              overlayRef.current.scrollTop = event.currentTarget.scrollTop;
            }
          }}
          placeholder={placeholder}
          rows={4}
          spellCheck={false}
          className="relative z-10 block w-full resize-none bg-transparent px-3 py-3 font-mono text-base leading-6 text-transparent caret-foreground placeholder:text-muted-foreground focus:outline-none sm:py-2.5 sm:text-sm"
        />
      </div>

      <div className="border-t border-border/40 bg-background/40 px-3 py-2.5">
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <Braces className="h-3.5 w-3.5 text-purple" />
          Variables del mensaje
          <span className="font-normal">· toca una para insertarla</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ALERT_MESSAGE_VARIABLES.map((variable) => (
            <button
              key={variable.token}
              type="button"
              title={variable.label}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => insertVariable(variable.token)}
              className="inline-flex items-center gap-0.5 rounded-full border border-purple/30 bg-purple/10 px-2 py-1 font-mono text-[11px] text-purple transition-colors hover:border-purple/60 hover:bg-purple/20 focus:outline-none focus:ring-2 focus:ring-purple/50"
            >
              <span className="opacity-60">{"{{"}</span>
              {variable.token}
              <span className="opacity-60">{"}}"}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">
          También puedes escribir <span className="font-mono text-purple">{"{{variable}}"}</span>: se resalta en morado al instante.
        </p>
      </div>
    </div>
  );
}
