
REVOKE EXECUTE ON FUNCTION public.credit_for_payment(TEXT, UUID, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_for_payment(TEXT, UUID, INTEGER, TEXT) TO service_role;
