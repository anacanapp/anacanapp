export const WIDTH = 1080;
export const SOCIAL_HEIGHT = 1350;
export const PRINT_HEIGHT = WIDTH * 210 / 148;
export const DESTINATION = 'https://api.anacan.az';

const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const text = (lines, x, y, size, fill, { weight = 700, tracking = 0, leading = size * 1.15, anchor = 'start', opacity = 1 } = {}) =>
  `<text data-copy="true" x="${x}" y="${y}" font-family="AnacanSans" font-size="${size}" font-weight="${weight}" letter-spacing="${tracking}" fill="${fill}" text-anchor="${anchor}" opacity="${opacity}">${(Array.isArray(lines) ? lines : [lines]).map((line, index) => `<tspan x="${x}" y="${y + index * leading}">${esc(line)}</tspan>`).join('')}</text>`;
const rect = (x, y, width, height, fill, radius = 0, extra = '') => `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${fill}" ${extra}/>`;
const circle = (x, y, radius, fill, extra = '') => `<circle cx="${x}" cy="${y}" r="${radius}" fill="${fill}" ${extra}/>`;
const line = (x1, y1, x2, y2, stroke, width = 1, opacity = 1) => `<path d="M${x1} ${y1}L${x2} ${y2}" fill="none" stroke="${stroke}" stroke-width="${width}" opacity="${opacity}"/>`;
const star = (x, y, size, fill) => `<path d="M0 -${size}Q${size * 0.16} -${size * 0.16} ${size} 0Q${size * 0.16} ${size * 0.16} 0 ${size}Q-${size * 0.16} ${size * 0.16} -${size} 0Q-${size * 0.16} -${size * 0.16} 0 -${size}Z" transform="translate(${x} ${y})" fill="${fill}"/>`;
function arc(cx, cy, radius, start, end) {
  const point = angle => [cx + radius * Math.cos(angle * Math.PI / 180), cy + radius * Math.sin(angle * Math.PI / 180)];
  const [sx, sy] = point(start), [ex, ey] = point(end);
  return `M${sx} ${sy}A${radius} ${radius} 0 ${end - start > 180 ? 1 : 0} 1 ${ex} ${ey}`;
}

function header(ink, accent) {
  return text('anacan', 76, 101, 49, ink, { tracking: -2.6 })
    + rect(756, 61, 248, 43, 'none', 22, `stroke="${ink}" stroke-opacity=".23"`)
    + text('AZƏRBAYCAN DİLİNDƏ', 880, 88, 13.5, accent, { anchor: 'middle', tracking: 1.4 });
}
function footer(height, ink, muted, qr) {
  return line(76, height - 212, 1004, height - 212, ink, 1, 0.2)
    + text('GÜNDƏLİK QAYĞIN ÜÇÜN', 77, height - 166, 15, muted, { tracking: 2.2 })
    + `<a href="${DESTINATION}" target="_blank">${text('Anacan ilə başla', 76, height - 117, 34, ink, { tracking: -0.9 })}
      ${circle(765, height - 135, 29, 'none', `stroke="${ink}" stroke-width="1.5"`)}
      <path d="M753 ${height - 135}H777M768 ${height - 145}L778 ${height - 135}L768 ${height - 125}" fill="none" stroke="${ink}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    </a>`
    + text('Telefonunda kəşf et.', 77, height - 71, 21, muted, { weight: 400 })
    + text('Kodu oxut', 939, height - 192, 14.5, muted, { anchor: 'middle', weight: 400 })
    + rect(862, height - 180, 152, 152, '#FFFFFF', 13)
    + `<g transform="translate(866 ${height - 176})">${qr}</g>`;
}

