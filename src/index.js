/**
 * ecli-roj — validación y detección de citas de jurisprudencia española.
 *
 * Dos cosas distintas, que conviene no confundir:
 *
 *  1. **Validar un identificador** que alguien te da: ¿«ECLI:ES:TS:2021:1234» o
 *     «ROJ: STS 1234/2021» tienen forma válida? → `esEcli`, `esRoj`, `parseEcli`.
 *
 *  2. **Detectar en un texto que se está citando una resolución concreta**, aunque
 *     no venga ningún identificador: «el Tribunal Constitucional, en su sentencia
 *     190/2020…». → `detectarCitas`, `citasSinRespaldo`.
 *
 * Lo segundo es lo que hace falta cuando un modelo de lenguaje redacta el texto:
 * un identificador inventado es raro, pero una frase que atribuye una doctrina a
 * una sentencia que no existe es el fallo más común y el más caro. Si la cita no
 * puede respaldarse con un identificador comprobable, no debería publicarse.
 *
 * Sin dependencias. ESM. Solo jurisdicción española.
 *
 * @license MIT
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. Identificadores
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ECLI — European Case Law Identifier. Formato canónico:
 * `ECLI:<país>:<tribunal>:<año>:<número>`, p. ej. `ECLI:ES:TS:2021:1234`.
 */
export const RE_ECLI = /^ECLI:[A-Z]{2}:[A-Z0-9]+:\d{4}:[A-Z0-9]+$/i

/**
 * ROJ — Repertorio Oficial de Jurisprudencia del CENDOJ.
 * Acepta `ROJ: STS 1234/2021` y la forma corta `STS 1234/2021`.
 */
export const RE_ROJ = /^(?:ROJ:\s*)?[A-Z]{2,5}\s+\d+\/\d{4}$/i

/** ¿Es un ECLI con forma válida? */
export function esEcli(id) {
  return RE_ECLI.test(String(id ?? '').trim())
}

/** ¿Es un ROJ con forma válida? */
export function esRoj(id) {
  return RE_ROJ.test(String(id ?? '').trim())
}

/** ¿Es un identificador de jurisprudencia española con forma válida (ECLI o ROJ)? */
export function esIdentificadorValido(id) {
  return esEcli(id) || esRoj(id)
}

/**
 * Normaliza un identificador para poder compararlo: mayúsculas, sin el prefijo
 * `ROJ:` y sin espacios. `«ROJ: STS 1234/2021»` y `«sts 1234/2021»` colapsan al
 * mismo valor.
 */
export function normalizarIdentificador(id) {
  return String(id ?? '')
    .trim()
    .toUpperCase()
    .replace(/^ROJ:/, '')
    .replace(/\s+/g, '')
}

/**
 * Descompone un ECLI en sus partes. Devuelve `null` si no es válido.
 *
 * @returns {{pais: string, tribunal: string, anio: number, numero: string} | null}
 */
export function parseEcli(id) {
  const s = String(id ?? '').trim()
  if (!RE_ECLI.test(s)) return null
  const [, pais, tribunal, anio, numero] = s.split(':')
  return {
    pais: pais.toUpperCase(),
    tribunal: tribunal.toUpperCase(),
    anio: Number(anio),
    numero: numero.toUpperCase(),
  }
}

/**
 * Descompone un ROJ. Devuelve `null` si no es válido.
 *
 * @returns {{tribunal: string, numero: number, anio: number} | null}
 */
