import type { Source } from '../types';

/**
 * Shared reference list. Every entry is a real publication or an organisation's official guidance; where the exact
 * page title or year of an online guide changes over time, the organisation and the guide are named without a year.
 * Titles stay in their original language so they can be looked up.
 */
export const S = {
  // Discipline and harsh parenting
  aapDiscipline2018: { who: 'Sege R.D., Siegel B.S. / Amerika Pediatriya Akademiyası (AAP)', year: '2018', title: 'Effective Discipline to Raise Healthy Children. Pediatrics, 142(6)' },
  gershoff2016: { who: 'Gershoff E.T., Grogan-Kaylor A.', year: '2016', title: 'Spanking and child outcomes: Old controversies and new meta-analyses. Journal of Family Psychology, 30(4)' },
  wangKenny2014: { who: 'Wang M.-T., Kenny S.', year: '2014', title: 'Longitudinal links between fathers’ and mothers’ harsh verbal discipline and adolescents’ conduct problems and depressive symptoms. Child Development, 85(3)' },
  whoParenting2022: { who: 'Ümumdünya Səhiyyə Təşkilatı (ÜST)', year: '2022', title: 'WHO guidelines on parenting interventions to prevent maltreatment and enhance parent–child relationships with children aged 0–17 years' },
  cdcPositive: { who: 'ABŞ Xəstəliklərə Nəzarət və Profilaktika Mərkəzləri (CDC)', title: 'Positive Parenting Tips (yaş dövrlərinə görə bələdçi)' },
  cdcEssentials: { who: 'CDC', title: 'Essentials for Parenting Toddlers and Preschoolers (bələdçi)' },
  healthyChildrenDiscipline: { who: 'AAP — HealthyChildren.org', title: 'Discipline and positive parenting (valideynlər üçün bələdçi)' },
  pcitMeta2007: { who: 'Thomas R., Zimmer-Gembeck M.J.', year: '2007', title: 'Behavioral outcomes of Parent-Child Interaction Therapy and Triple P—Positive Parenting Program: A review and meta-analysis. Journal of Abnormal Child Psychology, 35(3)' },

  // Styles
  baumrind1966: { who: 'Baumrind D.', year: '1966', title: 'Effects of authoritative parental control on child behavior. Child Development, 37(4)' },
  baumrind1967: { who: 'Baumrind D.', year: '1967', title: 'Child care practices anteceding three patterns of preschool behavior. Genetic Psychology Monographs, 75(1)' },
  pinquart2017: { who: 'Pinquart M.', year: '2017', title: 'Associations of parenting dimensions and styles with externalizing problems of children and adolescents: An updated meta-analysis. Developmental Psychology, 53(5)' },

  // Brain, stress, nurturing care
  harvardServe: { who: 'Harvard Universiteti, Center on the Developing Child', title: 'Serve and Return (“ver və qaytar” ünsiyyəti haqqında bələdçi)' },
  harvardEF2011: { who: 'Harvard Center on the Developing Child', year: '2011', title: 'Building the Brain’s “Air Traffic Control” System: How Early Experiences Shape the Development of Executive Function. Working Paper No. 11' },
  harvardStress: { who: 'Harvard Center on the Developing Child', title: 'Toxic Stress (stresin üç növü: pozitiv, dözülən, toksik)' },
  harvardRelationships2004: { who: 'National Scientific Council on the Developing Child (Harvard)', year: '2004', title: 'Young Children Develop in an Environment of Relationships. Working Paper No. 1' },
  diamond2013: { who: 'Diamond A.', year: '2013', title: 'Executive Functions. Annual Review of Psychology, 64' },
  nurturingCare2018: { who: 'ÜST, UNICEF, Dünya Bankı', year: '2018', title: 'Nurturing care for early childhood development: a framework for helping children survive and thrive' },
  garner2021: { who: 'Garner A., Yogman M. / AAP', year: '2021', title: 'Preventing Childhood Toxic Stress: Partnering With Families and Communities to Promote Relational Health. Pediatrics, 148(2)' },

  // Attachment
  bowlby1969: { who: 'Bowlby J.', year: '1969', title: 'Attachment and Loss, Vol. 1: Attachment' },
  ainsworth1978: { who: 'Ainsworth M.D.S., Blehar M.C., Waters E., Wall S.', year: '1978', title: 'Patterns of Attachment: A Psychological Study of the Strange Situation' },
  tronick1986: { who: 'Tronick E., Gianino A.', year: '1986', title: 'Interactive mismatch and repair: Challenges to the coping infant. Zero to Three, 6(3)' },
  tronick1989: { who: 'Tronick E.Z.', year: '1989', title: 'Emotions and emotional communication in infants. American Psychologist, 44(2)' },

  // Emotions
  gottman1996: { who: 'Gottman J.M., Katz L.F., Hooven C.', year: '1996', title: 'Parental meta-emotion philosophy and the emotional life of families. Journal of Family Psychology, 10(3)' },
  havighurst2010: { who: 'Havighurst S.S. və həmmüəllifləri', year: '2010', title: 'Tuning in to Kids: improving emotion socialization practices in parents of preschool children. Journal of Child Psychology and Psychiatry, 51(12)' },
  lieberman2007: { who: 'Lieberman M.D. və həmmüəllifləri', year: '2007', title: 'Putting feelings into words: affect labeling disrupts amygdala activity in response to affective stimuli. Psychological Science, 18(5)' },
  healthyChildrenTantrums:{ who: 'AAP — HealthyChildren.org', title: 'Temper Tantrums (valideynlər üçün bələdçi)' },

  // Play, language, reading
  yogman2018: { who: 'Yogman M., Garner A., Hutchinson J. və həmmüəllifləri / AAP', year: '2018', title: 'The Power of Play: A Pediatric Role in Enhancing Development in Young Children. Pediatrics, 142(3)' },
  romeo2018: { who: 'Romeo R.R. və həmmüəllifləri', year: '2018', title: 'Beyond the 30-million-word gap: Children’s conversational exposure is associated with language-related brain function. Psychological Science, 29(5)' },
  highKlass2014: { who: 'High P.C., Klass P. / AAP', year: '2014', title: 'Literacy Promotion: An Essential Component of Primary Care Pediatric Practice. Pediatrics, 134(2)' },

  // Sleep
  aasm2016: { who: 'Paruthi S. və həmmüəllifləri / Amerika Yuxu Təbabəti Akademiyası', year: '2016', title: 'Recommended Amount of Sleep for Pediatric Populations: A Consensus Statement. Journal of Clinical Sleep Medicine, 12(6)' },
  mindell2009: { who: 'Mindell J.A., Telofski L.S., Wiegand B., Kurtz E.S.', year: '2009', title: 'A nightly bedtime routine: impact on sleep in young children and maternal mood. Sleep, 32(5)' },
  mindell2018: { who: 'Mindell J.A., Williamson A.A.', year: '2018', title: 'Benefits of a bedtime routine in young children: Sleep, development, and beyond. Sleep Medicine Reviews, 40' },
  aapSafeSleep2022: { who: 'Moon R.Y. və həmmüəllifləri / AAP', year: '2022', title: 'Sleep-Related Infant Deaths: Updated 2022 Recommendations for Reducing Infant Deaths in the Sleep Environment. Pediatrics, 150(1)' },
  who2019Under5: { who: 'ÜST', year: '2019', title: 'Guidelines on physical activity, sedentary behaviour and sleep for children under 5 years of age' },

  // Eating
  satter: { who: 'Ellyn Satter Institute', title: 'Division of Responsibility in Feeding (qidalanmada məsuliyyət bölgüsü)' },
  birchFisher1998: { who: 'Birch L.L., Fisher J.O.', year: '1998', title: 'Development of eating behaviors among children and adolescents. Pediatrics, 101(3)' },
  wardle2003: { who: 'Wardle J. və həmmüəllifləri', year: '2003', title: 'Increasing children’s acceptance of vegetables; a randomized trial of parent-led exposure. Appetite, 40(2)' },

  // Screens
  aapMedia2016: { who: 'AAP Council on Communications and Media', year: '2016', title: 'Media and Young Minds. Pediatrics, 138(5)' },
  aapMediaSchool2016: { who: 'AAP Council on Communications and Media', year: '2016', title: 'Media Use in School-Aged Children and Adolescents. Pediatrics, 138(5)' },
  aapFamilyMediaPlan: { who: 'AAP — HealthyChildren.org', title: 'Family Media Plan (ailə media planı aləti)' },

  // Praise, motivation, chores
  muellerDweck1998: { who: 'Mueller C.M., Dweck C.S.', year: '1998', title: 'Praise for intelligence can undermine children’s motivation and performance. Journal of Personality and Social Psychology, 75(1)' },
  gunderson2013: { who: 'Gunderson E.A. və həmmüəllifləri', year: '2013', title: 'Parent praise to 1- to 3-year-olds predicts children’s motivational frameworks 5 years later. Child Development, 84(5)' },
  henderlong2002: { who: 'Henderlong J., Lepper M.R.', year: '2002', title: 'The effects of praise on children’s intrinsic motivation: A review and synthesis. Psychological Bulletin, 128(5)' },
  deci1999: { who: 'Deci E.L., Koestner R., Ryan R.M.', year: '1999', title: 'A meta-analytic review of experiments examining the effects of extrinsic rewards on intrinsic motivation. Psychological Bulletin, 125(6)' },
  brummelman2014: { who: 'Brummelman E. və həmmüəllifləri', year: '2014', title: 'On feeding those hungry for praise: Person praise backfires in children with low self-esteem. Journal of Experimental Psychology: General, 143(1)' },
  tepper2022: { who: 'Tepper D.L., Howell T.J., Bennett P.C.', year: '2022', title: 'Executive functions and household chores: Does engagement in chores predict children’s cognition? Australian Occupational Therapy Journal, 69(5)' },

  // Fears, anxiety
  lebowitz2020: { who: 'Lebowitz E.R. və həmmüəllifləri', year: '2020', title: 'Parent-Based Treatment as Efficacious as Cognitive-Behavioral Therapy for Childhood Anxiety (SPACE). Journal of the American Academy of Child & Adolescent Psychiatry, 59(3)' },
  healthyChildrenAnxiety: { who: 'AAP — HealthyChildren.org', title: 'Anxiety and fears in children (valideynlər üçün bələdçi)' },

  // Lying, aggression
  talwarLee2008: { who: 'Talwar V., Lee K.', year: '2008', title: 'Social and cognitive correlates of children’s lying behavior. Child Development, 79(4)' },
  talwar2015: { who: 'Talwar V., Arruda C., Yachison S.', year: '2015', title: 'The effects of punishment and appeals for honesty on children’s truth-telling behavior. Journal of Experimental Child Psychology, 130' },
  tremblay2004: { who: 'Tremblay R.E. və həmmüəllifləri', year: '2004', title: 'Physical aggression during early childhood: trajectories and predictors. Pediatrics, 114(1)' },

  // Siblings
  kramerKowal2005: { who: 'Kramer L., Kowal A.K.', year: '2005', title: 'Sibling relationship quality from birth to adolescence: the enduring contributions of friends. Journal of Family Psychology, 19(4)' },
  healthyChildrenSiblings: { who: 'AAP — HealthyChildren.org', title: 'Sibling rivalry və yeni körpəyə hazırlıq (valideynlər üçün bələdçi)' },

  // Toilet
  brazelton1962: { who: 'Brazelton T.B.', year: '1962', title: 'A child-oriented approach to toilet training. Pediatrics, 29' },
  healthyChildrenToilet: { who: 'AAP — HealthyChildren.org', title: 'Toilet Training (tualetə öyrətmə bələdçisi)' },

  // School
  cooper2006: { who: 'Cooper H., Robinson J.C., Patall E.A.', year: '2006', title: 'Does homework improve academic achievement? A synthesis of research, 1987–2003. Review of Educational Research, 76(1)' },
  pomerantz2007: { who: 'Pomerantz E.M., Moorman E.A., Litwack S.D.', year: '2007', title: 'The how, whom, and why of parents’ involvement in children’s academic lives: More is not always better. Review of Educational Research, 77(3)' },
  unesco2019: { who: 'UNESCO', year: '2019', title: 'Behind the numbers: Ending school violence and bullying' },
  stopBullying: { who: 'ABŞ Səhiyyə Nazirliyi — StopBullying.gov', title: 'Bullying: valideynlər üçün tövsiyələr' },

  // Milestones, crying, parent mental health
  zubler2022: { who: 'Zubler J.M. və həmmüəllifləri / CDC və AAP', year: '2022', title: 'Evidence-Informed Milestones for Developmental Surveillance Tools. Pediatrics, 149(3)' },
  cdcActEarly: { who: 'CDC', title: 'Learn the Signs. Act Early. (inkişaf mərhələləri bələdçisi)' },
  purple: { who: 'National Center on Shaken Baby Syndrome', title: 'The Period of PURPLE Crying (körpə ağlaması haqqında proqram)' },
  healthyChildrenCrying: { who: 'AAP — HealthyChildren.org', title: 'Responding to Your Baby’s Cries (valideynlər üçün bələdçi)' },
  whoMentalHealthParents: { who: 'ÜST', title: 'Ana və valideyn psixi sağlamlığı (Maternal mental health) haqqında məlumat' },

  // First year: colic, sleep, pacifier, first foods, stranger wariness
  wessel1954: { who: 'Wessel M.A., Cobb J.C., Jackson E.B. və həmmüəllifləri', year: '1954', title: 'Paroxysmal fussing in infancy, sometimes called colic. Pediatrics, 14(5)' },
  healthyChildrenColic: { who: 'AAP / HealthyChildren.org', title: 'Colic Relief Tips for Parents (valideynlər üçün bələdçi)' },
  nhsColic: { who: 'Böyük Britaniya Səhiyyə Xidməti (NHS)', title: 'Colic (körpə koliki haqqında bələdçi)' },
  barr2009: { who: 'Barr R.G. və həmmüəllifləri', year: '2009', title: 'Effectiveness of educational materials designed to change knowledge and behaviors regarding crying and shaken-baby syndrome in mothers of newborns: a randomized, controlled trial. Pediatrics, 123(3)' },
  cdcAbusiveHeadTrauma: { who: 'CDC', title: 'Preventing Abusive Head Trauma in Children (silkələnmiş körpə sindromunun qarşısını almaq)' },
  sroufe1977: { who: 'Sroufe L.A.', year: '1977', title: 'Wariness of strangers and the study of infant development. Child Development, 48(3)' },
  zeroToThreeSeparation: { who: 'Zero to Three', title: 'Coping with separation anxiety (valideynlər üçün bələdçi)' },
  galland2012: { who: 'Galland B.C., Taylor B.J., Elder D.E., Herbison P.', year: '2012', title: 'Normal sleep patterns in infants and children: A systematic review of observational studies. Sleep Medicine Reviews, 16(3)' },
  henderson2010: { who: 'Henderson J.M.T., France K.G., Owens J.L., Blampied N.M.', year: '2010', title: 'Sleeping through the night: the consolidation of self-regulated sleep across the first year of life. Pediatrics, 126(5)' },
  sexton2009: { who: 'Sexton S., Natale R.', year: '2009', title: 'Risks and benefits of pacifiers. American Family Physician, 79(8)' },
  healthyChildrenPacifier: { who: 'AAP / HealthyChildren.org', title: 'Pacifiers and thumb sucking (valideynlər üçün bələdçi)' },
  whoInfantFeeding: { who: 'ÜST', title: 'Infant and young child feeding (körpə və kiçik uşaq qidalanması haqqında məlumat)' },
  healthyChildrenSolids: { who: 'AAP / HealthyChildren.org', title: 'Starting Solid Foods (bərk qidaya başlamaq bələdçisi)' },
  fangupo2016: { who: 'Fangupo L.J. və həmmüəllifləri', year: '2016', title: 'A Baby-Led Approach to Eating Solids and Risk of Choking. Pediatrics, 138(4)' },

  // Postpartum
  acog2018: { who: 'Amerika Mama-Ginekoloqlar Kolleci (ACOG)', year: '2018', title: 'Optimizing Postpartum Care. Committee Opinion No. 736. Obstetrics & Gynecology, 131(5)' },
  nhsPostnatalDepression: { who: 'NHS', title: 'Postnatal depression (doğuşdan sonrakı depressiya haqqında bələdçi)' },

  // Body safety, online safety
  whoSexualAbuse2017: { who: 'ÜST', year: '2017', title: 'Responding to children and adolescents who have been sexually abused: WHO clinical guidelines' },
  walsh2015: { who: 'Walsh K., Zwi K., Woolfenden S., Shlonsky A.', year: '2015', title: 'School-based education programmes for the prevention of child sexual abuse. Cochrane Database of Systematic Reviews' },
  cdcChildAbusePrevention: { who: 'CDC', title: 'Preventing Child Sexual Abuse (uşaqların cinsi istismarının qarşısını almaq)' },
  unicefOnline: { who: 'UNICEF', title: 'Keeping children safe online (valideynlər üçün tövsiyələr)' },
  euKidsOnline2020: { who: 'Smahel D. və həmmüəllifləri', year: '2020', title: 'EU Kids Online 2020: Survey results from 19 countries' },

  // Family life: grandparents, divorce, grief, moving
  sadruddin2019: { who: 'Sadruddin A.F.A. və həmmüəllifləri', year: '2019', title: 'How do grandparents influence child health and development? A systematic review. Social Science & Medicine, 239' },
  amato2001: { who: 'Amato P.R.', year: '2001', title: 'Children of divorce in the 1990s: an update of the Amato and Keith (1991) meta-analysis. Journal of Family Psychology, 15(3)' },
  cohenDivorce2016: { who: 'Cohen G.J., Weitzman C.C. / AAP', year: '2016', title: 'Helping Children and Families Deal With Divorce and Separation. Pediatrics, 138(6)' },
  schonfeld2016: { who: 'Schonfeld D.J., Demaria T. / AAP', year: '2016', title: 'Supporting the Grieving Child and Family. Pediatrics, 138(3)' },
  nctsnGrief: { who: 'National Child Traumatic Stress Network (NCTSN)', title: 'Childhood Traumatic Grief (valideynlər üçün bələdçi)' },
  jelleyman2008: { who: 'Jelleyman T., Spencer N.', year: '2008', title: 'Residential mobility in childhood and health outcomes: a systematic review. Journal of Epidemiology & Community Health, 62(7)' },

  // Language: bilingualism, stuttering
  byersHeinlein2013: { who: 'Byers-Heinlein K., Lew-Williams C.', year: '2013', title: 'Bilingualism in the early years: What the science says. LEARNing Landscapes, 7(1)' },
  hoff2012: { who: 'Hoff E. və həmmüəllifləri', year: '2012', title: 'Dual language exposure and early bilingual development. Journal of Child Language, 39(1)' },
  ashaBilingual: { who: 'Amerika Nitq-Dil-Eşitmə Assosiasiyası (ASHA)', title: 'Learning Two Languages (iki dil öyrənən uşaqlar haqqında bələdçi)' },
  yairi2013: { who: 'Yairi E., Ambrose N.', year: '2013', title: 'Epidemiology of stuttering: 21st century advances. Journal of Fluency Disorders, 38(2)' },
  ashaStuttering: { who: 'ASHA', title: 'Stuttering (kəkələmə haqqında bələdçi)' },
  nidcdStuttering: { who: 'ABŞ Milli Karlıq və Ünsiyyət Pozuntuları İnstitutu (NIDCD)', title: 'Stuttering (kəkələmə haqqında məlumat)' },

  // Bedwetting
  nice2010Bedwetting: { who: 'NICE (Böyük Britaniya)', year: '2010', title: 'Bedwetting in under 19s. Clinical guideline CG111' },
  neveus2020: { who: 'Nevéus T. və həmmüəllifləri / Beynəlxalq Uşaq Kontinensiya Cəmiyyəti (ICCS)', year: '2020', title: 'Management and treatment of nocturnal enuresis: an updated standardization document from the International Children’s Continence Society. Journal of Pediatric Urology, 16(1)' },
  nhsBedwetting: { who: 'NHS', title: 'Bedwetting in children (gecə sidik saxlamama haqqında bələdçi)' },

  // Money, school readiness
  whitebread2013: { who: 'Whitebread D., Bingham S. / Money Advice Service', year: '2013', title: 'Habit Formation and Learning in Young Children' },
  cfpb2016: { who: 'ABŞ İstehlakçı Maliyyə Müdafiəsi Bürosu (CFPB)', year: '2016', title: 'Building blocks to help youth achieve financial capability' },
  unicefSchoolReadiness2012: { who: 'UNICEF', year: '2012', title: 'School Readiness: A Conceptual Framework' },
  williams2019: { who: 'Williams P.G., Lerner M.A. / AAP', year: '2019', title: 'School Readiness. Pediatrics, 144(2)' },
  blairRaver2015: { who: 'Blair C., Raver C.C.', year: '2015', title: 'School readiness and self-regulation: a developmental psychobiological approach. Annual Review of Psychology, 66' },

  // ADHD, autism
  hyman2020: { who: 'Hyman S.L., Levy S.E., Myers S.M. / AAP', year: '2020', title: 'Identification, Evaluation, and Management of Children With Autism Spectrum Disorder. Pediatrics, 145(1)' },
  wolraich2019: { who: 'Wolraich M.L. və həmmüəllifləri / AAP', year: '2019', title: 'Clinical Practice Guideline for the Diagnosis, Evaluation, and Treatment of Attention-Deficit/Hyperactivity Disorder in Children and Adolescents. Pediatrics, 144(4)' },

  // Siblings programme
  kennedyKramer2008: { who: 'Kennedy D.E., Kramer L.', year: '2008', title: 'Improving emotion regulation and sibling relationship quality: The More Fun With Sisters and Brothers Program. Family Relations, 57(5)' },
} satisfies Record<string, Source>;
