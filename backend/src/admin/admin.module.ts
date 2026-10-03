import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { UndernetPrismaService } from './undernet-prisma.service';
import { NewsModule } from '../news/news.module';

@Module({
  imports: [NewsModule],
  providers: [AdminService, UndernetPrismaService],
})
export class AdminModule {}
