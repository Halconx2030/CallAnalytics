import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { CentroCoste } from '@domain/entities/CentroCoste.js';
import { Formato } from '@domain/entities/Formato.js';
import { LineaTelefonica } from '@domain/entities/LineaTelefonica.js';
import { DuplicateError, ForeignKeyError } from '@domain/errors/DomainError.js';

import type {
  ColumnaOrdenLinea,
  DireccionOrden,
} from '@application/ports/repositories/LineaRepository.js';

import { DrizzleCentroCosteRepository } from '@infrastructure/database/repositories/centro-coste.repository.js';
import { DrizzleFormatoRepository } from '@infrastructure/database/repositories/formato.repository.js';
import { DrizzleLineaRepository } from '@infrastructure/database/repositories/linea.repository.js';

import { crearBaseDePruebas, type BaseDePruebas } from './test-db.js';

/** Número móvil válido y único por índice: `9` + 8 dígitos. */
function numeroMovil(indice: number): string {
  return `9${String(indice).padStart(8, '0')}`;
}

describe('DrizzleLineaRepository (integración)', () => {
  let base: BaseDePruebas;
  let repo: DrizzleLineaRepository;
  let formatos: DrizzleFormatoRepository;
  let centros: DrizzleCentroCosteRepository;
  let formatoId: string;
  let centroCosteId: string;
  let otroCentroCosteId: string;

  beforeAll(async () => {
    base = await crearBaseDePruebas();
    repo = new DrizzleLineaRepository(base.db);
    formatos = new DrizzleFormatoRepository(base.db);
    centros = new DrizzleCentroCosteRepository(base.db);
  });

  afterAll(async () => {
    await base.cerrar();
  });

  beforeEach(async () => {
    await base.limpiar();

    const formato = await formatos.crear(Formato.crearFormato({ nombre: 'SMU' }));
    const centro = await centros.crear(
      CentroCoste.crearCentroCoste({
        codigo: '510',
        nombre: 'RENDIC AVDA CAMILO HENRIQUEZ 445 CURICO',
        formatoId: formato.id ?? '',
      })
    );
    const otroCentro = await centros.crear(
      CentroCoste.crearCentroCoste({
        codigo: 'C059102801',
        nombre: 'FALABELLA TOTTUS',
        formatoId: formato.id ?? '',
      })
    );

    centroCosteId = centro.id ?? '';
    otroCentroCosteId = otroCentro.id ?? '';
    formatoId = formato.id ?? '';
  });

  it('crea una línea con los valores por defecto de la spec', async () => {
    const creada = await repo.crear(
      LineaTelefonica.crearLineaTelefonica({
        numero: '9 1234 5678',
        centroCosteId,
      })
    );

    expect(creada.id).not.toBeNull();
    expect(creada.numero).toBe('+56912345678');
    expect(creada.estado).toBe('pendiente');
    expect(creada.tipoUso).toBe('personal');
    expect(creada.proveedor).toBe('');
    expect(creada.empleado).toBeNull();
    expect(creada.costoMensual.valor).toBe(0);
    expect(creada.version).toBe(1);
  });

  it('rechaza números duplicados con DuplicateError', async () => {
    await repo.crear(LineaTelefonica.crearLineaTelefonica({ numero: '900000001', centroCosteId }));

    await expect(
      repo.crear(LineaTelefonica.crearLineaTelefonica({ numero: '+56900000001', centroCosteId }))
    ).rejects.toBeInstanceOf(DuplicateError);
  });

  it('rechaza un centro de coste inexistente con ForeignKeyError', async () => {
    await expect(
      repo.crear(
        LineaTelefonica.crearLineaTelefonica({
          numero: '900000001',
          centroCosteId: '00000000-0000-0000-0000-000000000000',
        })
      )
    ).rejects.toBeInstanceOf(ForeignKeyError);
  });

  it('busca por id y por número (solo líneas activas)', async () => {
    const creada = await repo.crear(
      LineaTelefonica.crearLineaTelefonica({ numero: '900000001', centroCosteId })
    );

    const porId = await repo.buscarPorId(creada.id ?? '');
    const porNumero = await repo.buscarPorNumero('+56900000001');

    expect(porId?.id).toBe(creada.id);
    expect(porNumero?.id).toBe(creada.id);

    await repo.actualizarEstadoMasivo([creada.id ?? ''], 'baja', new Date());
    expect(await repo.buscarPorNumero('+56900000001')).toBeNull();
  });

  it('pagina con cursor recorriendo todas las líneas sin repeticiones', async () => {
    for (let indice = 1; indice <= 25; indice += 1) {
      await repo.crear(
        LineaTelefonica.crearLineaTelefonica({
          numero: numeroMovil(indice),
          centroCosteId,
        })
      );
    }

    const vistos = new Set<string>();
    let afterId: string | undefined;
    let paginas = 0;

    for (;;) {
      const pagina = await repo.listar({ limit: 10, afterId });
      paginas += 1;

      for (const item of pagina.items) {
        expect(vistos.has(item.linea.id ?? '')).toBe(false);
        vistos.add(item.linea.id ?? '');
      }

      if (!pagina.hasNextPage) {
        expect(pagina.nextCursor).toBeNull();
        break;
      }

      afterId = pagina.nextCursor ?? undefined;
      expect(afterId).toBeDefined();
    }

    expect(paginas).toBe(3);
    expect(vistos.size).toBe(25);
  });

  it('devuelve totalCount con el total de líneas activas que coinciden con los filtros', async () => {
    await repo.crear(LineaTelefonica.crearLineaTelefonica({ numero: '900000001', centroCosteId }));
    await repo.crear(
      LineaTelefonica.crearLineaTelefonica({
        numero: '900000002',
        centroCosteId: otroCentroCosteId,
      })
    );
    await repo.crear(LineaTelefonica.crearLineaTelefonica({ numero: '900000003', centroCosteId }));

    const pagina = await repo.listar({ limit: 100 });
    expect(pagina.totalCount).toBe(3);
    expect(pagina.items).toHaveLength(3);

    const otro = await repo.listar({ centroCosteId: otroCentroCosteId, limit: 100 });
    expect(otro.totalCount).toBe(1);
    expect(otro.items).toHaveLength(1);

    const sinCoincidencias = await repo.listar({ proveedor: 'NOEXISTE', limit: 100 });
    expect(sinCoincidencias.totalCount).toBe(0);
    expect(sinCoincidencias.items).toHaveLength(0);

    // Las dadas de baja no se cuentan (condicion deleted_at IS NULL).
    const dadaDeBaja = await repo.crear(
      LineaTelefonica.crearLineaTelefonica({ numero: '900000004', centroCosteId })
    );
    await repo.actualizarEstadoMasivo([dadaDeBaja.id ?? ''], 'baja', new Date());
    const activas = await repo.listar({ limit: 100 });
    expect(activas.totalCount).toBe(3);
  });

  it('aplica los filtros de texto, enums, fechas y costos', async () => {
    await repo.crear(
      LineaTelefonica.crearLineaTelefonica({
        numero: '900000001',
        centroCosteId,
        proveedor: 'Entel',
        fechaAsignacion: '2026-01-10',
        costoMensual: 5000,
        empleado: 'Ana Pérez',
        estado: 'activa',
        tipoUso: 'geovictoria',
      })
    );
    await repo.crear(
      LineaTelefonica.crearLineaTelefonica({
        numero: '900000002',
        centroCosteId: otroCentroCosteId,
        proveedor: 'Movistar',
        fechaAsignacion: '2026-02-20',
        costoMensual: 15000,
        empleado: 'Beto Díaz',
        estado: 'pendiente',
        tipoUso: 'personal',
        tipoLinea: 'movil',
      })
    );

    expect((await repo.listar({ numero: '0000001' })).items).toHaveLength(1);
    expect((await repo.listar({ proveedor: 'entel' })).items).toHaveLength(1);
    expect((await repo.listar({ centroCosteId })).items).toHaveLength(1);
    expect((await repo.listar({ centroCosteCodigo: 'C0591' })).items).toHaveLength(1);
    expect((await repo.listar({ centroCosteNombre: 'falabella' })).items).toHaveLength(1);
    expect((await repo.listar({ fechaAsignacion: '2026-01-10' })).items).toHaveLength(1);
    expect((await repo.listar({ fechaDesde: '2026-02-01' })).items).toHaveLength(1);
    expect((await repo.listar({ fechaHasta: '2026-01-31' })).items).toHaveLength(1);
    expect((await repo.listar({ costoMin: 10000 })).items).toHaveLength(1);
    expect((await repo.listar({ costoMax: 10000 })).items).toHaveLength(1);
    expect((await repo.listar({ tipoLinea: 'movil' })).items).toHaveLength(2);
    expect((await repo.listar({ empleado: 'ana' })).items).toHaveLength(1);
    expect((await repo.listar({ estado: 'activa' })).items).toHaveLength(1);
    expect((await repo.listar({ tipoUso: 'geovictoria' })).items).toHaveLength(1);
  });

  it('filtra por texto de centro de coste (código o nombre) con semántica OR', async () => {
    const centroAlfa = await centros.crear(
      CentroCoste.crearCentroCoste({
        codigo: 'ZZTEST-A',
        nombre: 'CENTRO COMUN ALFA',
        formatoId: formatoId,
      })
    );
    const centroBeta = await centros.crear(
      CentroCoste.crearCentroCoste({
        codigo: 'ZZTEST-B',
        nombre: 'CENTRO COMUN BETA',
        formatoId: formatoId,
      })
    );

    await repo.crear(
      LineaTelefonica.crearLineaTelefonica({
        numero: '900000001',
        centroCosteId: centroAlfa.id ?? '',
        proveedor: 'Entel',
      })
    );
    await repo.crear(
      LineaTelefonica.crearLineaTelefonica({
        numero: '900000002',
        centroCosteId: centroBeta.id ?? '',
        proveedor: 'Movistar',
      })
    );
    await repo.crear(LineaTelefonica.crearLineaTelefonica({ numero: '900000003', centroCosteId }));

    // Fragmento de nombre: encuentra los dos centros que lo comparten.
    const porNombre = await repo.listar({ centroCosteBusqueda: 'comun' });
    expect(porNombre.items).toHaveLength(2);

    // Fragmento de código: también encuentra los dos.
    const porCodigo = await repo.listar({ centroCosteBusqueda: 'zztest' });
    expect(porCodigo.items).toHaveLength(2);

    // Un centro concreto: solo uno.
    const uno = await repo.listar({ centroCosteBusqueda: 'ZZTEST-A' });
    expect(uno.items).toHaveLength(1);
    expect(uno.items[0]?.centroCosteCodigo).toBe('ZZTEST-A');

    // Se combina con los demás filtros.
    const combinado = await repo.listar({
      centroCosteBusqueda: 'comun',
      proveedor: 'Entel',
    });
    expect(combinado.items).toHaveLength(1);
    expect(combinado.items[0]?.linea.proveedor).toBe('Entel');

    // Sin coincidencias: lista vacía.
    expect((await repo.listar({ centroCosteBusqueda: 'NOEXISTE' })).items).toHaveLength(0);

    // La exportación usa el mismo filtro.
    expect(await repo.exportar({ centroCosteBusqueda: 'comun' }, false)).toHaveLength(2);
    expect(await repo.exportar({ centroCosteBusqueda: 'ZZTEST-B' }, false)).toHaveLength(1);

    // Funciona con la paginación por cursor (el cursor no cambia).
    const pagina = await repo.listar({ centroCosteBusqueda: 'comun', limit: 1 });
    expect(pagina.items).toHaveLength(1);
    expect(pagina.hasNextPage).toBe(true);

    const siguiente = await repo.listar({
      centroCosteBusqueda: 'comun',
      limit: 1,
      afterId: pagina.nextCursor ?? undefined,
    });
    expect(siguiente.items).toHaveLength(1);
    expect(siguiente.items[0]?.linea.id).not.toBe(pagina.items[0]?.linea.id);
  });

  it('ordena por número, costo, fecha y creación', async () => {
    await repo.crear(
      LineaTelefonica.crearLineaTelefonica({
        numero: '900000003',
        centroCosteId,
        costoMensual: 3000,
        fechaAsignacion: '2026-03-01',
      })
    );
    await repo.crear(
      LineaTelefonica.crearLineaTelefonica({
        numero: '900000001',
        centroCosteId,
        costoMensual: 1000,
        fechaAsignacion: '2026-01-01',
      })
    );
    await repo.crear(
      LineaTelefonica.crearLineaTelefonica({
        numero: '900000002',
        centroCosteId,
        costoMensual: 2000,
        fechaAsignacion: '2026-02-01',
      })
    );

    const porNumeroAsc = await repo.listar({ sortColumn: 'numero', sortOrder: 'asc' });
    const porNumeroDesc = await repo.listar({ sortColumn: 'numero', sortOrder: 'desc' });
    const porCosto = await repo.listar({ sortColumn: 'costo_mensual', sortOrder: 'asc' });
    const porFecha = await repo.listar({ sortColumn: 'fecha_asignacion', sortOrder: 'desc' });
    const porCreacion = await repo.listar({ sortColumn: 'created_at', sortOrder: 'asc' });

    expect(porNumeroAsc.items.map((item) => item.linea.numero)).toEqual([
      '+56900000001',
      '+56900000002',
      '+56900000003',
    ]);
    expect(porNumeroDesc.items[0]?.linea.numero).toBe('+56900000003');
    expect(porCosto.items.map((item) => item.linea.costoMensual.valor)).toEqual([1000, 2000, 3000]);
    expect(porFecha.items[0]?.linea.fechaAsignacion).toBe('2026-03-01');
    expect(porCreacion.items).toHaveLength(3);
  });

  it('ordena y pagina por las 9 columnas en ambos sentidos', async () => {
    const lineaA = await repo.crear(
      LineaTelefonica.crearLineaTelefonica(
        {
          numero: '900000001',
          centroCosteId,
          proveedor: 'Entel',
          fechaAsignacion: '2026-01-10',
          costoMensual: 900,
          tipoLinea: 'fijo',
          estado: 'activa',
          tipoUso: 'geovictoria',
        },
        new Date('2026-01-15T10:00:00.000Z')
      )
    );
    const lineaB = await repo.crear(
      LineaTelefonica.crearLineaTelefonica(
        {
          numero: '900000002',
          centroCosteId: otroCentroCosteId,
          proveedor: 'Movistar',
          fechaAsignacion: '2026-02-20',
          costoMensual: 1000,
          tipoLinea: 'movil',
          estado: 'pendiente',
          tipoUso: 'personal',
        },
        new Date('2026-01-16T10:00:00.000Z')
      )
    );
    const lineaC = await repo.crear(
      LineaTelefonica.crearLineaTelefonica(
        {
          numero: '900000003',
          centroCosteId: otroCentroCosteId,
          proveedor: 'Claro',
          fechaAsignacion: '2026-03-05',
          costoMensual: 1500,
          tipoLinea: 'movil',
          estado: 'portabilidad',
          tipoUso: 'personal',
        },
        new Date('2026-01-17T10:00:00.000Z')
      )
    );

    const idA = lineaA.id ?? '';
    const idB = lineaB.id ?? '';
    const idC = lineaC.id ?? '';
    // B y C empatan en `centro_coste_codigo`, `tipo_linea` y `tipo_uso`: desempata el id.
    const idsEmpatados = [idB, idC].sort();
    const primero = idsEmpatados[0] ?? '';
    const segundo = idsEmpatados[1] ?? '';

    // Dos centros distintos (el empate dentro del mismo centro cubre el desempate por id).
    expect(lineaA.centroCosteId).not.toBe(lineaB.centroCosteId);
    // 900 < 1000: el orden de `costo_mensual` es numérico, no lexicográfico.
    expect([lineaA.costoMensual.valor, lineaB.costoMensual.valor]).toEqual([900, 1000]);

    /** Recorre todas las páginas con `limit: 1` y devuelve los ids en el orden entregado. */
    const recorrer = async (
      sortColumn: ColumnaOrdenLinea,
      sortOrder: DireccionOrden
    ): Promise<string[]> => {
      const ids: string[] = [];
      let afterId: string | undefined;
      let paginas = 0;

      for (;;) {
        const pagina = await repo.listar({ limit: 1, afterId, sortColumn, sortOrder });
        paginas += 1;

        for (const item of pagina.items) {
          ids.push(item.linea.id ?? '');
        }

        if (!pagina.hasNextPage) {
          expect(pagina.nextCursor).toBeNull();
          break;
        }

        afterId = pagina.nextCursor ?? undefined;
        expect(afterId).toBeDefined();
      }

      expect(paginas).toBe(3);
      expect(new Set(ids).size).toBe(3);

      return ids;
    };

    const casos: { columna: ColumnaOrdenLinea; asc: string[]; desc: string[] }[] = [
      { columna: 'numero', asc: [idA, idB, idC], desc: [idC, idB, idA] },
      { columna: 'proveedor', asc: [idC, idA, idB], desc: [idB, idA, idC] },
      {
        columna: 'centro_coste_codigo',
        asc: [idA, primero, segundo],
        desc: [segundo, primero, idA],
      },
      { columna: 'fecha_asignacion', asc: [idA, idB, idC], desc: [idC, idB, idA] },
      { columna: 'costo_mensual', asc: [idA, idB, idC], desc: [idC, idB, idA] },
      { columna: 'tipo_linea', asc: [idA, primero, segundo], desc: [segundo, primero, idA] },
      { columna: 'estado', asc: [idA, idB, idC], desc: [idC, idB, idA] },
      { columna: 'tipo_uso', asc: [idA, primero, segundo], desc: [segundo, primero, idA] },
      { columna: 'created_at', asc: [idA, idB, idC], desc: [idC, idB, idA] },
    ];

    for (const caso of casos) {
      expect(await recorrer(caso.columna, 'asc'), `${caso.columna} asc`).toEqual(caso.asc);
      expect(await recorrer(caso.columna, 'desc'), `${caso.columna} desc`).toEqual(caso.desc);
    }
  });

  it('exporta con los datos del centro de coste y respeta incluir_bajas', async () => {
    const activa = await repo.crear(
      LineaTelefonica.crearLineaTelefonica({ numero: '900000001', centroCosteId })
    );
    const dadaDeBaja = await repo.crear(
      LineaTelefonica.crearLineaTelefonica({ numero: '900000002', centroCosteId })
    );

    await repo.actualizarEstadoMasivo([dadaDeBaja.id ?? ''], 'baja', new Date());

    const sinBajas = await repo.exportar({}, false);
    const conBajas = await repo.exportar({}, true);

    expect(sinBajas).toHaveLength(1);
    expect(sinBajas[0]?.numero).toBe(activa.numero);
    expect(sinBajas[0]?.centroCosteCodigo).toBe('510');
    expect(sinBajas[0]?.centroCosteNombre).toBe('RENDIC AVDA CAMILO HENRIQUEZ 445 CURICO');
    expect(sinBajas[0]?.costoMensual).toBe('0.00');
    expect(conBajas).toHaveLength(2);
  });

  it('actualiza aplicando optimistic locking', async () => {
    const creada = await repo.crear(
      LineaTelefonica.crearLineaTelefonica({ numero: '900000001', centroCosteId })
    );

    const modificada = creada.actualizar({ proveedor: 'VTR', costoMensual: 7500 });

    const conVersionVieja = await repo.actualizar(modificada, 99);
    expect(conVersionVieja).toBeNull();

    const actualizada = await repo.actualizar(modificada, creada.version);
    expect(actualizada?.proveedor).toBe('VTR');
    expect(actualizada?.costoMensual.valor).toBe(7500);
    expect(actualizada?.version).toBe(creada.version + 1);
  });

  it('cambia el estado de varias líneas de forma transaccional e idempotente', async () => {
    const activa = await repo.crear(
      LineaTelefonica.crearLineaTelefonica({
        numero: '900000001',
        centroCosteId,
        estado: 'activa',
      })
    );
    const pendiente = await repo.crear(
      LineaTelefonica.crearLineaTelefonica({ numero: '900000002', centroCosteId })
    );
    const yaBaja = await repo.crear(
      LineaTelefonica.crearLineaTelefonica({ numero: '900000003', centroCosteId })
    );

    await repo.actualizarEstadoMasivo([yaBaja.id ?? ''], 'baja', new Date());

    const resultado = await repo.actualizarEstadoMasivo(
      [
        activa.id ?? '',
        pendiente.id ?? '',
        yaBaja.id ?? '',
        '00000000-0000-0000-0000-000000000000',
      ],
      'baja',
      new Date()
    );

    expect(resultado.actualizados).toBe(2);
    expect(resultado.sinCambios).toBe(1);
    expect(resultado.noEncontrados).toBe(1);

    const segunda = await repo.actualizarEstadoMasivo(
      [activa.id ?? '', pendiente.id ?? ''],
      'baja',
      new Date()
    );

    expect(segunda.actualizados).toBe(0);
    expect(segunda.sinCambios).toBe(2);

    const reactivada = await repo.actualizarEstadoMasivo([activa.id ?? ''], 'activa', new Date());
    expect(reactivada.actualizados).toBe(1);
    expect((await repo.buscarPorNumero(activa.numero))?.estado).toBe('activa');
  });

  it('inserta varias líneas en una sola transacción y hace rollback si una falla', async () => {
    const lineas = [1, 2, 3].map((indice) =>
      LineaTelefonica.crearLineaTelefonica({
        numero: numeroMovil(indice),
        centroCosteId,
      })
    );

    const insertadas = await repo.crearMuchas(lineas);
    expect(insertadas).toHaveLength(3);

    const conDuplicado = [
      LineaTelefonica.crearLineaTelefonica({ numero: numeroMovil(10), centroCosteId }),
      LineaTelefonica.crearLineaTelefonica({ numero: numeroMovil(10), centroCosteId }),
    ];

    await expect(repo.crearMuchas(conDuplicado)).rejects.toBeInstanceOf(DuplicateError);

    const pagina = await repo.listar({ limit: 100 });
    expect(pagina.items).toHaveLength(3);
  });
});
