-- 20260629000000_seed_major_vaccine_countries.sql
-- Seed script for 26 countries vaccine schedules

BEGIN;

DELETE FROM public.vaccine_countries WHERE code IN ('TR', 'US', 'GB', 'DE', 'RU', 'FR', 'IT', 'ES', 'CA', 'AU', 'AE', 'SA', 'KZ', 'GE', 'UA', 'UZ', 'IN', 'CN', 'JP', 'KR', 'BR', 'PL', 'IL', 'SE', 'CH', 'ZA');

INSERT INTO public.vaccine_countries (id, code, name_az, name_en, flag_emoji, source_url, source_label, sort_order)
VALUES ('eb0c7fcc-5857-4d8a-8a48-0d75e2caf966', 'TR', 'Türkiyə', 'Turkey', '🇹🇷', 'https://saglik.gov.tr', 'T.C. Sağlık Bakanlığı', 10);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('defb5835-2364-4d4b-91c8-51140ad7130a', 'TR', 'HepB', 'Hepatit B', 'Hepatitis B', 'Hepatit B virusu', 'Hepatitis B virus', 'Əzələdaxili', 'Intramuscular', '#3B82F6', true, 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('efc4ac52-aba6-49ca-b1a5-5fdaaaba1062', 'defb5835-2364-4d4b-91c8-51140ad7130a', 'TR', 1, '1-ci doza', '1st dose', 0, 'Doğulanda', 'At birth', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('947567b2-7e79-45ae-a2cf-42b9536df0f5', 'defb5835-2364-4d4b-91c8-51140ad7130a', 'TR', 2, '2-ci doza', '2nd dose', 30, '1 aylıq', '1 month', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('c10f5102-ca71-4b37-9e59-445a16778568', 'defb5835-2364-4d4b-91c8-51140ad7130a', 'TR', 3, '3-ci doza', '3rd dose', 180, '6 aylıq', '6 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('523c6777-79dd-4dfd-ab2e-34a8fb4ba540', 'TR', 'BCG', 'Vərəm (BCG)', 'Tuberculosis (BCG)', 'Vərəm', 'Tuberculosis', 'Dəridaxili', 'Intradermal', '#10B981', true, 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('433f1df0-41de-4f16-95fa-0221f068c380', '523c6777-79dd-4dfd-ab2e-34a8fb4ba540', 'TR', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('2a24b21f-7d5c-4048-b3ce-f7e04b7b4bb9', 'TR', 'DTaP', 'Göy öskürək, difteriya, tetanoz', 'Diphtheria, Tetanus, Pertussis', 'Göy öskürək, difteriya, tetanoz', 'Diphtheria, Tetanus, Pertussis', 'Əzələdaxili', 'Intramuscular', '#EF4444', true, 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('a608ede4-1df1-48ae-80af-5d0832c51eee', '2a24b21f-7d5c-4048-b3ce-f7e04b7b4bb9', 'TR', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('3f7abc8b-7b28-4a91-a249-39666d246dd0', '2a24b21f-7d5c-4048-b3ce-f7e04b7b4bb9', 'TR', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('49297be1-c76c-4900-ac2f-7b514e9235eb', '2a24b21f-7d5c-4048-b3ce-f7e04b7b4bb9', 'TR', 3, '3-ci doza', '3rd dose', 180, '6 aylıq', '6 months', 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('9c02a56a-3935-4696-b480-93cec3f8c192', '2a24b21f-7d5c-4048-b3ce-f7e04b7b4bb9', 'TR', 4, '4-ci doza', '4th dose', 540, '18 aylıq', '18 months', 13);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('218cf644-e85e-4f08-858e-0b270d713466', 'TR', 'IPV', 'Poliomielit (IPV)', 'Polio (IPV)', 'Poliomielit', 'Poliomyelitis', 'Əzələdaxili', 'Intramuscular', '#F59E0B', true, 13);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('9582ad06-4f02-4296-b75f-32e6e524e2be', '218cf644-e85e-4f08-858e-0b270d713466', 'TR', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('dee7e511-b2ba-420c-b759-e6592047a75d', '218cf644-e85e-4f08-858e-0b270d713466', 'TR', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('1dbdc246-570e-4e2d-acbd-7c735676f778', '218cf644-e85e-4f08-858e-0b270d713466', 'TR', 3, '3-ci doza', '3rd dose', 180, '6 aylıq', '6 months', 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('cfc6e10a-a299-42c5-ad7e-26f6c2076b5a', '218cf644-e85e-4f08-858e-0b270d713466', 'TR', 4, '4-ci doza', '4th dose', 540, '18 aylıq', '18 months', 13);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('8f626b94-5bc3-4654-8f60-1526298ae98a', 'TR', 'HiB', 'Hib infeksiyası', 'Haemophilus influenzae type b', 'Meningit, pnevmoniya', 'Meningitis, pneumonia', 'Əzələdaxili', 'Intramuscular', '#8B5CF6', true, 14);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('4e94cba6-0712-468e-9fc0-9fb644f49cbe', '8f626b94-5bc3-4654-8f60-1526298ae98a', 'TR', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('eafb6b18-a32e-40f9-a647-3e4e70e8cf56', '8f626b94-5bc3-4654-8f60-1526298ae98a', 'TR', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('e4e6426e-d81d-44fc-8559-dbb1dba21c09', '8f626b94-5bc3-4654-8f60-1526298ae98a', 'TR', 3, '3-ci doza', '3rd dose', 180, '6 aylıq', '6 months', 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('d8303a23-c61e-4eaa-b5b3-1aa1b3bf0206', '8f626b94-5bc3-4654-8f60-1526298ae98a', 'TR', 4, '4-ci doza', '4th dose', 540, '18 aylıq', '18 months', 13);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('c9aeee52-f779-4f17-b3c2-967a3df43666', 'TR', 'PCV', 'Pnevmokokk', 'Pneumococcal', 'Pnevmoniya, meningit', 'Pneumonia, meningitis', 'Əzələdaxili', 'Intramuscular', '#EC4899', true, 15);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('e5ffbfc4-3f3e-4100-8867-637ac796ac2b', 'c9aeee52-f779-4f17-b3c2-967a3df43666', 'TR', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('3e06942a-fab7-4bbe-b387-ad8c9644f677', 'c9aeee52-f779-4f17-b3c2-967a3df43666', 'TR', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('6ea06f87-eb58-426f-9b46-12ce6f9e4606', 'c9aeee52-f779-4f17-b3c2-967a3df43666', 'TR', 3, '3-ci doza', '3rd dose', 365, '12 aylıq', '12 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('acb13f3b-3ac6-4428-b7c0-97637429fcc4', 'TR', 'MMR', 'Qızılca, parotit, məxmərək', 'Measles, Mumps, Rubella', 'Qızılca, parotit, məxmərək', 'Measles, Mumps, Rubella', 'Dərialtı', 'Subcutaneous', '#F43F5E', true, 16);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('f69cd8cf-f34b-4948-84c7-a9e3a84a0495', 'acb13f3b-3ac6-4428-b7c0-97637429fcc4', 'TR', 1, '1-ci doza', '1st dose', 365, '12 aylıq', '12 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('9fae71e5-1c7f-4b9d-b7f3-bdff3e923397', 'acb13f3b-3ac6-4428-b7c0-97637429fcc4', 'TR', 2, '2-ci doza', '2nd dose', 1460, '48 aylıq', '48 months', 11);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('b0e3dabe-7575-4ef7-bb2e-dc7c7b1fd233', 'TR', 'VAR', 'Su çiçəyi', 'Varicella (Chickenpox)', 'Su çiçəyi', 'Chickenpox', 'Dərialtı', 'Subcutaneous', '#6366F1', true, 17);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('0bdefc69-c4bb-411c-a835-dd87d79b85ea', 'b0e3dabe-7575-4ef7-bb2e-dc7c7b1fd233', 'TR', 1, '1-ci doza', '1st dose', 365, '12 aylıq', '12 months', 10);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('fa605188-8c53-4f1a-8179-3f0eca19cadd', 'TR', 'HepA', 'Hepatit A', 'Hepatitis A', 'Hepatit A virusu', 'Hepatitis A virus', 'Əzələdaxili', 'Intramuscular', '#3B82F6', true, 18);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('517d139c-3a3c-4611-bb82-63dacfa24fb7', 'fa605188-8c53-4f1a-8179-3f0eca19cadd', 'TR', 1, '1-ci doza', '1st dose', 540, '18 aylıq', '18 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('5e673ae0-53d9-40fd-895a-0e2f576a358d', 'fa605188-8c53-4f1a-8179-3f0eca19cadd', 'TR', 2, '2-ci doza', '2nd dose', 730, '24 aylıq', '24 months', 11);
INSERT INTO public.vaccine_countries (id, code, name_az, name_en, flag_emoji, source_url, source_label, sort_order)
VALUES ('33e54a19-5ab8-4ed6-807e-7a14313c77f0', 'US', 'ABŞ', 'USA', '🇺🇸', 'https://www.cdc.gov/vaccines/schedules/', 'CDC', 11);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('37ded723-77e1-44b6-8101-17856a7dbf5c', 'US', 'HepB', 'Hepatit B', 'Hepatitis B', 'Hepatit B virusu', 'Hepatitis B virus', 'Əzələdaxili', 'Intramuscular', '#3B82F6', true, 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('c3d18b3a-e600-479f-b20f-9838359d5fc4', '37ded723-77e1-44b6-8101-17856a7dbf5c', 'US', 1, '1-ci doza', '1st dose', 0, 'Doğulanda', 'At birth', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('c68340b8-43d8-435f-9632-8ecac48ccd9e', '37ded723-77e1-44b6-8101-17856a7dbf5c', 'US', 2, '2-ci doza', '2nd dose', 60, '2 aylıq', '2 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('c8038f72-d050-434e-8f92-e4f1c70b8f33', '37ded723-77e1-44b6-8101-17856a7dbf5c', 'US', 3, '3-ci doza', '3rd dose', 180, '6 aylıq', '6 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('fde64254-7f8c-4299-b6e1-bebd72ddffda', 'US', 'RV', 'Rotavirus', 'Rotavirus', 'Rotavirus ishalı', 'Rotavirus diarrhea', 'Ağızdan', 'Oral', '#14B8A6', true, 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('521b5e32-dd67-41fa-8de1-f48339a61788', 'fde64254-7f8c-4299-b6e1-bebd72ddffda', 'US', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('2b718471-38d3-41d4-a5ab-8836159d9f60', 'fde64254-7f8c-4299-b6e1-bebd72ddffda', 'US', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('4da3cbe3-b982-46da-8ae7-5cf8cb0efbd9', 'fde64254-7f8c-4299-b6e1-bebd72ddffda', 'US', 3, '3-ci doza', '3rd dose', 180, '6 aylıq', '6 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('ca528915-0fb7-4a58-9abe-c7d034def098', 'US', 'DTaP', 'Göy öskürək, difteriya, tetanoz', 'Diphtheria, Tetanus, Pertussis', 'Göy öskürək, difteriya, tetanoz', 'Diphtheria, Tetanus, Pertussis', 'Əzələdaxili', 'Intramuscular', '#EF4444', true, 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('8f37959f-31bb-46ad-9e9d-d38f49fe821d', 'ca528915-0fb7-4a58-9abe-c7d034def098', 'US', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('854e1fd2-3820-4348-b1c7-b7762b7ee8d6', 'ca528915-0fb7-4a58-9abe-c7d034def098', 'US', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('202e1264-781d-451e-89ff-bd97885ac0bf', 'ca528915-0fb7-4a58-9abe-c7d034def098', 'US', 3, '3-ci doza', '3rd dose', 180, '6 aylıq', '6 months', 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('f276ce72-752d-4a85-8cbc-0b42c5988cbf', 'ca528915-0fb7-4a58-9abe-c7d034def098', 'US', 4, '4-ci doza', '4th dose', 450, '15 aylıq', '15 months', 13);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('704eb388-ed23-475b-827e-91b8028a5e18', 'US', 'HiB', 'Hib infeksiyası', 'Haemophilus influenzae type b', 'Meningit, pnevmoniya', 'Meningitis, pneumonia', 'Əzələdaxili', 'Intramuscular', '#8B5CF6', true, 13);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('b7036394-dfd6-4b47-be01-e79d0798d1ea', '704eb388-ed23-475b-827e-91b8028a5e18', 'US', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('283d556e-b31a-4a89-a853-3dd4ea344605', '704eb388-ed23-475b-827e-91b8028a5e18', 'US', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('4c3a886b-bb8a-4118-9a03-a0b484576ad5', '704eb388-ed23-475b-827e-91b8028a5e18', 'US', 3, '3-ci doza', '3rd dose', 180, '6 aylıq', '6 months', 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('023c5790-fb1c-4666-b3e0-aa36402f8967', '704eb388-ed23-475b-827e-91b8028a5e18', 'US', 4, '4-ci doza', '4th dose', 365, '12 aylıq', '12 months', 13);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('43fe7d25-9e24-417b-91b5-09d6c754c6e0', 'US', 'PCV', 'Pnevmokokk', 'Pneumococcal', 'Pnevmoniya, meningit', 'Pneumonia, meningitis', 'Əzələdaxili', 'Intramuscular', '#EC4899', true, 14);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('166b313b-9d25-415d-8d4a-6dfed0a19adf', '43fe7d25-9e24-417b-91b5-09d6c754c6e0', 'US', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('45d94e6a-aa77-4a67-9298-33e150afc909', '43fe7d25-9e24-417b-91b5-09d6c754c6e0', 'US', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('6130907d-be1a-445c-b3bf-ef82ba5b3bbe', '43fe7d25-9e24-417b-91b5-09d6c754c6e0', 'US', 3, '3-ci doza', '3rd dose', 180, '6 aylıq', '6 months', 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('54cd5276-b660-4f01-a2f8-29fe4b4a97fd', '43fe7d25-9e24-417b-91b5-09d6c754c6e0', 'US', 4, '4-ci doza', '4th dose', 365, '12 aylıq', '12 months', 13);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('28744395-0689-49ef-a0cc-6987671eb91d', 'US', 'IPV', 'Poliomielit (IPV)', 'Polio (IPV)', 'Poliomielit', 'Poliomyelitis', 'Əzələdaxili', 'Intramuscular', '#F59E0B', true, 15);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('ebcc1022-e438-4827-83d0-5aebc57396b6', '28744395-0689-49ef-a0cc-6987671eb91d', 'US', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('94d8d279-b598-4986-8fbc-c5ac72ba1cfe', '28744395-0689-49ef-a0cc-6987671eb91d', 'US', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('ae0f4f85-23b6-4d06-95f5-8f313550aced', '28744395-0689-49ef-a0cc-6987671eb91d', 'US', 3, '3-ci doza', '3rd dose', 180, '6 aylıq', '6 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('d8d686bc-5b0b-41a6-aadc-62e37d2ef291', 'US', 'MMR', 'Qızılca, parotit, məxmərək', 'Measles, Mumps, Rubella', 'Qızılca, parotit, məxmərək', 'Measles, Mumps, Rubella', 'Dərialtı', 'Subcutaneous', '#F43F5E', true, 16);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('25149d68-0714-4ddc-aba9-7966a4855dd0', 'd8d686bc-5b0b-41a6-aadc-62e37d2ef291', 'US', 1, '1-ci doza', '1st dose', 365, '12 aylıq', '12 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('512ceb52-b041-456a-a92d-954524c06bfe', 'd8d686bc-5b0b-41a6-aadc-62e37d2ef291', 'US', 2, '2-ci doza', '2nd dose', 1460, '4-6 yaş', '4-6 years', 11);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('390f4b33-5c7d-42a8-9798-239ab2ea055b', 'US', 'VAR', 'Su çiçəyi', 'Varicella (Chickenpox)', 'Su çiçəyi', 'Chickenpox', 'Dərialtı', 'Subcutaneous', '#6366F1', true, 17);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('fc592c02-1437-4b2c-8976-f84994ed1078', '390f4b33-5c7d-42a8-9798-239ab2ea055b', 'US', 1, '1-ci doza', '1st dose', 365, '12 aylıq', '12 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('2a12f41f-0ae9-4eb1-b232-b7488e34a6ac', '390f4b33-5c7d-42a8-9798-239ab2ea055b', 'US', 2, '2-ci doza', '2nd dose', 1460, '4-6 yaş', '4-6 years', 11);
INSERT INTO public.vaccine_countries (id, code, name_az, name_en, flag_emoji, source_url, source_label, sort_order)
VALUES ('b746cef8-6a92-45c3-aed4-8e3186bbf490', 'GB', 'Böyük Britaniya', 'United Kingdom', '🇬🇧', 'https://www.nhs.uk/conditions/vaccinations/', 'NHS', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('95e4082d-a12e-42d6-8733-251eb82537e7', 'GB', 'DTaP', 'Göy öskürək, difteriya, tetanoz', 'Diphtheria, Tetanus, Pertussis', 'Göy öskürək, difteriya, tetanoz', 'Diphtheria, Tetanus, Pertussis', 'Əzələdaxili', 'Intramuscular', '#EF4444', true, 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('650fbd83-1ef0-4b77-bd22-1358c1681dbf', '95e4082d-a12e-42d6-8733-251eb82537e7', 'GB', 1, '1-ci doza', '1st dose', 60, '8 həftə', '8 weeks', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('9f33cf01-666b-4c0a-a09c-dfa1d9044e01', '95e4082d-a12e-42d6-8733-251eb82537e7', 'GB', 2, '2-ci doza', '2nd dose', 90, '12 həftə', '12 weeks', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('958fb877-44a1-4cfc-99b4-d46c9b085a01', '95e4082d-a12e-42d6-8733-251eb82537e7', 'GB', 3, '3-ci doza', '3rd dose', 120, '16 həftə', '16 weeks', 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('f563b4a2-ed1f-4d60-8a61-7ce34b8cf717', '95e4082d-a12e-42d6-8733-251eb82537e7', 'GB', 4, '4-ci doza', '4th dose', 1095, '3 yaş 4 ay', '3y 4m', 13);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('f93205fe-4fe8-4b9c-9ec7-39a80f0747e7', 'GB', 'IPV', 'Poliomielit (IPV)', 'Polio (IPV)', 'Poliomielit', 'Poliomyelitis', 'Əzələdaxili', 'Intramuscular', '#F59E0B', true, 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('5fca7bfe-c36f-4d92-b62d-da631755916b', 'f93205fe-4fe8-4b9c-9ec7-39a80f0747e7', 'GB', 1, '1-ci doza', '1st dose', 60, '8 həftə', '8 weeks', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('acd68969-4319-4a26-868e-1be767e8afe3', 'f93205fe-4fe8-4b9c-9ec7-39a80f0747e7', 'GB', 2, '2-ci doza', '2nd dose', 90, '12 həftə', '12 weeks', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('d0e3e896-e195-45b3-9bc1-59d357b14340', 'f93205fe-4fe8-4b9c-9ec7-39a80f0747e7', 'GB', 3, '3-ci doza', '3rd dose', 120, '16 həftə', '16 weeks', 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('9c66fe33-36d2-4095-866a-ea517711fb42', 'f93205fe-4fe8-4b9c-9ec7-39a80f0747e7', 'GB', 4, '4-ci doza', '4th dose', 1095, '3 yaş 4 ay', '3y 4m', 13);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('72c3956d-d8a7-4b7e-81a7-0775676c83d6', 'GB', 'HiB', 'Hib infeksiyası', 'Haemophilus influenzae type b', 'Meningit, pnevmoniya', 'Meningitis, pneumonia', 'Əzələdaxili', 'Intramuscular', '#8B5CF6', true, 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('528b6de5-1a22-43b4-888c-8ef631a22080', '72c3956d-d8a7-4b7e-81a7-0775676c83d6', 'GB', 1, '1-ci doza', '1st dose', 60, '8 həftə', '8 weeks', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('39f57016-4329-4e67-a2f7-643237184dc8', '72c3956d-d8a7-4b7e-81a7-0775676c83d6', 'GB', 2, '2-ci doza', '2nd dose', 90, '12 həftə', '12 weeks', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('52143f21-8066-4550-a238-0105694c2333', '72c3956d-d8a7-4b7e-81a7-0775676c83d6', 'GB', 3, '3-ci doza', '3rd dose', 120, '16 həftə', '16 weeks', 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('2a13c233-5c8f-4e82-8977-3701a2343255', '72c3956d-d8a7-4b7e-81a7-0775676c83d6', 'GB', 4, '4-ci doza', '4th dose', 365, '1 yaş', '1 year', 13);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('0add9a53-9185-48dc-9203-3b513f1d46f1', 'GB', 'HepB', 'Hepatit B', 'Hepatitis B', 'Hepatit B virusu', 'Hepatitis B virus', 'Əzələdaxili', 'Intramuscular', '#3B82F6', true, 13);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('ccf88634-37c5-48d7-9fad-f2ace0be67b3', '0add9a53-9185-48dc-9203-3b513f1d46f1', 'GB', 1, '1-ci doza', '1st dose', 60, '8 həftə', '8 weeks', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('4167a00a-f766-4a6c-9470-999c4f08dc9d', '0add9a53-9185-48dc-9203-3b513f1d46f1', 'GB', 2, '2-ci doza', '2nd dose', 90, '12 həftə', '12 weeks', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('ded5b3e7-20b0-418a-9ba9-557ee4d22260', '0add9a53-9185-48dc-9203-3b513f1d46f1', 'GB', 3, '3-ci doza', '3rd dose', 120, '16 həftə', '16 weeks', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('60aa00ef-5416-46a9-970c-622de42681b0', 'GB', 'RV', 'Rotavirus', 'Rotavirus', 'Rotavirus ishalı', 'Rotavirus diarrhea', 'Ağızdan', 'Oral', '#14B8A6', true, 14);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('fbb98951-cf9d-4ce8-aaaf-496475765009', '60aa00ef-5416-46a9-970c-622de42681b0', 'GB', 1, '1-ci doza', '1st dose', 60, '8 həftə', '8 weeks', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('52c44295-3469-4fc4-be33-9e8c5c4c3d63', '60aa00ef-5416-46a9-970c-622de42681b0', 'GB', 2, '2-ci doza', '2nd dose', 90, '12 həftə', '12 weeks', 11);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('7d649b7f-18a7-4454-8d9a-7e71eeddf061', 'GB', 'PCV', 'Pnevmokokk', 'Pneumococcal', 'Pnevmoniya, meningit', 'Pneumonia, meningitis', 'Əzələdaxili', 'Intramuscular', '#EC4899', true, 15);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('b8dea1f1-ee1a-4038-be5e-0f004db7d7e1', '7d649b7f-18a7-4454-8d9a-7e71eeddf061', 'GB', 1, '1-ci doza', '1st dose', 90, '12 həftə', '12 weeks', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('70b897e0-97d0-4590-8195-9d93f36fb9c7', '7d649b7f-18a7-4454-8d9a-7e71eeddf061', 'GB', 2, '2-ci doza', '2nd dose', 365, '1 yaş', '1 year', 11);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('890d7615-cb02-47a0-8d52-68cc0b145b96', 'GB', 'MMR', 'Qızılca, parotit, məxmərək', 'Measles, Mumps, Rubella', 'Qızılca, parotit, məxmərək', 'Measles, Mumps, Rubella', 'Dərialtı', 'Subcutaneous', '#F43F5E', true, 16);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('206aab8f-3175-4de0-ade2-931fa851427f', '890d7615-cb02-47a0-8d52-68cc0b145b96', 'GB', 1, '1-ci doza', '1st dose', 365, '1 yaş', '1 year', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('c560508a-3ca5-4f54-a84b-362ca241b32f', '890d7615-cb02-47a0-8d52-68cc0b145b96', 'GB', 2, '2-ci doza', '2nd dose', 1095, '3 yaş 4 ay', '3y 4m', 11);
INSERT INTO public.vaccine_countries (id, code, name_az, name_en, flag_emoji, source_url, source_label, sort_order)
VALUES ('99c9342e-42a0-462a-bacf-c9e327a151e4', 'DE', 'Almaniya', 'Germany', '🇩🇪', 'https://www.rki.de/', 'STIKO (RKI)', 13);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('4e32a9bc-b90e-429f-9107-47ce751bb36f', 'DE', 'DTaP', 'Göy öskürək, difteriya, tetanoz', 'Diphtheria, Tetanus, Pertussis', 'Göy öskürək, difteriya, tetanoz', 'Diphtheria, Tetanus, Pertussis', 'Əzələdaxili', 'Intramuscular', '#EF4444', true, 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('4f0575b3-19e5-4961-9446-1bfc7f991e6a', '4e32a9bc-b90e-429f-9107-47ce751bb36f', 'DE', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('97e453f0-d649-4bf6-80a2-e1f9e8a81771', '4e32a9bc-b90e-429f-9107-47ce751bb36f', 'DE', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('f46579ff-a243-4d85-8ea1-ba0def164f10', '4e32a9bc-b90e-429f-9107-47ce751bb36f', 'DE', 3, '3-ci doza', '3rd dose', 330, '11 aylıq', '11 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('6b6960da-9753-4992-94c3-9a546231d602', 'DE', 'IPV', 'Poliomielit (IPV)', 'Polio (IPV)', 'Poliomielit', 'Poliomyelitis', 'Əzələdaxili', 'Intramuscular', '#F59E0B', true, 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('6b83a2d6-fb00-454c-bb99-b1abf106cf05', '6b6960da-9753-4992-94c3-9a546231d602', 'DE', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('5faf34ef-d942-4a56-a516-359dbba67914', '6b6960da-9753-4992-94c3-9a546231d602', 'DE', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('2f34522a-dbf2-4978-a2c5-ec757c706592', '6b6960da-9753-4992-94c3-9a546231d602', 'DE', 3, '3-ci doza', '3rd dose', 330, '11 aylıq', '11 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('036ab6c3-7aaf-401a-8746-e3f3ab2ae3cf', 'DE', 'HiB', 'Hib infeksiyası', 'Haemophilus influenzae type b', 'Meningit, pnevmoniya', 'Meningitis, pneumonia', 'Əzələdaxili', 'Intramuscular', '#8B5CF6', true, 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('d04f1785-bff7-40ce-a4de-bf83c8149e0d', '036ab6c3-7aaf-401a-8746-e3f3ab2ae3cf', 'DE', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('19afa167-7fa8-480f-8112-fb818b7b28ea', '036ab6c3-7aaf-401a-8746-e3f3ab2ae3cf', 'DE', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('0088031c-66e3-4f20-b499-07b5729541f6', '036ab6c3-7aaf-401a-8746-e3f3ab2ae3cf', 'DE', 3, '3-ci doza', '3rd dose', 330, '11 aylıq', '11 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('b141df8d-dd42-486a-afaa-b5dd0603d7ba', 'DE', 'HepB', 'Hepatit B', 'Hepatitis B', 'Hepatit B virusu', 'Hepatitis B virus', 'Əzələdaxili', 'Intramuscular', '#3B82F6', true, 13);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('17c05657-2872-4904-9bd6-ac2418413be3', 'b141df8d-dd42-486a-afaa-b5dd0603d7ba', 'DE', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('fc9ab2aa-23ca-4ebf-a751-77205ba34dcf', 'b141df8d-dd42-486a-afaa-b5dd0603d7ba', 'DE', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('e6712d6c-b368-4bdb-8cae-e0e11fd985d3', 'b141df8d-dd42-486a-afaa-b5dd0603d7ba', 'DE', 3, '3-ci doza', '3rd dose', 330, '11 aylıq', '11 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('80cb939c-44fe-4885-b89d-c50044824238', 'DE', 'PCV', 'Pnevmokokk', 'Pneumococcal', 'Pnevmoniya, meningit', 'Pneumonia, meningitis', 'Əzələdaxili', 'Intramuscular', '#EC4899', true, 14);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('c7b6b1e9-e1d2-4380-bc17-fe6c57947f77', '80cb939c-44fe-4885-b89d-c50044824238', 'DE', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('4443f0b9-25ec-4021-bc23-99b2c2e068b7', '80cb939c-44fe-4885-b89d-c50044824238', 'DE', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('ad0ad24c-325d-4272-a6b3-8e2525f20d57', '80cb939c-44fe-4885-b89d-c50044824238', 'DE', 3, '3-ci doza', '3rd dose', 330, '11 aylıq', '11 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('18ed2f26-679e-4b94-9928-ff5bd390ef1d', 'DE', 'RV', 'Rotavirus', 'Rotavirus', 'Rotavirus ishalı', 'Rotavirus diarrhea', 'Ağızdan', 'Oral', '#14B8A6', true, 15);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('bc210c11-16ad-4766-8ffd-2d8311384c20', '18ed2f26-679e-4b94-9928-ff5bd390ef1d', 'DE', 1, '1-ci doza', '1st dose', 42, '6 həftə', '6 weeks', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('2811504e-c40d-4ce8-a5e2-152ee285c49c', '18ed2f26-679e-4b94-9928-ff5bd390ef1d', 'DE', 2, '2-ci doza', '2nd dose', 60, '2 aylıq', '2 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('d6ba404e-9a44-4ee5-9bbd-748a0a523420', '18ed2f26-679e-4b94-9928-ff5bd390ef1d', 'DE', 3, '3-ci doza', '3rd dose', 120, '4 aylıq', '4 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('3564cd6f-3103-4326-a9dc-b418f2896efc', 'DE', 'MMR', 'Qızılca, parotit, məxmərək', 'Measles, Mumps, Rubella', 'Qızılca, parotit, məxmərək', 'Measles, Mumps, Rubella', 'Dərialtı', 'Subcutaneous', '#F43F5E', true, 16);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('17969c9a-4be3-46e4-ac3d-e0d0b43c7418', '3564cd6f-3103-4326-a9dc-b418f2896efc', 'DE', 1, '1-ci doza', '1st dose', 330, '11 aylıq', '11 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('edafbcd8-39d6-4db4-98d2-4fd05685eaee', '3564cd6f-3103-4326-a9dc-b418f2896efc', 'DE', 2, '2-ci doza', '2nd dose', 450, '15 aylıq', '15 months', 11);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('fe1df18a-2ceb-4ce0-a6c1-9992f9edcf14', 'DE', 'VAR', 'Su çiçəyi', 'Varicella (Chickenpox)', 'Su çiçəyi', 'Chickenpox', 'Dərialtı', 'Subcutaneous', '#6366F1', true, 17);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('efbbd519-c837-4903-88ed-c8dff006cd9a', 'fe1df18a-2ceb-4ce0-a6c1-9992f9edcf14', 'DE', 1, '1-ci doza', '1st dose', 330, '11 aylıq', '11 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('c8f1bc16-6e35-46fd-a792-9334d7be61dc', 'fe1df18a-2ceb-4ce0-a6c1-9992f9edcf14', 'DE', 2, '2-ci doza', '2nd dose', 450, '15 aylıq', '15 months', 11);
INSERT INTO public.vaccine_countries (id, code, name_az, name_en, flag_emoji, source_url, source_label, sort_order)
VALUES ('d8071324-0074-4df1-b39d-8ceedc975bf9', 'RU', 'Rusiya', 'Russia', '🇷🇺', 'https://minzdrav.gov.ru/', 'Минздрав РФ', 14);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('9893f834-e3c6-4fcb-b1c4-a73490ba173a', 'RU', 'HepB', 'Hepatit B', 'Hepatitis B', 'Hepatit B virusu', 'Hepatitis B virus', 'Əzələdaxili', 'Intramuscular', '#3B82F6', true, 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('0f40fbf0-eb8b-4acf-bca1-d51795361bb3', '9893f834-e3c6-4fcb-b1c4-a73490ba173a', 'RU', 1, '1-ci doza', '1st dose', 0, 'Doğulanda', 'At birth', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('0a323233-48ad-42d6-9b4e-44a71f4d1575', '9893f834-e3c6-4fcb-b1c4-a73490ba173a', 'RU', 2, '2-ci doza', '2nd dose', 30, '1 aylıq', '1 month', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('f1e326fd-dc99-4017-b731-f6ca2b1c66a7', '9893f834-e3c6-4fcb-b1c4-a73490ba173a', 'RU', 3, '3-ci doza', '3rd dose', 180, '6 aylıq', '6 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('f7e8dbfa-1817-46d0-a269-48d191be3fdf', 'RU', 'BCG', 'Vərəm (BCG)', 'Tuberculosis (BCG)', 'Vərəm', 'Tuberculosis', 'Dəridaxili', 'Intradermal', '#10B981', true, 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('00f238f9-acfe-4e87-92f4-d3122b13dc28', 'f7e8dbfa-1817-46d0-a269-48d191be3fdf', 'RU', 1, '1-ci doza', '1st dose', 3, '3-7 gün', '3-7 days', 10);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('fdf12adf-03a5-496d-95bf-332ef8cb7093', 'RU', 'PCV', 'Pnevmokokk', 'Pneumococcal', 'Pnevmoniya, meningit', 'Pneumonia, meningitis', 'Əzələdaxili', 'Intramuscular', '#EC4899', true, 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('4ee043cc-9ed1-4216-8546-b599845a9b92', 'fdf12adf-03a5-496d-95bf-332ef8cb7093', 'RU', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('1d8b9483-d4c8-4cfe-a278-2194a96eb10c', 'fdf12adf-03a5-496d-95bf-332ef8cb7093', 'RU', 2, '2-ci doza', '2nd dose', 135, '4.5 aylıq', '4.5 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('5d4060b1-6755-4500-8b0c-3f12083ca626', 'fdf12adf-03a5-496d-95bf-332ef8cb7093', 'RU', 3, '3-ci doza', '3rd dose', 450, '15 aylıq', '15 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('f2469738-bb72-4cce-9a5e-843e6bac10b1', 'RU', 'DTaP', 'Göy öskürək, difteriya, tetanoz', 'Diphtheria, Tetanus, Pertussis', 'Göy öskürək, difteriya, tetanoz', 'Diphtheria, Tetanus, Pertussis', 'Əzələdaxili', 'Intramuscular', '#EF4444', true, 13);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('869f18be-5cb6-427e-80fd-34343886c7fb', 'f2469738-bb72-4cce-9a5e-843e6bac10b1', 'RU', 1, '1-ci doza', '1st dose', 90, '3 aylıq', '3 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('8c9fe0f1-9c91-46a4-9f83-724352effb37', 'f2469738-bb72-4cce-9a5e-843e6bac10b1', 'RU', 2, '2-ci doza', '2nd dose', 135, '4.5 aylıq', '4.5 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('a5cd3330-3678-40d9-903b-7302c0355fff', 'f2469738-bb72-4cce-9a5e-843e6bac10b1', 'RU', 3, '3-ci doza', '3rd dose', 180, '6 aylıq', '6 months', 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('4ddc559c-54d0-411d-ab88-6187d7f9f4d9', 'f2469738-bb72-4cce-9a5e-843e6bac10b1', 'RU', 4, '4-ci doza', '4th dose', 540, '18 aylıq', '18 months', 13);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('74411cc9-2a8a-4852-b73b-4c7aed09a76b', 'RU', 'IPV', 'Poliomielit (IPV)', 'Polio (IPV)', 'Poliomielit', 'Poliomyelitis', 'Əzələdaxili', 'Intramuscular', '#F59E0B', true, 14);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('b719cf4d-5619-484a-8b83-d45a3e8521d4', '74411cc9-2a8a-4852-b73b-4c7aed09a76b', 'RU', 1, '1-ci doza', '1st dose', 90, '3 aylıq', '3 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('56cd5273-6dd7-4dd5-841f-4ccdafe82cb9', '74411cc9-2a8a-4852-b73b-4c7aed09a76b', 'RU', 2, '2-ci doza', '2nd dose', 135, '4.5 aylıq', '4.5 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('b9627885-f124-4236-bd27-f6ae0227102c', '74411cc9-2a8a-4852-b73b-4c7aed09a76b', 'RU', 3, '3-ci doza', '3rd dose', 180, '6 aylıq', '6 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('5319311c-5551-470f-8352-bc8a1abee122', 'RU', 'HiB', 'Hib infeksiyası', 'Haemophilus influenzae type b', 'Meningit, pnevmoniya', 'Meningitis, pneumonia', 'Əzələdaxili', 'Intramuscular', '#8B5CF6', true, 15);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('0aeee9a6-7cd6-423e-8347-7f2f3cb7d113', '5319311c-5551-470f-8352-bc8a1abee122', 'RU', 1, '1-ci doza', '1st dose', 90, '3 aylıq', '3 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('9ca9faea-32ea-4cbc-8ab0-cf8f26690b61', '5319311c-5551-470f-8352-bc8a1abee122', 'RU', 2, '2-ci doza', '2nd dose', 135, '4.5 aylıq', '4.5 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('5ed17307-dfa9-4abc-8c8e-b6a52b25da0f', '5319311c-5551-470f-8352-bc8a1abee122', 'RU', 3, '3-ci doza', '3rd dose', 180, '6 aylıq', '6 months', 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('710a49fe-8125-44a5-a870-02bdc0d745c5', '5319311c-5551-470f-8352-bc8a1abee122', 'RU', 4, '4-ci doza', '4th dose', 540, '18 aylıq', '18 months', 13);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('1f369be1-34cc-47f6-a76f-c8b865913eda', 'RU', 'MMR', 'Qızılca, parotit, məxmərək', 'Measles, Mumps, Rubella', 'Qızılca, parotit, məxmərək', 'Measles, Mumps, Rubella', 'Dərialtı', 'Subcutaneous', '#F43F5E', true, 16);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('ef5f261b-6e6d-42fd-8bf4-c64d5b2bd92d', '1f369be1-34cc-47f6-a76f-c8b865913eda', 'RU', 1, '1-ci doza', '1st dose', 365, '12 aylıq', '12 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('cbd18f8c-9b54-4258-bc8c-68b19107d1f3', '1f369be1-34cc-47f6-a76f-c8b865913eda', 'RU', 2, '2-ci doza', '2nd dose', 2190, '6 yaş', '6 years', 11);
INSERT INTO public.vaccine_countries (id, code, name_az, name_en, flag_emoji, source_url, source_label, sort_order)
VALUES ('7df40d2c-65f0-4503-b25a-6b10c14fd00d', 'FR', 'Fransa', 'France', '🇫🇷', 'https://solidarites-sante.gouv.fr', 'Ministère de la Santé', 15);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('183f9c5b-2312-4ba2-a252-06f296648997', 'FR', 'DTaP', 'Göy öskürək, difteriya, tetanoz', 'Diphtheria, Tetanus, Pertussis', 'Göy öskürək, difteriya, tetanoz', 'Diphtheria, Tetanus, Pertussis', 'Əzələdaxili', 'Intramuscular', '#EF4444', true, 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('f2abda2a-f858-4acf-83f3-2e1c22a1b14e', '183f9c5b-2312-4ba2-a252-06f296648997', 'FR', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('69abea0b-1c60-40b1-aed5-dcda9b763e6d', '183f9c5b-2312-4ba2-a252-06f296648997', 'FR', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('abe31849-31c4-4a1e-b0a7-a0d8acc6fccf', '183f9c5b-2312-4ba2-a252-06f296648997', 'FR', 3, '3-ci doza', '3rd dose', 330, '11 aylıq', '11 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('12c9341a-4287-41ef-9547-f6ac47b5c987', 'FR', 'IPV', 'Poliomielit (IPV)', 'Polio (IPV)', 'Poliomielit', 'Poliomyelitis', 'Əzələdaxili', 'Intramuscular', '#F59E0B', true, 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('8e192245-520e-40a4-af61-994b8ca7f3d7', '12c9341a-4287-41ef-9547-f6ac47b5c987', 'FR', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('7a1de840-7a65-41f5-8e72-3e97e2ee3bf4', '12c9341a-4287-41ef-9547-f6ac47b5c987', 'FR', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('0c31fe21-838b-4b89-8ee0-5dbe07c60004', '12c9341a-4287-41ef-9547-f6ac47b5c987', 'FR', 3, '3-ci doza', '3rd dose', 330, '11 aylıq', '11 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('11439bf5-9fef-4781-8755-771d2ed0459d', 'FR', 'HiB', 'Hib infeksiyası', 'Haemophilus influenzae type b', 'Meningit, pnevmoniya', 'Meningitis, pneumonia', 'Əzələdaxili', 'Intramuscular', '#8B5CF6', true, 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('7ca6887b-fc30-4abd-b77b-8d9cc04de66b', '11439bf5-9fef-4781-8755-771d2ed0459d', 'FR', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('9d3bf55d-1769-4d80-a8ba-1a6e418d6181', '11439bf5-9fef-4781-8755-771d2ed0459d', 'FR', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('14e6e763-9aca-4626-a80f-88c008c8e9c6', '11439bf5-9fef-4781-8755-771d2ed0459d', 'FR', 3, '3-ci doza', '3rd dose', 330, '11 aylıq', '11 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('cbb2a9db-4057-4264-a8ca-ba0a623080c7', 'FR', 'HepB', 'Hepatit B', 'Hepatitis B', 'Hepatit B virusu', 'Hepatitis B virus', 'Əzələdaxili', 'Intramuscular', '#3B82F6', true, 13);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('00a67fd4-300a-4ea7-a372-6debd20fc949', 'cbb2a9db-4057-4264-a8ca-ba0a623080c7', 'FR', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('a8d53844-87e4-4df9-966a-53d7e9d587fd', 'cbb2a9db-4057-4264-a8ca-ba0a623080c7', 'FR', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('a1d13ca6-ec0b-4e03-b8cd-7f066c1fe9b2', 'cbb2a9db-4057-4264-a8ca-ba0a623080c7', 'FR', 3, '3-ci doza', '3rd dose', 330, '11 aylıq', '11 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('cc908ea1-16ba-45a1-9ec6-0c4949bbfd73', 'FR', 'PCV', 'Pnevmokokk', 'Pneumococcal', 'Pnevmoniya, meningit', 'Pneumonia, meningitis', 'Əzələdaxili', 'Intramuscular', '#EC4899', true, 14);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('63b43bc2-b380-43f4-8cb3-eeaedfec911d', 'cc908ea1-16ba-45a1-9ec6-0c4949bbfd73', 'FR', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('9a4fbe26-68f3-4f97-be1d-dd56f0fd6b10', 'cc908ea1-16ba-45a1-9ec6-0c4949bbfd73', 'FR', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('c792d719-8d82-43eb-83b0-a61d0a080b2e', 'cc908ea1-16ba-45a1-9ec6-0c4949bbfd73', 'FR', 3, '3-ci doza', '3rd dose', 330, '11 aylıq', '11 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('3fdf1d52-8319-46b0-9f3b-3a2a08159968', 'FR', 'MenACWY', 'Meningokokk', 'Meningococcal', 'Meningokokk xəstəliyi', 'Meningococcal disease', 'Əzələdaxili', 'Intramuscular', '#F59E0B', true, 15);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('36fc5e00-2fb5-4ad0-a3f1-8c60406a29fd', '3fdf1d52-8319-46b0-9f3b-3a2a08159968', 'FR', 1, '1-ci doza', '1st dose', 150, '5 aylıq', '5 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('5f34eaaf-3dd4-4a22-80c8-3304407404ab', '3fdf1d52-8319-46b0-9f3b-3a2a08159968', 'FR', 2, '2-ci doza', '2nd dose', 365, '12 aylıq', '12 months', 11);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('ac2cd989-f94b-4da6-afd0-7fa2189c77bc', 'FR', 'MMR', 'Qızılca, parotit, məxmərək', 'Measles, Mumps, Rubella', 'Qızılca, parotit, məxmərək', 'Measles, Mumps, Rubella', 'Dərialtı', 'Subcutaneous', '#F43F5E', true, 16);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('f5ee43dc-3b40-453f-b4d5-76366f8a8aab', 'ac2cd989-f94b-4da6-afd0-7fa2189c77bc', 'FR', 1, '1-ci doza', '1st dose', 365, '12 aylıq', '12 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('74339804-3835-4c93-bc18-549685ac141d', 'ac2cd989-f94b-4da6-afd0-7fa2189c77bc', 'FR', 2, '2-ci doza', '2nd dose', 480, '16 aylıq', '16-18 months', 11);
INSERT INTO public.vaccine_countries (id, code, name_az, name_en, flag_emoji, source_url, source_label, sort_order)
VALUES ('2f094a5b-b5c6-4e00-a12a-3cc3ad92d9b4', 'IT', 'İtaliya', 'Italy', '🇮🇹', 'https://www.salute.gov.it', 'Ministero della Salute', 16);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('c8f1c12c-65f3-4da6-88a8-d37d8acd77bb', 'IT', 'DTaP', 'Göy öskürək, difteriya, tetanoz', 'Diphtheria, Tetanus, Pertussis', 'Göy öskürək, difteriya, tetanoz', 'Diphtheria, Tetanus, Pertussis', 'Əzələdaxili', 'Intramuscular', '#EF4444', true, 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('964fed97-5219-4a56-81d1-178fa91d1dcc', 'c8f1c12c-65f3-4da6-88a8-d37d8acd77bb', 'IT', 1, '1-ci doza', '1st dose', 90, '3 aylıq', '3 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('ea5d24f2-ddb0-4bac-8076-03a6d48b48dc', 'c8f1c12c-65f3-4da6-88a8-d37d8acd77bb', 'IT', 2, '2-ci doza', '2nd dose', 150, '5 aylıq', '5 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('5d32833a-038d-42d8-a8bb-3c88dc18b1ee', 'c8f1c12c-65f3-4da6-88a8-d37d8acd77bb', 'IT', 3, '3-ci doza', '3rd dose', 330, '11 aylıq', '11 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('39c04c26-d8fd-4139-bcc0-8afc58cddad2', 'IT', 'IPV', 'Poliomielit (IPV)', 'Polio (IPV)', 'Poliomielit', 'Poliomyelitis', 'Əzələdaxili', 'Intramuscular', '#F59E0B', true, 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('96fa9857-bd08-44ea-bed0-55e46411994c', '39c04c26-d8fd-4139-bcc0-8afc58cddad2', 'IT', 1, '1-ci doza', '1st dose', 90, '3 aylıq', '3 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('51cc4f89-f016-45c5-9d07-ee5b4003fccb', '39c04c26-d8fd-4139-bcc0-8afc58cddad2', 'IT', 2, '2-ci doza', '2nd dose', 150, '5 aylıq', '5 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('29ae8d44-9417-4f15-b48b-6a860880d83d', '39c04c26-d8fd-4139-bcc0-8afc58cddad2', 'IT', 3, '3-ci doza', '3rd dose', 330, '11 aylıq', '11 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('98bd182f-e9d2-41cb-9f89-70faa6ff89e6', 'IT', 'HepB', 'Hepatit B', 'Hepatitis B', 'Hepatit B virusu', 'Hepatitis B virus', 'Əzələdaxili', 'Intramuscular', '#3B82F6', true, 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('913b366f-76f2-4689-b465-c5ebd33d1586', '98bd182f-e9d2-41cb-9f89-70faa6ff89e6', 'IT', 1, '1-ci doza', '1st dose', 90, '3 aylıq', '3 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('3317e599-7e0d-4a46-ae6a-6313731f7c6e', '98bd182f-e9d2-41cb-9f89-70faa6ff89e6', 'IT', 2, '2-ci doza', '2nd dose', 150, '5 aylıq', '5 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('2d49998d-406a-4f20-92dd-18092bf42cf3', '98bd182f-e9d2-41cb-9f89-70faa6ff89e6', 'IT', 3, '3-ci doza', '3rd dose', 330, '11 aylıq', '11 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('45aa0e5f-7f83-486c-b90f-875897be6e79', 'IT', 'HiB', 'Hib infeksiyası', 'Haemophilus influenzae type b', 'Meningit, pnevmoniya', 'Meningitis, pneumonia', 'Əzələdaxili', 'Intramuscular', '#8B5CF6', true, 13);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('f1e5f64c-e725-4e8c-bc95-0c79033f73e6', '45aa0e5f-7f83-486c-b90f-875897be6e79', 'IT', 1, '1-ci doza', '1st dose', 90, '3 aylıq', '3 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('a39cada5-994a-4a04-8b69-434fe0503f11', '45aa0e5f-7f83-486c-b90f-875897be6e79', 'IT', 2, '2-ci doza', '2nd dose', 150, '5 aylıq', '5 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('28968624-e8f3-4e2d-864a-b9302dd021a1', '45aa0e5f-7f83-486c-b90f-875897be6e79', 'IT', 3, '3-ci doza', '3rd dose', 330, '11 aylıq', '11 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('870bd917-5755-4830-b3ae-b8339876213c', 'IT', 'PCV', 'Pnevmokokk', 'Pneumococcal', 'Pnevmoniya, meningit', 'Pneumonia, meningitis', 'Əzələdaxili', 'Intramuscular', '#EC4899', true, 14);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('3d1a62df-e751-4c44-8bc7-447f99aaaa80', '870bd917-5755-4830-b3ae-b8339876213c', 'IT', 1, '1-ci doza', '1st dose', 90, '3 aylıq', '3 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('f291e1b6-7ff0-4ad8-9523-ef34f850c6a1', '870bd917-5755-4830-b3ae-b8339876213c', 'IT', 2, '2-ci doza', '2nd dose', 150, '5 aylıq', '5 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('48510077-a599-4149-811c-cb1df5cf88f5', '870bd917-5755-4830-b3ae-b8339876213c', 'IT', 3, '3-ci doza', '3rd dose', 330, '11 aylıq', '11 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('6260794a-ea77-4fee-98a0-09a01ae70a5b', 'IT', 'RV', 'Rotavirus', 'Rotavirus', 'Rotavirus ishalı', 'Rotavirus diarrhea', 'Ağızdan', 'Oral', '#14B8A6', true, 15);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('6010e1b3-3d3f-4187-afc4-59311cf9d660', '6260794a-ea77-4fee-98a0-09a01ae70a5b', 'IT', 1, '1-ci doza', '1st dose', 90, '3 aylıq', '3 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('ad68afcc-6f1c-4678-9888-3252a9682443', '6260794a-ea77-4fee-98a0-09a01ae70a5b', 'IT', 2, '2-ci doza', '2nd dose', 150, '5 aylıq', '5 months', 11);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('6dc07e7c-28c2-44e4-a643-45e168e27010', 'IT', 'MMR', 'Qızılca, parotit, məxmərək', 'Measles, Mumps, Rubella', 'Qızılca, parotit, məxmərək', 'Measles, Mumps, Rubella', 'Dərialtı', 'Subcutaneous', '#F43F5E', true, 16);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('467f9fd0-3915-434c-972f-8427568330c5', '6dc07e7c-28c2-44e4-a643-45e168e27010', 'IT', 1, '1-ci doza', '1st dose', 395, '13 aylıq', '13-15 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('fce8703a-10cf-4cff-a51a-7d0729cb1385', '6dc07e7c-28c2-44e4-a643-45e168e27010', 'IT', 2, '2-ci doza', '2nd dose', 1825, '5-6 yaş', '5-6 years', 11);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('d7a36bb1-1c68-4c21-8b19-a00d4bf27163', 'IT', 'VAR', 'Su çiçəyi', 'Varicella (Chickenpox)', 'Su çiçəyi', 'Chickenpox', 'Dərialtı', 'Subcutaneous', '#6366F1', true, 17);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('fabe116f-142c-453a-a46b-cbbc55aa3807', 'd7a36bb1-1c68-4c21-8b19-a00d4bf27163', 'IT', 1, '1-ci doza', '1st dose', 395, '13 aylıq', '13-15 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('22f32e7d-04ca-4816-b96d-5ef17acff267', 'd7a36bb1-1c68-4c21-8b19-a00d4bf27163', 'IT', 2, '2-ci doza', '2nd dose', 1825, '5-6 yaş', '5-6 years', 11);
INSERT INTO public.vaccine_countries (id, code, name_az, name_en, flag_emoji, source_url, source_label, sort_order)
VALUES ('7811ddd2-1c91-483a-b8b8-0994b1c26960', 'ES', 'İspaniya', 'Spain', '🇪🇸', 'https://www.sanidad.gob.es', 'Ministerio de Sanidad', 17);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('61c477ae-ff3a-406b-b963-4558c853b579', 'ES', 'DTaP', 'Göy öskürək, difteriya, tetanoz', 'Diphtheria, Tetanus, Pertussis', 'Göy öskürək, difteriya, tetanoz', 'Diphtheria, Tetanus, Pertussis', 'Əzələdaxili', 'Intramuscular', '#EF4444', true, 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('a3b2985f-2254-462a-aa9e-4875f48ac3f8', '61c477ae-ff3a-406b-b963-4558c853b579', 'ES', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('129e33f8-4d2d-41c1-85b5-bb96379c2990', '61c477ae-ff3a-406b-b963-4558c853b579', 'ES', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('5b8f7cd6-aefd-4171-a0ad-7504eca08c95', '61c477ae-ff3a-406b-b963-4558c853b579', 'ES', 3, '3-ci doza', '3rd dose', 330, '11 aylıq', '11 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('98da662f-3b2b-485e-be9c-dbb836f4e9d9', 'ES', 'IPV', 'Poliomielit (IPV)', 'Polio (IPV)', 'Poliomielit', 'Poliomyelitis', 'Əzələdaxili', 'Intramuscular', '#F59E0B', true, 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('98f172c8-b908-46a5-98b8-bd6d8d48ba19', '98da662f-3b2b-485e-be9c-dbb836f4e9d9', 'ES', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('8a1aa470-13b7-4aeb-a245-52cf4a72557b', '98da662f-3b2b-485e-be9c-dbb836f4e9d9', 'ES', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('e0cf28f6-f99a-4e99-8cd6-f4d04fba3c6b', '98da662f-3b2b-485e-be9c-dbb836f4e9d9', 'ES', 3, '3-ci doza', '3rd dose', 330, '11 aylıq', '11 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('7e95373d-a798-4454-8bbc-f65e3d05d480', 'ES', 'HiB', 'Hib infeksiyası', 'Haemophilus influenzae type b', 'Meningit, pnevmoniya', 'Meningitis, pneumonia', 'Əzələdaxili', 'Intramuscular', '#8B5CF6', true, 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('2fda4fe6-117c-427b-992d-d337274fa0c5', '7e95373d-a798-4454-8bbc-f65e3d05d480', 'ES', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('80b36303-4220-4bb6-933d-9faefc3000c4', '7e95373d-a798-4454-8bbc-f65e3d05d480', 'ES', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('4c9eae1c-55df-4805-8518-567266678785', '7e95373d-a798-4454-8bbc-f65e3d05d480', 'ES', 3, '3-ci doza', '3rd dose', 330, '11 aylıq', '11 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('0e6617dc-e309-4e09-9265-cdecef7e844a', 'ES', 'HepB', 'Hepatit B', 'Hepatitis B', 'Hepatit B virusu', 'Hepatitis B virus', 'Əzələdaxili', 'Intramuscular', '#3B82F6', true, 13);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('6235fd05-ba22-498c-8f9f-77c1447f3cf5', '0e6617dc-e309-4e09-9265-cdecef7e844a', 'ES', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('16244fd8-9a69-450d-b28b-ad0aee3aff28', '0e6617dc-e309-4e09-9265-cdecef7e844a', 'ES', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('fd5cd56f-ccb4-4ea2-a789-25b8ffa5c7c8', '0e6617dc-e309-4e09-9265-cdecef7e844a', 'ES', 3, '3-ci doza', '3rd dose', 330, '11 aylıq', '11 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('caf1148b-cd56-4558-9dd8-87409b2a9943', 'ES', 'PCV', 'Pnevmokokk', 'Pneumococcal', 'Pnevmoniya, meningit', 'Pneumonia, meningitis', 'Əzələdaxili', 'Intramuscular', '#EC4899', true, 14);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('09b2b12d-1827-4c5f-b33d-09a13091a77e', 'caf1148b-cd56-4558-9dd8-87409b2a9943', 'ES', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('52248d94-07ce-4d14-be86-320828c1fd0f', 'caf1148b-cd56-4558-9dd8-87409b2a9943', 'ES', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('2147f101-4326-47a2-8785-b81d5af0217f', 'caf1148b-cd56-4558-9dd8-87409b2a9943', 'ES', 3, '3-ci doza', '3rd dose', 330, '11 aylıq', '11 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('c0417869-cadc-4766-9200-ce1957a365dc', 'ES', 'MenACWY', 'Meningokokk', 'Meningococcal', 'Meningokokk xəstəliyi', 'Meningococcal disease', 'Əzələdaxili', 'Intramuscular', '#F59E0B', true, 15);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('538dde67-2a32-45ec-9db7-ee7094aba78e', 'c0417869-cadc-4766-9200-ce1957a365dc', 'ES', 1, '1-ci doza', '1st dose', 120, '4 aylıq', '4 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('71bae1d4-c7fa-44c4-99c9-2bd4ccf9e25a', 'c0417869-cadc-4766-9200-ce1957a365dc', 'ES', 2, '2-ci doza', '2nd dose', 365, '12 aylıq', '12 months', 11);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('929a3901-9be0-4a2f-919e-553c69aff6c0', 'ES', 'MMR', 'Qızılca, parotit, məxmərək', 'Measles, Mumps, Rubella', 'Qızılca, parotit, məxmərək', 'Measles, Mumps, Rubella', 'Dərialtı', 'Subcutaneous', '#F43F5E', true, 16);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('fef45a7a-7548-46eb-8736-89a5a8d235ed', '929a3901-9be0-4a2f-919e-553c69aff6c0', 'ES', 1, '1-ci doza', '1st dose', 365, '12 aylıq', '12 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('d8487022-bea1-4e2d-9bc6-c26efc45832c', '929a3901-9be0-4a2f-919e-553c69aff6c0', 'ES', 2, '2-ci doza', '2nd dose', 1095, '3-4 yaş', '3-4 years', 11);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('880348b7-f4ad-47d9-a564-9da51aa57715', 'ES', 'VAR', 'Su çiçəyi', 'Varicella (Chickenpox)', 'Su çiçəyi', 'Chickenpox', 'Dərialtı', 'Subcutaneous', '#6366F1', true, 17);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('8b76be8c-44e2-4066-812b-bcbaf4d89ba7', '880348b7-f4ad-47d9-a564-9da51aa57715', 'ES', 1, '1-ci doza', '1st dose', 450, '15 aylıq', '15 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('2aa48f89-97f8-4b94-b172-13b8b57ee93f', '880348b7-f4ad-47d9-a564-9da51aa57715', 'ES', 2, '2-ci doza', '2nd dose', 1095, '3-4 yaş', '3-4 years', 11);
INSERT INTO public.vaccine_countries (id, code, name_az, name_en, flag_emoji, source_url, source_label, sort_order)
VALUES ('f38beb18-e592-44c5-b8e6-10b2c2d837a2', 'CA', 'Kanada', 'Canada', '🇨🇦', 'https://www.canada.ca/en/public-health.html', 'Public Health Canada', 18);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('bcdc3de2-dfee-4fde-83cb-8268edd3d9d6', 'CA', 'DTaP', 'Göy öskürək, difteriya, tetanoz', 'Diphtheria, Tetanus, Pertussis', 'Göy öskürək, difteriya, tetanoz', 'Diphtheria, Tetanus, Pertussis', 'Əzələdaxili', 'Intramuscular', '#EF4444', true, 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('cc065afe-062c-4c6c-a4b6-e558b99aa89e', 'bcdc3de2-dfee-4fde-83cb-8268edd3d9d6', 'CA', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('4770c048-530b-4b97-b134-e47a22acba5f', 'bcdc3de2-dfee-4fde-83cb-8268edd3d9d6', 'CA', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('2c431bf9-5804-475d-a3d1-a19ea9834521', 'bcdc3de2-dfee-4fde-83cb-8268edd3d9d6', 'CA', 3, '3-ci doza', '3rd dose', 180, '6 aylıq', '6 months', 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('ec7dd5c5-d24b-4871-b467-9c57c320a074', 'bcdc3de2-dfee-4fde-83cb-8268edd3d9d6', 'CA', 4, '4-ci doza', '4th dose', 540, '18 aylıq', '18 months', 13);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('6116d357-eeb9-4329-8aea-87a5cf457633', 'CA', 'IPV', 'Poliomielit (IPV)', 'Polio (IPV)', 'Poliomielit', 'Poliomyelitis', 'Əzələdaxili', 'Intramuscular', '#F59E0B', true, 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('2208d2c6-ef08-4d9d-9b18-08565be2043f', '6116d357-eeb9-4329-8aea-87a5cf457633', 'CA', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('e057efc3-5e21-4273-b058-5e20937510a4', '6116d357-eeb9-4329-8aea-87a5cf457633', 'CA', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('881f3200-1a19-4f4b-8ab2-b75b2a95480b', '6116d357-eeb9-4329-8aea-87a5cf457633', 'CA', 3, '3-ci doza', '3rd dose', 180, '6 aylıq', '6 months', 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('ea4cc98a-3667-4328-ac3e-eb8d50c4481a', '6116d357-eeb9-4329-8aea-87a5cf457633', 'CA', 4, '4-ci doza', '4th dose', 540, '18 aylıq', '18 months', 13);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('db4ee516-fe09-4456-a538-7cd3f414f580', 'CA', 'HiB', 'Hib infeksiyası', 'Haemophilus influenzae type b', 'Meningit, pnevmoniya', 'Meningitis, pneumonia', 'Əzələdaxili', 'Intramuscular', '#8B5CF6', true, 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('7943e49c-28a4-421d-9ea3-c3b22642f22c', 'db4ee516-fe09-4456-a538-7cd3f414f580', 'CA', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('a7e55fba-142e-4494-a686-e4ef459a0f9e', 'db4ee516-fe09-4456-a538-7cd3f414f580', 'CA', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('2cbe36ff-d180-4026-a2c4-627fddf12f5c', 'db4ee516-fe09-4456-a538-7cd3f414f580', 'CA', 3, '3-ci doza', '3rd dose', 180, '6 aylıq', '6 months', 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('1d9fbcaf-ff1d-41d5-bd83-cdc584a9a910', 'db4ee516-fe09-4456-a538-7cd3f414f580', 'CA', 4, '4-ci doza', '4th dose', 540, '18 aylıq', '18 months', 13);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('acaee717-5a6e-407d-815a-9d341f0c66bc', 'CA', 'PCV', 'Pnevmokokk', 'Pneumococcal', 'Pnevmoniya, meningit', 'Pneumonia, meningitis', 'Əzələdaxili', 'Intramuscular', '#EC4899', true, 13);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('3082c59e-b954-4d3f-9a07-cd5ecdac5736', 'acaee717-5a6e-407d-815a-9d341f0c66bc', 'CA', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('3616cd5b-6a72-467f-82a4-a591a016566e', 'acaee717-5a6e-407d-815a-9d341f0c66bc', 'CA', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('c8cc8fb2-94a3-4695-9861-e2eabd64d38d', 'acaee717-5a6e-407d-815a-9d341f0c66bc', 'CA', 3, '3-ci doza', '3rd dose', 365, '12 aylıq', '12 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('0722d061-7e2d-4248-96a0-67fa2128cddb', 'CA', 'RV', 'Rotavirus', 'Rotavirus', 'Rotavirus ishalı', 'Rotavirus diarrhea', 'Ağızdan', 'Oral', '#14B8A6', true, 14);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('43796db7-d998-4513-a0c1-af024d0eff06', '0722d061-7e2d-4248-96a0-67fa2128cddb', 'CA', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('403f13bb-97fa-4ee7-8d01-297a9085c102', '0722d061-7e2d-4248-96a0-67fa2128cddb', 'CA', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('87d03134-dec7-4f48-85fa-5f9fb9f98843', 'CA', 'MMR', 'Qızılca, parotit, məxmərək', 'Measles, Mumps, Rubella', 'Qızılca, parotit, məxmərək', 'Measles, Mumps, Rubella', 'Dərialtı', 'Subcutaneous', '#F43F5E', true, 15);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('396b45c8-9125-4b69-b75d-13880cf4f576', '87d03134-dec7-4f48-85fa-5f9fb9f98843', 'CA', 1, '1-ci doza', '1st dose', 365, '12 aylıq', '12 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('120af370-462e-47ac-bccd-75360890a8a4', '87d03134-dec7-4f48-85fa-5f9fb9f98843', 'CA', 2, '2-ci doza', '2nd dose', 540, '18 aylıq', '18 months', 11);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('9b6734ec-059a-41aa-9331-460f36cb8906', 'CA', 'MenACWY', 'Meningokokk', 'Meningococcal', 'Meningokokk xəstəliyi', 'Meningococcal disease', 'Əzələdaxili', 'Intramuscular', '#F59E0B', true, 16);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('a827d883-7223-42e6-91f2-5fc508afe79c', '9b6734ec-059a-41aa-9331-460f36cb8906', 'CA', 1, '1-ci doza', '1st dose', 365, '12 aylıq', '12 months', 10);
INSERT INTO public.vaccine_countries (id, code, name_az, name_en, flag_emoji, source_url, source_label, sort_order)
VALUES ('164849c6-bf37-4678-b9b5-6bb687c0e84f', 'AU', 'Avstraliya', 'Australia', '🇦🇺', 'https://www.health.gov.au/', 'Dept of Health AU', 19);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('fbea22bd-2452-48d1-8088-f014772b61c1', 'AU', 'HepB', 'Hepatit B', 'Hepatitis B', 'Hepatit B virusu', 'Hepatitis B virus', 'Əzələdaxili', 'Intramuscular', '#3B82F6', true, 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('20599f1a-c987-47f3-abfa-8de442b805e5', 'fbea22bd-2452-48d1-8088-f014772b61c1', 'AU', 1, '1-ci doza', '1st dose', 0, 'Doğulanda', 'At birth', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('71786adf-0187-4406-8a9e-c175e51497e5', 'fbea22bd-2452-48d1-8088-f014772b61c1', 'AU', 2, '2-ci doza', '2nd dose', 60, '2 aylıq', '2 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('5afc7794-7554-4592-bd32-ddb1c6862f57', 'fbea22bd-2452-48d1-8088-f014772b61c1', 'AU', 3, '3-ci doza', '3rd dose', 120, '4 aylıq', '4 months', 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('61fe96dc-903e-40ca-a7fb-688c3dd90fbf', 'fbea22bd-2452-48d1-8088-f014772b61c1', 'AU', 4, '4-ci doza', '4th dose', 180, '6 aylıq', '6 months', 13);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('18717d94-0823-444e-95da-03448dcb2da3', 'AU', 'DTaP', 'Göy öskürək, difteriya, tetanoz', 'Diphtheria, Tetanus, Pertussis', 'Göy öskürək, difteriya, tetanoz', 'Diphtheria, Tetanus, Pertussis', 'Əzələdaxili', 'Intramuscular', '#EF4444', true, 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('ca059055-db9d-42c2-9726-a28997ccc356', '18717d94-0823-444e-95da-03448dcb2da3', 'AU', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('fb10efc7-8fe4-4cf3-b615-a799a5c349e3', '18717d94-0823-444e-95da-03448dcb2da3', 'AU', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('a36b5c8d-608e-4336-87a4-137b776ce19e', '18717d94-0823-444e-95da-03448dcb2da3', 'AU', 3, '3-ci doza', '3rd dose', 180, '6 aylıq', '6 months', 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('022faa4c-aa15-4920-811b-843f4687d6fb', '18717d94-0823-444e-95da-03448dcb2da3', 'AU', 4, '4-ci doza', '4th dose', 540, '18 aylıq', '18 months', 13);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('a6b876ec-1d99-4212-89e2-d055db9ea3a2', 'AU', 'IPV', 'Poliomielit (IPV)', 'Polio (IPV)', 'Poliomielit', 'Poliomyelitis', 'Əzələdaxili', 'Intramuscular', '#F59E0B', true, 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('6c0b429d-5b46-4f86-b886-37d331c61ede', 'a6b876ec-1d99-4212-89e2-d055db9ea3a2', 'AU', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('44db314e-80c2-428f-920f-3c7fb869599b', 'a6b876ec-1d99-4212-89e2-d055db9ea3a2', 'AU', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('e189d1a0-db40-4eb2-a595-05e38a678706', 'a6b876ec-1d99-4212-89e2-d055db9ea3a2', 'AU', 3, '3-ci doza', '3rd dose', 180, '6 aylıq', '6 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('0881d156-9231-4a8c-a459-1bfe13c0fb7e', 'AU', 'HiB', 'Hib infeksiyası', 'Haemophilus influenzae type b', 'Meningit, pnevmoniya', 'Meningitis, pneumonia', 'Əzələdaxili', 'Intramuscular', '#8B5CF6', true, 13);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('b342b852-72f6-4c52-ba44-39b45f413206', '0881d156-9231-4a8c-a459-1bfe13c0fb7e', 'AU', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('ec8d2972-c250-4adf-9419-d34bf0903fb5', '0881d156-9231-4a8c-a459-1bfe13c0fb7e', 'AU', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('cbc3cc43-1899-403c-a98e-da2d8fc6953b', '0881d156-9231-4a8c-a459-1bfe13c0fb7e', 'AU', 3, '3-ci doza', '3rd dose', 180, '6 aylıq', '6 months', 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('023293a9-ca78-400b-89f9-bdf287f4eabf', '0881d156-9231-4a8c-a459-1bfe13c0fb7e', 'AU', 4, '4-ci doza', '4th dose', 540, '18 aylıq', '18 months', 13);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('e52744da-e24f-4d22-9c8f-9f3c6f0a33a9', 'AU', 'PCV', 'Pnevmokokk', 'Pneumococcal', 'Pnevmoniya, meningit', 'Pneumonia, meningitis', 'Əzələdaxili', 'Intramuscular', '#EC4899', true, 14);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('59b156f8-8de5-48d2-b619-210523c2f6de', 'e52744da-e24f-4d22-9c8f-9f3c6f0a33a9', 'AU', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('c0f0115d-fdc3-4810-aa94-4ae66d302a1e', 'e52744da-e24f-4d22-9c8f-9f3c6f0a33a9', 'AU', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('3225948a-da8e-40ef-9729-aa169f689cd2', 'e52744da-e24f-4d22-9c8f-9f3c6f0a33a9', 'AU', 3, '3-ci doza', '3rd dose', 365, '12 aylıq', '12 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('e7a08eb1-66c3-424b-a0ca-0b1dabc98377', 'AU', 'RV', 'Rotavirus', 'Rotavirus', 'Rotavirus ishalı', 'Rotavirus diarrhea', 'Ağızdan', 'Oral', '#14B8A6', true, 15);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('e2cec683-ccd1-466f-8458-89ec8586dcf3', 'e7a08eb1-66c3-424b-a0ca-0b1dabc98377', 'AU', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('11e9e752-ef03-4120-906b-3166ecae236e', 'e7a08eb1-66c3-424b-a0ca-0b1dabc98377', 'AU', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('4d098728-868a-4a8d-b35a-6853b7dae46b', 'AU', 'MMR', 'Qızılca, parotit, məxmərək', 'Measles, Mumps, Rubella', 'Qızılca, parotit, məxmərək', 'Measles, Mumps, Rubella', 'Dərialtı', 'Subcutaneous', '#F43F5E', true, 16);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('1002afab-c12a-4b44-9722-a2c73b95fcfd', '4d098728-868a-4a8d-b35a-6853b7dae46b', 'AU', 1, '1-ci doza', '1st dose', 365, '12 aylıq', '12 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('1f418ce6-d3fb-4b45-b2b8-3a64ce05cd9d', '4d098728-868a-4a8d-b35a-6853b7dae46b', 'AU', 2, '2-ci doza', '2nd dose', 540, '18 aylıq', '18 months', 11);
INSERT INTO public.vaccine_countries (id, code, name_az, name_en, flag_emoji, source_url, source_label, sort_order)
VALUES ('ede8ae84-5a34-4b0c-81ec-f47a1de65244', 'AE', 'Birləşmiş Ərəb Əmirlikləri', 'United Arab Emirates', '🇦🇪', 'https://www.mohap.gov.ae/', 'MOHAP UAE', 20);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('12bdc8a8-0cf6-41f5-81fb-4a323481be47', 'AE', 'BCG', 'Vərəm (BCG)', 'Tuberculosis (BCG)', 'Vərəm', 'Tuberculosis', 'Dəridaxili', 'Intradermal', '#10B981', true, 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('6413f94c-55ea-4816-a668-2ef83582db83', '12bdc8a8-0cf6-41f5-81fb-4a323481be47', 'AE', 1, '1-ci doza', '1st dose', 0, 'Doğulanda', 'At birth', 10);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('a3ffeb2e-2216-4dc4-96e8-e324d8a3449c', 'AE', 'HepB', 'Hepatit B', 'Hepatitis B', 'Hepatit B virusu', 'Hepatitis B virus', 'Əzələdaxili', 'Intramuscular', '#3B82F6', true, 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('329af1e1-b0cc-414e-852b-74be8c4ceda1', 'a3ffeb2e-2216-4dc4-96e8-e324d8a3449c', 'AE', 1, '1-ci doza', '1st dose', 0, 'Doğulanda', 'At birth', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('3f56423d-684f-4a82-9a37-bc296403e42e', 'a3ffeb2e-2216-4dc4-96e8-e324d8a3449c', 'AE', 2, '2-ci doza', '2nd dose', 60, '2 aylıq', '2 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('2e32384c-c094-4ff9-8b21-566c7fac6d3c', 'a3ffeb2e-2216-4dc4-96e8-e324d8a3449c', 'AE', 3, '3-ci doza', '3rd dose', 120, '4 aylıq', '4 months', 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('479c87e4-0c49-4d9b-9d18-f4109e112904', 'a3ffeb2e-2216-4dc4-96e8-e324d8a3449c', 'AE', 4, '4-ci doza', '4th dose', 180, '6 aylıq', '6 months', 13);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('33ce9bb3-fb28-4c61-b8cd-4d78988c3412', 'AE', 'DTaP', 'Göy öskürək, difteriya, tetanoz', 'Diphtheria, Tetanus, Pertussis', 'Göy öskürək, difteriya, tetanoz', 'Diphtheria, Tetanus, Pertussis', 'Əzələdaxili', 'Intramuscular', '#EF4444', true, 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('f19648a7-05b6-4015-b53e-f71e0f2c30fd', '33ce9bb3-fb28-4c61-b8cd-4d78988c3412', 'AE', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('1a39a3ad-de92-4f2f-8bd3-0ec005dad3c4', '33ce9bb3-fb28-4c61-b8cd-4d78988c3412', 'AE', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('31b253a9-3e12-4972-a458-0456cf6f70fd', '33ce9bb3-fb28-4c61-b8cd-4d78988c3412', 'AE', 3, '3-ci doza', '3rd dose', 180, '6 aylıq', '6 months', 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('318aabd6-ea1b-40de-ac07-0087ed7ca3fb', '33ce9bb3-fb28-4c61-b8cd-4d78988c3412', 'AE', 4, '4-ci doza', '4th dose', 540, '18 aylıq', '18 months', 13);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('0c024d0a-4fa8-4095-a40c-4728d295aef1', 'AE', 'HiB', 'Hib infeksiyası', 'Haemophilus influenzae type b', 'Meningit, pnevmoniya', 'Meningitis, pneumonia', 'Əzələdaxili', 'Intramuscular', '#8B5CF6', true, 13);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('1347c0ac-00bd-4f65-854f-a9ea9f052b8f', '0c024d0a-4fa8-4095-a40c-4728d295aef1', 'AE', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('e907fd82-b017-4d45-a2df-6186a364e11c', '0c024d0a-4fa8-4095-a40c-4728d295aef1', 'AE', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('c8c328ee-0523-47a7-b882-5ade85e633eb', '0c024d0a-4fa8-4095-a40c-4728d295aef1', 'AE', 3, '3-ci doza', '3rd dose', 180, '6 aylıq', '6 months', 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('c18209fc-b1a9-42d4-8ef1-9faef6b5f118', '0c024d0a-4fa8-4095-a40c-4728d295aef1', 'AE', 4, '4-ci doza', '4th dose', 540, '18 aylıq', '18 months', 13);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('21c8cede-551f-4546-b9d3-fc91121b4278', 'AE', 'IPV', 'Poliomielit (IPV)', 'Polio (IPV)', 'Poliomielit', 'Poliomyelitis', 'Əzələdaxili', 'Intramuscular', '#F59E0B', true, 14);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('a5dcf2a2-3693-446c-bbb2-a84fad30743e', '21c8cede-551f-4546-b9d3-fc91121b4278', 'AE', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('42944fe1-9763-4433-b500-fe9519401d9c', '21c8cede-551f-4546-b9d3-fc91121b4278', 'AE', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('2770053b-a4d6-41dd-b6cc-37983535e134', '21c8cede-551f-4546-b9d3-fc91121b4278', 'AE', 3, '3-ci doza', '3rd dose', 180, '6 aylıq', '6 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('e10e610f-ed2a-4bf9-b1c9-6e0df7f973c5', 'AE', 'PCV', 'Pnevmokokk', 'Pneumococcal', 'Pnevmoniya, meningit', 'Pneumonia, meningitis', 'Əzələdaxili', 'Intramuscular', '#EC4899', true, 15);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('340ada2d-0162-4e09-b35d-57e5196c1ad3', 'e10e610f-ed2a-4bf9-b1c9-6e0df7f973c5', 'AE', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('12be45f0-b47f-4409-bf6b-f27601ef3884', 'e10e610f-ed2a-4bf9-b1c9-6e0df7f973c5', 'AE', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('d91870d2-0fbf-41c1-858c-5a35d5739034', 'e10e610f-ed2a-4bf9-b1c9-6e0df7f973c5', 'AE', 3, '3-ci doza', '3rd dose', 180, '6 aylıq', '6 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('0791e3cf-a2fe-471f-bb76-f7816e75e510', 'AE', 'MMR', 'Qızılca, parotit, məxmərək', 'Measles, Mumps, Rubella', 'Qızılca, parotit, məxmərək', 'Measles, Mumps, Rubella', 'Dərialtı', 'Subcutaneous', '#F43F5E', true, 16);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('98f54c96-2493-456d-8ed0-8abd09837aab', '0791e3cf-a2fe-471f-bb76-f7816e75e510', 'AE', 1, '1-ci doza', '1st dose', 365, '12 aylıq', '12 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('84e7a2fa-c8d4-4f5e-b8dc-aa7ac3488453', '0791e3cf-a2fe-471f-bb76-f7816e75e510', 'AE', 2, '2-ci doza', '2nd dose', 1825, '5-6 yaş', '5-6 years', 11);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('0c050188-e1e4-426e-9219-a02a922f9fa8', 'AE', 'VAR', 'Su çiçəyi', 'Varicella (Chickenpox)', 'Su çiçəyi', 'Chickenpox', 'Dərialtı', 'Subcutaneous', '#6366F1', true, 17);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('24223e56-adb3-4f54-8169-33b2bb00566a', '0c050188-e1e4-426e-9219-a02a922f9fa8', 'AE', 1, '1-ci doza', '1st dose', 365, '12 aylıq', '12 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('88fc22f6-a7f5-47a2-8a3f-522af9b9ad36', '0c050188-e1e4-426e-9219-a02a922f9fa8', 'AE', 2, '2-ci doza', '2nd dose', 1825, '5-6 yaş', '5-6 years', 11);
INSERT INTO public.vaccine_countries (id, code, name_az, name_en, flag_emoji, source_url, source_label, sort_order)
VALUES ('7d8b018c-3861-4d8a-a710-4362df998af9', 'SA', 'Səudiyyə Ərəbistanı', 'Saudi Arabia', '🇸🇦', 'https://www.moh.gov.sa/', 'MOH SA', 21);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('148510fd-a8d1-4e2c-a656-558e8bac576d', 'SA', 'BCG', 'Vərəm (BCG)', 'Tuberculosis (BCG)', 'Vərəm', 'Tuberculosis', 'Dəridaxili', 'Intradermal', '#10B981', true, 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('5d6db424-4eb0-4fc8-9f30-8f2e5c561d34', '148510fd-a8d1-4e2c-a656-558e8bac576d', 'SA', 1, '1-ci doza', '1st dose', 0, 'Doğulanda', 'At birth', 10);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('92d98612-a0f3-430e-b0f0-3d1271fba565', 'SA', 'HepB', 'Hepatit B', 'Hepatitis B', 'Hepatit B virusu', 'Hepatitis B virus', 'Əzələdaxili', 'Intramuscular', '#3B82F6', true, 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('6c2c2ce4-e988-4813-8c0a-7206e3828859', '92d98612-a0f3-430e-b0f0-3d1271fba565', 'SA', 1, '1-ci doza', '1st dose', 0, 'Doğulanda', 'At birth', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('7d7731f0-f196-4389-84ed-d3de4506b069', '92d98612-a0f3-430e-b0f0-3d1271fba565', 'SA', 2, '2-ci doza', '2nd dose', 60, '2 aylıq', '2 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('14219585-eb99-456b-bc90-8bb21f21e039', '92d98612-a0f3-430e-b0f0-3d1271fba565', 'SA', 3, '3-ci doza', '3rd dose', 120, '4 aylıq', '4 months', 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('d33163c5-0227-4aa3-aaa4-69598e050187', '92d98612-a0f3-430e-b0f0-3d1271fba565', 'SA', 4, '4-ci doza', '4th dose', 180, '6 aylıq', '6 months', 13);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('06e8956b-060a-4361-a400-bb94e32f723a', 'SA', 'DTaP', 'Göy öskürək, difteriya, tetanoz', 'Diphtheria, Tetanus, Pertussis', 'Göy öskürək, difteriya, tetanoz', 'Diphtheria, Tetanus, Pertussis', 'Əzələdaxili', 'Intramuscular', '#EF4444', true, 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('ab2f5634-5b6b-4b38-8019-330d77bf7e58', '06e8956b-060a-4361-a400-bb94e32f723a', 'SA', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('a3af34e4-fe44-407f-bcb0-082df848de4d', '06e8956b-060a-4361-a400-bb94e32f723a', 'SA', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('2a477305-d77b-4306-bc41-2b92205abe0c', '06e8956b-060a-4361-a400-bb94e32f723a', 'SA', 3, '3-ci doza', '3rd dose', 180, '6 aylıq', '6 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('317fa97e-0739-4b9e-8708-2dcc4508cc86', 'SA', 'PCV', 'Pnevmokokk', 'Pneumococcal', 'Pnevmoniya, meningit', 'Pneumonia, meningitis', 'Əzələdaxili', 'Intramuscular', '#EC4899', true, 13);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('78764214-78c7-4aa9-8357-0e451fbfa8e9', '317fa97e-0739-4b9e-8708-2dcc4508cc86', 'SA', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('ed1e03fb-ae62-4a83-b7c2-14e0211f4ab8', '317fa97e-0739-4b9e-8708-2dcc4508cc86', 'SA', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('011788c9-dd76-4678-b042-d67a3ebcdb30', '317fa97e-0739-4b9e-8708-2dcc4508cc86', 'SA', 3, '3-ci doza', '3rd dose', 180, '6 aylıq', '6 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('de1c29b8-ef0d-4035-9704-98dfbcaf5ff9', 'SA', 'RV', 'Rotavirus', 'Rotavirus', 'Rotavirus ishalı', 'Rotavirus diarrhea', 'Ağızdan', 'Oral', '#14B8A6', true, 14);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('b29a6474-5076-4548-980f-f8715b76c028', 'de1c29b8-ef0d-4035-9704-98dfbcaf5ff9', 'SA', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('961ee3ef-359f-4a2e-b040-7e27888f23c4', 'de1c29b8-ef0d-4035-9704-98dfbcaf5ff9', 'SA', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('6e21f89c-72f7-47dd-ba50-78df6062741d', 'SA', 'MenACWY', 'Meningokokk', 'Meningococcal', 'Meningokokk xəstəliyi', 'Meningococcal disease', 'Əzələdaxili', 'Intramuscular', '#F59E0B', true, 15);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('a68565be-72da-4ab3-bb8f-02985cbfb06a', '6e21f89c-72f7-47dd-ba50-78df6062741d', 'SA', 1, '1-ci doza', '1st dose', 270, '9 aylıq', '9 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('e5b895f4-7358-49e6-afb0-7a7b6a810d9e', '6e21f89c-72f7-47dd-ba50-78df6062741d', 'SA', 2, '2-ci doza', '2nd dose', 365, '12 aylıq', '12 months', 11);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('e670f1a3-4188-46b8-823e-44d86b79531a', 'SA', 'MMR', 'Qızılca, parotit, məxmərək', 'Measles, Mumps, Rubella', 'Qızılca, parotit, məxmərək', 'Measles, Mumps, Rubella', 'Dərialtı', 'Subcutaneous', '#F43F5E', true, 16);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('c06285b7-c3ac-43a1-a27b-a84eafd70442', 'e670f1a3-4188-46b8-823e-44d86b79531a', 'SA', 1, '1-ci doza', '1st dose', 365, '12 aylıq', '12 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('a1a0d2b4-b065-4d73-a844-7c66d14915c2', 'e670f1a3-4188-46b8-823e-44d86b79531a', 'SA', 2, '2-ci doza', '2nd dose', 540, '18 aylıq', '18 months', 11);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('356c0a3e-8aaa-4860-be0c-1526d777ce1a', 'SA', 'HepA', 'Hepatit A', 'Hepatitis A', 'Hepatit A virusu', 'Hepatitis A virus', 'Əzələdaxili', 'Intramuscular', '#3B82F6', true, 17);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('11c0ffd3-fa30-4f28-bc92-79b2e3151d3f', '356c0a3e-8aaa-4860-be0c-1526d777ce1a', 'SA', 1, '1-ci doza', '1st dose', 540, '18 aylıq', '18 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('77c23dcf-adb3-4192-9c6b-1712d13795b8', '356c0a3e-8aaa-4860-be0c-1526d777ce1a', 'SA', 2, '2-ci doza', '2nd dose', 730, '24 aylıq', '24 months', 11);
INSERT INTO public.vaccine_countries (id, code, name_az, name_en, flag_emoji, source_url, source_label, sort_order)
VALUES ('ac26857e-c4f9-4fd3-b17d-35c03dd18251', 'KZ', 'Qazaxıstan', 'Kazakhstan', '🇰🇿', 'https://egov.kz/', 'eGov KZ', 22);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('8825fa1c-182a-4616-8229-00a923bb1df6', 'KZ', 'BCG', 'Vərəm (BCG)', 'Tuberculosis (BCG)', 'Vərəm', 'Tuberculosis', 'Dəridaxili', 'Intradermal', '#10B981', true, 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('f40151d9-cbcf-40e5-98ad-a87d81e938cd', '8825fa1c-182a-4616-8229-00a923bb1df6', 'KZ', 1, '1-ci doza', '1st dose', 3, '1-4 gün', '1-4 days', 10);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('60ae2707-9c06-4158-a9dd-be37777448ae', 'KZ', 'HepB', 'Hepatit B', 'Hepatitis B', 'Hepatit B virusu', 'Hepatitis B virus', 'Əzələdaxili', 'Intramuscular', '#3B82F6', true, 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('142ba19d-6ed6-49d9-af1c-c5a6b090dd84', '60ae2707-9c06-4158-a9dd-be37777448ae', 'KZ', 1, '1-ci doza', '1st dose', 3, '1-4 gün', '1-4 days', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('184c97d9-3eb3-42a4-ab50-fa1b1626daf9', '60ae2707-9c06-4158-a9dd-be37777448ae', 'KZ', 2, '2-ci doza', '2nd dose', 60, '2 aylıq', '2 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('c36b12ad-cd7d-4c88-8595-549cb2d9954e', '60ae2707-9c06-4158-a9dd-be37777448ae', 'KZ', 3, '3-ci doza', '3rd dose', 120, '4 aylıq', '4 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('14546daa-b45b-4749-939b-71f4139b0182', 'KZ', 'DTaP', 'Göy öskürək, difteriya, tetanoz', 'Diphtheria, Tetanus, Pertussis', 'Göy öskürək, difteriya, tetanoz', 'Diphtheria, Tetanus, Pertussis', 'Əzələdaxili', 'Intramuscular', '#EF4444', true, 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('6ebf281c-eeaf-4d9f-89a3-de5bfc5c00f0', '14546daa-b45b-4749-939b-71f4139b0182', 'KZ', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('c10f1d0e-175a-430d-84b7-de85e8c7349e', '14546daa-b45b-4749-939b-71f4139b0182', 'KZ', 2, '2-ci doza', '2nd dose', 90, '3 aylıq', '3 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('9ea915f2-bb33-446c-ab6f-134a9b85a1ab', '14546daa-b45b-4749-939b-71f4139b0182', 'KZ', 3, '3-ci doza', '3rd dose', 120, '4 aylıq', '4 months', 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('4564c1b7-127f-48b4-9e78-39c0414d9eff', '14546daa-b45b-4749-939b-71f4139b0182', 'KZ', 4, '4-ci doza', '4th dose', 540, '18 aylıq', '18 months', 13);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('0fa2300b-74f5-49d3-bf08-ab0acffbab21', 'KZ', 'IPV', 'Poliomielit (IPV)', 'Polio (IPV)', 'Poliomielit', 'Poliomyelitis', 'Əzələdaxili', 'Intramuscular', '#F59E0B', true, 13);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('f11a19b0-fcc4-48da-8f62-d413dc94298f', '0fa2300b-74f5-49d3-bf08-ab0acffbab21', 'KZ', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('b9889d65-9aff-4bf0-9a77-07ed73b3b7cd', '0fa2300b-74f5-49d3-bf08-ab0acffbab21', 'KZ', 2, '2-ci doza', '2nd dose', 90, '3 aylıq', '3 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('7198a63a-ee06-4596-811c-a0f06b527920', '0fa2300b-74f5-49d3-bf08-ab0acffbab21', 'KZ', 3, '3-ci doza', '3rd dose', 120, '4 aylıq', '4 months', 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('d9bb42cf-3d8e-4e4b-b9c8-4b68ba257330', '0fa2300b-74f5-49d3-bf08-ab0acffbab21', 'KZ', 4, '4-ci doza', '4th dose', 540, '18 aylıq', '18 months', 13);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('b1180b84-9a65-4391-912f-89dde5133827', 'KZ', 'HiB', 'Hib infeksiyası', 'Haemophilus influenzae type b', 'Meningit, pnevmoniya', 'Meningitis, pneumonia', 'Əzələdaxili', 'Intramuscular', '#8B5CF6', true, 14);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('876be280-baff-4338-a41c-447540cd63b6', 'b1180b84-9a65-4391-912f-89dde5133827', 'KZ', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('452254e6-9453-47d6-b64e-4422ca206012', 'b1180b84-9a65-4391-912f-89dde5133827', 'KZ', 2, '2-ci doza', '2nd dose', 90, '3 aylıq', '3 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('794d4263-f625-4e5c-89db-4ba910d24845', 'b1180b84-9a65-4391-912f-89dde5133827', 'KZ', 3, '3-ci doza', '3rd dose', 120, '4 aylıq', '4 months', 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('69391aa4-449a-473c-a9a7-b704ef104593', 'b1180b84-9a65-4391-912f-89dde5133827', 'KZ', 4, '4-ci doza', '4th dose', 540, '18 aylıq', '18 months', 13);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('6d9e8357-fce5-4ab0-8313-e972ce91b396', 'KZ', 'PCV', 'Pnevmokokk', 'Pneumococcal', 'Pnevmoniya, meningit', 'Pneumonia, meningitis', 'Əzələdaxili', 'Intramuscular', '#EC4899', true, 15);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('6905926f-9b79-4f87-bc31-3e5e1d1df259', '6d9e8357-fce5-4ab0-8313-e972ce91b396', 'KZ', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('9efd047b-f49b-4f94-9d52-b8e3000c07ee', '6d9e8357-fce5-4ab0-8313-e972ce91b396', 'KZ', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('e5f578fe-a23b-41bf-a27c-dc71721088a7', '6d9e8357-fce5-4ab0-8313-e972ce91b396', 'KZ', 3, '3-ci doza', '3rd dose', 365, '12 aylıq', '12 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('5c092568-5e18-47b6-8868-82951713e423', 'KZ', 'MMR', 'Qızılca, parotit, məxmərək', 'Measles, Mumps, Rubella', 'Qızılca, parotit, məxmərək', 'Measles, Mumps, Rubella', 'Dərialtı', 'Subcutaneous', '#F43F5E', true, 16);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('f8606a8e-e3e7-4036-a150-685b54f6897e', '5c092568-5e18-47b6-8868-82951713e423', 'KZ', 1, '1-ci doza', '1st dose', 365, '12 aylıq', '12 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('7b6dba7f-297c-45fe-a914-fc88b5b8c389', '5c092568-5e18-47b6-8868-82951713e423', 'KZ', 2, '2-ci doza', '2nd dose', 2190, '6 yaş', '6 years', 11);
INSERT INTO public.vaccine_countries (id, code, name_az, name_en, flag_emoji, source_url, source_label, sort_order)
VALUES ('84bf5d2a-63b0-44b0-b15c-13f7d72ee9f2', 'GE', 'Gürcüstan', 'Georgia', '🇬🇪', 'https://ncdc.ge/', 'NCDC Georgia', 23);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('51a64d52-235d-4d4c-80e8-0afb8f7c6ba2', 'GE', 'HepB', 'Hepatit B', 'Hepatitis B', 'Hepatit B virusu', 'Hepatitis B virus', 'Əzələdaxili', 'Intramuscular', '#3B82F6', true, 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('dd6d1720-b2d0-4994-be11-9317e26d9e5f', '51a64d52-235d-4d4c-80e8-0afb8f7c6ba2', 'GE', 1, '1-ci doza', '1st dose', 0, 'Doğulanda', 'At birth', 10);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('88bfd4c7-d725-4f36-b20e-56a880af220d', 'GE', 'BCG', 'Vərəm (BCG)', 'Tuberculosis (BCG)', 'Vərəm', 'Tuberculosis', 'Dəridaxili', 'Intradermal', '#10B981', true, 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('b6c5bf58-43e5-49c8-baee-e106ec6c01e4', '88bfd4c7-d725-4f36-b20e-56a880af220d', 'GE', 1, '1-ci doza', '1st dose', 3, '0-5 gün', '0-5 days', 10);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('d9cb0213-f036-4627-96aa-a845f703adc8', 'GE', 'DTaP', 'Göy öskürək, difteriya, tetanoz', 'Diphtheria, Tetanus, Pertussis', 'Göy öskürək, difteriya, tetanoz', 'Diphtheria, Tetanus, Pertussis', 'Əzələdaxili', 'Intramuscular', '#EF4444', true, 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('28ee84b0-66e9-47ef-8731-68e62419784e', 'd9cb0213-f036-4627-96aa-a845f703adc8', 'GE', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('46faeebe-8496-472e-b82e-cba3a28c21ee', 'd9cb0213-f036-4627-96aa-a845f703adc8', 'GE', 2, '2-ci doza', '2nd dose', 90, '3 aylıq', '3 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('892bc8f5-f24e-4b9d-ab82-8d2ea769af10', 'd9cb0213-f036-4627-96aa-a845f703adc8', 'GE', 3, '3-ci doza', '3rd dose', 120, '4 aylıq', '4 months', 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('a170631f-dee7-4f8d-b023-3955a937351f', 'd9cb0213-f036-4627-96aa-a845f703adc8', 'GE', 4, '4-ci doza', '4th dose', 540, '18 aylıq', '18 months', 13);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('a2cddb32-b445-4f87-b361-cea4bda863a1', 'GE', 'IPV', 'Poliomielit (IPV)', 'Polio (IPV)', 'Poliomielit', 'Poliomyelitis', 'Əzələdaxili', 'Intramuscular', '#F59E0B', true, 13);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('85afaff4-38b8-414a-9249-00f7d4db81a6', 'a2cddb32-b445-4f87-b361-cea4bda863a1', 'GE', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('8292a304-8f25-4cb7-83c1-438b04847871', 'a2cddb32-b445-4f87-b361-cea4bda863a1', 'GE', 2, '2-ci doza', '2nd dose', 90, '3 aylıq', '3 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('80f517de-5be0-4f81-9c8f-579972483987', 'a2cddb32-b445-4f87-b361-cea4bda863a1', 'GE', 3, '3-ci doza', '3rd dose', 120, '4 aylıq', '4 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('49fa962a-15e7-435c-b626-c71e982cc5b8', 'GE', 'HiB', 'Hib infeksiyası', 'Haemophilus influenzae type b', 'Meningit, pnevmoniya', 'Meningitis, pneumonia', 'Əzələdaxili', 'Intramuscular', '#8B5CF6', true, 14);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('2effb9df-1aff-4cc6-9203-255088860ccb', '49fa962a-15e7-435c-b626-c71e982cc5b8', 'GE', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('c3caf5db-c374-4924-b569-f166ddd8946f', '49fa962a-15e7-435c-b626-c71e982cc5b8', 'GE', 2, '2-ci doza', '2nd dose', 90, '3 aylıq', '3 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('b148aeb3-acec-45f7-903b-824ddfbbdfc9', '49fa962a-15e7-435c-b626-c71e982cc5b8', 'GE', 3, '3-ci doza', '3rd dose', 120, '4 aylıq', '4 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('6a219c95-938b-430b-bc4f-8532667bc312', 'GE', 'PCV', 'Pnevmokokk', 'Pneumococcal', 'Pnevmoniya, meningit', 'Pneumonia, meningitis', 'Əzələdaxili', 'Intramuscular', '#EC4899', true, 15);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('87fd372e-452b-4ab3-a864-ef18e0fdfe5e', '6a219c95-938b-430b-bc4f-8532667bc312', 'GE', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('29f92f27-ec49-4b5f-83ca-8036362d8438', '6a219c95-938b-430b-bc4f-8532667bc312', 'GE', 2, '2-ci doza', '2nd dose', 90, '3 aylıq', '3 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('98a8de3c-ec2d-4446-b5d4-41511e34c822', '6a219c95-938b-430b-bc4f-8532667bc312', 'GE', 3, '3-ci doza', '3rd dose', 365, '12 aylıq', '12 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('260d9604-e6fb-417f-abb7-11cdb30fbd2b', 'GE', 'RV', 'Rotavirus', 'Rotavirus', 'Rotavirus ishalı', 'Rotavirus diarrhea', 'Ağızdan', 'Oral', '#14B8A6', true, 16);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('97fffe02-a9fb-4f7a-863c-c00509de2a17', '260d9604-e6fb-417f-abb7-11cdb30fbd2b', 'GE', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('2057400c-f67d-4631-8df8-54340783a6ce', '260d9604-e6fb-417f-abb7-11cdb30fbd2b', 'GE', 2, '2-ci doza', '2nd dose', 90, '3 aylıq', '3 months', 11);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('15d31e20-cf8e-428b-8e71-b58aaad1b78f', 'GE', 'MMR', 'Qızılca, parotit, məxmərək', 'Measles, Mumps, Rubella', 'Qızılca, parotit, məxmərək', 'Measles, Mumps, Rubella', 'Dərialtı', 'Subcutaneous', '#F43F5E', true, 17);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('4ffa9f05-c95a-4055-9648-7aa39ac7658c', '15d31e20-cf8e-428b-8e71-b58aaad1b78f', 'GE', 1, '1-ci doza', '1st dose', 365, '12 aylıq', '12 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('da3bef09-1556-485b-a87a-4baeeb996455', '15d31e20-cf8e-428b-8e71-b58aaad1b78f', 'GE', 2, '2-ci doza', '2nd dose', 1825, '5 yaş', '5 years', 11);
INSERT INTO public.vaccine_countries (id, code, name_az, name_en, flag_emoji, source_url, source_label, sort_order)
VALUES ('9f18d1a8-4bfe-4bd5-a7d8-2a96b223f85e', 'UA', 'Ukrayna', 'Ukraine', '🇺🇦', 'https://moz.gov.ua/', 'МОЗ України', 24);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('d748a41d-bac8-4813-930a-e57e18a99a2a', 'UA', 'HepB', 'Hepatit B', 'Hepatitis B', 'Hepatit B virusu', 'Hepatitis B virus', 'Əzələdaxili', 'Intramuscular', '#3B82F6', true, 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('630fad9a-ab02-45d0-b3ce-ec04dd08ab9d', 'd748a41d-bac8-4813-930a-e57e18a99a2a', 'UA', 1, '1-ci doza', '1st dose', 0, 'Doğulanda', 'At birth', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('b4128033-0f60-4b7f-b054-dcf2fd8efa56', 'd748a41d-bac8-4813-930a-e57e18a99a2a', 'UA', 2, '2-ci doza', '2nd dose', 60, '2 aylıq', '2 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('7422ca93-3a31-4edb-90db-8950153d1484', 'd748a41d-bac8-4813-930a-e57e18a99a2a', 'UA', 3, '3-ci doza', '3rd dose', 180, '6 aylıq', '6 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('a60501d3-afe3-4004-9ab3-da1f7a171ca8', 'UA', 'BCG', 'Vərəm (BCG)', 'Tuberculosis (BCG)', 'Vərəm', 'Tuberculosis', 'Dəridaxili', 'Intradermal', '#10B981', true, 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('d69a0d32-4845-459c-86da-c6e3e9580291', 'a60501d3-afe3-4004-9ab3-da1f7a171ca8', 'UA', 1, '1-ci doza', '1st dose', 4, '3-5 gün', '3-5 days', 10);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('75d3b019-536e-4d0f-b391-fc8682693368', 'UA', 'DTaP', 'Göy öskürək, difteriya, tetanoz', 'Diphtheria, Tetanus, Pertussis', 'Göy öskürək, difteriya, tetanoz', 'Diphtheria, Tetanus, Pertussis', 'Əzələdaxili', 'Intramuscular', '#EF4444', true, 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('76f33d84-931b-420e-b136-5973ae333a55', '75d3b019-536e-4d0f-b391-fc8682693368', 'UA', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('67b8fc8a-2f55-447f-ae55-2eff6889e8f9', '75d3b019-536e-4d0f-b391-fc8682693368', 'UA', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('bbdeb79e-aea0-42e2-96d3-ef67a0af75b6', '75d3b019-536e-4d0f-b391-fc8682693368', 'UA', 3, '3-ci doza', '3rd dose', 180, '6 aylıq', '6 months', 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('973dba96-1fde-415e-9c8e-9476ef9861db', '75d3b019-536e-4d0f-b391-fc8682693368', 'UA', 4, '4-ci doza', '4th dose', 540, '18 aylıq', '18 months', 13);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('bc29b37d-edee-427c-9aa7-adcd7abffc82', 'UA', 'IPV', 'Poliomielit (IPV)', 'Polio (IPV)', 'Poliomielit', 'Poliomyelitis', 'Əzələdaxili', 'Intramuscular', '#F59E0B', true, 13);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('f187d1ad-16fb-40c9-a112-32c8e613269f', 'bc29b37d-edee-427c-9aa7-adcd7abffc82', 'UA', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('dbddf17b-8374-442a-9569-2db1271cf33a', 'bc29b37d-edee-427c-9aa7-adcd7abffc82', 'UA', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('96c69da2-06d5-4e84-bafe-3474394432de', 'bc29b37d-edee-427c-9aa7-adcd7abffc82', 'UA', 3, '3-ci doza', '3rd dose', 180, '6 aylıq', '6 months', 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('d04eae32-e595-4d17-9870-e3c543de6848', 'bc29b37d-edee-427c-9aa7-adcd7abffc82', 'UA', 4, '4-ci doza', '4th dose', 540, '18 aylıq', '18 months', 13);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('72d55980-5b8e-48ed-ab89-0e36c32c9fb7', 'UA', 'HiB', 'Hib infeksiyası', 'Haemophilus influenzae type b', 'Meningit, pnevmoniya', 'Meningitis, pneumonia', 'Əzələdaxili', 'Intramuscular', '#8B5CF6', true, 14);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('5971ff37-ed9f-49c6-9c47-89dcfa2793cc', '72d55980-5b8e-48ed-ab89-0e36c32c9fb7', 'UA', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('f066ec5f-73fa-408b-9d37-97ad101ba4e2', '72d55980-5b8e-48ed-ab89-0e36c32c9fb7', 'UA', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('7b504535-001e-4fa6-89ce-6500d002b293', '72d55980-5b8e-48ed-ab89-0e36c32c9fb7', 'UA', 3, '3-ci doza', '3rd dose', 365, '12 aylıq', '12 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('f39c1033-e4f6-4209-95d3-fcb49a7222d1', 'UA', 'MMR', 'Qızılca, parotit, məxmərək', 'Measles, Mumps, Rubella', 'Qızılca, parotit, məxmərək', 'Measles, Mumps, Rubella', 'Dərialtı', 'Subcutaneous', '#F43F5E', true, 15);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('56466279-d95f-4029-a934-9cd6d6bdcd52', 'f39c1033-e4f6-4209-95d3-fcb49a7222d1', 'UA', 1, '1-ci doza', '1st dose', 365, '12 aylıq', '12 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('ebc050a9-7f61-4a81-a7c2-6bb6556c167f', 'f39c1033-e4f6-4209-95d3-fcb49a7222d1', 'UA', 2, '2-ci doza', '2nd dose', 2190, '6 yaş', '6 years', 11);
INSERT INTO public.vaccine_countries (id, code, name_az, name_en, flag_emoji, source_url, source_label, sort_order)
VALUES ('12ebcd68-aded-4bd9-b2a8-8048e3964564', 'UZ', 'Özbəkistan', 'Uzbekistan', '🇺🇿', 'https://ssv.uz/', 'Sog‘liqni Saqlash Vazirligi', 25);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('b8b4f5a6-8dae-47f6-b88e-760c33b4f01a', 'UZ', 'HepB', 'Hepatit B', 'Hepatitis B', 'Hepatit B virusu', 'Hepatitis B virus', 'Əzələdaxili', 'Intramuscular', '#3B82F6', true, 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('afd9efa8-dae5-4e1f-95c8-c33692e272d5', 'b8b4f5a6-8dae-47f6-b88e-760c33b4f01a', 'UZ', 1, '1-ci doza', '1st dose', 0, 'Doğulanda', 'At birth', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('383fda56-d94d-4381-9dda-d18386aa3334', 'b8b4f5a6-8dae-47f6-b88e-760c33b4f01a', 'UZ', 2, '2-ci doza', '2nd dose', 60, '2 aylıq', '2 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('1e6d8140-b7bc-49f7-8c44-3cfa70ca8c8e', 'b8b4f5a6-8dae-47f6-b88e-760c33b4f01a', 'UZ', 3, '3-ci doza', '3rd dose', 90, '3 aylıq', '3 months', 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('f4c3cb25-00a4-4956-a9f3-f2e2c5b47e94', 'b8b4f5a6-8dae-47f6-b88e-760c33b4f01a', 'UZ', 4, '4-ci doza', '4th dose', 120, '4 aylıq', '4 months', 13);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('b0e59a15-c501-47f7-9129-0e08a60141cf', 'UZ', 'BCG', 'Vərəm (BCG)', 'Tuberculosis (BCG)', 'Vərəm', 'Tuberculosis', 'Dəridaxili', 'Intradermal', '#10B981', true, 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('fe21cba0-f39a-483b-95d5-2e46e1683302', 'b0e59a15-c501-47f7-9129-0e08a60141cf', 'UZ', 1, '1-ci doza', '1st dose', 3, '2-5 gün', '2-5 days', 10);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('e6c24797-0bd6-48e7-82fd-fa6a869d09a3', 'UZ', 'DTaP', 'Göy öskürək, difteriya, tetanoz', 'Diphtheria, Tetanus, Pertussis', 'Göy öskürək, difteriya, tetanoz', 'Diphtheria, Tetanus, Pertussis', 'Əzələdaxili', 'Intramuscular', '#EF4444', true, 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('d68e9105-001e-46bb-b2f2-ea7260bc1140', 'e6c24797-0bd6-48e7-82fd-fa6a869d09a3', 'UZ', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('b23c54b5-b61d-4328-86ac-a7833dbcd761', 'e6c24797-0bd6-48e7-82fd-fa6a869d09a3', 'UZ', 2, '2-ci doza', '2nd dose', 90, '3 aylıq', '3 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('dfe2d397-17e9-42e2-9639-907a75c136b3', 'e6c24797-0bd6-48e7-82fd-fa6a869d09a3', 'UZ', 3, '3-ci doza', '3rd dose', 120, '4 aylıq', '4 months', 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('d691f418-c022-4d98-864e-31b34ef117ef', 'e6c24797-0bd6-48e7-82fd-fa6a869d09a3', 'UZ', 4, '4-ci doza', '4th dose', 480, '16 aylıq', '16 months', 13);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('f22cef95-6ebd-404c-8d8d-2f123c3d404b', 'UZ', 'IPV', 'Poliomielit (IPV)', 'Polio (IPV)', 'Poliomielit', 'Poliomyelitis', 'Əzələdaxili', 'Intramuscular', '#F59E0B', true, 13);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('eb118e3f-d97f-488e-b66d-f6b12032decb', 'f22cef95-6ebd-404c-8d8d-2f123c3d404b', 'UZ', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('1f76acb2-5435-41ad-b688-4c85d1eab5c0', 'f22cef95-6ebd-404c-8d8d-2f123c3d404b', 'UZ', 2, '2-ci doza', '2nd dose', 90, '3 aylıq', '3 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('a91ba3c1-f1db-405f-95ef-6fb72dec0219', 'f22cef95-6ebd-404c-8d8d-2f123c3d404b', 'UZ', 3, '3-ci doza', '3rd dose', 120, '4 aylıq', '4 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('1ec35dd8-8693-46f3-bf70-5cbcc3592cb0', 'UZ', 'HiB', 'Hib infeksiyası', 'Haemophilus influenzae type b', 'Meningit, pnevmoniya', 'Meningitis, pneumonia', 'Əzələdaxili', 'Intramuscular', '#8B5CF6', true, 14);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('f2b94eb4-2d68-405d-a5a1-0c7fc3752231', '1ec35dd8-8693-46f3-bf70-5cbcc3592cb0', 'UZ', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('d98a2b10-dd1e-411c-a6cf-8598cc783b1d', '1ec35dd8-8693-46f3-bf70-5cbcc3592cb0', 'UZ', 2, '2-ci doza', '2nd dose', 90, '3 aylıq', '3 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('216f395e-7026-4627-908a-b5a2ca331131', '1ec35dd8-8693-46f3-bf70-5cbcc3592cb0', 'UZ', 3, '3-ci doza', '3rd dose', 120, '4 aylıq', '4 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('00f12124-5c60-4ea2-b5c3-0231c6a28c97', 'UZ', 'RV', 'Rotavirus', 'Rotavirus', 'Rotavirus ishalı', 'Rotavirus diarrhea', 'Ağızdan', 'Oral', '#14B8A6', true, 15);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('2315bad9-8bdc-4b15-9d1f-4802b9e87fea', '00f12124-5c60-4ea2-b5c3-0231c6a28c97', 'UZ', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('a18269f7-050e-41c6-90cb-f55baf8e54ce', '00f12124-5c60-4ea2-b5c3-0231c6a28c97', 'UZ', 2, '2-ci doza', '2nd dose', 90, '3 aylıq', '3 months', 11);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('3daba33c-4956-4af9-b6ae-4dfc4c1d5801', 'UZ', 'PCV', 'Pnevmokokk', 'Pneumococcal', 'Pnevmoniya, meningit', 'Pneumonia, meningitis', 'Əzələdaxili', 'Intramuscular', '#EC4899', true, 16);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('b37acba5-a9f6-49b1-a0e6-be5f88660e40', '3daba33c-4956-4af9-b6ae-4dfc4c1d5801', 'UZ', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('0a537dd6-806c-4b3b-8eeb-2ac56eacb46c', '3daba33c-4956-4af9-b6ae-4dfc4c1d5801', 'UZ', 2, '2-ci doza', '2nd dose', 90, '3 aylıq', '3 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('69ec8a23-f947-4932-a3fc-56a058cacf1d', '3daba33c-4956-4af9-b6ae-4dfc4c1d5801', 'UZ', 3, '3-ci doza', '3rd dose', 365, '12 aylıq', '12 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('b5260457-fe36-4786-83e7-3e2863b562da', 'UZ', 'MMR', 'Qızılca, parotit, məxmərək', 'Measles, Mumps, Rubella', 'Qızılca, parotit, məxmərək', 'Measles, Mumps, Rubella', 'Dərialtı', 'Subcutaneous', '#F43F5E', true, 17);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('bd96b1cc-ab9f-4a51-a603-a4dca97c2e70', 'b5260457-fe36-4786-83e7-3e2863b562da', 'UZ', 1, '1-ci doza', '1st dose', 365, '12 aylıq', '12 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('1af80eab-27c4-4889-8eaf-ce12af1dc000', 'b5260457-fe36-4786-83e7-3e2863b562da', 'UZ', 2, '2-ci doza', '2nd dose', 2190, '6 yaş', '6 years', 11);
INSERT INTO public.vaccine_countries (id, code, name_az, name_en, flag_emoji, source_url, source_label, sort_order)
VALUES ('50900450-6bde-4fcc-b86e-f322a164d810', 'IN', 'Hindistan', 'India', '🇮🇳', 'https://mohfw.gov.in/', 'Ministry of Health and Family Welfare', 26);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('0addedc3-803e-400d-a2de-9aeb306a18ad', 'IN', 'BCG', 'Vərəm (BCG)', 'Tuberculosis (BCG)', 'Vərəm', 'Tuberculosis', 'Dəridaxili', 'Intradermal', '#10B981', true, 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('48aa62ab-0c05-459f-a2a4-2f90b40574d4', '0addedc3-803e-400d-a2de-9aeb306a18ad', 'IN', 1, '1-ci doza', '1st dose', 0, 'Doğulanda', 'At birth', 10);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('140ba274-d4e1-475f-90fa-55836317ecd1', 'IN', 'HepB', 'Hepatit B', 'Hepatitis B', 'Hepatit B virusu', 'Hepatitis B virus', 'Əzələdaxili', 'Intramuscular', '#3B82F6', true, 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('050d350d-fb3a-4661-a46f-96cf66eface2', '140ba274-d4e1-475f-90fa-55836317ecd1', 'IN', 1, '1-ci doza', '1st dose', 0, 'Doğulanda', 'At birth', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('de6a8469-4113-40ca-809b-1cc4d7fd3f43', '140ba274-d4e1-475f-90fa-55836317ecd1', 'IN', 2, '2-ci doza', '2nd dose', 42, '6 həftə', '6 weeks', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('39efd70e-85e6-4177-a48d-1a4a67e6f79d', '140ba274-d4e1-475f-90fa-55836317ecd1', 'IN', 3, '3-ci doza', '3rd dose', 70, '10 həftə', '10 weeks', 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('68549bcb-8c1f-4ce6-b34b-62feebc2a164', '140ba274-d4e1-475f-90fa-55836317ecd1', 'IN', 4, '4-ci doza', '4th dose', 98, '14 həftə', '14 weeks', 13);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('3653aa7e-1b94-445d-b7ec-c7d8f50f22a4', 'IN', 'OPV', 'Poliomielit (OPV)', 'Polio (OPV)', 'Poliomielit', 'Poliomyelitis', 'Ağızdan (damcı)', 'Oral (drops)', '#F59E0B', true, 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('c5e0f60c-5d47-4fea-a0d2-29cd895842b5', '3653aa7e-1b94-445d-b7ec-c7d8f50f22a4', 'IN', 1, '1-ci doza', '1st dose', 0, 'Doğulanda', 'At birth', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('b00c4e61-4206-4ca1-a604-592498ce39ee', '3653aa7e-1b94-445d-b7ec-c7d8f50f22a4', 'IN', 2, '2-ci doza', '2nd dose', 42, '6 həftə', '6 weeks', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('e0576177-f96d-4200-9cd3-c33ed0a12880', '3653aa7e-1b94-445d-b7ec-c7d8f50f22a4', 'IN', 3, '3-ci doza', '3rd dose', 70, '10 həftə', '10 weeks', 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('aca442df-103c-4ab0-9b06-c27d60910ff1', '3653aa7e-1b94-445d-b7ec-c7d8f50f22a4', 'IN', 4, '4-ci doza', '4th dose', 98, '14 həftə', '14 weeks', 13);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('38054324-392f-4189-87d4-b38bda494f4c', 'IN', 'IPV', 'Poliomielit (IPV)', 'Polio (IPV)', 'Poliomielit', 'Poliomyelitis', 'Əzələdaxili', 'Intramuscular', '#F59E0B', true, 13);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('ae03e309-b13d-477a-ae74-597443a53867', '38054324-392f-4189-87d4-b38bda494f4c', 'IN', 1, '1-ci doza', '1st dose', 42, '6 həftə', '6 weeks', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('f356abfa-b0bf-4470-96a6-6237218b29ab', '38054324-392f-4189-87d4-b38bda494f4c', 'IN', 2, '2-ci doza', '2nd dose', 98, '14 həftə', '14 weeks', 11);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('5f53ad7c-c735-47db-99cb-571cfb6ffe97', 'IN', 'DTaP', 'Göy öskürək, difteriya, tetanoz', 'Diphtheria, Tetanus, Pertussis', 'Göy öskürək, difteriya, tetanoz', 'Diphtheria, Tetanus, Pertussis', 'Əzələdaxili', 'Intramuscular', '#EF4444', true, 14);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('12d9f67a-8f27-4da1-b918-55e0d5d1f76f', '5f53ad7c-c735-47db-99cb-571cfb6ffe97', 'IN', 1, '1-ci doza', '1st dose', 42, '6 həftə', '6 weeks', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('7f92c19c-c066-48a4-acd7-08ef693628fa', '5f53ad7c-c735-47db-99cb-571cfb6ffe97', 'IN', 2, '2-ci doza', '2nd dose', 70, '10 həftə', '10 weeks', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('e7a859d2-fbae-40fc-a04c-1f2d7f8156ed', '5f53ad7c-c735-47db-99cb-571cfb6ffe97', 'IN', 3, '3-ci doza', '3rd dose', 98, '14 həftə', '14 weeks', 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('1b1a58aa-eb10-4439-a4e2-408a4a4c123c', '5f53ad7c-c735-47db-99cb-571cfb6ffe97', 'IN', 4, '4-ci doza', '4th dose', 480, '16-24 aylıq', '16-24 months', 13);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('f1f717b4-599b-4bd5-861c-dba804603ac2', 'IN', 'HiB', 'Hib infeksiyası', 'Haemophilus influenzae type b', 'Meningit, pnevmoniya', 'Meningitis, pneumonia', 'Əzələdaxili', 'Intramuscular', '#8B5CF6', true, 15);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('a05d6277-e3ab-4402-8d3b-e4cee39d3e93', 'f1f717b4-599b-4bd5-861c-dba804603ac2', 'IN', 1, '1-ci doza', '1st dose', 42, '6 həftə', '6 weeks', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('9ad82a2b-1aad-42f2-9336-f571417151d1', 'f1f717b4-599b-4bd5-861c-dba804603ac2', 'IN', 2, '2-ci doza', '2nd dose', 70, '10 həftə', '10 weeks', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('588b4592-f8d7-4bf2-b899-44951049662b', 'f1f717b4-599b-4bd5-861c-dba804603ac2', 'IN', 3, '3-ci doza', '3rd dose', 98, '14 həftə', '14 weeks', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('9579a951-2fef-424a-9a58-5941fe87d78f', 'IN', 'RV', 'Rotavirus', 'Rotavirus', 'Rotavirus ishalı', 'Rotavirus diarrhea', 'Ağızdan', 'Oral', '#14B8A6', true, 16);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('f3af3bff-6649-4916-bc62-dd493339e9fa', '9579a951-2fef-424a-9a58-5941fe87d78f', 'IN', 1, '1-ci doza', '1st dose', 42, '6 həftə', '6 weeks', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('cc3cc78f-e9b2-4b75-b316-3de1430cd388', '9579a951-2fef-424a-9a58-5941fe87d78f', 'IN', 2, '2-ci doza', '2nd dose', 70, '10 həftə', '10 weeks', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('79350697-17e9-4b0a-8a61-e688d97c3d26', '9579a951-2fef-424a-9a58-5941fe87d78f', 'IN', 3, '3-ci doza', '3rd dose', 98, '14 həftə', '14 weeks', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('9d529115-a601-485f-891a-9606a720f545', 'IN', 'PCV', 'Pnevmokokk', 'Pneumococcal', 'Pnevmoniya, meningit', 'Pneumonia, meningitis', 'Əzələdaxili', 'Intramuscular', '#EC4899', true, 17);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('79f86b7c-07af-4bea-b018-88fb237946af', '9d529115-a601-485f-891a-9606a720f545', 'IN', 1, '1-ci doza', '1st dose', 42, '6 həftə', '6 weeks', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('094acabe-5f0f-4c8a-b303-874975f64b03', '9d529115-a601-485f-891a-9606a720f545', 'IN', 2, '2-ci doza', '2nd dose', 98, '14 həftə', '14 weeks', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('79692867-f216-47a9-b713-3f4cfd024691', '9d529115-a601-485f-891a-9606a720f545', 'IN', 3, '3-ci doza', '3rd dose', 270, '9 aylıq', '9 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('0ec07929-833b-4ccf-ae82-c2dfc9d5a349', 'IN', 'MMR', 'Qızılca, parotit, məxmərək', 'Measles, Mumps, Rubella', 'Qızılca, parotit, məxmərək', 'Measles, Mumps, Rubella', 'Dərialtı', 'Subcutaneous', '#F43F5E', true, 18);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('035707ce-d990-4b4c-84e8-ae7a8ab82f83', '0ec07929-833b-4ccf-ae82-c2dfc9d5a349', 'IN', 1, '1-ci doza', '1st dose', 270, '9-12 aylıq', '9-12 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('3dfcbf23-634f-40f3-aae6-233af94b595d', '0ec07929-833b-4ccf-ae82-c2dfc9d5a349', 'IN', 2, '2-ci doza', '2nd dose', 480, '16-24 aylıq', '16-24 months', 11);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('d5a2faad-5491-4387-a6b4-fa809005a48e', 'IN', 'JE', 'Yapon ensefaliti', 'Japanese Encephalitis', 'Yapon ensefaliti', 'Japanese Encephalitis', 'Dərialtı', 'Subcutaneous', '#14B8A6', true, 19);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('85b3ac91-6395-4412-af3f-f89a23825e81', 'd5a2faad-5491-4387-a6b4-fa809005a48e', 'IN', 1, '1-ci doza', '1st dose', 270, '9-12 aylıq', '9-12 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('ce626ba9-7103-4e4c-a0ba-56e1d3e2487e', 'd5a2faad-5491-4387-a6b4-fa809005a48e', 'IN', 2, '2-ci doza', '2nd dose', 480, '16-24 aylıq', '16-24 months', 11);
INSERT INTO public.vaccine_countries (id, code, name_az, name_en, flag_emoji, source_url, source_label, sort_order)
VALUES ('a5b158de-2a96-4d5b-809c-7f3730bd6969', 'CN', 'Çin', 'China', '🇨🇳', 'http://www.nhc.gov.cn/', 'National Health Commission', 27);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('3a3ca51d-6b38-417e-8b10-8c3c658056c7', 'CN', 'BCG', 'Vərəm (BCG)', 'Tuberculosis (BCG)', 'Vərəm', 'Tuberculosis', 'Dəridaxili', 'Intradermal', '#10B981', true, 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('191d2104-121a-4e33-b17c-591060d5cd5b', '3a3ca51d-6b38-417e-8b10-8c3c658056c7', 'CN', 1, '1-ci doza', '1st dose', 0, 'Doğulanda', 'At birth', 10);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('777b0d85-29b8-400a-8070-968846e93c95', 'CN', 'HepB', 'Hepatit B', 'Hepatitis B', 'Hepatit B virusu', 'Hepatitis B virus', 'Əzələdaxili', 'Intramuscular', '#3B82F6', true, 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('2b305069-9144-4908-a6c5-889df76b5e46', '777b0d85-29b8-400a-8070-968846e93c95', 'CN', 1, '1-ci doza', '1st dose', 0, 'Doğulanda', 'At birth', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('4c6f1bc8-0d3c-42cc-92c4-2dbc7e9811be', '777b0d85-29b8-400a-8070-968846e93c95', 'CN', 2, '2-ci doza', '2nd dose', 30, '1 aylıq', '1 month', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('2f1ae197-199b-4930-9ff2-bc2e201ae827', '777b0d85-29b8-400a-8070-968846e93c95', 'CN', 3, '3-ci doza', '3rd dose', 180, '6 aylıq', '6 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('af8efa92-fc3e-4cd7-85e2-2ebcc636a604', 'CN', 'IPV', 'Poliomielit (IPV)', 'Polio (IPV)', 'Poliomielit', 'Poliomyelitis', 'Əzələdaxili', 'Intramuscular', '#F59E0B', true, 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('1ce6eff1-7bb2-4819-b898-c260e75b17c7', 'af8efa92-fc3e-4cd7-85e2-2ebcc636a604', 'CN', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('ec17cea4-fecf-4f82-afa0-5581d12fd323', 'af8efa92-fc3e-4cd7-85e2-2ebcc636a604', 'CN', 2, '2-ci doza', '2nd dose', 90, '3 aylıq', '3 months', 11);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('1217ed97-8ad7-4e28-ac7d-40f14e5469f3', 'CN', 'OPV', 'Poliomielit (OPV)', 'Polio (OPV)', 'Poliomielit', 'Poliomyelitis', 'Ağızdan (damcı)', 'Oral (drops)', '#F59E0B', true, 13);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('c60a07a0-16e3-4b59-91cf-6dd283451625', '1217ed97-8ad7-4e28-ac7d-40f14e5469f3', 'CN', 1, '1-ci doza', '1st dose', 120, '4 aylıq', '4 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('b779f5b1-af62-44e3-a4f6-6a9845cfa2b8', '1217ed97-8ad7-4e28-ac7d-40f14e5469f3', 'CN', 2, '2-ci doza', '2nd dose', 1460, '4 yaş', '4 years', 11);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('d1c81e05-9a95-4f34-8173-db630e9f2c1b', 'CN', 'DTaP', 'Göy öskürək, difteriya, tetanoz', 'Diphtheria, Tetanus, Pertussis', 'Göy öskürək, difteriya, tetanoz', 'Diphtheria, Tetanus, Pertussis', 'Əzələdaxili', 'Intramuscular', '#EF4444', true, 14);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('da3edf6e-a2eb-4ec3-95c3-3ebd107114cf', 'd1c81e05-9a95-4f34-8173-db630e9f2c1b', 'CN', 1, '1-ci doza', '1st dose', 90, '3 aylıq', '3 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('e40ec782-7cb2-45d5-9881-cd7d784fad29', 'd1c81e05-9a95-4f34-8173-db630e9f2c1b', 'CN', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('25f10cbe-00cf-4f2b-a345-238df7994190', 'd1c81e05-9a95-4f34-8173-db630e9f2c1b', 'CN', 3, '3-ci doza', '3rd dose', 150, '5 aylıq', '5 months', 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('064d4767-c02e-4cb5-bafa-be407a3aaf65', 'd1c81e05-9a95-4f34-8173-db630e9f2c1b', 'CN', 4, '4-ci doza', '4th dose', 540, '18 aylıq', '18 months', 13);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('dbb5f1f5-54e7-4e14-b76a-c228c269379b', 'CN', 'MMR', 'Qızılca, parotit, məxmərək', 'Measles, Mumps, Rubella', 'Qızılca, parotit, məxmərək', 'Measles, Mumps, Rubella', 'Dərialtı', 'Subcutaneous', '#F43F5E', true, 15);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('c0491c99-952c-4f38-a96d-34f3c35be3a1', 'dbb5f1f5-54e7-4e14-b76a-c228c269379b', 'CN', 1, '1-ci doza', '1st dose', 240, '8 aylıq', '8 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('b3576905-4879-46d0-b598-b394588e3f72', 'dbb5f1f5-54e7-4e14-b76a-c228c269379b', 'CN', 2, '2-ci doza', '2nd dose', 540, '18 aylıq', '18 months', 11);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('b591af5c-3241-47ed-84c3-73f465c2415e', 'CN', 'JE', 'Yapon ensefaliti', 'Japanese Encephalitis', 'Yapon ensefaliti', 'Japanese Encephalitis', 'Dərialtı', 'Subcutaneous', '#14B8A6', true, 16);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('f2c112c1-e831-40bf-8794-b831167a71d3', 'b591af5c-3241-47ed-84c3-73f465c2415e', 'CN', 1, '1-ci doza', '1st dose', 240, '8 aylıq', '8 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('fb713bc8-e428-42ea-ab28-c790a6b8b340', 'b591af5c-3241-47ed-84c3-73f465c2415e', 'CN', 2, '2-ci doza', '2nd dose', 730, '2 yaş', '2 years', 11);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('855258f8-05d1-4295-b4d7-61e172ae3703', 'CN', 'MenACWY', 'Meningokokk', 'Meningococcal', 'Meningokokk xəstəliyi', 'Meningococcal disease', 'Əzələdaxili', 'Intramuscular', '#F59E0B', true, 17);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('31b0391a-55f9-4be3-8dd3-e490dfa2ea8f', '855258f8-05d1-4295-b4d7-61e172ae3703', 'CN', 1, '1-ci doza', '1st dose', 180, '6 aylıq', '6 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('a6cb3371-9a61-4127-859f-8e4479c39da2', '855258f8-05d1-4295-b4d7-61e172ae3703', 'CN', 2, '2-ci doza', '2nd dose', 270, '9 aylıq', '9 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('6c7ca354-39af-4634-b8b2-587f42199d80', '855258f8-05d1-4295-b4d7-61e172ae3703', 'CN', 3, '3-ci doza', '3rd dose', 1095, '3 yaş', '3 years', 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('bd025e7c-6fc2-49dd-ad96-e6a06406033f', '855258f8-05d1-4295-b4d7-61e172ae3703', 'CN', 4, '4-ci doza', '4th dose', 2190, '6 yaş', '6 years', 13);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('8e2fb767-6fe7-4d49-931f-06f8ba4d28f1', 'CN', 'HepA', 'Hepatit A', 'Hepatitis A', 'Hepatit A virusu', 'Hepatitis A virus', 'Əzələdaxili', 'Intramuscular', '#3B82F6', true, 18);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('6a185c59-63fa-4d57-abcc-b67533048d78', '8e2fb767-6fe7-4d49-931f-06f8ba4d28f1', 'CN', 1, '1-ci doza', '1st dose', 540, '18 aylıq', '18 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('3b245738-1bde-49f0-ade7-d8dc65b8a84c', '8e2fb767-6fe7-4d49-931f-06f8ba4d28f1', 'CN', 2, '2-ci doza', '2nd dose', 730, '24 aylıq', '24 months', 11);
INSERT INTO public.vaccine_countries (id, code, name_az, name_en, flag_emoji, source_url, source_label, sort_order)
VALUES ('5e53858b-8f33-4846-b45f-bf9410acb9d2', 'JP', 'Yaponiya', 'Japan', '🇯🇵', 'https://www.mhlw.go.jp/', 'Ministry of Health, Labour and Welfare', 28);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('a4be7f62-928e-464e-b0b2-0c8f808af0ca', 'JP', 'BCG', 'Vərəm (BCG)', 'Tuberculosis (BCG)', 'Vərəm', 'Tuberculosis', 'Dəridaxili', 'Intradermal', '#10B981', true, 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('9610a0b3-61cb-443a-ba45-4872b1b2ddec', 'a4be7f62-928e-464e-b0b2-0c8f808af0ca', 'JP', 1, '1-ci doza', '1st dose', 150, '5 aylıq', '5 months', 10);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('3eed1e5c-5c20-41f2-931f-09a9161bb081', 'JP', 'HepB', 'Hepatit B', 'Hepatitis B', 'Hepatit B virusu', 'Hepatitis B virus', 'Əzələdaxili', 'Intramuscular', '#3B82F6', true, 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('0ea7f2af-d2d3-44ed-bdb6-890c45f94a1f', '3eed1e5c-5c20-41f2-931f-09a9161bb081', 'JP', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('6bb3c026-51f6-4cdd-a624-0e8ff725003f', '3eed1e5c-5c20-41f2-931f-09a9161bb081', 'JP', 2, '2-ci doza', '2nd dose', 90, '3 aylıq', '3 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('5b09461c-bf6c-4fa5-9a1d-aebe8fa9d845', '3eed1e5c-5c20-41f2-931f-09a9161bb081', 'JP', 3, '3-ci doza', '3rd dose', 210, '7-8 aylıq', '7-8 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('c9790b51-b1ef-4e72-9b20-0741cc01bfe8', 'JP', 'RV', 'Rotavirus', 'Rotavirus', 'Rotavirus ishalı', 'Rotavirus diarrhea', 'Ağızdan', 'Oral', '#14B8A6', true, 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('dc9ebed0-cd1c-461b-82b2-7c25aa3a598e', 'c9790b51-b1ef-4e72-9b20-0741cc01bfe8', 'JP', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('ea3bf367-2c9a-404d-89f2-ca6dbfa08250', 'c9790b51-b1ef-4e72-9b20-0741cc01bfe8', 'JP', 2, '2-ci doza', '2nd dose', 90, '3 aylıq', '3 months', 11);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('26f86164-96f1-4deb-bae6-2addf51720bc', 'JP', 'HiB', 'Hib infeksiyası', 'Haemophilus influenzae type b', 'Meningit, pnevmoniya', 'Meningitis, pneumonia', 'Əzələdaxili', 'Intramuscular', '#8B5CF6', true, 13);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('6b67b0eb-1bfc-40cb-af61-e9c78ee55aeb', '26f86164-96f1-4deb-bae6-2addf51720bc', 'JP', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('80236a53-8045-4ff2-b04e-3077da729f1c', '26f86164-96f1-4deb-bae6-2addf51720bc', 'JP', 2, '2-ci doza', '2nd dose', 90, '3 aylıq', '3 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('bfeec2bf-56fa-4513-b4ce-872ae11d8c6e', '26f86164-96f1-4deb-bae6-2addf51720bc', 'JP', 3, '3-ci doza', '3rd dose', 120, '4 aylıq', '4 months', 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('e787bdc4-4d27-43fd-83ea-976ee6fa45dc', '26f86164-96f1-4deb-bae6-2addf51720bc', 'JP', 4, '4-ci doza', '4th dose', 365, '12 aylıq', '12 months', 13);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('b8d93044-4ceb-4e04-9916-f50d6c038872', 'JP', 'PCV', 'Pnevmokokk', 'Pneumococcal', 'Pnevmoniya, meningit', 'Pneumonia, meningitis', 'Əzələdaxili', 'Intramuscular', '#EC4899', true, 14);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('2d1be7d6-9a21-4dba-934c-f0f85127198c', 'b8d93044-4ceb-4e04-9916-f50d6c038872', 'JP', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('fd1eb13e-2cd1-4e7f-a28e-7261b1b4a3f5', 'b8d93044-4ceb-4e04-9916-f50d6c038872', 'JP', 2, '2-ci doza', '2nd dose', 90, '3 aylıq', '3 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('60302886-2387-42ff-bf95-2c1a66208a8b', 'b8d93044-4ceb-4e04-9916-f50d6c038872', 'JP', 3, '3-ci doza', '3rd dose', 120, '4 aylıq', '4 months', 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('12f4ff47-e622-4bf2-9dfa-a81e9ad5f04c', 'b8d93044-4ceb-4e04-9916-f50d6c038872', 'JP', 4, '4-ci doza', '4th dose', 365, '12 aylıq', '12 months', 13);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('2f14ed20-1151-42d0-99e2-0fceb5da492a', 'JP', 'DTaP', 'Göy öskürək, difteriya, tetanoz', 'Diphtheria, Tetanus, Pertussis', 'Göy öskürək, difteriya, tetanoz', 'Diphtheria, Tetanus, Pertussis', 'Əzələdaxili', 'Intramuscular', '#EF4444', true, 15);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('dc7402be-21f2-4e98-8380-fd20a7c1788a', '2f14ed20-1151-42d0-99e2-0fceb5da492a', 'JP', 1, '1-ci doza', '1st dose', 90, '3 aylıq', '3 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('df3fe9dc-5392-4ef5-b24b-93a22c55bad6', '2f14ed20-1151-42d0-99e2-0fceb5da492a', 'JP', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('cbbdf906-1fbe-4160-89ee-00c082a70c72', '2f14ed20-1151-42d0-99e2-0fceb5da492a', 'JP', 3, '3-ci doza', '3rd dose', 150, '5 aylıq', '5 months', 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('6c409fe7-6464-4ed5-b7e2-35f0c83665a9', '2f14ed20-1151-42d0-99e2-0fceb5da492a', 'JP', 4, '4-ci doza', '4th dose', 540, '18 aylıq', '18 months', 13);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('17422090-86ea-418e-ac12-71bf66f0eddd', 'JP', 'IPV', 'Poliomielit (IPV)', 'Polio (IPV)', 'Poliomielit', 'Poliomyelitis', 'Əzələdaxili', 'Intramuscular', '#F59E0B', true, 16);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('4c10b66d-f473-48fd-9a24-f96214430d56', '17422090-86ea-418e-ac12-71bf66f0eddd', 'JP', 1, '1-ci doza', '1st dose', 90, '3 aylıq', '3 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('7c2cd388-e809-49c1-a271-fb0d3581728e', '17422090-86ea-418e-ac12-71bf66f0eddd', 'JP', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('db35fe09-adb9-40a5-9468-8e2600f3aa42', '17422090-86ea-418e-ac12-71bf66f0eddd', 'JP', 3, '3-ci doza', '3rd dose', 150, '5 aylıq', '5 months', 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('63c92155-c754-491e-849a-b08fdcb4da3f', '17422090-86ea-418e-ac12-71bf66f0eddd', 'JP', 4, '4-ci doza', '4th dose', 540, '18 aylıq', '18 months', 13);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('bdead4bc-cb1a-4b39-87b2-4fe81cbe8b6b', 'JP', 'MMR', 'Qızılca, parotit, məxmərək', 'Measles, Mumps, Rubella', 'Qızılca, parotit, məxmərək', 'Measles, Mumps, Rubella', 'Dərialtı', 'Subcutaneous', '#F43F5E', true, 17);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('15bfee16-1caf-4e78-b873-21ed26a1469d', 'bdead4bc-cb1a-4b39-87b2-4fe81cbe8b6b', 'JP', 1, '1-ci doza', '1st dose', 365, '1 yaş', '1 year', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('2d811fd9-7094-4eca-8557-b5b1dd81ad6e', 'bdead4bc-cb1a-4b39-87b2-4fe81cbe8b6b', 'JP', 2, '2-ci doza', '2nd dose', 1825, '5-6 yaş', '5-6 years', 11);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('91fab9ae-9b5f-425a-b141-2e0cd6135482', 'JP', 'VAR', 'Su çiçəyi', 'Varicella (Chickenpox)', 'Su çiçəyi', 'Chickenpox', 'Dərialtı', 'Subcutaneous', '#6366F1', true, 18);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('7a67aa97-1554-4e44-9253-8f5e79017bd7', '91fab9ae-9b5f-425a-b141-2e0cd6135482', 'JP', 1, '1-ci doza', '1st dose', 365, '1 yaş', '1 year', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('a1686b06-6dbf-441e-945e-b50f47d4a43e', '91fab9ae-9b5f-425a-b141-2e0cd6135482', 'JP', 2, '2-ci doza', '2nd dose', 730, '2 yaş', '2 years', 11);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('466f1381-76c8-44b9-838f-ff9c37716aa2', 'JP', 'JE', 'Yapon ensefaliti', 'Japanese Encephalitis', 'Yapon ensefaliti', 'Japanese Encephalitis', 'Dərialtı', 'Subcutaneous', '#14B8A6', true, 19);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('e50f27a5-1a3a-4add-9f6c-062cd39b0914', '466f1381-76c8-44b9-838f-ff9c37716aa2', 'JP', 1, '1-ci doza', '1st dose', 1095, '3 yaş', '3 years', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('cf78b811-47a5-4fdb-850d-e9ea3f8dabc6', '466f1381-76c8-44b9-838f-ff9c37716aa2', 'JP', 2, '2-ci doza', '2nd dose', 1125, '3 yaş', '3 years', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('ffd88807-3c24-4fdd-a40b-24e117bcaef8', '466f1381-76c8-44b9-838f-ff9c37716aa2', 'JP', 3, '3-ci doza', '3rd dose', 1460, '4 yaş', '4 years', 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('b2113938-8441-4d44-a351-bad286db31ff', '466f1381-76c8-44b9-838f-ff9c37716aa2', 'JP', 4, '4-ci doza', '4th dose', 3285, '9 yaş', '9 years', 13);
INSERT INTO public.vaccine_countries (id, code, name_az, name_en, flag_emoji, source_url, source_label, sort_order)
VALUES ('2cdd3707-feca-4559-b684-91ce773812bf', 'KR', 'Cənubi Koreya', 'South Korea', '🇰🇷', 'https://nip.kdca.go.kr/', 'KDCA', 29);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('10b64ece-19e6-4957-92fd-fa6f11b80de4', 'KR', 'BCG', 'Vərəm (BCG)', 'Tuberculosis (BCG)', 'Vərəm', 'Tuberculosis', 'Dəridaxili', 'Intradermal', '#10B981', true, 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('9ba58aa3-ef2a-4c64-a338-42dee95aae2d', '10b64ece-19e6-4957-92fd-fa6f11b80de4', 'KR', 1, '1-ci doza', '1st dose', 0, 'Doğulanda (0-4 həftə)', '0-4 weeks', 10);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('76af3255-1ef7-4465-bff1-0846c0921b4e', 'KR', 'HepB', 'Hepatit B', 'Hepatitis B', 'Hepatit B virusu', 'Hepatitis B virus', 'Əzələdaxili', 'Intramuscular', '#3B82F6', true, 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('025509a6-b344-4ae2-af2b-252f1b83c3e4', '76af3255-1ef7-4465-bff1-0846c0921b4e', 'KR', 1, '1-ci doza', '1st dose', 0, 'Doğulanda', 'At birth', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('b818a67a-836d-445a-aa57-53dc26fbbbe8', '76af3255-1ef7-4465-bff1-0846c0921b4e', 'KR', 2, '2-ci doza', '2nd dose', 30, '1 aylıq', '1 month', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('5b148c56-3fba-45fc-aa58-2fb3b1eede4d', '76af3255-1ef7-4465-bff1-0846c0921b4e', 'KR', 3, '3-ci doza', '3rd dose', 180, '6 aylıq', '6 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('ef5e4012-fe95-4f10-8c67-05dbd87329ea', 'KR', 'DTaP', 'Göy öskürək, difteriya, tetanoz', 'Diphtheria, Tetanus, Pertussis', 'Göy öskürək, difteriya, tetanoz', 'Diphtheria, Tetanus, Pertussis', 'Əzələdaxili', 'Intramuscular', '#EF4444', true, 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('b17cf8b4-2d85-43be-9cd6-0efecc9ec9bf', 'ef5e4012-fe95-4f10-8c67-05dbd87329ea', 'KR', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('c9e82f4a-cd4d-4916-9da5-ced3c181ec78', 'ef5e4012-fe95-4f10-8c67-05dbd87329ea', 'KR', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('56196bb2-5734-46b0-a5e9-baafb4f30b60', 'ef5e4012-fe95-4f10-8c67-05dbd87329ea', 'KR', 3, '3-ci doza', '3rd dose', 180, '6 aylıq', '6 months', 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('b51d181d-5414-46a4-9e60-3509ea1efa7b', 'ef5e4012-fe95-4f10-8c67-05dbd87329ea', 'KR', 4, '4-ci doza', '4th dose', 450, '15-18 aylıq', '15-18 months', 13);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('9dc8ca4b-d6fb-4241-9e5c-cfaa2ae670ad', 'KR', 'IPV', 'Poliomielit (IPV)', 'Polio (IPV)', 'Poliomielit', 'Poliomyelitis', 'Əzələdaxili', 'Intramuscular', '#F59E0B', true, 13);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('d5a16fb4-fa4b-430f-b846-4009ef2c00f6', '9dc8ca4b-d6fb-4241-9e5c-cfaa2ae670ad', 'KR', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('f01561f8-8391-4506-b4e8-6bd85e32ad36', '9dc8ca4b-d6fb-4241-9e5c-cfaa2ae670ad', 'KR', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('5ce9604b-2f8e-40ca-a73a-a5b0568c1200', '9dc8ca4b-d6fb-4241-9e5c-cfaa2ae670ad', 'KR', 3, '3-ci doza', '3rd dose', 180, '6 aylıq', '6 months', 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('32c9511d-3ae6-4083-ba31-9d681730a665', '9dc8ca4b-d6fb-4241-9e5c-cfaa2ae670ad', 'KR', 4, '4-ci doza', '4th dose', 1460, '4-6 yaş', '4-6 years', 13);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('c01772af-dbab-42e2-88d7-01456c06a1a5', 'KR', 'HiB', 'Hib infeksiyası', 'Haemophilus influenzae type b', 'Meningit, pnevmoniya', 'Meningitis, pneumonia', 'Əzələdaxili', 'Intramuscular', '#8B5CF6', true, 14);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('9fcde89c-cc54-4029-a4aa-590039f657a1', 'c01772af-dbab-42e2-88d7-01456c06a1a5', 'KR', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('10f62a09-c548-42a4-b14b-7b80856566a6', 'c01772af-dbab-42e2-88d7-01456c06a1a5', 'KR', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('269b1531-4425-447a-a9da-e90ca4df1e2e', 'c01772af-dbab-42e2-88d7-01456c06a1a5', 'KR', 3, '3-ci doza', '3rd dose', 180, '6 aylıq', '6 months', 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('ac5f8f5d-fa3e-4ba0-b777-b5348f13797d', 'c01772af-dbab-42e2-88d7-01456c06a1a5', 'KR', 4, '4-ci doza', '4th dose', 365, '12-15 aylıq', '12-15 months', 13);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('f4ae2435-c46b-4ed3-bfa4-5c04ca99671e', 'KR', 'PCV', 'Pnevmokokk', 'Pneumococcal', 'Pnevmoniya, meningit', 'Pneumonia, meningitis', 'Əzələdaxili', 'Intramuscular', '#EC4899', true, 15);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('a3700e39-9e02-4918-9b43-2e82e29a1829', 'f4ae2435-c46b-4ed3-bfa4-5c04ca99671e', 'KR', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('3d1bdd6a-d3ea-441f-946a-039e9cba8de0', 'f4ae2435-c46b-4ed3-bfa4-5c04ca99671e', 'KR', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('e7bb7ad4-6e13-4920-b241-c70d07108f3a', 'f4ae2435-c46b-4ed3-bfa4-5c04ca99671e', 'KR', 3, '3-ci doza', '3rd dose', 180, '6 aylıq', '6 months', 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('ae656f39-c56d-4793-9517-a48077edcca1', 'f4ae2435-c46b-4ed3-bfa4-5c04ca99671e', 'KR', 4, '4-ci doza', '4th dose', 365, '12-15 aylıq', '12-15 months', 13);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('d8caa1f5-5edf-4301-8c0c-7606f86eeb9b', 'KR', 'MMR', 'Qızılca, parotit, məxmərək', 'Measles, Mumps, Rubella', 'Qızılca, parotit, məxmərək', 'Measles, Mumps, Rubella', 'Dərialtı', 'Subcutaneous', '#F43F5E', true, 16);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('aa261f3c-af60-405f-bc27-c93114b34590', 'd8caa1f5-5edf-4301-8c0c-7606f86eeb9b', 'KR', 1, '1-ci doza', '1st dose', 365, '12-15 aylıq', '12-15 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('74d38c4e-8c6d-4a14-b764-e13dd130b175', 'd8caa1f5-5edf-4301-8c0c-7606f86eeb9b', 'KR', 2, '2-ci doza', '2nd dose', 1460, '4-6 yaş', '4-6 years', 11);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('b0fd0cf7-23dd-4f76-b75e-38632989cbc4', 'KR', 'VAR', 'Su çiçəyi', 'Varicella (Chickenpox)', 'Su çiçəyi', 'Chickenpox', 'Dərialtı', 'Subcutaneous', '#6366F1', true, 17);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('36e9029c-c12e-4938-9598-8e40900d6364', 'b0fd0cf7-23dd-4f76-b75e-38632989cbc4', 'KR', 1, '1-ci doza', '1st dose', 365, '12-15 aylıq', '12-15 months', 10);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('ac13d967-9d1e-4d25-9b4d-2d409b5f0539', 'KR', 'JE', 'Yapon ensefaliti', 'Japanese Encephalitis', 'Yapon ensefaliti', 'Japanese Encephalitis', 'Dərialtı', 'Subcutaneous', '#14B8A6', true, 18);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('2f3fc82d-7875-4b69-975d-a5fab244751d', 'ac13d967-9d1e-4d25-9b4d-2d409b5f0539', 'KR', 1, '1-ci doza', '1st dose', 365, '12-23 aylıq', '12-23 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('5dd8bb15-2fa1-4cdb-8022-48185ecbbecf', 'ac13d967-9d1e-4d25-9b4d-2d409b5f0539', 'KR', 2, '2-ci doza', '2nd dose', 395, '13-24 aylıq', '13-24 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('14184dfb-1a0b-4547-b1a6-ecefb7780e7a', 'ac13d967-9d1e-4d25-9b4d-2d409b5f0539', 'KR', 3, '3-ci doza', '3rd dose', 730, '2 yaş', '2 years', 12);
INSERT INTO public.vaccine_countries (id, code, name_az, name_en, flag_emoji, source_url, source_label, sort_order)
VALUES ('2364bc68-92cc-4e50-9b5c-d4b33b386cf3', 'BR', 'Braziliya', 'Brazil', '🇧🇷', 'https://www.gov.br/saude/', 'Ministério da Saúde', 30);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('4ee8a9f3-5e52-438c-a8aa-c24f82ec0e29', 'BR', 'BCG', 'Vərəm (BCG)', 'Tuberculosis (BCG)', 'Vərəm', 'Tuberculosis', 'Dəridaxili', 'Intradermal', '#10B981', true, 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('aa7f73a5-c4a7-4bb9-8fc9-e845362da518', '4ee8a9f3-5e52-438c-a8aa-c24f82ec0e29', 'BR', 1, '1-ci doza', '1st dose', 0, 'Doğulanda', 'At birth', 10);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('98f9e826-e447-4828-9b05-0e81fe272c52', 'BR', 'HepB', 'Hepatit B', 'Hepatitis B', 'Hepatit B virusu', 'Hepatitis B virus', 'Əzələdaxili', 'Intramuscular', '#3B82F6', true, 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('90fab832-6b9c-4efb-9157-ade07eadc715', '98f9e826-e447-4828-9b05-0e81fe272c52', 'BR', 1, '1-ci doza', '1st dose', 0, 'Doğulanda', 'At birth', 10);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('dc7115b2-ae8a-4372-ab35-3600cf0a53df', 'BR', 'DTaP', 'Göy öskürək, difteriya, tetanoz', 'Diphtheria, Tetanus, Pertussis', 'Göy öskürək, difteriya, tetanoz', 'Diphtheria, Tetanus, Pertussis', 'Əzələdaxili', 'Intramuscular', '#EF4444', true, 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('1e2ff679-b59d-4a3e-91c3-06e3a52dc0da', 'dc7115b2-ae8a-4372-ab35-3600cf0a53df', 'BR', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('846b8061-b989-4978-b1f9-3d3a6b916361', 'dc7115b2-ae8a-4372-ab35-3600cf0a53df', 'BR', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('908ffe46-65ca-42a3-a48f-ff1530d2f7a3', 'dc7115b2-ae8a-4372-ab35-3600cf0a53df', 'BR', 3, '3-ci doza', '3rd dose', 180, '6 aylıq', '6 months', 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('bec032c3-81b2-492a-92f0-20e85760526f', 'dc7115b2-ae8a-4372-ab35-3600cf0a53df', 'BR', 4, '4-ci doza', '4th dose', 450, '15 aylıq', '15 months', 13);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('b14e237f-3eee-4329-bfd4-014dcec20a4c', 'BR', 'HiB', 'Hib infeksiyası', 'Haemophilus influenzae type b', 'Meningit, pnevmoniya', 'Meningitis, pneumonia', 'Əzələdaxili', 'Intramuscular', '#8B5CF6', true, 13);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('f331fc2d-f2ab-4af9-9ce9-4b1878748b78', 'b14e237f-3eee-4329-bfd4-014dcec20a4c', 'BR', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('f2cd1d07-5024-468e-a149-386d19b069db', 'b14e237f-3eee-4329-bfd4-014dcec20a4c', 'BR', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('ce226521-2f24-45c5-9254-ffe77f72bd43', 'b14e237f-3eee-4329-bfd4-014dcec20a4c', 'BR', 3, '3-ci doza', '3rd dose', 180, '6 aylıq', '6 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('93d3d2c5-b2d9-45c3-bbf1-68365bf51ea9', 'BR', 'IPV', 'Poliomielit (IPV)', 'Polio (IPV)', 'Poliomielit', 'Poliomyelitis', 'Əzələdaxili', 'Intramuscular', '#F59E0B', true, 14);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('ee844271-9cf7-489d-bacb-20a082f37d7a', '93d3d2c5-b2d9-45c3-bbf1-68365bf51ea9', 'BR', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('40dfbce2-1383-4957-a32c-cf9b241a7ee8', '93d3d2c5-b2d9-45c3-bbf1-68365bf51ea9', 'BR', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('317595ee-5701-4e3c-8b27-85490395710d', '93d3d2c5-b2d9-45c3-bbf1-68365bf51ea9', 'BR', 3, '3-ci doza', '3rd dose', 180, '6 aylıq', '6 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('92fc292e-e200-43c7-b72b-f72efcfb81c1', 'BR', 'OPV', 'Poliomielit (OPV)', 'Polio (OPV)', 'Poliomielit', 'Poliomyelitis', 'Ağızdan (damcı)', 'Oral (drops)', '#F59E0B', true, 15);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('9f6554c7-f6ea-4a8c-a7cf-03bb72eb71e0', '92fc292e-e200-43c7-b72b-f72efcfb81c1', 'BR', 1, '1-ci doza', '1st dose', 450, '15 aylıq', '15 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('aa0c0227-a214-4b17-893f-a5d784b66aa8', '92fc292e-e200-43c7-b72b-f72efcfb81c1', 'BR', 2, '2-ci doza', '2nd dose', 1460, '4 yaş', '4 years', 11);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('ebc8bfa9-304c-40ce-8ff2-a06f0a6cecd6', 'BR', 'RV', 'Rotavirus', 'Rotavirus', 'Rotavirus ishalı', 'Rotavirus diarrhea', 'Ağızdan', 'Oral', '#14B8A6', true, 16);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('3a6e44a5-f749-41ba-9e13-55884bdb1cb3', 'ebc8bfa9-304c-40ce-8ff2-a06f0a6cecd6', 'BR', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('bab31eb9-c25d-48ff-b346-d55117d5e96c', 'ebc8bfa9-304c-40ce-8ff2-a06f0a6cecd6', 'BR', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('83d23e2a-a066-4f91-9cca-4022250a1d9c', 'BR', 'PCV', 'Pnevmokokk', 'Pneumococcal', 'Pnevmoniya, meningit', 'Pneumonia, meningitis', 'Əzələdaxili', 'Intramuscular', '#EC4899', true, 17);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('d05a2e4c-713d-48f2-bd37-f3441d25b4ea', '83d23e2a-a066-4f91-9cca-4022250a1d9c', 'BR', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('c457b809-1896-41a9-bb8f-d110c176bb25', '83d23e2a-a066-4f91-9cca-4022250a1d9c', 'BR', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('87a7f9cb-54cb-44fd-be86-0c394ab942d6', '83d23e2a-a066-4f91-9cca-4022250a1d9c', 'BR', 3, '3-ci doza', '3rd dose', 365, '12 aylıq', '12 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('98fb29e0-0bf8-490c-9e17-deff70d5aa18', 'BR', 'MenACWY', 'Meningokokk', 'Meningococcal', 'Meningokokk xəstəliyi', 'Meningococcal disease', 'Əzələdaxili', 'Intramuscular', '#F59E0B', true, 18);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('b82cc128-2ecf-4bfe-9700-2471073c4e75', '98fb29e0-0bf8-490c-9e17-deff70d5aa18', 'BR', 1, '1-ci doza', '1st dose', 90, '3 aylıq', '3 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('dc16b2e3-f1ab-4b9d-b0c2-cc48367dae47', '98fb29e0-0bf8-490c-9e17-deff70d5aa18', 'BR', 2, '2-ci doza', '2nd dose', 150, '5 aylıq', '5 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('5567c567-2255-4825-a796-30b253833736', '98fb29e0-0bf8-490c-9e17-deff70d5aa18', 'BR', 3, '3-ci doza', '3rd dose', 365, '12 aylıq', '12 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('ae4aab16-b0f9-41eb-bff1-b39768e17e5a', 'BR', 'YF', 'Sarı qızdırma', 'Yellow Fever', 'Sarı qızdırma', 'Yellow Fever', 'Dərialtı', 'Subcutaneous', '#EAB308', true, 19);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('fc6a4ab1-f338-420a-84a2-c0f6dba7fd85', 'ae4aab16-b0f9-41eb-bff1-b39768e17e5a', 'BR', 1, '1-ci doza', '1st dose', 270, '9 aylıq', '9 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('bfee8a45-8813-4bce-a31b-23134eccaa56', 'ae4aab16-b0f9-41eb-bff1-b39768e17e5a', 'BR', 2, '2-ci doza', '2nd dose', 1460, '4 yaş', '4 years', 11);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('31bc15fe-cd99-4a49-aacd-09d7544ddf5d', 'BR', 'MMR', 'Qızılca, parotit, məxmərək', 'Measles, Mumps, Rubella', 'Qızılca, parotit, məxmərək', 'Measles, Mumps, Rubella', 'Dərialtı', 'Subcutaneous', '#F43F5E', true, 20);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('4be6a2ab-11c3-4717-b3d9-e2a1b5a50b97', '31bc15fe-cd99-4a49-aacd-09d7544ddf5d', 'BR', 1, '1-ci doza', '1st dose', 365, '12 aylıq', '12 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('e98607a0-a577-4579-aca9-86642a2aaeac', '31bc15fe-cd99-4a49-aacd-09d7544ddf5d', 'BR', 2, '2-ci doza', '2nd dose', 450, '15 aylıq', '15 months', 11);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('b6fccfd3-dd4d-4918-b8c9-714f2b14c269', 'BR', 'VAR', 'Su çiçəyi', 'Varicella (Chickenpox)', 'Su çiçəyi', 'Chickenpox', 'Dərialtı', 'Subcutaneous', '#6366F1', true, 21);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('46dc9e25-7cca-474b-b028-1390aaffd0ba', 'b6fccfd3-dd4d-4918-b8c9-714f2b14c269', 'BR', 1, '1-ci doza', '1st dose', 450, '15 aylıq', '15 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('00217f1e-a9d6-40f1-a8e8-f230306a25ef', 'b6fccfd3-dd4d-4918-b8c9-714f2b14c269', 'BR', 2, '2-ci doza', '2nd dose', 1460, '4 yaş', '4 years', 11);
INSERT INTO public.vaccine_countries (id, code, name_az, name_en, flag_emoji, source_url, source_label, sort_order)
VALUES ('783d7b9b-fb77-41d4-a4d3-7de34a82f2af', 'PL', 'Polşa', 'Poland', '🇵🇱', 'https://szczepienia.pzh.gov.pl/', 'NIZP PZH', 31);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('30d2c729-84ed-48b4-9c98-c4ede9a8437e', 'PL', 'BCG', 'Vərəm (BCG)', 'Tuberculosis (BCG)', 'Vərəm', 'Tuberculosis', 'Dəridaxili', 'Intradermal', '#10B981', true, 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('6b2dfffb-a32d-4229-ae80-9ed8d69922fa', '30d2c729-84ed-48b4-9c98-c4ede9a8437e', 'PL', 1, '1-ci doza', '1st dose', 0, 'Doğulanda', 'At birth', 10);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('387f1e3b-6eca-4ee2-9815-3429fb30b034', 'PL', 'HepB', 'Hepatit B', 'Hepatitis B', 'Hepatit B virusu', 'Hepatitis B virus', 'Əzələdaxili', 'Intramuscular', '#3B82F6', true, 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('86cbc34c-2fc6-44b3-a2ad-22f401b35224', '387f1e3b-6eca-4ee2-9815-3429fb30b034', 'PL', 1, '1-ci doza', '1st dose', 0, 'Doğulanda', 'At birth', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('36684bb5-9356-4090-a1ed-2efe1bff3a90', '387f1e3b-6eca-4ee2-9815-3429fb30b034', 'PL', 2, '2-ci doza', '2nd dose', 60, '2 aylıq', '2 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('3112d56c-4f49-4252-a6b1-054a399d750e', '387f1e3b-6eca-4ee2-9815-3429fb30b034', 'PL', 3, '3-ci doza', '3rd dose', 210, '7 aylıq', '7 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('cb63f40a-7afe-424e-809e-3d04cfcb1e4d', 'PL', 'DTaP', 'Göy öskürək, difteriya, tetanoz', 'Diphtheria, Tetanus, Pertussis', 'Göy öskürək, difteriya, tetanoz', 'Diphtheria, Tetanus, Pertussis', 'Əzələdaxili', 'Intramuscular', '#EF4444', true, 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('17a5f3e8-80e5-4921-9605-f4f6508904ff', 'cb63f40a-7afe-424e-809e-3d04cfcb1e4d', 'PL', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('95c1a91b-c8f9-46c3-a9b7-21fab09ac6cc', 'cb63f40a-7afe-424e-809e-3d04cfcb1e4d', 'PL', 2, '2-ci doza', '2nd dose', 90, '3-4 aylıq', '3-4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('6fbcdcb7-f2a8-45f3-87de-664a147adf51', 'cb63f40a-7afe-424e-809e-3d04cfcb1e4d', 'PL', 3, '3-ci doza', '3rd dose', 150, '5-6 aylıq', '5-6 months', 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('0a32fb93-fc55-4f54-ba46-acddabb0e375', 'cb63f40a-7afe-424e-809e-3d04cfcb1e4d', 'PL', 4, '4-ci doza', '4th dose', 480, '16-18 aylıq', '16-18 months', 13);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('6b36e782-6f12-4c9e-a4eb-9cef3947107e', 'PL', 'IPV', 'Poliomielit (IPV)', 'Polio (IPV)', 'Poliomielit', 'Poliomyelitis', 'Əzələdaxili', 'Intramuscular', '#F59E0B', true, 13);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('6dd6d82e-049c-494e-a367-174ebae4356b', '6b36e782-6f12-4c9e-a4eb-9cef3947107e', 'PL', 1, '1-ci doza', '1st dose', 90, '3-4 aylıq', '3-4 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('ad2ffab3-58e7-4d3c-9c18-41735c239faa', '6b36e782-6f12-4c9e-a4eb-9cef3947107e', 'PL', 2, '2-ci doza', '2nd dose', 150, '5-6 aylıq', '5-6 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('70e9160f-d49f-425e-a6fa-ace9e7082412', '6b36e782-6f12-4c9e-a4eb-9cef3947107e', 'PL', 3, '3-ci doza', '3rd dose', 480, '16-18 aylıq', '16-18 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('8147db43-1ef8-4c25-beb3-4274daa3aae1', 'PL', 'HiB', 'Hib infeksiyası', 'Haemophilus influenzae type b', 'Meningit, pnevmoniya', 'Meningitis, pneumonia', 'Əzələdaxili', 'Intramuscular', '#8B5CF6', true, 14);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('c04819d8-a5ab-4eca-9556-e6c6b40350d0', '8147db43-1ef8-4c25-beb3-4274daa3aae1', 'PL', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('57d498dc-1ed1-403a-987c-71532bb077b1', '8147db43-1ef8-4c25-beb3-4274daa3aae1', 'PL', 2, '2-ci doza', '2nd dose', 90, '3-4 aylıq', '3-4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('eb8721ec-4850-4367-8ef4-270dfd5090b6', '8147db43-1ef8-4c25-beb3-4274daa3aae1', 'PL', 3, '3-ci doza', '3rd dose', 150, '5-6 aylıq', '5-6 months', 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('19c773cb-6909-4e24-9489-b3085a30e7b2', '8147db43-1ef8-4c25-beb3-4274daa3aae1', 'PL', 4, '4-ci doza', '4th dose', 480, '16-18 aylıq', '16-18 months', 13);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('5807df6d-2ba0-4cff-9239-9ff30f30aa21', 'PL', 'PCV', 'Pnevmokokk', 'Pneumococcal', 'Pnevmoniya, meningit', 'Pneumonia, meningitis', 'Əzələdaxili', 'Intramuscular', '#EC4899', true, 15);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('99b77c97-9349-42c2-8fcd-8bb93cfd9f47', '5807df6d-2ba0-4cff-9239-9ff30f30aa21', 'PL', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('4be9a87e-13c8-4209-9ec6-cf1fe001d04d', '5807df6d-2ba0-4cff-9239-9ff30f30aa21', 'PL', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('604958f7-2763-4b90-a35b-102606bcf05b', '5807df6d-2ba0-4cff-9239-9ff30f30aa21', 'PL', 3, '3-ci doza', '3rd dose', 395, '13 aylıq', '13 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('046e7f92-3433-4f36-b820-a5f75dbce88d', 'PL', 'RV', 'Rotavirus', 'Rotavirus', 'Rotavirus ishalı', 'Rotavirus diarrhea', 'Ağızdan', 'Oral', '#14B8A6', true, 16);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('0060b4f4-6564-4463-b52a-d967c2ee9b85', '046e7f92-3433-4f36-b820-a5f75dbce88d', 'PL', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('ee28b70f-ab6f-417c-a197-a76d4ebf408c', '046e7f92-3433-4f36-b820-a5f75dbce88d', 'PL', 2, '2-ci doza', '2nd dose', 90, '3-4 aylıq', '3-4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('ed895840-655b-43a0-bd61-c96dca88157e', '046e7f92-3433-4f36-b820-a5f75dbce88d', 'PL', 3, '3-ci doza', '3rd dose', 150, '5-6 aylıq', '5-6 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('d6faa6e1-d702-48cb-a9ed-6f29e59baa4d', 'PL', 'MMR', 'Qızılca, parotit, məxmərək', 'Measles, Mumps, Rubella', 'Qızılca, parotit, məxmərək', 'Measles, Mumps, Rubella', 'Dərialtı', 'Subcutaneous', '#F43F5E', true, 17);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('ae916a1e-9c65-4dca-a25d-aa534b10cbc8', 'd6faa6e1-d702-48cb-a9ed-6f29e59baa4d', 'PL', 1, '1-ci doza', '1st dose', 395, '13-15 aylıq', '13-15 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('6b8e7ab1-dade-4827-b91c-95b3978babc5', 'd6faa6e1-d702-48cb-a9ed-6f29e59baa4d', 'PL', 2, '2-ci doza', '2nd dose', 2190, '6 yaş', '6 years', 11);
INSERT INTO public.vaccine_countries (id, code, name_az, name_en, flag_emoji, source_url, source_label, sort_order)
VALUES ('97223fbc-e730-422c-a300-caeea63e1e7f', 'IL', 'İsrail', 'Israel', '🇮🇱', 'https://www.health.gov.il/', 'Ministry of Health', 32);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('5f2e4b42-09f3-41e8-bad1-a7c08a424dc0', 'IL', 'HepB', 'Hepatit B', 'Hepatitis B', 'Hepatit B virusu', 'Hepatitis B virus', 'Əzələdaxili', 'Intramuscular', '#3B82F6', true, 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('d3b86966-cdf0-4eea-9e6b-30ec02cddb71', '5f2e4b42-09f3-41e8-bad1-a7c08a424dc0', 'IL', 1, '1-ci doza', '1st dose', 0, 'Doğulanda', 'At birth', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('f1aee1fb-95f5-4291-98bc-86ba7656fad2', '5f2e4b42-09f3-41e8-bad1-a7c08a424dc0', 'IL', 2, '2-ci doza', '2nd dose', 30, '1 aylıq', '1 month', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('59f393f2-d324-4ced-b2e7-f43207cad9a3', '5f2e4b42-09f3-41e8-bad1-a7c08a424dc0', 'IL', 3, '3-ci doza', '3rd dose', 180, '6 aylıq', '6 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('3c1383c5-a2b1-4d8c-8c48-15e57208d0de', 'IL', 'DTaP', 'Göy öskürək, difteriya, tetanoz', 'Diphtheria, Tetanus, Pertussis', 'Göy öskürək, difteriya, tetanoz', 'Diphtheria, Tetanus, Pertussis', 'Əzələdaxili', 'Intramuscular', '#EF4444', true, 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('df57fcda-0242-488a-9651-d770d2afcdcb', '3c1383c5-a2b1-4d8c-8c48-15e57208d0de', 'IL', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('28360547-107b-4d74-8c46-cf0e2394fe4e', '3c1383c5-a2b1-4d8c-8c48-15e57208d0de', 'IL', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('dfa76874-076f-4497-9e2e-3fc0ee1c54d8', '3c1383c5-a2b1-4d8c-8c48-15e57208d0de', 'IL', 3, '3-ci doza', '3rd dose', 180, '6 aylıq', '6 months', 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('5e370be4-4f19-475b-9001-f383db8a9adb', '3c1383c5-a2b1-4d8c-8c48-15e57208d0de', 'IL', 4, '4-ci doza', '4th dose', 365, '12 aylıq', '12 months', 13);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('e97fae72-8140-4d15-89ff-cb044e7fb91d', 'IL', 'IPV', 'Poliomielit (IPV)', 'Polio (IPV)', 'Poliomielit', 'Poliomyelitis', 'Əzələdaxili', 'Intramuscular', '#F59E0B', true, 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('e9f51b55-bc55-4d17-9b38-9cd75054251d', 'e97fae72-8140-4d15-89ff-cb044e7fb91d', 'IL', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('81e3d102-7d6c-4df1-b7ff-3bcbaaec7a44', 'e97fae72-8140-4d15-89ff-cb044e7fb91d', 'IL', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('d76a84fd-8e04-4959-a5a3-a44e781bc96c', 'e97fae72-8140-4d15-89ff-cb044e7fb91d', 'IL', 3, '3-ci doza', '3rd dose', 180, '6 aylıq', '6 months', 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('4fff5145-858f-4bcc-8b2e-08603e4b9e6c', 'e97fae72-8140-4d15-89ff-cb044e7fb91d', 'IL', 4, '4-ci doza', '4th dose', 365, '12 aylıq', '12 months', 13);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('26dcff52-a15e-4a8b-98e1-2c165921971a', 'IL', 'HiB', 'Hib infeksiyası', 'Haemophilus influenzae type b', 'Meningit, pnevmoniya', 'Meningitis, pneumonia', 'Əzələdaxili', 'Intramuscular', '#8B5CF6', true, 13);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('aa297fe7-fd43-4bcc-a470-17db2796b717', '26dcff52-a15e-4a8b-98e1-2c165921971a', 'IL', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('6c24849c-a86f-486f-8b12-26981648d719', '26dcff52-a15e-4a8b-98e1-2c165921971a', 'IL', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('551c9f10-71ff-4e1f-947a-3ca2b2185d0d', '26dcff52-a15e-4a8b-98e1-2c165921971a', 'IL', 3, '3-ci doza', '3rd dose', 180, '6 aylıq', '6 months', 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('64006715-ffec-495f-b0c8-30dc7cdcb0f5', '26dcff52-a15e-4a8b-98e1-2c165921971a', 'IL', 4, '4-ci doza', '4th dose', 365, '12 aylıq', '12 months', 13);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('256e5cdc-b071-4f97-968e-c6cc095c3f02', 'IL', 'PCV', 'Pnevmokokk', 'Pneumococcal', 'Pnevmoniya, meningit', 'Pneumonia, meningitis', 'Əzələdaxili', 'Intramuscular', '#EC4899', true, 14);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('e9300a6a-db41-4bf6-8bfb-6336fba1224f', '256e5cdc-b071-4f97-968e-c6cc095c3f02', 'IL', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('46059e47-8dd8-4f89-8ce1-30932d3034d5', '256e5cdc-b071-4f97-968e-c6cc095c3f02', 'IL', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('223a60b4-5829-416c-9243-78b99ba8cc15', '256e5cdc-b071-4f97-968e-c6cc095c3f02', 'IL', 3, '3-ci doza', '3rd dose', 365, '12 aylıq', '12 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('da9d7d17-d3b9-48be-86b2-6835e8720587', 'IL', 'RV', 'Rotavirus', 'Rotavirus', 'Rotavirus ishalı', 'Rotavirus diarrhea', 'Ağızdan', 'Oral', '#14B8A6', true, 15);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('c2578bfd-8503-4d3f-80dc-21915475f8fa', 'da9d7d17-d3b9-48be-86b2-6835e8720587', 'IL', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('93caf7c6-7f4b-4a1e-b47f-a2dd72fc7378', 'da9d7d17-d3b9-48be-86b2-6835e8720587', 'IL', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('9cf0645f-8add-439c-89d6-83cf893fdc70', 'da9d7d17-d3b9-48be-86b2-6835e8720587', 'IL', 3, '3-ci doza', '3rd dose', 180, '6 aylıq', '6 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('26784fdc-031a-45f5-a28d-2fbb59087a72', 'IL', 'MMR', 'Qızılca, parotit, məxmərək', 'Measles, Mumps, Rubella', 'Qızılca, parotit, məxmərək', 'Measles, Mumps, Rubella', 'Dərialtı', 'Subcutaneous', '#F43F5E', true, 16);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('5b8cdb59-2905-4db5-a597-eefbe1a8db88', '26784fdc-031a-45f5-a28d-2fbb59087a72', 'IL', 1, '1-ci doza', '1st dose', 365, '12 aylıq', '12 months', 10);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('86ea8143-961a-410b-8543-0a5b5495d041', 'IL', 'VAR', 'Su çiçəyi', 'Varicella (Chickenpox)', 'Su çiçəyi', 'Chickenpox', 'Dərialtı', 'Subcutaneous', '#6366F1', true, 17);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('e53344fb-312f-4e71-86af-8e521ac3d027', '86ea8143-961a-410b-8543-0a5b5495d041', 'IL', 1, '1-ci doza', '1st dose', 365, '12 aylıq', '12 months', 10);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('75472968-1107-4e26-a5f8-f5ceaeb187f2', 'IL', 'HepA', 'Hepatit A', 'Hepatitis A', 'Hepatit A virusu', 'Hepatitis A virus', 'Əzələdaxili', 'Intramuscular', '#3B82F6', true, 18);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('fca085af-1a65-4069-851d-338573be5cd3', '75472968-1107-4e26-a5f8-f5ceaeb187f2', 'IL', 1, '1-ci doza', '1st dose', 540, '18 aylıq', '18 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('d532b9c0-6aab-4a7b-bddc-2a03357d41cc', '75472968-1107-4e26-a5f8-f5ceaeb187f2', 'IL', 2, '2-ci doza', '2nd dose', 730, '24 aylıq', '24 months', 11);
INSERT INTO public.vaccine_countries (id, code, name_az, name_en, flag_emoji, source_url, source_label, sort_order)
VALUES ('aec78e4b-a131-40c8-b921-ffcba5fde531', 'SE', 'İsveç', 'Sweden', '🇸🇪', 'https://www.folkhalsomyndigheten.se/', 'Public Health Agency of Sweden', 33);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('df582af7-3096-4cab-8a88-cabad49a426c', 'SE', 'DTaP', 'Göy öskürək, difteriya, tetanoz', 'Diphtheria, Tetanus, Pertussis', 'Göy öskürək, difteriya, tetanoz', 'Diphtheria, Tetanus, Pertussis', 'Əzələdaxili', 'Intramuscular', '#EF4444', true, 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('f867dd11-d034-4068-bf38-1d5289a47281', 'df582af7-3096-4cab-8a88-cabad49a426c', 'SE', 1, '1-ci doza', '1st dose', 90, '3 aylıq', '3 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('c1aaa324-8087-414f-887e-0b1078ffe066', 'df582af7-3096-4cab-8a88-cabad49a426c', 'SE', 2, '2-ci doza', '2nd dose', 150, '5 aylıq', '5 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('8d6dc835-b2fc-47a4-bd66-ae8fdf131579', 'df582af7-3096-4cab-8a88-cabad49a426c', 'SE', 3, '3-ci doza', '3rd dose', 365, '12 aylıq', '12 months', 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('d67cec42-f25f-4f6d-bfa2-6501d5b13df9', 'df582af7-3096-4cab-8a88-cabad49a426c', 'SE', 4, '4-ci doza', '4th dose', 1825, '5 yaş', '5 years', 13);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('dc293aa8-13fd-4bcd-9bb2-26d11831880c', 'SE', 'IPV', 'Poliomielit (IPV)', 'Polio (IPV)', 'Poliomielit', 'Poliomyelitis', 'Əzələdaxili', 'Intramuscular', '#F59E0B', true, 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('30b00f8b-31dd-4d87-b6eb-8801ae9e0641', 'dc293aa8-13fd-4bcd-9bb2-26d11831880c', 'SE', 1, '1-ci doza', '1st dose', 90, '3 aylıq', '3 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('27af8a41-f134-4c14-b26b-d91783a84445', 'dc293aa8-13fd-4bcd-9bb2-26d11831880c', 'SE', 2, '2-ci doza', '2nd dose', 150, '5 aylıq', '5 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('952a5aff-51ce-4b7a-a39f-39dd0861b783', 'dc293aa8-13fd-4bcd-9bb2-26d11831880c', 'SE', 3, '3-ci doza', '3rd dose', 365, '12 aylıq', '12 months', 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('2c7f9a96-4f97-4a2a-9712-587a0d924526', 'dc293aa8-13fd-4bcd-9bb2-26d11831880c', 'SE', 4, '4-ci doza', '4th dose', 1825, '5 yaş', '5 years', 13);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('422d9aec-beb4-4941-8654-d03180e1f59b', 'SE', 'HiB', 'Hib infeksiyası', 'Haemophilus influenzae type b', 'Meningit, pnevmoniya', 'Meningitis, pneumonia', 'Əzələdaxili', 'Intramuscular', '#8B5CF6', true, 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('768d96f1-100c-4f09-9a52-25195f9f1ecf', '422d9aec-beb4-4941-8654-d03180e1f59b', 'SE', 1, '1-ci doza', '1st dose', 90, '3 aylıq', '3 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('0337beb2-dc1c-4964-82d6-2d9ba868b58f', '422d9aec-beb4-4941-8654-d03180e1f59b', 'SE', 2, '2-ci doza', '2nd dose', 150, '5 aylıq', '5 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('6bb22c8b-b311-47a8-90ee-f404d144c486', '422d9aec-beb4-4941-8654-d03180e1f59b', 'SE', 3, '3-ci doza', '3rd dose', 365, '12 aylıq', '12 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('e9e1eb91-2296-41d7-9a49-34c1578d895e', 'SE', 'HepB', 'Hepatit B', 'Hepatitis B', 'Hepatit B virusu', 'Hepatitis B virus', 'Əzələdaxili', 'Intramuscular', '#3B82F6', true, 13);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('f11f707d-eaa5-4959-8a27-7f742320636a', 'e9e1eb91-2296-41d7-9a49-34c1578d895e', 'SE', 1, '1-ci doza', '1st dose', 90, '3 aylıq', '3 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('a627bcbb-3ebd-417e-9bf4-1d063b874e3c', 'e9e1eb91-2296-41d7-9a49-34c1578d895e', 'SE', 2, '2-ci doza', '2nd dose', 150, '5 aylıq', '5 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('659d157e-1f4b-4905-add6-046d12f24a63', 'e9e1eb91-2296-41d7-9a49-34c1578d895e', 'SE', 3, '3-ci doza', '3rd dose', 365, '12 aylıq', '12 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('c3db8ee4-0f06-436e-b1c3-716a269dcc54', 'SE', 'PCV', 'Pnevmokokk', 'Pneumococcal', 'Pnevmoniya, meningit', 'Pneumonia, meningitis', 'Əzələdaxili', 'Intramuscular', '#EC4899', true, 14);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('68d96dbb-1fdc-43c5-a084-e366e81c8db9', 'c3db8ee4-0f06-436e-b1c3-716a269dcc54', 'SE', 1, '1-ci doza', '1st dose', 90, '3 aylıq', '3 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('ccbfa439-7721-4a50-816a-9606469cd2ad', 'c3db8ee4-0f06-436e-b1c3-716a269dcc54', 'SE', 2, '2-ci doza', '2nd dose', 150, '5 aylıq', '5 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('7222d8ae-77f6-4774-bf50-a595d49da246', 'c3db8ee4-0f06-436e-b1c3-716a269dcc54', 'SE', 3, '3-ci doza', '3rd dose', 365, '12 aylıq', '12 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('28fae744-deb8-47b5-a0ae-dabe271a9909', 'SE', 'RV', 'Rotavirus', 'Rotavirus', 'Rotavirus ishalı', 'Rotavirus diarrhea', 'Ağızdan', 'Oral', '#14B8A6', true, 15);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('6532b9d3-ffe1-45e2-8a49-882817211944', '28fae744-deb8-47b5-a0ae-dabe271a9909', 'SE', 1, '1-ci doza', '1st dose', 42, '6 həftə', '6 weeks', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('b3aa11ee-b570-484f-b920-7b7fbe48f634', '28fae744-deb8-47b5-a0ae-dabe271a9909', 'SE', 2, '2-ci doza', '2nd dose', 90, '3 aylıq', '3 months', 11);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('ee112418-7bef-48fd-9b87-61072afc8f55', 'SE', 'MMR', 'Qızılca, parotit, məxmərək', 'Measles, Mumps, Rubella', 'Qızılca, parotit, məxmərək', 'Measles, Mumps, Rubella', 'Dərialtı', 'Subcutaneous', '#F43F5E', true, 16);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('97a79920-8495-42f8-841a-9f8cbfc95e88', 'ee112418-7bef-48fd-9b87-61072afc8f55', 'SE', 1, '1-ci doza', '1st dose', 540, '18 aylıq', '18 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('9c6c09c1-57d5-4a84-a2cf-0b2549c48b3c', 'ee112418-7bef-48fd-9b87-61072afc8f55', 'SE', 2, '2-ci doza', '2nd dose', 2190, '6-8 yaş', '6-8 years', 11);
INSERT INTO public.vaccine_countries (id, code, name_az, name_en, flag_emoji, source_url, source_label, sort_order)
VALUES ('ab41b4bb-22a5-4ae2-bbc2-4eb10f92363d', 'CH', 'İsveçrə', 'Switzerland', '🇨🇭', 'https://www.bag.admin.ch/', 'FOPH', 34);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('f0256d3a-0b85-445d-b987-aa91ecf90f66', 'CH', 'DTaP', 'Göy öskürək, difteriya, tetanoz', 'Diphtheria, Tetanus, Pertussis', 'Göy öskürək, difteriya, tetanoz', 'Diphtheria, Tetanus, Pertussis', 'Əzələdaxili', 'Intramuscular', '#EF4444', true, 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('3b1bc5a5-d075-40bd-88f5-fd6d9815000c', 'f0256d3a-0b85-445d-b987-aa91ecf90f66', 'CH', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('e932c470-3e8a-43ff-b4c4-f9f205fcd793', 'f0256d3a-0b85-445d-b987-aa91ecf90f66', 'CH', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('9b31e4c7-95b1-4e75-8809-07dd10d3ec90', 'f0256d3a-0b85-445d-b987-aa91ecf90f66', 'CH', 3, '3-ci doza', '3rd dose', 365, '12 aylıq', '12 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('083b63f6-512d-428f-8b55-be18593d4851', 'CH', 'IPV', 'Poliomielit (IPV)', 'Polio (IPV)', 'Poliomielit', 'Poliomyelitis', 'Əzələdaxili', 'Intramuscular', '#F59E0B', true, 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('92b50817-6294-471a-b25c-c78c5c0b2e3d', '083b63f6-512d-428f-8b55-be18593d4851', 'CH', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('ae2dd176-87f3-4189-ba29-0fb9671f6c55', '083b63f6-512d-428f-8b55-be18593d4851', 'CH', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('dcd1fcb5-8a41-4990-9575-46891d9842b5', '083b63f6-512d-428f-8b55-be18593d4851', 'CH', 3, '3-ci doza', '3rd dose', 365, '12 aylıq', '12 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('a5f5b90b-7c58-4acf-b755-db5b80cbd9c1', 'CH', 'HiB', 'Hib infeksiyası', 'Haemophilus influenzae type b', 'Meningit, pnevmoniya', 'Meningitis, pneumonia', 'Əzələdaxili', 'Intramuscular', '#8B5CF6', true, 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('3256711e-1af4-4f52-a3a6-8186756ce2ef', 'a5f5b90b-7c58-4acf-b755-db5b80cbd9c1', 'CH', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('a1fec204-95f1-405e-87a0-c615d3c9166e', 'a5f5b90b-7c58-4acf-b755-db5b80cbd9c1', 'CH', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('2f82a202-3eda-42ee-bc94-e3012f8dbf45', 'a5f5b90b-7c58-4acf-b755-db5b80cbd9c1', 'CH', 3, '3-ci doza', '3rd dose', 365, '12 aylıq', '12 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('c1a3729c-b43d-4ae8-b323-8fd2ee9d479f', 'CH', 'HepB', 'Hepatit B', 'Hepatitis B', 'Hepatit B virusu', 'Hepatitis B virus', 'Əzələdaxili', 'Intramuscular', '#3B82F6', true, 13);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('c29cd00c-cbbd-4704-865e-46cfc0796f20', 'c1a3729c-b43d-4ae8-b323-8fd2ee9d479f', 'CH', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('ea0ec8cc-22e9-4b2d-bcb2-220588d7f432', 'c1a3729c-b43d-4ae8-b323-8fd2ee9d479f', 'CH', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('db834a0d-0b67-4e04-988a-2426792d7767', 'c1a3729c-b43d-4ae8-b323-8fd2ee9d479f', 'CH', 3, '3-ci doza', '3rd dose', 365, '12 aylıq', '12 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('09eace1e-1909-4467-a5f4-b54a036d65c1', 'CH', 'PCV', 'Pnevmokokk', 'Pneumococcal', 'Pnevmoniya, meningit', 'Pneumonia, meningitis', 'Əzələdaxili', 'Intramuscular', '#EC4899', true, 14);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('5a8fc943-0c03-4a68-b970-7e0a023ace3c', '09eace1e-1909-4467-a5f4-b54a036d65c1', 'CH', 1, '1-ci doza', '1st dose', 60, '2 aylıq', '2 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('227ea78d-9dea-45a5-a5ea-237915bdac31', '09eace1e-1909-4467-a5f4-b54a036d65c1', 'CH', 2, '2-ci doza', '2nd dose', 120, '4 aylıq', '4 months', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('ee96764e-fc0f-4435-80ab-acc711f85d7c', '09eace1e-1909-4467-a5f4-b54a036d65c1', 'CH', 3, '3-ci doza', '3rd dose', 365, '12 aylıq', '12 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('d6279556-5801-443b-998d-633a2ae7f108', 'CH', 'MMR', 'Qızılca, parotit, məxmərək', 'Measles, Mumps, Rubella', 'Qızılca, parotit, məxmərək', 'Measles, Mumps, Rubella', 'Dərialtı', 'Subcutaneous', '#F43F5E', true, 15);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('12a240d4-c516-490d-b92b-9fd6c6ada323', 'd6279556-5801-443b-998d-633a2ae7f108', 'CH', 1, '1-ci doza', '1st dose', 270, '9 aylıq', '9 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('3064d66c-cbfd-42f3-9895-1794ba649fc1', 'd6279556-5801-443b-998d-633a2ae7f108', 'CH', 2, '2-ci doza', '2nd dose', 365, '12 aylıq', '12 months', 11);
INSERT INTO public.vaccine_countries (id, code, name_az, name_en, flag_emoji, source_url, source_label, sort_order)
VALUES ('d8456e66-551a-49b7-ab2e-a4bec01a2c2a', 'ZA', 'Cənubi Afrika', 'South Africa', '🇿🇦', 'https://www.health.gov.za/', 'Department of Health', 35);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('d2eee643-ccb9-48a4-be0f-9dfdeeac110c', 'ZA', 'BCG', 'Vərəm (BCG)', 'Tuberculosis (BCG)', 'Vərəm', 'Tuberculosis', 'Dəridaxili', 'Intradermal', '#10B981', true, 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('4d9f1836-f00c-4be7-9856-e0a298ac5772', 'd2eee643-ccb9-48a4-be0f-9dfdeeac110c', 'ZA', 1, '1-ci doza', '1st dose', 0, 'Doğulanda', 'At birth', 10);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('3c8cb78f-e99c-45f1-a25a-63e1a76ed37d', 'ZA', 'OPV', 'Poliomielit (OPV)', 'Polio (OPV)', 'Poliomielit', 'Poliomyelitis', 'Ağızdan (damcı)', 'Oral (drops)', '#F59E0B', true, 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('6286222a-0885-4472-a648-601801ede5f1', '3c8cb78f-e99c-45f1-a25a-63e1a76ed37d', 'ZA', 1, '1-ci doza', '1st dose', 0, 'Doğulanda', 'At birth', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('472738ee-c059-482b-bae1-fb2e07093bd9', '3c8cb78f-e99c-45f1-a25a-63e1a76ed37d', 'ZA', 2, '2-ci doza', '2nd dose', 42, '6 həftə', '6 weeks', 11);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('b229aa35-e345-4ef0-b51c-9c944b3b57d2', 'ZA', 'RV', 'Rotavirus', 'Rotavirus', 'Rotavirus ishalı', 'Rotavirus diarrhea', 'Ağızdan', 'Oral', '#14B8A6', true, 12);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('4cc8f825-de57-4a91-9fbe-385812f943d5', 'b229aa35-e345-4ef0-b51c-9c944b3b57d2', 'ZA', 1, '1-ci doza', '1st dose', 42, '6 həftə', '6 weeks', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('d54bfb0c-4326-4749-bd48-2bff99297675', 'b229aa35-e345-4ef0-b51c-9c944b3b57d2', 'ZA', 2, '2-ci doza', '2nd dose', 98, '14 həftə', '14 weeks', 11);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('1e8fd829-14c0-4c39-ad3c-dc7c935f1ad2', 'ZA', 'DTaP', 'Göy öskürək, difteriya, tetanoz', 'Diphtheria, Tetanus, Pertussis', 'Göy öskürək, difteriya, tetanoz', 'Diphtheria, Tetanus, Pertussis', 'Əzələdaxili', 'Intramuscular', '#EF4444', true, 13);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('616bdb7b-7591-4816-a5cf-1da9f964b2a8', '1e8fd829-14c0-4c39-ad3c-dc7c935f1ad2', 'ZA', 1, '1-ci doza', '1st dose', 42, '6 həftə', '6 weeks', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('0b9cb023-4d32-419c-9fc8-6e529ff654c6', '1e8fd829-14c0-4c39-ad3c-dc7c935f1ad2', 'ZA', 2, '2-ci doza', '2nd dose', 70, '10 həftə', '10 weeks', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('d4296dca-ad8c-4da8-9f6e-6db0966bf3c0', '1e8fd829-14c0-4c39-ad3c-dc7c935f1ad2', 'ZA', 3, '3-ci doza', '3rd dose', 98, '14 həftə', '14 weeks', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('a7beffc6-5675-4c6d-9ef9-2806d0829c82', 'ZA', 'IPV', 'Poliomielit (IPV)', 'Polio (IPV)', 'Poliomielit', 'Poliomyelitis', 'Əzələdaxili', 'Intramuscular', '#F59E0B', true, 14);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('3dd9a2c2-d111-42fe-8c52-b554e131a671', 'a7beffc6-5675-4c6d-9ef9-2806d0829c82', 'ZA', 1, '1-ci doza', '1st dose', 42, '6 həftə', '6 weeks', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('9a6c832c-2747-402e-b2a1-2e581a7f2095', 'a7beffc6-5675-4c6d-9ef9-2806d0829c82', 'ZA', 2, '2-ci doza', '2nd dose', 70, '10 həftə', '10 weeks', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('f8a72c43-ee54-482e-b3b4-3beeebe9407f', 'a7beffc6-5675-4c6d-9ef9-2806d0829c82', 'ZA', 3, '3-ci doza', '3rd dose', 98, '14 həftə', '14 weeks', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('00da0be1-c283-4066-907a-91723016d5c2', 'ZA', 'HiB', 'Hib infeksiyası', 'Haemophilus influenzae type b', 'Meningit, pnevmoniya', 'Meningitis, pneumonia', 'Əzələdaxili', 'Intramuscular', '#8B5CF6', true, 15);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('071c323f-a6d7-40ab-8018-330dc3520ba7', '00da0be1-c283-4066-907a-91723016d5c2', 'ZA', 1, '1-ci doza', '1st dose', 42, '6 həftə', '6 weeks', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('19d77ef9-7cb5-4bca-97bd-68bee77780c6', '00da0be1-c283-4066-907a-91723016d5c2', 'ZA', 2, '2-ci doza', '2nd dose', 70, '10 həftə', '10 weeks', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('bfa8dcb5-88a4-4c43-a8eb-bd71ecc323a6', '00da0be1-c283-4066-907a-91723016d5c2', 'ZA', 3, '3-ci doza', '3rd dose', 98, '14 həftə', '14 weeks', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('9a8f5283-43bc-4738-adbf-892d36b812b0', 'ZA', 'HepB', 'Hepatit B', 'Hepatitis B', 'Hepatit B virusu', 'Hepatitis B virus', 'Əzələdaxili', 'Intramuscular', '#3B82F6', true, 16);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('11fb8397-ae33-4b1f-a17b-069c6c4c7e04', '9a8f5283-43bc-4738-adbf-892d36b812b0', 'ZA', 1, '1-ci doza', '1st dose', 42, '6 həftə', '6 weeks', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('783ba7f4-8947-4a0c-8eec-1ce7d5b8a901', '9a8f5283-43bc-4738-adbf-892d36b812b0', 'ZA', 2, '2-ci doza', '2nd dose', 70, '10 həftə', '10 weeks', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('48313ba8-7a8d-4ee1-b662-8553e039e24a', '9a8f5283-43bc-4738-adbf-892d36b812b0', 'ZA', 3, '3-ci doza', '3rd dose', 98, '14 həftə', '14 weeks', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('bb578062-d550-4893-959a-747c86b34d16', 'ZA', 'PCV', 'Pnevmokokk', 'Pneumococcal', 'Pnevmoniya, meningit', 'Pneumonia, meningitis', 'Əzələdaxili', 'Intramuscular', '#EC4899', true, 17);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('a656e00b-c6b8-47ff-97f5-5942f725ded0', 'bb578062-d550-4893-959a-747c86b34d16', 'ZA', 1, '1-ci doza', '1st dose', 42, '6 həftə', '6 weeks', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('d9b7b7d6-bdd4-400a-a25a-336d95c743d9', 'bb578062-d550-4893-959a-747c86b34d16', 'ZA', 2, '2-ci doza', '2nd dose', 98, '14 həftə', '14 weeks', 11);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('99a2167f-15b2-4a53-bdd5-91cbcaa7f5aa', 'bb578062-d550-4893-959a-747c86b34d16', 'ZA', 3, '3-ci doza', '3rd dose', 270, '9 aylıq', '9 months', 12);
INSERT INTO public.vaccines (id, country_code, code, name_az, name_en, disease_az, disease_en, route_az, route_en, color_hex, is_mandatory, sort_order)
VALUES ('bb71132c-4773-45b5-933d-54f2fe1ed49d', 'ZA', 'MMR', 'Qızılca, parotit, məxmərək', 'Measles, Mumps, Rubella', 'Qızılca, parotit, məxmərək', 'Measles, Mumps, Rubella', 'Dərialtı', 'Subcutaneous', '#F43F5E', true, 18);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('45551c21-f063-4717-9bdf-344675fc89b5', 'bb71132c-4773-45b5-933d-54f2fe1ed49d', 'ZA', 1, '1-ci doza', '1st dose', 180, '6 aylıq', '6 months', 10);
INSERT INTO public.vaccine_schedules (id, vaccine_id, country_code, dose_number, dose_label_az, dose_label_en, recommended_age_days, age_label_az, age_label_en, sort_order)
VALUES ('8af386bd-9bad-4594-b8fd-4d4df86b22f6', 'bb71132c-4773-45b5-933d-54f2fe1ed49d', 'ZA', 2, '2-ci doza', '2nd dose', 365, '12 aylıq', '12 months', 11);
COMMIT;