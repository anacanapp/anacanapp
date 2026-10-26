INSERT INTO translations (key, lang, value)
VALUES 
    ('community_header_bump', 'en', 'Connect with other expectant mothers'),
    ('community_header_mommy', 'en', 'Connect with other mothers'),
    ('community_header_flow', 'en', 'Connect with others trying to conceive'),
    ('communityscreen_cemiyyet_2dc44d', 'en', 'Community'),
    ('group_name_hamiləlik', 'en', 'Pregnancy'),
    ('group_desc_hamiləlik', 'en', 'Connect with other expectant mothers'),
    ('group_name_yeni_analar', 'en', 'New Mothers'),
    ('group_desc_yeni_analar', 'en', 'Share experiences about newborn care'),
    ('group_name_təcrübəli_analar', 'en', 'Experienced Mothers'),
    ('group_desc_təcrübəli_analar', 'en', 'Share advice and experiences'),
    ('group_name_məsləhət', 'en', 'Advice'),
    ('group_desc_məsləhət', 'en', 'Ask questions and get advice from mothers')
ON CONFLICT (key, lang) DO UPDATE 
SET value = EXCLUDED.value;
