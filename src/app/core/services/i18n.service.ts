import { Injectable, signal, effect } from '@angular/core';

export type Locale = 'fr' | 'ar';

export interface Translations {
  [key: string]: {
    fr: string;
    ar: string;
  };
}

export const DICTIONARY: Translations = {
  // App brand
  appName: { fr: 'Excellence School Monastir', ar: 'مدرسة الامتياز بالمنستير' },
  schoolSubtitle: { fr: 'École Primaire Privée', ar: 'مدرسة ابتدائية خاصة' },
  monastirTunisia: { fr: 'Monastir, Tunisie', ar: 'المنستير، تونس' },

  // Navigation
  navDashboard: { fr: 'Accueil & Actualités', ar: 'الرئيسية والمستجدات' },
  navNews: { fr: 'Actualités', ar: 'المستجدات والإعلانات' },
  navStudents: { fr: 'Élèves & Classes', ar: 'التلاميذ والأقسام' },
  navClasses: { fr: 'Mes Classes', ar: 'أقسامي' },
  navGrades: { fr: 'Notes & Bulletins', ar: 'الأعداد وبطاقات الأعداد' },
  navForeignLanguages: { fr: 'Fiche Langues Étrangères', ar: 'بطاقة اللغات الأجنبية' },
  navAttendance: { fr: 'Absences & Retards', ar: 'الغياب والتأخير' },
  navRollCall: { fr: "Faire l'appel", ar: 'المناداة اليومية' },
  navHomework: { fr: 'Travail à faire', ar: 'الواجبات والأنشطة' },
  navTimetable: { fr: 'Emploi du temps', ar: 'جدول الأوقات' },
  navCalendar: { fr: 'Calendrier scolaire', ar: 'الروزنامة المدرسية' },
  navFees: { fr: 'Paiements & Frais', ar: 'متابعة المعاليم والخلاص' },
  navAppointments: { fr: 'Rendez-vous', ar: 'المواعيد والمقابلة' },
  navPwa: { fr: 'Installer l’App Mobile', ar: 'تثبيت التطبيق على الهاتف' },
  navAdminPanel: { fr: 'Administration', ar: 'الإدارة العامة' },
  navLinkRequests: { fr: 'Inscriptions Parents', ar: 'مطالب ربط الأولياء' },
  navUsers: { fr: 'Utilisateurs & Rôles', ar: 'المستخدمون والأدوار' },

  // Roles
  roleAdmin: { fr: 'Administration', ar: 'الإدارة' },
  roleEconome: { fr: 'Économe', ar: 'وكيل المداخيل / المصالح المالية' },
  roleTeacher: { fr: 'Enseignant(e)', ar: 'مدرّس(ة)' },
  roleParent: { fr: 'Espace Parent', ar: 'فضاء الولي' },

  // Auth
  loginTitle: { fr: 'Connexion à votre espace', ar: 'تسجيل الدخول إلى فضائكم' },
  loginDesc: { fr: 'Suivi scolaire, notes, devoirs et paiements', ar: 'متابعة الأعداد، الواجبات والخلاص' },
  emailOrPhone: { fr: 'Email ou numéro de téléphone', ar: 'البريد الإلكتروني أو رقم الهاتف' },
  password: { fr: 'Mot de passe', ar: 'كلمة العبور' },
  signIn: { fr: 'Se connecter', ar: 'دخول' },
  signOut: { fr: 'Déconnexion', ar: 'تسجيل الخروج' },
  orContinueWith: { fr: 'ou', ar: 'أو' },
  registerPrompt: { fr: "Vous n'avez pas de compte parent ?", ar: 'ليس لديكم حساب ولي بعد؟' },
  registerHere: { fr: 'Inscrivez-vous ici', ar: 'سجلوا حسابكم هنا' },
  signingIn: { fr: 'Connexion…', ar: 'جارٍ الدخول…' },
  showPassword: { fr: 'Afficher le mot de passe', ar: 'إظهار كلمة العبور' },
  hidePassword: { fr: 'Masquer le mot de passe', ar: 'إخفاء كلمة العبور' },
  sessionExpired: { fr: 'Votre session a expiré. Merci de vous reconnecter.', ar: 'انتهت صلاحية الجلسة. يرجى إعادة تسجيل الدخول.' },
  welcomeBack: { fr: 'Bon retour parmi nous', ar: 'مرحبًا بعودتكم' },
  brandTagline: { fr: 'L’école, les enseignants et les familles, réunis dans un seul espace.', ar: 'المدرسة والمربّون والعائلات في فضاء واحد.' },
  featureGrades: { fr: 'Notes et bulletins en temps réel', ar: 'الأعداد وبطاقات الأعداد مباشرة' },
  featureHomework: { fr: 'Devoirs, absences et emploi du temps', ar: 'الواجبات والغيابات وجدول الأوقات' },
  featureFees: { fr: 'Paiements et reçus en ligne', ar: 'الخلاص والوصولات عبر الإنترنت' },
  requiredFields: { fr: 'Veuillez saisir votre identifiant et votre mot de passe.', ar: 'يرجى إدخال المعرّف وكلمة العبور.' },
  passwordHint: { fr: '8 caractères minimum, avec au moins une lettre et un chiffre.', ar: '8 أحرف على الأقل، تتضمن حرفًا ورقمًا.' },
  confirmPassword: { fr: 'Confirmer le mot de passe', ar: 'تأكيد كلمة العبور' },
  changePasswordTitle: { fr: 'Choisissez votre mot de passe', ar: 'اختر كلمة العبور الخاصة بك' },
  changePasswordForced: { fr: 'Votre compte a été créé ou réinitialisé par l’administration. Remplacez le mot de passe provisoire par un mot de passe personnel.', ar: 'تم إنشاء حسابك أو إعادة تعيينه من قبل الإدارة. يرجى تعويض كلمة العبور المؤقتة بكلمة عبور شخصية.' },
  changePasswordVoluntary: { fr: 'Les autres appareils connectés seront déconnectés.', ar: 'سيتم قطع الاتصال بالأجهزة الأخرى المتصلة.' },
  currentPassword: { fr: 'Mot de passe actuel', ar: 'كلمة العبور الحالية' },
  temporaryPassword: { fr: 'Mot de passe provisoire', ar: 'كلمة العبور المؤقتة' },
  newPassword: { fr: 'Nouveau mot de passe', ar: 'كلمة العبور الجديدة' },
  passwordsDontMatch: { fr: 'Les deux mots de passe ne correspondent pas.', ar: 'كلمتا العبور غير متطابقتين.' },
  passwordTooWeak: { fr: 'Le nouveau mot de passe doit contenir au moins 8 caractères, dont une lettre et un chiffre.', ar: 'يجب أن تحتوي كلمة العبور الجديدة على 8 أحرف على الأقل، منها حرف ورقم.' },
  saveNewPassword: { fr: 'Enregistrer le mot de passe', ar: 'حفظ كلمة العبور' },
  passwordChanged: { fr: 'Mot de passe modifié.', ar: 'تم تغيير كلمة العبور.' },
  changeMyPassword: { fr: 'Changer mon mot de passe', ar: 'تغيير كلمة العبور' },
  logout: { fr: 'Se déconnecter', ar: 'تسجيل الخروج' },
  relationship: { fr: 'Lien de parenté', ar: 'صلة القرابة' },
  backToLogin: { fr: 'Retour à la connexion', ar: 'العودة إلى تسجيل الدخول' },
  alreadyRegistered: { fr: 'Déjà inscrit ?', ar: 'لديكم حساب؟' },

  // Register
  registerTitle: { fr: 'Inscription Parent', ar: 'تسجيل حساب ولي جديد' },
  fullName: { fr: 'Nom et prénom du parent', ar: 'الاسم واللقب للولي' },
  phoneNumber: { fr: 'Numéro de téléphone', ar: 'رقم الهاتف' },
  email: { fr: 'Adresse email', ar: 'البريد الإلكتروني' },
  childDeclaration: { fr: 'Déclaration de vos enfants scolarisés', ar: 'التصريح بالأبناء المسجلين بالمدرسة' },
  addChild: { fr: '+ Ajouter un enfant', ar: '+ إضافة ابن / ابنة' },
  childFirstName: { fr: "Prénom de l'enfant", ar: 'اسم الطفل' },
  childLastName: { fr: "Nom de l'enfant", ar: 'لقب الطفل' },
  selectClass: { fr: 'Choisir la classe', ar: 'اختر القسم' },
  submitRegistration: { fr: "Envoyer ma demande d'inscription", ar: 'إرسال طلب التسجيل' },
  registrationSuccessMsg: {
    fr: 'Votre inscription a été reçue ! Elle sera examinée par la direction de l’école pour valider le rattachement de vos enfants.',
    ar: 'تم استلام طلبكم بنجاح! سيتم التحقق من قبل إدارة المدرسة لتأكيد ربط بيانات أبنائكم.'
  },

  // Common UI
  child: { fr: 'Enfant', ar: 'التلميذ' },
  selectChild: { fr: 'Choisir un enfant :', ar: 'اختر التلميذ:' },
  filter: { fr: 'Filtrer', ar: 'تصفية' },
  search: { fr: 'Rechercher...', ar: 'بحث...' },
  save: { fr: 'Enregistrer', ar: 'حفظ' },
  cancel: { fr: 'Annuler', ar: 'إلغاء' },
  status: { fr: 'Statut', ar: 'الحالة' },
  date: { fr: 'Date', ar: 'التاريخ' },
  trimester: { fr: 'Trimestre', ar: 'الثلاثي' },
  trimester1: { fr: '1er Trimestre', ar: 'الثلاثي الأول' },
  trimester2: { fr: '2ème Trimestre', ar: 'الثلاثي الثاني' },
  trimester3: { fr: '3ème Trimestre', ar: 'الثلاثي الثالث' },
  downloadPdf: { fr: 'Télécharger / Imprimer (PDF)', ar: 'تحميل / طباعة (PDF)' },
  close: { fr: 'Fermer', ar: 'إغلاق' },
  view: { fr: 'Consulter', ar: 'معاينة' },
  details: { fr: 'Détails', ar: 'التفاصيل' },
  actions: { fr: 'Actions', ar: 'الإجراءات' },
  all: { fr: 'Tous', ar: 'الكل' },

  // News
  schoolNews: { fr: 'Actualités de l’école', ar: 'مستجدات وإعلانات المدرسة' },
  pinnedNews: { fr: 'Épinglé', ar: 'مثبّت' },
  categoryEvent: { fr: 'Événement', ar: 'تظاهرة' },
  categoryTrip: { fr: 'Sortie scolaire', ar: 'رحلة مدرسية' },
  categoryCelebration: { fr: 'Fête', ar: 'احتفال' },
  categoryInfo: { fr: 'Information', ar: 'إعلام' },
  categoryReminder: { fr: 'Rappel', ar: 'تذكير' },

  // Grades & Report Cards
  bulletinTitle: { fr: 'Bulletin Scolaire Officiel', ar: 'بطاقة الأعداد المدرسية الرسمية' },
  languagesSheetTitle: { fr: 'Fiche d’Évaluation des Langues Étrangères', ar: 'بطاقة تقييم اللغات الأجنبية' },
  generalAverage: { fr: 'Moyenne Générale', ar: 'المعدل العام' },
  classHighest: { fr: 'Moyenne max. classe', ar: 'أعلى معدل بالقسم' },
  classLowest: { fr: 'Moyenne min. classe', ar: 'أدنى معدل بالقسم' },
  behaviorRemarks: { fr: 'Observations sur l’assiduité et la discipline', ar: 'ملاحظات المواظبة والسلوك' },
  mentionHonor: { fr: 'Tableau d’Honneur avec Félicitations', ar: 'لوحة شرف مع تهنئة' },
  directorStamp: { fr: 'Le Directeur / La Direction', ar: 'المدير(ة) والإدارة' },
  parentSignature: { fr: 'Signature du Parent', ar: 'إمضاء الولي' },
  scale: { fr: 'Barème', ar: 'السلم' },
  coefficient: { fr: 'Coeff.', ar: 'الضارب' },
  score: { fr: 'Note / 20', ar: 'العدد / 20' },
  headmasterAppreciation: { fr: 'Appréciation du Directeur', ar: 'ملاحظة الإدارة' },

  // Attendance
  present: { fr: 'Présent', ar: 'حاضر' },
  absent: { fr: 'Absent', ar: 'غائب' },
  late: { fr: 'En retard', ar: 'متأخر' },
  justifyAbsence: { fr: 'Justifier cette absence', ar: 'تبرير هذا الغياب' },
  justificationReason: { fr: 'Motif de l’absence', ar: 'سبب الغياب' },
  medicalCert: { fr: 'Certificat médical / Pièce jointe', ar: 'شهادة طبية أو وثيقة مرفقة' },
  submitJustification: { fr: 'Envoyer la justification', ar: 'إرسال التبرير' },

  // Homework
  homeworkTitle: { fr: 'Cahier de textes & Devoirs', ar: 'كراس الدروس والواجبات المنزلية' },
  markAsDone: { fr: 'Marquer comme fait', ar: 'تم الإنجاز بنجاح' },
  completed: { fr: 'Terminé ! Bravo ! ⭐', ar: 'تم الإنجاز! أحسنت! ⭐' },
  dueDate: { fr: 'À rendre pour le', ar: 'تاريخ التسليم' },
  dueSoon: { fr: 'À rendre bientôt', ar: 'قريب الأجل' },

  // Fees & Bursar
  feesTitle: { fr: 'Échéancier & Paiements', ar: 'جدول المعاليم وتتبع الخلاص' },
  tndCurrency: { fr: 'TND (DT)', ar: 'د.ت' },
  feeStatusPaid: { fr: 'Payé', ar: 'تم الخلاص' },
  feeStatusPending: { fr: 'En attente', ar: 'في الانتظار' },
  feeStatusOverdue: { fr: 'En retard de paiement', ar: 'متأخر' },
  recordPayment: { fr: 'Enregistrer un paiement', ar: 'تسجيل خلاص جديد' },
  paymentMethod: { fr: 'Mode de paiement', ar: 'طريقة الدفع' },
  methodCash: { fr: 'Espèces (Caisse)', ar: 'نقداً' },
  methodCheque: { fr: 'Chèque', ar: 'شيك' },
  methodTransfer: { fr: 'Virement bancaire', ar: 'تحويل بنكي' },
  methodOther: { fr: 'Autre', ar: 'أخرى' },
  receiptNumber: { fr: 'Reçu N°', ar: 'وصل خلاص رقم' },
  printReceipt: { fr: 'Imprimer le Reçu', ar: 'طباعة الوصل' },

  // Appointments
  appointmentsTitle: { fr: 'Demande de Rendez-vous Enseignant', ar: 'طلب موعد مع المدرّس' },
  requestAppointment: { fr: 'Demander un rendez-vous', ar: 'طلب موعد جديد' },
  selectTeacher: { fr: 'Choisir l’enseignant(e)', ar: 'اختر المدرّس(ة)' },
  appointmentReason: { fr: 'Motif de l’entretien', ar: 'موضوع المقابلة' },
  proposedSlots: { fr: 'Horaires proposés par l’enseignant', ar: 'المواعيد المقترحة من قبل المدرّس' },
  confirmSlot: { fr: 'Confirmer ce créneau', ar: 'تأكيد هذا الموعد' },
  declineSlot: { fr: 'Décliner', ar: 'اعتذار' },
  appointmentPending: { fr: 'En attente de réponse', ar: 'في انتظار الرد' },
  appointmentConfirmed: { fr: 'Rendez-vous Confirmé', ar: 'موعد مؤكد' },

  // PWA Install Guide
  pwaInstallTitle: { fr: 'Installer Excellence School sur votre Mobile', ar: 'تثبيت التطبيق على هاتفك المحمول' },
  pwaInstallDesc: {
    fr: 'Accédez directement à l’application sans passer par le store, avec icône sur l’écran d’accueil et mode hors-ligne.',
    ar: 'استخدم التطبيق كأنه تطبيق هاتف رسمي بدون متجر، مع أيقونة على الشاشة الرئيسية والعمل دون انترنت.'
  },
  androidInstructions: { fr: 'Sur Android (Chrome)', ar: 'على هواتف أندرويد (متصفح كروم)' },
  androidStep1: { fr: '1. Appuyez sur le menu (les 3 points en haut à droite)', ar: '1. اضغط على خيارات المتصفح (النقاط الثلاث بالأعلى)' },
  androidStep2: { fr: '2. Cliquez sur « Ajouter à l’écran d’accueil »', ar: '2. اختر «إضافة إلى الشاشة الرئيسية»' },
  iosInstructions: { fr: 'Sur iPhone (Safari)', ar: 'على هواتف آيفون (متصفح سفاري)' },
  iosStep1: { fr: '1. Appuyez sur l’icône de Partage en bas de l’écran', ar: '1. اضغط على أيقونة المشاركة بالأسفل' },
  iosStep2: { fr: '2. Faites défiler et choisissez « Sur l’écran d’accueil »', ar: '2. اختر «إضافة إلى الصفحة الرئيسية»' }
};

