export declare enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export declare class Logger {
  static debug(tag: string, message: string, ...args: any[]): void;
  static info(tag: string, message: string, ...args: any[]): void;
  static warn(tag: string, message: string, ...args: any[]): void;
  static error(tag: string, message: string, ...args: any[]): void;
  static getRecentLogs(tag?: string, count?: number): {level: LogLevel, tag: string, message: string, timestamp: number}[];
  static clearCache(): void;
} 