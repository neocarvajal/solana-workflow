import React from "react";
import Link from "next/link";

const Documentation: React.FC = () => {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto bg-background px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-6 sm:px-6 sm:pt-10 md:px-8">
      <header className="mb-6 flex w-full max-w-5xl items-center gap-4 sm:mb-10">
        <h1 className="text-2xl font-bold gradient-text sm:text-3xl">Solana Workflow</h1>
      </header>
      <main className="w-full max-w-4xl space-y-6 sm:space-y-8">
        <section className="space-y-4">
          <h2 className="text-xl font-semibold sm:text-2xl">¿Qué es?</h2>
          <p className="text-muted-foreground">
            Solana Workflow es una plataforma que permite crear automatizaciones simples para el ecosistema de Solana usando lenguaje natural e inteligencia artificial.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold sm:text-2xl">Canales de alerta</h2>
          <p className="text-muted-foreground">
            El nodo <strong>Alert</strong> puede enviar notificaciones a distintos canales. Las alertas
            in-app aparecen en el centro de notificaciones de la app y se guardan en el navegador.
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2">
            <li><strong>In-App:</strong> badge de no leídas, historial y persistencia local.</li>
            <li><strong>Telegram:</strong> bot token y chat ID configurables.</li>
            <li><strong>Discord:</strong> webhook del servidor.</li>
            <li><strong>Email:</strong> envío con Resend y remitente verificado.</li>
            <li><strong>WhatsApp:</strong> Meta Cloud API o Twilio.</li>
          </ul>
          <p className="text-sm text-muted-foreground">
            Los canales externos se activan configurando los secretos del servidor. Consulta la
            sección <strong>Alert Channels</strong> del README para los pasos exactos.
          </p>
          <p className="text-muted-foreground">
            Los mensajes admiten datos del trigger: <code>{"{{asset}}"}</code>,{" "}
            <code>{"{{price}}"}</code>, <code>{"{{condition}}"}</code>,{" "}
            <code>{"{{value}}"}</code> y <code>{"{{timestamp}}"}</code>. Si el mensaje no incluye
            el precio, se añade automáticamente una línea como <strong>SOL: $95.20</strong>.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold sm:text-2xl">¿Para quién está pensado?</h2>
          <ul className="list-disc list-inside text-muted-foreground space-y-2">
            <li>Usuarios nuevos en Solana que no saben programar.</li>
            <li>Traders que desean alertas y acciones automáticas.</li>
            <li>Builders y desarrolladores que quieren prototipar rápidamente.</li>
            <li>Personas interesadas en IA para interactuar con Web3.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold sm:text-2xl">Problema que resuelve</h2>
          <p className="text-muted-foreground">
            Automatizar tareas en Web3 suele requerir conocimientos de programación, contratos y APIs. Con Solana Workflow cualquier persona describe la tarea en texto y la IA genera y ejecuta el workflow.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold sm:text-2xl">¿Cuál es la versión mínima que vamos a terminar?</h2>
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

        <div className="mt-8 text-center">
          <Link
            href="/"
            className="flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-8 py-3.5 font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:opacity-90 sm:inline-flex sm:w-auto"
          >
            Empezar a usar la DApp
          </Link>
        </div>
      </main>
    </div>
  );
};

export default Documentation;
