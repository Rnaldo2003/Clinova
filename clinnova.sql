-- ============================================================
--  CLINNOVA — Base de datos (MySQL 8+)
--  Gestión Médica Inteligente
--  Script de creación de esquema + datos de ejemplo
-- ============================================================
--  Cómo usarlo en MySQL Workbench:
--    1. Abre Workbench y conéctate a tu servidor local.
--    2. Abre este archivo (File > Open SQL Script).
--    3. Ejecuta todo (rayo amarillo / Ctrl+Shift+Enter).
--  OJO: la primera línea BORRA y recrea la BD clinnova.
--       Si ya tienes datos, comenta esa línea.
-- ============================================================

DROP DATABASE IF EXISTS clinnova;
CREATE DATABASE clinnova
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE clinnova;

SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
--  1. ORGANIZACIÓN (preparado para multiclínica)
-- ============================================================
CREATE TABLE clinicas (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  nombre        VARCHAR(120)  NOT NULL,
  ciudad        VARCHAR(80),
  direccion     VARCHAR(200),
  telefono      VARCHAR(30),
  activo        TINYINT(1)    NOT NULL DEFAULT 1,
  creado_en     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE sedes (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  clinica_id    INT           NOT NULL,
  nombre        VARCHAR(120)  NOT NULL,
  direccion     VARCHAR(200),
  telefono      VARCHAR(30),
  activo        TINYINT(1)    NOT NULL DEFAULT 1,
  CONSTRAINT fk_sede_clinica FOREIGN KEY (clinica_id) REFERENCES clinicas(id)
) ENGINE=InnoDB;

-- ============================================================
--  2. SEGURIDAD: roles y usuarios (personal)
-- ============================================================
CREATE TABLE roles (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  nombre        VARCHAR(40)   NOT NULL UNIQUE,   -- superadmin, admin, medico, enfermeria, recepcion, laboratorio
  descripcion   VARCHAR(160)
) ENGINE=InnoDB;

CREATE TABLE especialidades (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  nombre        VARCHAR(80)   NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE usuarios (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  clinica_id      INT           NOT NULL,
  sede_id         INT,
  rol_id          INT           NOT NULL,
  especialidad_id INT,                          -- solo para médicos
  nombres         VARCHAR(80)   NOT NULL,
  apellidos       VARCHAR(80)   NOT NULL,
  email           VARCHAR(120)  NOT NULL UNIQUE,
  password_hash   VARCHAR(255)  NOT NULL,        -- guarda SIEMPRE el hash, nunca texto plano
  telefono        VARCHAR(30),
  colegiatura     VARCHAR(40),                   -- nº de colegiación del médico
  activo          TINYINT(1)    NOT NULL DEFAULT 1,
  ultimo_acceso   TIMESTAMP     NULL,
  creado_en       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_usr_clinica  FOREIGN KEY (clinica_id)      REFERENCES clinicas(id),
  CONSTRAINT fk_usr_sede     FOREIGN KEY (sede_id)         REFERENCES sedes(id),
  CONSTRAINT fk_usr_rol      FOREIGN KEY (rol_id)          REFERENCES roles(id),
  CONSTRAINT fk_usr_esp      FOREIGN KEY (especialidad_id) REFERENCES especialidades(id)
) ENGINE=InnoDB;

-- ============================================================
--  3. PACIENTES
-- ============================================================
CREATE TABLE pacientes (
  id                   INT AUTO_INCREMENT PRIMARY KEY,
  clinica_id           INT           NOT NULL,
  expediente_no        VARCHAR(20)   UNIQUE,        -- nº de expediente visible
  identidad            VARCHAR(20),                 -- documento de identidad
  nombres              VARCHAR(80)   NOT NULL,
  apellidos            VARCHAR(80)   NOT NULL,
  fecha_nacimiento     DATE,
  sexo                 ENUM('M','F','O'),
  telefono             VARCHAR(30),
  email                VARCHAR(120),
  direccion            VARCHAR(200),
  tipo_sangre          VARCHAR(5),
  alergias             TEXT,                        -- resumen rápido de alergias
  antecedentes         TEXT,
  contacto_emerg_nombre   VARCHAR(120),
  contacto_emerg_telefono VARCHAR(30),
  activo               TINYINT(1)    NOT NULL DEFAULT 1,
  creado_en            TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pac_clinica FOREIGN KEY (clinica_id) REFERENCES clinicas(id)
) ENGINE=InnoDB;

-- ============================================================
--  4. AGENDA / CITAS
-- ============================================================
CREATE TABLE servicios (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  clinica_id    INT           NOT NULL,
  nombre        VARCHAR(100)  NOT NULL,
  duracion_min  INT           NOT NULL DEFAULT 30,
  precio        DECIMAL(10,2) NOT NULL DEFAULT 0,
  activo        TINYINT(1)    NOT NULL DEFAULT 1,
  CONSTRAINT fk_serv_clinica FOREIGN KEY (clinica_id) REFERENCES clinicas(id)
) ENGINE=InnoDB;

CREATE TABLE citas (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  clinica_id    INT           NOT NULL,
  paciente_id   INT           NOT NULL,
  medico_id     INT           NOT NULL,            -- usuarios con rol medico
  servicio_id   INT,
  fecha         DATE          NOT NULL,
  hora_inicio   TIME          NOT NULL,
  hora_fin      TIME,
  tipo          ENUM('Consulta general','Control','Seguimiento','Primera consulta','Resultado de laboratorio','Otro')
                              NOT NULL DEFAULT 'Consulta general',
  estado        ENUM('Pendiente','Confirmada','En espera','En consulta','Atendida','Cancelada','No asistio')
                              NOT NULL DEFAULT 'Pendiente',
  motivo        VARCHAR(200),
  notas         VARCHAR(255),
  creado_en     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cita_clinica  FOREIGN KEY (clinica_id)  REFERENCES clinicas(id),
  CONSTRAINT fk_cita_paciente FOREIGN KEY (paciente_id) REFERENCES pacientes(id),
  CONSTRAINT fk_cita_medico   FOREIGN KEY (medico_id)   REFERENCES usuarios(id),
  CONSTRAINT fk_cita_servicio FOREIGN KEY (servicio_id) REFERENCES servicios(id),
  INDEX idx_cita_fecha (fecha, hora_inicio),
  INDEX idx_cita_estado (estado)
) ENGINE=InnoDB;

-- ============================================================
--  5. ENFERMERÍA: signos vitales
-- ============================================================
CREATE TABLE signos_vitales (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  cita_id          INT,
  paciente_id      INT           NOT NULL,
  tomado_por       INT,                            -- usuario (enfermería)
  peso_kg          DECIMAL(5,2),
  talla_cm         DECIMAL(5,2),
  temperatura_c    DECIMAL(4,1),
  presion_sistolica  INT,
  presion_diastolica INT,
  frecuencia_cardiaca INT,
  frecuencia_resp  INT,
  saturacion_o2    INT,
  motivo_consulta  VARCHAR(255),
  observaciones    TEXT,
  creado_en        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sv_cita     FOREIGN KEY (cita_id)     REFERENCES citas(id),
  CONSTRAINT fk_sv_paciente FOREIGN KEY (paciente_id) REFERENCES pacientes(id),
  CONSTRAINT fk_sv_usuario  FOREIGN KEY (tomado_por)  REFERENCES usuarios(id)
) ENGINE=InnoDB;

-- ============================================================
--  6. EXPEDIENTE: consultas (encuentros clínicos)
-- ============================================================
CREATE TABLE consultas (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  cita_id       INT,
  paciente_id   INT           NOT NULL,
  medico_id     INT           NOT NULL,
  fecha         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  motivo        TEXT,
  historia      TEXT,                              -- historia de la enfermedad actual
  exploracion   TEXT,                              -- exploración física
  diagnostico   TEXT,
  cie10         VARCHAR(10),                       -- código diagnóstico (CIE-10)
  tratamiento   TEXT,
  indicaciones  TEXT,
  creado_en     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cons_cita     FOREIGN KEY (cita_id)     REFERENCES citas(id),
  CONSTRAINT fk_cons_paciente FOREIGN KEY (paciente_id) REFERENCES pacientes(id),
  CONSTRAINT fk_cons_medico   FOREIGN KEY (medico_id)   REFERENCES usuarios(id)
) ENGINE=InnoDB;

-- ============================================================
--  7. RECETAS
-- ============================================================
CREATE TABLE recetas (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  consulta_id   INT,
  paciente_id   INT           NOT NULL,
  medico_id     INT           NOT NULL,
  fecha         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notas         VARCHAR(255),
  CONSTRAINT fk_rec_consulta FOREIGN KEY (consulta_id) REFERENCES consultas(id),
  CONSTRAINT fk_rec_paciente FOREIGN KEY (paciente_id) REFERENCES pacientes(id),
  CONSTRAINT fk_rec_medico   FOREIGN KEY (medico_id)   REFERENCES usuarios(id)
) ENGINE=InnoDB;

CREATE TABLE receta_items (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  receta_id     INT           NOT NULL,
  medicamento   VARCHAR(160)  NOT NULL,
  dosis         VARCHAR(80),                       -- ej. "500 mg"
  frecuencia    VARCHAR(80),                       -- ej. "cada 8 horas"
  duracion      VARCHAR(80),                       -- ej. "7 días"
  indicaciones  VARCHAR(255),
  CONSTRAINT fk_ri_receta FOREIGN KEY (receta_id) REFERENCES recetas(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
--  8. LABORATORIO: órdenes y resultados
-- ============================================================
CREATE TABLE ordenes_laboratorio (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  consulta_id   INT,
  paciente_id   INT           NOT NULL,
  medico_id     INT           NOT NULL,
  estudio       VARCHAR(160)  NOT NULL,            -- ej. "Hemograma completo"
  estado        ENUM('Solicitada','En proceso','Lista','Entregada','Cancelada')
                              NOT NULL DEFAULT 'Solicitada',
  fecha_solicitud DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_resultado DATETIME    NULL,
  CONSTRAINT fk_lab_consulta FOREIGN KEY (consulta_id) REFERENCES consultas(id),
  CONSTRAINT fk_lab_paciente FOREIGN KEY (paciente_id) REFERENCES pacientes(id),
  CONSTRAINT fk_lab_medico   FOREIGN KEY (medico_id)   REFERENCES usuarios(id)
) ENGINE=InnoDB;

CREATE TABLE resultados_laboratorio (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  orden_id        INT           NOT NULL,
  parametro       VARCHAR(120),                    -- ej. "Hemoglobina"
  valor           VARCHAR(80),
  unidad          VARCHAR(40),
  rango_referencia VARCHAR(80),
  archivo_url     VARCHAR(255),                    -- PDF/imagen adjunta
  creado_en       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_resl_orden FOREIGN KEY (orden_id) REFERENCES ordenes_laboratorio(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
--  9. REFERENCIAS Y DOCUMENTOS
-- ============================================================
CREATE TABLE referencias (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  paciente_id   INT           NOT NULL,
  medico_id     INT           NOT NULL,
  especialidad_destino VARCHAR(100),
  motivo        TEXT,
  estado        ENUM('Enviada','Aceptada','Atendida','Cerrada') NOT NULL DEFAULT 'Enviada',
  fecha         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ref_paciente FOREIGN KEY (paciente_id) REFERENCES pacientes(id),
  CONSTRAINT fk_ref_medico   FOREIGN KEY (medico_id)   REFERENCES usuarios(id)
) ENGINE=InnoDB;

CREATE TABLE documentos (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  paciente_id   INT           NOT NULL,
  subido_por    INT,
  tipo          ENUM('Receta','Orden','Resultado','Incapacidad','Referencia','Otro') NOT NULL DEFAULT 'Otro',
  titulo        VARCHAR(160),
  archivo_url   VARCHAR(255),
  creado_en     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_doc_paciente FOREIGN KEY (paciente_id) REFERENCES pacientes(id),
  CONSTRAINT fk_doc_usuario  FOREIGN KEY (subido_por)  REFERENCES usuarios(id)
) ENGINE=InnoDB;

-- ============================================================
--  10. MENSAJERÍA Y SEGUIMIENTO
-- ============================================================
CREATE TABLE mensajes (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  paciente_id   INT           NOT NULL,
  area          ENUM('Administrativa','Clinica','Laboratorio','Recepcion') NOT NULL DEFAULT 'Administrativa',
  contenido     TEXT          NOT NULL,
  leido         TINYINT(1)    NOT NULL DEFAULT 0,
  estado        ENUM('Nuevo','En proceso','Resuelto') NOT NULL DEFAULT 'Nuevo',
  creado_en     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_msg_paciente FOREIGN KEY (paciente_id) REFERENCES pacientes(id)
) ENGINE=InnoDB;

CREATE TABLE seguimientos (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  paciente_id   INT           NOT NULL,
  medico_id     INT,
  consulta_id   INT,
  descripcion   VARCHAR(255),
  fecha_programada DATE,
  estado        ENUM('Pendiente','Completado','Cancelado') NOT NULL DEFAULT 'Pendiente',
  creado_en     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_seg_paciente FOREIGN KEY (paciente_id) REFERENCES pacientes(id),
  CONSTRAINT fk_seg_medico   FOREIGN KEY (medico_id)   REFERENCES usuarios(id),
  CONSTRAINT fk_seg_consulta FOREIGN KEY (consulta_id) REFERENCES consultas(id)
) ENGINE=InnoDB;

-- ============================================================
--  11. PAGOS Y FACTURACIÓN
-- ============================================================
CREATE TABLE pagos (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  paciente_id   INT           NOT NULL,
  cita_id       INT,
  monto_total   DECIMAL(10,2) NOT NULL DEFAULT 0,
  monto_pagado  DECIMAL(10,2) NOT NULL DEFAULT 0,
  metodo        ENUM('Efectivo','Tarjeta','Transferencia','Otro') DEFAULT 'Efectivo',
  estado        ENUM('Pendiente','Parcial','Pagado','Vencido') NOT NULL DEFAULT 'Pendiente',
  fecha         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pago_paciente FOREIGN KEY (paciente_id) REFERENCES pacientes(id),
  CONSTRAINT fk_pago_cita     FOREIGN KEY (cita_id)     REFERENCES citas(id)
) ENGINE=InnoDB;

-- ============================================================
--  12. INVENTARIO
-- ============================================================
CREATE TABLE inventario (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  clinica_id    INT           NOT NULL,
  nombre        VARCHAR(160)  NOT NULL,
  tipo          ENUM('Medicamento','Material','Insumo') NOT NULL DEFAULT 'Medicamento',
  existencia    INT           NOT NULL DEFAULT 0,
  stock_minimo  INT           NOT NULL DEFAULT 0,
  lote          VARCHAR(60),
  vencimiento   DATE,
  proveedor     VARCHAR(120),
  CONSTRAINT fk_inv_clinica FOREIGN KEY (clinica_id) REFERENCES clinicas(id)
) ENGINE=InnoDB;

CREATE TABLE movimientos_inventario (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  inventario_id INT           NOT NULL,
  tipo          ENUM('Entrada','Salida','Ajuste') NOT NULL,
  cantidad      INT           NOT NULL,
  motivo        VARCHAR(160),
  creado_en     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_movinv FOREIGN KEY (inventario_id) REFERENCES inventario(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
--  13. NOTIFICACIONES
-- ============================================================
CREATE TABLE notificaciones (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id    INT           NOT NULL,
  tipo          ENUM('Cita','Resultado','Seguimiento','Tarea','Inventario','Documento','Mensaje') NOT NULL,
  titulo        VARCHAR(160),
  descripcion   VARCHAR(255),
  leida         TINYINT(1)    NOT NULL DEFAULT 0,
  creado_en     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notif_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
) ENGINE=InnoDB;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
--  DATOS DE EJEMPLO (coinciden con el dashboard de Clinnova)
-- ============================================================

-- Clínica y sede
INSERT INTO clinicas (id, nombre, ciudad, direccion, telefono) VALUES
  (1, 'Clínica San Pedro', 'Tegucigalpa', 'Col. Médica, Ave. Salud', '+504 2200-0000');
INSERT INTO sedes (id, clinica_id, nombre, direccion) VALUES
  (1, 1, 'Sede Central', 'Col. Médica, Ave. Salud');

-- Roles
INSERT INTO roles (id, nombre, descripcion) VALUES
  (1,'superadmin','Configuración global'),
  (2,'admin','Administrador de clínica'),
  (3,'medico','Médico'),
  (4,'enfermeria','Enfermería'),
  (5,'recepcion','Recepción'),
  (6,'laboratorio','Laboratorio');

-- Especialidades
INSERT INTO especialidades (id, nombre) VALUES
  (1,'Medicina General'),(2,'Pediatría'),(3,'Cardiología'),(4,'Ginecología');

-- Usuarios (password_hash es solo de ejemplo; en el backend usa bcrypt/argon2)
INSERT INTO usuarios (id, clinica_id, sede_id, rol_id, especialidad_id, nombres, apellidos, email, password_hash, colegiatura) VALUES
  (1, 1, 1, 3, 1, 'Carlos', 'López',   'carlos.lopez@clinnova.hn',  '$2y$10$ejemploHashNoUsarEnProd', 'CM-12345'),
  (2, 1, 1, 4, NULL,'Laura','Mejía',   'laura.mejia@clinnova.hn',   '$2y$10$ejemploHashNoUsarEnProd', NULL),
  (3, 1, 1, 5, NULL,'Rosa', 'Flores',  'recepcion@clinnova.hn',     '$2y$10$ejemploHashNoUsarEnProd', NULL),
  (4, 1, 1, 2, NULL,'Admin','Clinnova','admin@clinnova.hn',         '$2y$10$ejemploHashNoUsarEnProd', NULL);

-- Servicios
INSERT INTO servicios (id, clinica_id, nombre, duracion_min, precio) VALUES
  (1,1,'Consulta general',30,600.00),
  (2,1,'Control',20,400.00),
  (3,1,'Primera consulta',40,800.00);

-- Pacientes (los del dashboard)
INSERT INTO pacientes (id, clinica_id, expediente_no, nombres, apellidos, fecha_nacimiento, sexo, telefono) VALUES
  (1,1,'EXP-0001','Juan','Pérez García','1991-03-10','M','+504 9900-0001'),
  (2,1,'EXP-0002','María','López','1974-06-20','F','+504 9900-0002'),
  (3,1,'EXP-0003','Carlos','Reyes','1985-01-15','M','+504 9900-0003'),
  (4,1,'EXP-0004','Ana','Martínez','1998-09-05','F','+504 9900-0004'),
  (5,1,'EXP-0005','Luis','Herrera','1966-11-30','M','+504 9900-0005'),
  (6,1,'EXP-0006','Sofía','Ramírez','1993-07-22','F','+504 9900-0006');

-- Citas de hoy (ajusta CURDATE() si quieres otra fecha)
INSERT INTO citas (clinica_id, paciente_id, medico_id, servicio_id, fecha, hora_inicio, tipo, estado) VALUES
  (1,1,1,1,CURDATE(),'08:00','Consulta general','En consulta'),
  (1,2,1,2,CURDATE(),'08:30','Control','En espera'),
  (1,3,1,2,CURDATE(),'09:00','Seguimiento','Confirmada'),
  (1,4,1,3,CURDATE(),'09:30','Primera consulta','Pendiente'),
  (1,5,1,2,CURDATE(),'10:00','Control','Confirmada'),
  (1,6,1,1,CURDATE(),'10:30','Resultado de laboratorio','Confirmada');

-- Inventario de ejemplo
INSERT INTO inventario (clinica_id, nombre, tipo, existencia, stock_minimo, vencimiento, proveedor) VALUES
  (1,'Amoxicilina 500mg','Medicamento',120,30,'2027-05-01','DistriFarma'),
  (1,'Guantes de látex (caja)','Material',8,10,NULL,'MediSupply'),
  (1,'Alcohol 70% 1L','Insumo',40,15,'2028-01-01','MediSupply');

-- ============================================================
--  Consultas rápidas de verificación (descomenta para probar):
-- ============================================================
-- SELECT c.hora_inicio, p.nombres, p.apellidos, c.tipo, c.estado
--   FROM citas c JOIN pacientes p ON p.id = c.paciente_id
--  WHERE c.fecha = CURDATE()
--  ORDER BY c.hora_inicio;

-- SELECT nombre, existencia, stock_minimo
--   FROM inventario
--  WHERE existencia <= stock_minimo;     -- inventario bajo

-- ============================================================
--  FIN DEL SCRIPT
-- ============================================================
