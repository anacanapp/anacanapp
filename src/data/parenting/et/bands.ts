import type { BandOverview } from '../types';
import { S } from './sources';

export const BANDS: BandOverview[] = [
  {
    id: '0-1',
    emoji: '👶',
    title: 'Esimene aasta: usalduse vundament',
    lead: 'Sel aastal õpib beebi, kas maailm on turvaline. Vastuse saab ta sinu häälest, sinu sülest ja sellest, kuidas sa talle reageerid.',
    brain: [
      'Esimestel eluaastatel tekib ajus üle miljoni uue närviühenduse sekundis. Seda, millised rajad tugevnevad, otsustab korduv igapäevane kogemus: beebi teeb häält, sina vastad; ta nutab, sina tuled tema juurde.',
      'Beebi aju osa, mis rahustab, on alles väga noor. Seepärast ei oska beebi veel ise rahuneda, vaid „laenab“ rahu sinu rahulikust kehast. Seda nimetatakse kaasregulatsiooniks ja see on tulevase eneseregulatsiooni esimene õppetund.',
      'Umbes 6–9 kuu vanuses tugevnevad mälu ja kiindumus: beebi võib hakata võõraid pelgama ja muretsema, kui sa toast lahkud. See ei ole tagasiminek, vaid märk sellest, et ta on sinuga kiindunud.',
    ],
    needs: [
      'Vastust nutule. Selles eas ei saa beebit „sülega ära harjutada“ ega ära hellitada. Kiire ja soe vastus õpetab teda maailma usaldama.',
      'Näost näkku suhtlemist: naeratus, laul, tema häälitsuste kordamine. Need „serv ja vastus“ mängud loovad keele- ja emotsiooniaju aluse.',
      'Etteaimatavat päeva: söök, uni ja vannitamine enam-vähem samas järjekorras. Oluline pole täpne kellaaeg, vaid tuttav rütm.',
      'Turvalist und ja turvalist keskkonda ning lisaks puhanud, toetatud vanemat.',
    ],
    normal: [
      'Pikad, justkui põhjuseta nutuhood teatud kellaaegadel, eriti õhtupoolikul (esimesel 3–4 kuul).',
      'Sage öine ärkamine. Esimesel eluaastal ei ole terve öö läbi magamine iga beebi jaoks norm.',
      'Kõige suhu panemine: nii ta maailma tundma õpibki.',
      'Võõraste kartmine ja nutmine, kui sind pole (umbes 8 kuu vanusest).',
    ],
    tryThis: [
      'Mitu korda päevas 5-minutiline „näost näkku aeg“: telefon kõrvale, korda beebi häälitsusi ja ütle sõnadega, mida ta teeb.',
      'Räägi igapäevatoimetuste ajal: „Nüüd vahetame mähkme. Tõstame jala üles. Valmis!“',
      'Mängi peitust ja „kukuu“: selle mänguga õpib laps, et ära läinu tuleb tagasi, ja eraldumishirm leebub.',
      'Kui nutt venib ja kannatus on otsas, pane beebi turvalisse kohta — võrevoodisse —, hinga paar minutit ja tule siis tagasi.',
    ],
    specialist: [
      'Kui beebi ei reageeri helidele, ei loo sinuga silmsidet, ei naerata 4 kuu vanuselt või ei reageeri 9 kuu vanuselt oma nimele.',
      'Kui ta kaotab oskuse, mis tal varem oli (naeratamine, häälitsemine, istumine).',
      'Kui nutt on tavapärasest erinev ning sellega kaasneb palavik, oksendamine, loidus või söömisest keeldumine: pöördu arsti poole. Tõsise olukorra korral {emergency}.',
      'Kui tunned ise nädalate kaupa kurbust, lootusetust või hirmu beebile haiget teha: see võib olla sünnitusjärgne depressioon ja seda saab ravida. Räägi arstile.',
    ],
    sources: [S.harvardServe, S.nurturingCare2018, S.ainsworth1978, S.healthyChildrenCrying, S.zubler2022],
  },
  {
    id: '1-3',
    emoji: '🧸',
    title: '1–3 aastat: „Ma ise!“ periood',
    lead: 'Laps juba kõnnib, hakkab rääkima ja tahab olla iseseisev, kuid tunnetega toime tulev aju on alles väga noor. Sellest tulevadki jonnihood.',
    brain: [
      'Aju emotsioonikeskus (mandelkeha) on tugev ja kiire, seda „pidurdav“ otsmikusagara koor aga areneb veel palju aastaid. Seepärast ei suuda kaheaastane peatuda, isegi kui ta ise ütleb „stopp“. See pole jonnakus, vaid välja arenemata pidur.',
      'Keel areneb kiiresti, kuid see, mida laps mõistab, on kaugel ees sellest, mida ta oskab öelda. Kui ei suuda öelda, mida tahad, tekitab see suurt frustratsiooni, mis tuleb sageli välja karjumise või löömisena.',
      'Selles eas õpib laps põhjust ja tagajärge katsetades: viskab lusika maha, vaatab sinu reaktsiooni, viskab uuesti. See ei ole „sinu närvi ajamine“, vaid väikese teadlase katse.',
    ],
    needs: [
      'Rahulikke, selgeid ja korduvaid piire: „Lüüa ei tohi. Ma hoian su käsi kinni.“ Mitte pikk selgitus, vaid lühike lause ja tegu.',
      'Valikuvõimalust: „Punane särk või sinine?“ Valik rahuldab iseseisvusvajadust ja vähendab vajadust öelda „ei“.',
      'Tunnete nimetamist: „Sa said vihaseks, sest mäng sai läbi.“ Nimetatud tunne vaibub kiiremini.',
      'Iga päev paar minutit mängu, mida juhib tema, palju liikumist ja värsket õhku.',
    ],
    normal: [
      'Mitu jonnihoogu päevas, eriti väsinuna, näljasena või ühelt tegevuselt teisele üleminekul.',
      'Sõna „Ei!“ sage kasutamine ja sama asja ikka ja jälle küsimine.',
      'Jagamise oskamatus. Päris jagamine kujuneb välja umbes 3–4 aasta vanuses.',
      'Aeg-ajalt hammustamine või löömine: füüsiline agressioon on selles eas haripunktis ja väheneb siis järk-järgult.',
    ],
    tryThis: [
      'Hoiata 5 minutit enne üleminekut: „Veel kaks korda liumäest alla ja siis läheme koju.“',
      'Ütle „ei“ asemel, mida teha võib: „Mitte seinale, joonista sellele paberile.“',
      '10 minutit päevas „tema mängu“: mida tema teeb, seda teed sina ka, ilma kriitikata ja küsimustetulvata.',
      'Märka päeva jooksul head käitumist ja nimeta see täpselt: „Sa andsid mänguasja vennale, vaata, kui rõõmus ta oli!“',
    ],
    specialist: [
      'Kui 18 kuu vanuselt puudub näitamine (sõrmega osutamine), 2-aastaselt kahesõnalised laused, kui ta ei reageeri oma nimele või silmsidet on väga vähe.',
      'Kui ta kaotab varem öeldud sõnu või oskusi (mis tahes vanuses).',
      'Kui jonnihood kestavad üle 25 minuti, neid on rohkem kui 5 päevas, laps vigastab tõsiselt ennast või teisi või need ei vähene ka pärast 4. eluaastat.',
      'Kui une-, söömis- või käitumisraskused häirivad pere igapäevaelu kuude kaupa.',
    ],
    sources: [S.harvardEF2011, S.healthyChildrenTantrums, S.cdcPositive, S.tremblay2004, S.zubler2022],
  },
  {
    id: '3-6',
    emoji: '🎨',
    title: '3–6 aastat: fantaasia, küsimused ja reeglid',
    lead: 'Laps küsib „miks?“, mängib rollimänge ja õpib sõprust. Enesekontroll kasvab kiiresti, kuid ta vajab endiselt sinu tuge.',
    brain: [
      'Täidesaatvad funktsioonid — tähelepanu hoidmine, järjekorra ootamine, reegli meeles pidamine, mõtte ümberlülitamine — arenevad 3. ja 5. eluaasta vahel kiiresti. Rollimängud ja reeglitega mängud on nende oskuste parim treening.',
      'Laps hakkab mõistma, et teine võib mõelda teisiti. Seepärast ilmuvad selles eas esimesed valed. Huvitaval kombel on see vaimse arengu märk.',
      'Kujutlusvõime tugevneb ja piir päriselu ja väljamõeldise vahel on veel hägune. Pimeduse-, koletiste- ja unenäohirm on selle ea tüüpilised hirmud.',
    ],
    needs: [
      'Selgeid, vähearvulisi pere reegleid ja nende järjepidevat rakendamist. Mida etteaimatavamad on reeglid, seda vähem on vaidlusi.',
      'Loogilisi tagajärgi, mitte karistust: „Kui viskad palli toas, läheb pall kappi.“',
      'Juttu tunnetest: raamatud, mängud mänguasjadega, küsimused „kuidas sina end tunneksid?“.',
      'Päris väikseid kohustusi: laua katmine, mänguasjade koristamine, taime kastmine.',
    ],
    normal: [
      'Aeg-ajalt valetamine, fantaasia ja tegelikkuse segiajamine.',
      'Reeglite proovile panemine ja tugev reaktsioon „ebaõiglusele“.',
      'Pimeduse või uute olukordade kartmine.',
      'Endiselt aeg-ajalt jonnihood, kuid lühemad ja harvemad kui varem.',
    ],
    tryThis: [
      'Küsi kord päevas „mis oli täna kõige parem ja mis kõige raskem hetk?“ ja kuula tähelepanelikult.',
      'Joonistage reeglid koos piltidena ja riputage seinale.',
      'Harjutage enesepidurdust mängudega nagu „Punane tuli, roheline tuli“ või „Simon ütleb“.',
      'Kui midagi läheb valesti, leidke lahendus koos: „Vesi läks maha. Mida me teeme?“',
    ],
    specialist: [
      'Kui 4-aastane ei moodusta lauseid, võõrad mõistavad tema kõnet vaevaliselt või teda ei huvita mängukaaslased üldse.',
      'Kui hirmud või ärevus häirivad igapäevaelu (lasteaed, uni, söömine) nädalate kaupa.',
      'Kui agressioon teeb teistele tõsiselt haiget või süveneb; kui esineb julmust loomade vastu.',
      'Kui laps hakkab pärast pikka kuiva perioodi uuesti päeval püksi tegema või kaotab varasemaid oskusi.',
    ],
    sources: [S.diamond2013, S.harvardEF2011, S.talwarLee2008, S.cdcPositive, S.zubler2022],
  },
  {
    id: '6-12',
    emoji: '🎒',
    title: '6–12 aastat: oskused, sõprus, enesekindlus',
    lead: 'Kooliaastad on aeg, mil laps ehitab üles tunde „ma oskan“. Sõbrad muutuvad oluliseks, kuid sina oled endiselt tema peamine tugi.',
    brain: [
      'Planeerimise, tähelepanu ja enesekontrolli oskused on juba hästi arenenud, kuid väsimus, nälg ja stress „lülitavad need kergesti välja“. Pärast kooli närviline laps on sageli lihtsalt kurnatud laps.',
      'Laps hakkab end teistega võrdlema. Selles eas toitub enesehinnang peamiselt pingutusest, oskuste omandamisest ja aktsepteeritud olemisest.',
      'Teismeea lähenedes (umbes 9–12 aastaselt) võivad alata hormonaalsed muutused: meeleolukõikumised ja suurem vajadus isikliku ruumi järele on normaalsed.',
    ],
    needs: [
      'Julgustust, mis märkab pingutust ja strateegiat: „Sa nägid selle ülesandega palju vaeva ja proovisid teist lähenemist.“',
      'Järk-järgult kasvavat vastutust ja valikuõigust koos selgete pere reeglitega.',
      'Vanemat, kes kuulab hinnanguid andmata. Kui kuulad väikseid asju, räägib ta sulle ka suuri.',
      'Vaba aega väljaspool ekraani ja kodutöid: mäng, sport, sõbrad, uni.',
    ],
    normal: [
      'Pikad vaidlused õigluse üle, soov reegleid läbi rääkida.',
      'Sõprussuhetes tülid ja leppimised, kurbus teemal „mind ei võetud mängu“.',
      'Kodutööde vältimine, unustamine.',
      'Aeg-ajalt vanemate pärast häbenemine või soov rohkem omaette olla (eriti pärast 10. eluaastat).',
    ],
    tryThis: [
      'Autos, söögilauas või enne magamaminekut „ülekuulamiseta jutu“ aeg: räägi ka ise oma päevast.',
      'Kodutöödeks kindel aeg ja koht, kuid ära tee ülesandeid tema eest.',
      'Kirjutage koos pere ekraaniplaan: kus, millal ja kui palju.',
      'Kord nädalas kahekesi aeg: ainult sina ja tema, tegevus tema valikul.',
    ],
    specialist: [
      'Üle kahe nädala kestev kurbus, huvi kadumine, suur muutus unes või söögiisus.',
      'Visa keeldumine kooli minemast, sagedased kõhu- ja peavalukaebused (kui arst põhjust ei leia).',
      'Kiusamise ohvriks langemise või teiste kiusamise märgid; täielik eemaldumine sõpradest.',
      'Enesevigastamine, surmast või enesetapust rääkimine: ära pea seda kunagi „tähelepanu otsimiseks“. Pöördu kohe spetsialisti poole, ohu korral {emergency}.',
    ],
    sources: [S.cdcPositive, S.aapMediaSchool2016, S.pomerantz2007, S.muellerDweck1998, S.unesco2019],
  },
];
