import React from "react";
import { Link } from "react-router-dom";
import { Zap } from "lucide-react";

const Documentation: React.FC = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center pt-12 px-4 md:px-8">
      <header className="w-full max-w-5xl flex items-center gap-4 mb-10">
        <div className="w-10 h-10 rounded-xl bg-gradient-purple-cyan flex items-center justify-center">
          <Zap className="h-6 w-6 text-white" />
        </div>
        <h1 className="text-3xl font-bold gradient-text">Solana Workflow</h1>
      </header>

      <main className="w-full max-w-4xl space-y-8">
        {/* Existing sections */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">¿Qué es?</h2>
          <p className="text-muted-foreground">
            Solana Workflow es una plataforma que permite crear automatizaciones simples para el ecosistema de Solana usando lenguaje natural e inteligencia artificial.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">¿Para quién está pensado?</h2>
          <ul className="list-disc list-inside text-muted-foreground space-y-2">
            <li>Usuarios nuevos en Solana que no saben programar.</li>
            <li>Traders que desean alertas y acciones automáticas.</li>
            <li>Builders y desarrolladores que quieren prototipar rápidamente.</li>
            <li>Personas interesadas en IA para interactuar con Web3.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Problema que resuelve</h2>
          <p className="text-muted-foreground">
            Automatizar tareas en Web3 suele requerir conocimientos de programación, contratos y APIs. Con Solana Workflow cualquier persona describe la tarea en texto y la IA genera y ejecuta el workflow.
          </p>
        </section>

        {/* New answer section */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">¿Cuál es la versión mínima que vamos a terminar?</h2>
          <p className="text-muted-foreground">
            La versión mínima (MVP) incluye las cuatro plantillas de workflow prediseñadas que pueden ser usadas directamente desde la DApp.
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2">
            <li><strong>Transferir SOL si el precio baja:</strong> Si el precio de SOL cae bajo un umbral, se transfiere una cantidad definida a una wallet de destino.</li>
            <li><strong>Swap al ocurrir un disparador:</strong> Cuando se cumple una condición (por ejemplo, precio de un token supera un valor), se ejecuta automáticamente un swap en Jupiter.</li>
            <li><strong>Consulta de par cada 15 min y alerta de volumen:</strong> Cada 15 minutos se consulta el par BONK/SOL en DexScreener y se envía una alerta si el volumen supera un umbral.</li>
            <li><strong>Alerta por movimiento de token:</strong> Si un token sube por encima de un precio o % especificado, se envía una notificación vía el canal seleccionado.</li>
          </ul>
        </section>

        {/* CTA */}
        <div className="text-center mt-8">
          <Link
            to="/"
            className="inline-block px-6 py-3 bg-primary text-white rounded-md hover:bg-primary/90 transition"
          >
            Empezar a usar la DApp
          </Link>
        </div>
      </main>
    </div>
  );
};

export default Documentation;
