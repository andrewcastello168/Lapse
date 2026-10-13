import { Test, TestingModule } from '@nestjs/testing';
import { TimelineController } from './timeline.controller.js';
import { TimelineService } from './timeline.service.js';

describe('TimelineController', () => {
  let controller: TimelineController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TimelineController],
      providers: [TimelineService],
    }).compile();

    controller = module.get<TimelineController>(TimelineController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