export function parseRoj(id) {
  const s = String(id ?? '').trim()
  if (!RE_ROJ.test(s)) return null
  const m = s.replace(/^ROJ:\s*/i, '').match(/^([A-Z]{2,5})\s+(\d+)\/(\d{4})$/i)
  if (!m) return null
  return { tribunal: m[1].toUpperCase(), numero: Number(m[2]), anio: Number(m[3]) }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Detección de citas en prosa
// ─────────────────────────────────────────────────────────────────────────────

/** Abreviaturas de resolución que preceden a una cita concreta. */
const TRIBUNALES_ABREV =
  'STS|STSJ|SAP|SJPI|STC|SAN|ATS|AAP|AAN|STSJUE|STJUE|STEDH|ATSJ|SJM|SJS'

const MESES =
  'enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre'

/**
 * Nombres desarrollados y coloquiales de tribunal.
 *
 * Esta rama existe por un fallo real: un detector que solo reconocía las
 * abreviaturas (STS, STC…) dejaba pasar «el Tribunal Constitucional, en su
 * sentencia 190/2020» o «el Constitucional, en sentencia 12/2016». La forma
 * coloquial es justamente la que escribe un modelo de lenguaje cuando redacta
 * en tono divulgativo.
 */
const TRIBUNAL_NOMBRE =
  'tribunal\\s+supremo|tribunal\\s+constitucional|tribunal\\s+superior\\s+de\\s+justicia|' +
  'audiencia\\s+provincial|audiencia\\s+nacional|tribunal\\s+de\\s+justicia\\s+de\\s+la\\s+uni[óo]n|' +
  'tribunal\\s+europeo\\s+de\\s+derechos\\s+humanos|tribunal\\s+general|el\\s+constitucional|el\\s+supremo|' +
  'alto\\s+tribunal|\\bTC\\b|\\bTS\\b|\\bTJUE\\b|\\bTEDH\\b|\\bTSJ\\b|\\bTJCE\\b'

/** Sustantivo que anuncia una resolución concreta. */
const RESOL_NOUN = 'sentencia|auto|resoluci[óo]n|fallo|asunto'

/** Identificador específico: número/año, fecha corta, o fecha larga en castellano. */
const ID_ESPECIFICO =
  `\\d+\\s*[/-]\\s*\\d{2,4}|\\d{1,2}\\s*[/.-]\\s*\\d{1,2}\\s*[/.-]\\s*\\d{2,4}|` +
  `\\d{1,2}\\s+de\\s+(?:${MESES})\\s+de\\s+\\d{4}|(?:${MESES})\\s+de\\s+\\d{4}`

const FUENTE_CITA = [
  'ECLI:[A-Z]{2}:[A-Z0-9]+:\\d{4}:[A-Z0-9]+',
  'ROJ:\\s*[A-Z]{2,5}\\s+\\d+\\/\\d{4}',
  // Abreviatura + (hasta 25 caracteres de lugar o «núm.») + número/año.
  `\\b(?:${TRIBUNALES_ABREV})\\b[^\\n]{0,25}?\\d+\\/\\d{2,4}`,
  // Nombre desarrollado + identificador. Admite solo el año: un tribunal
  // nombrado junto a un año ya es una atribución concreta.
  `(?:${TRIBUNAL_NOMBRE})[^\\n.;]{0,90}?(?:${ID_ESPECIFICO}|de\\s+\\d{4})`,
  // «sentencia … núm. N/AAAA» (el punto de «núm.» no cabe en la ventana genérica).
  '(?:sentencia|auto)\\b[^\\n.;]{0,45}?(?:n[úu]m\\.?|n[ºo]\\.?)\\s*\\d+\\/\\d{2,4}',
  // Sustantivo de resolución + identificador específico, sin tribunal.
  // Aquí el año suelto NO basta: «la sentencia de divorcio de 2019» es el caso
  // del propio usuario, no una cita de doctrina.
  `(?:${RESOL_NOUN})\\b[^\\n.;]{0,30}?(?:${ID_ESPECIFICO})`,
  `(?:sentencia|auto|tribunal\\s+supremo|audiencia\\s+provincial|${TRIBUNALES_ABREV})\\b[^\\n.;]{0,45}?\\b\\d{1,2}\\s+de\\s+(?:${MESES})\\s+de\\s+\\d{4}`,
  // Asunto del TJUE, con o sin la «C-».
  'asunto\\s+(?:C[-‑]\\s*)?\\d+\\/\\d+',
  // Repertorios Aranzadi.
  '\\b(?:RJ|JUR|AC|RTC)\\s+\\d{4}\\/\\d+',
].join('|')

/** Expresión que reconoce una referencia a una resolución concreta. */
export const RE_CITA_JURISPRUDENCIA = new RegExp(FUENTE_CITA, 'i')

/** ¿Este texto cita alguna resolución concreta? */
export function citaJurisprudencia(texto) {
  return RE_CITA_JURISPRUDENCIA.test(String(texto ?? ''))
}

/**
 * Devuelve todas las referencias a resoluciones encontradas en el texto.
 *
 * @param {string} texto
 * @returns {Array<{ cita: string, indice: number }>}
 */
export function detectarCitas(texto) {
  const re = new RegExp(FUENTE_CITA, 'gi')
  const fuera = []
  for (const m of String(texto ?? '').matchAll(re)) {
    fuera.push({ cita: m[0].trim(), indice: m.index ?? 0 })
  }
  return fuera
}

/**
 * El uso real: devuelve las citas del texto que **no** están respaldadas por
 * ninguno de los identificadores declarados. Una lista no vacía significa que el
 * texto atribuye doctrina a resoluciones que nadie ha comprobado.
 *
 * El respaldo se comprueba por contención sobre la forma normalizada, de modo
 * que «ROJ: STS 1234/2021» respalda a «STS 1234/2021» dentro de una frase.
 * Los identificadores declarados con forma inválida se ignoran: no respaldan nada.
 *
 * @param {string} texto Texto redactado (el cuerpo real, no lo que el modelo diga de sí mismo).
 * @param {string[]} identificadoresDeclarados ECLIs o ROJs que sí se han comprobado.
 * @returns {Array<{ cita: string, indice: number }>} citas sin respaldo
 */
export function citasSinRespaldo(texto, identificadoresDeclarados = []) {
  const declarados = identificadoresDeclarados
    .filter(esIdentificadorValido)
    .map(normalizarIdentificador)

  return detectarCitas(texto).filter((hallazgo) => {
    const normalizada = normalizarIdentificador(hallazgo.cita)
    return !declarados.some((d) => normalizada.includes(d) || d.includes(normalizada))
  })
}
