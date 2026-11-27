import type { MilestoneQuiz, StyleQuiz } from '../types';
import { S } from './sources';

export const STYLE_QUIZ: StyleQuiz = {
  id: 'style',
  emoji: '🪞',
  title: 'Phong cách nuôi dạy của tôi',
  intro: '12 câu ngắn. Hãy nghĩ về hai tuần vừa qua và trả lời thật lòng — ở đây không có câu trả lời đúng hay sai. Kết quả được lưu trong tài khoản của bạn và chỉ bạn mới xem được.',
  scale: ['Hầu như không bao giờ', 'Thỉnh thoảng', 'Thường xuyên', 'Hầu như luôn luôn'],
  items: [
    { text: 'Khi con buồn hoặc giận, tôi gọi tên cảm xúc của con và ở bên con.', dim: 'warmth' },
    { text: 'Trong ngày, tôi dành thời gian để ôm con, cùng cười, nói “bố mẹ thương con”.', dim: 'warmth' },
    { text: 'Khi con nói chuyện, tôi đặt điện thoại xuống và lắng nghe.', dim: 'warmth' },
    { text: 'Tôi nhận ra và gọi tên những hành vi tốt của con.', dim: 'warmth' },
    { text: 'Ở nhà có vài quy tắc rõ ràng mà con biết.', dim: 'structure' },
    { text: 'Sau khi đặt ra quy tắc, tôi bình tĩnh làm đúng như vậy.', dim: 'structure' },
    { text: 'Nếp sinh hoạt hằng ngày của nhà tôi (ăn, ngủ) khá ổn định.', dim: 'structure' },
    { text: 'Khi con khóc hoặc nài nỉ, tôi rút lại chữ “không” đã nói.', dim: 'giveIn' },
    { text: 'Khi mệt, tôi buông hết quy tắc, “con muốn làm gì thì làm”.', dim: 'giveIn' },
    { text: 'Khi bực, tôi lớn tiếng hoặc quát con.', dim: 'harsh' },
    { text: 'Tôi đe dọa con (“bố mẹ bỏ con ở đây đấy”, “bố mẹ gọi công an bắt con”).', dim: 'harsh' },
    { text: 'Trong lúc giận, tôi muốn đánh con hoặc nói lời nặng nề, và đôi khi tôi đã làm vậy.', dim: 'harsh' },
  ],
  results: {
    balanced: {
      title: 'Ấm áp và rõ ràng',
      short: 'Bạn vừa thể hiện tình thương, vừa đặt giới hạn rõ ràng — sự kết hợp mà các nghiên cứu cho là có ích nhất.',
      detail: [
        'Các nhà tâm lý học gọi phong cách này là “có thẩm quyền” (authoritative): sự ấm áp cao và cấu trúc cao. Trẻ lớn lên với phong cách này tính trung bình tự lập hơn, tự tin hơn và kiểm soát cảm xúc tốt hơn.',
        'Điều này không có nghĩa là hoàn hảo. Bạn cũng mệt, đôi khi cũng cạn kiên nhẫn. Điều tạo nên khác biệt là sau những lúc khó khăn, bạn quay lại vun đắp mối quan hệ.',
      ],
      next: ['Khi con lớn dần, hãy bắt đầu cùng con xây dựng quy tắc.', 'Đừng quên chăm sóc bản thân: muốn là cha mẹ bình tĩnh thì cần được nghỉ ngơi.', 'Hãy giữ thói quen “thời gian đặc biệt” — đó là “tấm bảo hiểm” vững chắc nhất.'],
    },
    gentle: {
      title: 'Rất ấm áp, giới hạn còn lỏng',
      short: 'Bạn rất gần gũi với con và nhạy bén với cảm xúc của con. Đôi khi bạn thấy khó giữ vững giới hạn.',
      detail: [
        'Sự ấm áp là điểm mạnh nhất của bạn, và điều đó vô giá cho sự gắn bó an toàn của con. Nhưng trẻ thử giới hạn để biết chúng có còn ở đó không. Khi giới hạn lỏng lẻo, con thử nhiều hơn, còn cha mẹ thì kiệt sức.',
        'Tình thương và giới hạn không mâu thuẫn nhau. Câu nói “Bố mẹ thương con, và câu trả lời vẫn là không” mang lại cho con cảm giác an toàn.',
      ],
      next: ['Chọn 3–5 quy tắc gia đình rõ ràng và bình tĩnh áp dụng chúng.', 'Khi con ăn vạ, hãy đồng cảm nhưng đừng đổi quyết định.', 'Thử bước “một câu, một lần” trong chương trình “21 ngày không quát mắng”.'],
    },
    storm: {
      title: 'Đầy yêu thương, nhưng bùng nổ khi mệt mỏi',
      short: 'Bạn rất gắn bó với con, nhưng lúc căng thẳng giọng bạn lại to lên. Đây là tình huống nhiều cha mẹ thấy quen thuộc.',
      detail: [
        'Sự ấm áp của bạn là nền móng vững chắc. Còn quát mắng và lời nặng nề thường là hệ quả của sự mệt mỏi, vội vã và phải gánh vác một mình, chứ không phải do thiếu tình thương.',
        'Nghiên cứu cho thấy dù mối quan hệ ấm áp, việc quát mắng thường xuyên vẫn ảnh hưởng xấu đến hành vi của trẻ. Tin tốt là: khả năng tự điều chỉnh có thể học được, và những cuộc trò chuyện hàn gắn giúp bảo vệ mối quan hệ.',
      ],
      next: ['Tìm ngòi nổ của bạn: những giờ nào, tình huống nào?', 'Bắt đầu với “nút tạm dừng” và thở ra thật dài.', 'Chương trình “21 ngày không quát mắng” chính là dành cho bạn.'],
    },
    strict: {
      title: 'Giới hạn vững vàng, sự ấm áp còn ẩn giấu',
      short: 'Bạn coi trọng nề nếp và quy tắc. Đôi khi điều đó đánh đổi bằng sự ấm áp và lắng nghe.',
      detail: [
        'Quy tắc và sự nhất quán rất quan trọng với trẻ — đó là điểm mạnh của bạn. Nhưng theo nghiên cứu, những giới hạn đặt ra bằng kiểm soát hà khắc và trừng phạt không làm giảm vấn đề hành vi lâu dài, mà ngược lại có thể làm tăng chúng.',
        'Bạn hoàn toàn có thể giữ quy tắc mà vẫn ấm áp hơn: giải thích, gọi tên cảm xúc, nhận ra hành vi tốt.',
      ],
      next: ['Mỗi ngày 10 phút chơi do con dẫn dắt.', 'Dùng hậu quả hợp lý thay cho hình phạt.', 'Giải thích một quy tắc: “Có quy tắc này là vì…”'],
    },
    stretched: {
      title: 'Mệt mỏi và kiệt sức',
      short: 'Có vẻ dạo này bạn rất mệt. Đó không phải là cha mẹ tồi, mà là tín hiệu bạn cần được hỗ trợ.',
      detail: [
        'Khi cha mẹ kiệt sức, chẳng còn sức cho cả sự ấm áp lẫn cấu trúc. Đây là tình trạng rất phổ biến và dễ hiểu, nhất là khi có em bé nhỏ, thiếu ngủ, công việc và phải xoay xở một mình.',
        'Kết quả này không phải lời buộc tội, mà cho thấy chính bạn cũng cần được chăm sóc. Những bước nhỏ và việc nhờ giúp đỡ có thể thay đổi mọi thứ.',
      ],
      next: ['Chia sẻ gánh nặng: thỏa thuận sự giúp đỡ cụ thể với bạn đời, gia đình, bạn bè.', 'Mỗi ngày một khoảnh khắc gắn kết 5 phút: chỉ ôm và nhìn vào mắt nhau.', 'Nếu bạn buồn bã hoặc tuyệt vọng hơn hai tuần, hãy nói chuyện với bác sĩ hoặc chuyên gia tâm lý.'],
    },
  },
  note: 'Bài kiểm tra này không phải chẩn đoán, mà là công cụ đơn giản để tự quan sát. Dựa trên hai chiều ấm áp và cấu trúc của Baumrind.',
  sources: [S.baumrind1966, S.baumrind1967, S.pinquart2017, S.wangKenny2014],
};

