import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';

import { CentroCoste } from '@domain/entities/CentroCoste.js';
import { LineaTelefonica } from '@domain/entities/LineaTelefonica.js';
import {
  ConflictError,
  DuplicateError,
  ForeignKeyError,
  InvalidPhoneNumberError,
  NotFoundError,
} from '@domain/errors/DomainError.js';

import type { CentroCosteRepository } from '@application/ports/repositories/CentroCosteRepository.js';
import type { LineaRepository } from '@application/ports/repositories/LineaRepository.js';
import { LineaService } from '@application/services/linea.service.js';

const ID_LINEA = '33333333-3333-3333-3333-333333333333';
const ID_CENTRO = '22222222-2222-2222-2222-222222222222';

type EntradaLinea = Parameters<typeof LineaTelefonica.crearLineaTelefonica>[0];

function lineaPersistida(overrides: Partial<EntradaLinea> = {}): LineaTelefonica {
  return LineaTelefonica.crearLineaTelefonica({
    numero: '912345678',
    centroCosteId: ID_CENTRO,
    ...overrides,
  }).conId(ID_LINEA);
}

function centroPersistido(): CentroCoste {
  return CentroCoste.crearCentroCoste({
    codigo: '510',
    nombre: 'RENDIC',
    formatoId: '11111111-1111-1111-1111-111111111111',
  }).conId(ID_CENTRO);
}

