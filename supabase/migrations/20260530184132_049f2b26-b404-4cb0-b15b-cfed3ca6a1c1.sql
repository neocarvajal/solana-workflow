
CREATE TABLE public.workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL,
  name text NOT NULL DEFAULT 'Untitled workflow',
  json jsonb NOT NULL,
  schedule text NOT NULL DEFAULT 'manual',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflows TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflows TO authenticated;
GRANT ALL ON public.workflows TO service_role;

ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can manage workflows (MVP)" ON public.workflows
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

CREATE TABLE public.workflow_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid REFERENCES public.workflows(id) ON DELETE CASCADE,
  status text NOT NULL,
  trigger_data jsonb,
  output jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.workflow_runs TO anon;
GRANT SELECT, INSERT ON public.workflow_runs TO authenticated;
GRANT ALL ON public.workflow_runs TO service_role;

ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read runs (MVP)" ON public.workflow_runs
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public can insert runs (MVP)" ON public.workflow_runs
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE INDEX workflows_device_id_idx ON public.workflows(device_id);
CREATE INDEX workflow_runs_workflow_id_idx ON public.workflow_runs(workflow_id);
