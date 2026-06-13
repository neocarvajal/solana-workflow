-- 1. Crear tabla de workflows con todos los campos necesarios
CREATE TABLE IF NOT EXISTS public.workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_wallet text NOT NULL,
  cid text,
  onchain_signature text,
  name text NOT NULL DEFAULT 'Untitled workflow',
  json jsonb NOT NULL,
  schedule text NOT NULL DEFAULT 'manual',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Crear tabla de ejecuciones (workflow_runs)
CREATE TABLE IF NOT EXISTS public.workflow_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid REFERENCES public.workflows(id) ON DELETE CASCADE,
  status text NOT NULL,
  trigger_data jsonb,
  output jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Crear índices para optimizar las consultas por wallet y CID
CREATE INDEX IF NOT EXISTS workflows_owner_wallet_idx ON public.workflows(owner_wallet);
CREATE INDEX IF NOT EXISTS workflows_cid_idx ON public.workflows(cid);
CREATE INDEX IF NOT EXISTS workflow_runs_workflow_id_idx ON public.workflow_runs(workflow_id);

-- 4. Habilitar seguridad (RLS)
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;

-- 5. Crear políticas de acceso
-- Nota: Inicialmente abierta para facilitar el desarrollo, se debe restringir a owner_wallet = auth_user
DROP POLICY IF EXISTS "Public can manage workflows" ON public.workflows;
CREATE POLICY "Public can manage workflows" ON public.workflows
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public can manage runs" ON public.workflow_runs;
CREATE POLICY "Public can manage runs" ON public.workflow_runs
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

-- 6. Otorgar permisos a los roles de Supabase
GRANT ALL ON public.workflows TO anon, authenticated, service_role;
GRANT ALL ON public.workflow_runs TO anon, authenticated, service_role;