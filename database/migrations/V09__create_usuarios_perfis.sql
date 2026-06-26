-- V09__create_usuarios_perfis.sql
-- Fonte: future-data-model.md §3.5
-- concedido_por_id: sem FK neste script (auto-referencial no seed admin); FK adicionada em V29
-- Oracle 19c | Idempotente | Schema: CEDAE_INOVACAO

DECLARE
  v_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM user_tables WHERE table_name = 'USUARIOS_PERFIS';
  IF v_count = 0 THEN
    EXECUTE IMMEDIATE '
      CREATE TABLE USUARIOS_PERFIS (
        usuario_id       NUMBER    NOT NULL,
        perfil_id        NUMBER    NOT NULL,
        concedido_em     TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
        concedido_por_id NUMBER    NOT NULL,
        valido_ate       TIMESTAMP,
        revogado_em      TIMESTAMP,
        CONSTRAINT PK_USUARIOS_PERFIS PRIMARY KEY (usuario_id, perfil_id),
        CONSTRAINT FK_UP_USUARIO FOREIGN KEY (usuario_id) REFERENCES USUARIOS(id),
        CONSTRAINT FK_UP_PERFIL  FOREIGN KEY (perfil_id)  REFERENCES PERFIS_ACESSO(id)
      )';
    EXECUTE IMMEDIATE 'CREATE INDEX IDX_UP_USUARIO  ON USUARIOS_PERFIS (usuario_id)';
    EXECUTE IMMEDIATE 'CREATE INDEX IDX_UP_PERFIL   ON USUARIOS_PERFIS (perfil_id)';
    EXECUTE IMMEDIATE 'CREATE INDEX IDX_UP_VIGENCIA ON USUARIOS_PERFIS (usuario_id, valido_ate, revogado_em)';
  END IF;
END;
/

COMMIT;
