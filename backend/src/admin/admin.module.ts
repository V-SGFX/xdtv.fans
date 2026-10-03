import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { NewsModule } from '../news/news.module';

@Module({
  imports: [NewsModule],
  providers: [AdminService],
})
export class AdminModule {}