function commonDefs(id, fonts, ink) {
  return `<defs>
    <style>@font-face{font-family:AnacanSans;src:url(data:font/ttf;base64,${fonts.regular}) format('truetype');font-weight:400;font-style:normal;font-display:block}@font-face{font-family:AnacanSans;src:url(data:font/ttf;base64,${fonts.bold}) format('truetype');font-weight:700;font-style:normal;font-display:block}text{font-family:AnacanSans,sans-serif}</style>
    <pattern id="${id}-paper" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".42" fill="${ink}" opacity=".1"/><circle cx="6" cy="5" r=".3" fill="${ink}" opacity=".07"/></pattern>
    <filter id="${id}-shadow" x="-50%" y="-50%" width="200%" height="220%"><feDropShadow dx="0" dy="19" stdDeviation="16" flood-color="#172930" flood-opacity=".12"/></filter>
    <filter id="${id}-soft" x="-70%" y="-70%" width="240%" height="240%"><feGaussianBlur stdDeviation="20"/></filter>
    <clipPath id="${id}-weave"><rect x="440" y="650" width="240" height="180"/></clipPath>
    <linearGradient id="${id}-coral" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#FFD9BF"/><stop offset=".42" stop-color="#FF8A81"/><stop offset="1" stop-color="#DC4058"/></linearGradient>
    <linearGradient id="${id}-pink" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#FFF3DE"/><stop offset=".45" stop-color="#FFC7C5"/><stop offset="1" stop-color="#E894B0"/></linearGradient>
    <linearGradient id="${id}-lilac" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#EDE3FC"/><stop offset=".5" stop-color="#C1A2E1"/><stop offset="1" stop-color="#8663B8"/></linearGradient>
    <linearGradient id="${id}-sage" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#F6F4D9"/><stop offset=".48" stop-color="#D3E3C8"/><stop offset="1" stop-color="#83B2A3"/></linearGradient>
  </defs>`;
}

function life(id, height) {
  const ink = '#442D36', muted = '#856572', offset = (height - SOCIAL_HEIGHT) / 2;
  return {
    background: '#FFF2E9', ink, muted, headerAccent: '#B55258',
    art: `${circle(1070, 235, 259, '#FFE2D9')}${circle(-100, height - 290, 305, '#F8DDE4')}
      ${text('QADIN SAĞLAMLIĞI VƏ ANALIQ', 79, 178, 16, '#B15E62', { tracking: 2.5 })}
      ${text(['Hər mərhələdə', 'səninlə.'], 72, 296, 112, ink, { tracking: -5.2, leading: 119 })}
      ${text(['Dövr, hamiləlik və analıq —', 'gündəlik qayğın bir tətbiqdə.'], 79, 486, 27, muted, { weight: 400, leading: 39 })}
      <g transform="translate(0 ${offset})">
        ${text('Sənin yolun. Sənin ritmin.', 80, 601, 19, '#A87574', { weight: 400 })}
        ${star(958, 597, 21, '#C2788C')}
        <ellipse cx="544" cy="1037" rx="400" ry="30" fill="#925C76" opacity=".12" filter="url(#${id}-soft)"/>
        <g filter="url(#${id}-shadow)">
          ${circle(268, 842, 172, 'none', `stroke="url(#${id}-coral)" stroke-width="88"`)}
          ${circle(540, 842, 172, 'none', `stroke="url(#${id}-pink)" stroke-width="88"`)}
          ${circle(812, 842, 172, 'none', `stroke="url(#${id}-lilac)" stroke-width="88"`)}
        </g>
        <path d="${arc(268, 842, 206, 205, 280)}" fill="none" stroke="#FFF5DE" stroke-width="3" opacity=".45"/>
        <path d="${arc(812, 842, 207, 220, 296)}" fill="none" stroke="#FFF5FF" stroke-width="3" opacity=".6"/>
        ${text('Dövr', 268, 1103, 24, ink, { anchor: 'middle' })}
        ${text('Hamiləlik', 540, 1103, 24, ink, { anchor: 'middle' })}
        ${text('Analıq', 812, 1103, 24, ink, { anchor: 'middle' })}
      </g>`,
  };
}

