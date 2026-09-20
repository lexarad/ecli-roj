import test from 'node:test'
import assert from 'node:assert/strict'

import {
  esEcli,
  esRoj,
  esIdentificadorValido,
  normalizarIdentificador,
  parseEcli,
  parseRoj,
  citaJurisprudencia,
  detectarCitas,
  citasSinRespaldo,
} from '../src/index.js'

// ── Identificadores ──────────────────────────────────────────────────────────

test('ECLI válido e inválido', () => {
  assert.ok(esEcli('ECLI:ES:TS:2021:1234'))
  assert.ok(esEcli('ecli:es:tc:2020:190')) // insensible a mayúsculas
  assert.ok(esEcli('ECLI:EU:C:2019:801'))

  assert.ok(!esEcli('ECLI:ES:TS:21:1234')) // año de dos cifras
  assert.ok(!esEcli('ECLI:ES:TS:2021')) // falta el número
  assert.ok(!esEcli('STS 1234/2021'))
  assert.ok(!esEcli(''))
  assert.ok(!esEcli(null))
})

test('ROJ válido e inválido', () => {
  assert.ok(esRoj('ROJ: STS 1234/2021'))
  assert.ok(esRoj('STS 1234/2021')) // forma corta
  assert.ok(esRoj('roj:  sap 55/2018'))

  assert.ok(!esRoj('STS 1234/21')) // año de dos cifras
  assert.ok(!esRoj('SENTENCIA 1234/2021')) // más de 5 letras
  assert.ok(!esRoj('1234/2021'))
})

test('esIdentificadorValido acepta ambas familias', () => {
  assert.ok(esIdentificadorValido('ECLI:ES:TS:2021:1234'))
  assert.ok(esIdentificadorValido('ROJ: STS 1234/2021'))
  assert.ok(!esIdentificadorValido('el Supremo, en 2021'))
})

test('normalizarIdentificador colapsa las formas equivalentes', () => {
  assert.equal(normalizarIdentificador('ROJ: STS 1234/2021'), 'STS1234/2021')
  assert.equal(normalizarIdentificador('sts  1234/2021'), 'STS1234/2021')
  assert.equal(
    normalizarIdentificador('ROJ: STS 1234/2021'),
    normalizarIdentificador('STS 1234/2021'),
  )
})

test('parseEcli descompone y rechaza', () => {
  assert.deepEqual(parseEcli('ECLI:ES:TS:2021:1234'), {
    pais: 'ES',
    tribunal: 'TS',
    anio: 2021,
    numero: '1234',
  })
  assert.equal(parseEcli('STS 1234/2021'), null)
})

test('parseRoj descompone y rechaza', () => {
  assert.deepEqual(parseRoj('ROJ: SAP 55/2018'), { tribunal: 'SAP', numero: 55, anio: 2018 })
  assert.deepEqual(parseRoj('STS 1234/2021'), { tribunal: 'STS', numero: 1234, anio: 2021 })
  assert.equal(parseRoj('ECLI:ES:TS:2021:1234'), null)
})

// ── Detección en prosa ───────────────────────────────────────────────────────

test('detecta la cita por abreviatura', () => {
  assert.ok(citaJurisprudencia('Como recuerda la STS 1234/2021, el plazo es de tres meses.'))
  assert.ok(citaJurisprudencia('la SAP Barcelona núm. 55/2018 lo confirma'))
})

test('detecta el nombre desarrollado y el coloquial', () => {
  // Estas tres formas son las que dejaba pasar un detector de solo abreviaturas.
  assert.ok(citaJurisprudencia('el Tribunal Constitucional, en su sentencia 190/2020, declaró…'))
  assert.ok(citaJurisprudencia('el Constitucional, en sentencia 12/2016, fijó doctrina'))
  assert.ok(citaJurisprudencia('el TC en su sentencia 45/2018'))
  assert.ok(citaJurisprudencia('el Tribunal Supremo, en su sentencia de 2017, sostuvo'))
})

test('detecta identificadores, fechas largas, asuntos del TJUE y Aranzadi', () => {
  assert.ok(citaJurisprudencia('ECLI:ES:TS:2021:1234'))
  assert.ok(citaJurisprudencia('ROJ: STS 1234/2021'))
  assert.ok(citaJurisprudencia('la sentencia del Tribunal Supremo de 12 de marzo de 2019'))
  assert.ok(citaJurisprudencia('el asunto C-415/2011'))
  assert.ok(citaJurisprudencia('RJ 2019/1234'))
})

test('no confunde el caso del propio usuario con una cita de doctrina', () => {
  assert.ok(!citaJurisprudencia('mi sentencia de divorcio de 2019 dice otra cosa'))
  assert.ok(!citaJurisprudencia('El contrato se firmó en 2021 por tres años.'))
  assert.ok(!citaJurisprudencia('El artículo 1124 del Código Civil regula la resolución.'))
})

test('detectarCitas devuelve todas las apariciones con su posición', () => {
  const texto = 'Primero la STS 1234/2021 y después la SAP 55/2018 lo confirman.'
  const hallazgos = detectarCitas(texto)
  assert.equal(hallazgos.length, 2)
  assert.match(hallazgos[0].cita, /STS 1234\/2021/)
  assert.match(hallazgos[1].cita, /SAP 55\/2018/)
  assert.ok(hallazgos[0].indice < hallazgos[1].indice)
})

// ── El uso real: citas sin respaldo ──────────────────────────────────────────

test('una cita respaldada por su identificador no se marca', () => {
  const texto = 'Como recuerda la STS 1234/2021, el plazo es de tres meses.'
  assert.deepEqual(citasSinRespaldo(texto, ['ROJ: STS 1234/2021']), [])
})

test('una cita sin identificador declarado se marca', () => {
  const texto = 'el Tribunal Constitucional, en su sentencia 190/2020, declaró lo contrario'
  const sinRespaldo = citasSinRespaldo(texto, ['ROJ: STS 1234/2021'])
  assert.equal(sinRespaldo.length, 1)
  assert.match(sinRespaldo[0].cita, /190\/2020/)
})

test('un identificador declarado con forma inválida no respalda nada', () => {
  const texto = 'Como recuerda la STS 1234/2021, el plazo es de tres meses.'
  assert.equal(citasSinRespaldo(texto, ['sentencia del Supremo de 2021']).length, 1)
})

test('un texto sin citas no produce hallazgos', () => {
  assert.deepEqual(citasSinRespaldo('El artículo 1124 del Código Civil regula la resolución.'), [])
})
