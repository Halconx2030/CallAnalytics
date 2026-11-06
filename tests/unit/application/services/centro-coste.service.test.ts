import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';

import { CentroCoste } from '@domain/entities/CentroCoste.js';
import { Formato } from '@domain/entities/Formato.js';
import {
  ConflictError,
  DuplicateError,
  ForeignKeyError,
  NotFoundError,
} from '@domain/errors/DomainError.js';

import type { CentroCosteRepository } from '@application/ports/repositories/CentroCosteRepository.js';
import type { FormatoRepository } from '@application/ports/repositories/FormatoRepository.js';
import type { LineaRepository } from '@application/ports/repositories/LineaRepository.js';
import { CentroCosteService } from '@application/services/centro-coste.service.js';

const ID_CENTRO = '22222222-2222-2222-2222-222222222222';
const ID_FORMATO = '11111111-1111-1111-1111-111111111111';
/** Fecha fija: las entidades se crean con `new Date()` por defecto, lo que hace que dos
 *  llamadas a la factory puedan diferir en milisegundos y provocar tests intermitentes. */
const AHORA = new Date('2026-11-04T12:00:00.000Z');

function formatoPersistido(): Formato {
  return Formato.crearFormato({ nombre: 'SMU' }, AHORA).conId(ID_FORMATO);
}

function centroPersistido(codigo = '510'): CentroCoste {
  return CentroCoste.crearCentroCoste(
    {
      codigo,
      nombre: 'RENDIC AVDA CAMILO HENRIQUEZ 445 CURICO',
      formatoId: ID_FORMATO,
    },
    AHORA
  ).conId(ID_CENTRO);
}

