-- ============================================================
-- Procedimientos almacenados (21) - Sistema de Bienes y Logística
-- Motor: PostgreSQL
-- Nota: Ejecuta este archivo DESPUÉS de crear todas las tablas.
-- ============================================================

-- Recomendación:
-- SET search_path TO public;

-- ============================================================
-- 1) AUDITORÍA
-- ============================================================

-- 01) sp_log_evento
CREATE OR REPLACE PROCEDURE sp_log_evento(
    IN  p_id_usuario        BIGINT,
    IN  p_tipo_accion       VARCHAR(40),
    IN  p_tabla_afectada    VARCHAR(60),
    IN  p_registro_afectado BIGINT,
    IN  p_ip_origen         VARCHAR(45),
    IN  p_descripcion_log   TEXT,
    OUT p_id_log_usuario    BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO log_usuario (
        id_usuario,
        fecha_accion,
        hora_accion,
        tipo_accion,
        tabla_afectada,
        registro_afectado,
        ip_origen,
        descripcion_log
    )
    VALUES (
        p_id_usuario,
        NOW(),
        CURRENT_TIME,
        p_tipo_accion,
        p_tabla_afectada,
        p_registro_afectado,
        p_ip_origen,
        p_descripcion_log
    )
    RETURNING id_log_usuario INTO p_id_log_usuario;
END;
$$;

-- 02) sp_log_cambio
CREATE OR REPLACE PROCEDURE sp_log_cambio(
    IN p_id_log_usuario   BIGINT,
    IN p_campo_modificado VARCHAR(80),
    IN p_valor_antes      TEXT,
    IN p_valor_despues    TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO log_cambios (
        id_log_usuario,
        campo_modificado,
        valor_antes,
        valor_despues
    )
    VALUES (
        p_id_log_usuario,
        p_campo_modificado,
        p_valor_antes,
        p_valor_despues
    );
END;
$$;

-- ============================================================
-- 2) MOVIMIENTOS / KARDEX (registro)
-- ============================================================

