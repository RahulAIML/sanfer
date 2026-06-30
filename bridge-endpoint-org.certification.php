<?php
/**
 * Bridge action: org.certification
 *
 * Add this case to the switch($action) block in the existing bridge PHP file
 * on serv.aux-rolplay.com (/sanfer/bridge/index.php or equivalent).
 *
 * This exposes profiles_assigned data so the Sanfer dashboard can use the
 * official fase1/fase2/fase3 completion flags instead of inferring
 * certification from simulation session counts.
 *
 * The WHERE clause mirrors Mexico team's official queries exactly:
 *   - mb_admin != 97
 *   - NOT (%tester% OR %prueba% OR %demo% OR %capacitacion% OR %vacante%)
 *     on both mb_user and mb_fullname
 *
 * Response shape (JSON):
 *   { ok: true, data: CertificationProfile[], count: number }
 *
 * CertificationProfile fields:
 *   mb_user       string   — lowercase email, join key to members + simulations
 *   profile_id    int      — sales_line.bhl_id
 *   finalized     0|1
 *   fase1         0|1
 *   fase1_score   float|null
 *   fase2         0|1
 *   fase2_score   float|null
 *   fase3         0|1
 *   fase3_score   float|null
 */

case 'org.certification':
    $sql = "
        SELECT
            LOWER(m.mb_user)                    AS mb_user,
            pa.prf_assigned_profile             AS profile_id,
            pa.prf_assigned_finalized           AS finalized,
            pa.prf_assigned_fase1               AS fase1,
            pa.prf_assigned_fase1_score         AS fase1_score,
            pa.prf_assigned_fase2               AS fase2,
            pa.prf_assigned_fase2_score         AS fase2_score,
            pa.prf_assigned_fase3               AS fase3,
            pa.prf_assigned_fase3_score         AS fase3_score
        FROM profiles_assigned AS pa
        JOIN members AS m ON pa.prf_assigned_user = m.mb_id
        WHERE m.mb_admin != 97
          AND NOT (
              m.mb_user     LIKE '%tester%'      OR
              m.mb_user     LIKE '%prueba%'       OR
              m.mb_user     LIKE '%demo%'         OR
              m.mb_user     LIKE '%capacitacion%' OR
              m.mb_user     LIKE '%capacitaci\xc3\xb3n%' OR
              m.mb_user     LIKE '%vacante%'      OR
              m.mb_fullname LIKE '%tester%'       OR
              m.mb_fullname LIKE '%prueba%'       OR
              m.mb_fullname LIKE '%demo%'         OR
              m.mb_fullname LIKE '%capacitacion%' OR
              m.mb_fullname LIKE '%capacitaci\xc3\xb3n%' OR
              m.mb_fullname LIKE '%vacante%'
          )
        ORDER BY pa.prf_assigned_user ASC
    ";

    $stmt = $pdo->query($sql);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Cast numeric flags / scores to the right types
    foreach ($rows as &$row) {
        $row['profile_id']  = (int)   $row['profile_id'];
        $row['finalized']   = (int)   $row['finalized'];
        $row['fase1']       = (int)   $row['fase1'];
        $row['fase2']       = (int)   $row['fase2'];
        $row['fase3']       = (int)   $row['fase3'];
        $row['fase1_score'] = isset($row['fase1_score']) ? (float) $row['fase1_score'] : null;
        $row['fase2_score'] = isset($row['fase2_score']) ? (float) $row['fase2_score'] : null;
        $row['fase3_score'] = isset($row['fase3_score']) ? (float) $row['fase3_score'] : null;
    }
    unset($row);

    header('Content-Type: application/json');
    echo json_encode(['ok' => true, 'data' => $rows, 'count' => count($rows)]);
    break;
