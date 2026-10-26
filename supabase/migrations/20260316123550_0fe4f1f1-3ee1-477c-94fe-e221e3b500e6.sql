
INSERT INTO play_activities (title, title_az, description, description_az, instructions, instructions_az, min_age_days, max_age_days, duration_minutes, required_items, skill_tags, difficulty_level, sort_order, is_active) VALUES

-- 0-3 ay (0-90 gün)
('Black & White Mobile', 'Ağ-Qara Mobil', 'Hang high-contrast images above baby', 'Körpənin üstündə ağ-qara şəkillər asın', 'Cut simple shapes from paper, hang them 20-30cm above baby. Let baby track the movement.', 'Kağızdan sadə formalar kəsin, körpənin 20-30 sm yuxarısında asın. Körpənin hərəkəti izləməsinə imkan verin.', 0, 90, 10, '{"paper"}', '{"sensory","cognitive"}', 'easy', 100, true),

('Gentle Singing', 'Yumşaq Layla', 'Sing softly to your baby', 'Körpənizə yumşaq səslə oxuyun', 'Hold baby close and sing gentle lullabies or simple songs. Watch for baby responding to your voice.', 'Körpəni yaxın tutun və yumşaq laylalar və ya sadə mahnılar oxuyun. Körpənin səsinizə reaksiyasını izləyin.', 0, 180, 10, '{}', '{"language","social","sensory"}', 'easy', 101, true),

('Hand Holding & Grasping', 'Əl Tutma Oyunu', 'Let baby practice grasping your fingers', 'Körpənin barmaqlarınızı tutmasına imkan verin', 'Offer your fingers for baby to grasp. Gently pull to encourage gripping strength.', 'Barmaqlarınızı körpənin tutması üçün təqdim edin. Tutma gücünü inkişaf etdirmək üçün yumşaq çəkin.', 0, 120, 5, '{}', '{"motor","social"}', 'easy', 102, true),

('Tummy Time with Toys', 'Oyuncaqlarla Qarın Vaxtı', 'Place colorful toys in front during tummy time', 'Qarın vaxtında rəngli oyuncaqları qarşıya qoyun', 'Place baby on tummy. Put colorful toys just out of reach to encourage reaching and head lifting.', 'Körpəni qarnı üstə qoyun. Əlçatmaz məsafədə rəngli oyuncaqlar qoyaraq uzanmağı və başını qaldırmağı həvəsləndirin.', 30, 180, 10, '{"blanket"}', '{"motor","cognitive"}', 'easy', 103, true),

-- 3-6 ay (90-180 gün)
('Splash Time', 'Su Oyunu', 'Let baby splash water with hands', 'Körpənin əlləri ilə su çilənməsinə imkan verin', 'Fill a shallow bowl with warm water. Let baby touch and splash. Always supervise closely.', 'Dayaz bir qabı isti su ilə doldurun. Körpənin toxunmasına və su çiləməsinə imkan verin. Daim nəzarət edin.', 90, 365, 10, '{"water"}', '{"sensory","motor"}', 'easy', 104, true),

('Flying Baby', 'Uçan Körpə', 'Gently lift baby in the air', 'Körpəni yumşaq havaya qaldırın', 'Lie on your back, hold baby securely and gently lift them up like flying. Great for bonding.', 'Arxanız üstə uzanın, körpəni möhkəm tutun və uçurmuş kimi yumşaq qaldırın. Bağlılıq üçün əladır.', 60, 270, 5, '{}', '{"motor","social","sensory"}', 'easy', 105, true),

('Fabric Feel', 'Parça Hissi', 'Let baby touch different fabrics', 'Körpəyə müxtəlif parçalara toxunmağa imkan verin', 'Gather soft, rough, smooth, fluffy fabrics. Let baby touch and feel each one while naming the texture.', 'Yumşaq, kobud, hamar, tüklü parçalar toplayın. Hər birinə toxunmağa imkan verin və teksturanı adlandırın.', 60, 365, 10, '{"fabric_scraps"}', '{"sensory","language","cognitive"}', 'easy', 106, true),

('Rattle Shake', 'Çıngıraq Silkələmə', 'Baby shakes rattle to make sounds', 'Körpə səs çıxarmaq üçün çıngıraq silkələyir', 'Give baby a rattle and demonstrate shaking. Celebrate when baby copies you. Try different rhythms.', 'Körpəyə çıngıraq verin və silkələməyi göstərin. Sizi təqlid edəndə sevinc ifadə edin. Fərqli ritmlər sınayın.', 90, 270, 10, '{"rattle"}', '{"motor","sensory","cognitive"}', 'easy', 107, true),

