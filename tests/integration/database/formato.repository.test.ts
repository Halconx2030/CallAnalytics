import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { Formato } from '@domain/entities/Formato.js';
import { DuplicateError, ValidationError } from '@domain/errors/DomainError.js';

import { DrizzleFormatoRepository } from '@infrastructure/database/repositories/formato.repository.js';

import { crearBaseDePruebas, type BaseDePruebas } from './test-db.js';

describe('DrizzleFormatoRepository (integración)', () => {
  let base: BaseDePruebas;
  let repo: DrizzleFormatoRepository;

  beforeAll(async () => {
    base = await crearBaseDePruebas();
    repo = new DrizzleFormatoRepository(base.db);
  });

  afterAll(async () => {
    await base.cerrar();
  });

  beforeEach(async () => {
    await base.limpiar();
  });

  it('crea un formato y devuelve la entidad con el id de la base de datos', async () => {
    const creado = await repo.crear(Formato.crearFormato({ nombre: 'SMU' }));

    expect(creado.id).not.toBeNull();
    expect(creado.nombre).toBe('SMU');
    expect(creado.version).toBe(1);
  });

  it('rechaza nombres duplicados con DuplicateError', async () => {
    await repo.crear(Formato.crearFormato({ nombre: 'SMU' }));

    await expect(repo.crear(Formato.crearFormato({ nombre: 'SMU' }))).rejects.toBeInstanceOf(
      DuplicateError
    );
  });

  it('busca por id y por nombre', async () => {
    const creado = await repo.crear(Formato.crearFormato({ nombre: 'FALABELLA' }));

    const porId = await repo.buscarPorId(creado.id ?? '');
    const porNombre = await repo.buscarPorNombre('FALABELLA');

    expect(porId?.nombre).toBe('FALABELLA');
    expect(porNombre?.id).toBe(creado.id);
  });

  it('devuelve null cuando el formato no existe', async () => {
    expect(await repo.buscarPorId('00000000-0000-0000-0000-000000000000')).toBeNull();
    expect(await repo.buscarPorNombre('NO-EXISTE')).toBeNull();
  });

  it('actualiza aplicando optimistic locking e incrementando la versión', async () => {
    const creado = await repo.crear(Formato.crearFormato({ nombre: 'SMU' }));

    const conVersionVieja = await repo.actualizar(creado.renombrar('SMU NUEVO'), 99);
    expect(conVersionVieja).toBeNull();

    const actualizado = await repo.actualizar(creado.renombrar('SMU NUEVO'), creado.version);
    expect(actualizado?.nombre).toBe('SMU NUEVO');
    expect(actualizado?.version).toBe(creado.version + 1);
  });

  it('elimina un formato existente y devuelve false si no existe', async () => {
    const creado = await repo.crear(Formato.crearFormato({ nombre: 'SMU' }));

    expect(await repo.eliminar(creado.id ?? '')).toBe(true);
    expect(await repo.eliminar(creado.id ?? '')).toBe(false);
  });

  it('elimina solo si la versión esperada coincide (optimistic locking)', async () => {
    const creado = await repo.crear(Formato.crearFormato({ nombre: 'SMU' }));

    // Versión incorrecta → no se borra nada.
    expect(await repo.eliminar(creado.id ?? '', 99)).toBe(false);
    expect(await repo.buscarPorId(creado.id ?? '')).not.toBeNull();

    // Versión correcta → se borra.
    expect(await repo.eliminar(creado.id ?? '', creado.version)).toBe(true);
    expect(await repo.buscarPorId(creado.id ?? '')).toBeNull();
  });

  it('lista con paginación por cursor sin repetir ni omitir registros', async () => {
    for (let indice = 0; indice < 7; indice += 1) {
      await repo.crear(Formato.crearFormato({ nombre: `FORMATO-${indice}` }));
    }

    const vistos = new Set<string>();
    let afterId: string | undefined;
    let paginas = 0;

    for (;;) {
      const pagina = await repo.listar({ limit: 3, afterId });
      paginas += 1;

      for (const formato of pagina.items) {
        expect(vistos.has(formato.id ?? '')).toBe(false);
        vistos.add(formato.id ?? '');
      }

      if (!pagina.hasNextPage) {
        expect(pagina.nextCursor).toBeNull();
        break;
      }

      afterId = pagina.nextCursor ?? undefined;
      expect(afterId).toBeDefined();
    }

    expect(paginas).toBe(3);
    expect(vistos.size).toBe(7);
  });

  it('lista ordenado por nombre con el cursor sobre nombre', async () => {
    for (const nombre of ['ZETA', 'ALFA', 'MU']) {
      await repo.crear(Formato.crearFormato({ nombre }));
    }

    const primera = await repo.listar({ limit: 1 });
    const primero = primera.items[0];

    expect(primero?.nombre).toBe('ALFA');

    const payload = JSON.parse(
      Buffer.from(primera.nextCursor ?? '', 'base64url').toString('utf8')
    ) as unknown;

    expect(payload).toEqual({ v: 'ALFA', id: primero?.id, c: 'nombre' });

    const nombres: string[] = [];
    const ids = new Set<string>();
    let afterId: string | undefined;
    let paginas = 0;

    for (;;) {
      const pagina = await repo.listar({ limit: 1, afterId });
      paginas += 1;

      for (const formato of pagina.items) {
        expect(ids.has(formato.id ?? '')).toBe(false);
        ids.add(formato.id ?? '');
        nombres.push(formato.nombre);
      }

      if (!pagina.hasNextPage) {
        expect(pagina.nextCursor).toBeNull();
        break;
      }

      afterId = pagina.nextCursor ?? undefined;
      expect(afterId).toBeDefined();
    }

    expect(nombres).toEqual(['ALFA', 'MU', 'ZETA']);
    expect(ids.size).toBe(3);
    expect(paginas).toBe(3);
  });

  it('rechaza un cursor inválido con ValidationError', async () => {
    await expect(repo.listar({ afterId: 'no-es-un-cursor' })).rejects.toThrow();
  });

  it('rechaza un cursor emitido para otra columna de orden', async () => {
    const creado = await repo.crear(Formato.crearFormato({ nombre: 'SMU' }));
    const cursorDeOtraColumna = Buffer.from(
      JSON.stringify({ v: creado.createdAt.toISOString(), id: creado.id, c: 'created_at' }),
      'utf8'
    ).toString('base64url');

    await expect(repo.listar({ afterId: cursorDeOtraColumna })).rejects.toThrow(ValidationError);
  });

  it('listaTodos devuelve todos los formatos ordenados por nombre', async () => {
    await repo.crear(Formato.crearFormato({ nombre: 'SMU' }));
    await repo.crear(Formato.crearFormato({ nombre: 'ALFA' }));

    const todos = await repo.listarTodos();

    expect(todos.map((formato) => formato.nombre)).toEqual(['ALFA', 'SMU']);
  });
});
