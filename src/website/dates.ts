import labels from './date-labels.json';
import type {AppLanguageCode} from '../lib/app-languages';
export function siteDate(value:string,language:AppLanguageCode):string {
  const date=new Date(value),day=date.getUTCDate(),month=date.getUTCMonth(),year=date.getUTCFullYear();
  if(language==='zh'||language==='ja')return `${year}年${month+1}月${day}日`;
  if(language==='ko')return `${year}년 ${month+1}월 ${day}일`;
  return `${day} ${labels[language].months[month]} ${year}`;
}
export function siteMonth(date:Date,language:AppLanguageCode):string {
  return `${labels[language].months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}
export function siteWeekdays(language:AppLanguageCode):string[] {return labels[language].weekdays;}