-- 6-9 ay (180-270 gün)
('Treasure Basket', 'Xəzinə Səbəti', 'Fill a basket with safe household objects', 'Səbəti təhlükəsiz ev əşyaları ilə doldurun', 'Collect 5-10 safe items of different textures, shapes. Let baby explore freely, naming each object.', '5-10 müxtəlif tekstura və formada təhlükəsiz əşya toplayın. Körpənin sərbəst araşdırmasına imkan verin, hər birini adlandırın.', 150, 365, 15, '{"container"}', '{"sensory","cognitive","language"}', 'easy', 108, true),

('Clap Hands Song', 'Əl Çal Mahnısı', 'Sing and clap together', 'Birlikdə oxuyun və əl çalın', 'Sing simple clapping songs. Help baby clap their hands together. Great for rhythm and coordination.', 'Sadə əl çalma mahnıları oxuyun. Körpənin əllərini bir-birinə vurmağa kömək edin. Ritm və koordinasiya üçün əladır.', 150, 540, 10, '{}', '{"motor","language","social"}', 'easy', 109, true),

('Spoon Drop Game', 'Qaşıq Atma Oyunu', 'Drop spoons into a pot', 'Qaşıqları qazana atın', 'Show baby how to drop wooden spoons into a pot. Let them hear the sound and repeat.', 'Körpəyə taxta qaşıqları qazana atmağı göstərin. Səsi eşitmələrinə və təkrarlamalarına imkan verin.', 180, 540, 10, '{"wooden_spoon","pots_and_pans"}', '{"motor","cognitive","sensory"}', 'easy', 110, true),

('Ice Cube Painting', 'Buz Boyama', 'Paint with colored ice cubes on paper', 'Rəngli buz kubları ilə kağızda boyayın', 'Freeze water with food coloring. Let baby slide ice on paper to make colorful patterns.', 'Su ilə qida boyasını dondurub rəngli buz kubları hazırlayın. Körpəni kağız üzərində sürüşdürməyə buraxın.', 180, 730, 15, '{"ice_cubes","paper"}', '{"sensory","motor","cognitive"}', 'easy', 111, true),

('Cotton Ball Transfer', 'Pambıq Topu Köçürmə', 'Move cotton balls between containers', 'Pambıq toplarını bir qabdan digərinə köçürün', 'Give baby two bowls and cotton balls. Show how to pick up and transfer them. Great for fine motor skills.', 'Körpəyə iki qab və pambıq topları verin. Götürüb köçürməyi göstərin. İncə motor bacarıqları üçün əladır.', 180, 540, 10, '{"cotton_balls","container"}', '{"motor","cognitive"}', 'easy', 112, true),

('Paper Tearing', 'Kağız Cırmaq', 'Tear paper into pieces', 'Kağızı parçalara cırın', 'Give baby soft paper to tear. The sound and feeling builds sensory awareness and hand strength.', 'Körpəyə yumşaq kağız verin cırması üçün. Səs və hiss duyğu fərkindəliyini və əl gücünü artırır.', 180, 540, 10, '{"paper"}', '{"sensory","motor"}', 'easy', 113, true),

-- 9-12 ay (270-365 gün)
('Cardboard Tube Tunnel', 'Karton Boru Tuneli', 'Roll ball through cardboard tubes', 'Topu karton borulardan keçirin', 'Hold a cardboard tube and show baby how to roll a small ball through it. Chase after the ball together.', 'Karton boruyu tutun və körpəyə kiçik topu içindən necə yuvarlamağı göstərin. Topu birlikdə qovun.', 240, 540, 10, '{"cardboard_tubes","ball"}', '{"motor","cognitive"}', 'easy', 114, true),

('Egg Carton Sorter', 'Yumurta Qutusu Ayırıcı', 'Sort small objects into egg carton holes', 'Kiçik əşyaları yumurta qutusu deşiklərinə yerləşdirin', 'Place safe small objects nearby. Show baby how to put one in each egg carton slot. Count as you go.', 'Yaxınlığa təhlükəsiz kiçik əşyalar qoyun. Hər yumurta qutusu yuvasına birini qoymağı göstərin. Sayaraq davam edin.', 270, 730, 15, '{"egg_cartons"}', '{"motor","cognitive","language"}', 'medium', 115, true),

