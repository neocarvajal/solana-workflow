import React, { useState } from "react";
import { Sparkles, Loader2, ArrowRight, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { toast } from "sonner";
import { useRouter } from 'next/router';
import type { Workflow } from "@/lib/workflow";
import { workflowToNodes } from "@/lib/workflow";
import { setFlowNodes, setScenarioName, getSettings } from "@/lib/workflowStore";

const EXAMPLES = [
  "Si el precio de SOL sube por arriba de $60, transfiere 1 USDC a mi recipient",
  "Cada 15 minutos consulta el par BONK/SOL en DexScreener y mándame una alerta si el volumen sube de $100k",
  "Cuando llegue un webhook, haz un swap de 1 SOL a USDC en Jupiter",
  "Si JUP sube por encima de $1.20, envíame una notificación",
];

const Landing: React.FC = () => {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const { connected } = useWallet();
  const { setVisible } = useWalletModal();

  const ensureWalletConnected = () => {
    if (!connected) {
      toast.error("Por favor, conecta tu billetera para continuar");
      setVisible(true);
      return false;
    }
    return true;
  };

  const generate = async (text: string) => {
    if (!ensureWalletConnected()) return;
    if (!text.trim()) return;
    setLoading(true);
    try {
      const settings = getSettings();
      const contextPrompt = settings.recipientWallet
        ? `${text}\n\n[Context: default recipient wallet is ${settings.recipientWallet}, default alert channel is ${settings.alertChannel}]`
        : text;

      const { data, error } = await supabase.functions.invoke("generate-workflow", {
        body: { prompt: contextPrompt },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.workflow) throw new Error("No workflow returned");

      const wf = data.workflow as Workflow;

      console.log("JSON generado por la IA:", JSON.stringify(wf, null, 2));

      // Directly load generated workflow to canvas nodes
      const nodes = workflowToNodes(wf);
      setFlowNodes(nodes);
      setScenarioName(wf.name || "My Scenario");

      toast.success("Workflow generated & loaded!");
      router.push("/dashboard");
    } catch (e: any) {
      toast.error(e.message || "Failed to generate");
    } finally {
      setLoading(false);
    }
  };

  const startEmpty = () => {
    if (!ensureWalletConnected()) return;
    setFlowNodes([]);
    setScenarioName("New Scenario");
    router.push("/dashboard");
  };

  return (
    <div className="h-screen w-screen bg-background relative overflow-hidden flex flex-col">
      {/* Animated background orbs */}
      <div className="landing-orb landing-orb-1" />
      <div className="landing-orb landing-orb-2" />
      <div className="landing-orb landing-orb-3" />



      {/* Hero Content (Centered, No Scroll) */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 max-h-[calc(100vh-70px)] py-4 overflow-y-auto">
        <div className="w-full max-w-2xl flex flex-col justify-center">

          {/* Badge */}
          <div className="flex justify-center mb-4 md:mb-5">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[11px] font-semibold tracking-wide">
              <Sparkles className="h-3.5 w-3.5" />
              AI-POWERED WORKFLOW BUILDER
            </div>
          </div>

          {/* Title */}
          <h1 className="text-4xl md:text-5xl font-extrabold text-center mb-3 leading-tight tracking-tight">
            <span className="gradient-text">¿Qué quieres</span>
            <br />
            <span className="text-foreground">automatizar?</span>
          </h1>
          <p className="text-center text-muted-foreground text-sm md:text-base mb-6 max-w-md mx-auto">
            Describe tu flujo en lenguaje natural — la IA lo convertirá en un workflow visual editable en Solana.
          </p>

          {/* Prompt box */}
          <div className="landing-glass rounded-2xl p-2.5 flex flex-col bg-card/85 backdrop-blur-sm border border-border/40 shadow-xl">
            <textarea id="promptBox"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ej: Si el precio de SOL baja a $60, transfiere 1 SOL a mi recipient..."
              rows={3}
              disabled={loading}
              className="w-full bg-transparent border-0 resize-none focus:outline-none text-sm placeholder:text-muted-foreground/60 p-2 text-foreground"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  generate(prompt);
                }
              }}
            />
            <div className="flex items-center justify-between border-t border-border/10 pt-2.5 mt-1 px-1.5">
              <span className="text-[10px] md:text-[11px] text-muted-foreground/50 select-none">
                Presiona Ctrl + Enter para generar
              </span>
              <button
                onClick={() => generate(prompt)}
                disabled={loading || !prompt.trim()}
                className="ai-button flex items-center gap-2 disabled:opacity-40 text-xs py-1.5 px-4 font-semibold shrink-0"
              >
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                Generate
              </button>
            </div>
          </div>

          {/* Examples */}
          <div className="mt-6 md:mt-7">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-2.5 text-center font-medium">
              Prueba con un ejemplo
            </div>
            <div className="grid sm:grid-cols-2 gap-2.5">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => {
                    setPrompt(ex);
                    generate(ex);
                  }}
                  disabled={loading}
                  className="text-left p-3 rounded-xl border border-border/60 bg-card/40 backdrop-blur-sm hover:border-primary/40 hover:bg-card/70 transition-all duration-300 text-xs flex items-start gap-2.5 disabled:opacity-40 group"
                >
                  <ArrowRight className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary opacity-50 group-hover:opacity-100 transition-opacity" />
                  <span className="text-muted-foreground group-hover:text-foreground transition-colors line-clamp-2">
                    {ex}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Empty canvas CTA */}
          <div className="text-center mt-5 md:mt-6">
            <button
              onClick={startEmpty}
              disabled={loading}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
            >
              o empieza con un canvas vacío →
            </button>
          </div>

        </div>
      </main>
    </div>
  );
};

export default Landing;