@Injectable({
  providedIn: 'root'
})
export class I18nService {
  readonly currentLocale = signal<Locale>('fr');

  constructor() {
    // Check saved preference
    const saved = localStorage.getItem('esm_locale') as Locale | null;
    if (saved && (saved === 'fr' || saved === 'ar')) {
      this.setLocale(saved);
    } else {
      this.updateDirection('fr');
    }

    // Reactively update HTML tag attributes when locale changes
    effect(() => {
      const loc = this.currentLocale();
      this.updateDirection(loc);
    });
  }

  setLocale(locale: Locale) {
    this.currentLocale.set(locale);
    localStorage.setItem('esm_locale', locale);
    this.updateDirection(locale);
  }

  toggleLocale() {
    this.setLocale(this.currentLocale() === 'fr' ? 'ar' : 'fr');
  }

  t(key: string): string {
    const entry = DICTIONARY[key];
    if (!entry) return key;
    return entry[this.currentLocale()] || entry.fr || key;
  }

  isRtl(): boolean {
    return this.currentLocale() === 'ar';
  }

  private updateDirection(locale: Locale) {
    if (typeof document !== 'undefined') {
      const isArabic = locale === 'ar';
      document.documentElement.lang = locale;
      document.documentElement.dir = isArabic ? 'rtl' : 'ltr';
      if (isArabic) {
        document.body.classList.add('rtl-mode');
        document.body.classList.remove('ltr-mode');
      } else {
        document.body.classList.add('ltr-mode');
        document.body.classList.remove('rtl-mode');
      }
    }
  }
}

