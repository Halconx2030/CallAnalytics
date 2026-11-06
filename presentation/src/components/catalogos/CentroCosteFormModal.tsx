import { useEffect, useState } from 'react';

import { Button } from '../base/Button';
import { Input } from '../base/Input';
import { Modal } from '../base/Modal';
import { Select } from '../base/Select';

import type { CentroCoste, Formato } from '../../types/api';

export interface CentroCosteFormModalProps {
  readonly abierto: boolean;
  readonly centro: CentroCoste | null;
  readonly formatos: ReadonlyArray<Formato>;
  readonly onCerrar: () => void;
  readonly onGuardar: (datos: { codigo: string; nombre: string; formato_id: string }) => void;
  readonly cargando?: boolean;
  readonly error?: string | undefined;
}

/** Alta y edición de un centro de coste (código, nombre y formato asociado). */
export function CentroCosteFormModal({
  abierto,
  centro,
  formatos,
  onCerrar,
  onGuardar,
  cargando = false,
  error,
}: CentroCosteFormModalProps) {
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [formatoId, setFormatoId] = useState('');
  const [errorLocal, setErrorLocal] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (abierto) {
      setCodigo(centro?.codigo ?? '');
      setNombre(centro?.nombre ?? '');
      setFormatoId(centro?.formato_id ?? '');
      setErrorLocal(undefined);
    }
  }, [abierto, centro]);

  const guardar = () => {
    const codigoLimpio = codigo.trim();
    const nombreLimpio = nombre.trim();

    if (codigoLimpio.length === 0) {
      setErrorLocal('El código del centro de coste es obligatorio');
      return;
    }

    if (codigoLimpio.length > 50) {
      setErrorLocal('El código no puede superar los 50 caracteres');
      return;
    }

    if (nombreLimpio.length === 0) {
      setErrorLocal('El nombre del centro de coste es obligatorio');
      return;
    }

    if (nombreLimpio.length > 200) {
      setErrorLocal('El nombre no puede superar los 200 caracteres');
      return;
    }

    if (formatoId.length === 0) {
      setErrorLocal('Debes seleccionar un formato');
      return;
    }

    onGuardar({ codigo: codigoLimpio, nombre: nombreLimpio, formato_id: formatoId });
  };

  return (
    <Modal
      abierto={abierto}
      titulo={centro === null ? 'Nuevo centro de coste' : `Editar centro · ${centro.codigo}`}
      onCerrar={onCerrar}
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
        <div className="formulario__grid">
          <Input
            etiqueta="Código"
            name="codigo"
            value={codigo}
            maxLength={50}
            placeholder="510 RENDIC…"
            disabled={centro !== null}
            onChange={(evento) => {
              setCodigo(evento.target.value);
            }}
          />
          <Input
            etiqueta="Nombre"
            name="nombre"
            value={nombre}
            maxLength={200}
            onChange={(evento) => {
              setNombre(evento.target.value);
            }}
          />
        </div>
        <Select
          etiqueta="Formato"
          name="formato_id"
          value={formatoId}
          opciones={formatos.map((formato) => ({ valor: formato.id, etiqueta: formato.nombre }))}
          placeholder="Selecciona un formato"
          onChange={(evento) => {
            setFormatoId(evento.target.value);
          }}
        />
        {formatos.length === 0 && (
          <p className="nota">
            Primero crea un formato (por ejemplo <strong>SMU</strong> o <strong>FALABELLA</strong>)
            en la sección de arriba: es obligatorio para asociar centros de coste.
          </p>
        )}
        {errorLocal !== undefined && <p className="campo__error">{errorLocal}</p>}
        {error !== undefined && <p className="estado estado--error">{error}</p>}
      </form>
    </Modal>
  );
}
