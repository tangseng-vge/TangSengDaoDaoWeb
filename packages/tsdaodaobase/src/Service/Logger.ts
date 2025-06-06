import WKApp from "../App";

/**
 * 日志级别
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

interface LogEntry {
  level: LogLevel;
  tag: string;
  message: string;
  timestamp: number;
}

// 内部服务类，处理日志逻辑
class LoggerServiceImpl {
  private static level: LogLevel = LogLevel.DEBUG;
  private static logCache: LogEntry[] = [];
  private static maxCacheSize: number = 1000;

  static shouldLog(level: LogLevel): boolean {
    return level >= this.level;
  }

  static addToCache(level: LogLevel, tag: string, message: string): void {
    if (this.logCache.length >= this.maxCacheSize) {
      this.logCache.shift();
    }
    this.logCache.push({
      level,
      tag,
      message,
      timestamp: Date.now()
    });
  }

  static formatMessage(message: string, args: any[]): string {
    if (args.length === 0) return message;
    return message.replace(/{(\d+)}/g, (match, number) => {
      return typeof args[number] !== 'undefined' ? args[number] : match;
    });
  }

  static getLogCache(): LogEntry[] {
    return this.logCache;
  }

  static clearLogCache(): void {
    this.logCache = [];
  }
}

// 导出的静态类，与类型声明匹配
export class Logger {
  static debug(tag: string, message: string, ...args: any[]): void {
    if (!LoggerServiceImpl.shouldLog(LogLevel.DEBUG)) return;
    const formattedMessage = LoggerServiceImpl.formatMessage(message, args);
    console.debug(`[${tag}] ${formattedMessage}`);
    LoggerServiceImpl.addToCache(LogLevel.DEBUG, tag, formattedMessage);
  }

  static info(tag: string, message: string, ...args: any[]): void {
    if (!LoggerServiceImpl.shouldLog(LogLevel.INFO)) return;
    const formattedMessage = LoggerServiceImpl.formatMessage(message, args);
    console.info(`[${tag}] ${formattedMessage}`);
    LoggerServiceImpl.addToCache(LogLevel.INFO, tag, formattedMessage);
  }

  static warn(tag: string, message: string, ...args: any[]): void {
    if (!LoggerServiceImpl.shouldLog(LogLevel.WARN)) return;
    const formattedMessage = LoggerServiceImpl.formatMessage(message, args);
    console.warn(`[${tag}] ${formattedMessage}`);
    LoggerServiceImpl.addToCache(LogLevel.WARN, tag, formattedMessage);
  }

  static error(tag: string, message: string, ...args: any[]): void {
    if (!LoggerServiceImpl.shouldLog(LogLevel.ERROR)) return;
    const formattedMessage = LoggerServiceImpl.formatMessage(message, args);
    console.error(`[${tag}] ${formattedMessage}`);
    LoggerServiceImpl.addToCache(LogLevel.ERROR, tag, formattedMessage);
  }

  static getRecentLogs(tag?: string, count: number = 10): LogEntry[] {
    let logs = LoggerServiceImpl.getLogCache();
    if (tag) {
      logs = logs.filter((log: LogEntry) => log.tag === tag);
    }
    return logs.slice(-count);
  }

  static clearCache(): void {
    LoggerServiceImpl.clearLogCache();
  }
}