describe('CentroCosteService', () => {
  let centrosCoste: MockProxy<CentroCosteRepository>;
  let formatos: MockProxy<FormatoRepository>;
  let lineas: MockProxy<LineaRepository>;
  let service: CentroCosteService;

  beforeEach(() => {
    centrosCoste = mock<CentroCosteRepository>();
    formatos = mock<FormatoRepository>();
    lineas = mock<LineaRepository>();
    service = new CentroCosteService(centrosCoste, formatos, lineas);
  });

  describe('crear', () => {
    it('guarda el centro de coste y devuelve el DTO', async () => {
      centrosCoste.buscarPorCodigo.mockResolvedValue(null);
      formatos.buscarPorId.mockResolvedValue(formatoPersistido());
      centrosCoste.crear.mockResolvedValue(centroPersistido());

      const resultado = await service.crear({
        codigo: ' 510 ',
        nombre: 'RENDIC AVDA CAMILO HENRIQUEZ 445 CURICO',
        formatoId: ID_FORMATO,
      });

      expect(resultado.codigo).toBe('510');
      expect(resultado.formatoId).toBe(ID_FORMATO);
      expect(centrosCoste.crear).toHaveBeenCalledTimes(1);
    });

    it('rechaza códigos duplicados con DuplicateError', async () => {
      centrosCoste.buscarPorCodigo.mockResolvedValue(centroPersistido());

      await expect(
        service.crear({ codigo: '510', nombre: 'RENDIC', formatoId: ID_FORMATO })
      ).rejects.toBeInstanceOf(DuplicateError);
      expect(centrosCoste.crear).not.toHaveBeenCalled();
    });

    it('rechaza formatos inexistentes con ForeignKeyError', async () => {
      centrosCoste.buscarPorCodigo.mockResolvedValue(null);
      formatos.buscarPorId.mockResolvedValue(null);

      await expect(
        service.crear({ codigo: '510', nombre: 'RENDIC', formatoId: ID_FORMATO })
      ).rejects.toBeInstanceOf(ForeignKeyError);
      expect(centrosCoste.crear).not.toHaveBeenCalled();
    });
  });

  describe('listar', () => {
    it('mapea los centros de coste de la página', async () => {
      centrosCoste.listar.mockResolvedValue({
        items: [centroPersistido()],
        nextCursor: null,
        hasNextPage: false,
      });

      const pagina = await service.listar({ codigo: '51' }, { limit: 20 });

      expect(pagina.items).toHaveLength(1);
      expect(pagina.items[0]?.codigo).toBe('510');
      expect(centrosCoste.listar).toHaveBeenCalledWith({ codigo: '51', limit: 20 });
    });

    it('pasa el filtro de búsqueda libre al repositorio', async () => {
      centrosCoste.listar.mockResolvedValue({
        items: [centroPersistido()],
        nextCursor: null,
        hasNextPage: false,
      });

      await service.listar({ busqueda: 'falabella' }, { limit: 20 });

      expect(centrosCoste.listar).toHaveBeenCalledWith({ busqueda: 'falabella', limit: 20 });
    });

    it('combina la búsqueda libre con los demás filtros', async () => {
      centrosCoste.listar.mockResolvedValue({
        items: [],
        nextCursor: null,
        hasNextPage: false,
      });

      await service.listar({ busqueda: 'central', formatoId: ID_FORMATO }, { limit: 20 });

      expect(centrosCoste.listar).toHaveBeenCalledWith({
        busqueda: 'central',
        formatoId: ID_FORMATO,
        limit: 20,
      });
    });
  });

  describe('obtener', () => {
    it('devuelve NotFoundError si no existe', async () => {
      centrosCoste.buscarPorId.mockResolvedValue(null);

      await expect(service.obtener(ID_CENTRO)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('actualizar', () => {
    it('actualiza nombre y formato', async () => {
      centrosCoste.buscarPorId.mockResolvedValue(centroPersistido());
      formatos.buscarPorId.mockResolvedValue(formatoPersistido());
      centrosCoste.actualizar.mockResolvedValue(
        centroPersistido().renombrar('NUEVO NOMBRE').cambiarFormato(ID_FORMATO)
      );

      const resultado = await service.actualizar(ID_CENTRO, {
        nombre: 'NUEVO NOMBRE',
        formatoId: ID_FORMATO,
      });

      expect(resultado.nombre).toBe('NUEVO NOMBRE');
      expect(centrosCoste.actualizar).toHaveBeenCalledTimes(1);
    });

    it('rechaza un formato inexistente con ForeignKeyError', async () => {
      centrosCoste.buscarPorId.mockResolvedValue(centroPersistido());
      formatos.buscarPorId.mockResolvedValue(null);

      await expect(
        service.actualizar(ID_CENTRO, { formatoId: 'otro-formato' })
      ).rejects.toBeInstanceOf(ForeignKeyError);
      expect(centrosCoste.actualizar).not.toHaveBeenCalled();
    });

    it('rechaza una versión desactualizada con ConflictError', async () => {
      centrosCoste.buscarPorId.mockResolvedValue(centroPersistido());

      await expect(service.actualizar(ID_CENTRO, { nombre: 'X' }, 9)).rejects.toBeInstanceOf(
        ConflictError
      );
    });

    it('devuelve NotFoundError si el centro no existe', async () => {
      centrosCoste.buscarPorId.mockResolvedValue(null);

      await expect(service.actualizar(ID_CENTRO, { nombre: 'X' })).rejects.toBeInstanceOf(
        NotFoundError
      );
      expect(centrosCoste.actualizar).not.toHaveBeenCalled();
    });

    it('devuelve ConflictError si la escritura concurrente falla', async () => {
      centrosCoste.buscarPorId.mockResolvedValue(centroPersistido());
      formatos.buscarPorId.mockResolvedValue(formatoPersistido());
      centrosCoste.actualizar.mockResolvedValue(null);

      await expect(service.actualizar(ID_CENTRO, { nombre: 'X' })).rejects.toBeInstanceOf(
        ConflictError
      );
    });
  });

  describe('eliminar', () => {
    it('elimina un centro de coste sin líneas asociadas', async () => {
      centrosCoste.buscarPorId.mockResolvedValue(centroPersistido());
      lineas.contarPorCentroCoste.mockResolvedValue(0);
      centrosCoste.eliminar.mockResolvedValue(true);

      await service.eliminar(ID_CENTRO);

      expect(centrosCoste.eliminar).toHaveBeenCalledWith(ID_CENTRO, undefined);
    });

    it('elimina aplicando la versión esperada (RF-OPT-1.1)', async () => {
      centrosCoste.buscarPorId.mockResolvedValue(centroPersistido());
      lineas.contarPorCentroCoste.mockResolvedValue(0);
      centrosCoste.eliminar.mockResolvedValue(true);

      await service.eliminar(ID_CENTRO, 1);

      expect(centrosCoste.eliminar).toHaveBeenCalledWith(ID_CENTRO, 1);
    });

    it('rechaza con ConflictError una versión desactualizada y no borra (RF-OPT-1.3)', async () => {
      centrosCoste.buscarPorId.mockResolvedValue(centroPersistido());

      await expect(service.eliminar(ID_CENTRO, 99)).rejects.toBeInstanceOf(ConflictError);
      expect(centrosCoste.eliminar).not.toHaveBeenCalled();
    });

    it('rechaza con ConflictError si el borrado condicional no afecta filas (RF-OPT-1.3)', async () => {
      centrosCoste.buscarPorId.mockResolvedValue(centroPersistido());
      lineas.contarPorCentroCoste.mockResolvedValue(0);
      centrosCoste.eliminar.mockResolvedValue(false);

      await expect(service.eliminar(ID_CENTRO, 1)).rejects.toBeInstanceOf(ConflictError);
    });

    it('rechaza con ConflictError si tiene líneas asociadas', async () => {
      centrosCoste.buscarPorId.mockResolvedValue(centroPersistido());
      lineas.contarPorCentroCoste.mockResolvedValue(5);

      await expect(service.eliminar(ID_CENTRO)).rejects.toBeInstanceOf(ConflictError);
      expect(centrosCoste.eliminar).not.toHaveBeenCalled();
    });

    it('devuelve NotFoundError si el centro no existe', async () => {
      centrosCoste.buscarPorId.mockResolvedValue(null);

      await expect(service.eliminar(ID_CENTRO)).rejects.toBeInstanceOf(NotFoundError);
      expect(centrosCoste.eliminar).not.toHaveBeenCalled();
    });

    it('devuelve NotFoundError si la eliminación no afecta ninguna fila', async () => {
      centrosCoste.buscarPorId.mockResolvedValue(centroPersistido());
      lineas.contarPorCentroCoste.mockResolvedValue(0);
      centrosCoste.eliminar.mockResolvedValue(false);

      await expect(service.eliminar(ID_CENTRO)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('exportar', () => {
    it('devuelve las filas con el nombre del formato', async () => {
      const centro = centroPersistido();
      centrosCoste.listarTodos.mockResolvedValue([{ centro, formatoNombre: 'SMU' }]);

      const resultado = await service.exportar();

      expect(resultado).toEqual([
        {
          codigo: '510',
          nombre: 'RENDIC AVDA CAMILO HENRIQUEZ 445 CURICO',
          formatoNombre: 'SMU',
          createdAt: centro.createdAt.toISOString(),
        },
      ]);
    });
  });
});
