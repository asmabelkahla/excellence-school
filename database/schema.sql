-- Excellence School — database structure (idempotent: safe to run again on an existing database).
-- Contains the reference data every school needs (domains, subjects, French/English components)
-- and NO account. Demo data lives in seed-demo.sql (local development only).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('admin', 'moderator', 'econome', 'teacher', 'parent')),
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT UNIQUE,
  password TEXT,
  locale TEXT NOT NULL DEFAULT 'fr',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_super_admin BOOLEAN NOT NULL DEFAULT FALSE,
  invited_by_id TEXT,
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  tokens_valid_after TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS classes (
  id TEXT PRIMARY KEY,
  school_year_id TEXT,
  level_id TEXT,
  name TEXT NOT NULL,
  student_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  first_name_ar TEXT,
  last_name_ar TEXT,
  birth_date DATE,
  gender TEXT CHECK (gender IN ('F', 'M')),
  class_id TEXT,
  class_name TEXT,
  level_id TEXT
);

-- Teachers assigned to a class (a class can have several teachers).
CREATE TABLE IF NOT EXISTS class_teachers (
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (class_id, teacher_id)
);

CREATE TABLE IF NOT EXISTS parent_students (
  parent_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL,
  PRIMARY KEY (parent_id, student_id)
);

CREATE TABLE IF NOT EXISTS link_requests (
  id TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL REFERENCES users(id),
  parent_name TEXT,
  parent_phone TEXT,
  parent_email TEXT,
  child_first_name TEXT NOT NULL,
  child_last_name TEXT NOT NULL,
  declared_class_id TEXT,
  declared_class_name TEXT,
  relationship TEXT CHECK (relationship IN ('mere', 'pere', 'tuteur')),
  student_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS staff_invitations (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'moderator', 'econome', 'teacher')),
  full_name TEXT NOT NULL,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  invited_by_id TEXT NOT NULL REFERENCES users(id),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

-- Migration for databases created before the relationship column existed
ALTER TABLE link_requests ADD COLUMN IF NOT EXISTS relationship TEXT;
-- When the admin approved / refused the request (a refusal can be undone for 24 h).
ALTER TABLE link_requests ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tokens_valid_after TIMESTAMPTZ;
-- Google account linked to this user ("sub" claim of the Google ID token). Parents only.
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub TEXT UNIQUE;
-- Relationship codes are unaccented (mere / pere / tuteur) everywhere.
UPDATE parent_students SET relationship = 'mere' WHERE relationship IN ('mère', 'Mère');
UPDATE parent_students SET relationship = 'pere' WHERE relationship IN ('père', 'Père');

-- =====================================================================
-- Academics: subjects, grades and report cards (bulletins)
-- =====================================================================

