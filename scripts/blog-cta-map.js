// Сопоставление «тема статьи → тематические CTA». Единственное место, где настраиваются блоки
// «Что делать дальше» и инлайн-плашки в статьях блога. Новая статья, которой нет в CLUSTER_OF,
// получает набор 'general' автоматически (запуск: node scripts/blog-enhance.js).
//
// Типы действий карточки:
//   href     — ссылка на страницу (калькулятор, подбор, услуга)
//   form     — якорь на форму в этой же статье (#cta-form) с предзаполнением темы и поля «Что нужно»

const CARDS = {
  calc:    {title: 'Рассчитать стоимость', text: 'Ориентировочный расчёт по направлению испытаний — в калькуляторе.', href: '/kalkulyator/', label: 'Открыть калькулятор', goal: 'calc_from_article'},
  forms:   {title: 'Подобрать форму испытаний', text: 'Ответьте на три вопроса об изделии — определитель подскажет рекомендуемую форму.', href: '/podbor-ispytaniy/', label: 'Пройти определитель', goal: 'forms_from_article'},
  service: {title: 'Клинические испытания медицинских изделий', text: 'Формы испытаний, этапы и условия работы — на странице услуги.', href: '/klinicheskie-ispytaniya-medizdeliy/', label: 'Перейти к услуге', goal: 'service_from_article'},
  docs:    {title: 'Проверить комплект документов', text: 'Проверим комплект перед подачей и подскажем, что нужно доработать.', form: true, label: 'Оставить заявку', need: 'Клинические испытания', goal: 'article_cta_click'},
  clinic:  {title: 'Подобрать клинику', text: 'Подберём аккредитованный центр под ваше изделие и профиль исследования.', form: true, label: 'Оставить заявку', need: 'Клинические испытания', goal: 'article_cta_click'},
  ask:     {title: 'Обсудить проект', text: 'Расскажите об изделии — менеджер свяжется и предложит маршрут испытаний.', form: true, label: 'Оставить заявку', need: 'Не знаю, нужна консультация', goal: 'article_cta_click'},
};

// Наборы карточек (2–3) и текст инлайн-плашки по кластерам
const CLUSTERS = {
  cost:    {cards: ['calc', 'service', 'ask'],   inline: {text: 'Хотите оценить стоимость и сроки для своего изделия?', card: 'calc'}},
  docs:    {cards: ['docs', 'service', 'calc'],  inline: {text: 'Готовите документы к подаче?', card: 'docs'}},
  clinic:  {cards: ['clinic', 'service', 'calc'], inline: {text: 'Выбираете клинику для КИ?', card: 'clinic'}},
  forms:   {cards: ['forms', 'calc', 'ask'],     inline: {text: 'Не уверены, какая форма испытаний нужна изделию?', card: 'forms'}},
  general: {cards: ['forms', 'calc', 'ask'],     inline: {text: 'Нужна помощь с вашим проектом?', card: 'ask'}},
};

const CLUSTER_OF = {
  // сроки, стоимость, ускорение, выборка/мощность (численные оценки)
  'skolko-dlyatsya-ki-medizdeliya-sroki-po-etapam': 'cost',
  'sroki-vydachi-razresheniya-na-ki': 'cost',
  'stoimost-klinicheskih-ispytanij-medizdeliya': 'cost',
  'kak-chitat-smetu-ki-medizdeliya': 'cost',
  'mozhno-li-proyti-ki-medizdeliya-za-god': 'cost',
  'kak-uskorit-klinicheskie-ispytaniya-medizdeliya': 'cost',
  'monitoring-kontrol-kachestva-ki-medizdeliy': 'cost',
  'peredacha-svedeniy-ki-v-ais-roszdravnadzora': 'clinic',
  'akt-ocenki-rezultatov-ki-medizdeliya': 'docs',
  'otchet-o-klinicheskih-ispytaniyah-medizdeliya': 'docs',
  'otchet-ki-po-pravilam-eaes': 'docs',
  'klinicheskaya-ocenka-medizdeliya-po-literature': 'docs',
  'obosnovanie-ekvivalentnosti-medizdeliya': 'docs',
  'otkloneniya-ot-programmy-ki-medizdeliya': 'docs',
  'nezhelatelnye-sobytiya-ki-medizdeliya': 'docs',
  'raschet-vyborki-ki-medizdeliya-metodika': 'cost',
  'skolko-pacientov-nuzhno-dlya-ki-razmer-vyborki': 'cost',
  'statisticheskaya-moshchnost-issledovaniya-medizdeliya': 'cost',
  'zamechanie-k-raschetu-vyborki-kak-otvechat': 'cost',
  // разрешение, документы, отказы, замечания, этика, программа
  'kak-poluchit-razreshenie-na-ki': 'docs',
  'dokumenty-dlya-razresheniya-ki': 'docs',
  'razreshenie-na-ki-po-pravilam-eaes': 'docs',
  'otkazali-v-razreshenii': 'docs',
  'priostanovili-ki': 'docs',
  'otchet-zavernuli': 'docs',
  'zamechaniya-k-programme-ki-kak-otvechat': 'docs',
  'zamechaniya-soveta-po-etike-ki-medizdeliya': 'docs',
  'eticheskiy-komitet-ki-medizdeliya': 'docs',
  'informirovannoe-soglasie-ki-medizdeliya': 'docs',
  'ki-medizdeliya-uyazvimye-gruppy': 'docs',
  'strahovanie-pacientov-ki-medizdeliy': 'docs',
  'kak-sostavit-programmu-klinicheskikh-ispytanij': 'docs',
  'protokol-programma-ki-medizdeliya-ekspertiza': 'docs',
  // клиники, исследователи, многоцентровые КИ
  'kak-vybrat-kliniku-dlya-ki-perechen-roszdravnadzora': 'clinic',
  'perechen-medorganizaciy-ki-kak-proverit-kliniku': 'clinic',
  'trebovaniya-k-medorganizacii-dlya-ki-medizdeliya': 'clinic',
  'kak-vybrat-glavnogo-issledovatelya-dlya-ki': 'clinic',
  'mnogocentrovoe-ki-medizdeliya': 'clinic',
  'klinika-ne-nabiraet-pacientov-chto-delat': 'clinic',
  // классы риска, «нужны ли КИ», клиническая оценка, дизайн
  'ki-po-klassam-riska': 'forms',
  'nuzhny-li-ki': 'forms',
  'kogda-ki-ne-trebuyutsya': 'forms',
  'klinicheskaya-ocenka-ili-ki': 'forms',
  'ki-dlya-analoga': 'forms',
  'dizajn-klinicheskogo-issledovaniya-medizdeliya-vidy': 'forms',
  'kriterii-vklyucheniya-isklyucheniya-ki': 'forms',
  'konechnye-tochki-ki-medizdeliya-kak-vybrat': 'forms',
};