-- 03) sp_registro_crear
CREATE OR REPLACE PROCEDURE sp_registro_crear(
    IN  p_id_tipo_registro   BIGINT,
    IN  p_id_usuario         BIGINT,
    IN  p_id_empleado        BIGINT,
    IN  p_id_solicitud       BIGINT,
    IN  p_id_documento       BIGINT,
    IN  p_id_bodega_origen   BIGINT,
    IN  p_id_bodega_destino  BIGINT,
    IN  p_referencia_externa VARCHAR(80),
    IN  p_observaciones      TEXT,
    OUT p_id_registro        BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO registro (
        id_tipo_registro,
        id_usuario,
        id_empleado,
        id_solicitud,
        id_documento,
        id_bodega_origen,
        id_bodega_destino,
        referencia_externa,
        observaciones_registro,
        estado_registro,
        fecha_registro
    )
    VALUES (
        p_id_tipo_registro,
        p_id_usuario,
        p_id_empleado,
        p_id_solicitud,
        p_id_documento,
        p_id_bodega_origen,
        p_id_bodega_destino,
        p_referencia_externa,
        p_observaciones,
        'REGISTRADO',
        NOW()
    )
    RETURNING id_registro INTO p_id_registro;
END;
$$;

-- 04) sp_registro_agregar_detalle
CREATE OR REPLACE PROCEDURE sp_registro_agregar_detalle(
    IN  p_id_registro     BIGINT,
    IN  p_id_bien         BIGINT,
    IN  p_id_bien_item    BIGINT,
    IN  p_id_bien_lote    BIGINT,
    IN  p_cantidad        NUMERIC(14,3),
    IN  p_costo_unitario  NUMERIC(14,2),
    IN  p_lote            VARCHAR(60),
    IN  p_observacion     TEXT,
    OUT p_id_detalle      BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_estado_registro VARCHAR(20);
BEGIN
    SELECT estado_registro
      INTO v_estado_registro
      FROM registro
     WHERE id_registro = p_id_registro;

    IF v_estado_registro IS NULL THEN
        RAISE EXCEPTION 'No existe registro con id_registro=%', p_id_registro;
    END IF;

    IF v_estado_registro <> 'REGISTRADO' THEN
        RAISE EXCEPTION 'No se puede agregar detalle: estado_registro=%', v_estado_registro;
    END IF;

    IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
        RAISE EXCEPTION 'Cantidad inválida: %', p_cantidad;
    END IF;

    IF p_id_bien_item IS NOT NULL AND p_cantidad <> 1 THEN
        RAISE EXCEPTION 'Para bienes por serie (id_bien_item) la cantidad debe ser 1';
    END IF;

    INSERT INTO registro_detalle (
        id_registro,
        id_bien,
        id_bien_item,
        id_bien_lote,
        cantidad,
        costo_unitario,
        lote,
        observacion_detalle
    )
    VALUES (
        p_id_registro,
        p_id_bien,
        p_id_bien_item,
        p_id_bien_lote,
        p_cantidad,
        p_costo_unitario,
        p_lote,
        p_observacion
    )
    RETURNING id_registro_detalle INTO p_id_detalle;
END;
$$;

-- 05) sp_registro_confirmar_y_afectar_stock
CREATE OR REPLACE PROCEDURE sp_registro_confirmar_y_afectar_stock(
    IN  p_id_registro      BIGINT,
    IN  p_id_usuario       BIGINT,
    IN  p_ip_origen        VARCHAR(45),
    OUT p_id_log_usuario   BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_estado_registro     VARCHAR(20);
    v_id_tipo_registro    BIGINT;
    v_afecta_stock        BOOLEAN;
    v_signo               INTEGER;
    v_bodega_origen       BIGINT;
    v_bodega_destino      BIGINT;

    v_es_transferencia    BOOLEAN;

    d RECORD;

    v_stock_actual        NUMERIC(14,3);
    v_stock_actual_lote   NUMERIC(14,3);

BEGIN
    SELECT r.estado_registro, r.id_tipo_registro, r.id_bodega_origen, r.id_bodega_destino
      INTO v_estado_registro, v_id_tipo_registro, v_bodega_origen, v_bodega_destino
      FROM registro r
     WHERE r.id_registro = p_id_registro;

    IF v_estado_registro IS NULL THEN
        RAISE EXCEPTION 'No existe registro con id_registro=%', p_id_registro;
    END IF;

    IF v_estado_registro <> 'REGISTRADO' THEN
        RAISE EXCEPTION 'No se puede confirmar: estado_registro=% (se requiere REGISTRADO)', v_estado_registro;
    END IF;

    SELECT tr.afecta_stock, tr.signo_movimiento
      INTO v_afecta_stock, v_signo
      FROM tipo_registro tr
     WHERE tr.id_tipo_registro = v_id_tipo_registro;

    IF v_afecta_stock IS NULL THEN
        RAISE EXCEPTION 'Tipo de registro inválido (id_tipo_registro=%)', v_id_tipo_registro;
    END IF;

    v_es_transferencia := (v_bodega_origen IS NOT NULL AND v_bodega_destino IS NOT NULL AND v_bodega_origen <> v_bodega_destino);

    IF v_afecta_stock = FALSE THEN
        UPDATE registro
           SET estado_registro = 'CONFIRMADO',
               fecha_actualizacion = NOW()
         WHERE id_registro = p_id_registro;

        CALL sp_log_evento(
            p_id_usuario,
            'CONFIRMAR_REGISTRO',
            'registro',
            p_id_registro,
            p_ip_origen,
            'Confirmación de registro (sin afectar stock)',
            p_id_log_usuario
        );

        RETURN;
    END IF;

    IF v_es_transferencia = FALSE AND (v_signo IS NULL OR v_signo = 0) THEN
        RAISE EXCEPTION 'signo_movimiento no definido para tipo_registro=%', v_id_tipo_registro;
    END IF;

    FOR d IN
        SELECT rd.*
          FROM registro_detalle rd
         WHERE rd.id_registro = p_id_registro
    LOOP
        IF d.cantidad IS NULL OR d.cantidad <= 0 THEN
            RAISE EXCEPTION 'Detalle inválido: cantidad=% (id_registro_detalle=%)', d.cantidad, d.id_registro_detalle;
        END IF;

        IF d.id_bien_item IS NOT NULL AND d.cantidad <> 1 THEN
            RAISE EXCEPTION 'Bien por serie: cantidad debe ser 1 (id_registro_detalle=%)', d.id_registro_detalle;
        END IF;

        IF v_es_transferencia THEN

            IF d.id_bien_item IS NOT NULL THEN
                PERFORM 1
                  FROM bien_item bi
                 WHERE bi.id_bien_item = d.id_bien_item
                   AND bi.id_bodega = v_bodega_origen;

                IF NOT FOUND THEN
                    RAISE EXCEPTION 'El bien_item=% no está en la bodega origen=%', d.id_bien_item, v_bodega_origen;
                END IF;

                UPDATE bien_item
                   SET id_bodega = v_bodega_destino,
                       estado_item = 'DISPONIBLE'
                 WHERE id_bien_item = d.id_bien_item;
            END IF;

            IF d.id_bien_lote IS NOT NULL THEN
                INSERT INTO inventario_lote (id_bodega, id_bien_lote, stock_actual, stock_reservado)
                VALUES (v_bodega_origen, d.id_bien_lote, 0, 0)
                ON CONFLICT (id_bodega, id_bien_lote) DO NOTHING;

                SELECT il.stock_actual
                  INTO v_stock_actual_lote
                  FROM inventario_lote il
                 WHERE il.id_bodega = v_bodega_origen
                   AND il.id_bien_lote = d.id_bien_lote
                 FOR UPDATE;

                IF v_stock_actual_lote < d.cantidad THEN
                    RAISE EXCEPTION 'Stock insuficiente en origen. bodega=% lote=% stock=% requerido=%',
                        v_bodega_origen, d.id_bien_lote, v_stock_actual_lote, d.cantidad;
                END IF;

                UPDATE inventario_lote
                   SET stock_actual = stock_actual - d.cantidad,
                       fecha_ultima_actualizacion = NOW()
                 WHERE id_bodega = v_bodega_origen
                   AND id_bien_lote = d.id_bien_lote;

                INSERT INTO inventario_lote (id_bodega, id_bien_lote, stock_actual, stock_reservado)
                VALUES (v_bodega_destino, d.id_bien_lote, 0, 0)
                ON CONFLICT (id_bodega, id_bien_lote) DO NOTHING;

                PERFORM 1
                  FROM inventario_lote il
                 WHERE il.id_bodega = v_bodega_destino
                   AND il.id_bien_lote = d.id_bien_lote
                 FOR UPDATE;

                UPDATE inventario_lote
                   SET stock_actual = stock_actual + d.cantidad,
                       fecha_ultima_actualizacion = NOW()
                 WHERE id_bodega = v_bodega_destino
                   AND id_bien_lote = d.id_bien_lote;

            ELSE
                IF d.id_bien IS NULL THEN
                    RAISE EXCEPTION 'Detalle sin id_bien para inventario normal (id_registro_detalle=%)', d.id_registro_detalle;
                END IF;

                INSERT INTO inventario (id_bodega, id_bien, stock_actual, stock_reservado)
                VALUES (v_bodega_origen, d.id_bien, 0, 0)
                ON CONFLICT (id_bodega, id_bien) DO NOTHING;

                SELECT i.stock_actual
                  INTO v_stock_actual
                  FROM inventario i
                 WHERE i.id_bodega = v_bodega_origen
                   AND i.id_bien = d.id_bien
                 FOR UPDATE;

                IF v_stock_actual < d.cantidad THEN
                    RAISE EXCEPTION 'Stock insuficiente en origen. bodega=% bien=% stock=% requerido=%',
                        v_bodega_origen, d.id_bien, v_stock_actual, d.cantidad;
                END IF;

                UPDATE inventario
                   SET stock_actual = stock_actual - d.cantidad,
                       fecha_ultima_actualizacion = NOW()
                 WHERE id_bodega = v_bodega_origen
                   AND id_bien = d.id_bien;

                INSERT INTO inventario (id_bodega, id_bien, stock_actual, stock_reservado)
                VALUES (v_bodega_destino, d.id_bien, 0, 0)
                ON CONFLICT (id_bodega, id_bien) DO NOTHING;

                PERFORM 1
                  FROM inventario i
                 WHERE i.id_bodega = v_bodega_destino
                   AND i.id_bien = d.id_bien
                 FOR UPDATE;

                UPDATE inventario
                   SET stock_actual = stock_actual + d.cantidad,
                       fecha_ultima_actualizacion = NOW()
                 WHERE id_bodega = v_bodega_destino
                   AND id_bien = d.id_bien;
            END IF;

        ELSE
            IF v_bodega_origen IS NULL AND v_bodega_destino IS NULL THEN
                RAISE EXCEPTION 'Registro sin bodega_origen ni bodega_destino (id_registro=%)', p_id_registro;
            END IF;

            IF v_bodega_origen IS NOT NULL THEN
                IF d.id_bien_item IS NOT NULL THEN
                    IF v_signo < 0 THEN
                        PERFORM 1
                          FROM bien_item bi
                         WHERE bi.id_bien_item = d.id_bien_item
                           AND bi.id_bodega = v_bodega_origen;

                        IF NOT FOUND THEN
                            RAISE EXCEPTION 'El bien_item=% no está en la bodega=%', d.id_bien_item, v_bodega_origen;
                        END IF;

                        UPDATE bien_item
                           SET estado_item = 'NO_DISPONIBLE'
                         WHERE id_bien_item = d.id_bien_item;
                    ELSE
                        UPDATE bien_item
                           SET id_bodega = v_bodega_origen,
                               estado_item = 'DISPONIBLE'
                         WHERE id_bien_item = d.id_bien_item;
                    END IF;
                END IF;

                IF d.id_bien_lote IS NOT NULL THEN
                    INSERT INTO inventario_lote (id_bodega, id_bien_lote, stock_actual, stock_reservado)
                    VALUES (v_bodega_origen, d.id_bien_lote, 0, 0)
                    ON CONFLICT (id_bodega, id_bien_lote) DO NOTHING;

                    SELECT il.stock_actual
                      INTO v_stock_actual_lote
                      FROM inventario_lote il
                     WHERE il.id_bodega = v_bodega_origen
                       AND il.id_bien_lote = d.id_bien_lote
                     FOR UPDATE;

                    IF v_signo < 0 AND v_stock_actual_lote < d.cantidad THEN
                        RAISE EXCEPTION 'Stock insuficiente. bodega=% lote=% stock=% requerido=%',
                            v_bodega_origen, d.id_bien_lote, v_stock_actual_lote, d.cantidad;
                    END IF;

                    UPDATE inventario_lote
                       SET stock_actual = stock_actual + (v_signo * d.cantidad),
                           fecha_ultima_actualizacion = NOW()
                     WHERE id_bodega = v_bodega_origen
                       AND id_bien_lote = d.id_bien_lote;

                ELSE
                    IF d.id_bien IS NULL THEN
                        RAISE EXCEPTION 'Detalle sin id_bien para inventario normal (id_registro_detalle=%)', d.id_registro_detalle;
                    END IF;

                    INSERT INTO inventario (id_bodega, id_bien, stock_actual, stock_reservado)
                    VALUES (v_bodega_origen, d.id_bien, 0, 0)
                    ON CONFLICT (id_bodega, id_bien) DO NOTHING;

                    SELECT i.stock_actual
                      INTO v_stock_actual
                      FROM inventario i
                     WHERE i.id_bodega = v_bodega_origen
                       AND i.id_bien = d.id_bien
                     FOR UPDATE;

                    IF v_signo < 0 AND v_stock_actual < d.cantidad THEN
                        RAISE EXCEPTION 'Stock insuficiente. bodega=% bien=% stock=% requerido=%',
                            v_bodega_origen, d.id_bien, v_stock_actual, d.cantidad;
                    END IF;

                    UPDATE inventario
                       SET stock_actual = stock_actual + (v_signo * d.cantidad),
                           fecha_ultima_actualizacion = NOW()
                     WHERE id_bodega = v_bodega_origen
                       AND id_bien = d.id_bien;
                END IF;

            ELSE
                IF d.id_bien_item IS NOT NULL THEN
                    UPDATE bien_item
                       SET id_bodega = v_bodega_destino,
                           estado_item = 'DISPONIBLE'
                     WHERE id_bien_item = d.id_bien_item;
                END IF;

                IF d.id_bien_lote IS NOT NULL THEN
                    INSERT INTO inventario_lote (id_bodega, id_bien_lote, stock_actual, stock_reservado)
                    VALUES (v_bodega_destino, d.id_bien_lote, 0, 0)
                    ON CONFLICT (id_bodega, id_bien_lote) DO NOTHING;

                    PERFORM 1
                      FROM inventario_lote il
                     WHERE il.id_bodega = v_bodega_destino
                       AND il.id_bien_lote = d.id_bien_lote
                     FOR UPDATE;

                    UPDATE inventario_lote
                       SET stock_actual = stock_actual + (v_signo * d.cantidad),
                           fecha_ultima_actualizacion = NOW()
                     WHERE id_bodega = v_bodega_destino
                       AND id_bien_lote = d.id_bien_lote;

                ELSE
                    IF d.id_bien IS NULL THEN
                        RAISE EXCEPTION 'Detalle sin id_bien para inventario normal (id_registro_detalle=%)', d.id_registro_detalle;
                    END IF;

                    INSERT INTO inventario (id_bodega, id_bien, stock_actual, stock_reservado)
                    VALUES (v_bodega_destino, d.id_bien, 0, 0)
                    ON CONFLICT (id_bodega, id_bien) DO NOTHING;

                    PERFORM 1
                      FROM inventario i
                     WHERE i.id_bodega = v_bodega_destino
                       AND i.id_bien = d.id_bien
                     FOR UPDATE;

                    UPDATE inventario
                       SET stock_actual = stock_actual + (v_signo * d.cantidad),
                           fecha_ultima_actualizacion = NOW()
                     WHERE id_bodega = v_bodega_destino
                       AND id_bien = d.id_bien;
                END IF;
            END IF;
        END IF;
    END LOOP;

    UPDATE registro
       SET estado_registro = 'CONFIRMADO',
           fecha_actualizacion = NOW()
     WHERE id_registro = p_id_registro;

    CALL sp_log_evento(
        p_id_usuario,
        'CONFIRMAR_REGISTRO',
        'registro',
        p_id_registro,
        p_ip_origen,
        'Confirmación de registro y afectación de inventario',
        p_id_log_usuario
    );
END;
$$;

-- 06) sp_registro_anular_y_revertir_stock
CREATE OR REPLACE PROCEDURE sp_registro_anular_y_revertir_stock(
    IN  p_id_registro      BIGINT,
    IN  p_id_usuario       BIGINT,
    IN  p_ip_origen        VARCHAR(45),
    IN  p_motivo           TEXT,
    OUT p_id_log_usuario   BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_estado_registro   VARCHAR(20);
    v_id_tipo_registro  BIGINT;
    v_afecta_stock      BOOLEAN;
    v_signo             INTEGER;

    v_bodega_origen     BIGINT;
    v_bodega_destino    BIGINT;
    v_es_transferencia  BOOLEAN;

    d RECORD;

    v_stock_actual      NUMERIC(14,3);
    v_stock_actual_lote NUMERIC(14,3);
BEGIN
    SELECT r.estado_registro, r.id_tipo_registro, r.id_bodega_origen, r.id_bodega_destino
      INTO v_estado_registro, v_id_tipo_registro, v_bodega_origen, v_bodega_destino
      FROM registro r
     WHERE r.id_registro = p_id_registro;

    IF v_estado_registro IS NULL THEN
        RAISE EXCEPTION 'No existe registro con id_registro=%', p_id_registro;
    END IF;

    IF v_estado_registro <> 'CONFIRMADO' THEN
        RAISE EXCEPTION 'Solo se puede anular un registro CONFIRMADO. Estado actual=%', v_estado_registro;
    END IF;

    SELECT tr.afecta_stock, tr.signo_movimiento
      INTO v_afecta_stock, v_signo
      FROM tipo_registro tr
     WHERE tr.id_tipo_registro = v_id_tipo_registro;

    IF v_afecta_stock IS NULL THEN
        RAISE EXCEPTION 'Tipo de registro inválido (id_tipo_registro=%)', v_id_tipo_registro;
    END IF;

    v_es_transferencia := (v_bodega_origen IS NOT NULL
                           AND v_bodega_destino IS NOT NULL
                           AND v_bodega_origen <> v_bodega_destino);

    IF v_afecta_stock = FALSE THEN
        UPDATE registro
           SET estado_registro = 'ANULADO',
               fecha_actualizacion = NOW(),
               observaciones_registro = COALESCE(observaciones_registro,'') ||
                                       E'\n[ANULADO] ' || COALESCE(p_motivo,'(sin motivo)')
         WHERE id_registro = p_id_registro;

        CALL sp_log_evento(
            p_id_usuario,
            'ANULAR_REGISTRO',
            'registro',
            p_id_registro,
            p_ip_origen,
            'Anulación de registro (sin afectar stock). Motivo: ' || COALESCE(p_motivo,'(sin motivo)'),
            p_id_log_usuario
        );
        RETURN;
    END IF;

    IF v_es_transferencia = FALSE AND (v_signo IS NULL OR v_signo = 0) THEN
        RAISE EXCEPTION 'signo_movimiento no definido para tipo_registro=%', v_id_tipo_registro;
    END IF;

    FOR d IN
        SELECT rd.*
          FROM registro_detalle rd
         WHERE rd.id_registro = p_id_registro
    LOOP
        IF d.cantidad IS NULL OR d.cantidad <= 0 THEN
            RAISE EXCEPTION 'Detalle inválido: cantidad=% (id_registro_detalle=%)', d.cantidad, d.id_registro_detalle;
        END IF;

        IF d.id_bien_item IS NOT NULL AND d.cantidad <> 1 THEN
            RAISE EXCEPTION 'Bien por serie: cantidad debe ser 1 (id_registro_detalle=%)', d.id_registro_detalle;
        END IF;

        IF v_es_transferencia THEN
            IF d.id_bien_item IS NOT NULL THEN
                UPDATE bien_item
                   SET id_bodega = v_bodega_origen,
                       estado_item = 'DISPONIBLE'
                 WHERE id_bien_item = d.id_bien_item;
            END IF;

            IF d.id_bien_lote IS NOT NULL THEN
                INSERT INTO inventario_lote (id_bodega, id_bien_lote, stock_actual, stock_reservado)
                VALUES (v_bodega_origen, d.id_bien_lote, 0, 0)
                ON CONFLICT (id_bodega, id_bien_lote) DO NOTHING;

                INSERT INTO inventario_lote (id_bodega, id_bien_lote, stock_actual, stock_reservado)
                VALUES (v_bodega_destino, d.id_bien_lote, 0, 0)
                ON CONFLICT (id_bodega, id_bien_lote) DO NOTHING;

                SELECT il.stock_actual
                  INTO v_stock_actual_lote
                  FROM inventario_lote il
                 WHERE il.id_bodega = v_bodega_destino
                   AND il.id_bien_lote = d.id_bien_lote
                 FOR UPDATE;

                IF v_stock_actual_lote < d.cantidad THEN
                    RAISE EXCEPTION 'No se puede revertir: destino quedaría negativo. bodega_destino=% lote=% stock=% requerido=%',
                        v_bodega_destino, d.id_bien_lote, v_stock_actual_lote, d.cantidad;
                END IF;

                PERFORM 1
                  FROM inventario_lote il
                 WHERE il.id_bodega = v_bodega_origen
                   AND il.id_bien_lote = d.id_bien_lote
                 FOR UPDATE;

                UPDATE inventario_lote
                   SET stock_actual = stock_actual + d.cantidad,
                       fecha_ultima_actualizacion = NOW()
                 WHERE id_bodega = v_bodega_origen
                   AND id_bien_lote = d.id_bien_lote;

                UPDATE inventario_lote
                   SET stock_actual = stock_actual - d.cantidad,
                       fecha_ultima_actualizacion = NOW()
                 WHERE id_bodega = v_bodega_destino
                   AND id_bien_lote = d.id_bien_lote;

            ELSE
                IF d.id_bien IS NULL THEN
                    RAISE EXCEPTION 'Detalle sin id_bien para inventario normal (id_registro_detalle=%)', d.id_registro_detalle;
                END IF;

                INSERT INTO inventario (id_bodega, id_bien, stock_actual, stock_reservado)
                VALUES (v_bodega_origen, d.id_bien, 0, 0)
                ON CONFLICT (id_bodega, id_bien) DO NOTHING;

                INSERT INTO inventario (id_bodega, id_bien, stock_actual, stock_reservado)
                VALUES (v_bodega_destino, d.id_bien, 0, 0)
                ON CONFLICT (id_bodega, id_bien) DO NOTHING;

                SELECT i.stock_actual
                  INTO v_stock_actual
                  FROM inventario i
                 WHERE i.id_bodega = v_bodega_destino
                   AND i.id_bien = d.id_bien
                 FOR UPDATE;

                IF v_stock_actual < d.cantidad THEN
                    RAISE EXCEPTION 'No se puede revertir: destino quedaría negativo. bodega_destino=% bien=% stock=% requerido=%',
                        v_bodega_destino, d.id_bien, v_stock_actual, d.cantidad;
                END IF;

                PERFORM 1
                  FROM inventario i
                 WHERE i.id_bodega = v_bodega_origen
                   AND i.id_bien = d.id_bien
                 FOR UPDATE;

                UPDATE inventario
                   SET stock_actual = stock_actual + d.cantidad,
                       fecha_ultima_actualizacion = NOW()
                 WHERE id_bodega = v_bodega_origen
                   AND id_bien = d.id_bien;

                UPDATE inventario
                   SET stock_actual = stock_actual - d.cantidad,
                       fecha_ultima_actualizacion = NOW()
                 WHERE id_bodega = v_bodega_destino
                   AND id_bien = d.id_bien;
            END IF;

        ELSE
            IF v_bodega_origen IS NULL AND v_bodega_destino IS NULL THEN
                RAISE EXCEPTION 'Registro sin bodega_origen ni bodega_destino (id_registro=%)', p_id_registro;
            END IF;

            IF v_bodega_origen IS NOT NULL THEN
                IF d.id_bien_item IS NOT NULL THEN
                    IF v_signo < 0 THEN
                        UPDATE bien_item
                           SET estado_item = 'DISPONIBLE'
                         WHERE id_bien_item = d.id_bien_item;
                    ELSE
                        UPDATE bien_item
                           SET estado_item = 'NO_DISPONIBLE'
                         WHERE id_bien_item = d.id_bien_item;
                    END IF;
                END IF;

                IF d.id_bien_lote IS NOT NULL THEN
                    INSERT INTO inventario_lote (id_bodega, id_bien_lote, stock_actual, stock_reservado)
                    VALUES (v_bodega_origen, d.id_bien_lote, 0, 0)
                    ON CONFLICT (id_bodega, id_bien_lote) DO NOTHING;

                    SELECT il.stock_actual
                      INTO v_stock_actual_lote
                      FROM inventario_lote il
                     WHERE il.id_bodega = v_bodega_origen
                       AND il.id_bien_lote = d.id_bien_lote
                     FOR UPDATE;

                    IF (-v_signo) < 0 AND v_stock_actual_lote < d.cantidad THEN
                        RAISE EXCEPTION 'No se puede revertir: stock quedaría negativo. bodega=% lote=% stock=% requerido=%',
                            v_bodega_origen, d.id_bien_lote, v_stock_actual_lote, d.cantidad;
                    END IF;

                    UPDATE inventario_lote
                       SET stock_actual = stock_actual + ((-v_signo) * d.cantidad),
                           fecha_ultima_actualizacion = NOW()
                     WHERE id_bodega = v_bodega_origen
                       AND id_bien_lote = d.id_bien_lote;

                ELSE
                    IF d.id_bien IS NULL THEN
                        RAISE EXCEPTION 'Detalle sin id_bien para inventario normal (id_registro_detalle=%)', d.id_registro_detalle;
                    END IF;

                    INSERT INTO inventario (id_bodega, id_bien, stock_actual, stock_reservado)
                    VALUES (v_bodega_origen, d.id_bien, 0, 0)
                    ON CONFLICT (id_bodega, id_bien) DO NOTHING;

                    SELECT i.stock_actual
                      INTO v_stock_actual
                      FROM inventario i
                     WHERE i.id_bodega = v_bodega_origen
                       AND i.id_bien = d.id_bien
                     FOR UPDATE;

                    IF (-v_signo) < 0 AND v_stock_actual < d.cantidad THEN
                        RAISE EXCEPTION 'No se puede revertir: stock quedaría negativo. bodega=% bien=% stock=% requerido=%',
                            v_bodega_origen, d.id_bien, v_stock_actual, d.cantidad;
                    END IF;

                    UPDATE inventario
                       SET stock_actual = stock_actual + ((-v_signo) * d.cantidad),
                           fecha_ultima_actualizacion = NOW()
                     WHERE id_bodega = v_bodega_origen
                       AND id_bien = d.id_bien;
                END IF;

            ELSE
                IF d.id_bien_lote IS NOT NULL THEN
                    INSERT INTO inventario_lote (id_bodega, id_bien_lote, stock_actual, stock_reservado)
                    VALUES (v_bodega_destino, d.id_bien_lote, 0, 0)
                    ON CONFLICT (id_bodega, id_bien_lote) DO NOTHING;

                    SELECT il.stock_actual
                      INTO v_stock_actual_lote
                      FROM inventario_lote il
                     WHERE il.id_bodega = v_bodega_destino
                       AND il.id_bien_lote = d.id_bien_lote
                     FOR UPDATE;

                    IF (-v_signo) < 0 AND v_stock_actual_lote < d.cantidad THEN
                        RAISE EXCEPTION 'No se puede revertir: stock quedaría negativo. bodega=% lote=% stock=% requerido=%',
                            v_bodega_destino, d.id_bien_lote, v_stock_actual_lote, d.cantidad;
                    END IF;

                    UPDATE inventario_lote
                       SET stock_actual = stock_actual + ((-v_signo) * d.cantidad),
                           fecha_ultima_actualizacion = NOW()
                     WHERE id_bodega = v_bodega_destino
                       AND id_bien_lote = d.id_bien_lote;

                ELSE
                    IF d.id_bien IS NULL THEN
                        RAISE EXCEPTION 'Detalle sin id_bien para inventario normal (id_registro_detalle=%)', d.id_registro_detalle;
                    END IF;

                    INSERT INTO inventario (id_bodega, id_bien, stock_actual, stock_reservado)
                    VALUES (v_bodega_destino, d.id_bien, 0, 0)
                    ON CONFLICT (id_bodega, id_bien) DO NOTHING;

                    SELECT i.stock_actual
                      INTO v_stock_actual
                      FROM inventario i
                     WHERE i.id_bodega = v_bodega_destino
                       AND i.id_bien = d.id_bien
                     FOR UPDATE;

                    IF (-v_signo) < 0 AND v_stock_actual < d.cantidad THEN
                        RAISE EXCEPTION 'No se puede revertir: stock quedaría negativo. bodega=% bien=% stock=% requerido=%',
                            v_bodega_destino, d.id_bien, v_stock_actual, d.cantidad;
                    END IF;

                    UPDATE inventario
                       SET stock_actual = stock_actual + ((-v_signo) * d.cantidad),
                           fecha_ultima_actualizacion = NOW()
                     WHERE id_bodega = v_bodega_destino
                       AND id_bien = d.id_bien;
                END IF;
            END IF;
        END IF;
    END LOOP;

    UPDATE registro
       SET estado_registro = 'ANULADO',
           fecha_actualizacion = NOW(),
           observaciones_registro = COALESCE(observaciones_registro,'') ||
                                   E'\n[ANULADO] ' || COALESCE(p_motivo,'(sin motivo)')
     WHERE id_registro = p_id_registro;

    CALL sp_log_evento(
        p_id_usuario,
        'ANULAR_REGISTRO',
        'registro',
        p_id_registro,
        p_ip_origen,
        'Anulación y reverso de inventario. Motivo: ' || COALESCE(p_motivo,'(sin motivo)'),
        p_id_log_usuario
    );
END;
$$;

-- ============================================================
-- 3) INVENTARIO / RESERVAS
-- ============================================================

