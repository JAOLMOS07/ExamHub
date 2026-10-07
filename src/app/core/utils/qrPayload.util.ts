/**
 * ========================================================================
 *  Spec del payload del QR de la hoja de respuestas
 * ------------------------------------------------------------------------
 *  El QR de la hoja de respuestas codifica solo IDs (no respuestas).
 *
 *  Razones de esta decisión:
 *    1. Seguridad: si un alumno fotografía la hoja del compañero, no
 *       puede extraer respuestas del QR.
 *    2. Tamaño: el QR queda en versión 2-3 (legible incluso con cámaras
 *       de gama baja a 30 cm de distancia).
 *    3. Mutabilidad: el answerKey vive en Firestore, podemos corregir
 *       errores post-impresión sin reimprimir.
 *
 *  Formato del payload (texto plano, separado por `|`):
 *
 *       EH|<v>|<examId>|<versionId>|<page>|<totalPages>|<sig>
 *
 *  Campos:
 *    EH          marca de protocolo "ExamHub". Si el scanner ve otra
 *                cosa, descarta — evita confundir con QR de WhatsApp,
 *                tarjetas, etc.
 *    v           versión del protocolo (entero). Empezamos en 1.
 *                Permite romper compatibilidad si algún día lo necesitamos.
 *    examId      UUID del examen (alfanumérico).
 *    versionId   "v1", "v2", ... — para saber qué answerKey usar.
 *    page        número de página de esta hoja (1-based).
 *    totalPages  total de páginas de la hoja de respuestas.
 *    sig         primeros 8 chars de un hash truncado del payload + sal.
 *                Sirve para detectar QR alterados a mano (no es seguro
 *                criptográficamente, solo barrera anti-tonto).
 *
 *  Ejemplo:
 *       EH|1|a1b2c3d4|v2|1|1|7f3a9b21
 *
 *  Tamaño típico: ~40-60 caracteres → QR versión 2 con corrección M.
 *
 *  Protocolo v2 (hojas multi-organización):
 *
 *       EH|2|<orgId>|<assessmentId>|<formId>|<page>|<totalPages>|<sig>
 *
 *  Agrega el orgId para que un docente que pertenece a varias
 *  instituciones abra el examen en la correcta. Los QR v1 se siguen
 *  leyendo (el examen se busca en la organización activa).
 *
 *  Protocolo v3 (hojas personalizadas por estudiante):
 *
 *       EH|3|<orgId>|<assessmentId>|<formId>|<page>|<totalPages>|<studentId>|<sig>
 *
 *  El studentId es el id interno del documento del estudiante: no es
 *  un dato personal legible fuera de ExamHub.
 * ========================================================================
 */

/** Marca de protocolo. Si el scanner ve otra cosa, ignora el QR. */
export const QR_PROTOCOL_MARK = "EH";

/** Versión del protocolo que se imprime hoy. */
export const QR_PROTOCOL_VERSION = 2;

/** Separador entre campos del payload. Elegido porque QR alfanumérico
 *  acepta `|` y no aparece en los IDs. */
const FIELD_SEPARATOR = "|";

/** Sal usada al calcular la firma. NO es secreto criptográfico — solo
 *  evita que un QR escrito a mano por un alumno pase la validación.
 *  Si algún día queremos seguridad real, pasamos a JWT firmado en backend. */
const SIG_SALT = "examhub-qr-v1";

/** Forma del payload tras decodificar. */
export interface QrPayload {
  /** Presente desde el protocolo v2. */
  orgId?: string;
  /** Solo en hojas personalizadas (protocolo v3). */
  studentId?: string;
  examId: string;
  versionId: string;
  page: number;
  totalPages: number;
}

/**
 * Codifica los datos en el string que se imprime en el QR.
 */
export function encodeQrPayload(data: QrPayload): string {
  const version = data.studentId && data.orgId ? "3" : data.orgId ? "2" : "1";
  const fields = data.orgId
    ? [QR_PROTOCOL_MARK, version, data.orgId]
    : [QR_PROTOCOL_MARK, "1"];
  fields.push(
    data.examId,
    data.versionId,
    String(data.page),
    String(data.totalPages)
  );
  if (version === "3") fields.push(data.studentId!);
  const body = fields.join(FIELD_SEPARATOR);
  const sig = computeSignature(body);
  return `${body}${FIELD_SEPARATOR}${sig}`;
}

/**
 * Decodifica un string leído por el scanner. Devuelve null si no es
 * un QR de ExamHub, si la versión es desconocida, o si la firma falla.
 */
export function decodeQrPayload(raw: string): QrPayload | null {
  if (!raw || typeof raw !== "string") return null;
  const parts = raw.trim().split(FIELD_SEPARATOR);
  if (parts[0] !== QR_PROTOCOL_MARK) return null;

  const protocolVersion = parseInt(parts[1], 10);
  const expectedParts =
    protocolVersion === 1 ? 7 : protocolVersion === 2 ? 8 : protocolVersion === 3 ? 9 : -1;
  if (parts.length !== expectedParts) return null;

  // Verifica firma (sin esto cualquiera escribiría EH|1|fake|v1|1|1|aaaa)
  const sig = parts[parts.length - 1];
  const body = parts.slice(0, -1).join(FIELD_SEPARATOR);
  if (sig !== computeSignature(body)) return null;

  const rest = protocolVersion >= 2 ? parts.slice(2, -1) : [undefined, ...parts.slice(2, -1)];
  const [orgId, examId, versionId, pageStr, totalStr, studentId] = rest;
  const page = parseInt(pageStr ?? "", 10);
  const totalPages = parseInt(totalStr ?? "", 10);
  if (!Number.isFinite(page) || !Number.isFinite(totalPages)) return null;
  if (page < 1 || totalPages < 1 || page > totalPages) return null;
  if (!examId || !versionId) return null;
  if (protocolVersion >= 2 && !orgId) return null;
  if (protocolVersion === 3 && !studentId) return null;

  if (studentId) return { orgId, examId, versionId, page, totalPages, studentId };
  return orgId
    ? { orgId, examId, versionId, page, totalPages }
    : { examId, versionId, page, totalPages };
}

/**
 * Hash determinístico tipo "djb2" truncado a 8 chars hex.
 * NO es seguro criptográficamente. Solo evita QRs escritos a mano.
 * Lo implementamos in-line para no agregar dependencia.
 */
function computeSignature(body: string): string {
  const input = body + SIG_SALT;
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    // djb2: ((hash << 5) + hash) + c
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  // Convertimos a unsigned y devolvemos 8 chars hex.
  const unsigned = hash >>> 0;
  return unsigned.toString(16).padStart(8, "0");
}
