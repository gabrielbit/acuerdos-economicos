import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Pool } = pg;

interface FamilyData {
  name: string;
  parentNames: string;
  email: string;
  status: 'asignado' | 'en_definicion' | 'pendiente' | 'rechazado' | 'suspendido' | 'vencido' | 'entrevista_agendada';
  observations: string;
  startMonth: string;
  endMonth: string;
  students: {
    name: string;
    grade: string;
    level: 'jardin' | 'primaria' | 'secundaria' | '12vo';
    discountPct: number;
  }[];
}

function gradeToLevel(grade: string): 'jardin' | 'primaria' | 'secundaria' | '12vo' {
  const g = grade.toLowerCase().trim();
  if (g.includes('jardin') || g.includes('jardín')) return 'jardin';
  if (g.includes('12vo')) return '12vo';
  if (g.includes('ep') || g.includes('1ro') || g.includes('2do') || g.includes('3ro')) return 'primaria';
  // 7mo en adelante es secundaria
  if (['7mo', '8vo', '9no', '10mo', '11vo'].some(x => g.includes(x))) return 'secundaria';
  return 'primaria';
}

const families: FamilyData[] = [
  {
    name: 'Hartkopf',
    parentNames: 'Eduardo y Celia',
    email: 'arquerozurdo@gmail.com',
    status: 'asignado',
    observations: 'CITADO 02/03 18,15 A eduardo le ofrecieron retiro voluntario, celia no tiene aumentos desde hace 1 año',
    startMonth: 'MARZO',
    endMonth: 'AGOSTO',
    students: [
      { name: 'Federico', grade: 'EP4', level: 'primaria', discountPct: 25 },
    ],
  },
  {
    name: 'Korte - Cano',
    parentNames: 'Jorgelina y Andres',
    email: 'jorgelinacano@gmail.com',
    status: 'asignado',
    observations: 'Subtituladora, clases. Citado 11/08. Andres no se hace cargo, no tuvo actualizaciones de sueldo - pide 20%',
    startMonth: 'MARZO',
    endMonth: 'AGOSTO',
    students: [
      { name: 'Tobías', grade: '8vo', level: 'secundaria', discountPct: 10 },
      { name: 'Joaquin', grade: '11vo', level: 'secundaria', discountPct: 10 },
    ],
  },
  {
    name: 'Caporale',
    parentNames: 'Natalia y Fabian',
    email: 'silviajhane@gmail.com',
    status: 'vencido',
    observations: 'Matilda se fue al Esnaola',
    startMonth: 'MARZO',
    endMonth: 'AGOSTO',
    students: [
      { name: 'Keira', grade: '12vo', level: '12vo', discountPct: 0 },
    ],
  },
  {
    name: 'Tasso Eschoyes',
    parentNames: 'Liliana',
    email: 'liliana_tasso@hotmail.com',
    status: 'vencido',
    observations: '300% aumento de luz de 450 alumnos pasaron a 150. Plantea dificultades en todas las áreas de su profesión',
    startMonth: 'MARZO',
    endMonth: 'AGOSTO',
    students: [
      { name: 'Lisandro', grade: '11vo', level: 'secundaria', discountPct: 0 },
    ],
  },
  {
    name: 'Leguizamón Gonzalez',
    parentNames: 'Cecilia y Matías',
    email: 'cgbardeci@yahoo.com.ar',
    status: 'asignado',
    observations: 'Citados 02/03 18,30',
    startMonth: 'MARZO',
    endMonth: 'AGOSTO',
    students: [
      { name: 'Sofia', grade: 'EP4', level: 'primaria', discountPct: 45 },
    ],
  },
  {
    name: 'Kretschel',
    parentNames: 'Paula y Alejandro',
    email: 'pauladonadio.ef@gmail.com',
    status: 'asignado',
    observations: 'Citado 02/03 18,45',
    startMonth: 'MARZO',
    endMonth: 'AGOSTO',
    students: [
      { name: 'Tomas', grade: '8vo', level: 'secundaria', discountPct: 40 },
    ],
  },
  {
    name: 'Oliva - Fernandez',
    parentNames: 'Nacho e Inti',
    email: 'matiasezequiellourenco@gmail.com',
    status: 'asignado',
    observations: 'No confirmó asistencia',
    startMonth: 'MARZO',
    endMonth: 'AGOSTO',
    students: [
      { name: 'Clara', grade: 'EP2', level: 'primaria', discountPct: 30 },
    ],
  },
  {
    name: 'Serafini - Bendinger',
    parentNames: 'Valeria',
    email: 'vale.bendinger@gmail.com',
    status: 'asignado',
    observations: 'Valeria esta muy complicada de salud. Se asigna 40% sin reunión y se reserva 100% en caso de que lo soliciten',
    startMonth: 'MARZO',
    endMonth: 'AGOSTO',
    students: [
      { name: 'Tiago Serafini', grade: '10mo', level: 'secundaria', discountPct: 40 },
    ],
  },
  {
    name: 'Aranda - Ventemiglia',
    parentNames: 'Lorena y Pablo',
    email: 'lorenaventemiglia@gmail.com',
    status: 'asignado',
    observations: 'PABLO FALLECIÓ EN FEBRERO, SE AYUDA 100% HASTA FEBRERO',
    startMonth: 'MARZO',
    endMonth: 'FEBRERO',
    students: [
      { name: 'Pedro', grade: 'EP7', level: 'secundaria', discountPct: 100 },
      { name: 'Julia', grade: 'EP4', level: 'primaria', discountPct: 100 },
    ],
  },
  {
    name: 'Quines',
    parentNames: 'Ezequiel y Madelaine',
    email: 'madigamondes@gmail.com',
    status: 'asignado',
    observations: 'Citado 02/03 18h. Vta de cuadros, trabajo editorial',
    startMonth: 'MARZO',
    endMonth: 'AGOSTO',
    students: [
      { name: 'Alina', grade: 'EP3', level: 'primaria', discountPct: 30 },
    ],
  },
  {
    name: 'Quilici',
    parentNames: 'Luciano y Luciana',
    email: 'lucianoquilici@gmail.com',
    status: 'asignado',
    observations: 'Citado 02/03 18h',
    startMonth: 'MARZO',
    endMonth: 'AGOSTO',
    students: [
      { name: 'Francisco', grade: 'EP7', level: 'secundaria', discountPct: 50 },
      { name: 'Amadeo', grade: 'Jardín', level: 'jardin', discountPct: 50 },
    ],
  },
  {
    name: 'Gonzalez - Tozzini',
    parentNames: 'Nicolas y Graciana',
    email: 'ngonzalez@itpartner.com.ar',
    status: 'asignado',
    observations: 'FIRMÓ PAGARÉ PARA EMPEZAR A PAGAR EN ABRIL',
    startMonth: 'MARZO',
    endMonth: 'AGOSTO',
    students: [
      { name: 'Simon', grade: 'EP3', level: 'primaria', discountPct: 35 },
      { name: 'Lola', grade: '8vo', level: 'secundaria', discountPct: 35 },
    ],
  },
  {
    name: 'Divella',
    parentNames: 'Claudio',
    email: 'cdivella@hotmail.com',
    status: 'asignado',
    observations: 'Citado 2/03 18,45',
    startMonth: 'MARZO',
    endMonth: 'AGOSTO',
    students: [
      { name: 'Roco', grade: '9no', level: 'secundaria', discountPct: 50 },
      { name: 'Luca', grade: 'EP7', level: 'secundaria', discountPct: 50 },
    ],
  },
  {
    name: 'Ramos - De Simone',
    parentNames: 'Carla y Luciano',
    email: 'carladesimone@hotmail.com',
    status: 'vencido',
    observations: 'Citado 11/08. Problemas de Salud de Carla y dificultades económicas en general. No entregó Formulario',
    startMonth: 'MARZO',
    endMonth: 'AGOSTO',
    students: [
      { name: 'Olivia', grade: '10mo', level: 'secundaria', discountPct: 0 },
    ],
  },
  {
    name: 'Lichtenfells - Portillo',
    parentNames: 'Paula y Carina',
    email: 'kaliportillo@gmail.com',
    status: 'asignado',
    observations: 'Pau empezó a trabajar, Carin tb. Quedaron deudas por pagar, tienen problemas logísticos con los horarios',
    startMonth: 'MARZO',
    endMonth: 'AGOSTO',
    students: [
      { name: 'Boris', grade: 'EP6', level: 'primaria', discountPct: 50 },
    ],
  },
  {
    name: 'Toscano - Silvera',
    parentNames: 'Pablo y Gabriela',
    email: 'pablo_toscano@hotmail.com',
    status: 'asignado',
    observations: 'FIRMÓ PAGARÉ. Citado 2/03 17,30',
    startMonth: 'MARZO',
    endMonth: 'AGOSTO',
    students: [
      { name: 'Olivia', grade: 'EP6', level: 'primaria', discountPct: 50 },
      { name: 'Andre', grade: 'Jardín', level: 'jardin', discountPct: 50 },
    ],
  },
  {
    name: 'Martin',
    parentNames: 'Pablo',
    email: 'chefpablomartin@gmail.com',
    status: 'en_definicion',
    observations: 'Citado 02/03 18,15',
    startMonth: 'MARZO',
    endMonth: 'AGOSTO',
    students: [
      { name: 'Asis', grade: 'EP5', level: 'primaria', discountPct: 35 },
      { name: 'Alaní', grade: 'Jardín', level: 'jardin', discountPct: 35 },
    ],
  },
  {
    name: 'Onetto - Macri',
    parentNames: 'Javier y Marcela',
    email: 'azhala@gmail.com',
    status: 'asignado',
    observations: 'Quieren sostener la pedagogía y seguir en el colegio, poder judicial de pcia. Marcela tiene ingresos irregulares',
    startMonth: 'MARZO',
    endMonth: 'AGOSTO',
    students: [
      { name: 'Vicente', grade: 'EP5', level: 'primaria', discountPct: 30 },
      { name: 'Natalio', grade: 'EP3', level: 'primaria', discountPct: 30 },
    ],
  },
  {
    name: 'Pauls',
    parentNames: 'Nicolas',
    email: 'cotzia@yahoo.es',
    status: 'asignado',
    observations: 'CITADO 02/03 17,45',
    startMonth: 'MARZO',
    endMonth: 'AGOSTO',
    students: [
      { name: 'Leon', grade: '11vo', level: 'secundaria', discountPct: 45 },
      { name: 'Alfonso', grade: 'EP1', level: 'primaria', discountPct: 45 },
    ],
  },
  {
    name: 'Rouys Reinaud',
    parentNames: 'Florencia',
    email: 'florenciareinaud@gmail.com',
    status: 'vencido',
    observations: 'FIRMARON PAGARÉ PARA TERMINAR DE PAGAR DEUDA EN ABRIL',
    startMonth: 'MARZO',
    endMonth: 'AGOSTO',
    students: [
      { name: 'Galia', grade: 'Jardín', level: 'jardin', discountPct: 0 },
    ],
  },
  {
    name: 'Ferrari - Naya',
    parentNames: 'Carolina y Federico',
    email: 'karonaya@gmail.com',
    status: 'asignado',
    observations: 'Escribió mail solicitando ayuda. Separados. Están desde 2023. Piden ayuda para Marzo 2026. Comerciante. Pendiente de cancelar deuda',
    startMonth: 'MARZO',
    endMonth: 'AGOSTO',
    students: [
      { name: 'Dante', grade: '1ro', level: 'primaria', discountPct: 35 },
    ],
  },
  {
    name: 'Blinder - Taglafierro',
    parentNames: 'Daniel y Magdalena',
    email: 'florenciareinaud@gmail.com',
    status: 'asignado',
    observations: 'Escribieron mail solicitando ayuda. Primer año en el cole. Ministerio Educ CABA y Conicet y Doc univ. Piden para Marzo 2026',
    startMonth: 'MARZO',
    endMonth: 'AGOSTO',
    students: [
      { name: 'Ulises', grade: '7mo', level: 'secundaria', discountPct: 35 },
    ],
  },
  {
    name: 'Taboada - Bellagamba',
    parentNames: 'Gaston y Paola',
    email: 'gustavo2734@hotmail.com',
    status: 'asignado',
    observations: 'Reunión 02/03 19',
    startMonth: 'MARZO',
    endMonth: 'AGOSTO',
    students: [
      { name: 'Pedro', grade: 'EP7', level: 'secundaria', discountPct: 40 },
      { name: 'Salvador', grade: 'EP2', level: 'primaria', discountPct: 40 },
    ],
  },
  {
    name: 'Cuadrado - Mayo',
    parentNames: 'Marina y Hernan',
    email: 'mayo.marina@hotmail.com',
    status: 'asignado',
    observations: 'CITADO 02/03 18,30',
    startMonth: 'MARZO',
    endMonth: 'AGOSTO',
    students: [
      { name: 'Vera', grade: '1ro', level: 'primaria', discountPct: 35 },
      { name: 'Camila', grade: 'Jardín', level: 'jardin', discountPct: 35 },
    ],
  },
  {
    name: 'Hezime - De Nucci',
    parentNames: 'Flavia y Youseff',
    email: 'flaviadnucci@gmail.com',
    status: 'asignado',
    observations: '',
    startMonth: 'MARZO',
    endMonth: 'AGOSTO',
    students: [
      { name: 'Hanan', grade: 'Jardín', level: 'jardin', discountPct: 20 },
    ],
  },
  {
    name: 'Ferraro - Russo',
    parentNames: 'Fabian y Gabriela',
    email: 'fcferraro@gmail.com',
    status: 'en_definicion',
    observations: 'CITADO 19/03. Escribieron indicando su descontento con la definición del 20%. Vuelven a pedir algo entre 50% y 70% como hicieron originalmente',
    startMonth: 'MARZO',
    endMonth: 'AGOSTO',
    students: [
      { name: 'Barbara', grade: '12vo', level: '12vo', discountPct: 20 },
    ],
  },
  {
    name: 'Fernandez - Muller',
    parentNames: 'Gretel y Antonio',
    email: 'mg.elisa23@gmail.com',
    status: 'en_definicion',
    observations: 'CITADO 19/03',
    startMonth: 'MARZO',
    endMonth: 'AGOSTO',
    students: [
      { name: 'Leire', grade: '1ro', level: 'primaria', discountPct: 30 },
    ],
  },
  {
    name: 'Suaso Larralde',
    parentNames: '',
    email: '',
    status: 'entrevista_agendada',
    observations: '',
    startMonth: 'MARZO',
    endMonth: 'AGOSTO',
    students: [],
  },
  {
    name: 'Suárez del Cerro',
    parentNames: '',
    email: '',
    status: 'entrevista_agendada',
    observations: '',
    startMonth: 'MARZO',
    endMonth: 'AGOSTO',
    students: [],
  },
];

