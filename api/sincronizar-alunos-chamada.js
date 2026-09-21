const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };

function send(res, status, payload) {
  res.status(status).setHeader('Cache-Control', 'no-store').json(payload);
}

function requiredEnvironment() {
  const environment = {
    CHAMADA_SUPABASE_URL: process.env.CHAMADA_SUPABASE_URL,
    CHAMADA_SUPABASE_SERVICE_ROLE_KEY: process.env.CHAMADA_SUPABASE_SERVICE_ROLE_KEY,
    BIBLIOTECA_SUPABASE_URL: process.env.BIBLIOTECA_SUPABASE_URL,
    BIBLIOTECA_SUPABASE_SERVICE_ROLE_KEY: process.env.BIBLIOTECA_SUPABASE_SERVICE_ROLE_KEY
  };
  const missing = Object.entries(environment).filter(([, value]) => !value).map(([key]) => key);
  if (missing.length) throw new Error(`Configuração protegida ausente: ${missing.join(', ')}.`);
  return {
    chamadaUrl: environment.CHAMADA_SUPABASE_URL.replace(/\/$/, ''),
    chamadaServiceKey: environment.CHAMADA_SUPABASE_SERVICE_ROLE_KEY,
    chamadaSchoolId: process.env.CHAMADA_SCHOOL_ID || null,
    bibliotecaUrl: environment.BIBLIOTECA_SUPABASE_URL.replace(/\/$/, ''),
    bibliotecaServiceKey: environment.BIBLIOTECA_SUPABASE_SERVICE_ROLE_KEY
  };
}

function serviceHeaders(serviceKey) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    Accept: 'application/json'
  };
}

async function parseResponse(response, fallback) {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = body?.message || body?.error_description || body?.error || fallback;
    throw new Error(detail);
  }
  return body;
}

async function validateAdministrator(config, token) {
  const userResponse = await fetch(`${config.bibliotecaUrl}/auth/v1/user`, {
    headers: {
      apikey: config.bibliotecaServiceKey,
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    }
  });
  const user = await parseResponse(userResponse, 'Sessão administrativa inválida.');

  const params = new URLSearchParams({
    select: 'id,tipo,ativo',
    id: `eq.${user.id}`,
    limit: '1'
  });
  const profileResponse = await fetch(`${config.bibliotecaUrl}/rest/v1/perfis?${params}`, {
    headers: serviceHeaders(config.bibliotecaServiceKey)
  });
  const profiles = await parseResponse(profileResponse, 'Não foi possível validar o perfil administrativo.');
  const profile = profiles?.[0];
  if (!profile?.ativo || !['bibliotecario', 'gestao_escolar'].includes(profile.tipo)) {
    throw new Error('Esta conta não possui permissão para sincronizar os cadastros.');
  }
}

async function fetchAll(url, headers) {
  const rows = [];
  const pageSize = 1000;
  for (let offset = 0; offset < 10000; offset += pageSize) {
    const response = await fetch(url, {
      headers: { ...headers, Range: `${offset}-${offset + pageSize - 1}` }
    });
    const page = await parseResponse(response, 'Não foi possível consultar o Chamada Escolar.');
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
  throw new Error('A consulta excedeu o limite de segurança de 10.000 registros.');
}

async function readChamada(config) {
  const headers = serviceHeaders(config.chamadaServiceKey);
  const classParams = new URLSearchParams({
    select: 'id,name,grade,shift,academic_year_id,active,is_test,school_id',
    active: 'eq.true',
    is_test: 'eq.false',
    order: 'shift.asc,name.asc'
  });
  if (config.chamadaSchoolId) classParams.set('school_id', `eq.${config.chamadaSchoolId}`);

  const classes = await fetchAll(`${config.chamadaUrl}/rest/v1/classes?${classParams}`, headers);
  const schoolIds = [...new Set(classes.map((item) => item.school_id).filter(Boolean))];
  if (!config.chamadaSchoolId && schoolIds.length === 0) {
    throw new Error('Nenhuma escola com turmas oficiais ativas foi encontrada no Chamada.');
  }
  if (!config.chamadaSchoolId && schoolIds.length > 1) {
    throw new Error('Foi encontrada mais de uma escola no Chamada. Configure CHAMADA_SCHOOL_ID na Vercel.');
  }
  const schoolId = config.chamadaSchoolId || schoolIds[0];

  const enrollmentParams = new URLSearchParams({
    select: 'id,student_id,class_id,status,start_date,end_date,students!inner(id,full_name,registration,active)',
    school_id: `eq.${schoolId}`,
    status: 'eq.active',
    'students.active': 'eq.true',
    order: 'class_id.asc,roster_order.asc'
  });

  const enrollments = await fetchAll(`${config.chamadaUrl}/rest/v1/enrollments?${enrollmentParams}`, headers);

  const activeClassIds = new Set(classes.map((item) => item.id));
  const turmas = classes.map((item) => ({
    chamada_class_id: item.id,
    academic_year_id: item.academic_year_id,
    nome: item.name,
    serie: item.grade,
    turno: item.shift
  }));

  const uniqueStudents = new Map();
  enrollments.forEach((enrollment) => {
    const student = enrollment.students;
    if (!student || !activeClassIds.has(enrollment.class_id) || !student.registration) return;
    uniqueStudents.set(student.id, {
      chamada_student_id: student.id,
      chamada_enrollment_id: enrollment.id,
      chamada_class_id: enrollment.class_id,
      codigo_sgde: String(student.registration).trim(),
      nome: String(student.full_name || '').trim()
    });
  });

  const alunos = [...uniqueStudents.values()].filter((item) => item.nome && item.codigo_sgde);
  if (!turmas.length || !alunos.length) {
    throw new Error('O Chamada Escolar não retornou turmas e alunos ativos para a escola configurada.');
  }
  return { turmas, alunos };
}

async function writeBiblioteca(config, payload) {
  const response = await fetch(`${config.bibliotecaUrl}/rest/v1/rpc/sincronizar_cadastros_chamada`, {
    method: 'POST',
    headers: {
      ...serviceHeaders(config.bibliotecaServiceKey),
      ...JSON_HEADERS,
      Prefer: 'return=representation'
    },
    body: JSON.stringify({ p_turmas: payload.turmas, p_alunos: payload.alunos })
  });
  return parseResponse(response, 'Não foi possível gravar os cadastros na Biblioteca.');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { ok: false, message: 'Método não permitido.' });
  }

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return send(res, 401, { ok: false, message: 'Entre novamente no painel administrativo.' });

  try {
    const config = requiredEnvironment();
    await validateAdministrator(config, token);
    const payload = await readChamada(config);
    const result = await writeBiblioteca(config, payload);
    return send(res, 200, { ok: true, ...result });
  } catch (error) {
    console.error('Falha na sincronização do Chamada Escolar:', error);
    return send(res, 500, { ok: false, message: error?.message || 'Não foi possível sincronizar os cadastros.' });
  }
}
