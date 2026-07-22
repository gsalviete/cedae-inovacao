declare module 'oracledb' {
  const OUT_FORMAT_OBJECT: number;
  const BIND_OUT: number;
  const NUMBER: number;

  interface ConnectionAttributes {
    user?: string;
    password?: string;
    connectString: string;
  }

  interface BindOutParam {
    dir: number;
    type: number;
  }

  interface ExecuteOptions {
    outFormat?: number;
  }

  interface ExecuteResult {
    rows?: unknown[];
    outBinds?: unknown[];
    rowsAffected?: number;
  }

  interface Connection {
    execute(
      sql: string,
      binds: unknown[],
      options?: ExecuteOptions,
    ): Promise<ExecuteResult>;
    commit(): Promise<void>;
    close(): Promise<void>;
  }

  function getConnection(attrs: ConnectionAttributes): Promise<Connection>;
  function initOracleClient(opts?: Record<string, unknown>): void;
}
