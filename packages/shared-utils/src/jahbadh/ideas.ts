/**
 * «أفكار القياس والتقويم» (brief B6-15): the prototype's static reference page — assessment principles
 * and 20 classroom ideas, each linked to the component where its mark is recorded (Arabic, with an English translation).
 */
export interface JgAssessmentIdea {
  title: string
  how: string
  component: string
  grades: string
  subjects: string
  tool: string | null
}

export const JG_ASSESSMENT_PRINCIPLES_AR = [
  'نوّع أدوات القياس داخل المكوّن الواحد: لا تجعل «الأنشطة اليومية» درجة انطباعية، بل حصيلة أدوات رصد موثقة.',
  'أعلن المعايير قبل المهمة: التلميذ الذي يعرف كيف سيُقيَّم يعمل بشكل أفضل، وسلّم التقدير يجعل الدرجة عادلة وقابلة للتفسير لولي الأمر.',
  'استخدم النتائج للتعليم لا للرصد فقط: راجع «معدلات الأداء» بعد كل فترة، وضع خطة علاجية للمادة الأضعف وللتلاميذ دون حد الدعم.',
  'راقب «الفجوة» بين إتقان الأعمال الصفية وإتقان الامتحانات: الفجوة الكبيرة تستدعي مراجعة أدوات الأعمال الصفية أو مستوى الامتحان.',
  'وثّق كل درجة: سجل الرصد اليومي يحمي المعلم ويجعل الدرجة النهائية انعكاساً حقيقياً لمستوى التلميذ كما تنص المذكرة.',
]