-- 07) sp_inventario_reservar
CREATE OR REPLACE PROCEDURE sp_inventario_reservar(
    IN  p_id_bodega    BIGINT,
    IN  p_id_bien      BIGINT,
    IN  p_id_bien_lote BIGINT,
    IN  p_cantidad     NUMERIC(14,3)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_disponible NUMERIC(14,3);
BEGIN
    IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
        RAISE EXCEPTION 'Cantidad inválida: %', p_cantidad;
    END IF;

    IF p_id_bien_lote IS NOT NULL THEN
        INSERT INTO inventario_lote (id_bodega, id_bien_lote, stock_actual, stock_reservado)
        VALUES (p_id_bodega, p_id_bien_lote, 0, 0)
        ON CONFLICT (id_bodega, id_bien_lote) DO NOTHING;

        SELECT (il.stock_actual - il.stock_reservado)
          INTO v_disponible
          FROM inventario_lote il
         WHERE il.id_bodega = p_id_bodega
           AND il.id_bien_lote = p_id_bien_lote
         FOR UPDATE;

        IF v_disponible < p_cantidad THEN
            RAISE EXCEPTION 'Stock disponible insuficiente para reservar. bodega=% lote=% disponible=% requerido=%',
                p_id_bodega, p_id_bien_lote, v_disponible, p_cantidad;
        END IF;

        UPDATE inventario_lote
           SET stock_reservado = stock_reservado + p_cantidad,
               fecha_ultima_actualizacion = NOW()
         WHERE id_bodega = p_id_bodega
           AND id_bien_lote = p_id_bien_lote;

        RETURN;
    END IF;

    IF p_id_bien IS NULL THEN
        RAISE EXCEPTION 'Debe enviar p_id_bien o p_id_bien_lote';
    END IF;

    INSERT INTO inventario (id_bodega, id_bien, stock_actual, stock_reservado)
    VALUES (p_id_bodega, p_id_bien, 0, 0)
    ON CONFLICT (id_bodega, id_bien) DO NOTHING;

    SELECT (i.stock_actual - i.stock_reservado)
      INTO v_disponible
      FROM inventario i
     WHERE i.id_bodega = p_id_bodega
       AND i.id_bien = p_id_bien
     FOR UPDATE;

    IF v_disponible < p_cantidad THEN
        RAISE EXCEPTION 'Stock disponible insuficiente para reservar. bodega=% bien=% disponible=% requerido=%',
            p_id_bodega, p_id_bien, v_disponible, p_cantidad;
    END IF;

    UPDATE inventario
       SET stock_reservado = stock_reservado + p_cantidad,
           fecha_ultima_actualizacion = NOW()
     WHERE id_bodega = p_id_bodega
       AND id_bien = p_id_bien;
END;
$$;

-- 08) sp_inventario_liberar_reserva
CREATE OR REPLACE PROCEDURE sp_inventario_liberar_reserva(
    IN  p_id_bodega    BIGINT,
    IN  p_id_bien      BIGINT,
    IN  p_id_bien_lote BIGINT,
    IN  p_cantidad     NUMERIC(14,3)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_reservado NUMERIC(14,3);
BEGIN
    IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
        RAISE EXCEPTION 'Cantidad inválida: %', p_cantidad;
    END IF;

    IF p_id_bien_lote IS NOT NULL THEN
        SELECT il.stock_reservado
          INTO v_reservado
          FROM inventario_lote il
         WHERE il.id_bodega = p_id_bodega
           AND il.id_bien_lote = p_id_bien_lote
         FOR UPDATE;

        IF v_reservado IS NULL THEN
            RAISE EXCEPTION 'No existe inventario_lote para bodega=% lote=%', p_id_bodega, p_id_bien_lote;
        END IF;

        IF v_reservado < p_cantidad THEN
            RAISE EXCEPTION 'No se puede liberar más de lo reservado. bodega=% lote=% reservado=% a_liberar=%',
                p_id_bodega, p_id_bien_lote, v_reservado, p_cantidad;
        END IF;

        UPDATE inventario_lote
           SET stock_reservado = stock_reservado - p_cantidad,
               fecha_ultima_actualizacion = NOW()
         WHERE id_bodega = p_id_bodega
           AND id_bien_lote = p_id_bien_lote;

        RETURN;
    END IF;

    IF p_id_bien IS NULL THEN
        RAISE EXCEPTION 'Debe enviar p_id_bien o p_id_bien_lote';
    END IF;

    SELECT i.stock_reservado
      INTO v_reservado
      FROM inventario i
     WHERE i.id_bodega = p_id_bodega
       AND i.id_bien = p_id_bien
     FOR UPDATE;

    IF v_reservado IS NULL THEN
        RAISE EXCEPTION 'No existe inventario para bodega=% bien=%', p_id_bodega, p_id_bien;
    END IF;

    IF v_reservado < p_cantidad THEN
        RAISE EXCEPTION 'No se puede liberar más de lo reservado. bodega=% bien=% reservado=% a_liberar=%',
            p_id_bodega, p_id_bien, v_reservado, p_cantidad;
    END IF;

    UPDATE inventario
       SET stock_reservado = stock_reservado - p_cantidad,
           fecha_ultima_actualizacion = NOW()
     WHERE id_bodega = p_id_bodega
       AND id_bien = p_id_bien;
END;
$$;

-- 09) sp_inventario_consumir_reserva
CREATE OR REPLACE PROCEDURE sp_inventario_consumir_reserva(
    IN  p_id_bodega    BIGINT,
    IN  p_id_bien      BIGINT,
    IN  p_id_bien_lote BIGINT,
    IN  p_cantidad     NUMERIC(14,3)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_reservado NUMERIC(14,3);
    v_actual    NUMERIC(14,3);
BEGIN
    IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
        RAISE EXCEPTION 'Cantidad inválida: %', p_cantidad;
    END IF;

    IF p_id_bien_lote IS NOT NULL THEN
        SELECT il.stock_reservado, il.stock_actual
          INTO v_reservado, v_actual
          FROM inventario_lote il
         WHERE il.id_bodega = p_id_bodega
           AND il.id_bien_lote = p_id_bien_lote
         FOR UPDATE;

        IF v_reservado IS NULL THEN
            RAISE EXCEPTION 'No existe inventario_lote para bodega=% lote=%', p_id_bodega, p_id_bien_lote;
        END IF;

        IF v_reservado < p_cantidad THEN
            RAISE EXCEPTION 'Reserva insuficiente para consumir. bodega=% lote=% reservado=% requerido=%',
                p_id_bodega, p_id_bien_lote, v_reservado, p_cantidad;
        END IF;

        IF v_actual < p_cantidad THEN
            RAISE EXCEPTION 'Stock_actual insuficiente para consumir. bodega=% lote=% stock_actual=% requerido=%',
                p_id_bodega, p_id_bien_lote, v_actual, p_cantidad;
        END IF;

        UPDATE inventario_lote
           SET stock_reservado = stock_reservado - p_cantidad,
               stock_actual    = stock_actual - p_cantidad,
               fecha_ultima_actualizacion = NOW()
         WHERE id_bodega = p_id_bodega
           AND id_bien_lote = p_id_bien_lote;

        RETURN;
    END IF;

    IF p_id_bien IS NULL THEN
        RAISE EXCEPTION 'Debe enviar p_id_bien o p_id_bien_lote';
    END IF;

    SELECT i.stock_reservado, i.stock_actual
      INTO v_reservado, v_actual
      FROM inventario i
     WHERE i.id_bodega = p_id_bodega
       AND i.id_bien = p_id_bien
     FOR UPDATE;

    IF v_reservado IS NULL THEN
        RAISE EXCEPTION 'No existe inventario para bodega=% bien=%', p_id_bodega, p_id_bien;
    END IF;

    IF v_reservado < p_cantidad THEN
        RAISE EXCEPTION 'Reserva insuficiente para consumir. bodega=% bien=% reservado=% requerido=%',
            p_id_bodega, p_id_bien, v_reservado, p_cantidad;
    END IF;

    IF v_actual < p_cantidad THEN
        RAISE EXCEPTION 'Stock_actual insuficiente para consumir. bodega=% bien=% stock_actual=% requerido=%',
            p_id_bodega, p_id_bien, v_actual, p_cantidad;
    END IF;

    UPDATE inventario
       SET stock_reservado = stock_reservado - p_cantidad,
           stock_actual    = stock_actual - p_cantidad,
           fecha_ultima_actualizacion = NOW()
     WHERE id_bodega = p_id_bodega
       AND id_bien = p_id_bien;
END;
$$;

-- ============================================================
-- 4) SOLICITUDES (logística) + reserva
-- ============================================================

