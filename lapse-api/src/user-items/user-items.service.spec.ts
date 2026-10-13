import { Test, TestingModule } from '@nestjs/testing';
import { UserItemsService } from './user-items.service.js';

describe('UserItemsService', () => {
  let service: UserItemsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UserItemsService],
    }).compile();

    service = module.get<UserItemsService>(UserItemsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