// Хабы кластеров для перелинковки: все статьи кластера получают ссылку на хаб(ы)
const HUBS = {
  cost:   ['skolko-dlyatsya-ki-medizdeliya-sroki-po-etapam', 'stoimost-klinicheskih-ispytanij-medizdeliya'],
  docs:   ['kak-poluchit-razreshenie-na-ki'],
  clinic: ['kak-vybrat-kliniku-dlya-ki-perechen-roszdravnadzora'],
  forms:  ['ki-po-klassam-riska'],
  // подкластер «программа и выборка»
  program: ['kak-sostavit-programmu-klinicheskikh-ispytanij', 'raschet-vyborki-ki-medizdeliya-metodika'],
};

module.exports = {CARDS, CLUSTERS, CLUSTER_OF, HUBS};

// Подкластер «программа, дизайн, выборка» — все статьи получают ссылки на хабы HUBS.program
module.exports.PROGRAM_MEMBERS = [
  'kak-sostavit-programmu-klinicheskikh-ispytanij', 'protokol-programma-ki-medizdeliya-ekspertiza',
  'raschet-vyborki-ki-medizdeliya-metodika', 'skolko-pacientov-nuzhno-dlya-ki-razmer-vyborki',
  'statisticheskaya-moshchnost-issledovaniya-medizdeliya', 'zamechanie-k-raschetu-vyborki-kak-otvechat',
  'zamechaniya-k-programme-ki-kak-otvechat', 'kriterii-vklyucheniya-isklyucheniya-ki',
  'konechnye-tochki-ki-medizdeliya-kak-vybrat', 'dizajn-klinicheskogo-issledovaniya-medizdeliya-vidy',
];
// Связи между кластерами: «программа/выборка» ↔ «клиники/исследователи»
module.exports.CROSS = {
  'kak-sostavit-programmu-klinicheskikh-ispytanij': ['kak-vybrat-kliniku-dlya-ki-perechen-roszdravnadzora'],
  'raschet-vyborki-ki-medizdeliya-metodika': ['mnogocentrovoe-ki-medizdeliya'],
  'kak-vybrat-kliniku-dlya-ki-perechen-roszdravnadzora': ['kak-sostavit-programmu-klinicheskikh-ispytanij', 'raschet-vyborki-ki-medizdeliya-metodika'],
  'kak-vybrat-glavnogo-issledovatelya-dlya-ki': ['kak-sostavit-programmu-klinicheskikh-ispytanij'],
  'mnogocentrovoe-ki-medizdeliya': ['raschet-vyborki-ki-medizdeliya-metodika'],
};
// Основная статья по запросу и её «конкуренты»: у вторых — ссылка на основную с анкором по запросу
module.exports.POINTERS = {
  'perechen-medorganizaciy-ki-kak-proverit-kliniku': {main: 'kak-vybrat-kliniku-dlya-ki-perechen-roszdravnadzora', text: 'Общий порядок выбора центра — от Перечня до проверки готовности площадки — в статье', anchor: 'Как выбрать клинику для КИ медизделия'},
  'trebovaniya-k-medorganizacii-dlya-ki-medizdeliya': {main: 'kak-vybrat-kliniku-dlya-ki-perechen-roszdravnadzora', text: 'Как применить эти требования при выборе площадки — в статье', anchor: 'Как выбрать клинику для КИ медизделия'},
  'protokol-programma-ki-medizdeliya-ekspertiza': {main: 'kak-sostavit-programmu-klinicheskikh-ispytanij', text: 'Как составить программу клинических испытаний с нуля — в статье', anchor: 'Как составить программу клинических испытаний медизделия'},
};