describe('LineaService', () => {
  let lineas: MockProxy<LineaRepository>;
  let centrosCoste: MockProxy<CentroCosteRepository>;
  let service: LineaService;

  beforeEach(() => {
    lineas = mock<LineaRepository>();
    centrosCoste = mock<CentroCosteRepository>();
    service = new LineaService(lineas, centrosCoste);
  });

  describe('crear', () => {
    it('normaliza el número y aplica los valores por defecto', async () => {
      centrosCoste.buscarPorId.mockResolvedValue(centroPersistido());
      lineas.buscarPorNumero.mockResolvedValue(null);
      lineas.crear.mockResolvedValue(lineaPersistida());

      const resultado = await service.crear({ numero: '9 1234 5678', centroCosteId: ID_CENTRO });

      expect(resultado.numero).toBe('+56912345678');
      expect(resultado.estado).toBe('pendiente');
      expect(resultado.tipoUso).toBe('personal');
      expect(resultado.tipoLinea).toBe('movil');
      expect(resultado.costoMensual).toBe('0.00');
      expect(resultado.proveedor).toBe('');
      expect(resultado.empleado).toBeNull();
    });

    it('rechaza un centro de coste inexistente con ForeignKeyError', async () => {
      centrosCoste.buscarPorId.mockResolvedValue(null);

      await expect(
        service.crear({ numero: '912345678', centroCosteId: ID_CENTRO })
      ).rejects.toBeInstanceOf(ForeignKeyError);
      expect(lineas.crear).not.toHaveBeenCalled();
    });

    it('rechaza un número no chileno con InvalidPhoneNumberError', async () => {
      await expect(
        service.crear({ numero: '12345', centroCosteId: ID_CENTRO })
      ).rejects.toBeInstanceOf(InvalidPhoneNumberError);
      expect(lineas.crear).not.toHaveBeenCalled();
    });

    it('rechaza números duplicados con DuplicateError', async () => {
      centrosCoste.buscarPorId.mockResolvedValue(centroPersistido());
      lineas.buscarPorNumero.mockResolvedValue(lineaPersistida());

      await expect(
        service.crear({ numero: '912345678', centroCosteId: ID_CENTRO })
      ).rejects.toBeInstanceOf(DuplicateError);
      expect(lineas.crear).not.toHaveBeenCalled();
    });
  });

  describe('listar', () => {
    it('mapea las líneas con los datos de su centro de coste', async () => {
      lineas.listar.mockResolvedValue({
        items: [
          {
            linea: lineaPersistida(),
            centroCosteCodigo: '510',
            centroCosteNombre: 'RENDIC',
          },
        ],
        nextCursor: 'cursor-1',
        hasNextPage: true,
        totalCount: 1,
      });

      const pagina = await service.listar({ estado: 'activa', limit: 20 });

      expect(pagina.items[0]?.centroCosteCodigo).toBe('510');
      expect(pagina.nextCursor).toBe('cursor-1');
      expect(pagina.totalCount).toBe(1);
      expect(lineas.listar).toHaveBeenCalledWith({ estado: 'activa', limit: 20 });
    });

    it('pasa el filtro de búsqueda de centro de coste al repositorio', async () => {
      lineas.listar.mockResolvedValue({
        items: [],
        nextCursor: null,
        hasNextPage: false,
        totalCount: 0,
      });

      await service.listar({ centroCosteBusqueda: 'FALABELLA', limit: 20 });

      expect(lineas.listar).toHaveBeenCalledWith({
        centroCosteBusqueda: 'FALABELLA',
        limit: 20,
      });
    });
  });

  describe('obtener', () => {
    it('devuelve NotFoundError si la línea no existe', async () => {
      lineas.buscarPorId.mockResolvedValue(null);

      await expect(service.obtener(ID_LINEA)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('actualizar', () => {
    it('actualiza los campos modificables y conserva el número', async () => {
      lineas.buscarPorId.mockResolvedValue(lineaPersistida());
      lineas.actualizar.mockResolvedValue(lineaPersistida({ proveedor: 'Entel' }));

      const resultado = await service.actualizar(ID_LINEA, { proveedor: 'Entel' });

      expect(resultado.proveedor).toBe('Entel');

      const enviada = lineas.actualizar.mock.calls[0]?.[0];
      expect(enviada?.numero).toBe('+56912345678');
    });

    it('rechaza una versión desactualizada con ConflictError', async () => {
      lineas.buscarPorId.mockResolvedValue(lineaPersistida());

      await expect(service.actualizar(ID_LINEA, { proveedor: 'Entel' }, 4)).rejects.toBeInstanceOf(
        ConflictError
      );
      expect(lineas.actualizar).not.toHaveBeenCalled();
    });

    it('rechaza mover la línea a un centro de coste inexistente', async () => {
      lineas.buscarPorId.mockResolvedValue(lineaPersistida());
      centrosCoste.buscarPorId.mockResolvedValue(null);

      await expect(
        service.actualizar(ID_LINEA, { centroCosteId: 'otro-centro' })
      ).rejects.toBeInstanceOf(ForeignKeyError);
      expect(lineas.actualizar).not.toHaveBeenCalled();
    });

    it('devuelve NotFoundError si la línea no existe', async () => {
      lineas.buscarPorId.mockResolvedValue(null);

      await expect(service.actualizar(ID_LINEA, { proveedor: 'Entel' })).rejects.toBeInstanceOf(
        NotFoundError
      );
    });

    it('permite mover la línea a otro centro de coste existente', async () => {
      const otroCentro = '44444444-4444-4444-4444-444444444444';

      lineas.buscarPorId.mockResolvedValue(lineaPersistida());
      centrosCoste.buscarPorId.mockResolvedValue(centroPersistido());
      lineas.actualizar.mockResolvedValue(lineaPersistida({ centroCosteId: otroCentro }));

      const resultado = await service.actualizar(ID_LINEA, { centroCosteId: otroCentro });

      expect(resultado.centroCosteId).toBe(otroCentro);
      expect(centrosCoste.buscarPorId).toHaveBeenCalledWith(otroCentro);
    });

    it('devuelve ConflictError si la escritura concurrente falla', async () => {
      lineas.buscarPorId.mockResolvedValue(lineaPersistida());
      lineas.actualizar.mockResolvedValue(null);

      await expect(service.actualizar(ID_LINEA, { proveedor: 'Entel' })).rejects.toBeInstanceOf(
        ConflictError
      );
    });
  });

  describe('cambiarEstado', () => {
    it('pone la línea en baja con la fecha de baja', async () => {
      lineas.buscarPorId.mockResolvedValue(lineaPersistida());
      lineas.actualizar.mockResolvedValue(lineaPersistida({ estado: 'baja' }));

      const resultado = await service.cambiarEstado(ID_LINEA, 'baja');

      expect(resultado.estado).toBe('baja');

      const enviada = lineas.actualizar.mock.calls[0]?.[0];
      expect(enviada?.deletedAt).not.toBeNull();
    });

    it('es idempotente: si el estado no cambia no escribe', async () => {
      lineas.buscarPorId.mockResolvedValue(lineaPersistida({ estado: 'baja' }));

      const resultado = await service.cambiarEstado(ID_LINEA, 'baja');

      expect(resultado.estado).toBe('baja');
      expect(lineas.actualizar).not.toHaveBeenCalled();
    });

    it('devuelve NotFoundError si la línea no existe', async () => {
      lineas.buscarPorId.mockResolvedValue(null);

      await expect(service.cambiarEstado(ID_LINEA, 'activa')).rejects.toBeInstanceOf(NotFoundError);
    });

    it('devuelve ConflictError si la escritura concurrente falla', async () => {
      lineas.buscarPorId.mockResolvedValue(lineaPersistida());
      lineas.actualizar.mockResolvedValue(null);

      await expect(service.cambiarEstado(ID_LINEA, 'activa')).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe('cambiarEstadoMasivo', () => {
    it('mapea el resultado del repositorio', async () => {
      lineas.actualizarEstadoMasivo.mockResolvedValue({
        actualizados: 3,
        sinCambios: 2,
        noEncontrados: 1,
      });

      const resultado = await service.cambiarEstadoMasivo(['a', 'b', 'c'], 'baja');

      expect(resultado).toEqual({ actualizadas: 3, ignoradas: 2, fallidas: 1 });
      expect(lineas.actualizarEstadoMasivo).toHaveBeenCalledTimes(1);
    });
  });

  describe('eliminar', () => {
    it('da de baja la línea (baja lógica)', async () => {
      lineas.buscarPorId.mockResolvedValue(lineaPersistida());
      lineas.actualizar.mockResolvedValue(lineaPersistida({ estado: 'baja' }));

      const resultado = await service.eliminar(ID_LINEA);

      expect(resultado.estado).toBe('baja');
      expect(lineas.actualizar).toHaveBeenCalledTimes(1);
    });

    it('elimina aplicando la versión esperada (RF-OPT-1.1)', async () => {
      lineas.buscarPorId.mockResolvedValue(lineaPersistida());
      lineas.actualizar.mockResolvedValue(lineaPersistida({ estado: 'baja' }));

      await service.eliminar(ID_LINEA, 1);

      expect(lineas.actualizar).toHaveBeenCalledWith(expect.anything(), 1);
    });

    it('rechaza con ConflictError una versión desactualizada y no da de baja (RF-OPT-1.3)', async () => {
      lineas.buscarPorId.mockResolvedValue(lineaPersistida());

      await expect(service.eliminar(ID_LINEA, 99)).rejects.toBeInstanceOf(ConflictError);
      expect(lineas.actualizar).not.toHaveBeenCalled();
    });

    it('devuelve NotFoundError si la línea no existe', async () => {
      lineas.buscarPorId.mockResolvedValue(null);

      await expect(service.eliminar(ID_LINEA)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('devuelve ConflictError si la escritura concurrente falla', async () => {
      lineas.buscarPorId.mockResolvedValue(lineaPersistida());
      lineas.actualizar.mockResolvedValue(null);

      await expect(service.eliminar(ID_LINEA)).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe('exportar', () => {
    it('devuelve las filas con las columnas de la exportación', async () => {
      lineas.exportar.mockResolvedValue([
        {
          numero: '+56912345678',
          numeroOriginal: '912345678',
          proveedor: 'Entel',
          centroCosteCodigo: '510',
          centroCosteNombre: 'RENDIC',
          fechaAsignacion: '2026-01-15',
          costoMensual: '1234.50',
          tipoLinea: 'movil',
          empleado: null,
          estado: 'activa',
          tipoUso: 'personal',
          createdAt: new Date('2026-01-15T10:00:00.000Z'),
        },
      ]);

      const resultado = await service.exportar({ proveedor: 'Entel' }, true);

      expect(resultado).toHaveLength(1);
      expect(resultado[0]?.centroCosteCodigo).toBe('510');
      expect(resultado[0]?.costoMensual).toBe('1234.50');
      expect(lineas.exportar).toHaveBeenCalledWith({ proveedor: 'Entel' }, true);
    });

    it('exporta usando el filtro de búsqueda de centro de coste', async () => {
      lineas.exportar.mockResolvedValue([]);

      await service.exportar({ centroCosteBusqueda: 'FALABELLA' });

      expect(lineas.exportar).toHaveBeenCalledWith({ centroCosteBusqueda: 'FALABELLA' }, false);
    });
  });
});