export const MILESTONE_QUIZ: MilestoneQuiz = {
  id: 'milestones',
  emoji: '🧩',
  title: 'Ở tuổi này con mình nên làm được gì?',
  intro: 'Bài kiểm tra ngắn dựa trên các mốc phát triển của CDC và Viện Hàn lâm Nhi khoa Hoa Kỳ. Phần lớn trẻ (khoảng 3 trên 4 trẻ) thể hiện những kỹ năng này ở độ tuổi này. Mỗi đứa trẻ phát triển theo nhịp độ riêng.',
  answers: { yes: 'Có', no: 'Chưa', unsure: 'Không chắc' },
  regression: 'Con có mất đi kỹ năng nào đã từng làm được (lời nói, trò chơi, vận động) không?',
  checkpoints: [
    {
      id: 'm4',
      fromMonths: 4,
      title: '4 tháng',
      items: [
        { text: 'Bé tự mỉm cười khi nhìn thấy bạn, cố thu hút sự chú ý của bạn.', flag: true, support: 'Dành nhiều thời gian mặt đối mặt: mỉm cười, chờ đợi, đáp lại nụ cười của bé.' },
        { text: 'Bé phát ra những âm như “a-a”, “u-u”, đáp lại bằng âm thanh khi bạn nói.', support: 'Nhại lại âm thanh của bé, rồi dừng một chút để bé “trả lời”.' },
        { text: 'Bé quay đầu về phía có tiếng khi nghe giọng bạn.', flag: true, support: 'Gọi tên bé nhẹ nhàng từ nhiều hướng khác nhau.' },
        { text: 'Khi được bế, bé giữ đầu vững mà không cần đỡ.', support: 'Khi bé thức, cho bé “nằm sấp chơi” ngắn vài lần mỗi ngày.' },
        { text: 'Bé cầm và giữ được món đồ chơi đặt vào tay.', support: 'Đưa bé những chiếc lục lạc nhẹ, dễ cầm.' },
        { text: 'Khi nằm sấp, bé chống khuỷu tay và ngẩng đầu lên.', support: 'Đặt gương hoặc đồ chơi nhiều màu sắc trước mặt bé.' },
      ],
    },
    {
      id: 'm9',
      fromMonths: 9,
      title: '9 tháng',
      items: [
        { text: 'Bé nhìn khi được gọi tên.', flag: true, support: 'Thường xuyên gọi tên bé khi chơi, khi bé nhìn thì mỉm cười và khen bé.' },
        { text: 'Bé bập bẹ nhiều âm tiết khác nhau như “ma-ma-ma”, “ba-ba-ba”.', flag: true, support: 'Cùng bé lặp lại các âm tiết, hát cho bé nghe.' },
        { text: 'Bé giơ tay lên để được bế.', support: 'Trước khi bế, hãy hỏi: “Bế nhé?” và chờ bé dang tay.' },
        { text: 'Bé nhìn theo, tìm kiếm đồ vật bị rơi.', support: 'Chơi ú òa và trò “đồ chơi đâu rồi nhỉ?”.' },
        { text: 'Bé tự ngồi được không cần đỡ.', support: 'Cho bé thời gian chơi an toàn trên sàn, đặt gối xung quanh để bảo vệ.' },
        { text: 'Bé e dè người lạ hoặc nép vào bạn.', support: 'Đây là dấu hiệu của sự gắn bó. Đừng vội ép bé làm quen người mới.' },
      ],
    },
    {
      id: 'm18',
      fromMonths: 18,
      title: '18 tháng',
      items: [
        { text: 'Con chỉ tay để cho bạn thấy điều gì đó thú vị.', flag: true, support: 'Bạn cũng chỉ tay và gọi tên: “Nhìn kìa, con chim!” Khi con chỉ, hãy hào hứng đáp lại.' },
        { text: 'Ngoài “mẹ, bố”, con nói được ít nhất 3 từ khác.', flag: true, support: 'Vừa làm việc hằng ngày vừa trò chuyện, mở rộng từ ngữ của con.' },
        { text: 'Con làm theo yêu cầu đơn giản mà không cần cử chỉ (“đưa bóng đây”).', support: 'Nói yêu cầu ngắn gọn, khi con làm được thì vui vẻ cảm ơn.' },
        { text: 'Con tự đi được không cần vịn.', flag: true, support: 'Cho con nhiều cơ hội vận động chân trần ở nơi an toàn.' },
        { text: 'Con bắt chước bạn làm việc nhà (quét nhà, nghe điện thoại).', support: 'Đưa con chổi nhỏ, bộ đồ chơi nấu ăn, cùng nhau “làm việc”.' },
        { text: 'Con tự bốc ăn bằng tay, cố gắng dùng thìa.', support: 'Cho phép con lem luốc, đưa con đồ ăn cầm tay.' },
      ],
    },
    {
      id: 'm30',
      fromMonths: 30,
      title: '2,5 tuổi',
      items: [
        { text: 'Con nói được khoảng 50 từ.', support: 'Cùng đọc sách, gọi tên các bức tranh, đặt câu hỏi mở.' },
        { text: 'Con ghép hai từ có động từ (“mèo chạy”).', flag: true, support: 'Mở rộng một từ của con thành hai từ: “Ô tô.” — “Ô tô to đang chạy!”' },
        { text: 'Con dùng các từ “con”, “của con”, “chúng mình”.', support: 'Trong trò chơi thay phiên, hãy nói “lượt của bố mẹ, lượt của con”.' },
        { text: 'Con chơi trò đóng vai (cho búp bê ăn, đẩy khối gỗ như ô tô).', flag: true, support: 'Tham gia trò đóng vai cùng con, gợi ý những tình huống đơn giản.' },
        { text: 'Con làm theo yêu cầu hai bước (“nhặt đồ chơi lên và bỏ vào hộp”).', support: 'Đưa yêu cầu qua trò chơi, tập một bước trước, rồi hai bước.' },
        { text: 'Con bật nhảy bằng hai chân.', support: 'Chơi các trò nhảy ngoài trời, trò “con thỏ”.' },
      ],
    },
    {
      id: 'm48',
      fromMonths: 48,
      title: '4 tuổi',
      items: [
        { text: 'Con nói câu có từ 4 từ trở lên.', flag: true, support: 'Cùng nói chuyện về một ngày, mở rộng câu chuyện của con bằng các câu hỏi.' },
        { text: 'Con kể lại một chuyện xảy ra trong ngày.', support: 'Buổi tối hãy cùng trò chuyện về “khoảnh khắc vui nhất trong ngày”.' },
        { text: 'Khi chơi, con hóa thân thành người khác (cô giáo, siêu anh hùng).', support: 'Cho con thời gian và đồ dùng cho trò hóa trang, đóng vai.' },
        { text: 'Con thích chơi với trẻ khác và biết an ủi bạn.', flag: true, support: 'Tổ chức những buổi gặp bạn ngắn, giúp con gọi tên cảm xúc.' },
        { text: 'Con nói được tên vài màu sắc.', support: 'Gọi tên màu sắc trong cuộc sống hằng ngày, biến thành trò chơi.' },
        { text: 'Con thường bắt được quả bóng to, cầm bút sáp bằng các ngón tay.', support: 'Chơi bóng, vẽ tranh, nặn đất.' },
      ],
    },
    {
      id: 'y6',
      fromMonths: 72,
      title: 'Tuổi đi học (6–12)',
      items: [
        { text: 'Con phần lớn tự làm các việc chăm sóc bản thân hằng ngày (mặc quần áo, đánh răng).', support: 'Cho con tự lập phù hợp với tuổi, hỗ trợ bằng bảng sinh hoạt có hình.' },
        { text: 'Con có ít nhất một người bạn và thích chơi cùng bạn ấy.', flag: true, support: 'Tạo cơ hội để con kết bạn, cùng tập kỹ năng xã hội ở nhà.' },
        { text: 'Con tuân theo luật chơi, biết chờ đến lượt.', support: 'Cả nhà cùng chơi các trò chơi bàn cờ có luật.' },
        { text: 'Con có thể giải thích cảm xúc của mình bằng lời.', support: 'Biến việc nói về cảm xúc thành thói quen hằng ngày.' },
        { text: 'Kỹ năng đọc và đếm của con tiến bộ phù hợp với lớp học.', flag: true, support: 'Giữ liên lạc với giáo viên, cùng con đọc sách, ghi nhận nỗ lực của con.' },
        { text: 'Sau khi bực bội, con bình tĩnh lại trong một khoảng thời gian hợp lý.', support: 'Cùng con chọn và luyện tập các cách để bình tĩnh.' },
      ],
    },
  ],
  results: {
    ontrack: {
      title: 'Mọi thứ đang đi đúng hướng',
      short: 'Con bạn thể hiện phần lớn các kỹ năng được mong đợi ở độ tuổi này.',
      detail: [
        'Nếu có câu trả lời “Chưa”, đừng lo: trẻ có những kỹ năng học muộn hơn một chút, có những kỹ năng lại học sớm.',
        'Mỗi lần khám định kỳ, hãy hỏi bác sĩ những thắc mắc về sự phát triển của con — đó là cách theo dõi tốt nhất.',
      ],
    },
    watch: {
      title: 'Một vài kỹ năng vẫn đang hình thành',
      short: 'Có vài câu trả lời “Chưa” hoặc “Không chắc”. Bạn có thể hỗ trợ những kỹ năng này qua các trò chơi hằng ngày.',
      detail: [
        'Hãy hỗ trợ con trong 4–6 tuần theo những gợi ý bên dưới rồi kiểm tra lại.',
        'Nếu vẫn còn lo lắng, hãy nói chuyện với bác sĩ nhi mà không cần chờ lần khám tiếp theo. Hỗ trợ sớm bao giờ cũng tốt hơn chờ đợi.',
      ],
    },
    talk: {
      title: 'Chúng tôi khuyên bạn nên trao đổi với bác sĩ nhi',
      short: 'Một số câu trả lời là tín hiệu cần bác sĩ xem xét. Đây không phải chẩn đoán, nhưng cũng không nên chờ đợi.',
      detail: [
        'Việc mất kỹ năng (thoái lui) hoặc chậm đạt những mốc quan trọng cần được đánh giá sớm. Hỗ trợ bắt đầu sớm mang lại kết quả tốt nhất.',
        'Khi đi khám, bạn có thể đưa danh sách này cho bác sĩ xem.',
      ],
    },
  },
  note: 'Bài kiểm tra này là công cụ sàng lọc, không phải chẩn đoán. Nếu bạn lo lắng, hãy đưa con đi khám bất kể kết quả thế nào.',
  sources: [S.zubler2022, S.cdcActEarly],
};