('Sponge Squeeze', 'Süngər Sıxma', 'Squeeze wet sponges into bowls', 'Yaş süngərləri qablara sıxın', 'Wet sponges and show baby how to squeeze water into a bowl. Great for hand strength.', 'Süngərləri isladın və körpəyə suyu qaba necə sıxmağı göstərin. Əl gücü üçün əladır.', 270, 730, 10, '{"sponges","water"}', '{"motor","sensory"}', 'easy', 116, true),

('Feather Blowing', 'Tük Üfləmə', 'Blow feathers and watch them float', 'Tükləri üfləyin və süzülmələrini izləyin', 'Place feathers on a flat surface. Blow gently and let baby try to catch or blow them too.', 'Tükləri düz səthə qoyun. Yumşaq üfləyin, körpənin tutmağa və ya üfləməyə çalışmasına imkan verin.', 180, 540, 10, '{"feathers"}', '{"sensory","motor","language"}', 'easy', 117, true),

('Sand Play', 'Qum Oyunu', 'Dig and pour with sand', 'Qumda qazın və tökün', 'Fill a tray with sand. Give cups and spoons. Let baby dig, pour, and feel the texture.', 'Bir qabı qumla doldurun. Fincan və qaşıq verin. Körpənin qazmasına, tökməsinə və toxunmasına imkan verin.', 180, 730, 20, '{"sand","cups"}', '{"sensory","motor","cognitive"}', 'easy', 118, true),

('Play Dough Squish', 'Xəmir Sıxma', 'Squish, roll and shape play dough', 'Oyun xəmirini sıxın, yuvarlayın və formalayın', 'Give baby play dough. Show squishing, rolling, poking. Use cookie cutters for shapes.', 'Körpəyə oyun xəmiri verin. Sıxmağı, yuvarlmağı, deşməyi göstərin. Formalar üçün peçenye kəsiciləri istifadə edin.', 270, 730, 15, '{"play_dough"}', '{"motor","sensory","cognitive"}', 'easy', 119, true),

-- 12-18 ay (365-540 gün)
('Block Tower', 'Kubik Qülləsi', 'Stack blocks as high as possible', 'Kubikləri mümkün qədər hündür yığın', 'Show baby how to stack blocks. Count each block. Celebrate when the tower falls! Rebuild together.', 'Körpəyə kubikləri necə yığmağı göstərin. Hər kubiki sayın. Qüllə yıxılanda sevinin! Birlikdə yenidən qurun.', 270, 730, 15, '{"blocks"}', '{"motor","cognitive","language"}', 'easy', 120, true),

('Laundry Helper', 'Paltar Köməkçisi', 'Sort socks by color', 'Corabları rənginə görə ayırın', 'Mix different colored socks together. Ask baby to find matching pairs by color.', 'Müxtəlif rəngli corabları qarışdırın. Körpədən rənginə görə cüt tapmasını istəyin.', 365, 730, 15, '{"socks"}', '{"cognitive","language","social"}', 'medium', 121, true),

('Animal Sounds', 'Heyvan Səsləri', 'Imitate animal sounds together', 'Birlikdə heyvan səslərini təqlid edin', 'Point to animal pictures in a book. Make the sound for each animal. Encourage baby to copy.', 'Kitabdakı heyvan şəkillərinə işarə edin. Hər heyvanın səsini çıxarın. Körpəni təqlid etməyə həvəsləndirin.', 270, 730, 10, '{"books"}', '{"language","cognitive","social"}', 'easy', 122, true),

('Scarf Pull', 'Şərf Dartma', 'Pull scarves from a container', 'Şərfləri qabdan çıxarın', 'Stuff scarves into a box with a hole. Let baby pull them out one by one. Name each color.', 'Şərfləri deşikli bir qutuya doldurma. Körpənin bir-bir çıxarmasına imkan verin. Hər rəngi adlandırın.', 180, 540, 10, '{"scarf","cardboard_box"}', '{"motor","cognitive","language"}', 'easy', 123, true),

('Water Pouring', 'Su Tökməsi', 'Pour water between cups', 'Suyu fincanlar arasında tökün', 'Give baby two cups and water. Demonstrate pouring from one to another. Great for coordination.', 'Körpəyə iki fincan və su verin. Birindən digərinə tökməyi göstərin. Koordinasiya üçün əladır.', 270, 730, 10, '{"cups","water"}', '{"motor","cognitive"}', 'easy', 124, true),

