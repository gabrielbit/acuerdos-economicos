import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Pool } = pg;

async function seed() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/acuerdos_economicos',
  });

  console.log('Seeding...');

  // Usuarios comisión
  const hash = await bcrypt.hash('admin123', 10);
  await pool.query(`
    INSERT INTO users (email, password_hash, name, role) VALUES
      ('admin@colegio.com', $1, 'Admin Comisión', 'committee')
    ON CONFLICT (email) DO NOTHING
  `, [hash]);

  // Período activo: Marzo-Agosto 2026
  const periodResult = await pool.query(`
    INSERT INTO aid_periods (name, start_month, end_month, year, total_budget, is_active)
    VALUES ('Marzo-Agosto 2026', 3, 8, 2026, 14426670, true)
    ON CONFLICT DO NOTHING
    RETURNING id
  `);

  const periodId = periodResult.rows[0]?.id;
  if (periodId) {
    // Cuotas por nivel
    await pool.query(`
      INSERT INTO tuition_rates (period_id, level, tuition_amount, extras_amount) VALUES
        ($1, 'jardin', 650000, 0),
        ($1, 'primaria', 822000, 28000),
        ($1, 'secundaria', 858000, 37000),
        ($1, '12vo', 1073000, 37000)
      ON CONFLICT DO NOTHING
    `, [periodId]);

    // Familias de ejemplo
    const f1 = await pool.query(`
      INSERT INTO families (name, parent_names, email)
      VALUES ('Cuadrado - Mayo', 'Marina y Hernan', 'mayo.marina@hotmail.com')
      RETURNING id
    `);
    const f1Id = f1.rows[0].id;

    await pool.query(`
      INSERT INTO students (family_id, name, level, grade) VALUES
        ($1, 'Vera', 'primaria', '1ro'),
        ($1, 'Camila', 'jardin', 'Jardín')
    `, [f1Id]);

    // Acuerdo para familia 1
    const a1 = await pool.query(`
      INSERT INTO agreements (family_id, period_id, status, discount_percentage, observations)
      VALUES ($1, $2, 'asignado', 35, 'CITADO 02/03 18:30')
      RETURNING id
    `, [f1Id, periodId]);

    await pool.query(`
      INSERT INTO agreement_students (agreement_id, student_id, level, base_tuition, extras, discount_percentage, discount_amount, amount_to_pay)
      SELECT $1, s.id, s.level,
        CASE s.level WHEN 'primaria' THEN 822000 WHEN 'jardin' THEN 650000 END,
        CASE s.level WHEN 'primaria' THEN 28000 WHEN 'jardin' THEN 0 END,
        35,
        CASE s.level WHEN 'primaria' THEN 822000 * 0.35 WHEN 'jardin' THEN 650000 * 0.35 END,
        CASE s.level
          WHEN 'primaria' THEN 822000 * 0.65 + 28000
          WHEN 'jardin' THEN 650000 * 0.65
        END
      FROM students s WHERE s.family_id = $2
    `, [a1.rows[0].id, f1Id]);

    // Familia 2
    const f2 = await pool.query(`
      INSERT INTO families (name, parent_names, email)
      VALUES ('Hezime - De Nucci', 'Flavia y Youseff', 'flaviadnucci@gmail.com')
      RETURNING id
    `);
    const f2Id = f2.rows[0].id;

    await pool.query(`
      INSERT INTO students (family_id, name, level, grade)
      VALUES ($1, 'Hanan', 'jardin', 'Jardín')
    `, [f2Id]);

    const a2 = await pool.query(`
      INSERT INTO agreements (family_id, period_id, status, discount_percentage)
      VALUES ($1, $2, 'asignado', 20)
      RETURNING id
    `, [f2Id, periodId]);

    await pool.query(`
      INSERT INTO agreement_students (agreement_id, student_id, level, base_tuition, extras, discount_percentage, discount_amount, amount_to_pay)
      VALUES ($1, (SELECT id FROM students WHERE family_id = $2 LIMIT 1), 'jardin', 650000, 0, 20, 130000, 520000)
    `, [a2.rows[0].id, f2Id]);

    // Familia 3 - en definición
    const f3 = await pool.query(`
      INSERT INTO families (name, parent_names, email)
      VALUES ('Ferraro - Russo', 'Fabian y Gabriela', 'fcferraro@gmail.com')
      RETURNING id
    `);
    const f3Id = f3.rows[0].id;

    await pool.query(`
      INSERT INTO students (family_id, name, level, grade)
      VALUES ($1, 'Barbara', '12vo', '12vo')
    `, [f3Id]);

    await pool.query(`
      INSERT INTO agreements (family_id, period_id, status, discount_percentage, observations)
      VALUES ($1, $2, 'en_definicion', 20, 'Escribieron indicando su descontento con la definición del 20%. Vuelven a pedir algo entre 50% y 70%.')
    `, [f3Id, periodId]);

    // Familia 4 - en definición
    const f4 = await pool.query(`
      INSERT INTO families (name, parent_names, email)
      VALUES ('Fernandez - Muller', 'Gretel y Antonio', 'mg.elisa23@gmail.com')
      RETURNING id
    `);
    const f4Id = f4.rows[0].id;

    await pool.query(`
      INSERT INTO students (family_id, name, level, grade)
      VALUES ($1, 'Leire', 'primaria', '1ro')
    `, [f4Id]);

    await pool.query(`
      INSERT INTO agreements (family_id, period_id, status, discount_percentage)
      VALUES ($1, $2, 'en_definicion', 30)
    `, [f4Id, periodId]);
  }

  await pool.end();
  console.log('Seed completo.');
}

seed().catch((err) => {
  console.error('Error en seed:', err);
  process.exit(1);
});
