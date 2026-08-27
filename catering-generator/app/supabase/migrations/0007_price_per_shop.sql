-- One price per ingredient, per shop.
--
-- Until now an ingredient could hold exactly one price. That's the right shape
-- for a caterer with a wholesaler: brisket comes from the butcher, at the
-- butcher's price, and there is nothing to choose between.
--
-- It's the wrong shape for a town without one. In Mudgee the same job gets
-- shopped across Woolworths, Coles and Aldi, and the useful question is not
-- "what does brisket cost" but "what does it cost *here*, and which of the
-- three should I drive to". One row per item cannot answer that, and worse, it
-- overwrote silently: recording the Coles price erased the Aldi one.
--
-- So the key becomes (item, shop). Costing then takes the cheapest price it
-- can actually compare and names the shop on the line — see lib/costing.ts.
--
-- supplier becomes NOT NULL, defaulting to the empty string, rather than
-- staying nullable. Two reasons, one correctness and one practical. NULLs are
-- distinct from each other in a Postgres unique constraint, so a nullable
-- column would let unlimited shopless duplicates of the same item back in —
-- exactly the silent-overwrite bug wearing a different hat. And a unique index
-- over `coalesce(supplier, '')` would fix that but cannot be named as a
-- conflict target through PostgREST, which only takes plain column lists, so
-- every upsert in the app would have to become a read-then-write race.
--
-- '' means "no shop recorded", which is a real state: a price typed in before
-- you knew where you'd buy it is still a price.

update public.ingredient_prices set supplier = '' where supplier is null;

-- A DEFAULT only fires when the column is left out, not when NULL is passed
-- explicitly — and the currently deployed code passes NULL for "no shop". A
-- migration and a deploy cannot land at the same instant, so without this the
-- gap between them is a window where saving any price fails outright.
--
-- The trigger closes it, and keeps closing it: any client that sends NULL gets
-- the canonical empty string rather than an error.
create or replace function public.default_supplier_to_empty()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.supplier is null then
    new.supplier := '';
  end if;
  return new;
end;
$$;

revoke execute on function public.default_supplier_to_empty() from public, anon, authenticated;

create trigger ingredient_prices_supplier_not_null
  before insert or update on public.ingredient_prices
  for each row execute function public.default_supplier_to_empty();

alter table public.ingredient_prices
  alter column supplier set default '',
  alter column supplier set not null;

alter table public.ingredient_prices
  drop constraint ingredient_prices_user_id_item_key;

alter table public.ingredient_prices
  add constraint ingredient_prices_user_item_shop_key
  unique (user_id, item, supplier);
