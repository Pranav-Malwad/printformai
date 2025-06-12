import LogRocket from 'logrocket';

// Initialize LogRocket with your app ID
// You'll need to replace 'your-app/your-app-id' with your actual LogRocket app ID
// You can find this in your LogRocket dashboard after signing up
const initLogRocket = () => {
  // Only initialize LogRocket in the browser and in production
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
    LogRocket.init('your-app/your-app-id');
    
    // Capture Redux actions and state (if you're using Redux)
    // LogRocket.reduxMiddleware();
    
    // You can add user identification here if needed
    // LogRocket.identify('user-id', {
    //   name: 'User Name',
    //   email: 'user@example.com',
    // });
    
    console.log('[LOGGER] LogRocket initialized');
  }
};

// Initialize LogRocket when this module is imported
initLogRocket();

// Log levels
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

// Custom logger class
class Logger {
  private module: string;
  
  constructor(module: string) {
    this.module = module;
  }
  
  // Format the log message with module name and timestamp
  private formatMessage(message: string): string {
    return `[${this.module}] ${message}`;
  }
  
  // Log to console and LogRocket
  private log(level: LogLevel, message: string, ...args: any[]): void {
    const formattedMessage = this.formatMessage(message);
    
    // Always log to console
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formattedMessage, ...args);
        break;
      case LogLevel.INFO:
        console.log(formattedMessage, ...args);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage, ...args);
        break;
      case LogLevel.ERROR:
        console.error(formattedMessage, ...args);
        break;
    }
    
    // Log to LogRocket in browser and production
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
      // Convert any Error objects to strings for better logging
      const processedArgs = args.map(arg => 
        arg instanceof Error ? { 
          message: arg.message, 
          stack: arg.stack,
          name: arg.name
        } : arg
      );
      
      // Log to LogRocket with appropriate level
      switch (level) {
        case LogLevel.DEBUG:
        case LogLevel.INFO:
          LogRocket.log(formattedMessage, ...processedArgs);
          break;
        case LogLevel.WARN:
          LogRocket.warn(formattedMessage, ...processedArgs);
          break;
        case LogLevel.ERROR:
          LogRocket.error(formattedMessage, ...processedArgs);
          break;
      }
    }
    
    // For serverless environments (Netlify Functions)
    // You could add additional logging here, like writing to a file in /tmp
    // or sending logs to another service
    if (typeof window === 'undefined' && process.env.NETLIFY === 'true') {
      // Example: You could write critical logs to a file in /tmp
      // This is just an example and would require fs module
      // if (level === LogLevel.ERROR) {
      //   const fs = require('fs/promises');
      //   const logPath = '/tmp/app-errors.log';
      //   fs.appendFile(logPath, `${new Date().toISOString()} ${formattedMessage}\n`)
      //     .catch(err => console.error('Failed to write to log file:', err));
      // }
    }
  }
  
  // Public logging methods
  debug(message: string, ...args: any[]): void {
    this.log(LogLevel.DEBUG, message, ...args);
  }
  
  info(message: string, ...args: any[]): void {
    this.log(LogLevel.INFO, message, ...args);
  }
  
  warn(message: string, ...args: any[]): void {
    this.log(LogLevel.WARN, message, ...args);
  }
  
  error(message: string, ...args: any[]): void {
    this.log(LogLevel.ERROR, message, ...args);
  }
}

// Factory function to create a logger for a specific module
export function createLogger(module: string): Logger {
  return new Logger(module);
}

// Default export
export default createLogger;