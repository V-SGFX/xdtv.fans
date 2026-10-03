import { Controller, Get, Post, Param, Query, Req, UseGuards, ParseIntPipe, HttpCode } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@Req() req, @Query('page') page = 1, @Query('limit') limit = 20) {
    return this.notificationsService.findForUser(
      req.user.userId,
      Math.max(1, page),
      Math.min(100, Math.max(1, limit)),
    );
  }

  @Get('unread-count')
  @UseGuards(JwtAuthGuard)
  getUnreadCount(@Req() req) {
    return this.notificationsService.getUnreadCount(req.user.userId);
  }

  @Post(':id/read')
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  markAsRead(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.notificationsService.markAsRead(req.user.userId, id);
  }

  @Post('read-all')
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  markAllAsRead(@Req() req) {
    return this.notificationsService.markAllAsRead(req.user.userId);
  }
}