export const JG_ASSESSMENT_IDEAS_AR: JgAssessmentIdea[] = [
  { title: 'بطاقة الخروج', how: 'في آخر 3 دقائق يجيب كل تلميذ على سؤال واحد يقيس هدف الدرس على بطاقة صغيرة؛ تفرز البطاقات إلى (أتقن / قريب / يحتاج إعادة) وتبدأ الحصة التالية بالمجموعة الثالثة.', component: 'الأنشطة اليومية والمشاركة', grades: '1 - 9', subjects: 'كل المواد', tool: 'سبورة جهبذ التفاعلية (سؤال سريع على الشاشة)' },
  { title: 'ملف الإنجاز (البورتفوليو)', how: 'ملف لكل تلميذ يجمع أفضل أعماله خلال الفترة مع ورقة تأمل قصيرة: ماذا تعلمت؟ ما الذي أفخر به؟ يُقيَّم بسلّم تقدير في نهاية الفترة.', component: 'متوسط التطبيقات / الأنشطة', grades: '3 - 9', subjects: 'العربية، الكتابة، العلوم', tool: 'المنصة المدرسية (رفع الأعمال وحفظها)' },
  { title: 'المهمة الأدائية الواقعية', how: 'مشكلة من حياة التلميذ تُحَلّ بالمعرفة: ميزانية رحلة مدرسية (رياضيات)، رسالة إلى البلدية عن نظافة الحي (كتابة)، خريطة لطريق المدرسة (جغرافيا).', component: 'التطبيقات الشهرية', grades: '4 - 9', subjects: 'الرياضيات، الكتابة، الاجتماعيات', tool: 'سلّم التقدير في هذا الملف' },
  { title: 'التجربة الافتراضية ثم الواقعية', how: 'يتنبأ التلميذ بنتيجة التجربة كتابياً، ينفّذها في المعمل الافتراضي، ثم يقارن التنبؤ بالنتيجة ويفسر الفرق في كراسة الأنشطة.', component: 'كراسة الأنشطة / النشاط العملي', grades: '3 - 9', subjects: 'العلوم', tool: 'معمل جهبذ الافتراضي (+580 تجربة)' },
  { title: 'سجل القراءة المتدرّج', how: 'يقرأ التلميذ كتاباً قصيراً أسبوعياً ويملأ بطاقة: الشخصيات، الفكرة، كلمة جديدة، رأيي. يُحتسب عدد الكتب وجودة البطاقات.', component: 'الأنشطة اليومية (القراءة)', grades: '1 - 9', subjects: 'العربية، الإنجليزية', tool: 'منصة كتبي (1700 كتاب تفاعلي)' },
  { title: 'المسابقة التنافسية بين المجموعات', how: 'مراجعة الوحدة في شكل لعبة جماعية بأسئلة متدرجة الصعوبة؛ تُرصد مشاركة كل تلميذ وليس نتيجة الفريق فقط.', component: 'المشاركة اليومية', grades: '1 - 6', subjects: 'كل المواد', tool: 'ألعاب السبورة: سلالم الجهابذة، شدّ الحبل' },
  { title: 'التقويم الذاتي بإشارات المرور', how: 'يرفع التلميذ بطاقة خضراء (فهمت) أو صفراء (غير متأكد) أو حمراء (لم أفهم) أثناء الشرح، ويكتب في نهاية الأسبوع جملة عن تقدمه.', component: 'الأنشطة اليومية', grades: '1 - 9', subjects: 'كل المواد', tool: null },
  { title: 'تقييم الأقران بالنجوم والأمنية', how: 'يقرأ التلميذ عمل زميله ويكتب نجمتين (نقطتي قوة) وأمنية واحدة (اقتراح تحسين) وفق معايير واضحة يضعها المعلم.', component: 'الأنشطة / الكتابة', grades: '4 - 9', subjects: 'الكتابة، التعبير، الإنجليزية', tool: null },
  { title: 'الاختبار الشفهي القصير المتكرر', how: 'أسئلة شفهية قصيرة لكل تلميذ مرة أسبوعياً على الأقل تُسجَّل في قائمة رصد سريعة (✓ / ✗) بدلاً من اختبار واحد طويل.', component: 'الشفهي / المشاركة', grades: '1 - 5', subjects: 'العربية، الإنجليزية، التربية الإسلامية', tool: 'نُطقي (للنطق والقراءة بالإنجليزية)' },
  { title: 'التسميع المتابع بالتكرار المتباعد', how: 'جدول حفظ لكل تلميذ يُراجَع فيه المحفوظ على فترات متباعدة، وتُرصد الجودة (إتقان، تجويد، طلاقة) لا الكمية فقط.', component: 'الأنشطة اليومية (القرآن الكريم)', grades: '1 - 9', subjects: 'التربية الإسلامية', tool: 'حِفظي (إدارة الحفظ والتسميع)' },
  { title: 'خريطة المفاهيم', how: 'يرسم التلميذ خريطة تربط مفاهيم الوحدة بأسهم وكلمات ربط؛ تكشف الفهم العميق والأخطاء المفاهيمية أكثر من الأسئلة المباشرة.', component: 'التطبيقات الشهرية', grades: '5 - 9', subjects: 'العلوم، الاجتماعيات، التاريخ', tool: 'سلّم التقدير في هذا الملف' },
  { title: 'الحساب الذهني اليومي', how: 'خمس دقائق يومياً لعمليات ذهنية متدرجة بزمن محدد، ويرسم كل تلميذ منحنى تقدمه الأسبوعي.', component: 'المشاركة اليومية / التدريبات', grades: '1 - 6', subjects: 'الرياضيات', tool: 'سوروبان جهبذ' },
  { title: 'لعبة الحروف والكلمات', how: 'تقويم الإملاء وتكوين الكلمات بلعبة حركية على السبورة؛ يُرصد عدد الكلمات الصحيحة في دقيقة.', component: 'الأنشطة اليومية (الكتابة/الإملاء)', grades: '1 - 4', subjects: 'العربية، الإملاء', tool: 'حروف في يدي، عدّاء الحروف، سبورة المغانط' },
  { title: 'المشروع البيئي الممتد', how: 'يتبنى التلميذ نبتة أو شجرة ويسجل نموها ورعايتها أسبوعياً بالصور والقياسات، ويعرض النتائج في نهاية الفصل.', component: 'كراسة الأنشطة / المشروع', grades: '3 - 8', subjects: 'العلوم، الرياضيات (القياس)', tool: 'غَرسي' },
  { title: 'المناظرة الصفية المصغرة', how: 'فريقان يتحاوران حول قضية من الدرس (مثل: الحاسوب في حياتنا نفع أم ضرر؟)، ويقيّم المعلم الحجة والأدلة وأدب الحوار.', component: 'المشاركة / التعبير الشفهي', grades: '6 - 9', subjects: 'العربية، التربية الإسلامية، الحاسوب', tool: 'سلّم التقدير في هذا الملف' },
  { title: 'السؤال المفتوح بدل الاختيار', how: 'يُضاف لكل اختبار قصير سؤال «اشرح لماذا» أو «أعطِ مثالاً من حياتك» لقياس الفهم لا الحفظ.', component: 'الامتحان النصفي / التطبيقات', grades: '4 - 9', subjects: 'كل المواد', tool: null },
  { title: 'الدرس المعكوس', how: 'يشاهد التلميذ الدرس المشروح في البيت، ويُخصَّص وقت الحصة لحل التطبيقات، فيُقاس التطبيق مباشرة أمام المعلم.', component: 'التطبيقات / الأنشطة', grades: '4 - 9', subjects: 'الرياضيات، العلوم، الإنجليزية', tool: 'منصة الدروس المشروحة (+7500 فيديو)' },
  { title: 'العرض التقديمي القصير', how: 'يقدّم التلميذ أو المجموعة ملخص درس في دقيقتين على السبورة التفاعلية، ويُقيَّم بالمحتوى والوضوح والوقت.', component: 'المشاركة / الأنشطة', grades: '5 - 9', subjects: 'كل المواد', tool: 'سبورة جهبذ التفاعلية' },
  { title: 'بطاقة الملاحظة المنظمة', how: 'قائمة رصد لسلوكيات محددة (يسأل، يساعد، يلتزم بالدور) تُملأ لخمسة تلاميذ يومياً بالتناوب، فيُغطى الفصل كله أسبوعياً.', component: 'الأنشطة الصفية والمشاركة', grades: '1 - 9', subjects: 'كل المواد', tool: 'المنصة المدرسية' },
  { title: 'التقويم القبلي قبل كل وحدة', how: 'اختبار تشخيصي قصير غير محسوب في الدرجة قبل الوحدة يحدد ما يعرفه التلاميذ، ثم يُقارن بنتائجهم بعد الوحدة لقياس «القيمة المضافة».', component: 'غير محسوب (تشخيصي)', grades: '3 - 9', subjects: 'كل المواد', tool: 'ورقة «معدلات الأداء» للمقارنة' },
]

