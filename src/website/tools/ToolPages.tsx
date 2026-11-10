import type { ToolPage } from './tool-routes';
import { NameDetailPage, NamesGenderPage, NamesHubPage, NamesLetterPage } from './NamesPages';
import DekretPage from './DekretPage';
import { PregnancyWeekPage, PregnancyWeeksHubPage } from '../pregnancy-weeks/PregnancyWeekPages';

export default function ToolPageView({ kind }: { kind: ToolPage }) {
  return kind === 'names' ? <NamesHubPage/> : kind === 'namesGender' ? <NamesGenderPage/> : kind === 'namesLetter' ? <NamesLetterPage/>
    : kind === 'nameDetail' ? <NameDetailPage/> : kind === 'pregnancyWeeks' ? <PregnancyWeeksHubPage/> : kind === 'pregnancyWeek' ? <PregnancyWeekPage/> : <DekretPage/>;
}