('Pillow Mountain', 'Yastıq Dağı', 'Climb over pillow obstacles', 'Yastıq maneələrini aşın', 'Arrange pillows and cushions as an obstacle course. Encourage baby to climb over and through.', 'Yastıq və mütəkkələri maneə zolağı kimi düzün. Körpəni üstündən keçməyə və içindən sürünməyə həvəsləndirin.', 240, 540, 15, '{"pillow","blanket"}', '{"motor","cognitive"}', 'easy', 125, true),

('Hide and Seek Toy', 'Oyuncaq Gizlət-Tap', 'Hide toy under cups and find it', 'Oyuncağı fincanların altında gizlədin və tapın', 'Place 2-3 cups upside down. Hide a small toy under one. Ask baby to find it.', '2-3 fincanı çevirin. Birinin altında kiçik oyuncaq gizlədin. Körpədən tapmasını istəyin.', 240, 540, 10, '{"cups"}', '{"cognitive","social"}', 'easy', 126, true),

-- 12-24 ay (365-730 gün)
('Color Sorting', 'Rəng Ayırma', 'Sort objects by color into containers', 'Əşyaları rəngə görə qablara ayırın', 'Use different colored objects (blocks, balls, lids). Place containers and ask child to sort by color.', 'Fərqli rəngli əşyalar (kubik, top, qapaq) istifadə edin. Qablar qoyun, rəngə görə ayırmağı istəyin.', 365, 730, 15, '{"blocks","container"}', '{"cognitive","language"}', 'medium', 127, true),

('Body Parts Game', 'Bədən Hissələri Oyunu', 'Point to and name body parts', 'Bədən hissələrinə işarə edin və adlandırın', 'Touch your nose, ears, eyes and name them. Ask child to copy. Sing head-shoulders-knees song.', 'Burnunuza, qulaqlarınıza, gözlərinizə toxunun və adlandırın. Uşaqdan təqlid etməsini istəyin.', 270, 730, 10, '{}', '{"language","cognitive","social"}', 'easy', 128, true),

('Cardboard House', 'Karton Ev', 'Create a play house from a big box', 'Böyük qutudan oyun evi düzəldin', 'Cut windows and a door in a large box. Decorate together. Let child play inside.', 'Böyük qutuda pəncərə və qapı kəsin. Birlikdə bəzəyin. Uşağın içərisində oynamasına imkan verin.', 365, 730, 30, '{"cardboard_box"}', '{"cognitive","social","motor"}', 'medium', 129, true),

('Follow the Leader', 'Lideri İzlə', 'Copy movements together', 'Hərəkətləri birlikdə təqlid edin', 'Do simple actions: jump, clap, spin, stomp. Ask child to follow. Then let them lead.', 'Sadə hərəkətlər edin: tullanın, əl çalın, fırlanın, ayaqla vurun. Uşaqdan izləməsini istəyin. Sonra onlar lider olsun.', 365, 730, 10, '{}', '{"motor","social","cognitive"}', 'easy', 130, true),

('Puzzle Time', 'Puzzle Vaxtı', 'Simple shape puzzles', 'Sadə forma puzzle-ları', 'Give child a simple 3-5 piece puzzle. Guide them to match shapes. Celebrate each placed piece.', 'Uşağa sadə 3-5 parçalı puzzle verin. Formaları uyğunlaşdırmağa yönləndirin. Hər yerləşdirilən parça üçün sevinin.', 365, 730, 15, '{"shape_sorter"}', '{"cognitive","motor"}', 'medium', 131, true),

('Sticker Play', 'Stiker Oyunu', 'Peel and stick stickers on paper', 'Stikerləri soyun və kağıza yapışdırın', 'Give child stickers and paper. Peeling stickers builds fine motor skills. Create a picture together.', 'Uşağa stiker və kağız verin. Stiker soymaq incə motor bacarıqlarını inkişaf etdirir. Birlikdə şəkil yaradın.', 365, 730, 15, '{"paper"}', '{"motor","cognitive"}', 'easy', 132, true),

('Tunnel Crawl', 'Tunel Sürünmə', 'Crawl through blanket tunnel', 'Yorğan tunelindən sürünün', 'Drape blankets over chairs to make a tunnel. Encourage child to crawl through. Place toys at the end.', 'Yorğanları stulların üstünə ataraq tunel düzəldin. Uşağı sürünməyə həvəsləndirin. Sonuna oyuncaqlar qoyun.', 240, 730, 15, '{"blanket"}', '{"motor","cognitive","social"}', 'easy', 133, true),

