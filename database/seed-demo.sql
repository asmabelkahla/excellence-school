-- Excellence School — DEMO DATA, for local development only.
-- ⚠ Public passwords (Admin123!, Parent123!...): never load this file into a production database.
-- Run after schema.sql. Idempotent (ON CONFLICT DO NOTHING).

INSERT INTO users (id, role, full_name, phone, email, password, locale, active, avatar_url, created_at, is_super_admin)
VALUES
  ('usr-parent-1', 'parent', 'Asma Belkahla', '+216 98 987 654', 'asma.belkahla@excellence.tn', crypt('Parent123!', gen_salt('bf', 12)), 'fr', TRUE, 'assets/avatars/parent.png', NOW(), FALSE),
  ('usr-admin-1', 'admin', 'Direction Excellence School', '+216 73 456 789', 'admin@excellence.tn', crypt('Admin123!', gen_salt('bf', 12)), 'fr', TRUE, 'assets/avatars/admin.png', NOW(), TRUE),
  ('usr-moderator-1', 'moderator', 'M. Mehdi Ben Salem', '+216 52 112 334', 'moderator@excellence.tn', crypt('Moderator123!', gen_salt('bf', 12)), 'fr', TRUE, 'assets/avatars/admin.png', NOW(), FALSE),
  ('usr-econome-1', 'econome', 'M. Nizar Chaabane', '+216 50 111 222', 'econome@excellence.tn', crypt('Econome123!', gen_salt('bf', 12)), 'fr', TRUE, 'assets/avatars/econome.png', NOW(), FALSE),
  ('usr-teacher-1', 'teacher', 'Mme Salma Kallel', '+216 22 345 678', 'teacher@excellence.tn', crypt('Teacher123!', gen_salt('bf', 12)), 'fr', TRUE, 'assets/avatars/teacher1.png', NOW(), FALSE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO classes (id, school_year_id, level_id, name, student_count)
VALUES
  ('cls-2a', 'sy-2026', 'lvl-2', '2ème A', 21),
  ('cls-6f', 'sy-2026', 'lvl-6', '6ème F', 18),
  ('cls-3a', 'sy-2026', 'lvl-3', '3ème A', 22)
ON CONFLICT (id) DO NOTHING;

INSERT INTO students (id, first_name, last_name, first_name_ar, last_name_ar, birth_date, gender, class_id, class_name, level_id)
VALUES
  ('std-yakine-chaabane', 'Yakine', 'Chaabane', 'ياسمين', 'الشاباني', '2015-02-18', 'F', 'cls-2a', '2ème A', 'lvl-2'),
  ('std-elae-chaabane', 'Elae Errahmen', 'Chaabane', 'إلاء الرحمن', 'الشاباني', '2013-10-08', 'F', 'cls-6f', '6ème F', 'lvl-6')
ON CONFLICT (id) DO NOTHING;

INSERT INTO class_teachers (class_id, teacher_id)
VALUES
  ('cls-2a', 'usr-teacher-1'),
  ('cls-3a', 'usr-teacher-1')
ON CONFLICT DO NOTHING;

INSERT INTO parent_students (parent_id, student_id, relationship)
VALUES
  ('usr-parent-1', 'std-yakine-chaabane', 'mere'),
  ('usr-parent-1', 'std-elae-chaabane', 'mere')
ON CONFLICT DO NOTHING;

-- Demo classmates, so class statistics (max, min, rank) mean something.
INSERT INTO students (id, first_name, last_name, first_name_ar, last_name_ar, birth_date, gender, class_id, class_name, level_id) VALUES
  ('std-demo-2a-1', 'Adam', 'Ben Salah', 'آدم', 'بن صالح', '2015-05-02', 'M', 'cls-2a', '2ème A', 'lvl-2'),
  ('std-demo-2a-2', 'Mariem', 'Trabelsi', 'مريم', 'الطرابلسي', '2015-09-14', 'F', 'cls-2a', '2ème A', 'lvl-2'),
  ('std-demo-2a-3', 'Youssef', 'Gharbi', 'يوسف', 'الغربي', '2015-01-27', 'M', 'cls-2a', '2ème A', 'lvl-2'),
  ('std-demo-2a-4', 'Lina', 'Haddad', 'لينة', 'حداد', '2015-11-03', 'F', 'cls-2a', '2ème A', 'lvl-2'),
  ('std-demo-6f-1', 'Omar', 'Jaziri', 'عمر', 'الجزيري', '2013-03-19', 'M', 'cls-6f', '6ème F', 'lvl-6'),
  ('std-demo-6f-2', 'Sarra', 'Mejri', 'سارة', 'المجري', '2013-07-08', 'F', 'cls-6f', '6ème F', 'lvl-6'),
  ('std-demo-6f-3', 'Aziz', 'Ben Ammar', 'عزيز', 'بن عمار', '2013-12-22', 'M', 'cls-6f', '6ème F', 'lvl-6')
ON CONFLICT (id) DO NOTHING;

-- Every seeded class follows every subject. Teacher = first class teacher, if any.
INSERT INTO class_subjects (id, class_id, subject_id, teacher_id, coefficient)
SELECT 'cs-' || substr(c.id, 5) || '-' || substr(s.id, 5),
       c.id, s.id,
       (SELECT ct.teacher_id FROM class_teachers ct WHERE ct.class_id = c.id ORDER BY ct.teacher_id LIMIT 1),
       CASE s.id WHEN 'sbj-math' THEN 2 WHEN 'sbj-sci' THEN 1.5 WHEN 'sbj-fr' THEN 1.5 ELSE 1 END
FROM classes c CROSS JOIN subjects s
WHERE c.id IN ('cls-2a', 'cls-3a', 'cls-6f')
ON CONFLICT (class_id, subject_id) DO NOTHING;

-- Demo trimester-1 grades (deterministic, half points, roughly 11 to 19 / 20).
INSERT INTO grades (student_id, class_subject_id, trimester, component_id, score, max_score, entered_by)
SELECT st.id, cs.id, 1, '',
       LEAST(20, ROUND((20 * (0.55 + (abs(hashtext(st.id || cs.id)) % 41) / 100.0)) * 2) / 2.0), 20, 'seed'
FROM students st
JOIN class_subjects cs ON cs.class_id = st.class_id
WHERE st.class_id IN ('cls-2a', 'cls-6f')
  AND NOT EXISTS (SELECT 1 FROM subject_components sc WHERE sc.subject_id = cs.subject_id)
ON CONFLICT DO NOTHING;

INSERT INTO grades (student_id, class_subject_id, trimester, component_id, score, max_score, entered_by)
SELECT st.id, cs.id, 1, sc.id,
       LEAST(sc.max_score, ROUND((sc.max_score * (0.55 + (abs(hashtext(st.id || sc.id)) % 41) / 100.0)) * 2) / 2.0), sc.max_score, 'seed'
FROM students st
JOIN class_subjects cs ON cs.class_id = st.class_id
JOIN subject_components sc ON sc.subject_id = cs.subject_id
WHERE st.class_id IN ('cls-2a', 'cls-6f')
ON CONFLICT DO NOTHING;

-- Demo homework for 2ème A (due in the coming days, relative to the seed date).
INSERT INTO homework (id, class_subject_id, class_id, teacher_id, title, description, due_date) VALUES
  ('hw-demo-1', 'cs-2a-math', 'cls-2a', 'usr-teacher-1', 'Tables de multiplication 2 et 3', 'Réciter les tables de 2 et de 3. Exercices 4 et 5 page 32 du cahier.', CURRENT_DATE + 1),
  ('hw-demo-2', 'cs-2a-fr', 'cls-2a', 'usr-teacher-1', 'Poésie « L’automne »', 'Apprendre les deux premières strophes et illustrer la poésie.', CURRENT_DATE + 3),
  ('hw-demo-3', 'cs-2a-ar-read', 'cls-2a', 'usr-teacher-1', 'Lecture : texte page 18', 'Lire le texte à voix haute deux fois et répondre aux questions 1 à 3.', CURRENT_DATE + 2)
ON CONFLICT (id) DO NOTHING;

-- Demo calendar (relative to the seed date): public events for families, private ones for staff.
INSERT INTO school_events (id, title, description, category, visibility, starts_at, ends_at, all_day, created_by) VALUES
  ('evt-demo-1', 'Réunion parents-enseignants', 'Rencontre individuelle avec les enseignants, de 15 h à 18 h.', 'reunion', 'public', date_trunc('day', NOW()) + INTERVAL '6 days 15 hours', date_trunc('day', NOW()) + INTERVAL '6 days 18 hours', FALSE, 'usr-admin-1'),
  ('evt-demo-2', 'Sortie au musée de Monastir', 'Classes de 2ème et 3ème année. Prévoir un goûter.', 'sortie', 'public', date_trunc('day', NOW()) + INTERVAL '10 days', NULL, TRUE, 'usr-moderator-1'),
  ('evt-demo-3', 'Conseil des enseignants', 'Préparation des bulletins du 1er trimestre.', 'reunion', 'private', date_trunc('day', NOW()) + INTERVAL '3 days 14 hours', date_trunc('day', NOW()) + INTERVAL '3 days 16 hours', FALSE, 'usr-admin-1'),
  ('evt-demo-4', 'Examens du 1er trimestre', 'Semaine des évaluations.', 'examen', 'public', date_trunc('day', NOW()) + INTERVAL '14 days', date_trunc('day', NOW()) + INTERVAL '18 days 23 hours', TRUE, 'usr-admin-1'),
  ('evt-demo-5', 'Vacances d’hiver', 'Reprise des cours le lundi suivant.', 'vacances', 'public', date_trunc('day', NOW()) + INTERVAL '30 days', date_trunc('day', NOW()) + INTERVAL '44 days 23 hours', TRUE, 'usr-admin-1')
ON CONFLICT (id) DO NOTHING;
