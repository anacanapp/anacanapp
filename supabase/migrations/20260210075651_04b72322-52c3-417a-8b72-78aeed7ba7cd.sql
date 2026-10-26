
-- Change trimester column from integer to integer array for multi-select
ALTER TABLE public.vitamins 
  ALTER COLUMN trimester TYPE integer[] 
  USING CASE 
    WHEN trimester IS NULL THEN NULL
    WHEN trimester = 0 THEN ARRAY[1,2,3]::integer[]
    ELSE ARRAY[trimester]::integer[]
  END;