CREATE TABLE IF NOT EXISTS domains (
  id TEXT PRIMARY KEY,
  name_fr TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS subjects (
  id TEXT PRIMARY KEY,
  domain_id TEXT NOT NULL REFERENCES domains(id),
  name_fr TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  is_foreign_language BOOLEAN NOT NULL DEFAULT FALSE,
  position INTEGER NOT NULL DEFAULT 0
);

-- Graded parts of a subject (e.g. French: récitation /5, dictée /20 ...).
CREATE TABLE IF NOT EXISTS subject_components (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  name_fr TEXT NOT NULL,
  name_ar TEXT,
  max_score NUMERIC(5,2) NOT NULL CHECK (max_score > 0),
  position INTEGER NOT NULL DEFAULT 0
);

-- Which subjects a class follows, with which teacher and coefficient.
CREATE TABLE IF NOT EXISTS class_subjects (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL REFERENCES subjects(id),
  teacher_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  coefficient NUMERIC(4,2) NOT NULL DEFAULT 1 CHECK (coefficient > 0),
  UNIQUE (class_id, subject_id)
);

-- One row per student / subject / trimester / component ('' = whole subject, graded /20).
CREATE TABLE IF NOT EXISTS grades (
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_subject_id TEXT NOT NULL REFERENCES class_subjects(id) ON DELETE CASCADE,
  trimester SMALLINT NOT NULL CHECK (trimester BETWEEN 1 AND 3),
  component_id TEXT NOT NULL DEFAULT '',
  score NUMERIC(5,2) NOT NULL CHECK (score >= 0),
  max_score NUMERIC(5,2) NOT NULL CHECK (max_score > 0),
  entered_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (student_id, class_subject_id, trimester, component_id),
  CHECK (score <= max_score)
);

-- Teacher's observation for a student in a subject, per trimester.
CREATE TABLE IF NOT EXISTS subject_remarks (
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_subject_id TEXT NOT NULL REFERENCES class_subjects(id) ON DELETE CASCADE,
  trimester SMALLINT NOT NULL CHECK (trimester BETWEEN 1 AND 3),
  remark TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (student_id, class_subject_id, trimester)
);

-- A bulletin is a snapshot (content JSONB) computed from the grades, frozen once published.
CREATE TABLE IF NOT EXISTS report_cards (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id TEXT NOT NULL,
  trimester SMALLINT NOT NULL CHECK (trimester BETWEEN 1 AND 3),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  content JSONB NOT NULL,
  general_average NUMERIC(5,2),
  class_max_average NUMERIC(5,2),
  class_min_average NUMERIC(5,2),
  class_average NUMERIC(5,2),
  rank INTEGER,
  class_size INTEGER,
  missing_count INTEGER NOT NULL DEFAULT 0,
  behavior_remarks TEXT,
  mention TEXT,
  headmaster_remarks TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  UNIQUE (student_id, trimester)
);

INSERT INTO domains (id, name_fr, name_ar, position) VALUES
  ('dom-ar', 'Langue arabe', 'مجال اللغة العربية', 1),
  ('dom-sc', 'Sciences et technologie', 'مجال العلوم والتكنولوجيا', 2),
  ('dom-ed', 'Éducation (socialisation et arts)', 'مجال التنشئة الاجتماعية والفنون', 3),
  ('dom-fl', 'Langues étrangères', 'مجال اللغات الأجنبية', 4)
ON CONFLICT (id) DO NOTHING;

INSERT INTO subjects (id, domain_id, name_fr, name_ar, is_foreign_language, position) VALUES
  ('sbj-ar-oral', 'dom-ar', 'Communication orale et récitation', 'التواصل الشفوي والمحفوظات', FALSE, 1),
  ('sbj-ar-read', 'dom-ar', 'Lecture', 'القراءة', FALSE, 2),
  ('sbj-ar-gram', 'dom-ar', 'Grammaire et écriture', 'قواعد اللغة والخط', FALSE, 3),
  ('sbj-ar-prod', 'dom-ar', 'Production écrite', 'الإنتاج الكتابي', FALSE, 4),
  ('sbj-math', 'dom-sc', 'Mathématiques', 'الرياضيات', FALSE, 1),
  ('sbj-sci', 'dom-sc', 'Éveil scientifique', 'الإيقاظ العلمي', FALSE, 2),
  ('sbj-tech', 'dom-sc', 'Éducation technologique', 'التربية التكنولوجية', FALSE, 3),
  ('sbj-islam', 'dom-ed', 'Éducation islamique', 'التربية الإسلامية', FALSE, 1),
  ('sbj-hist', 'dom-ed', 'Histoire et géographie', 'التاريخ والجغرافيا', FALSE, 2),
  ('sbj-art', 'dom-ed', 'Éducation plastique et musicale', 'التربية التشكيلية والموسيقية', FALSE, 3),
  ('sbj-sport', 'dom-ed', 'Éducation physique', 'التربية البدنية', FALSE, 4),
  ('sbj-fr', 'dom-fl', 'Français', 'الفرنسية', TRUE, 1),
  ('sbj-en', 'dom-fl', 'Anglais', 'الإنجليزية', TRUE, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO subject_components (id, subject_id, name_fr, name_ar, max_score, position) VALUES
  ('cmp-fr-recit', 'sbj-fr', 'Récitation', 'المحفوظات', 5, 1),
  ('cmp-fr-oral', 'sbj-fr', 'Expression orale', 'التعبير الشفوي', 15, 2),
  ('cmp-fr-lect-voix', 'sbj-fr', 'Lecture à haute voix', 'القراءة الجهرية', 6, 3),
  ('cmp-fr-lect-comp', 'sbj-fr', 'Lecture compréhension', 'فهم المقروء', 14, 4),
  ('cmp-fr-gram', 'sbj-fr', 'Grammaire', 'قواعد اللغة', 10, 5),
  ('cmp-fr-conj', 'sbj-fr', 'Conjugaison', 'تصريف الأفعال', 10, 6),
  ('cmp-fr-orth', 'sbj-fr', 'Orthographe-dictée', 'الإملاء', 20, 7),
  ('cmp-fr-prod', 'sbj-fr', 'Production écrite', 'الإنتاج الكتابي', 20, 8),
  ('cmp-en-listen', 'sbj-en', 'Listening & Speaking', 'الاستماع والتحدث', 10, 1),
  ('cmp-en-read', 'sbj-en', 'Reading', 'القراءة', 5, 2),
  ('cmp-en-write', 'sbj-en', 'Writing & Vocabulary', 'الكتابة والمفردات', 5, 3)
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- Parent <-> teacher messaging ("carnet de liaison")
-- One thread per student and teacher. Only that teacher and the parents
-- linked to the student can read it.
-- =====================================================================

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  teacher_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, teacher_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES users(id),
  -- 'note' = a teacher's note about the student (shown highlighted to the parents).
  kind TEXT NOT NULL DEFAULT 'message' CHECK (kind IN ('message', 'note')),
  category TEXT CHECK (category IN ('encouragement', 'travail', 'comportement', 'information')),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages (conversation_id, created_at);

CREATE TABLE IF NOT EXISTS conversation_reads (
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (conversation_id, user_id)
);

-- =====================================================================
-- Homework and notifications
-- =====================================================================

CREATE TABLE IF NOT EXISTS homework (
  id TEXT PRIMARY KEY,
  class_subject_id TEXT NOT NULL REFERENCES class_subjects(id) ON DELETE CASCADE,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 150),
  description TEXT CHECK (length(description) <= 3000),
  due_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS homework_class_due_idx ON homework (class_id, due_date);

-- Ticked by a parent, per child.
CREATE TABLE IF NOT EXISTS homework_done (
  homework_id TEXT NOT NULL REFERENCES homework(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  done_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (homework_id, student_id)
);

-- In-app notifications (the bell). Push notifications mirror them.
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('homework', 'message', 'report_card', 'info')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  link TEXT,
  student_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, created_at DESC);

-- One row per device that accepted push notifications.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =====================================================================
-- School calendar
-- public  = visible to everyone, parents included
-- private = staff only (admin, moderator, econome, teachers)
-- Only the admin and the moderator create / edit / delete events.
-- =====================================================================

CREATE TABLE IF NOT EXISTS school_events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  description TEXT CHECK (length(description) <= 1000),
  category TEXT NOT NULL CHECK (category IN ('reunion', 'examen', 'vacances', 'fete', 'sortie', 'autre')),
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  all_day BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at IS NULL OR ends_at >= starts_at)
);
CREATE INDEX IF NOT EXISTS school_events_starts_idx ON school_events (starts_at);
