import { Module } from '@nestjs/common';
import { CommunitiesController } from './communities.controller';
import { CommunitiesService } from './communities.service';
import { CommunityModerationController } from './community-moderation.controller';
import { CommunityModerationService } from './community-moderation.service';

@Module({
  controllers: [CommunitiesController, CommunityModerationController],
  providers: [CommunitiesService, CommunityModerationService],
  // Eksportowany, bo `canModerate` jest jedyną odpowiedzią na pytanie
  // „czy ta osoba może tu moderować" i musi być dostępna dla modułów
  // postów i komentarzy.
  exports: [CommunitiesService, CommunityModerationService],
})
export class CommunitiesModule {}
