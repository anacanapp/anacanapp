import {useWebsite} from './context';
export const CHARACTERS={cycle:'ritm',pregnancy:'tumurcuq',motherhood:'qucaq'} as const;
export function Character({kind,pose='welcome',className='',priority=false}:{kind:keyof typeof CHARACTERS;pose?:'welcome'|'value'|'data'|'privacy'|'success';className?:string;priority?:boolean}) {
  const {t}=useWebsite();
  return <img className={`site-character ${className}`} src={`/website/characters/${CHARACTERS[kind]}-${pose}.webp`} alt={`${t(`${kind}Label`)} — ${CHARACTERS[kind]==='ritm'?'Ritm':CHARACTERS[kind]==='tumurcuq'?'Tumurcuq':'Qucaq'}`} width="512" height="512" decoding="async" loading={priority?'eager':'lazy'}/>;
}
export function CharacterFamily({className=''}:{className?:string}) {
  return <div className={`site-character-family ${className}`}><Character kind="cycle" priority/><Character kind="pregnancy" priority/><Character kind="motherhood" priority/></div>;
}
