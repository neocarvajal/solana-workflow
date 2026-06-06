import React, { useState } from "react";
import { Sparkles, Loader2, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Workflow } from "@/lib/workflow";

const EXAMPLES = [
  "Si el precio de SOL baja a $80, envía 1 SOL a otra wallet",
  "Cada 15 minutos consulta el par BONK/SOL en DexScreener y mándame una alerta si el volumen sube de $100k",
  "Cuando llegue un webhook, haz un swap de 1 SOL a USDC en Jupiter",
  "Si JUP sube por encima de $1.20, envíame una notificación",
];

interface Props {
  onWorkflow: (wf: Workflow) => void;
}

const AiBuilder: React.FC<Props> = ({ onWorkflow }) => {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);

  const generate = async (text: string) => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-workflow", {
        body: { prompt: text },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.workflow) throw new Error("No workflow returned");
      toast.success("Workflow generated");
      onWorkflow(data.workflow as Workflow);
    } catch (e: any) {
      toast.error(e.message || "Failed to generate");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 h-full overflow-auto grid-pattern flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4">
            <Sparkles className="h-3.5 w-3.5" /> AI Builder
          </div>
          <h1 className="text-4xl font-bold gradient-text mb-2">¿Qué quieres automatizar?</h1>
          <p className="text-muted-foreground">
            Describe tu flujo en lenguaje natural — la IA lo convertirá en un workflow visual editable.
          </p>
        </div>

        <div className="relative">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ej: Si el precio de SOL baja a $80, envía 1 SOL a 7xKx...zU"
            rows={4}
            className="w-full p-4 pr-32 rounded-xl bg-card border border-border resize-none focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate(prompt);
            }}
          />
          <button
            onClick={() => generate(prompt)}
            disabled={loading || !prompt.trim()}
            className="absolute bottom-3 right-3 ai-button flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generate
          </button>
        </div>

        <div className="mt-6">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Ejemplos</div>
          <div className="grid sm:grid-cols-2 gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => { setPrompt(ex); generate(ex); }}
                disabled={loading}
                className="text-left p-3 rounded-lg border border-border bg-card hover:border-primary/60 hover:bg-muted transition text-sm flex items-start gap-2 disabled:opacity-50"
              >
                <ArrowRight className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                <span>{ex}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="text-center mt-8">
          <button
            onClick={() => onWorkflow({ name: "New workflow", trigger: { type: "schedule", params: { every: "15m" } }, steps: [] })}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            o empieza con un canvas vacío
          </button>
        </div>
      </div>
    </div>
  );
};

export default AiBuilder;
