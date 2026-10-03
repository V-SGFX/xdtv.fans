import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { EmojisService } from './emojis.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('emojis')
export class EmojisController {
  constructor(private emojisService: EmojisService) {}

  @Get()
  findAll() {
    return this.emojisService.findAll();
  }

  @Get('global')
  findGlobal() {
    return this.emojisService.findGlobal();
  }

  @Get('premium')
  findPremium() {
    return this.emojisService.findPremium();
  }

  @Get('streamer/:id')
  findByStreamer(@Param('id', ParseIntPipe) id: number) {
    return this.emojisService.findByStreamer(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  create(
    @Body()
    body: {
      name: string;
      code: string;
      url: string;
      isAnimated?: boolean;
      isGlobal?: boolean;
      isPremium?: boolean;
      streamerProfileId?: number;
    },
  ) {
    return this.emojisService.create(body);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @HttpCode(204)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.emojisService.remove(id);
  }
}
