import type { WebsiteBoot } from './model';
import { WebsiteContext } from './context';
import { LanguageLinks, WebsiteFooter, WebsiteHeader } from './components';
import Home from './Home';
import Journal, { ArticlePage } from './Journal';
import CalculatorPage from './CalculatorPages';
import { ContactPage, DownloadPage, FaqPage, FeaturesPage, LegalPage, NotFoundPage, SimulatorPage, SymptomsPage, ToolsPage } from './Pages';
import DetailPageView from './DetailPage';
import {DETAIL_PAGES,type DetailPage} from './routes';

export default function Website({boot}:{boot:WebsiteBoot}) {
  const page=boot.route.kind;
  return <WebsiteContext.Provider value={boot}><div className="anacan-website" lang={boot.route.language} dir={boot.route.language==='ar'?'rtl':'ltr'}><WebsiteHeader/><main id="main" className={`site-main site-page-${page}`}>
    {(DETAIL_PAGES as readonly string[]).includes(page)?<DetailPageView kind={page as DetailPage}/>:page==='home'?<Home/>:page==='journal'?<Journal/>:page==='article'?<ArticlePage/>:page==='ovulation'||page==='dueDate'?<CalculatorPage kind={page}/>:page==='tools'?<ToolsPage/>:page==='features'?<FeaturesPage/>:page==='faq'?<FaqPage/>:page==='contact'?<ContactPage/>:page==='download'?<DownloadPage/>:page==='privacy'||page==='terms'?<LegalPage kind={page}/>:page==='symptoms'?<SymptomsPage/>:page==='simulator'?<SimulatorPage/>:<NotFoundPage/>}
    <LanguageLinks/>
  </main><WebsiteFooter/></div></WebsiteContext.Provider>;
}
