import { Injectable, Logger } from '@nestjs/common';

export interface EventPayload {
  [key: string]: any;
}

type EventHandler = (payload: EventPayload) => Promise<void>;

@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);
  private handlers: Map<string, EventHandler[]> = new Map();

  on(event: string, handler: EventHandler) {
    const existing = this.handlers.get(event) || [];
    existing.push(handler);
    this.handlers.set(event, existing);
  }

  off(event: string, handler: EventHandler) {
    const existing = this.handlers.get(event) || [];
    this.handlers.set(event, existing.filter((h) => h !== handler));
  }

  async emit(event: string, payload: EventPayload) {
    const eventHandlers = this.handlers.get(event) || [];
    this.logger.debug(`Event: ${event} - ${eventHandlers.length} handlers`);

    const promises = eventHandlers.map((handler) => {
      try {
        return handler(payload);
      } catch (error) {
        this.logger.error(`Error in handler for event ${event}: ${error.message}`);
        return Promise.resolve();
      }
    });

    await Promise.allSettled(promises);
  }

  async emitAsync(event: string, payload: EventPayload) {
    const eventHandlers = this.handlers.get(event) || [];
    this.logger.debug(`Event (async): ${event} - ${eventHandlers.length} handlers`);

    for (const handler of eventHandlers) {
      try {
        await handler(payload);
      } catch (error) {
        this.logger.error(`Error in async handler for event ${event}: ${error.message}`);
      }
    }
  }
}