function rhythm(id, height) {
  const ink = '#FFF5E7', muted = '#CEBED8', offset = (height - SOCIAL_HEIGHT) / 2;
  const ticks = Array.from({ length: 28 }, (_, index) => {
    const a = index * Math.PI * 2 / 28;
    return line(672 + Math.cos(a) * 278, 849 + Math.sin(a) * 278, 672 + Math.cos(a) * 287, 849 + Math.sin(a) * 287, '#E1D3F0', 2, 0.36);
  }).join('');
  return { background: '#282230', ink, muted, headerAccent: '#DBC2F3',
    art: `${circle(1120, 223, 255, '#342A3B')}
      ${text('DÖVR TƏQVİMİ', 79, 178, 16, '#CBADDE', { tracking: 3 })}
      ${text(['Həyatın', 'öz ritmi var.'], 72, 294, 114, ink, { tracking: -4.6, leading: 121 })}
      ${text(['Aybaşı günlərini və əhvalını qeyd et.', 'Öz ritmini daha yaxından tanı.'], 80, 485, 25, muted, { weight: 400, leading: 38 })}
      <g transform="translate(0 ${offset - 24})">
        ${circle(672, 849, 303, '#342D41')}${ticks}
        ${circle(672, 849, 236, 'none', 'stroke="#50405E" stroke-width="53"')}
        <path d="${arc(672, 849, 236, -104, 115)}" fill="none" stroke="url(#${id}-lilac)" stroke-width="53" stroke-linecap="round"/>
        <path d="${arc(672, 849, 236, 139, 191)}" fill="none" stroke="#FFB2A2" stroke-width="53" stroke-linecap="round"/>
        <path d="${arc(672, 849, 236, 215, 235)}" fill="none" stroke="#EACA7C" stroke-width="53" stroke-linecap="round"/>
        ${circle(672, 849, 166, '#2C2535')}
        ${text('öz', 672, 839, 62, '#E5D2F3', { anchor: 'middle', tracking: -2 })}
        ${text('ritmin', 672, 922, 73, ink, { anchor: 'middle', tracking: -3 })}
        ${circle(88, 701, 5, '#D1B3E9')}${text('Qeyd et.', 78, 748, 31, ink, { tracking: -0.6 })}
        ${circle(88, 850, 5, '#FFB2A2')}${text('İzlə.', 78, 897, 31, ink, { tracking: -0.6 })}
        ${circle(88, 999, 5, '#EACA7C')}${text(['Özünü', 'tanı.'], 78, 1046, 31, ink, { tracking: -0.6, leading: 38 })}
        ${star(950, 615, 26, '#EFD491')}
      </g>`,
  };
}

function beginning(id, height) {
  const ink = '#37463C', muted = '#768273', offset = (height - SOCIAL_HEIGHT) / 2;
  return { background: '#F5F1E4', ink, muted, headerAccent: '#5F7659',
    art: `${circle(1113, 71, 214, '#E4E8D2')}
      ${text('HAMİLƏLİK GÜNDƏLİYİ', 79, 178, 16, '#738569', { tracking: 2.5 })}
      ${text(['Yeni bir', 'hekayə başlayır.'], 73, 291, 104, ink, { tracking: -4.5, leading: 117 })}
      ${text(['Həftələri izlə, qeydlərini topla,', 'vacib anları yadda saxla.'], 80, 480, 26, muted, { weight: 400, leading: 39 })}
      <g transform="translate(0 ${offset})">
        ${circle(837, 722, 173, '#F4C56B')}
        ${circle(837, 722, 208, 'none', 'stroke="#E6BF79" stroke-opacity=".38" stroke-width="1.2"')}
        ${circle(837, 722, 237, 'none', 'stroke="#E6BF79" stroke-opacity=".22" stroke-width="1.2"')}
        <g transform="rotate(-8 524 858)">
          ${rect(172, 659, 704, 406, '#C6D2B4', 20)}
          ${rect(158, 647, 704, 406, '#E5E9D7', 20)}
          ${rect(144, 633, 704, 406, '#FFFEF6', 20, `filter="url(#${id}-shadow)"`)}
          ${rect(144, 633, 20, 406, '#D3DCC5', 0)}
          ${text('BU HƏFTƏ', 207, 696, 16, '#8B966C', { tracking: 3 })}
          ${text('Özünə vaxt ayır.', 204, 771, 43, ink, { tracking: -1.6 })}
          ${text('Kiçik qeydlər, dəyərli xatirələr.', 208, 815, 21, muted, { weight: 400 })}
          ${line(207, 842, 788, 842, ink, 1, .15)}
          ${[893, 941, 989].map((y, index) => `${rect(209, y - 19, 20, 20, '#E6ECD9', 6)}<path d="M214 ${y - 9}l4 4 7-8" fill="none" stroke="#708760" stroke-width="2" stroke-linecap="round"/>${text(['Həftəlik məlumatlar', 'Şəxsi qeydlər', 'Vacib xatırlatmalar'][index], 246, y, 22, ink, { weight: 400 })}`).join('')}
          ${text(['Hər həftə', 'yanındayıq.'], 779, 940, 22, '#84936B', { anchor: 'end', leading: 32 })}
          ${star(749, 867, 14, '#CB9A42')}
        </g>
        ${star(114, 1053, 21, '#9AA983')}
      </g>`,
  };
}

