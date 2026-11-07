import type { BandOverview } from '../types';
import { S } from './sources';

export const BANDS: BandOverview[] = [
  {
    id: '0-1',
    emoji: '👶',
    title: 'Första året: en grund av trygghet',
    lead: 'Under det här året lär sig bebisen om världen är en trygg plats. Svaret får hen från din röst, din famn och hur du svarar på hen.',
    brain: [
      'Under de första levnadsåren bildas mer än en miljon nya nervförbindelser i hjärnan varje sekund. Vilka banor som förstärks avgörs av upprepade vardagliga erfarenheter: bebisen jollrar, du svarar; hen gråter, du kommer närmare.',
      'Den del av hjärnan som hjälper bebisen att lugna sig är fortfarande mycket omogen. Därför kan bebisen inte lugna sig själv ännu utan ”lånar” lugnet från din kropp. Det kallas samreglering, och det är den allra första lektionen i självreglering.',
      'Runt 6–9 månader blir minnet och anknytningen starkare: bebisen kan börja bli främlingsrädd och oroa sig när du går ut ur rummet. Det är ingen tillbakagång, tvärtom: det är ett tecken på att hen har knutit an till dig.',
    ],
    needs: [
      'Att gråten besvaras. I den här åldern går det inte att ”skämma bort” en bebis eller göra den ”van vid att bäras”. Snabb och kärleksfull respons lär hen att lita på världen.',
      'Kontakt ansikte mot ansikte: le, sjung, härma hens ljud. De här turtagningslekarna lägger grunden för språket och den känslomässiga utvecklingen.',
      'En förutsägbar dag: mat, sömn och bad i ungefär samma ordning. Det är inte klockslaget som räknas utan en välbekant rytm.',
      'Säker sömn och en säker miljö, och en utvilad förälder som själv får stöd.',
    ],
    normal: [
      'Långa gråtstunder vid vissa tider på dagen, särskilt sent på eftermiddagen och kvällen, som verkar sakna orsak (under de första 3–4 månaderna).',
      'Att vakna ofta på natten. Att sova hela natten under första året är inte normen för alla bebisar.',
      'Att stoppa allt i munnen: det är så hen utforskar världen.',
      'Främlingsrädsla och gråt när du inte är där (ungefär från 8 månader).',
    ],
    tryThis: [
      'Några gånger om dagen, 5 minuters ”ansikte mot ansikte-tid”: lägg undan mobilen, härma bebisens ljud och sätt ord på det hen gör.',
      'Prata medan du sköter vardagssysslorna: ”Nu byter vi blöja. Upp med benen. Klart!”',
      'Lek tittut: genom leken lär sig barnet att ”den som går kommer tillbaka”, och separationsrädslan mildras.',
      'När gråten håller på länge och tålamodet tar slut: lägg bebisen på en säker plats — i spjälsängen — andas några minuter och gå sedan tillbaka.',
    ],
    specialist: [
      'Om bebisen inte reagerar på ljud, inte söker ögonkontakt med dig, inte ler vid 4 månader eller inte reagerar på sitt namn vid 9 månader.',
      'Om hen tappar en förmåga hen redan hade (att le, jollra, sitta).',
      'Om gråten låter annorlunda än vanligt och kommer tillsammans med feber, kräkningar, slöhet eller vägran att äta: kontakta läkare. Är det allvarligt, ring {emergency}.',
      'Om du själv i veckor känner dig nedstämd, hopplös eller är rädd att skada bebisen: det kan vara en förlossningsdepression, och den går att behandla. Berätta det för din läkare.',
    ],
    sources: [S.harvardServe, S.nurturingCare2018, S.ainsworth1978, S.healthyChildrenCrying, S.zubler2022],
  },
  {
    id: '1-3',
    emoji: '🧸',
    title: '1–3 år: ”Jag själv!”-åldern',
    lead: 'Barnet går redan, börjar prata och vill klara sig själv, men den del av hjärnan som hanterar känslor är fortfarande mycket ung. Det är därför utbrotten kommer.',
    brain: [
      'Hjärnans känslocentrum (amygdala) är starkt och snabbt, medan pannloben, som står för ”bromsen”, fortsätter att utvecklas i många år. Därför kan en tvååring inte sluta, även om du säger ”sluta”. Det är inte trots utan en broms som inte är färdigbyggd.',
      'Språket utvecklas snabbt, men barnet förstår mycket mer än det kan säga. Att inte kunna säga vad man vill är enormt frustrerande, och det kommer ofta ut som skrik eller slag.',
      'I den här åldern lär sig barnet orsak och verkan genom att pröva: hen kastar skeden på golvet, tittar på din reaktion och kastar igen. Det är inte för att ”reta dig”, utan en liten forskares experiment.',
    ],
    needs: [
      'Lugna, tydliga och återkommande gränser: ”Man får inte slå. Jag håller i dina händer.” Ingen lång förklaring, utan en kort mening och handling.',
      'Valmöjligheter: ”Röda tröjan eller blå?” Att få välja tillgodoser behovet av självbestämmande och minskar behovet att säga ”nej”.',
      'Att sätta ord på känslor: ”Du blev arg för att leken tog slut.” En känsla som får ett namn lägger sig snabbare.',
      'Några minuter om dagen av lek där barnet bestämmer, mycket rörelse och frisk luft.',
    ],
    normal: [
      'Några utbrott om dagen, särskilt vid trötthet, hunger eller i övergångar.',
      'Att säga ”nej!” väldigt ofta och vilja samma sak om och om igen.',
      'Att inte kunna dela. Riktigt delande utvecklas först runt 3–4 års ålder.',
      'Att bita eller slå då och då: fysisk aggression når sin topp i den här åldern och minskar sedan gradvis.',
    ],
    tryThis: [
      'Förvarna 5 minuter före en övergång: ”Två åk till i rutschkanan, sedan går vi hem.”',
      'Säg vad som är okej i stället för ”nej”: ”Inte på väggen, rita på det här pappret.”',
      '10 minuter om dagen av ”barnets lek”: det hen gör, gör du också, utan kritik och utan en störtskur av frågor.',
      'Lägg märke till bra beteende under dagen och benämn det exakt: ”Du gav leksaken till din lillebror, se hur glad han blev!”',
    ],
    specialist: [
      'Om barnet inte pekar vid 18 månader, inte säger tvåordsmeningar vid 2 år, inte reagerar på sitt namn eller har mycket lite ögonkontakt.',
      'Om hen tappar ord eller förmågor hen redan hade (i vilken ålder som helst).',
      'Om utbrotten varar längre än 25 minuter, kommer fler än 5 gånger om dagen, hen allvarligt skadar sig själv eller andra, eller om de inte minskar efter 4 års ålder.',
      'Om svårigheter med sömn, mat eller beteende stör familjens vardag i månader.',
    ],
    sources: [S.harvardEF2011, S.healthyChildrenTantrums, S.cdcPositive, S.tremblay2004, S.zubler2022],
  },
  {
    id: '3-6',
    emoji: '🎨',
    title: '3–6 år: fantasi, frågor och regler',
    lead: 'Barnet frågar ”varför?”, leker rollekar och lär sig vara en kompis. Självkontrollen växer snabbt, men hen behöver fortfarande ditt stöd.',
    brain: [
      'Exekutiva funktioner — att hålla kvar uppmärksamheten, vänta på sin tur, komma ihåg en regel, byta tankespår — utvecklas snabbt mellan 3 och 5 år. Rollekar och lekar med regler är den bästa träningen för de här förmågorna.',
      'Barnet börjar förstå att någon annan kan tänka annorlunda. Därför dyker de första lögnerna upp i den här åldern. Intressant nog är det ett tecken på kognitiv utveckling.',
      'Fantasin blir starkare och gränsen mellan verklighet och påhitt är fortfarande suddig. Att vara rädd för mörker, monster eller drömmar är typiska rädslor i den här åldern.',
    ],
    needs: [
      'Några få tydliga familjeregler som tillämpas konsekvent. Ju mer förutsägbara reglerna är, desto färre diskussioner.',
      'Logiska följder i stället för straff: ”Om du kastar bollen inomhus får bollen ligga i skåpet.”',
      'Samtal om känslor: böcker, lek med gosedjur och dockor, frågor som ”hur skulle du ha känt dig?”.',
      'Riktiga små ansvarsuppgifter: duka bordet, plocka undan leksaker, vattna blomman.',
    ],
    normal: [
      'Att ibland ljuga och blanda ihop fantasi och verklighet.',
      'Att testa regler och reagera starkt på ”orättvisor”.',
      'Att vara rädd för mörker eller nya situationer.',
      'Fortfarande utbrott då och då, men kortare och mer sällan än förut.',
    ],
    tryThis: [
      'Fråga en gång om dagen om ”dagens bästa och svåraste stund” och lyssna uppmärksamt.',
      'Rita reglerna tillsammans med bilder och sätt upp dem på väggen.',
      'Träna på att hålla igen med lekar som ”rött ljus, grönt ljus” eller ”Simon säger”.',
      'När något går fel, hitta en lösning tillsammans: ”Vattnet rann ut. Vad gör vi nu?”',
    ],
    specialist: [
      'Om barnet inte bildar meningar vid 4 år, om okända har svårt att förstå hens tal eller om hen inte alls är intresserad av lekkamrater.',
      'Om rädslor eller oro stör vardagen (förskola, sömn, mat) i veckor.',
      'Om aggressionen allvarligt skadar andra eller ökar, eller om hen är grym mot djur.',
      'Om hen kissar på sig på dagen igen efter att länge ha varit torr, eller tappar förmågor hen redan hade.',
    ],
    sources: [S.diamond2013, S.harvardEF2011, S.talwarLee2008, S.cdcPositive, S.zubler2022],
  },
  {
    id: '6-12',
    emoji: '🎒',
    title: '6–12 år: förmåga, vänskap, självförtroende',
    lead: 'Skolåren är tiden då barnet bygger upp känslan av ”jag kan”. Kompisar blir viktiga, men du är fortfarande hens viktigaste trygghet.',
    brain: [
      'Planering, uppmärksamhet och självkontroll är redan väl utvecklade, men trötthet, hunger och stress ”släcker” dem lätt. Ett lättretligt barn efter skolan är ofta helt enkelt ett utmattat barn.',
      'Barnet börjar jämföra sig med andra. Under den här perioden får självkänslan sin näring framför allt från ansträngning, från att lära sig nya saker och från att bli accepterad.',
      'Närmare tonåren (ungefär 9–12 år) kan hormonella förändringar börja: humörsvängningar och ett större behov av egen sfär är normalt.',
    ],
    needs: [
      'Uppmuntran som ser ansträngningen och strategin: ”Du jobbade länge med den här uppgiften och testade ett annat sätt.”',
      'Allt mer ansvar och inflytande, tillsammans med tydliga familjeregler.',
      'En förälder som lyssnar utan att döma. Om du lyssnar på de små sakerna berättar hen också de stora.',
      'Fritid utanför skärmar och läxor: lek, idrott, kompisar, sömn.',
    ],
    normal: [
      'Långa diskussioner om rättvisa och en vilja att förhandla om regler.',
      'Osämja och försoning med kompisar, sorg över att ”de lät mig inte vara med”.',
      'Att smita från läxorna, glömska.',
      'Att ibland skämmas över sina föräldrar eller vilja vara mer för sig själv (särskilt efter 10 år).',
    ],
    tryThis: [
      'Tid för ”prat utan förhör” i bilen, vid maten eller före sänggåendet: berätta också om din egen dag.',
      'En fast tid och plats för läxor, men gör inte läxan åt barnet.',
      'Skriv en skärmplan för familjen tillsammans: var, när och hur mycket.',
      'En gång i veckan egen tid på tu man hand: bara du och barnet, med en aktivitet som hen väljer.',
    ],
    specialist: [
      'Nedstämdhet, förlorat intresse eller stora förändringar i sömn eller aptit som håller i sig mer än två veckor.',
      'Ihållande vägran att gå till skolan, täta klagomål på ont i magen och huvudvärk (om läkaren inte hittar någon orsak).',
      'Tecken på att barnet blir mobbat eller själv mobbar; total isolering från kompisar.',
      'Självskada, prat om döden eller självmord: se det aldrig som ”att söka uppmärksamhet”. Sök professionell hjälp direkt; finns det akut fara, ring {emergency}.',
    ],
    sources: [S.cdcPositive, S.aapMediaSchool2016, S.pomerantz2007, S.muellerDweck1998, S.unesco2019],
  },
];