export const JG_ASSESSMENT_PRINCIPLES_EN = [
  'Vary the assessment tools within one component: do not let "daily activities" be an impression mark, but the total of documented observation tools.',
  'Announce the criteria before the task: a pupil who knows how they will be assessed works better, and a rating scale makes the mark fair and easy to explain to parents.',
  'Use results to teach, not only to record: review the "performance rates" after each period and plan remedial work for the weakest subject and for pupils below the support threshold.',
  'Watch the "gap" between mastery in classwork and mastery in exams: a large gap calls for reviewing the classwork tools or the exam level.',
  'Document every mark: a daily record protects the teacher and makes the final mark a true reflection of the pupil\'s level, as the memo requires.',
]

export const JG_ASSESSMENT_IDEAS_EN: JgAssessmentIdea[] = [
  { title: 'Exit ticket', how: 'In the last 3 minutes each pupil answers one question on the lesson goal on a small card; cards are sorted into (mastered / nearly / needs re-teaching) and the next lesson starts with the third group.', component: 'Daily activities and participation', grades: '1 - 9', subjects: 'All subjects', tool: 'Jahbadh interactive board (quick on-screen question)' },
  { title: 'Portfolio', how: 'A file per pupil collecting their best work of the period with a short reflection sheet: What did I learn? What am I proud of? Assessed with a rating scale at the end of the period.', component: 'Average of applications / activities', grades: '3 - 9', subjects: 'Arabic, writing, science', tool: 'School platform (upload and keep work)' },
  { title: 'Real-life performance task', how: 'A problem from the pupil\'s life solved with knowledge: a school-trip budget (mathematics), a letter to the municipality about a clean neighbourhood (writing), a map of the way to school (geography).', component: 'Monthly applications', grades: '4 - 9', subjects: 'Mathematics, writing, social studies', tool: 'The rating scale in this module' },
  { title: 'Virtual experiment, then the real one', how: 'The pupil predicts the result of an experiment in writing, runs it in the virtual lab, then compares the prediction with the result and explains the difference in the activity book.', component: 'Activity book / practical work', grades: '3 - 9', subjects: 'Science', tool: 'Jahbadh virtual lab (580+ experiments)' },
  { title: 'Graded reading log', how: 'The pupil reads a short book every week and fills in a card: characters, main idea, a new word, my opinion. The number of books and the quality of the cards count.', component: 'Daily activities (reading)', grades: '1 - 9', subjects: 'Arabic, English', tool: 'Kutubi platform (1,700 interactive books)' },
  { title: 'Team quiz competition', how: 'Unit revision as a team game with questions of rising difficulty; each pupil\'s participation is recorded, not only the team\'s score.', component: 'Daily participation', grades: '1 - 6', subjects: 'All subjects', tool: 'Board games: Jahbadh ladders, tug of war' },
  { title: 'Traffic-light self-assessment', how: 'During the explanation the pupil raises a green (understood), yellow (not sure) or red (did not understand) card, and at the end of the week writes one sentence about their progress.', component: 'Daily activities', grades: '1 - 9', subjects: 'All subjects', tool: null },
  { title: 'Peer review: two stars and a wish', how: 'The pupil reads a classmate\'s work and writes two stars (strengths) and one wish (a suggestion to improve) against clear criteria set by the teacher.', component: 'Activities / writing', grades: '4 - 9', subjects: 'Writing, composition, English', tool: null },
  { title: 'Short, frequent oral checks', how: 'Short oral questions for every pupil at least once a week, recorded on a quick checklist (✓ / ✗) instead of one long test.', component: 'Oral / participation', grades: '1 - 5', subjects: 'Arabic, English, Islamic education', tool: 'Nutqi (English pronunciation and reading)' },
  { title: 'Recitation with spaced repetition', how: 'A memorisation schedule per pupil where learned passages are reviewed at spaced intervals; quality (mastery, tajweed, fluency) is recorded, not only quantity.', component: 'Daily activities (Holy Quran)', grades: '1 - 9', subjects: 'Islamic education', tool: 'Hifzi (memorisation and recitation tracking)' },
  { title: 'Concept map', how: 'The pupil draws a map linking the unit\'s concepts with arrows and linking words; it reveals deep understanding and misconceptions better than direct questions.', component: 'Monthly applications', grades: '5 - 9', subjects: 'Science, social studies, history', tool: 'The rating scale in this module' },
  { title: 'Daily mental arithmetic', how: 'Five minutes a day of graded mental calculations against the clock; each pupil plots their own weekly progress curve.', component: 'Daily participation / exercises', grades: '1 - 6', subjects: 'Mathematics', tool: 'Jahbadh soroban' },
  { title: 'Letters and words game', how: 'Spelling and word building assessed with an active game at the board; the number of correct words in one minute is recorded.', component: 'Daily activities (writing / spelling)', grades: '1 - 4', subjects: 'Arabic, spelling', tool: 'Letters in my hand, letter runner, magnetic board' },
  { title: 'Long-term environmental project', how: 'The pupil adopts a plant or tree and records its growth and care every week with photos and measurements, then presents the results at the end of the semester.', component: 'Activity book / project', grades: '3 - 8', subjects: 'Science, mathematics (measurement)', tool: 'Gharsi' },
  { title: 'Mini classroom debate', how: 'Two teams debate an issue from the lesson (e.g. computers in our lives: benefit or harm?); the teacher assesses the argument, the evidence and the manners of discussion.', component: 'Participation / oral expression', grades: '6 - 9', subjects: 'Arabic, Islamic education, computing', tool: 'The rating scale in this module' },
  { title: 'Open question instead of multiple choice', how: 'Every short test gets an "explain why" or "give an example from your life" question, to measure understanding rather than memorisation.', component: 'Mid-term exam / applications', grades: '4 - 9', subjects: 'All subjects', tool: null },
  { title: 'Flipped lesson', how: 'The pupil watches the explained lesson at home and class time is used for the exercises, so application is assessed directly in front of the teacher.', component: 'Applications / activities', grades: '4 - 9', subjects: 'Mathematics, science, English', tool: 'Explained-lessons platform (7,500+ videos)' },
  { title: 'Short presentation', how: 'A pupil or group presents a lesson summary in two minutes on the interactive board, assessed on content, clarity and timing.', component: 'Participation / activities', grades: '5 - 9', subjects: 'All subjects', tool: 'Jahbadh interactive board' },
  { title: 'Structured observation card', how: 'A checklist of specific behaviours (asks questions, helps others, takes turns) filled in for five pupils a day in rotation, so the whole class is covered every week.', component: 'Classroom activities and participation', grades: '1 - 9', subjects: 'All subjects', tool: 'School platform' },
  { title: 'Pre-assessment before each unit', how: 'A short diagnostic test, not counted in the mark, before the unit shows what pupils already know; it is compared with their results after the unit to measure the "added value".', component: 'Not counted (diagnostic)', grades: '3 - 9', subjects: 'All subjects', tool: 'The "performance rates" sheet for comparison' },
]

/** Principles and ideas in the page language (Arabic is the source; English is a translation). */
export function jgAssessmentContent(lang: string): { principles: string[]; ideas: JgAssessmentIdea[]; rtl: boolean } {
  const en = lang.startsWith('en')
  return { principles: en ? JG_ASSESSMENT_PRINCIPLES_EN : JG_ASSESSMENT_PRINCIPLES_AR, ideas: en ? JG_ASSESSMENT_IDEAS_EN : JG_ASSESSMENT_IDEAS_AR, rtl: !en }
}