function memories(id, height) {
  const ink = '#253E59', muted = '#637D93', offset = (height - SOCIAL_HEIGHT) / 2;
  return { background: '#E6F0FB', ink, muted, headerAccent: '#506F8F',
    art: `${circle(1031, 24, 230, '#D6E6FA')}
      ${text('KÖRPƏ QULLUĞU VƏ GÜNDƏLİK', 79, 178, 16, '#6581A2', { tracking: 2.2 })}
      ${text(['Böyük sevgi.', 'Kiçik anlar.'], 72, 295, 112, ink, { tracking: -4.8, leading: 119 })}
      ${text(['Körpənin yuxusunu, qidalanmasını', 'və inkişafını bir yerdə izlə.'], 80, 484, 26, muted, { weight: 400, leading: 39 })}
      <g transform="translate(0 ${offset})">
        ${rect(76, 598, 452, 240, '#C3D5F1', 37)}${rect(552, 598, 452, 240, '#FFF8E8', 37)}
        ${rect(76, 858, 452, 240, '#F9CFC6', 37)}${rect(552, 858, 452, 240, '#D6D8F0', 37)}
        <path d="M405 629A68 68 0 1 0 430 747A59 59 0 0 1 405 629Z" fill="#5B78A7" filter="url(#${id}-shadow)"/>
        ${star(332, 653, 10, '#FFF8EE')}${star(468, 674, 7, '#FFFFFF')}
        ${text('Yuxu', 111, 798, 29, ink, { tracking: -.7 })}
        <path d="M862 629C862 629 802 694 802 727A60 60 0 0 0 922 727C922 694 862 629Z" fill="url(#${id}-coral)" filter="url(#${id}-shadow)"/>
        <path d="M832 724Q828 746 849 757" fill="none" stroke="#FFF9E8" stroke-opacity=".8" stroke-width="5" stroke-linecap="round"/>
        ${text('Qidalanma', 587, 798, 29, ink, { tracking: -.7 })}
        ${rect(299, 972, 33, 49, '#CD6672', 13)}${rect(349, 941, 33, 80, '#CE7787', 13)}${rect(399, 905, 33, 116, '#B2607C', 13)}
        ${line(287, 1035, 446, 1035, '#9B6675', 1.2, .55)}
        ${text('İnkişaf', 111, 1060, 29, ink, { tracking: -.7 })}
        <g transform="rotate(9 855 965)" filter="url(#${id}-shadow)">
          ${rect(786, 889, 137, 137, '#F8F6FE', 15)}${rect(799, 903, 111, 91, '#B9BDDF', 7)}
          ${circle(878, 926, 13, '#FDE5B7')}
          <path d="M799 975l37-40 28 34 17-19 29 29v15H799Z" fill="#777FAA"/>
          ${line(820, 1010, 889, 1010, '#D0D0E0', 4, 1)}
        </g>
        ${text('Xatirələr', 587, 1060, 29, ink, { tracking: -.7 })}
      </g>`,
  };
}

function together(id, height) {
  const ink = '#F7F2E0', muted = '#B4D2C7', offset = (height - SOCIAL_HEIGHT) / 2;
  return { background: '#193F38', ink, muted, headerAccent: '#D1E3CA',
    art: `${circle(1097, 130, 235, '#224B41')}
      ${text('BİRGƏ QAYĞI', 79, 178, 16, '#BED7BC', { tracking: 3 })}
      ${text(['Qayğı', 'paylaşdıqca', 'böyüyür.'], 72, 278, 100, ink, { tracking: -3.8, leading: 115 })}
      ${text(['Xatırlatmalar, planlar və gündəlik qeydlər.', 'Qayğını sevdiyin insanla bölüş.'], 80, 561, 25, muted, { weight: 400, leading: 38 })}
      <g transform="translate(0 ${offset})">
        <ellipse cx="542" cy="1014" rx="365" ry="36" fill="#091E1A" opacity=".35" filter="url(#${id}-soft)"/>
        <g filter="url(#${id}-shadow)">
          <rect x="149" y="756" width="439" height="237" rx="118.5" fill="none" stroke="url(#${id}-coral)" stroke-width="81" transform="rotate(-28 368 875)"/>
          <rect x="491" y="756" width="439" height="237" rx="118.5" fill="none" stroke="url(#${id}-sage)" stroke-width="81" transform="rotate(28 710 875)"/>
        </g>
        <g clip-path="url(#${id}-weave)"><rect x="149" y="756" width="439" height="237" rx="118.5" fill="none" stroke="url(#${id}-coral)" stroke-width="81" transform="rotate(-28 368 875)"/></g>
        ${star(139, 728, 18, '#D2E4CA')}${star(950, 1025, 15, '#F6B5A4')}
        ${text('BİRLİKDƏ DAHA YAXIN', 540, 1104, 17, '#C5DACA', { tracking: 3.6, anchor: 'middle' })}
      </g>`,
  };
}