-- 10) sp_solicitud_cambiar_estado_y_reservar
CREATE OR REPLACE PROCEDURE sp_solicitud_cambiar_estado_y_reservar(
    IN  p_id_solicitud        BIGINT,
    IN  p_id_estado_nuevo     BIGINT,
    IN  p_id_bodega_reserva   BIGINT,
    IN  p_id_usuario          BIGINT,
    IN  p_ip_origen           VARCHAR(45),
    IN  p_observacion         TEXT,
    OUT p_id_log_usuario      BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_estado_actual_id   BIGINT;
    v_estado_actual_nom  VARCHAR(60);
    v_estado_nuevo_nom   VARCHAR(60);

    v_nuevo_upper        VARCHAR(60);
    v_actual_upper       VARCHAR(60);

    d RECORD;
BEGIN
    SELECT sl.id_estado_solicitud
      INTO v_estado_actual_id
      FROM solicitud_logistica sl
     WHERE sl.id_solicitud = p_id_solicitud;

    IF v_estado_actual_id IS NULL THEN
        RAISE EXCEPTION 'No existe solicitud_logistica con id_solicitud=%', p_id_solicitud;
    END IF;

    SELECT es.nombre_estado
      INTO v_estado_actual_nom
      FROM estado_solicitud es
     WHERE es.id_estado_solicitud = v_estado_actual_id;

    SELECT es.nombre_estado
      INTO v_estado_nuevo_nom
      FROM estado_solicitud es
     WHERE es.id_estado_solicitud = p_id_estado_nuevo;

    IF v_estado_nuevo_nom IS NULL THEN
        RAISE EXCEPTION 'Estado nuevo inválido (id_estado_solicitud=%)', p_id_estado_nuevo;
    END IF;

    IF v_estado_actual_id = p_id_estado_nuevo THEN
        RAISE EXCEPTION 'La solicitud ya está en ese estado (%).', v_estado_nuevo_nom;
    END IF;

    v_nuevo_upper  := UPPER(TRIM(v_estado_nuevo_nom));
    v_actual_upper := UPPER(TRIM(COALESCE(v_estado_actual_nom,'')));

    UPDATE solicitud_logistica
       SET id_estado_solicitud = p_id_estado_nuevo,
           fecha_respuesta = CASE
               WHEN v_nuevo_upper IN ('APROBADA','RECHAZADA','CANCELADA','CANCELADO')
               THEN NOW()
               ELSE fecha_respuesta
           END,
           observaciones_solicitud = CASE
               WHEN p_observacion IS NULL OR LENGTH(TRIM(p_observacion)) = 0
               THEN observaciones_solicitud
               ELSE COALESCE(observaciones_solicitud,'') ||
                    E'\n[' || TO_CHAR(NOW(),'YYYY-MM-DD HH24:MI') || '] ' || p_observacion
           END
     WHERE id_solicitud = p_id_solicitud;

    IF v_nuevo_upper = 'APROBADA' THEN
        IF p_id_bodega_reserva IS NULL THEN
            RAISE EXCEPTION 'Para APROBADA debe enviar p_id_bodega_reserva';
        END IF;

        FOR d IN
            SELECT sd.*
              FROM solicitud_detalle sd
             WHERE sd.id_solicitud = p_id_solicitud
        LOOP
            IF d.id_bien IS NOT NULL THEN
                CALL sp_inventario_reservar(
                    p_id_bodega_reserva,
                    d.id_bien,
                    NULL,
                    d.cantidad
                );
            END IF;
        END LOOP;

    ELSIF v_nuevo_upper IN ('RECHAZADA','CANCELADA','CANCELADO') AND v_actual_upper = 'APROBADA' THEN
        IF p_id_bodega_reserva IS NULL THEN
            RAISE EXCEPTION 'Para liberar reserva debe enviar p_id_bodega_reserva';
        END IF;

        FOR d IN
            SELECT sd.*
              FROM solicitud_detalle sd
             WHERE sd.id_solicitud = p_id_solicitud
        LOOP
            IF d.id_bien IS NOT NULL THEN
                CALL sp_inventario_liberar_reserva(
                    p_id_bodega_reserva,
                    d.id_bien,
                    NULL,
                    d.cantidad
                );
            END IF;
        END LOOP;
    END IF;

    CALL sp_log_evento(
        p_id_usuario,
        'CAMBIAR_ESTADO_SOLICITUD',
        'solicitud_logistica',
        p_id_solicitud,
        p_ip_origen,
        'Cambio de estado: ' || COALESCE(v_estado_actual_nom,'(null)') ||
        ' -> ' || v_estado_nuevo_nom ||
        CASE WHEN p_id_bodega_reserva IS NULL THEN '' ELSE ' | bodega_reserva=' || p_id_bodega_reserva::TEXT END,
        p_id_log_usuario
    );
END;
$$;

-- 11) sp_solicitud_generar_registro_salida
CREATE OR REPLACE PROCEDURE sp_solicitud_generar_registro_salida(
    IN  p_id_solicitud        BIGINT,
    IN  p_id_tipo_registro    BIGINT,
    IN  p_id_usuario          BIGINT,
    IN  p_id_bodega_origen    BIGINT,
    IN  p_referencia_externa  VARCHAR(80),
    IN  p_observaciones       TEXT,
    IN  p_ip_origen           VARCHAR(45),
    OUT p_id_registro         BIGINT,
    OUT p_id_log_usuario      BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_id_empleado        BIGINT;
    v_id_estado          BIGINT;
    v_estado_nombre      VARCHAR(60);
    d RECORD;
BEGIN
    SELECT sl.id_empleado, sl.id_estado_solicitud
      INTO v_id_empleado, v_id_estado
      FROM solicitud_logistica sl
     WHERE sl.id_solicitud = p_id_solicitud;

    IF v_id_estado IS NULL THEN
        RAISE EXCEPTION 'No existe solicitud_logistica con id_solicitud=%', p_id_solicitud;
    END IF;

    SELECT es.nombre_estado
      INTO v_estado_nombre
      FROM estado_solicitud es
     WHERE es.id_estado_solicitud = v_id_estado;

    IF UPPER(TRIM(COALESCE(v_estado_nombre,''))) <> 'APROBADA' THEN
        RAISE EXCEPTION 'La solicitud debe estar APROBADA para generar el registro. Estado actual=%', v_estado_nombre;
    END IF;

    IF p_id_bodega_origen IS NULL THEN
        RAISE EXCEPTION 'Debe indicar p_id_bodega_origen para generar una salida';
    END IF;

    INSERT INTO registro (
        id_tipo_registro,
        id_usuario,
        id_empleado,
        id_solicitud,
        id_documento,
        id_bodega_origen,
        id_bodega_destino,
        referencia_externa,
        observaciones_registro,
        estado_registro,
        fecha_registro,
        fecha_actualizacion
    )
    VALUES (
        p_id_tipo_registro,
        p_id_usuario,
        v_id_empleado,
        p_id_solicitud,
        NULL,
        p_id_bodega_origen,
        NULL,
        COALESCE(p_referencia_externa, ('SOL-' || p_id_solicitud::TEXT)),
        p_observaciones,
        'REGISTRADO',
        NOW(),
        NOW()
    )
    RETURNING id_registro INTO p_id_registro;

    FOR d IN
        SELECT sd.*
          FROM solicitud_detalle sd
         WHERE sd.id_solicitud = p_id_solicitud
    LOOP
        IF d.id_bien IS NULL THEN
            CONTINUE;
        END IF;

        INSERT INTO registro_detalle (
            id_registro,
            id_bien,
            id_bien_item,
            id_bien_lote,
            cantidad,
            costo_unitario,
            lote,
            observacion_detalle
        )
        VALUES (
            p_id_registro,
            d.id_bien,
            NULL,
            NULL,
            d.cantidad,
            NULL,
            NULL,
            COALESCE(d.justificacion, d.descripcion_item)
        );
    END LOOP;

    CALL sp_log_evento(
        p_id_usuario,
        'GENERAR_REGISTRO_DESDE_SOLICITUD',
        'registro',
        p_id_registro,
        p_ip_origen,
        'Se generó un registro REGISTRADO desde solicitud=' || p_id_solicitud::TEXT ||
        ' | bodega_origen=' || p_id_bodega_origen::TEXT,
        p_id_log_usuario
    );
END;
$$;

-- ============================================================
-- 5) ASIGNACIONES (actas)
-- ============================================================

