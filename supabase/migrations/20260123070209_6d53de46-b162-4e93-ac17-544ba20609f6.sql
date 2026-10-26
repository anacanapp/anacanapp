-- Create a SECURITY DEFINER function to link partners bidirectionally
CREATE OR REPLACE FUNCTION public.link_partners(
  p_my_profile_id uuid,
  p_partner_profile_id uuid,
  p_partner_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Update the partner's profile to link back to me
  UPDATE public.profiles
  SET linked_partner_id = p_my_profile_id
  WHERE user_id = p_partner_user_id;
  
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error linking partners: %', SQLERRM;
    RETURN false;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.link_partners TO authenticated;