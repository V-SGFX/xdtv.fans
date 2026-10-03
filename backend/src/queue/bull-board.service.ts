import { Injectable } from '@nestjs/common';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Queue } from 'bullmq';

@Injectable()
export class BullBoardService {
  private serverAdapter: ExpressAdapter;
  private queues: Queue[] = [];

  constructor() {
    this.serverAdapter = new ExpressAdapter();
    this.serverAdapter.setBasePath('/admin/queues');
  }

  addQueue(queue: Queue) {
    this.queues.push(queue);
  }

  initialize() {
    createBullBoard({
      queues: this.queues.map(q => new BullMQAdapter(q)),
      serverAdapter: this.serverAdapter,
    });
  }

  getRouter() {
    return this.serverAdapter.getRouter();
  }
}
