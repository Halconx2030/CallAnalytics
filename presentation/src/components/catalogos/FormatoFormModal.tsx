import { useEffect, useState } from 'react';

import { Button } from '../base/Button';
import { Input } from '../base/Input';
import { Modal } from '../base/Modal';

import type { Formato } from '../../types/api';

export interface FormatoFormModalProps {
  readonly abierto: boolean;
  readonly formato: Formato | null;
  readonly onCerrar: () => void;
  readonly onGuardar: (datos: { nombre: string }) => void;
  readonly cargando?: boolean;
  readonly error?: string | undefined;
}

/** Alta y edición de un formato de centro de coste (solo tiene nombre). */
export function FormatoFormModal({
  abierto,
  formato,
  onCerrar,
  onGuardar,
  cargando = false,
  error,
}: FormatoFormModalProps) {
  const [nombre, setNombre] = useState('');
  const [errorLocal, setErrorLocal] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (abierto) {
      setNombre(formato?.nombre ?? '');
      setErrorLocal(undefined);
    }
  }, [abierto, formato]);

  const guardar = () => {
    const limpio = nombre.trim();

    if (limpio.length === 0) {
      setErrorLocal('El nombre del formato es obligatorio');
      return;
    }

    if (limpio.length > 100) {
      setErrorLocal('El nombre no puede superar los 100 caracteres');
      return;
    }

    onGuardar({ nombre: limpio });
  };

  return (
    <Modal
      abierto={abierto}
      titulo={formato === null ? 'Nuevo formato' : `Editar formato · ${formato.nombre}`}
      onCerrar={onCerrar}
      ancho="pequeno"
      pie={
        <>
          <Button variante="secundario" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button onClick={guardar} cargando={cargando}>
            Guardar
          </Button>
        </>
      }
    >
      <form
        className="formulario"
        onSubmit={(evento) => {
          evento.preventDefault();
          guardar();
        }}
      >
        <Input
          etiqueta="Nombre"
          name="nombre"
          value={nombre}
          maxLength={100}
          placeholder="SMU, FALABELLA…"
          autoFocus
          onChange={(evento) => {
            setNombre(evento.target.value);
          }}
        />
        {errorLocal !== undefined && <p className="campo__error">{errorLocal}</p>}
        {error !== undefined && <p className="estado estado--error">{error}</p>}
      </form>
    </Modal>
  );
}
