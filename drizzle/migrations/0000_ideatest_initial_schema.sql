CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  credits integer NOT NULL DEFAULT 1 CHECK (credits >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read only their own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id AND ur.role = _role
      AND (_user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.user_roles own_role
        WHERE own_role.user_id = auth.uid() AND own_role.role = 'admin'
      ))
  );
$$;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
CREATE POLICY "Users read their own profile or admins read balances" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  idea_text text NOT NULL,
  country text NOT NULL,
  currency text NOT NULL,
  business_model text,
  model_confidence numeric,
  summary text,
  followup_questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  followup_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  cfo_inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ideas_business_model_check CHECK (business_model IS NULL OR business_model IN ('physical_product', 'b2b_saas', 'consumer_app', 'service_agency', 'marketplace', 'local_business'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ideas TO authenticated;
GRANT ALL ON public.ideas TO service_role;
ALTER TABLE public.ideas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read their own ideas" ON public.ideas FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users create their own ideas" ON public.ideas FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users edit their own ideas" ON public.ideas FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete their own ideas" ON public.ideas FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id uuid NOT NULL REFERENCES public.ideas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('quick', 'full')),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  stage text NOT NULL DEFAULT 'board',
  stage_progress integer NOT NULL DEFAULT 0 CHECK (stage_progress BETWEEN 0 AND 100),
  buyer_target integer NOT NULL CHECK (buyer_target IN (20, 100)),
  buyers_completed integer NOT NULL DEFAULT 0 CHECK (buyers_completed >= 0),
  credits_cost integer NOT NULL CHECK (credits_cost IN (1, 5)),
  credits_refunded boolean NOT NULL DEFAULT false,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.runs TO authenticated;
GRANT ALL ON public.runs TO service_role;
ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read their own runs" ON public.runs FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.board_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.runs(id) ON DELETE CASCADE,
  lens text NOT NULL CHECK (lens IN ('offer_strength', 'differentiation', 'product_craft')),
  score integer NOT NULL CHECK (score BETWEEN 1 AND 10),
  risks jsonb NOT NULL,
  kill_condition text NOT NULL,
  vote text NOT NULL CHECK (vote IN ('fund', 'fund_if', 'pass')),
  rationale text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, lens)
);
GRANT SELECT ON public.board_results TO authenticated;
GRANT ALL ON public.board_results TO service_role;
ALTER TABLE public.board_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read board results for their runs" ON public.board_results FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.runs r WHERE r.id = run_id AND r.user_id = auth.uid()));

CREATE TABLE public.panel_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.runs(id) ON DELETE CASCADE,
  persona_index integer NOT NULL,
  persona jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  claimed_at timestamptz,
  would_buy text CHECK (would_buy IN ('yes', 'no', 'maybe')),
  reason text,
  objection text,
  price_too_cheap numeric,
  price_cheap numeric,
  price_expensive numeric,
  price_too_expensive numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, persona_index)
);
GRANT SELECT ON public.panel_answers TO authenticated;
GRANT ALL ON public.panel_answers TO service_role;
ALTER TABLE public.panel_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read buyer answers for their runs" ON public.panel_answers FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.runs r WHERE r.id = run_id AND r.user_id = auth.uid()));

CREATE TABLE public.pricing_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL UNIQUE REFERENCES public.runs(id) ON DELETE CASCADE,
  point_of_marginal_cheapness numeric NOT NULL,
  point_of_marginal_expensiveness numeric NOT NULL,
  optimal_price_point numeric NOT NULL,
  indifference_price numeric NOT NULL,
  completed_responses integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pricing_results TO authenticated;
GRANT ALL ON public.pricing_results TO service_role;
ALTER TABLE public.pricing_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read pricing for their runs" ON public.pricing_results FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.runs r WHERE r.id = run_id AND r.user_id = auth.uid()));

CREATE TABLE public.cfo_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL UNIQUE REFERENCES public.runs(id) ON DELETE CASCADE,
  inputs jsonb NOT NULL,
  outputs jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cfo_results TO authenticated;
GRANT ALL ON public.cfo_results TO service_role;
ALTER TABLE public.cfo_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read economics for their runs" ON public.cfo_results FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.runs r WHERE r.id = run_id AND r.user_id = auth.uid()));

CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL UNIQUE REFERENCES public.runs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  verdict text NOT NULL CHECK (verdict IN ('promising', 'needs_work', 'not_viable_yet')),
  conditions jsonb NOT NULL,
  summary text NOT NULL,
  next_tests jsonb NOT NULL,
  buy_rate numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read their own reports" ON public.reports FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.create_profile_for_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, credits) VALUES (NEW.id, 1)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.create_profile_for_new_user() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER on_auth_user_created_ideatest
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.create_profile_for_new_user();

CREATE OR REPLACE FUNCTION public.start_idea_run(_idea_id uuid, _mode text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_credits integer;
  v_cost integer;
  v_buyers integer;
  v_active_count integer;
  v_run_id uuid;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Sign in is required.'; END IF;
  IF _mode = 'quick' THEN v_cost := 1; v_buyers := 20;
  ELSIF _mode = 'full' THEN v_cost := 5; v_buyers := 100;
  ELSE RAISE EXCEPTION 'Choose a valid run type.'; END IF;
  SELECT credits INTO v_credits FROM public.profiles WHERE user_id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Your account is not ready yet.'; END IF;
  SELECT count(*) INTO v_active_count FROM public.runs WHERE user_id = v_user_id AND status = 'running';
  IF v_active_count >= 3 THEN RAISE EXCEPTION 'You can have up to 3 active runs.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ideas WHERE id = _idea_id AND user_id = v_user_id) THEN RAISE EXCEPTION 'Idea not found.'; END IF;
  IF v_credits < v_cost THEN RAISE EXCEPTION 'Not enough credits for this run.'; END IF;
  UPDATE public.profiles SET credits = credits - v_cost WHERE user_id = v_user_id;
  INSERT INTO public.runs (idea_id, user_id, mode, buyer_target, credits_cost, status, stage)
  VALUES (_idea_id, v_user_id, _mode, v_buyers, v_cost, 'running', 'board') RETURNING id INTO v_run_id;
  RETURN v_run_id;
END;
$$;
REVOKE ALL ON FUNCTION public.start_idea_run(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_idea_run(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_panel_batch(_run_id uuid, _batch_size integer)
RETURNS TABLE (answer_id uuid, persona_index integer, persona jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.runs WHERE id = _run_id AND user_id = auth.uid() AND status = 'running') THEN
    RAISE EXCEPTION 'Run not found or is no longer active.';
  END IF;
  RETURN QUERY
  WITH candidate AS (
    SELECT p.id FROM public.panel_answers p
    WHERE p.run_id = _run_id AND (p.status = 'pending' OR (p.status = 'processing' AND p.claimed_at < now() - interval '2 minutes'))
    ORDER BY p.persona_index
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(_batch_size, 1), 5)
  )
  UPDATE public.panel_answers p
  SET status = 'processing', claimed_at = now(), updated_at = now()
  FROM candidate c WHERE p.id = c.id
  RETURNING p.id, p.persona_index, p.persona;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_panel_batch(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_panel_batch(uuid, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.fail_run_and_refund(_run_id uuid, _message text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run public.runs%ROWTYPE;
BEGIN
  SELECT * INTO v_run FROM public.runs WHERE id = _run_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Run not found.'; END IF;
  IF v_run.status <> 'running' OR v_run.credits_refunded THEN RETURN; END IF;
  UPDATE public.profiles SET credits = credits + v_run.credits_cost WHERE user_id = v_run.user_id;
  UPDATE public.runs SET status = 'failed', credits_refunded = true, error_message = left(_message, 500), updated_at = now() WHERE id = _run_id;
END;
$$;
REVOKE ALL ON FUNCTION public.fail_run_and_refund(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fail_run_and_refund(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_adjust_credits(_target_user_id uuid, _amount integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credits integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Only IdeaTest admins can add credits.'; END IF;
  IF _amount < 1 THEN RAISE EXCEPTION 'Enter a positive credit amount.'; END IF;
  UPDATE public.profiles SET credits = credits + _amount WHERE user_id = _target_user_id RETURNING credits INTO v_credits;
  IF NOT FOUND THEN RAISE EXCEPTION 'No IdeaTest account was found for that user.'; END IF;
  RETURN v_credits;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_adjust_credits(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_adjust_credits(uuid, integer) TO authenticated;