
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.credit_for_payment(text, uuid, integer, text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.spend_credit(integer, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.spend_credit(integer, text) TO authenticated;
