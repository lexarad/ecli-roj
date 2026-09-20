# ecli-roj

Validación y detección de citas de jurisprudencia española (**ECLI** y **ROJ**), pensada
para textos escritos por un modelo de lenguaje. Sin dependencias, ESM, Node ≥ 18.

```bash
npm install ecli-roj
```

## Por qué existe

Un identificador inventado es raro. Lo caro es otra cosa: una frase que atribuye una
doctrina a una sentencia que no existe.

> «el Tribunal Constitucional, en su sentencia 190/2020, declaró que…»

Esa frase no contiene ningún identificador que validar, suena impecable y es el error
más frecuente cuando un modelo redacta en tono divulgativo. Por eso este paquete hace
dos cosas distintas:

1. **Validar un identificador** que alguien te da (`esEcli`, `esRoj`, `parseEcli`).
2. **Detectar que un texto está citando una resolución concreta**, aunque no venga
   ningún identificador (`detectarCitas`, `citasSinRespaldo`).

La segunda es la que evita publicar doctrina inventada: si una cita no puede
respaldarse con un identificador comprobable, no debería salir.

## Uso

```js
import { citasSinRespaldo, esEcli, parseEcli } from 'ecli-roj'

const texto = `
  Como recuerda la STS 1234/2021, el plazo es de tres meses. Sin embargo,
  el Tribunal Constitucional, en su sentencia 190/2020, declaró lo contrario.
`

// Identificadores que SÍ se han comprobado contra una fuente oficial:
citasSinRespaldo(texto, ['ROJ: STS 1234/2021'])
// → [{ cita: 'Tribunal Constitucional, en su sentencia 190/2020', indice: 80 }]
//   La segunda cita no está respaldada: o se comprueba, o no se publica.

esEcli('ECLI:ES:TS:2021:1234') // true
parseEcli('ECLI:ES:TS:2021:1234')
// → { pais: 'ES', tribunal: 'TS', anio: 2021, numero: '1234' }
```

## API

| Función | Qué hace |
|---|---|
| `esEcli(id)` · `esRoj(id)` · `esIdentificadorValido(id)` | ¿Tiene forma válida? |
| `parseEcli(id)` → `{ pais, tribunal, anio, numero }` | Descompone un ECLI, o `null`. |
| `parseRoj(id)` → `{ tribunal, numero, anio }` | Descompone un ROJ, o `null`. |
| `normalizarIdentificador(id)` | Colapsa `ROJ: STS 1234/2021` y `sts 1234/2021`. |
| `citaJurisprudencia(texto)` | ¿El texto cita alguna resolución concreta? |
| `detectarCitas(texto)` → `[{ cita, indice }]` | Todas las referencias encontradas. |
| `citasSinRespaldo(texto, declarados)` | Las que **no** respalda ningún identificador. |

También se exportan `RE_ECLI`, `RE_ROJ` y `RE_CITA_JURISPRUDENCIA`.

## Qué reconoce

- **ECLI**: `ECLI:ES:TS:2021:1234`, `ECLI:EU:C:2019:801`.
- **ROJ** del CENDOJ: `ROJ: STS 1234/2021` y la forma corta `STS 1234/2021`.
- **Abreviaturas** con lugar o «núm.» por medio: `SAP Barcelona núm. 55/2018`.
- **Nombres desarrollados y coloquiales**: «el Tribunal Supremo…», «el Constitucional…»,
  «el TC…», «el alto tribunal…».
- **Fechas largas**: «sentencia del Tribunal Supremo de 12 de marzo de 2019».
- **Asuntos del TJUE** (`asunto C-415/2011`) y repertorios **Aranzadi** (`RJ 2019/1234`).

La rama de nombres desarrollados existe por un fallo real: un detector que solo
reconocía las abreviaturas dejó pasar diez citas inventadas seguidas, todas escritas
en la forma coloquial que usa un modelo cuando redacta para un lector no jurista.

### Lo que deliberadamente NO marca

«mi sentencia de divorcio de 2019» es el caso del propio usuario, no una cita de
doctrina. Un año suelto solo cuenta como cita cuando aparece junto a un tribunal
nombrado.

El criterio general es fallar del lado seguro: ante la duda, marcar de más y que lo
revise una persona. Marcar de menos significa publicar una sentencia que no existe.

## Alcance

Solo jurisdicción española. No consulta ninguna base de datos: comprueba **forma** y
**respaldo**, no que la resolución exista. Para eso hace falta contrastar el
identificador contra una fuente oficial — [CENDOJ](https://www.poderjudicial.es/search/)
o el [buscador ECLI europeo](https://e-justice.europa.eu/) — que es justo el paso que
este paquete te obliga a dar.

## Tests

```bash
npm test   # node --test, sin dependencias
```

## Licencia

MIT. Extraído del verificador de citas que usa [Zertidox](https://zertidox.com) para
que ningún documento salga con una cita que nadie ha comprobado.

---

**English:** validates and detects Spanish case-law citations (ECLI, ROJ) in
LLM-generated text. The interesting part isn't validating an identifier — it's
spotting that a sentence attributes a holding to a specific ruling when no
verifiable identifier backs it. Zero dependencies, ESM, Node ≥ 18.