('Nature Walk', 'Təbiət Gəzintisi', 'Collect leaves and stones', 'Yarpaqlar və daşlar toplayın', 'Go on a short walk. Collect leaves, stones, flowers. Talk about colors, shapes and textures.', 'Qısa gəzintiyə çıxın. Yarpaqlar, daşlar, çiçəklər toplayın. Rənglər, formalar və teksturalar haqqında danışın.', 270, 730, 20, '{}', '{"sensory","language","cognitive"}', 'easy', 134, true),

('Drum Circle', 'Təbil Dairəsi', 'Make rhythms with pots and spoons', 'Qazan və qaşıqla ritmlər yaradın', 'Turn pots upside down as drums. Use wooden spoons as drumsticks. Create rhythms together.', 'Qazanları təbil kimi çevirin. Taxta qaşıqları çubuq kimi istifadə edin. Birlikdə ritmlər yaradın.', 180, 730, 15, '{"pots_and_pans","wooden_spoon"}', '{"sensory","motor","social"}', 'easy', 135, true),

('Rice Sensory Bin', 'Düyü Duyğu Qabı', 'Explore rice with hands and tools', 'Düyünü əllər və alətlərlə araşdırın', 'Fill a container with rice. Add cups, spoons, small toys. Let child scoop, pour and search.', 'Qabı düyü ilə doldurun. Fincanlar, qaşıqlar, kiçik oyuncaqlar əlavə edin. Uşağın qapmasına, tökməsinə imkan verin.', 180, 730, 20, '{"rice_pasta","container","wooden_spoon"}', '{"sensory","motor","cognitive"}', 'easy', 136, true),

('Blanket Swing', 'Yorğan Yelləncəyi', 'Gently swing baby in a blanket', 'Körpəni yorğanda yumşaq yelləyin', 'Two adults hold blanket corners with baby inside. Gently swing side to side while singing.', 'İki böyük körpə içəridə olarkən yorğanın künclərdən tutur. Mahnı oxuyaraq yumşaqca yelləyin.', 60, 540, 5, '{"blanket"}', '{"sensory","social","motor"}', 'easy', 137, true),

('Pasta Necklace', 'Makaron Boyunbağı', 'Thread pasta onto string', 'Makaronu ipə düzün', 'Use large tube pasta. Show child how to thread onto a string or shoelace. Great for fine motor.', 'Böyük boru makaron istifadə edin. Uşağa ipə və ya ayaqqabı bağına necə keçirməyi göstərin. İncə motor üçün əladır.', 540, 730, 15, '{"rice_pasta"}', '{"motor","cognitive"}', 'medium', 138, true),

('Shadow Play', 'Kölgə Oyunu', 'Make shadow puppets on the wall', 'Divarda kölgə kuklaları düzəldin', 'In a dark room, use a flashlight to make hand shadows on the wall. Make animals and objects.', 'Qaranlıq otaqda əl fənəri ilə divarda kölgə düzəldin. Heyvanlar və əşyalar formalaşdırın.', 180, 730, 10, '{}', '{"cognitive","social","language"}', 'easy', 139, true),

('Washing Toys', 'Oyuncaq Yuma', 'Wash toys in soapy water', 'Oyuncaqları sabunlu suda yuyun', 'Fill a tub with warm soapy water. Give baby sponge and toys to wash. Name each toy while washing.', 'Bir qabı isti sabunlu su ilə doldurun. Körpəyə süngər və oyuncaqlar verin yumaq üçün. Hər oyuncağı adlandırın.', 270, 730, 15, '{"water","sponges"}', '{"sensory","motor","language"}', 'easy', 140, true),

('Finger Painting', 'Barmaqla Boyama', 'Paint with fingers on paper', 'Kağız üzərində barmaqlarla boyayın', 'Put safe paint on paper. Let child use fingers and hands to create art. Talk about colors.', 'Təhlükəsiz boyaları kağıza tökün. Uşağın barmaq və əlləri ilə sənət yaratmasına imkan verin. Rənglər haqqında danışın.', 270, 730, 20, '{"paper"}', '{"sensory","motor","cognitive"}', 'easy', 141, true),

('Counting Game', 'Sayma Oyunu', 'Count objects together', 'Birlikdə əşyaları sayın', 'Gather small objects like blocks. Count them together one by one. Make groups of 2, 3, 4.', 'Kubik kimi kiçik əşyalar toplayın. Bir-bir birlikdə sayın. 2, 3, 4-lü qruplar yaradın.', 365, 730, 10, '{"blocks"}', '{"cognitive","language"}', 'easy', 142, true);