function community(id, height) {
  const ink = '#493339', muted = '#866E60', offset = (height - SOCIAL_HEIGHT) / 2;
  return { background: '#FFF0BE', ink, muted, headerAccent: '#94665E',
    art: `${circle(1060, 60, 208, '#FFE6A5')}
      ${text('SƏNİ ANLAYAN BİR CƏMİYYƏT', 79, 178, 16, '#A2735C', { tracking: 2.2 })}
      ${text(['Danışmaq da', 'qayğıdır.'], 72, 295, 110, ink, { tracking: -4.6, leading: 119 })}
      ${text(['Sual ver, təcrübəni bölüş,', 'səni anlayan insanlarla bir araya gəl.'], 80, 484, 26, muted, { weight: 400, leading: 39 })}
      <g transform="translate(0 ${offset})">
        <path d="M191 611H880Q932 611 932 663V837Q932 889 880 889H373L279 955L284 889H191Q139 889 139 837V663Q139 611 191 611Z" fill="#F4B3A3" filter="url(#${id}-shadow)"/>
        ${text('BİR SÖHBƏTƏ YER AÇ', 207, 679, 15, '#9B5755', { tracking: 2.8 })}
        ${text(['Səni anlayan', 'bir söhbətə qoşul.'], 201, 762, 49, '#663E43', { tracking: -1.7, leading: 65 })}
        <path d="M491 936H932Q971 936 971 975V1045Q971 1084 932 1084H898L908 1119L850 1084H491Q452 1084 452 1045V975Q452 936 491 936Z" fill="#49333F" filter="url(#${id}-shadow)"/>
        ${text(['Sual ver.', 'Təcrübəni bölüş.'], 488, 993, 29, '#FFF4DE', { tracking: -.4, leading: 42 })}
        ${star(165, 1065, 32, '#D78C75')}${circle(253, 1045, 8, '#DBB174')}
      </g>`,
  };
}

export const FLYERS = [
  { id: '01-her-merhelede', name: 'Hər mərhələdə səninlə', note: 'İsti mərcan tonları və birləşən halqalar', draw: life },
  { id: '02-oz-ritmin', name: 'Həyatın öz ritmi var', note: 'Tünd gavalı rəngi və zərif ritm dairəsi', draw: rhythm },
  { id: '03-yeni-hekaye', name: 'Yeni bir hekayə başlayır', note: 'Kağız qatları, adaçayı və günəş tonları', draw: beginning },
  { id: '04-kicik-anlar', name: 'Böyük sevgi. Kiçik anlar', note: 'Səma rəngləri və yumşaq həndəsi formalar', draw: memories },
  { id: '05-birge-qaygi', name: 'Qayğı paylaşdıqca böyüyür', note: 'Dərin yaşıl fon və birləşən lentlər', draw: together },
  { id: '06-sohbet-de-qaygidir', name: 'Danışmaq da qayğıdır', note: 'İsti sarı fon və rəngli söhbət formaları', draw: community },
];

export function makeFlyer(flyer, { height = SOCIAL_HEIGHT, fonts, qr }) {
  const id = `f${flyer.id.slice(0, 2)}`, composition = flyer.draw(id, height);
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}" role="img" aria-labelledby="${id}-title ${id}-description" xml:lang="az" lang="az" data-poster="${flyer.id}">
    <title id="${id}-title">Anacan — ${esc(flyer.name)}</title>
    <desc id="${id}-description">${esc(flyer.note)}. Tam Azərbaycan dilində, insan və personaj təsviri olmayan flayer.</desc>
    ${commonDefs(id, fonts, composition.ink)}
    ${rect(0, 0, WIDTH, height, composition.background)}
    ${rect(0, 0, WIDTH, height, `url(#${id}-paper)`)}
    ${composition.art}
    ${header(composition.ink, composition.headerAccent)}
    ${footer(height, composition.ink, composition.muted, qr)}
  </svg>`;
}
