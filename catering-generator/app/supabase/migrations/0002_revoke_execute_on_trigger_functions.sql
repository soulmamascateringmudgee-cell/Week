-- These are trigger functions. They run as the table owner and should never be
-- reachable from the REST API, so take EXECUTE away from every client role.
-- Without this, Supabase's security linter flags them as callable at
-- /rest/v1/rpc/<name> by anon and authenticated alike.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
