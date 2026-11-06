import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { CentroCoste } from '@domain/entities/CentroCoste.js';
import { Formato } from '@domain/entities/Formato.js';
import { LineaTelefonica } from '@domain/entities/LineaTelefonica.js';
import { DuplicateError, ForeignKeyError } from '@domain/errors/DomainError.js';

import { DrizzleCentroCosteRepository } from '@infrastructure/database/repositories/centro-coste.repository.js';
import { DrizzleFormatoRepository } from '@infrastructure/database/repositories/formato.repository.js';
import { DrizzleLineaRepository } from '@infrastructure/database/repositories/linea.repository.js';

import { crearBaseDePruebas, type BaseDePruebas } from './test-db.js';

describe('DrizzleCentroCosteRepository (integración)', () => {
  let base: BaseDePruebas;
  let repo: DrizzleCentroCosteRepository;
  let formatos: DrizzleFormatoRepository;
  let lineas: DrizzleLineaRepository;
  let formatoId: string;
  let otroFormatoId: string;

  beforeAll(async () => {
    base = await crearBaseDePruebas();
    repo = new DrizzleCentroCosteRepository(base.db);
    formatos = new DrizzleFormatoRepository(base.db);
    lineas = new DrizzleLineaRepository(base.db);
  });

  afterAll(async () => {
    await base.cerrar();
  });

  beforeEach(async () => {
    await base.limpiar();

    const formato = await formatos.crear(Formato.crearFormato({ nombre: 'SMU' }));
    const otro = await formatos.crear(Formato.crearFormato({ nombre: 'FALABELLA' }));

    formatoId = formato.id ?? '';
    otroFormatoId = otro.id ?? '';
  });

  it('crea un centro de coste y devuelve la entidad con el id', async () => {
    const creado = await repo.crear(
      CentroCoste.crearCentroCoste({
        codigo: '510',
        nombre: 'RENDIC AVDA CAMILO HENRIQUEZ 445 CURICO',
        formatoId,
      })
    );

    expect(creado.id).not.toBeNull();
    expect(creado.codigo).toBe('510');
    expect(creado.version).toBe(1);
  });

  it('rechaza códigos duplicados con DuplicateError', async () => {
    await repo.crear(
      CentroCoste.crearCentroCoste({ codigo: '510', nombre: 'Centro A', formatoId })
    );

    await expect(
      repo.crear(CentroCoste.crearCentroCoste({ codigo: '510', nombre: 'Centro B', formatoId }))
    ).rejects.toBeInstanceOf(DuplicateError);
  });

  it('rechaza un formato inexistente con ForeignKeyError', async () => {
    await expect(
      repo.crear(
        CentroCoste.crearCentroCoste({
          codigo: '999',
          nombre: 'Centro huérfano',
          formatoId: '00000000-0000-0000-0000-000000000000',
        })
      )
    ).rejects.toBeInstanceOf(ForeignKeyError);
  });

  it('busca por código ignorando mayúsculas y minúsculas', async () => {
    const creado = await repo.crear(
      CentroCoste.crearCentroCoste({ codigo: 'C059102801', nombre: 'FALABELLA TOTTUS', formatoId })
    );

    const encontrado = await repo.buscarPorCodigo('c059102801');

    expect(encontrado?.id).toBe(creado.id);
  });

  it('filtra el listado por código, nombre y formato', async () => {
    await repo.crear(CentroCoste.crearCentroCoste({ codigo: '510', nombre: 'RENDIC', formatoId }));
    await repo.crear(
      CentroCoste.crearCentroCoste({ codigo: 'C059102801', nombre: 'FALABELLA TOTTUS', formatoId })
    );
    await repo.crear(
      CentroCoste.crearCentroCoste({
        codigo: '777',
        nombre: 'OTRO CENTRO',
        formatoId: otroFormatoId,
      })
    );

    const porCodigo = await repo.listar({ codigo: '510' });
    const porNombre = await repo.listar({ nombre: 'falabella' });
    const porFormato = await repo.listar({ formatoId: otroFormatoId });

    expect(porCodigo.items).toHaveLength(1);
    expect(porCodigo.items[0]?.codigo).toBe('510');
    expect(porNombre.items).toHaveLength(1);
    expect(porNombre.items[0]?.nombre).toBe('FALABELLA TOTTUS');
    expect(porFormato.items).toHaveLength(1);
    expect(porFormato.items[0]?.codigo).toBe('777');
  });

  it('busca por fragmento de código o de nombre con el filtro de búsqueda', async () => {
    await repo.crear(
      CentroCoste.crearCentroCoste({
        codigo: 'C059102801',
        nombre: 'FALABELLA TOTTUS AV. ALESSANDRI',
        formatoId,
      })
    );
    await repo.crear(
      CentroCoste.crearCentroCoste({
        codigo: '510',
        nombre: 'RENDIC AVDA CAMILO HENRIQUEZ',
        formatoId,
      })
    );

    const porCodigo = await repo.listar({ busqueda: '0591' });
    const porNombre = await repo.listar({ busqueda: 'falabella' });
    const sinCoincidencias = await repo.listar({ busqueda: 'SMU' });

    expect(porCodigo.items.map((centro) => centro.codigo)).toEqual(['C059102801']);
    expect(porNombre.items.map((centro) => centro.codigo)).toEqual(['C059102801']);
    expect(sinCoincidencias.items).toHaveLength(0);
  });

  it('combina el filtro de búsqueda con otro filtro y con la paginación por cursor', async () => {
    await repo.crear(
      CentroCoste.crearCentroCoste({ codigo: 'CC-A', nombre: 'CENTRO COMUN A', formatoId })
    );
    await repo.crear(
      CentroCoste.crearCentroCoste({ codigo: 'CC-B', nombre: 'CENTRO COMUN B', formatoId })
    );
    await repo.crear(
      CentroCoste.crearCentroCoste({
        codigo: 'CC-C',
        nombre: 'CENTRO COMUN C',
        formatoId: otroFormatoId,
      })
    );

    const conFormato = await repo.listar({ busqueda: 'comun', formatoId: otroFormatoId });
    expect(conFormato.items.map((centro) => centro.codigo)).toEqual(['CC-C']);

    const primera = await repo.listar({ busqueda: 'comun', limit: 1 });
    expect(primera.items).toHaveLength(1);
    expect(primera.hasNextPage).toBe(true);

    const segunda = await repo.listar({
      busqueda: 'comun',
      limit: 1,
      afterId: primera.nextCursor ?? undefined,
    });
    expect(segunda.items).toHaveLength(1);
    expect(segunda.items[0]?.id).not.toBe(primera.items[0]?.id);
  });

  it('pagina el listado con cursor sin repetir registros', async () => {
    for (let indice = 0; indice < 5; indice += 1) {
      await repo.crear(
        CentroCoste.crearCentroCoste({
          codigo: `C-${indice}`,
          nombre: `Centro ${indice}`,
          formatoId,
        })
      );
    }

    const vistos = new Set<string>();
    let afterId: string | undefined;

    for (;;) {
      const pagina = await repo.listar({ limit: 2, afterId });

      for (const centro of pagina.items) {
        expect(vistos.has(centro.id ?? '')).toBe(false);
        vistos.add(centro.id ?? '');
      }

      if (!pagina.hasNextPage) {
        break;
      }

      afterId = pagina.nextCursor ?? undefined;
    }

    expect(vistos.size).toBe(5);
  });

  it('devuelve totalCount con el total de filas que coinciden con los filtros', async () => {
    await repo.crear(CentroCoste.crearCentroCoste({ codigo: '510', nombre: 'RENDIC', formatoId }));
    await repo.crear(
      CentroCoste.crearCentroCoste({ codigo: 'C059102801', nombre: 'FALABELLA TOTTUS', formatoId })
    );
    await repo.crear(
      CentroCoste.crearCentroCoste({
        codigo: '777',
        nombre: 'OTRO CENTRO',
        formatoId: otroFormatoId,
      })
    );

    const todos = await repo.listar({});
    expect(todos.totalCount).toBe(3);

    const porFormato = await repo.listar({ formatoId: otroFormatoId });
    expect(porFormato.totalCount).toBe(1);

    const porBusqueda = await repo.listar({ busqueda: 'rendic' });
    expect(porBusqueda.totalCount).toBe(1);

    const sinCoincidencias = await repo.listar({ busqueda: 'ZZZ' });
    expect(sinCoincidencias.totalCount).toBe(0);
    expect(sinCoincidencias.items).toHaveLength(0);
  });

  it('totalCount es independiente del límite y del cursor de paginación', async () => {
    for (let indice = 0; indice < 5; indice += 1) {
      await repo.crear(
        CentroCoste.crearCentroCoste({
          codigo: `C-${indice}`,
          nombre: `Centro ${indice}`,
          formatoId,
        })
      );
    }

    const primera = await repo.listar({ limit: 2 });
    expect(primera.totalCount).toBe(5);
    expect(primera.items).toHaveLength(2);
    expect(primera.hasNextPage).toBe(true);

    const segunda = await repo.listar({ limit: 2, afterId: primera.nextCursor ?? undefined });
    expect(segunda.totalCount).toBe(5);
    expect(segunda.items).toHaveLength(2);
  });

  it('actualiza con optimistic locking', async () => {
    const creado = await repo.crear(
      CentroCoste.crearCentroCoste({ codigo: '510', nombre: 'RENDIC', formatoId })
    );

    const conVersionVieja = await repo.actualizar(creado.renombrar('RENDIC NUEVO'), 42);
    expect(conVersionVieja).toBeNull();

    const actualizado = await repo.actualizar(creado.renombrar('RENDIC NUEVO'), creado.version);
    expect(actualizado?.nombre).toBe('RENDIC NUEVO');
    expect(actualizado?.version).toBe(creado.version + 1);
  });

  it('cambia el formato asociado y cuenta los centros por formato', async () => {
    const creado = await repo.crear(
      CentroCoste.crearCentroCoste({ codigo: '510', nombre: 'RENDIC', formatoId })
    );

    const actualizado = await repo.actualizar(creado.cambiarFormato(otroFormatoId), creado.version);

    expect(actualizado?.formatoId).toBe(otroFormatoId);
    expect(await repo.contarPorFormato(otroFormatoId)).toBe(1);
    expect(await repo.contarPorFormato(formatoId)).toBe(0);
  });

  it('no permite eliminar un centro de coste con líneas asociadas', async () => {
    const centro = await repo.crear(
      CentroCoste.crearCentroCoste({ codigo: '510', nombre: 'RENDIC', formatoId })
    );

    await lineas.crear(
      LineaTelefonica.crearLineaTelefonica({
        numero: '900000001',
        centroCosteId: centro.id ?? '',
      })
    );

    await expect(repo.eliminar(centro.id ?? '')).rejects.toBeInstanceOf(ForeignKeyError);
  });

  it('elimina solo si la versión esperada coincide (optimistic locking)', async () => {
    const centro = await repo.crear(
      CentroCoste.crearCentroCoste({ codigo: '510', nombre: 'RENDIC', formatoId })
    );

    // Versión incorrecta → no se borra nada.
    expect(await repo.eliminar(centro.id ?? '', 99)).toBe(false);
    expect(await repo.buscarPorId(centro.id ?? '')).not.toBeNull();

    // Versión correcta → se borra.
    expect(await repo.eliminar(centro.id ?? '', centro.version)).toBe(true);
    expect(await repo.buscarPorId(centro.id ?? '')).toBeNull();
  });

  it('listaTodos incluye el nombre del formato', async () => {
    await repo.crear(CentroCoste.crearCentroCoste({ codigo: '510', nombre: 'RENDIC', formatoId }));

    const todos = await repo.listarTodos();

    expect(todos).toHaveLength(1);
    expect(todos[0]?.formatoNombre).toBe('SMU');
    expect(todos[0]?.centro.codigo).toBe('510');
  });
});
