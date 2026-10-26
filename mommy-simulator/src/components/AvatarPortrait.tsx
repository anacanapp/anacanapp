import { useId } from 'react';
import type { Avatar } from '../game/types';

export function AvatarPortrait({ avatar, baby = false, small = false }: { avatar: Avatar; baby?: boolean; small?: boolean }) {
  const uid = useId().replace(/:/g, '');
  return <svg viewBox="0 0 240 270" role="img" aria-label={avatar.name} className={`avatar-portrait ${small ? 'small' : ''}`}>
    <defs>
      <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#ede1f1" /><stop offset="1" stopColor="#e6dce9" /></linearGradient>
      <linearGradient id={`${uid}-dress`} x1="0" y1="0" x2=".9" y2="1"><stop stopColor={avatar.outfit} /><stop offset="1" stopColor={avatar.outfit} stopOpacity=".7" /></linearGradient>
    </defs>
    <rect x="0" y="0" width="240" height="270" rx="55" fill={`url(#${uid}-bg)`} />
    <circle cx="42" cy="51" r="4" fill="#fff5db" /><path d="m196 67 3 7 8 3-8 3-3 8-3-8-8-3 8-3 3-7Z" fill="#fff1cc" />
    <path d="M31 240c0-44 34-78 89-78s89 34 89 78" fill={`url(#${uid}-dress)`} />
    <path d="M77 188c-20 11-28 30-29 52m115-52c20 11 28 30 29 52" stroke={avatar.outfit} strokeWidth="21" strokeLinecap="round" />
    <path d="M103 150h34v29c-2 18-32 18-34 0Z" fill={avatar.skin} />
    {avatar.hairstyle === 'long' && <path d="M54 95c0-49 35-71 69-71s70 23 70 70l-4 111-47-17H83l-28 17Z" fill={avatar.hair} />}
    {avatar.hairstyle === 'bun' && <><circle cx="121" cy="37" r="25" fill={avatar.hair} /><path d="M98 39c10-6 29-6 45 1" stroke="#e2bdab" strokeWidth="5" strokeLinecap="round" /></>}
    <path d="M61 90c0-46 27-64 60-64s61 20 61 64l-9 59H69Z" fill={avatar.hair} />
    {avatar.hairstyle === 'bob' && <path d="M60 88c-8 35-5 64 8 85l32-13h42l35 13c15-18 14-60 2-88Z" fill={avatar.hair} />}
    <ellipse cx="64" cy="110" rx="9" ry="14" fill={avatar.skin} /><ellipse cx="178" cy="110" rx="9" ry="14" fill={avatar.skin} />
    <path d="M66 93c0-36 26-49 54-49s56 19 56 51v24c0 32-26 52-56 52s-54-22-54-52Z" fill={avatar.skin} />
    <path d="M65 96c9-9 17-26 20-42 13 18 40 15 66 4l25 37c5-37-18-62-54-62S60 51 65 96Z" fill={avatar.hair} />
    <path d="M88 101c5-3 13-3 18-1m30 0c5-2 13-2 17 1" stroke={avatar.hair} strokeWidth="4" strokeLinecap="round" />
    <ellipse cx="98" cy="115" rx="5" ry="7" fill="#493429" /><ellipse cx="144" cy="115" rx="5" ry="7" fill="#493429" />
    <circle cx="96.5" cy="112.5" r="1.5" fill="white" /><circle cx="142.5" cy="112.5" r="1.5" fill="white" />
    <ellipse cx="83" cy="133" rx="9" ry="5" fill="#dc8e86" opacity=".45" /><ellipse cx="159" cy="133" rx="9" ry="5" fill="#dc8e86" opacity=".45" />
    <path d="M119 120v7h5" stroke="#bc886c" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    <path d="M108 141c8 8 18 8 26 0" stroke="#ab6459" strokeWidth="3" fill="none" strokeLinecap="round" />
    <circle cx="64" cy="127" r="4" fill="#e9cd8b" /><circle cx="178" cy="127" r="4" fill="#e9cd8b" />
    {baby ? <g transform="translate(53 181) rotate(-12 67 42)"><rect x="20" y="29" width="96" height="57" rx="28" fill="#f5e4cb" /><circle cx="37" cy="36" r="23" fill={avatar.skin} /><path d="M16 26c5-23 33-24 44-7v14H16Z" fill="#e7c1cf" /><path d="M26 38h7m8 0h7" stroke="#8e6150" strokeWidth="2" strokeLinecap="round" /><path d="M32 48c3 2 6 2 9 0" stroke="#ab7465" strokeWidth="2" strokeLinecap="round" /></g>
      : <><ellipse cx="120" cy="236" rx="51" ry="36" fill={avatar.outfit} /><path d="M74 218c11 14 25 20 36 22m56-22c-11 14-25 20-36 22" stroke={avatar.skin} strokeWidth="12" fill="none" strokeLinecap="round" /><path d="M116 226c-6-7-17 1-8 9l12 12 12-12c9-8-2-16-8-9l-4 5Z" fill="#f7ddb0" /></>}
  </svg>;
}
