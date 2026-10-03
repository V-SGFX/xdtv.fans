import { Controller, Get, Post, Delete, Param, Query, Body, Req, UseGuards, ParseIntPipe, HttpCode } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('messages')
export class MessagesController {
  constructor(private messagesService: MessagesService) {}

  @Get()
  findByChannel(
    @Query('channelId', ParseIntPipe) channelId: number,
    @Query('before') before?: number,
    @Query('limit') limit = 50,
  ) {
    return this.messagesService.findByChannel(channelId, before, Math.min(100, Math.max(1, limit)));
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() body, @Req() req) {
    return this.messagesService.create(req.user.userId, body.channelId, body.content);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  remove(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.messagesService.remove(id, req.user.userId, req.user.role);
  }
}
