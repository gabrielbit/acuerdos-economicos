import type { FastifyInstance } from 'fastify';

export default async function budgetRoutes(fastify: FastifyInstance) {
  fastify.get('/api/budget/summary', {
    preHandler: [fastify.requireCommittee],
  }, async (request) => {
    const { period_id } = request.query as { period_id?: string };

    const result = await fastify.db.query(`
      WITH active_period AS (
        SELECT id FROM aid_periods
        WHERE id = COALESCE($1::int, (SELECT id FROM aid_periods WHERE is_active = true LIMIT 1))
      ),
      active_budget AS (
        SELECT COALESCE(
          (SELECT total_budget FROM fee_schedules
           WHERE effective_from <= CURRENT_DATE
           ORDER BY effective_from DESC LIMIT 1),
          0
        ) AS total_budget
      ),
      valid_assigned_families AS (
        SELECT
          f.id AS family_id,
          a.id AS agreement_id
        FROM families f
        JOIN active_period ap ON true
        JOIN agreements a ON a.family_id = f.id AND a.period_id = ap.id
        LEFT JOIN students s ON s.family_id = f.id
        LEFT JOIN agreement_students ast
          ON ast.agreement_id = a.id
          AND ast.student_id = s.id
        WHERE f.status::text = 'otorgado'
        GROUP BY f.id, a.id
        HAVING COUNT(DISTINCT s.id) > 0
          AND COUNT(DISTINCT s.id) = COUNT(DISTINCT ast.student_id)
      ),
      agreement_totals AS (
        SELECT
          COUNT(DISTINCT a.id)::int AS total_families,
          COUNT(DISTINCT vf.family_id)::int AS families_assigned,
          COUNT(DISTINCT f.id) FILTER (WHERE f.status::text = 'en_definicion')::int AS families_in_definition,
          COUNT(DISTINCT f.id) FILTER (WHERE f.status::text IN ('solicitud','formulario_enviado','formulario_completado','agendado'))::int AS families_pending,
          COUNT(DISTINCT ast.student_id) FILTER (WHERE vf.family_id IS NOT NULL)::int AS students_assigned,
          COALESCE(SUM(ast.discount_amount) FILTER (WHERE vf.family_id IS NOT NULL), 0) AS granted_assigned,
          COALESCE(SUM(ast.discount_amount) FILTER (WHERE f.status::text = 'en_definicion'), 0) AS granted_in_definition
        FROM agreements a
        JOIN active_period ap ON a.period_id = ap.id
        JOIN families f ON f.id = a.family_id
        LEFT JOIN valid_assigned_families vf ON vf.family_id = f.id AND vf.agreement_id = a.id
        LEFT JOIN agreement_students ast ON ast.agreement_id = a.id
      ),
      per_family_discount AS (
        SELECT
          vf.family_id,
          MAX(a.discount_percentage)::numeric AS discount_percentage,
          SUM(ast.discount_amount)::numeric AS monthly_discount
        FROM valid_assigned_families vf
        JOIN agreements a ON a.id = vf.agreement_id
        JOIN agreement_students ast ON ast.agreement_id = vf.agreement_id
        GROUP BY vf.family_id
      ),
      family_averages AS (
        SELECT
          AVG(pfd.discount_percentage) AS avg_granted_discount_percentage,
          AVG(pfd.monthly_discount) AS avg_granted_monthly_discount_per_family
        FROM per_family_discount pfd
      ),
      grant_velocity AS (
        SELECT
          (COALESCE((
            SELECT SUM(mo.month_families)::numeric
            FROM (
              SELECT COUNT(DISTINCT a.family_id)::int AS month_families
              FROM agreements a
              JOIN active_period ap ON a.period_id = ap.id
              WHERE a.granted_at IS NOT NULL
                AND a.granted_at >= date_trunc('month', CURRENT_DATE) - INTERVAL '6 months'
                AND a.granted_at < date_trunc('month', CURRENT_DATE)
              GROUP BY date_trunc('month', a.granted_at)
            ) mo
          ), 0) / 6.0) AS grant_velocity_families_per_month
      )
      SELECT
        ab.total_budget,
        (at.granted_assigned + at.granted_in_definition) AS total_granted,
        at.granted_assigned,
        at.granted_in_definition,
        (ab.total_budget - at.granted_assigned - at.granted_in_definition) AS available,
        CASE WHEN ab.total_budget > 0
          THEN (at.granted_assigned / ab.total_budget * 100)
          ELSE 0
        END AS assigned_percentage,
        CASE WHEN ab.total_budget > 0
          THEN (at.granted_in_definition / ab.total_budget * 100)
          ELSE 0
        END AS in_definition_percentage,
        CASE WHEN ab.total_budget > 0
          THEN ((ab.total_budget - at.granted_assigned - at.granted_in_definition) / ab.total_budget * 100)
          ELSE 0
        END AS available_percentage,
        at.total_families,
        at.families_assigned,
        at.families_in_definition,
        at.families_pending,
        at.students_assigned,
        fa.avg_granted_discount_percentage,
        fa.avg_granted_monthly_discount_per_family,
        gv.grant_velocity_families_per_month
      FROM active_budget ab
      CROSS JOIN agreement_totals at
      CROSS JOIN family_averages fa
      CROSS JOIN grant_velocity gv
    `, [period_id ?? null]);

    if (result.rows.length === 0) {
      return {
        total_budget: 0,
        total_granted: 0,
        granted_assigned: 0,
        granted_in_definition: 0,
        available: 0,
        assigned_percentage: 0,
        in_definition_percentage: 0,
        available_percentage: 0,
        total_families: 0,
        families_assigned: 0,
        families_in_definition: 0,
        families_pending: 0,
        students_assigned: 0,
        grant_velocity_families_per_month: 0,
        avg_granted_discount_percentage: null,
        avg_granted_monthly_discount_per_family: null,
        estimated_additional_families: null,
        estimated_months_runway: null,
      };
    }

    const row = result.rows[0];
    const available = Number(row.available);
    const velocity = Number(row.grant_velocity_families_per_month ?? 0);
    const avgAmt = row.avg_granted_monthly_discount_per_family != null
      ? Number(row.avg_granted_monthly_discount_per_family)
      : null;
    const avgPct = row.avg_granted_discount_percentage != null
      ? Number(row.avg_granted_discount_percentage)
      : null;

    const estimatedAdditionalFamilies =
      avgAmt != null && avgAmt > 0 ? Math.floor(available / avgAmt) : null;
    const estimatedMonthsRunway =
      velocity > 0 && avgAmt != null && avgAmt > 0 ? available / (velocity * avgAmt) : null;

    return {
      total_budget: Number(row.total_budget),
      total_granted: Number(row.total_granted),
      granted_assigned: Number(row.granted_assigned),
      granted_in_definition: Number(row.granted_in_definition),
      available,
      assigned_percentage: Number(row.assigned_percentage),
      in_definition_percentage: Number(row.in_definition_percentage),
      available_percentage: Number(row.available_percentage),
      total_families: row.total_families,
      families_assigned: row.families_assigned,
      families_in_definition: row.families_in_definition,
      families_pending: row.families_pending,
      students_assigned: Number(row.students_assigned ?? 0),
      grant_velocity_families_per_month: velocity,
      avg_granted_discount_percentage: avgPct,
      avg_granted_monthly_discount_per_family: avgAmt,
      estimated_additional_families: estimatedAdditionalFamilies,
      estimated_months_runway: estimatedMonthsRunway,
    };
  });

  fastify.get('/api/budget/history', {
    preHandler: [fastify.requireCommittee],
  }, async (request) => {
    const { months } = request.query as { months?: string };
    const monthsCount = Math.max(1, Math.min(120, Number(months ?? 12)));

    const endedAtColumn = await fastify.db.query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'agreements'
          AND column_name = 'ended_at'
      ) AS exists
    `);
    const hasEndedAt = endedAtColumn.rows[0]?.exists === true;

    const dropsCte = hasEndedAt
      ? `
      drops AS (
        SELECT
          date_trunc('month', a.ended_at) AS month_start,
          COUNT(DISTINCT a.family_id)::int AS families_dropped,
          COALESCE(SUM(ast.discount_amount), 0)::numeric AS amount_dropped
        FROM agreements a
        JOIN active_period ap ON ap.id = a.period_id
        LEFT JOIN agreement_students ast ON ast.agreement_id = a.id
        WHERE a.ended_at IS NOT NULL
          AND a.ended_at >= (SELECT MIN(month_start) FROM month_series)
        GROUP BY 1
      )`
      : `
      drops AS (
        SELECT
          ms.month_start,
          0::int AS families_dropped,
          0::numeric AS amount_dropped
        FROM month_series ms
      )`;

    const result = await fastify.db.query(`
      WITH month_series AS (
        SELECT date_trunc('month', CURRENT_DATE) - (gs.i * INTERVAL '1 month') AS month_start
        FROM generate_series(0, $1::int - 1) AS gs(i)
      ),
      active_period AS (
        SELECT id FROM aid_periods WHERE is_active = true LIMIT 1
      ),
      monthly_budgets AS (
        SELECT
          ms.month_start,
          COALESCE((
            SELECT fs.total_budget
            FROM fee_schedules fs
            WHERE fs.effective_from <= ms.month_start::date
            ORDER BY fs.effective_from DESC
            LIMIT 1
          ), 0)::numeric AS total_budget
        FROM month_series ms
      ),
      grants AS (
        SELECT
          date_trunc('month', a.granted_at) AS month_start,
          COUNT(DISTINCT a.family_id)::int AS families_joined,
          COALESCE(SUM(ast.discount_amount), 0)::numeric AS amount_joined
        FROM agreements a
        JOIN active_period ap ON ap.id = a.period_id
        LEFT JOIN agreement_students ast ON ast.agreement_id = a.id
        WHERE a.granted_at IS NOT NULL
          AND a.granted_at >= (SELECT MIN(month_start) FROM month_series)
        GROUP BY 1
      ),
      ${dropsCte}
      SELECT
        ms.month_start::date AS month_start,
        mb.total_budget,
        COALESCE(g.families_joined, 0) AS families_joined,
        COALESCE(g.amount_joined, 0) AS amount_joined,
        COALESCE(d.families_dropped, 0) AS families_dropped,
        COALESCE(d.amount_dropped, 0) AS amount_dropped
      FROM month_series ms
      JOIN monthly_budgets mb ON mb.month_start = ms.month_start
      LEFT JOIN grants g ON g.month_start = ms.month_start
      LEFT JOIN drops d ON d.month_start = ms.month_start
      ORDER BY ms.month_start DESC
    `, [monthsCount]);

    return result.rows.map((row) => {
      const budget = Number(row.total_budget);
      const joinedAmount = Number(row.amount_joined);
      const droppedAmount = Number(row.amount_dropped);
      return {
        month: row.month_start.toISOString().slice(0, 7),
        total_budget: budget,
        families_joined: row.families_joined,
        amount_joined: joinedAmount,
        joined_percentage: budget > 0 ? (joinedAmount / budget) * 100 : 0,
        families_dropped: row.families_dropped,
        amount_dropped: droppedAmount,
        dropped_percentage: budget > 0 ? (droppedAmount / budget) * 100 : 0,
      };
    });
  });
}