-- 12) sp_asignacion_crear
CREATE OR REPLACE PROCEDURE sp_asignacion_crear(
    IN  p_id_tipo_registro_asignacion BIGINT,
    IN  p_id_usuario                  BIGINT,
    IN  p_ip_origen                   VARCHAR(45),

    IN  p_id_empleado                 BIGINT,
    IN  p_id_bodega_origen            BIGINT,

    IN  p_id_bien                     BIGINT,
    IN  p_id_bien_item                BIGINT,
    IN  p_cantidad                    NUMERIC(14,3),

    IN  p_tipo_acta                   VARCHAR(40),
    IN  p_numero_acta                 VARCHAR(60),
    IN  p_fecha_emision_acta          DATE,
    IN  p_motivo_asignacion           VARCHAR(120),
    IN  p_observaciones               TEXT,
    IN  p_archivo_pdf                 TEXT,
    IN  p_firma_digital               BOOLEAN,

    OUT p_id_asignacion               BIGINT,
    OUT p_id_registro                 BIGINT,
    OUT p_id_log_usuario              BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_id_bien_final BIGINT;
    v_id_log_confirm BIGINT;
BEGIN
    IF p_id_empleado IS NULL THEN
        RAISE EXCEPTION 'Debe indicar p_id_empleado';
    END IF;

    IF p_id_bodega_origen IS NULL THEN
        RAISE EXCEPTION 'Debe indicar p_id_bodega_origen';
    END IF;

    IF p_tipo_acta IS NULL OR LENGTH(TRIM(p_tipo_acta)) = 0 THEN
        RAISE EXCEPTION 'Debe indicar p_tipo_acta';
    END IF;

    IF p_id_bien_item IS NOT NULL THEN
        SELECT bi.id_bien
          INTO v_id_bien_final
          FROM bien_item bi
         WHERE bi.id_bien_item = p_id_bien_item;

        IF v_id_bien_final IS NULL THEN
            RAISE EXCEPTION 'No existe bien_item con id=%', p_id_bien_item;
        END IF;

        PERFORM 1
          FROM bien_item bi
         WHERE bi.id_bien_item = p_id_bien_item
           AND bi.id_bodega = p_id_bodega_origen
           AND bi.estado_item = 'DISPONIBLE';

        IF NOT FOUND THEN
            RAISE EXCEPTION 'El bien_item=% no está DISPONIBLE en la bodega_origen=%',
                p_id_bien_item, p_id_bodega_origen;
        END IF;

    ELSE
        IF p_id_bien IS NULL THEN
            RAISE EXCEPTION 'Debe indicar p_id_bien o p_id_bien_item';
        END IF;

        IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
            RAISE EXCEPTION 'Cantidad inválida: %', p_cantidad;
        END IF;

        v_id_bien_final := p_id_bien;
    END IF;

    CALL sp_registro_crear(
        p_id_tipo_registro_asignacion,
        p_id_usuario,
        p_id_empleado,
        NULL,
        NULL,
        p_id_bodega_origen,
        NULL,
        p_numero_acta,
        p_observaciones,
        p_id_registro
    );

    IF p_id_bien_item IS NOT NULL THEN
        CALL sp_registro_agregar_detalle(
            p_id_registro,
            v_id_bien_final,
            p_id_bien_item,
            NULL,
            1,
            NULL,
            NULL,
            'Asignación por acta: ' || COALESCE(p_numero_acta,'(sin número)'),
            NULL
        );
    ELSE
        CALL sp_registro_agregar_detalle(
            p_id_registro,
            v_id_bien_final,
            NULL,
            NULL,
            p_cantidad,
            NULL,
            NULL,
            'Asignación por acta: ' || COALESCE(p_numero_acta,'(sin número)'),
            NULL
        );
    END IF;

    CALL sp_registro_confirmar_y_afectar_stock(
        p_id_registro,
        p_id_usuario,
        p_ip_origen,
        v_id_log_confirm
    );

    INSERT INTO asignacion_bien (
        id_bien,
        id_empleado,
        id_registro,
        tipo_acta,
        numero_acta,
        fecha_emision_acta,
        fecha_entrega_bien,
        fecha_devolucion_bien,
        motivo_asignacion,
        observaciones_asignacion,
        firma_digital,
        archivo_pdf,
        estado_asignacion,
        fecha_registro
    )
    VALUES (
        v_id_bien_final,
        p_id_empleado,
        p_id_registro,
        p_tipo_acta,
        p_numero_acta,
        p_fecha_emision_acta,
        NOW(),
        NULL,
        p_motivo_asignacion,
        p_observaciones,
        COALESCE(p_firma_digital, FALSE),
        p_archivo_pdf,
        'ACTIVA',
        NOW()
    )
    RETURNING id_asignacion INTO p_id_asignacion;

    IF p_id_bien_item IS NOT NULL THEN
        UPDATE bien_item
           SET id_empleado = p_id_empleado,
               estado_item = 'ASIGNADO'
         WHERE id_bien_item = p_id_bien_item;
    END IF;

    CALL sp_log_evento(
        p_id_usuario,
        'CREAR_ASIGNACION',
        'asignacion_bien',
        p_id_asignacion,
        p_ip_origen,
        'Asignación creada. acta=' || COALESCE(p_numero_acta,'(sin número)') ||
        ' | id_registro=' || p_id_registro::TEXT,
        p_id_log_usuario
    );
END;
$$;

-- 13) sp_asignacion_devolver
CREATE OR REPLACE PROCEDURE sp_asignacion_devolver(
    IN  p_id_asignacion                BIGINT,
    IN  p_id_tipo_registro_devolucion  BIGINT,
    IN  p_id_usuario                   BIGINT,
    IN  p_ip_origen                    VARCHAR(45),

    IN  p_id_bodega_destino            BIGINT,
    IN  p_id_bien_item                 BIGINT,
    IN  p_cantidad                     NUMERIC(14,3),

    IN  p_observaciones                TEXT,
    OUT p_id_registro                  BIGINT,
    OUT p_id_log_usuario               BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_estado_asig  VARCHAR(20);
    v_id_bien      BIGINT;
    v_id_empleado  BIGINT;
    v_id_log_confirm BIGINT;
BEGIN
    SELECT ab.estado_asignacion, ab.id_bien, ab.id_empleado
      INTO v_estado_asig, v_id_bien, v_id_empleado
      FROM asignacion_bien ab
     WHERE ab.id_asignacion = p_id_asignacion;

    IF v_estado_asig IS NULL THEN
        RAISE EXCEPTION 'No existe asignacion_bien con id=%', p_id_asignacion;
    END IF;

    IF v_estado_asig <> 'ACTIVA' THEN
        RAISE EXCEPTION 'Solo se puede devolver una asignación ACTIVA. Estado actual=%', v_estado_asig;
    END IF;

    IF p_id_bodega_destino IS NULL THEN
        RAISE EXCEPTION 'Debe indicar p_id_bodega_destino';
    END IF;

    CALL sp_registro_crear(
        p_id_tipo_registro_devolucion,
        p_id_usuario,
        v_id_empleado,
        NULL,
        NULL,
        p_id_bodega_destino,
        NULL,
        'DEV-ASIG-' || p_id_asignacion::TEXT,
        p_observaciones,
        p_id_registro
    );

    IF p_id_bien_item IS NOT NULL THEN
        CALL sp_registro_agregar_detalle(
            p_id_registro,
            v_id_bien,
            p_id_bien_item,
            NULL,
            1,
            NULL,
            NULL,
            'Devolución de asignación id=' || p_id_asignacion::TEXT,
            NULL
        );
    ELSE
        IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
            RAISE EXCEPTION 'Debe indicar p_cantidad (>0) si no envía p_id_bien_item';
        END IF;

        CALL sp_registro_agregar_detalle(
            p_id_registro,
            v_id_bien,
            NULL,
            NULL,
            p_cantidad,
            NULL,
            NULL,
            'Devolución de asignación id=' || p_id_asignacion::TEXT,
            NULL
        );
    END IF;

    CALL sp_registro_confirmar_y_afectar_stock(
        p_id_registro,
        p_id_usuario,
        p_ip_origen,
        v_id_log_confirm
    );

    UPDATE asignacion_bien
       SET fecha_devolucion_bien = NOW(),
           estado_asignacion = 'DEVUELTA',
           observaciones_asignacion = CASE
              WHEN p_observaciones IS NULL OR LENGTH(TRIM(p_observaciones)) = 0
              THEN observaciones_asignacion
              ELSE COALESCE(observaciones_asignacion,'') ||
                   E'\n[DEVOLUCIÓN] ' || p_observaciones
           END
     WHERE id_asignacion = p_id_asignacion;

    IF p_id_bien_item IS NOT NULL THEN
        UPDATE bien_item
           SET id_empleado = NULL,
               id_bodega   = p_id_bodega_destino,
               estado_item = 'DISPONIBLE'
         WHERE id_bien_item = p_id_bien_item;
    END IF;

    CALL sp_log_evento(
        p_id_usuario,
        'DEVOLVER_ASIGNACION',
        'asignacion_bien',
        p_id_asignacion,
        p_ip_origen,
        'Devolución registrada. id_registro=' || p_id_registro::TEXT,
        p_id_log_usuario
    );
END;
$$;

-- ============================================================
-- 6) MANTENIMIENTO
-- ============================================================

