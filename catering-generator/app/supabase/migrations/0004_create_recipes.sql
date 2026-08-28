-- Recipes: the operator's own dishes, in their own quantities.
--
-- This is the point where the app stops guessing. The built-in tables say a
-- side is "roughly 170 g a head"; a recipe says "2 bunches of broccolini and
-- 80 g of almonds for 10 people", which is the real number and always beats
-- the table.
--
-- Quantities are written the way a chef writes them: what you BUY for a stated
-- number of people. No yield maths is applied on top — a recipe saying 5 kg of
-- brisket means order 5 kg, because that is what you already worked out.
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  -- Free text: "Main", "Side", "Sauce", "Dessert". Only used for grouping.
  course text,
  -- How many people the quantities below are written for.
  serves integer not null check (serves between 1 and 10000),
  -- [{ item, qty, unit, category }]
  ingredients jsonb not null default '[]'::jsonb,
  method text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index recipes_user_name_idx on public.recipes (user_id, name);

create trigger recipes_touch_updated_at
  before update on public.recipes
  for each row execute function public.touch_updated_at();

alter table public.recipes enable row level security;

create policy "own recipes are readable"
  on public.recipes for select
  to authenticated
  using ((select auth.uid()) = user_id and (select public.is_invited()));

create policy "own recipes are insertable"
  on public.recipes for insert
  to authenticated
  with check ((select auth.uid()) = user_id and (select public.is_invited()));

create policy "own recipes are updatable"
  on public.recipes for update
  to authenticated
  using ((select auth.uid()) = user_id and (select public.is_invited()))
  with check ((select auth.uid()) = user_id and (select public.is_invited()));

create policy "own recipes are deletable"
  on public.recipes for delete
  to authenticated
  using ((select auth.uid()) = user_id and (select public.is_invited()));
