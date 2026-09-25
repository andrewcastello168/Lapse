import { Module } from '@nestjs/common';
import { databaseProvider } from './database.js';

@Module({
  providers: [databaseProvider],
  exports: [databaseProvider],
})
export class DatabaseModule {}