-- 14) sp_mantenimiento_programar
CREATE OR REPLACE PROCEDURE sp_mantenimiento_programar(
    IN  p_id_bien                 BIGINT,
    IN  p_id_tipo_mantenimiento   BIGINT,
    IN  p_id_proveedor            BIGINT,
    IN  p_id_documento            BIGINT,
    IN  p_fecha_programada        DATE,
    IN  p_kilometraje             NUMERIC(12,1),
    IN  p_descripcion             TEXT,
    IN  p_observaciones           TEXT,
    IN  p_id_usuario              BIGINT,
    IN  p_ip_origen               VARCHAR(45),
    OUT p_id_mantenimiento        BIGINT,
    OUT p_id_log_usuario          BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
    IF p_descripcion IS NULL OR LENGTH(TRIM(p_descripcion)) = 0 THEN
        RAISE EXCEPTION 'descripcion_mantenimiento es obligatoria';
    END IF;

    INSERT INTO mantenimiento (
        id_bien,
        id_tipo_mantenimiento,
        id_proveedor,
        id_documento,
        fecha_programada,
        kilometraje,
        descripcion_mantenimiento,
        costo_mantenimiento,
        estado_mantenimiento,
        observaciones_mantenimiento,
        fecha_registro
    )
    VALUES (
        p_id_bien,
        p_id_tipo_mantenimiento,
        p_id_proveedor,
        p_id_documento,
        p_fecha_programada,
        p_kilometraje,
        p_descripcion,
        NULL,
        'PROGRAMADO',
        p_observaciones,
        NOW()
    )
    RETURNING id_mantenimiento INTO p_id_mantenimiento;

    CALL sp_log_evento(
        p_id_usuario,
        'PROGRAMAR_MANTENIMIENTO',
        'mantenimiento',
        p_id_mantenimiento,
        p_ip_origen,
        'Mantenimiento programado. fecha_programada=' || COALESCE(p_fecha_programada::TEXT,'(null)'),
        p_id_log_usuario
    );
END;
$$;

-- 15) sp_mantenimiento_iniciar
CREATE OR REPLACE PROCEDURE sp_mantenimiento_iniciar(
    IN  p_id_mantenimiento   BIGINT,
    IN  p_fecha_inicio       DATE,
    IN  p_kilometraje        NUMERIC(12,1),
    IN  p_observaciones      TEXT,
    IN  p_id_usuario         BIGINT,
    IN  p_ip_origen          VARCHAR(45),
    OUT p_id_log_usuario     BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_estado VARCHAR(20);
BEGIN
    SELECT estado_mantenimiento
      INTO v_estado
      FROM mantenimiento
     WHERE id_mantenimiento = p_id_mantenimiento;

    IF v_estado IS NULL THEN
        RAISE EXCEPTION 'No existe mantenimiento id=%', p_id_mantenimiento;
    END IF;

    IF v_estado <> 'PROGRAMADO' THEN
        RAISE EXCEPTION 'Solo se puede iniciar si está PROGRAMADO. Estado actual=%', v_estado;
    END IF;

    UPDATE mantenimiento
       SET fecha_inicio = COALESCE(p_fecha_inicio, CURRENT_DATE),
           kilometraje  = COALESCE(p_kilometraje, kilometraje),
           estado_mantenimiento = 'EN_PROCESO',
           observaciones_mantenimiento = CASE
              WHEN p_observaciones IS NULL OR LENGTH(TRIM(p_observaciones))=0
              THEN observaciones_mantenimiento
              ELSE COALESCE(observaciones_mantenimiento,'') ||
                   E'\n[INICIO] ' || p_observaciones
           END
     WHERE id_mantenimiento = p_id_mantenimiento;

    CALL sp_log_evento(
        p_id_usuario,
        'INICIAR_MANTENIMIENTO',
        'mantenimiento',
        p_id_mantenimiento,
        p_ip_origen,
        'Mantenimiento iniciado. fecha_inicio=' || COALESCE(p_fecha_inicio::TEXT, CURRENT_DATE::TEXT),
        p_id_log_usuario
    );
END;
$$;

-- 16) sp_mantenimiento_finalizar
CREATE OR REPLACE PROCEDURE sp_mantenimiento_finalizar(
    IN  p_id_mantenimiento   BIGINT,
    IN  p_fecha_fin          DATE,
    IN  p_costo              NUMERIC(14,2),
    IN  p_observaciones      TEXT,
    IN  p_id_usuario         BIGINT,
    IN  p_ip_origen          VARCHAR(45),
    OUT p_id_log_usuario     BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_estado VARCHAR(20);
BEGIN
    SELECT estado_mantenimiento
      INTO v_estado
      FROM mantenimiento
     WHERE id_mantenimiento = p_id_mantenimiento;

    IF v_estado IS NULL THEN
        RAISE EXCEPTION 'No existe mantenimiento id=%', p_id_mantenimiento;
    END IF;

    IF v_estado <> 'EN_PROCESO' THEN
        RAISE EXCEPTION 'Solo se puede finalizar si está EN_PROCESO. Estado actual=%', v_estado;
    END IF;

    UPDATE mantenimiento
       SET fecha_fin = COALESCE(p_fecha_fin, CURRENT_DATE),
           costo_mantenimiento = p_costo,
           estado_mantenimiento = 'FINALIZADO',
           observaciones_mantenimiento = CASE
              WHEN p_observaciones IS NULL OR LENGTH(TRIM(p_observaciones))=0
              THEN observaciones_mantenimiento
              ELSE COALESCE(observaciones_mantenimiento,'') ||
                   E'\n[FINALIZADO] ' || p_observaciones
           END
     WHERE id_mantenimiento = p_id_mantenimiento;

    CALL sp_log_evento(
        p_id_usuario,
        'FINALIZAR_MANTENIMIENTO',
        'mantenimiento',
        p_id_mantenimiento,
        p_ip_origen,
        'Mantenimiento finalizado. fecha_fin=' || COALESCE(p_fecha_fin::TEXT, CURRENT_DATE::TEXT) ||
        ' costo=' || COALESCE(p_costo::TEXT,'(null)'),
        p_id_log_usuario
    );
END;
$$;

-- ============================================================
-- 7) SEGURIDAD (para llegar a 21 SP)
-- ============================================================