// Cuotas por nivel
const TUITION: Record<string, { tuition: number; extras: number }> = {
  jardin: { tuition: 650000, extras: 0 },
  primaria: { tuition: 822000, extras: 28000 },
  secundaria: { tuition: 858000, extras: 37000 },
  '12vo': { tuition: 1073000, extras: 37000 },
};

async function seed() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/acuerdos_economicos',
  });

  console.log('Limpiando datos existentes...');
  await pool.query('DELETE FROM agreement_audit_log');
  await pool.query('DELETE FROM agreement_students');
  await pool.query('DELETE FROM agreements');
  await pool.query('DELETE FROM aid_requests');
  await pool.query('DELETE FROM invitations');
  await pool.query('DELETE FROM family_members');
  await pool.query('DELETE FROM students');
  await pool.query('DELETE FROM families');
  await pool.query('DELETE FROM tuition_rates');
  await pool.query('DELETE FROM aid_periods');
  await pool.query('DELETE FROM users');

  console.log('Creando usuarios comisión...');
  const hash = await bcrypt.hash('admin123', 10);
  await pool.query(`
    INSERT INTO users (email, password_hash, name, role) VALUES
      ('admin@colegio.com', $1, 'Admin Comisión', 'committee')
  `, [hash]);

  const adminResult = await pool.query("SELECT id FROM users WHERE email = 'admin@colegio.com'");
  const adminId = adminResult.rows[0].id;

  console.log('Creando período Marzo-Agosto 2026...');
  const periodResult = await pool.query(`
    INSERT INTO aid_periods (name, start_month, end_month, year, total_budget, is_active)
    VALUES ('Marzo-Agosto 2026', 3, 8, 2026, 14426670, true)
    RETURNING id
  `);
  const periodId = periodResult.rows[0].id;

  console.log('Cargando cuotas por nivel...');
  for (const [level, rates] of Object.entries(TUITION)) {
    await pool.query(
      'INSERT INTO tuition_rates (period_id, level, tuition_amount, extras_amount) VALUES ($1, $2, $3, $4)',
      [periodId, level, rates.tuition, rates.extras]
    );
  }

  console.log(`Cargando ${families.length} familias...`);
  for (const fam of families) {
    // Crear familia
    const famResult = await pool.query(
      `INSERT INTO families (name, parent_names, email)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [fam.name, fam.parentNames || null, fam.email || null]
    );
    const familyId = famResult.rows[0].id;

    // Crear estudiantes
    const studentIds: number[] = [];
    for (const s of fam.students) {
      const sResult = await pool.query(
        `INSERT INTO students (family_id, name, level, grade)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [familyId, s.name, s.level, s.grade]
      );
      studentIds.push(sResult.rows[0].id);
    }

    // Determinar status para la DB
    let dbStatus: string;
    if (fam.status === 'vencido') {
      dbStatus = 'suspendido'; // mapeamos vencido a suspendido
    } else if (fam.status === 'entrevista_agendada') {
      dbStatus = 'pendiente';
    } else {
      dbStatus = fam.status;
    }

    // El descuento dominante de la familia (tomamos el del primer hijo)
    const mainDiscount = fam.students.length > 0 ? fam.students[0].discountPct : 0;

    // Crear acuerdo
    const agrResult = await pool.query(
      `INSERT INTO agreements (family_id, period_id, status, discount_percentage, observations, approved_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [familyId, periodId, dbStatus, mainDiscount, fam.observations || null, adminId]
    );
    const agreementId = agrResult.rows[0].id;

    // Crear detalle por estudiante
    for (let i = 0; i < fam.students.length; i++) {
      const s = fam.students[i];
      const rates = TUITION[s.level];
      const baseTuition = rates.tuition;
      const extras = rates.extras;
      const discountAmount = baseTuition * (s.discountPct / 100);
      const amountToPay = baseTuition - discountAmount + extras;

      await pool.query(
        `INSERT INTO agreement_students
         (agreement_id, student_id, level, base_tuition, extras, discount_percentage, discount_amount, amount_to_pay)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [agreementId, studentIds[i], s.level, baseTuition, extras, s.discountPct, discountAmount, amountToPay]
      );
    }
  }

  // Verificar totales
  const budgetCheck = await pool.query(`
    SELECT
      COUNT(DISTINCT a.family_id) as total_families,
      COUNT(DISTINCT a.family_id) FILTER (WHERE a.status = 'asignado') as assigned,
      COUNT(DISTINCT a.family_id) FILTER (WHERE a.status = 'en_definicion') as in_def,
      COUNT(DISTINCT a.family_id) FILTER (WHERE a.status = 'pendiente') as pending,
      COUNT(DISTINCT a.family_id) FILTER (WHERE a.status = 'suspendido') as suspended,
      COALESCE(SUM(ast.discount_amount), 0)::numeric as total_discount
    FROM agreements a
    LEFT JOIN agreement_students ast ON ast.agreement_id = a.id
    WHERE a.period_id = $1
  `, [periodId]);

  const check = budgetCheck.rows[0];
  console.log(`\nResumen:`);
  console.log(`  Total familias: ${check.total_families}`);
  console.log(`  Asignados: ${check.assigned}`);
  console.log(`  En definición: ${check.in_def}`);
  console.log(`  Pendientes: ${check.pending}`);
  console.log(`  Vencidos/Suspendidos: ${check.suspended}`);
  console.log(`  Total descuento mensual: $${Number(check.total_discount).toLocaleString('es-AR')}`);

  await pool.end();
  console.log('\nSeed completo.');
}

seed().catch((err) => {
  console.error('Error en seed:', err);
  process.exit(1);
});
