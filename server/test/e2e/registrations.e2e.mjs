// End-to-end test of parent registration and validation, against a running API
// whose database holds database/schema.sql + database/seed-demo.sql (demo accounts).
// Usage: API_URL=http://localhost:3000/api node test/e2e/registrations.e2e.mjs
const A = process.env.API_URL || 'http://localhost:3000/api';
const results = [];
const check = (label, cond, extra = '') => results.push(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? '  — ' + extra : ''}`);
async function call(method, path, token, body) {
  const res = await fetch(A + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let json = null; try { json = await res.json(); } catch {}
  return { status: res.status, json };
}
let up = false;
for (let i = 0; i < 60 && !up; i++) {
  try { up = (await fetch(A + '/health')).ok; } catch { await new Promise(r => setTimeout(r, 1000)); }
}
if (!up) { console.error('API not reachable at ' + A); process.exit(1); }
const stamp = Date.now();
const admin = (await call('POST', '/auth/login', null, { identifier: 'admin@excellence.tn', password: 'Admin123!' })).json.token;

// 1. Registration without any child
const emailA = `sans.enfant.${stamp}@test.tn`;
let r = await call('POST', '/auth/register', null, { fullName: 'Parent Sans Enfant', phone: '+216 20 000 001', email: emailA, password: 'Secret123', relationship: 'pere' });
check('registration without children accepted', r.status === 201 && r.json.user.active === false, r.json?.message);
r = await call('POST', '/auth/register', null, { fullName: 'P', phone: '1', email: `vide.${stamp}@test.tn`, password: 'Secret123', children: [] });
check('registration with an empty children list accepted', r.status === 201);
r = await call('POST', '/auth/login', null, { identifier: emailA, password: 'Secret123' });
check('pending account cannot sign in yet', r.status === 401);

// 2. Admin sees and activates it
r = await call('GET', '/auth/pending-accounts', admin);
const acc = r.json.find(a => a.email === emailA);
check('admin sees the account in pending registrations', !!acc);
r = await call('GET', '/parents', admin);
check('parents list shows it as "pending"', r.json.find(p => p.email === emailA)?.status === 'pending');
r = await call('GET', '/auth/pending-accounts', (await call('POST', '/auth/login', null, { identifier: 'teacher@excellence.tn', password: 'Teacher123!' })).json.token);
check('a teacher cannot list pending registrations', r.status === 403);
r = await call('POST', `/auth/pending-accounts/${acc.id}/activate`, admin);
check('admin activates the account', r.status === 201);
r = await call('POST', `/auth/pending-accounts/${acc.id}/activate`, admin);
check('cannot activate twice (no longer pending)', r.status === 404);
const parentToken = (await call('POST', '/auth/login', null, { identifier: emailA, password: 'Secret123' })).json?.token;
check('activated parent can sign in', !!parentToken);

// 3. Reject an account without child → deleted
const vide = (await call('GET', '/auth/pending-accounts', admin)).json.find(a => a.email === `vide.${stamp}@test.tn`);
r = await call('POST', `/auth/pending-accounts/${vide.id}/reject`, admin);
check('admin refuses an account without child → deleted', r.status === 201 && r.json.deleted === true);
r = await call('POST', '/auth/login', null, { identifier: `vide.${stamp}@test.tn`, password: 'Secret123' });
check('refused account no longer exists', r.status === 401);
r = await call('POST', `/auth/pending-accounts/usr-teacher-1/reject`, admin);
check('reject cannot delete any other account', r.status === 404);

// 4. Parent declares a child later; admin approves WITHOUT an existing student
r = await call('POST', '/me/link-requests', parentToken, { firstName: 'Nour', lastName: `Nouveau${stamp}`, classId: 'cls-2a', relationship: 'pere' });
check('activated parent declares a child later', r.status === 201, r.status === 201 ? '' : JSON.stringify(r.json));
let req = (await call('GET', '/auth/link-requests', admin)).json.find(x => x.child_last_name === `Nouveau${stamp}`);
r = await call('POST', `/auth/link-requests/${req.id}/review`, admin, { decision: 'approved' });
check('approval without existing student → student created', r.status === 201 && r.json.student_created === true && r.json.student?.class_id === 'cls-2a', JSON.stringify(r.json?.message ?? ''));
const created = r.json.student;
r = await call('GET', '/students', admin);
check('new student appears in the school list, in the declared class', r.json.some(s => s.id === created.id && s.class_name === '2ème A'));
r = await call('GET', '/me/children', parentToken);
check('parent now sees the child', r.json.some(c => c.id === created.id || c.student_id === created.id));

// 5. Registration with a child but no class; approval must ask for a class
const emailB = `avec.enfant.${stamp}@test.tn`;
await call('POST', '/auth/register', null, { fullName: 'Parent B', phone: '+216 20 000 002', email: emailB, password: 'Secret123', children: [{ firstName: 'Lina', lastName: `SansClasse${stamp}` }] });
req = (await call('GET', '/auth/link-requests', admin)).json.find(x => x.child_last_name === `SansClasse${stamp}`);
r = await call('POST', `/auth/link-requests/${req.id}/review`, admin, { decision: 'approved' });
check('no class declared and none chosen → clear 400', r.status === 400, r.json?.message);
r = await call('POST', `/auth/link-requests/${req.id}/review`, admin, { decision: 'approved', classId: 'cls-inexistante' });
check('unknown class → 400', r.status === 400, r.json?.message);
r = await call('POST', `/auth/link-requests/${req.id}/review`, admin, { decision: 'approved', classId: 'cls-3a' });
check('admin picks the class → student created there', r.status === 201 && r.json.student?.class_id === 'cls-3a');
r = await call('GET', '/auth/pending-accounts', admin);
check('parent with a request is not listed as "without child"', !r.json.some(a => a.email === emailB));

// 6. Matching an existing student still works
await call('POST', '/auth/register', null, { fullName: 'Parent C', phone: '3', email: `c.${stamp}@test.tn`, password: 'Secret123', children: [{ firstName: 'X', lastName: `Existant${stamp}` }] });
req = (await call('GET', '/auth/link-requests', admin)).json.find(x => x.child_last_name === `Existant${stamp}`);
const before = (await call('GET', '/students', admin)).json.length;
r = await call('POST', `/auth/link-requests/${req.id}/review`, admin, { decision: 'approved', studentId: created.id });
const after = (await call('GET', '/students', admin)).json.length;
check('linking an existing student creates no duplicate', r.status === 201 && r.json.student_created === false && before === after);

console.log(results.join('\n'));
const passed = results.filter(l => l.startsWith('PASS')).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