-- 18) sp_usuario_crear
CREATE OR REPLACE PROCEDURE sp_usuario_crear(
    IN  p_id_empleado          BIGINT,
    IN  p_nombre_usuario       VARCHAR(60),
    IN  p_contrasena_hash      TEXT,
    IN  p_correo_login         VARCHAR(160),
    IN  p_id_usuario_accion    BIGINT,
    IN  p_ip_origen            VARCHAR(45),
    OUT p_id_usuario_nuevo     BIGINT,
    OUT p_id_log_usuario       BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
    IF p_nombre_usuario IS NULL OR LENGTH(TRIM(p_nombre_usuario))=0 THEN
        RAISE EXCEPTION 'nombre_usuario es obligatorio';
    END IF;

    IF p_contrasena_hash IS NULL OR LENGTH(TRIM(p_contrasena_hash))=0 THEN
        RAISE EXCEPTION 'contrasena_usuario (hash) es obligatoria';
    END IF;

    INSERT INTO usuario (
        id_empleado,
        nombre_usuario,
        contrasena_usuario,
        correo_login
    )
    VALUES (
        p_id_empleado,
        TRIM(p_nombre_usuario),
        p_contrasena_hash,
        p_correo_login
    )
    RETURNING id_usuario INTO p_id_usuario_nuevo;

    CALL sp_log_evento(
        p_id_usuario_accion,
        'CREAR_USUARIO',
        'usuario',
        p_id_usuario_nuevo,
        p_ip_origen,
        'Usuario creado: ' || TRIM(p_nombre_usuario),
        p_id_log_usuario
    );
END;
$$;

-- 19) sp_usuario_bloquear_desbloquear
CREATE OR REPLACE PROCEDURE sp_usuario_bloquear_desbloquear(
    IN  p_id_usuario_objetivo  BIGINT,
    IN  p_bloqueado            BOOLEAN,
    IN  p_reset_intentos       BOOLEAN,
    IN  p_id_usuario_accion    BIGINT,
    IN  p_ip_origen            VARCHAR(45),
    IN  p_motivo               TEXT,
    OUT p_id_log_usuario       BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_existe BIGINT;
BEGIN
    SELECT id_usuario INTO v_existe
      FROM usuario
     WHERE id_usuario = p_id_usuario_objetivo;

    IF v_existe IS NULL THEN
        RAISE EXCEPTION 'No existe usuario id=%', p_id_usuario_objetivo;
    END IF;

    UPDATE usuario
       SET bloqueado = COALESCE(p_bloqueado, bloqueado),
           intentos_fallidos = CASE
              WHEN COALESCE(p_reset_intentos,FALSE) THEN 0
              ELSE intentos_fallidos
           END
     WHERE id_usuario = p_id_usuario_objetivo;

    CALL sp_log_evento(
        p_id_usuario_accion,
        CASE WHEN COALESCE(p_bloqueado,FALSE) THEN 'BLOQUEAR_USUARIO' ELSE 'DESBLOQUEAR_USUARIO' END,
        'usuario',
        p_id_usuario_objetivo,
        p_ip_origen,
        COALESCE(p_motivo,'(sin motivo)'),
        p_id_log_usuario
    );
END;
$$;

-- 20) sp_usuario_asignar_rol
CREATE OR REPLACE PROCEDURE sp_usuario_asignar_rol(
    IN  p_id_usuario_objetivo  BIGINT,
    IN  p_id_rol               BIGINT,
    IN  p_id_usuario_accion    BIGINT,
    IN  p_ip_origen            VARCHAR(45),
    OUT p_id_usuario_rol       BIGINT,
    OUT p_id_log_usuario       BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO usuario_rol (id_usuario, id_rol)
    VALUES (p_id_usuario_objetivo, p_id_rol)
    ON CONFLICT (id_usuario, id_rol) DO NOTHING
    RETURNING id_usuario_rol INTO p_id_usuario_rol;

    CALL sp_log_evento(
        p_id_usuario_accion,
        'ASIGNAR_ROL_USUARIO',
        'usuario_rol',
        p_id_usuario_rol,
        p_ip_origen,
        'Asignar rol id_rol=' || p_id_rol::TEXT || ' a usuario id_usuario=' || p_id_usuario_objetivo::TEXT,
        p_id_log_usuario
    );
END;
$$;

-- 21) sp_rol_asignar_permiso
CREATE OR REPLACE PROCEDURE sp_rol_asignar_permiso(
    IN  p_id_rol               BIGINT,
    IN  p_id_permiso           BIGINT,
    IN  p_id_usuario_accion    BIGINT,
    IN  p_ip_origen            VARCHAR(45),
    OUT p_id_rol_permiso       BIGINT,
    OUT p_id_log_usuario       BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO rol_permiso (id_rol, id_permiso)
    VALUES (p_id_rol, p_id_permiso)
    ON CONFLICT (id_rol, id_permiso) DO NOTHING
    RETURNING id_rol_permiso INTO p_id_rol_permiso;

    CALL sp_log_evento(
        p_id_usuario_accion,
        'ASIGNAR_PERMISO_ROL',
        'rol_permiso',
        p_id_rol_permiso,
        p_ip_origen,
        'Asignar permiso id_permiso=' || p_id_permiso::TEXT || ' a rol id_rol=' || p_id_rol::TEXT,
        p_id_log_usuario
    );
END;
$$;

-- ============================================================
-- FIN DEL ARCHIVO
-- ============================================================
