import type { FastifyInstance } from 'fastify';

export default async function budgetRoutes(fastify: FastifyInstance) {
  fastify.get('/api/budget/summary', {
    preHandler: [fastify.requireCommittee],
  }, async (request) => {
    const { period_id } = request.query as { period_id?: string };

    const result = await fastify.db.query(`
      WITH active_period AS (
        SELECT id, total_budget
        FROM aid_periods
        WHERE id = COALESCE($1::int, (SELECT id FROM aid_periods WHERE is_active = true LIMIT 1))
      ),
      agreement_totals AS (
        SELECT
          COUNT(DISTINCT a.id)::int AS total_families,
          COUNT(DISTINCT f.id) FILTER (WHERE f.status::text = 'otorgado')::int AS families_assigned,
          COUNT(DISTINCT f.id) FILTER (WHERE f.status::text = 'en_definicion')::int AS families_in_definition,
          COUNT(DISTINCT f.id) FILTER (WHERE f.status::text IN ('solicitud','formulario_enviado','formulario_completado','agendado'))::int AS families_pending,
          COALESCE(SUM(ast.discount_amount) FILTER (WHERE f.status::text = 'otorgado'), 0) AS granted_assigned,
          COALESCE(SUM(ast.discount_amount) FILTER (WHERE f.status::text = 'en_definicion'), 0) AS granted_in_definition
        FROM agreements a
        JOIN active_period ap ON a.period_id = ap.id
        JOIN families f ON f.id = a.family_id
        LEFT JOIN agreement_students ast ON ast.agreement_id = a.id
      )
      SELECT
        ap.total_budget,
        (at.granted_assigned + at.granted_in_definition) AS total_granted,
        at.granted_assigned,
        at.granted_in_definition,
        (ap.total_budget - at.granted_assigned - at.granted_in_definition) AS available,
        CASE WHEN ap.total_budget > 0
          THEN (at.granted_assigned / ap.total_budget * 100)
          ELSE 0
        END AS assigned_percentage,
        CASE WHEN ap.total_budget > 0
          THEN (at.granted_in_definition / ap.total_budget * 100)
          ELSE 0
        END AS in_definition_percentage,
        CASE WHEN ap.total_budget > 0
          THEN ((ap.total_budget - at.granted_assigned - at.granted_in_definition) / ap.total_budget * 100)
          ELSE 0
        END AS available_percentage,
        at.total_families,
        at.families_assigned,
        at.families_in_definition,
        at.families_pending
      FROM active_period ap
      CROSS JOIN agreement_totals at
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
      };
    }

    const row = result.rows[0];
    return {
      total_budget: Number(row.total_budget),
      total_granted: Number(row.total_granted),
      granted_assigned: Number(row.granted_assigned),
      granted_in_definition: Number(row.granted_in_definition),
      available: Number(row.available),
      assigned_percentage: Number(row.assigned_percentage),
      in_definition_percentage: Number(row.in_definition_percentage),
      available_percentage: Number(row.available_percentage),
      total_families: row.total_families,
      families_assigned: row.families_assigned,
      families_in_definition: row.families_in_definition,
      families_pending: row.families_pending,
    };
  });
}
